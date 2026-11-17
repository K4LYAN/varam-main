"use strict";

const crypto = require("crypto");
const { query, queryRaw, transaction } = require("../db/pool");
const { quote } = require("./pricingService");
const cartService = require("./cartService");
const catalogService = require("./catalogService");
const auditService = require("./auditService");
const { invoiceUrl } = require("./invoiceService");
const { ORDER_STATUSES } = require("../config/defaults");
const { HttpError, notFound, badRequest, conflict } = require("../utils/httpError");

/* ------------------------------------------------------------------ */
/* Order numbers                                                       */
/* ------------------------------------------------------------------ */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32: no I, L, O, U

/**
 * VRM-YYMMDD-XXXXXXXX — date (IST) plus 40 random bits. Not sequential, so it
 * leaks neither order volume nor neighbouring customers' orders.
 */
function generateOrderNumber(now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000).toISOString();
  const date = ist.slice(2, 4) + ist.slice(5, 7) + ist.slice(8, 10);
  let rand = "";
  for (let i = 0; i < 8; i++) rand += ALPHABET[crypto.randomInt(32)];
  return `VRM-${date}-${rand}`;
}

/* ------------------------------------------------------------------ */
/* Shaping                                                             */
/* ------------------------------------------------------------------ */

const shapeItem = (i) => ({
  productName: i.product_name,
  sizeLabel: i.size_label,
  unitPrice: Number(i.unit_price),
  quantity: i.quantity,
  lineTotal: Number(i.line_total),
});

function shapeOrder(o, items = []) {
  return {
    orderNumber: o.order_number,
    status: o.status,
    createdAt: o.created_at,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    fulfillmentType: o.fulfillment_type,
    paymentMethod: o.payment_method,
    deliveryAddress: o.delivery_address,
    pincode: o.pincode,
    subtotal: Number(o.subtotal),
    discountAmount: Number(o.discount_amount),
    deliveryFee: Number(o.delivery_fee),
    totalAmount: Number(o.total_amount),
    couponCode: o.coupon_code,
    notes: o.notes,
    invoiceUrl: invoiceUrl(o.order_number),
    items: items.map(shapeItem),
  };
}

/** Items for many orders in one query, grouped by order id. */
async function itemsByOrder(orderIds, conn) {
  const map = new Map();
  if (!orderIds.length) return map;
  const rows = await queryRaw("SELECT * FROM order_items WHERE order_id IN (?) ORDER BY id", [orderIds], conn);
  for (const r of rows) {
    if (!map.has(r.order_id)) map.set(r.order_id, []);
    map.get(r.order_id).push(r);
  }
  return map;
}

/** Return the stock of every line of an order (one UPDATE … JOIN, inside the caller's transaction). */
async function restock(conn, orderId) {
  await query(
    `UPDATE product_variants v
     JOIN (SELECT variant_id, SUM(quantity) AS q FROM order_items WHERE order_id = ? AND variant_id IS NOT NULL GROUP BY variant_id) x
       ON x.variant_id = v.id
     SET v.stock_qty = v.stock_qty + x.q`,
    [orderId],
    conn,
  );
}

/** Give a coupon use back when its order is cancelled. */
async function releaseCoupon(conn, couponCode) {
  if (!couponCode) return;
  await query("UPDATE coupons SET used_count = GREATEST(used_count, 1) - 1 WHERE code = ?", [couponCode], conn);
}

/* ------------------------------------------------------------------ */
/* Checkout                                                            */
/* ------------------------------------------------------------------ */

/**
 * Place a direct order in ONE transaction:
 *   lock variants (FOR UPDATE) → re-price from MySQL → lock + redeem coupon →
 *   insert order + items (single multi-row INSERT) → decrement stock with a
 *   guarded UPDATE per line → clear the customer's server cart.
 * Any failure rolls everything back; nothing is half-written.
 */
