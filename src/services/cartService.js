"use strict";

const { query, queryRaw } = require("../db/pool");
const { normaliseItems } = require("./pricingService");
const { MAX_QTY } = require("../config/defaults");
const { notFound } = require("../utils/httpError");

/** The signed-in customer's cart (active products only). */
async function getItems(userId, conn) {
  const rows = await query(
    `SELECT c.variant_id, c.quantity FROM cart_items c
     JOIN products p ON p.id = c.product_id AND p.is_active = 1
     WHERE c.user_id = ? ORDER BY c.id`,
    [userId],
    conn,
  );
  return rows.map((r) => ({ variantId: r.variant_id, quantity: r.quantity }));
}

/**
 * Set one line to an absolute quantity (0 removes it). A single statement:
 * the INSERT … SELECT only inserts when the variant belongs to an active product.
 */
async function setQuantity(userId, variantId, quantity) {
  if (quantity === 0) {
    await query("DELETE FROM cart_items WHERE user_id = ? AND variant_id = ?", [userId, variantId]);
    return getItems(userId);
  }
  const res = await query(
    `INSERT INTO cart_items (user_id, product_id, variant_id, quantity)
     SELECT ?, v.product_id, v.id, ? FROM product_variants v
     JOIN products p ON p.id = v.product_id AND p.is_active = 1
     WHERE v.id = ?
     ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
    [userId, Math.min(quantity, MAX_QTY), variantId],
  );
  if (!res.affectedRows) throw notFound("This product is no longer available");
  return getItems(userId);
}

async function removeItem(userId, variantId) {
  await query("DELETE FROM cart_items WHERE user_id = ? AND variant_id = ?", [userId, variantId]);
  return getItems(userId);
}

async function clear(userId, conn) {
  await query("DELETE FROM cart_items WHERE user_id = ?", [userId], conn);
}

/**
 * Add quantities to the cart in one atomic statement (guest-cart merge, reorder).
 * Unknown or inactive variants are skipped by the JOIN; each line is capped at MAX_QTY.
 */
async function addItems(userId, rawItems, conn) {
  const items = normaliseItems(rawItems);
  if (!items.length) return 0;
  const ids = items.map((i) => i.variantId);
  const valid = await queryRaw(
    `SELECT v.id, v.product_id FROM product_variants v JOIN products p ON p.id = v.product_id AND p.is_active = 1 WHERE v.id IN (?)`,
    [ids],
    conn,
  );
  const productOf = new Map(valid.map((r) => [r.id, r.product_id]));
  const rows = items.filter((i) => productOf.has(i.variantId)).map((i) => [userId, productOf.get(i.variantId), i.variantId, i.quantity]);
  if (!rows.length) return 0;
  await queryRaw(
    `INSERT INTO cart_items (user_id, product_id, variant_id, quantity) VALUES ?
     ON DUPLICATE KEY UPDATE quantity = LEAST(quantity + VALUES(quantity), ${MAX_QTY})`,
    [rows],
    conn,
  );
  return rows.length;
}

async function merge(userId, rawItems) {
  await addItems(userId, rawItems);
  return getItems(userId);
}

module.exports = { getItems, setQuantity, removeItem, clear, addItems, merge };
