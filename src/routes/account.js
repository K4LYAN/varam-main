"use strict";

const express = require("express");
const { query, queryRaw, transaction } = require("../db");
const { requireUser } = require("../middleware/auth");
const { invoiceToken } = require("../lib/invoice");
const { cartItems } = require("./cart");
const { MAX_QTY } = require("../lib/pricing");
const { publicUser } = require("./auth");
const v = require("../lib/validate");

const router = express.Router();
router.use(requireUser);

async function ordersWithItems(where, params, limit = 100) {
  const orders = await queryRaw(`SELECT * FROM orders WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${Number(limit)}`, params);
  if (!orders.length) return [];
  const items = await queryRaw("SELECT * FROM order_items WHERE order_id IN (?) ORDER BY id", [orders.map((o) => o.id)]);
  return orders.map((o) => ({
    orderNumber: o.order_number,
    status: o.status,
    createdAt: o.created_at,
    fulfillmentType: o.fulfillment_type,
    paymentMethod: o.payment_method,
    deliveryAddress: o.delivery_address,
    pincode: o.pincode,
    subtotal: Number(o.subtotal),
    discountAmount: Number(o.discount_amount),
    deliveryFee: Number(o.delivery_fee),
    totalAmount: Number(o.total_amount),
    couponCode: o.coupon_code,
    canCancel: o.status === "Pending",
    invoiceUrl: `/invoice/${o.order_number}?t=${invoiceToken(o.order_number)}`,
    items: items
      .filter((i) => i.order_id === o.id)
      .map((i) => ({
        productName: i.product_name,
        sizeLabel: i.size_label,
        unitPrice: Number(i.unit_price),
        quantity: i.quantity,
        lineTotal: Number(i.line_total),
      })),
  }));
}

router.get("/orders", async (req, res) => {
  res.json({ orders: await ordersWithItems("user_id = ?", [req.user.id]) });
});

router.put("/profile", async (req, res) => {
  const name = v.str(req.body.name, "Name", { required: true, min: 2, max: 120 });
  const phone = v.phone(req.body.phone);
  const address = v.str(req.body.defaultAddress, "Address", { max: 500 }) || null;
  const pincode = v.pincode(req.body.pincode, "Pincode", false) || null;
  const clash = await query("SELECT id FROM users WHERE phone = ? AND id <> ? LIMIT 1", [phone, req.user.id]);
  if (clash.length) return res.status(409).json({ error: "This phone number is already used by another account" });
  await query("UPDATE users SET name = ?, phone = ?, default_address = ?, pincode = ? WHERE id = ?", [name, phone, address, pincode, req.user.id]);
  const [user] = await query("SELECT * FROM users WHERE id = ?", [req.user.id]);
  res.json({ user: publicUser(user) });
});

/** Add the items of a past order back into the cart (current prices apply). */
router.post("/orders/:orderNumber/reorder", async (req, res) => {
  const orderNumber = v.clean(req.params.orderNumber, 30);
  const [order] = await query("SELECT id FROM orders WHERE order_number = ? AND user_id = ? LIMIT 1", [orderNumber, req.user.id]);
  if (!order) return res.status(404).json({ error: "Order not found" });
  const items = await query(
    `SELECT oi.variant_id, oi.product_id, oi.quantity, oi.product_name, oi.size_label, pv.stock_qty, p.is_active
     FROM order_items oi
     LEFT JOIN product_variants pv ON pv.id = oi.variant_id
     LEFT JOIN products p ON p.id = pv.product_id
     WHERE oi.order_id = ?`,
    [order.id],
  );
  const skipped = [];
  await transaction(async (conn) => {
    for (const it of items) {
      if (!it.variant_id || !it.is_active || it.stock_qty === null || Number(it.stock_qty) <= 0) {
        skipped.push(`${it.product_name} (${it.size_label})`);
        continue;
      }
      await conn.execute(
        `INSERT INTO cart_items (user_id, product_id, variant_id, quantity) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = LEAST(?, quantity + VALUES(quantity))`,
        [req.user.id, it.product_id, it.variant_id, Math.min(it.quantity, MAX_QTY), MAX_QTY],
      );
    }
  });
  res.json({ items: await cartItems(req.user.id), skipped });
});

/** Customer cancels their own order while it is still Pending; items go back to stock. */
router.post("/orders/:orderNumber/cancel", async (req, res) => {
  const orderNumber = v.clean(req.params.orderNumber, 30);
  await transaction(async (conn) => {
    const [[o]] = await conn.execute("SELECT id, status FROM orders WHERE order_number = ? AND user_id = ? FOR UPDATE", [orderNumber, req.user.id]);
    if (!o) {
      const e = new Error("Order not found");
      e.status = 404;
      throw e;
    }
    if (o.status !== "Pending") {
      const e = new Error(`This order is already ${o.status.toLowerCase()} and can no longer be cancelled online. Please message us on WhatsApp.`);
      e.status = 400;
      throw e;
    }
    const [items] = await conn.execute("SELECT variant_id, quantity FROM order_items WHERE order_id = ? AND variant_id IS NOT NULL", [o.id]);
    for (const it of items) await conn.execute("UPDATE product_variants SET stock_qty = stock_qty + ? WHERE id = ?", [it.quantity, it.variant_id]);
    await conn.execute("UPDATE orders SET status = 'Cancelled' WHERE id = ?", [o.id]);
  });
  res.json({ ok: true, status: "Cancelled" });
});

