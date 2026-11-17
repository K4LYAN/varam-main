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

module.exports = { router, ordersWithItems };
