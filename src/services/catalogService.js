"use strict";

const config = require("../config");
const { query } = require("../db/pool");
const { LOW_STOCK_AT } = require("../config/defaults");

/* ------------------------------------------------------------------ */
/* Shaping                                                             */
/* ------------------------------------------------------------------ */

function shapeVariant(v) {
  const stock = Number(v.stock_qty);
  return {
    id: v.id,
    sizeLabel: v.size_label,
    sku: v.sku,
    price: Number(v.price),
    mrp: Number(v.mrp),
    stockQty: stock,
    stockStatus: stock <= 0 ? "out" : stock <= LOW_STOCK_AT ? "low" : "in",
  };
}

/** Group variant rows under their products (two queries total, never one per product). */
function shapeProducts(products, variants) {
  const byProduct = new Map();
  for (const v of variants) {
    if (!byProduct.has(v.product_id)) byProduct.set(v.product_id, []);
    byProduct.get(v.product_id).push(shapeVariant(v));
  }
  return products.map((p) => ({
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

/* ------------------------------------------------------------------ */
/* Storefront catalogue (cached per process for a few seconds)         */
/* ------------------------------------------------------------------ */

let cache = null;
let cachedAt = 0;
let inflight = null;

async function loadActiveCatalog() {
  const [products, variants, categories] = await Promise.all([
    query(
      `SELECT p.id, p.name, p.slug, p.tagline, p.description, p.image_url, p.accent_color, p.badge_text, p.rating,
              p.review_count, p.is_featured, c.slug AS category_slug, c.name AS category_name
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.is_active = 1 ORDER BY p.is_featured DESC, p.sort_order, p.id`,
    ),
    query(
      `SELECT v.id, v.product_id, v.size_label, v.sku, v.price, v.mrp, v.stock_qty
       FROM product_variants v JOIN products p ON p.id = v.product_id AND p.is_active = 1
       ORDER BY v.product_id, v.sort_order, v.price`,
    ),
    query("SELECT id, name, slug, icon_svg, sort_order FROM categories ORDER BY sort_order, name"),
  ]);
  const shaped = shapeProducts(products, variants).filter((p) => p.variants.length);
  const counts = new Map();
  for (const p of shaped) if (p.category) counts.set(p.category.slug, (counts.get(p.category.slug) || 0) + 1);
  return {
    products: shaped,
    categories: categories
      .filter((c) => counts.has(c.slug))
      .map((c) => ({ name: c.name, slug: c.slug, iconSvg: c.icon_svg, count: counts.get(c.slug) })),
  };
}

/**
 * Active products + categories. Concurrent callers share one in-flight load,
 * so a burst of home-page visits costs three queries, not three per visitor.
 * Prices and stock shown here are display-only; checkout always re-reads MySQL.
 */
async function activeCatalog() {
  if (cache && Date.now() - cachedAt < config.catalogCacheMs) return cache;
  if (!inflight) {
    inflight = loadActiveCatalog()
      .then((c) => {
        cache = c;
        cachedAt = Date.now();
        return c;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Call after anything that changes products, prices or stock. */
function invalidate() {
  cache = null;
}

async function productWithRelated(slug) {
  const { products } = await activeCatalog();
  const product = products.find((p) => p.slug === slug);
  if (!product) return null;
  const others = products.filter((p) => p.id !== product.id);
  const same = others.filter((p) => p.category?.slug === product.category?.slug);
  const rest = others.filter((p) => p.category?.slug !== product.category?.slug);
  return { product, related: [...same, ...rest].slice(0, 4) };
}

async function isActiveSlug(slug) {
  const { products } = await activeCatalog();
  return products.some((p) => p.slug === slug);
}

async function activeSlugs() {
  const { products } = await activeCatalog();
  return products.map((p) => p.slug);
}

async function isActiveProduct(productId) {
  const rows = await query("SELECT 1 FROM products WHERE id = ? AND is_active = 1 LIMIT 1", [productId]);
  return rows.length > 0;
}

module.exports = { shapeProducts, shapeVariant, activeCatalog, invalidate, productWithRelated, isActiveSlug, activeSlugs, isActiveProduct };
