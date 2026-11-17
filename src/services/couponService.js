"use strict";

const { query, transaction } = require("../db/pool");
const auditService = require("./auditService");
const { quote, findCoupon, couponDiscount } = require("./pricingService");
const { notFound, rethrowDuplicate } = require("../utils/httpError");

/**
 * Coupon preview for the cart drawer. The subtotal is always recomputed from
 * the cart items on the server — a subtotal sent by the browser is ignored.
 */
async function preview(code, items, settings) {
  const coupon = await findCoupon(code);
  if (!coupon) return { valid: false, error: "This coupon code is not valid or has expired" };
  const { subtotal } = await quote({ items, fulfillment: "pickup" }, settings);
  const { discount, error } = couponDiscount(coupon, subtotal);
  if (error) return { valid: false, error };
  const value = Number(coupon.discount_value);
  return {
    valid: true,
    code: coupon.code,
    discountType: coupon.discount_type,
    discountValue: value,
    discount,
    message: coupon.discount_type === "percent" ? `${value}% off applied` : `₹${value} off applied`,
  };
}

/** DATETIME (read as an IST Date) → "YYYY-MM-DD HH:MM:SS" in IST, matching what the validator produces. */
const istDateTime = (d) => (d ? new Date(new Date(d).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 19).replace("T", " ") : null);

const shape = (c) => ({
  id: c.id,
  code: c.code,
  discountType: c.discount_type,
  discountValue: Number(c.discount_value),
  minOrderAmount: Number(c.min_order_amount),
  usageLimit: c.usage_limit === null ? null : Number(c.usage_limit),
  usedCount: Number(c.used_count),
  expiresAt: c.expires_at ? istDateTime(c.expires_at).slice(0, 10) : null,
  isActive: Boolean(c.is_active),
});

const snapshot = (c) => ({
  code: c.code,
  discountType: c.discount_type,
  discountValue: Number(c.discount_value),
  minOrderAmount: Number(c.min_order_amount),
  usageLimit: c.usage_limit,
  expiresAt: istDateTime(c.expires_at),
  isActive: Boolean(c.is_active),
});

async function list() {
  return (await query("SELECT * FROM coupons ORDER BY is_active DESC, code")).map(shape);
}

async function create(ctx, c) {
  try {
    return await transaction(async (conn) => {
      const r = await query(
        "INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, usage_limit, expires_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [c.code, c.discountType, c.discountValue, c.minOrderAmount, c.usageLimit, c.expiresAt, c.isActive ? 1 : 0],
        conn,
      );
      await auditService.record(conn, ctx, { action: "coupon.create", entityType: "coupon", entityId: r.insertId, summary: c.code, after: c });
      return r.insertId;
    });
  } catch (err) {
    return rethrowDuplicate(err, "coupon (code)");
  }
}

async function update(ctx, id, c) {
  try {
    await transaction(async (conn) => {
      const [before] = await query("SELECT * FROM coupons WHERE id = ? FOR UPDATE", [id], conn);
      if (!before) throw notFound("Coupon not found");
      await query(
        "UPDATE coupons SET code = ?, discount_type = ?, discount_value = ?, min_order_amount = ?, usage_limit = ?, expires_at = ?, is_active = ? WHERE id = ?",
        [c.code, c.discountType, c.discountValue, c.minOrderAmount, c.usageLimit, c.expiresAt, c.isActive ? 1 : 0, id],
        conn,
      );
      const d = auditService.diff(snapshot(before), c);
      if (Object.keys(d.after).length) await auditService.record(conn, ctx, { action: "coupon.update", entityType: "coupon", entityId: id, summary: c.code, ...d });
    });
  } catch (err) {
    rethrowDuplicate(err, "coupon (code)");
  }
}

async function remove(ctx, id) {
  await transaction(async (conn) => {
    const [before] = await query("SELECT * FROM coupons WHERE id = ? FOR UPDATE", [id], conn);
    if (!before) return;
    await query("DELETE FROM coupons WHERE id = ?", [id], conn);
    await auditService.record(conn, ctx, { action: "coupon.delete", entityType: "coupon", entityId: id, summary: before.code, before: snapshot(before) });
  });
}

module.exports = { preview, list, create, update, remove };
