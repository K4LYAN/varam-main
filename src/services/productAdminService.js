"use strict";

/**
 * Admin catalogue management. Every price/stock/product change runs in a
 * transaction together with its audit-log entry, then clears the catalogue cache.
 */
const { query, transaction } = require("../db/pool");
const catalogService = require("./catalogService");
const auditService = require("./auditService");
const { notFound, badRequest, rethrowDuplicate } = require("../utils/httpError");

const PRODUCT_COLUMNS = `category_id, name, slug, tagline, description, image_url, accent_color, badge_text, rating, review_count, is_featured, is_active, sort_order`;

const productRow = (p) => [p.categoryId, p.name, p.slug, p.tagline, p.description, p.imageUrl, p.accentColor, p.badgeText, p.rating, p.reviewCount, p.isFeatured, p.isActive, p.sortOrder];

const variantSnapshot = (v) => ({
  sizeLabel: v.size_label,
  sku: v.sku,
  price: Number(v.price),
  mrp: Number(v.mrp),
  stockQty: Number(v.stock_qty),
  sortOrder: v.sort_order,
});

/* ---------------- Categories ---------------- */

async function listCategories() {
  return query("SELECT id, name, slug, sort_order FROM categories ORDER BY sort_order, name");
}

async function createCategory(ctx, { name, slug }) {
  try {
    return await transaction(async (conn) => {
      const [{ m }] = await query("SELECT COALESCE(MAX(sort_order), 0) AS m FROM categories", [], conn);
      const r = await query("INSERT INTO categories (name, slug, sort_order) VALUES (?, ?, ?)", [name, slug, Number(m) + 1], conn);
      await auditService.record(conn, ctx, { action: "category.create", entityType: "category", entityId: r.insertId, summary: name, after: { name, slug } });
      return { id: r.insertId, name, slug };
    });
  } catch (err) {
    return rethrowDuplicate(err, "category (name)");
  } finally {
    catalogService.invalidate();
  }
}

/* ---------------- Products ---------------- */

/** All products (active or not) with variants — two queries, no N+1. */
async function listProducts() {
  const [products, variants] = await Promise.all([
    query(
      `SELECT p.*, c.slug AS category_slug, c.name AS category_name
       FROM products p LEFT JOIN categories c ON c.id = p.category_id ORDER BY p.sort_order, p.id`,
    ),
    query("SELECT * FROM product_variants ORDER BY product_id, sort_order, price"),
  ]);
  return catalogService.shapeProducts(products, variants).map((p, i) => ({
    ...p,
    categoryId: products[i].category_id,
    isActive: Boolean(products[i].is_active),
    sortOrder: products[i].sort_order,
  }));
}

async function createProduct(ctx, p, variants) {
  try {
    const id = await transaction(async (conn) => {
      const r = await query(`INSERT INTO products (${PRODUCT_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, productRow(p), conn);
      for (const [i, v] of variants.entries()) {
        await query(
          "INSERT INTO product_variants (product_id, size_label, sku, price, mrp, stock_qty, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [r.insertId, v.sizeLabel, v.sku, v.price, v.mrp, v.stockQty, v.sortOrder || i],
          conn,
        );
      }
      await auditService.record(conn, ctx, { action: "product.create", entityType: "product", entityId: r.insertId, summary: p.name, after: { ...p, variants } });
      return r.insertId;
    });
    return id;
  } catch (err) {
    return rethrowDuplicate(err, "product or SKU");
  } finally {
    catalogService.invalidate();
  }
}

async function updateProduct(ctx, id, p) {
  try {
    await transaction(async (conn) => {
      const [before] = await query(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = ? FOR UPDATE`, [id], conn);
      if (!before) throw notFound("Product not found");
      await query(
        `UPDATE products SET category_id = ?, name = ?, slug = ?, tagline = ?, description = ?, image_url = ?, accent_color = ?, badge_text = ?,
           rating = ?, review_count = ?, is_featured = ?, is_active = ?, sort_order = ? WHERE id = ?`,
        [...productRow(p), id],
        conn,
      );
      const after = Object.fromEntries(PRODUCT_COLUMNS.split(", ").map((k, i) => [k, productRow(p)[i]]));
      const d = auditService.diff(before, after);
      await auditService.record(conn, ctx, { action: "product.update", entityType: "product", entityId: id, summary: p.name, ...d });
    });
  } catch (err) {
    rethrowDuplicate(err, "product (URL slug)");
  } finally {
    catalogService.invalidate();
  }
}

