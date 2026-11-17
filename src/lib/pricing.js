"use strict";

const { queryRaw, query } = require("../db");

const round2 = (n) => Math.round(n * 100) / 100;
const MAX_QTY = 50;

/**
 * Load live variant data for the given variant ids (active products only).
 * Returns a Map variantId -> row.
 */
async function loadVariants(ids, conn) {
  const unique = [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!unique.length) return new Map();
  const sql = `SELECT v.id AS variant_id, v.product_id, v.size_label, v.sku, v.price, v.mrp, v.stock_qty,
                      p.name AS product_name, p.slug, p.image_url, p.accent_color, p.is_active
               FROM product_variants v JOIN products p ON p.id = v.product_id
               WHERE v.id IN (?) ${conn ? "FOR UPDATE" : ""}`;
  const rows = conn ? (await conn.query(sql, [unique]))[0] : await queryRaw(sql, [unique]);
  return new Map(rows.map((r) => [r.variant_id, r]));
}

/** Normalise raw {variantId, quantity} input; merges duplicates. */
function normaliseItems(items) {
  if (!Array.isArray(items)) return [];
  const merged = new Map();
  for (const it of items.slice(0, 100)) {
    const id = Number(it?.variantId ?? it?.variant_id);
    const q = Math.floor(Number(it?.quantity));
    if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(q) || q <= 0) continue;
    merged.set(id, Math.min(MAX_QTY, (merged.get(id) || 0) + q));
  }
  return [...merged].map(([variantId, quantity]) => ({ variantId, quantity }));
}

/** Price lines from the database. Unknown/inactive variants are flagged, never priced. */
async function priceLines(items, conn) {
  const norm = normaliseItems(items);
  const variants = await loadVariants(
    norm.map((i) => i.variantId),
    conn,
  );
  return norm.map(({ variantId, quantity }) => {
    const v = variants.get(variantId);
    if (!v || !v.is_active) return { variantId, quantity, available: false, reason: "No longer available" };
    const stock = Number(v.stock_qty);
    return {
      variantId,
      productId: v.product_id,
      name: v.product_name,
      slug: v.slug,
      sizeLabel: v.size_label,
      sku: v.sku,
      imageUrl: v.image_url,
      accentColor: v.accent_color,
      unitPrice: Number(v.price),
      mrp: Number(v.mrp),
      quantity,
      stock,
      available: stock > 0,
      reason: stock <= 0 ? "Out of stock" : stock < quantity ? `Only ${stock} left` : "",
      lineTotal: round2(Number(v.price) * quantity),
    };
  });
}

async function findCoupon(code, conn) {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return null;
  const sql = "SELECT * FROM coupons WHERE code = ? AND is_active = 1 LIMIT 1";
  const rows = conn ? (await conn.query(sql, [c]))[0] : await query(sql, [c]);
  return rows[0] || null;
}

function couponDiscount(coupon, subtotal) {
  if (!coupon) return { discount: 0, error: "" };
  if (subtotal < Number(coupon.min_order_amount)) {
    return { discount: 0, error: `Add items worth ₹${Number(coupon.min_order_amount).toFixed(0)} or more to use ${coupon.code}` };
  }
  const value = Number(coupon.discount_value);
  const d = coupon.discount_type === "percent" ? (subtotal * value) / 100 : value;
  return { discount: round2(Math.min(d, subtotal)), error: "" };
}

/**
 * Full quote: lines, subtotal, coupon discount, delivery fee and total.
 * Used by the cart drawer, WhatsApp orders and (inside a transaction) checkout.
 */
async function quote({ items, couponCode, fulfillment }, settings, conn) {
  const lines = await priceLines(items, conn);
  const valid = lines.filter((l) => l.available && l.stock >= l.quantity);
  const subtotal = round2(valid.reduce((s, l) => s + l.lineTotal, 0));
  const itemCount = valid.reduce((n, l) => n + l.quantity, 0);

  let coupon = null;
  let couponError = "";
  if (couponCode) {
    coupon = await findCoupon(couponCode, conn);
    if (!coupon) couponError = "This coupon code is not valid";
  }
  const { discount, error } = couponDiscount(coupon, subtotal);
  if (error) couponError = error;
  const appliedCoupon = coupon && !error ? coupon.code : null;

  const threshold = Number(settings.free_delivery_threshold) || 0;
  const fee = Number(settings.delivery_fee) || 0;
  const afterDiscount = round2(subtotal - discount);
  const deliveryFee = fulfillment === "pickup" || subtotal === 0 ? 0 : subtotal >= threshold ? 0 : fee;
  const total = round2(afterDiscount + deliveryFee);

  return {
    lines,
    itemCount,
    subtotal,
    discount,
    couponCode: appliedCoupon,
    couponError,
    deliveryFee,
    freeDeliveryThreshold: threshold,
    amountToFreeDelivery: fulfillment === "pickup" ? 0 : Math.max(0, round2(threshold - subtotal)),
    total,
    hasProblems: lines.some((l) => !l.available || l.stock < l.quantity),
  };
}

module.exports = { quote, priceLines, normaliseItems, findCoupon, couponDiscount, MAX_QTY, round2 };
