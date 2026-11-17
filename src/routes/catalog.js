"use strict";

const express = require("express");
const { query } = require("../db");
const { getSettings, publicSettings } = require("../lib/settings");

const router = express.Router();

/** Group variant rows under their products. */
function shapeProducts(rows, variants) {
  const byProduct = new Map();
  for (const v of variants) {
    if (!byProduct.has(v.product_id)) byProduct.set(v.product_id, []);
    byProduct.get(v.product_id).push({
      id: v.id,
      sizeLabel: v.size_label,
      sku: v.sku,
      price: Number(v.price),
      mrp: Number(v.mrp),
      stockQty: Number(v.stock_qty),
      stockStatus: v.stock_qty <= 0 ? "out" : v.stock_qty <= 5 ? "low" : "in",
    });
  }
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    tagline: p.tagline,
    description: p.description,
    imageUrl: p.image_url,
    accentColor: p.accent_color,
    badgeText: p.badge_text,
    rating: Number(p.rating),
    reviewCount: Number(p.review_count),
    isFeatured: Boolean(p.is_featured),
    category: p.category_slug ? { slug: p.category_slug, name: p.category_name } : null,
    variants: byProduct.get(p.id) || [],
  }));
}

async function activeCatalog() {
  const [products, variants, categories] = await Promise.all([
    query(
      `SELECT p.*, c.slug AS category_slug, c.name AS category_name
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.is_active = 1 ORDER BY p.is_featured DESC, p.sort_order, p.id`,
    ),
    query(
      `SELECT v.* FROM product_variants v JOIN products p ON p.id = v.product_id
       WHERE p.is_active = 1 ORDER BY v.product_id, v.sort_order, v.price`,
    ),
    query("SELECT id, name, slug, icon_svg, sort_order FROM categories ORDER BY sort_order, name"),
  ]);
  const shaped = shapeProducts(products, variants).filter((p) => p.variants.length);
  const used = new Set(shaped.map((p) => p.category?.slug));
  return {
    products: shaped,
    categories: categories
      .filter((c) => used.has(c.slug))
      .map((c) => ({ name: c.name, slug: c.slug, iconSvg: c.icon_svg, count: shaped.filter((p) => p.category?.slug === c.slug).length })),
  };
}

router.get("/catalog", async (_req, res) => {
  const [catalog, settings] = await Promise.all([activeCatalog(), getSettings()]);
  res.set("Cache-Control", "no-store");
  res.json({ ...catalog, settings: publicSettings(settings) });
});

router.get("/settings", async (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(publicSettings(await getSettings()));
});

module.exports = { router, shapeProducts, activeCatalog };