async function placeOrder({ user, input, settings }) {
  const result = await transaction(async (conn) => {
    const q = await quote({ items: input.items, couponCode: input.couponCode, fulfillment: input.fulfillment }, settings, conn);
    if (q.hasProblems) {
      throw conflict(
        "Some items are out of stock or no longer available. Please review your cart.",
        q.lines.filter((l) => !l.available || l.stock < l.quantity).map((l) => ({ variantId: l.variantId, name: l.name, reason: l.reason })),
      );
    }
    if (!q.lines.length) throw badRequest("Your cart is empty");
    if (input.couponCode && !q.couponCode) throw badRequest(q.couponError || "This coupon code is not valid", { field: "couponCode" });

    // Redeem the coupon; the guard makes overspending impossible even without the row lock
    if (q.couponId) {
      const [upd] = await conn.execute(
        "UPDATE coupons SET used_count = used_count + 1 WHERE id = ? AND is_active = 1 AND (usage_limit IS NULL OR used_count < usage_limit)",
        [q.couponId],
      );
      if (upd.affectedRows !== 1) throw badRequest("This coupon has just been used up", { field: "couponCode" });
    }

    let orderId;
    let orderNumber;
    for (let attempt = 0; ; attempt++) {
      orderNumber = generateOrderNumber();
      try {
        const [ins] = await conn.execute(
          `INSERT INTO orders (order_number, user_id, customer_name, customer_phone, fulfillment_type, delivery_address, pincode,
             payment_method, subtotal, discount_amount, delivery_fee, total_amount, coupon_code, notes, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
          [
            orderNumber,
            user?.id ?? null,
            input.name,
            input.phone,
            input.fulfillment,
            input.address,
            input.pincode,
            input.paymentMethod,
            q.subtotal,
            q.discount,
            q.deliveryFee,
            q.total,
            q.couponCode,
            input.notes,
          ],
        );
        orderId = ins.insertId;
        break;
      } catch (err) {
        if (err.code !== "ER_DUP_ENTRY" || attempt >= 4) throw err; // 1-in-a-trillion collision: try another number
      }
    }

    await queryRaw(
      `INSERT INTO order_items (order_id, product_id, variant_id, product_name, size_label, unit_price, quantity, line_total) VALUES ?`,
      [q.lines.map((l) => [orderId, l.productId, l.variantId, l.name, l.sizeLabel, l.unitPrice, l.quantity, l.lineTotal])],
      conn,
    );

    for (const l of q.lines) {
      const [upd] = await conn.execute("UPDATE product_variants SET stock_qty = stock_qty - ? WHERE id = ? AND stock_qty >= ?", [
        l.quantity,
        l.variantId,
        l.quantity,
      ]);
      if (upd.affectedRows !== 1) throw conflict(`${l.name} (${l.sizeLabel}) just went out of stock. Please review your cart.`);
    }

    if (user) {
      await cartService.clear(user.id, conn);
      if (input.address && !user.default_address) {
        await conn.execute("UPDATE users SET default_address = ?, pincode = ? WHERE id = ?", [input.address, input.pincode, user.id]);
      }
    }
    return { orderNumber, total: q.total, subtotal: q.subtotal, discount: q.discount, deliveryFee: q.deliveryFee, lines: q.lines };
  });
  catalogService.invalidate(); // stock changed
  return { ...result, invoiceUrl: invoiceUrl(result.orderNumber) };
}

/* ------------------------------------------------------------------ */
/* Customer                                                            */
/* ------------------------------------------------------------------ */

async function listForUser(userId, limit = 100) {
  const orders = await queryRaw(
    `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ${Math.max(1, Math.min(200, Number(limit) || 100))}`,
    [userId],
  );
  const items = await itemsByOrder(orders.map((o) => o.id));
  return orders.map((o) => ({ ...shapeOrder(o, items.get(o.id) || []), canCancel: o.status === "Pending" }));
}

/** Customer cancels their own order while it is still Pending; stock and coupon use come back. */
async function cancelByCustomer(userId, orderNumber) {
  await transaction(async (conn) => {
    const [o] = await query("SELECT id, status, coupon_code FROM orders WHERE order_number = ? AND user_id = ? FOR UPDATE", [orderNumber, userId], conn);
    if (!o) throw notFound("Order not found");
    if (o.status !== "Pending") {
      throw badRequest(`This order is already ${o.status.toLowerCase()} and can no longer be cancelled online. Please message us on WhatsApp.`);
    }
    await restock(conn, o.id);
    await releaseCoupon(conn, o.coupon_code);
    await query("UPDATE orders SET status = 'Cancelled' WHERE id = ?", [o.id], conn);
  });
  catalogService.invalidate();
}

/** Put a past order's items back in the cart (current prices apply). */
async function reorder(userId, orderNumber) {
  const [order] = await query("SELECT id FROM orders WHERE order_number = ? AND user_id = ? LIMIT 1", [orderNumber, userId]);
  if (!order) throw notFound("Order not found");
  const items = await query(
    `SELECT oi.variant_id, oi.quantity, oi.product_name, oi.size_label, pv.stock_qty, p.is_active
     FROM order_items oi
     LEFT JOIN product_variants pv ON pv.id = oi.variant_id
     LEFT JOIN products p ON p.id = pv.product_id
     WHERE oi.order_id = ?`,
    [order.id],
  );
  const skipped = [];
  const toAdd = [];
  for (const it of items) {
    if (!it.variant_id || !it.is_active || it.stock_qty === null || Number(it.stock_qty) <= 0) skipped.push(`${it.product_name} (${it.size_label})`);
    else toAdd.push({ variantId: it.variant_id, quantity: it.quantity });
  }
  await cartService.addItems(userId, toAdd);
  return { items: await cartService.getItems(userId), skipped };
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

function adminFilters({ status, fulfillment, q }) {
  const where = ["1=1"];
  const params = [];
  if (ORDER_STATUSES.includes(status)) {
    where.push("o.status = ?");
    params.push(status);
  }
  if (["delivery", "pickup"].includes(fulfillment)) {
    where.push("o.fulfillment_type = ?");
    params.push(fulfillment);
  }
  if (q) {
    where.push("(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ?)");
    const like = `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
    params.push(like, like, like);
  }
  return { where: where.join(" AND "), params };
}

async function adminList(filters, page = 1, perPage = 25) {
  const { where, params } = adminFilters(filters);
  const offset = (page - 1) * perPage;
  const [[{ n }], orders] = await Promise.all([
    queryRaw(`SELECT COUNT(*) AS n FROM orders o WHERE ${where}`, params),
    queryRaw(`SELECT o.* FROM orders o WHERE ${where} ORDER BY o.id DESC LIMIT ${perPage} OFFSET ${offset}`, params),
  ]);
  // Item counts for this page only, in one grouped query
  const counts = new Map();
  if (orders.length) {
    const rows = await queryRaw("SELECT order_id, SUM(quantity) AS q FROM order_items WHERE order_id IN (?) GROUP BY order_id", [orders.map((o) => o.id)]);
    for (const r of rows) counts.set(r.order_id, Number(r.q));
  }
  return {
    total: Number(n),
    page,
    pages: Math.max(1, Math.ceil(Number(n) / perPage)),
    orders: orders.map((o) => ({
      orderNumber: o.order_number,
      customerName: o.customer_name,
      customerPhone: o.customer_phone,
      fulfillmentType: o.fulfillment_type,
      paymentMethod: o.payment_method,
      totalAmount: Number(o.total_amount),
      itemCount: counts.get(o.id) || 0,
      status: o.status,
      createdAt: o.created_at,
    })),
  };
}

/** Orders + their items for the CSV export (two queries, capped at 5000 orders). */
async function adminExport(filters) {
  const { where, params } = adminFilters(filters);
  const orders = await queryRaw(`SELECT o.* FROM orders o WHERE ${where} ORDER BY o.id DESC LIMIT 5000`, params);
  const items = await itemsByOrder(orders.map((o) => o.id));
  return orders.map((o) => ({
    ...o,
    items: (items.get(o.id) || []).map((i) => `${i.product_name} (${i.size_label}) x${i.quantity}`).join("; "),
  }));
}

async function findByNumber(orderNumber) {
  const [o] = await query("SELECT * FROM orders WHERE order_number = ? LIMIT 1", [orderNumber]);
  if (!o) return null;
  const items = await query("SELECT * FROM order_items WHERE order_id = ? ORDER BY id", [o.id]);
  return { order: o, items };
}

async function adminDetail(orderNumber) {
  const data = await findByNumber(orderNumber);
  if (!data) throw notFound("Order not found");
  return { ...shapeOrder(data.order, data.items), packingSlipUrl: `/admin/orders/${encodeURIComponent(orderNumber)}/slip` };
}

/** Change status; cancelling returns stock and the coupon use. Logged to the audit trail. */
async function updateStatus(ctx, orderNumber, status) {
  await transaction(async (conn) => {
    const [o] = await query("SELECT id, status, coupon_code FROM orders WHERE order_number = ? FOR UPDATE", [orderNumber], conn);
    if (!o) throw notFound("Order not found");
    if (o.status === status) return;
    if (o.status === "Cancelled") throw new HttpError(400, "Cancelled orders cannot be reopened. Ask the customer to place a new order.");
    if (status === "Cancelled") {
      await restock(conn, o.id);
      await releaseCoupon(conn, o.coupon_code);
    }
    await query("UPDATE orders SET status = ? WHERE id = ?", [status, o.id], conn);
    await auditService.record(conn, ctx, {
      action: "order.status",
      entityType: "order",
      entityId: o.id,
      summary: `${orderNumber}: ${o.status} → ${status}`,
      before: { status: o.status },
      after: { status },
    });
  });
  if (status === "Cancelled") catalogService.invalidate();
}

module.exports = {
  generateOrderNumber,
  placeOrder,
  listForUser,
  cancelByCustomer,
  reorder,
  adminList,
  adminExport,
  adminDetail,
  findByNumber,
  updateStatus,
};