/* ---------------- Address book ---------------- */

const shapeAddress = (a) => ({
  id: a.id,
  label: a.label,
  name: a.recipient_name,
  phone: a.phone,
  address: a.address_line,
  pincode: a.pincode,
  isDefault: Boolean(a.is_default),
});

async function listAddresses(userId) {
  return (await query("SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC", [userId])).map(shapeAddress);
}

function addressFields(body) {
  return {
    label: v.str(body.label || "Home", "Label", { max: 40 }) || "Home",
    name: v.str(body.name, "Recipient name", { required: true, min: 2, max: 120 }),
    phone: v.phone(body.phone),
    address: v.str(body.address, "Address", { required: true, min: 8, max: 500 }),
    pincode: v.pincode(body.pincode),
    isDefault: v.bool(body.isDefault),
  };
}

/** Keep users.default_address in sync with the default address-book entry (used to prefill checkout). */
async function syncDefault(conn, userId) {
  const [[d]] = await conn.execute("SELECT address_line, pincode FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC LIMIT 1", [userId]);
  await conn.execute("UPDATE users SET default_address = ?, pincode = ? WHERE id = ?", [d ? d.address_line : null, d ? d.pincode : null, userId]);
}

router.get("/addresses", async (req, res) => {
  res.json({ addresses: await listAddresses(req.user.id) });
});

router.post("/addresses", async (req, res) => {
  const a = addressFields(req.body);
  const [{ n }] = await query("SELECT COUNT(*) AS n FROM addresses WHERE user_id = ?", [req.user.id]);
  if (Number(n) >= 10) return res.status(400).json({ error: "You can save up to 10 addresses" });
  await transaction(async (conn) => {
    const makeDefault = a.isDefault || Number(n) === 0;
    if (makeDefault) await conn.execute("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [req.user.id]);
    await conn.execute(
      "INSERT INTO addresses (user_id, label, recipient_name, phone, address_line, pincode, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [req.user.id, a.label, a.name, a.phone, a.address, a.pincode, makeDefault ? 1 : 0],
    );
    await syncDefault(conn, req.user.id);
  });
  res.status(201).json({ addresses: await listAddresses(req.user.id) });
});

router.put("/addresses/:id", async (req, res) => {
  const id = v.int(req.params.id, "id", { min: 1, max: 1e9 });
  const a = addressFields(req.body);
  await transaction(async (conn) => {
    const [[row]] = await conn.execute("SELECT id FROM addresses WHERE id = ? AND user_id = ?", [id, req.user.id]);
    if (!row) {
      const e = new Error("Address not found");
      e.status = 404;
      throw e;
    }
    if (a.isDefault) await conn.execute("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [req.user.id]);
    await conn.execute(
      `UPDATE addresses SET label=?, recipient_name=?, phone=?, address_line=?, pincode=?${a.isDefault ? ", is_default=1" : ""} WHERE id=? AND user_id=?`,
      [a.label, a.name, a.phone, a.address, a.pincode, id, req.user.id],
    );
    await syncDefault(conn, req.user.id);
  });
  res.json({ addresses: await listAddresses(req.user.id) });
});

router.delete("/addresses/:id", async (req, res) => {
  const id = v.int(req.params.id, "id", { min: 1, max: 1e9 });
  await transaction(async (conn) => {
    const [[row]] = await conn.execute("SELECT is_default FROM addresses WHERE id = ? AND user_id = ?", [id, req.user.id]);
    if (!row) return;
    await conn.execute("DELETE FROM addresses WHERE id = ? AND user_id = ?", [id, req.user.id]);
    if (row.is_default) {
      await conn.execute("UPDATE addresses SET is_default = 1 WHERE user_id = ? ORDER BY id DESC LIMIT 1", [req.user.id]);
    }
    await syncDefault(conn, req.user.id);
  });
  res.json({ addresses: await listAddresses(req.user.id) });
});

/* ---------------- Wishlist ---------------- */

async function wishlistIds(userId) {
  return (await query("SELECT product_id FROM wishlist_items WHERE user_id = ? ORDER BY id DESC", [userId])).map((r) => r.product_id);
}

router.get("/wishlist", async (req, res) => {
  res.json({ productIds: await wishlistIds(req.user.id) });
});

router.post("/wishlist/:productId", async (req, res) => {
  const productId = v.int(req.params.productId, "productId", { min: 1, max: 1e9 });
  const exists = await query("SELECT id FROM products WHERE id = ? AND is_active = 1", [productId]);
  if (!exists.length) return res.status(404).json({ error: "Product not found" });
  await query("INSERT IGNORE INTO wishlist_items (user_id, product_id) VALUES (?, ?)", [req.user.id, productId]);
  res.json({ productIds: await wishlistIds(req.user.id) });
});

router.delete("/wishlist/:productId", async (req, res) => {
  const productId = v.int(req.params.productId, "productId", { min: 1, max: 1e9 });
  await query("DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?", [req.user.id, productId]);
  res.json({ productIds: await wishlistIds(req.user.id) });
});

module.exports = { router, ordersWithItems };
