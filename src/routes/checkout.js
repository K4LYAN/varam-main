"use strict";

const express = require("express");
const { transaction } = require("../db");
const { quote, normaliseItems, findCoupon, couponDiscount } = require("../lib/pricing");
const { getSettings } = require("../lib/settings");
const { invoiceToken } = require("../lib/invoice");
const { orderLimiter } = require("../middleware/security");
const v = require("../lib/validate");

const router = express.Router();

/** Live totals for the cart drawer (prices always come from the database). */
router.post("/checkout/quote", async (req, res) => {
  const fulfillment = req.body.fulfillment === "pickup" ? "pickup" : "delivery";
  const result = await quote({ items: req.body.items, couponCode: req.body.couponCode, fulfillment }, await getSettings());
  res.json(result);
});

router.post("/coupons/validate", async (req, res) => {
  const code = v.clean(req.body.code, 40).toUpperCase();
  if (!code) return res.status(400).json({ valid: false, error: "Enter a coupon code" });
  const coupon = await findCoupon(code);
  if (!coupon) return res.json({ valid: false, error: "This coupon code is not valid" });
  let subtotal = Number(req.body.subtotal) || 0;
  if (Array.isArray(req.body.items)) {
    subtotal = (await quote({ items: req.body.items, fulfillment: "pickup" }, await getSettings())).subtotal;
  }
  const { discount, error } = couponDiscount(coupon, subtotal);
  if (error) return res.json({ valid: false, error });
  res.json({
    valid: true,
    code: coupon.code,
    discountType: coupon.discount_type,
    discountValue: Number(coupon.discount_value),
    discount,
    message: coupon.discount_type === "percent" ? `${Number(coupon.discount_value)}% off applied` : `₹${Number(coupon.discount_value)} off applied`,
  });
});

/** Place a direct order: one transaction creates the order + items and decrements stock. */
router.post("/orders", orderLimiter, async (req, res) => {
  const items = normaliseItems(req.body.items);
  if (!items.length) return res.status(400).json({ error: "Your cart is empty" });

  const name = v.str(req.body.name, "Name", { required: true, min: 2, max: 120 });
  const phone = v.phone(req.body.phone);
  const fulfillment = v.oneOf(req.body.fulfillment, "Fulfilment", ["delivery", "pickup"]);
  const paymentMethod = v.oneOf(String(req.body.paymentMethod || "").toUpperCase(), "Payment method", ["UPI", "COD", "STORE"]);
  if (paymentMethod === "STORE" && fulfillment !== "pickup") throw new v.ValidationError("Pay at store is only available for store pickup", "paymentMethod");
  if (paymentMethod === "COD" && fulfillment !== "delivery") throw new v.ValidationError("Cash on delivery is only available for home delivery", "paymentMethod");
  const address = fulfillment === "delivery" ? v.str(req.body.address, "Delivery address", { required: true, min: 8, max: 500 }) : null;
  const pincode = fulfillment === "delivery" ? v.pincode(req.body.pincode) : null;
  const notes = v.str(req.body.notes, "Notes", { max: 500 }) || null;
  const couponCode = v.clean(req.body.couponCode, 40).toUpperCase() || null;
  const settings = await getSettings();

  const order = await transaction(async (conn) => {
    const q = await quote({ items, couponCode, fulfillment }, settings, conn); // locks variant rows FOR UPDATE
    if (q.hasProblems) {
      const err = new Error("Some items are out of stock or no longer available. Please review your cart.");
      err.status = 409;
      err.details = q.lines.filter((l) => !l.available || l.stock < l.quantity).map((l) => ({ variantId: l.variantId, name: l.name, reason: l.reason }));
      throw err;
    }
    if (couponCode && !q.couponCode) {
      const err = new Error(q.couponError || "This coupon code is not valid");
      err.status = 400;
      throw err;
    }

    const [ins] = await conn.execute(
      `INSERT INTO orders (user_id, customer_name, customer_phone, fulfillment_type, delivery_address, pincode, payment_method,
         subtotal, discount_amount, delivery_fee, total_amount, coupon_code, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [req.user?.id ?? null, name, phone, fulfillment, address, pincode, paymentMethod, q.subtotal, q.discount, q.deliveryFee, q.total, q.couponCode, notes],
    );
    const orderId = ins.insertId;
    const orderNumber = `VRM-${new Date().getFullYear()}-${1000 + orderId}`;
    await conn.execute("UPDATE orders SET order_number = ? WHERE id = ?", [orderNumber, orderId]);

    for (const l of q.lines) {
      await conn.execute(
        `INSERT INTO order_items (order_id, product_id, variant_id, product_name, size_label, unit_price, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, l.productId, l.variantId, l.name, l.sizeLabel, l.unitPrice, l.quantity, l.lineTotal],
      );
      const [upd] = await conn.execute("UPDATE product_variants SET stock_qty = stock_qty - ? WHERE id = ? AND stock_qty >= ?", [
        l.quantity,
        l.variantId,
        l.quantity,
      ]);
      if (upd.affectedRows !== 1) {
        const err = new Error(`${l.name} (${l.sizeLabel}) just went out of stock. Please review your cart.`);
        err.status = 409;
        throw err;
      }
    }

    if (req.user) {
      await conn.execute("DELETE FROM cart_items WHERE user_id = ?", [req.user.id]);
      if (address && !req.user.default_address) {
        await conn.execute("UPDATE users SET default_address = ?, pincode = ? WHERE id = ?", [address, pincode, req.user.id]);
      }
    }
    return { orderNumber, total: q.total, subtotal: q.subtotal, discount: q.discount, deliveryFee: q.deliveryFee, lines: q.lines };
  });

  res.status(201).json({
    ...order,
    invoiceUrl: `/invoice/${order.orderNumber}?t=${invoiceToken(order.orderNumber)}`,
    upiId: paymentMethod === "UPI" ? settings.upi_id || "" : "",
    paymentMethod,
    fulfillment,
  });
});

module.exports = { router };
