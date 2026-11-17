"use strict";

/**
 * Authoritative pricing. Every amount the customer pays is computed here from
 * MySQL; prices, totals or discounts sent by the browser are never read.
 */
const { queryRaw, query } = require("../db/pool");
const { MAX_QTY, MAX_CART_LINES } = require("../config/defaults");

const round2 = (n) => Math.round(n * 100) / 100;

/** Normalise raw [{variantId, quantity}] input: ids and quantities only, duplicates merged, capped. */
function normaliseItems(items) {
  if (!Array.isArray(items)) return [];
  const merged = new Map();
  for (const it of items.slice(0, MAX_CART_LINES)) {
    const id = Number(it?.variantId ?? it?.variant_id);
    const q = Math.floor(Number(it?.quantity));
    if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(q) || q <= 0) continue;
    merged.set(id, Math.min(MAX_QTY, (merged.get(id) || 0) + q));
  }
  return [...merged].map(([variantId, quantity]) => ({ variantId, quantity }));
}

/**
 * Live variant rows for the given ids, in one query. Inside a transaction
 * (`conn`) the rows are locked FOR UPDATE; InnoDB takes the locks in primary
 * key order, so concurrent checkouts cannot deadlock on each other's carts.
 */
async function loadVariants(ids, conn) {
  const unique = [...new Set(ids)].sort((a, b) => a - b);
  if (!unique.length) return new Map();
  const rows = await queryRaw(
    `SELECT v.id AS variant_id, v.product_id, v.size_label, v.sku, v.price, v.mrp, v.stock_qty,
            p.name AS product_name, p.slug, p.image_url, p.accent_color, p.is_active
     FROM product_variants v JOIN products p ON p.id = v.product_id
     WHERE v.id IN (?) ORDER BY v.id ${conn ? "FOR UPDATE" : ""}`,
    [unique],
    conn,
  );
  return new Map(rows.map((r) => [r.variant_id, r]));
}

/** Price each line from the database. Unknown/inactive variants are flagged, never priced. */
async function priceLines(items, conn) {
  const norm = normaliseItems(items);
  const variants = await loadVariants(
    norm.map((i) => i.variantId),
    conn,
  );
  return norm.map(({ variantId, quantity }) => {
    const v = variants.get(variantId);
    if (!v || !v.is_active) return { variantId, quantity, available: false, stock: 0, reason: "No longer available" };
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

/**
 * An active, unexpired coupon with uses left. Inside a transaction the row is
 * locked so the usage count cannot be overspent by parallel orders.
 */
async function findCoupon(code, conn) {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return null;
  const rows = await query(
    `SELECT id, code, discount_type, discount_value, min_order_amount, usage_limit, used_count, expires_at
     FROM coupons
     WHERE code = ? AND is_active = 1
       AND (expires_at IS NULL OR expires_at > NOW())
       AND (usage_limit IS NULL OR used_count < usage_limit)
     LIMIT 1 ${conn ? "FOR UPDATE" : ""}`,
    [c],
    conn,
  );
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
 * Used by the cart drawer, coupon preview and (inside a transaction) checkout.
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
    if (!coupon) couponError = "This coupon code is not valid or has expired";
  }
  const { discount, error } = couponDiscount(coupon, subtotal);
  if (error) couponError = error;
  const appliedCoupon = coupon && !error ? coupon : null;

  const threshold = Number(settings.free_delivery_threshold) || 0;
  const fee = Number(settings.delivery_fee) || 0;
  const afterDiscount = round2(subtotal - (appliedCoupon ? discount : 0));
  const deliveryFee = fulfillment === "pickup" || subtotal === 0 ? 0 : subtotal >= threshold ? 0 : fee;

  return {
    lines,
    itemCount,
    subtotal,
    discount: appliedCoupon ? discount : 0,
    couponCode: appliedCoupon ? appliedCoupon.code : null,
    couponId: appliedCoupon ? appliedCoupon.id : null,
    couponError,
    deliveryFee,
    freeDeliveryThreshold: threshold,
    amountToFreeDelivery: fulfillment === "pickup" ? 0 : Math.max(0, round2(threshold - subtotal)),
    total: round2(afterDiscount + deliveryFee),
    hasProblems: lines.some((l) => !l.available || l.stock < l.quantity),
  };
}

/** Quote without internal ids, for the browser. */
function publicQuote(q) {
  const { couponId, ...rest } = q; // eslint-disable-line no-unused-vars
  return rest;
}

module.exports = { quote, publicQuote, priceLines, normaliseItems, findCoupon, couponDiscount, round2 };
