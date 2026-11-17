"use strict";

const express = require("express");
const { query, transaction } = require("../db");
const { requireUser } = require("../middleware/auth");
const { normaliseItems, MAX_QTY } = require("../lib/pricing");
const v = require("../lib/validate");

const router = express.Router();
router.use(requireUser);

async function cartItems(userId) {
  const rows = await query(
    `SELECT c.variant_id, c.quantity FROM cart_items c
     JOIN product_variants pv ON pv.id = c.variant_id
     JOIN products p ON p.id = c.product_id AND p.is_active = 1
     WHERE c.user_id = ? ORDER BY c.id`,
    [userId],
  );
  return rows.map((r) => ({ variantId: r.variant_id, quantity: r.quantity }));
}

async function variantProduct(variantId, conn) {
  const sql = "SELECT v.product_id FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.id = ? AND p.is_active = 1";
  const rows = conn ? (await conn.execute(sql, [variantId]))[0] : await query(sql, [variantId]);
  return rows[0]?.product_id ?? null;
}

router.get("/", async (req, res) => {
  res.json({ items: await cartItems(req.user.id) });
});

/** Set the quantity of one variant (0 removes it). */
router.put("/items", async (req, res) => {
  const variantId = v.int(req.body.variantId, "variantId", { min: 1, max: 1e9 });
  const quantity = v.int(req.body.quantity, "quantity", { min: 0, max: MAX_QTY });
  if (quantity === 0) {
    await query("DELETE FROM cart_items WHERE user_id = ? AND variant_id = ?", [req.user.id, variantId]);
  } else {
    const productId = await variantProduct(variantId);
    if (!productId) return res.status(404).json({ error: "This product is no longer available" });
    await query(
      `INSERT INTO cart_items (user_id, product_id, variant_id, quantity) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
      [req.user.id, productId, variantId, quantity],
    );
  }
  res.json({ items: await cartItems(req.user.id) });
});

router.delete("/items/:variantId", async (req, res) => {
  const variantId = v.int(req.params.variantId, "variantId", { min: 1, max: 1e9 });
  await query("DELETE FROM cart_items WHERE user_id = ? AND variant_id = ?", [req.user.id, variantId]);
  res.json({ items: await cartItems(req.user.id) });
});

router.delete("/", async (req, res) => {
  await query("DELETE FROM cart_items WHERE user_id = ?", [req.user.id]);
  res.json({ items: [] });
});

/** Merge a guest (localStorage) cart into the account cart, adding quantities. */
router.post("/merge", async (req, res) => {
  const items = normaliseItems(req.body.items);
  await transaction(async (conn) => {
    for (const it of items) {
      const productId = await variantProduct(it.variantId, conn);
      if (!productId) continue;
      await conn.execute(
        `INSERT INTO cart_items (user_id, product_id, variant_id, quantity) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = LEAST(?, quantity + VALUES(quantity))`,
        [req.user.id, productId, it.variantId, it.quantity, MAX_QTY],
      );
    }
  });
  res.json({ items: await cartItems(req.user.id) });
});

module.exports = { router, cartItems };