async function setFlags(ctx, id, flags) {
  const sets = [];
  const params = [];
  if (flags.isActive !== undefined) {
    sets.push("is_active = ?");
    params.push(flags.isActive ? 1 : 0);
  }
  if (flags.isFeatured !== undefined) {
    sets.push("is_featured = ?");
    params.push(flags.isFeatured ? 1 : 0);
  }
  if (!sets.length) throw badRequest("Nothing to update");
  await transaction(async (conn) => {
    const [before] = await query("SELECT name, is_active, is_featured FROM products WHERE id = ? FOR UPDATE", [id], conn);
    if (!before) throw notFound("Product not found");
    await query(`UPDATE products SET ${sets.join(", ")} WHERE id = ?`, [...params, id], conn);
    await auditService.record(conn, ctx, {
      action: "product.flags",
      entityType: "product",
      entityId: id,
      summary: before.name,
      before: { is_active: before.is_active, is_featured: before.is_featured },
      after: { is_active: flags.isActive ?? Boolean(before.is_active), is_featured: flags.isFeatured ?? Boolean(before.is_featured) },
    });
  });
  catalogService.invalidate();
}

async function deleteProduct(ctx, id) {
  await transaction(async (conn) => {
    const [before] = await query("SELECT name, slug FROM products WHERE id = ? FOR UPDATE", [id], conn);
    if (!before) throw notFound("Product not found");
    await query("DELETE FROM products WHERE id = ?", [id], conn); // order history keeps names & prices
    await auditService.record(conn, ctx, { action: "product.delete", entityType: "product", entityId: id, summary: before.name, before });
  });
  catalogService.invalidate();
}

/* ---------------- Variants (pack sizes, prices, stock) ---------------- */

async function addVariant(ctx, productId, v) {
  try {
    return await transaction(async (conn) => {
      const [product] = await query("SELECT name FROM products WHERE id = ? FOR UPDATE", [productId], conn);
      if (!product) throw notFound("Product not found");
      const r = await query(
        "INSERT INTO product_variants (product_id, size_label, sku, price, mrp, stock_qty, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [productId, v.sizeLabel, v.sku, v.price, v.mrp, v.stockQty, v.sortOrder],
        conn,
      );
      await auditService.record(conn, ctx, { action: "variant.create", entityType: "variant", entityId: r.insertId, summary: `${product.name} — ${v.sizeLabel}`, after: v });
      return r.insertId;
    });
  } catch (err) {
    return rethrowDuplicate(err, "pack size (SKU)");
  } finally {
    catalogService.invalidate();
  }
}

async function updateVariant(ctx, id, v) {
  try {
    await transaction(async (conn) => {
      const [before] = await query(
        "SELECT v.*, p.name AS product_name FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.id = ? FOR UPDATE",
        [id],
        conn,
      );
      if (!before) throw notFound("Pack size not found");
      await query(
        "UPDATE product_variants SET size_label = ?, sku = ?, price = ?, mrp = ?, stock_qty = ?, sort_order = ? WHERE id = ?",
        [v.sizeLabel, v.sku, v.price, v.mrp, v.stockQty, v.sortOrder, id],
        conn,
      );
      const d = auditService.diff(variantSnapshot(before), v);
      if (Object.keys(d.after).length) {
        await auditService.record(conn, ctx, { action: "variant.update", entityType: "variant", entityId: id, summary: `${before.product_name} — ${v.sizeLabel}`, ...d });
      }
    });
  } catch (err) {
    rethrowDuplicate(err, "pack size (SKU)");
  } finally {
    catalogService.invalidate();
  }
}

/** Quick restock from the dashboard. */
async function setStock(ctx, id, stockQty) {
  await transaction(async (conn) => {
    const [before] = await query(
      "SELECT v.stock_qty, v.size_label, p.name AS product_name FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.id = ? FOR UPDATE",
      [id],
      conn,
    );
    if (!before) throw notFound("Pack size not found");
    await query("UPDATE product_variants SET stock_qty = ? WHERE id = ?", [stockQty, id], conn);
    await auditService.record(conn, ctx, {
      action: "variant.stock",
      entityType: "variant",
      entityId: id,
      summary: `${before.product_name} — ${before.size_label}: ${before.stock_qty} → ${stockQty}`,
      before: { stockQty: before.stock_qty },
      after: { stockQty },
    });
  });
  catalogService.invalidate();
  return stockQty;
}

async function deleteVariant(ctx, id) {
  await transaction(async (conn) => {
    const [row] = await query(
      "SELECT v.*, p.name AS product_name FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.id = ? FOR UPDATE",
      [id],
      conn,
    );
    if (!row) throw notFound("Pack size not found");
    const [{ n }] = await query("SELECT COUNT(*) AS n FROM product_variants WHERE product_id = ?", [row.product_id], conn);
    if (Number(n) <= 1) throw badRequest("A product needs at least one pack size. Hide the product instead.");
    await query("DELETE FROM product_variants WHERE id = ?", [id], conn);
    await auditService.record(conn, ctx, { action: "variant.delete", entityType: "variant", entityId: id, summary: `${row.product_name} — ${row.size_label}`, before: variantSnapshot(row) });
  });
  catalogService.invalidate();
}

module.exports = {
  listCategories,
  createCategory,
  listProducts,
  createProduct,
  updateProduct,
  setFlags,
  deleteProduct,
  addVariant,
  updateVariant,
  setStock,
  deleteVariant,
};
