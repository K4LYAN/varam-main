"use strict";

const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const config = require("../config");
const { query, queryRaw, transaction } = require("../db");
const { requireAdmin } = require("../middleware/auth");
const { shapeProducts } = require("./catalog");
const { getSettings, setSettings } = require("../lib/settings");
const { invoiceToken } = require("../lib/invoice");
const v = require("../lib/validate");

const router = express.Router();
router.use(requireAdmin);

const ORDER_STATUSES = ["Pending", "Confirmed", "Packed", "Out for Delivery", "Delivered", "Cancelled"];

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

router.get("/stats", async (req, res) => {
  const [[revenue], [today], [pending], lowStock, [customers], recent] = await Promise.all([
    query("SELECT COALESCE(SUM(total_amount),0) AS v, COUNT(*) AS n FROM orders WHERE status <> 'Cancelled'"),
    query("SELECT COUNT(*) AS n, COALESCE(SUM(total_amount),0) AS v FROM orders WHERE DATE(created_at) = CURDATE() AND status <> 'Cancelled'"),
    query("SELECT COUNT(*) AS n FROM orders WHERE status = 'Pending'"),
    query(
      `SELECT v.id, v.size_label, v.sku, v.stock_qty, p.name, p.id AS product_id
       FROM product_variants v JOIN products p ON p.id = v.product_id
       WHERE v.stock_qty <= 5 AND p.is_active = 1 ORDER BY v.stock_qty, p.name`,
    ),
    query("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'"),
    query(
      "SELECT order_number, customer_name, total_amount, status, fulfillment_type, created_at FROM orders ORDER BY id DESC LIMIT 8",
    ),
  ]);
  const [daily, top, statusRows] = await Promise.all([
    query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, COUNT(*) AS n, COALESCE(SUM(total_amount),0) AS v
       FROM orders WHERE status <> 'Cancelled' AND created_at >= CURDATE() - INTERVAL 13 DAY GROUP BY d ORDER BY d`,
    ),
    query(
      `SELECT oi.product_name AS name, SUM(oi.quantity) AS qty, SUM(oi.line_total) AS revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.status <> 'Cancelled' GROUP BY oi.product_name ORDER BY revenue DESC LIMIT 5`,
    ),
    query("SELECT status, COUNT(*) AS n FROM orders GROUP BY status"),
  ]);
  const byDay = new Map(daily.map((r) => [r.d, r]));
  const salesByDay = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() + 5.5 * 3600 * 1000 - i * 86400000).toISOString().slice(0, 10); // IST calendar day
    const r = byDay.get(d);
    salesByDay.push({ date: d, orders: r ? Number(r.n) : 0, revenue: r ? Number(r.v) : 0 });
  }

  // Remind the admin while the shipped default password is still in use
  const { DEFAULT_ADMIN } = require("../migrate");
  const [me] = await query("SELECT password_hash FROM users WHERE id = ?", [req.user.id]);
  const defaultPassword = !!me && (await bcrypt.compare(DEFAULT_ADMIN.password, me.password_hash));

  res.json({
    defaultPassword,
    salesByDay,
    topProducts: top.map((t) => ({ name: t.name, quantity: Number(t.qty), revenue: Number(t.revenue) })),
    statusCounts: Object.fromEntries(ORDER_STATUSES.map((s) => [s, Number(statusRows.find((r) => r.status === s)?.n || 0)])),
    totalRevenue: Number(revenue.v),
    totalOrders: Number(revenue.n),
    todayOrders: Number(today.n),
    todayRevenue: Number(today.v),
    pendingOrders: Number(pending.n),
    lowStock: lowStock.map((r) => ({ variantId: r.id, productId: r.product_id, name: r.name, sizeLabel: r.size_label, sku: r.sku, stockQty: r.stock_qty })),
    totalCustomers: Number(customers.n),
    recentOrders: recent.map((o) => ({
      orderNumber: o.order_number,
      customerName: o.customer_name,
      totalAmount: Number(o.total_amount),
      status: o.status,
      fulfillmentType: o.fulfillment_type,
      createdAt: o.created_at,
    })),
  });
});

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

router.get("/categories", async (_req, res) => {
  res.json({ categories: await query("SELECT id, name, slug, sort_order FROM categories ORDER BY sort_order, name") });
});

router.post("/categories", async (req, res) => {
  const name = v.str(req.body.name, "Category name", { required: true, max: 80 });
  const slug = v.slug(req.body.slug || name);
  const [{ m }] = await query("SELECT COALESCE(MAX(sort_order),0) AS m FROM categories");
  try {
    const r = await query("INSERT INTO categories (name, slug, sort_order) VALUES (?, ?, ?)", [name, slug, Number(m) + 1]);
    res.status(201).json({ id: r.insertId, name, slug });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "A category with this name already exists" });
    throw err;
  }
});

/* ------------------------------------------------------------------ */
/* Products & variants                                                 */
/* ------------------------------------------------------------------ */

async function allProducts() {
  const [products, variants] = await Promise.all([
    query(
      `SELECT p.*, c.slug AS category_slug, c.name AS category_name
       FROM products p LEFT JOIN categories c ON c.id = p.category_id ORDER BY p.sort_order, p.id`,
    ),
    query("SELECT * FROM product_variants ORDER BY product_id, sort_order, price"),
  ]);
  return shapeProducts(products, variants).map((p, i) => ({
    ...p,
    categoryId: products[i].category_id,
    isActive: Boolean(products[i].is_active),
    sortOrder: products[i].sort_order,
  }));
}

function productFields(body) {
  return {
    name: v.str(body.name, "Product name", { required: true, max: 150 }),
    slug: v.slug(body.slug || body.name),
    categoryId: body.categoryId ? v.int(body.categoryId, "Category", { min: 1, max: 1e9 }) : null,
    tagline: v.str(body.tagline, "Tagline", { max: 255 }),
    description: v.str(body.description, "Description", { max: 5000 }),
    imageUrl: v.url(body.imageUrl, "Image"),
    accentColor: v.hexColor(body.accentColor || "#D97706", "Bottle colour"),
    badgeText: v.str(body.badgeText, "Badge", { max: 40 }),
    rating: v.money(body.rating ?? 0, "Rating", { min: 0, max: 5 }),
    reviewCount: v.int(body.reviewCount ?? 0, "Review count", { min: 0, max: 1e7 }),
    isFeatured: v.bool(body.isFeatured) ? 1 : 0,
    isActive: body.isActive === undefined ? 1 : v.bool(body.isActive) ? 1 : 0,
    sortOrder: v.int(body.sortOrder ?? 0, "Sort order", { min: 0, max: 10000 }),
  };
}

function variantFields(body) {
  const price = v.money(body.price, "Price", { min: 0, max: 1e7 });
  const mrp = body.mrp === "" || body.mrp === undefined || body.mrp === null ? price : v.money(body.mrp, "MRP", { min: 0, max: 1e7 });
  if (mrp < price) throw new v.ValidationError("MRP cannot be lower than the selling price", "mrp");
  return {
    sizeLabel: v.str(body.sizeLabel, "Pack size", { required: true, max: 40 }),
    sku: v.str(body.sku, "SKU", { required: true, max: 60 }).toUpperCase(),
    price,
    mrp,
    stockQty: v.int(body.stockQty ?? 0, "Stock", { min: 0, max: 1e6 }),
    sortOrder: v.int(body.sortOrder ?? 0, "Sort order", { min: 0, max: 10000 }),
  };
}

const dup = (res, what) => res.status(409).json({ error: `Another ${what} already uses this value` });

router.get("/products", async (_req, res) => {
  const [products, categories] = await Promise.all([allProducts(), query("SELECT id, name, slug FROM categories ORDER BY sort_order, name")]);
  res.json({ products, categories });
});

router.post("/products", async (req, res) => {
  const p = productFields(req.body);
  const variants = (Array.isArray(req.body.variants) ? req.body.variants : []).map(variantFields);
  if (!variants.length) throw new v.ValidationError("Add at least one pack size with a price", "variants");
  try {
    const id = await transaction(async (conn) => {
      const [r] = await conn.execute(
        `INSERT INTO products (category_id, name, slug, tagline, description, image_url, accent_color, badge_text, rating, review_count, is_featured, is_active, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.categoryId, p.name, p.slug, p.tagline, p.description, p.imageUrl, p.accentColor, p.badgeText, p.rating, p.reviewCount, p.isFeatured, p.isActive, p.sortOrder],
      );
      for (const [i, vr] of variants.entries()) {
        await conn.execute(
          "INSERT INTO product_variants (product_id, size_label, sku, price, mrp, stock_qty, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [r.insertId, vr.sizeLabel, vr.sku, vr.price, vr.mrp, vr.stockQty, vr.sortOrder || i],
        );
      }
      return r.insertId;
    });
    res.status(201).json({ id });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return dup(res, "product or SKU");
    throw err;
  }
});

router.put("/products/:id", async (req, res) => {
  const id = v.int(req.params.id, "id", { min: 1, max: 1e9 });
  const p = productFields(req.body);
  try {
    const r = await query(
      `UPDATE products SET category_id=?, name=?, slug=?, tagline=?, description=?, image_url=?, accent_color=?, badge_text=?,
         rating=?, review_count=?, is_featured=?, is_active=?, sort_order=? WHERE id=?`,
      [p.categoryId, p.name, p.slug, p.tagline, p.description, p.imageUrl, p.accentColor, p.badgeText, p.rating, p.reviewCount, p.isFeatured, p.isActive, p.sortOrder, id],
    );
    if (!r.affectedRows) return res.status(404).json({ error: "Product not found" });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return dup(res, "product (URL slug)");
    throw err;
  }
});

router.patch("/products/:id/flags", async (req, res) => {
  const id = v.int(req.params.id, "id", { min: 1, max: 1e9 });
  const sets = [];
  const params = [];
  if (req.body.isActive !== undefined) {
    sets.push("is_active = ?");
    params.push(v.bool(req.body.isActive) ? 1 : 0);
  }
  if (req.body.isFeatured !== undefined) {
    sets.push("is_featured = ?");
    params.push(v.bool(req.body.isFeatured) ? 1 : 0);
  }
  if (!sets.length) return res.status(400).json({ error: "Nothing to update" });
  await query(`UPDATE products SET ${sets.join(", ")} WHERE id = ?`, [...params, id]);
  res.json({ ok: true });
});

router.delete("/products/:id", async (req, res) => {
  const id = v.int(req.params.id, "id", { min: 1, max: 1e9 });
  await query("DELETE FROM products WHERE id = ?", [id]); // order history keeps names & prices
  res.json({ ok: true });
});

router.post("/products/:id/variants", async (req, res) => {
  const productId = v.int(req.params.id, "id", { min: 1, max: 1e9 });
  const vr = variantFields(req.body);
  const exists = await query("SELECT id FROM products WHERE id = ?", [productId]);
  if (!exists.length) return res.status(404).json({ error: "Product not found" });
  try {
    const r = await query(
      "INSERT INTO product_variants (product_id, size_label, sku, price, mrp, stock_qty, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [productId, vr.sizeLabel, vr.sku, vr.price, vr.mrp, vr.stockQty, vr.sortOrder],
    );
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return dup(res, "pack size (SKU)");
    throw err;
  }
});

router.put("/variants/:id", async (req, res) => {
  const id = v.int(req.params.id, "id", { min: 1, max: 1e9 });
  const vr = variantFields(req.body);
  try {
    const r = await query("UPDATE product_variants SET size_label=?, sku=?, price=?, mrp=?, stock_qty=?, sort_order=? WHERE id=?", [
      vr.sizeLabel,
      vr.sku,
      vr.price,
      vr.mrp,
      vr.stockQty,
      vr.sortOrder,
      id,
    ]);
    if (!r.affectedRows) return res.status(404).json({ error: "Pack size not found" });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return dup(res, "pack size (SKU)");
    throw err;
  }
});

/** Quick restock from the dashboard. */
router.patch("/variants/:id/stock", async (req, res) => {
  const id = v.int(req.params.id, "id", { min: 1, max: 1e9 });
  const stockQty = v.int(req.body.stockQty, "Stock", { min: 0, max: 1e6 });
  const r = await query("UPDATE product_variants SET stock_qty = ? WHERE id = ?", [stockQty, id]);
  if (!r.affectedRows) return res.status(404).json({ error: "Pack size not found" });
  res.json({ ok: true, stockQty });
});

router.delete("/variants/:id", async (req, res) => {
  const id = v.int(req.params.id, "id", { min: 1, max: 1e9 });
  const [row] = await query("SELECT product_id FROM product_variants WHERE id = ?", [id]);
  if (!row) return res.status(404).json({ error: "Pack size not found" });
  const [{ n }] = await query("SELECT COUNT(*) AS n FROM product_variants WHERE product_id = ?", [row.product_id]);
  if (Number(n) <= 1) return res.status(400).json({ error: "A product needs at least one pack size. Hide the product instead." });
  await query("DELETE FROM product_variants WHERE id = ?", [id]);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Image upload                                                        */
/* ------------------------------------------------------------------ */

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadBytes, files: 1 } });

function sniffImage(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

router.post("/upload", (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "Images must be 3 MB or smaller" : "Upload failed" });
    if (!req.file) return res.status(400).json({ error: "Choose an image to upload" });
    const ext = sniffImage(req.file.buffer);
    if (!ext) return res.status(415).json({ error: "Only JPG, PNG or WebP images are allowed" });
    const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
    fs.mkdirSync(config.uploadDir, { recursive: true });
    fs.writeFile(path.join(config.uploadDir, name), req.file.buffer, (writeErr) => {
      if (writeErr) return next(writeErr);
      res.status(201).json({ url: `/uploads/${name}` });
    });
  });
});

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

router.get("/orders", async (req, res) => {
  const where = ["1=1"];
  const params = [];
  if (ORDER_STATUSES.includes(req.query.status)) {
    where.push("status = ?");
    params.push(req.query.status);
  }
  if (["delivery", "pickup"].includes(req.query.fulfillment)) {
    where.push("fulfillment_type = ?");
    params.push(req.query.fulfillment);
  }
  const q = v.clean(req.query.q, 60);
  if (q) {
    where.push("(order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
  const perPage = 25;
  const [{ n }] = await queryRaw(`SELECT COUNT(*) AS n FROM orders WHERE ${where.join(" AND ")}`, params);
  const orders = await queryRaw(
    `SELECT o.*, (SELECT COALESCE(SUM(quantity),0) FROM order_items WHERE order_id = o.id) AS item_count
     FROM orders o WHERE ${where.join(" AND ")} ORDER BY o.id DESC LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`,
    params,
  );
  res.json({
    total: Number(n),
    page,
    pages: Math.max(1, Math.ceil(Number(n) / perPage)),
    orders: orders.map((o) => ({
      orderNumber: o.order_number,
      customerName: o.customer_name,
      customerPhone: o.customer_phone,
      fulfillmentType: o.fulfillment_type,
      paymentMethod: o.payment_method,
      totalAmount: Number(o.total_amount),
      itemCount: Number(o.item_count),
      status: o.status,
      createdAt: o.created_at,
    })),
  });
});

/** Download filtered orders as CSV (opens in Excel / Google Sheets). */
router.get("/orders.csv", async (req, res) => {
  const where = ["1=1"];
  const params = [];
  if (ORDER_STATUSES.includes(req.query.status)) {
    where.push("status = ?");
    params.push(req.query.status);
  }
  if (["delivery", "pickup"].includes(req.query.fulfillment)) {
    where.push("fulfillment_type = ?");
    params.push(req.query.fulfillment);
  }
  const orders = await queryRaw(
    `SELECT o.*, (SELECT GROUP_CONCAT(CONCAT(product_name, ' (', size_label, ') x', quantity) SEPARATOR '; ') FROM order_items WHERE order_id = o.id) AS items
     FROM orders o WHERE ${where.join(" AND ")} ORDER BY o.id DESC LIMIT 5000`,
    params,
  );
  // Prefix formula-like cells so spreadsheets never execute them
  const cell = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = ["Order", "Date", "Status", "Customer", "Phone", "Fulfilment", "Address", "Pincode", "Payment", "Items", "Subtotal", "Discount", "Delivery", "Total", "Coupon"];
  const lines = orders.map((o) =>
    [
      o.order_number,
      new Date(o.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      o.status,
      o.customer_name,
      o.customer_phone,
      o.fulfillment_type,
      o.delivery_address,
      o.pincode,
      o.payment_method,
      o.items,
      o.subtotal,
      o.discount_amount,
      o.delivery_fee,
      o.total_amount,
      o.coupon_code,
    ]
      .map(cell)
      .join(","),
  );
  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Content-Disposition", `attachment; filename="varam-orders-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send("﻿" + [header.map(cell).join(","), ...lines].join("\r\n"));
});

/** Registered customers with order count and lifetime spend. */
router.get("/customers", async (req, res) => {
  const q = v.clean(req.query.q, 60);
  const params = [];
  let filter = "";
  if (q) {
    filter = "AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)";
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const rows = await queryRaw(
    `SELECT u.id, u.name, u.email, u.phone, u.created_at,
            COUNT(o.id) AS orders, COALESCE(SUM(CASE WHEN o.status <> 'Cancelled' THEN o.total_amount END),0) AS spent,
            MAX(o.created_at) AS last_order
     FROM users u LEFT JOIN orders o ON o.user_id = u.id
     WHERE u.role = 'customer' ${filter}
     GROUP BY u.id ORDER BY spent DESC, u.id DESC LIMIT 500`,
    params,
  );
  res.json({
    customers: rows.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      joinedAt: c.created_at,
      orders: Number(c.orders),
      spent: Number(c.spent),
      lastOrderAt: c.last_order,
    })),
  });
});

router.get("/orders/:orderNumber", async (req, res) => {
  const [o] = await query("SELECT * FROM orders WHERE order_number = ? LIMIT 1", [v.clean(req.params.orderNumber, 30)]);
  if (!o) return res.status(404).json({ error: "Order not found" });
  const items = await query("SELECT * FROM order_items WHERE order_id = ? ORDER BY id", [o.id]);
  res.json({
    order: {
      orderNumber: o.order_number,
      status: o.status,
      createdAt: o.created_at,
      customerName: o.customer_name,
      customerPhone: o.customer_phone,
      fulfillmentType: o.fulfillment_type,
      deliveryAddress: o.delivery_address,
      pincode: o.pincode,
      paymentMethod: o.payment_method,
      subtotal: Number(o.subtotal),
      discountAmount: Number(o.discount_amount),
      deliveryFee: Number(o.delivery_fee),
      totalAmount: Number(o.total_amount),
      couponCode: o.coupon_code,
      notes: o.notes,
      invoiceUrl: `/invoice/${o.order_number}?t=${invoiceToken(o.order_number)}`,
      packingSlipUrl: `/admin/orders/${o.order_number}/slip`,
      items: items.map((i) => ({
        productName: i.product_name,
        sizeLabel: i.size_label,
        unitPrice: Number(i.unit_price),
        quantity: i.quantity,
        lineTotal: Number(i.line_total),
      })),
    },
  });
});

router.put("/orders/:orderNumber/status", async (req, res) => {
  const status = v.oneOf(req.body.status, "Status", ORDER_STATUSES);
  const orderNumber = v.clean(req.params.orderNumber, 30);
  await transaction(async (conn) => {
    const [[o]] = await conn.execute("SELECT id, status FROM orders WHERE order_number = ? FOR UPDATE", [orderNumber]);
    if (!o) {
      const e = new Error("Order not found");
      e.status = 404;
      throw e;
    }
    if (o.status === "Cancelled" && status !== "Cancelled") {
      const e = new Error("Cancelled orders cannot be reopened. Ask the customer to place a new order.");
      e.status = 400;
      throw e;
    }
    if (status === "Cancelled" && o.status !== "Cancelled") {
      // Return stock for cancelled orders
      const [items] = await conn.execute("SELECT variant_id, quantity FROM order_items WHERE order_id = ? AND variant_id IS NOT NULL", [o.id]);
      for (const it of items) {
        await conn.execute("UPDATE product_variants SET stock_qty = stock_qty + ? WHERE id = ?", [it.quantity, it.variant_id]);
      }
    }
    await conn.execute("UPDATE orders SET status = ? WHERE id = ?", [status, o.id]);
  });
  res.json({ ok: true, status });
});

/* ------------------------------------------------------------------ */
/* Coupons                                                             */
/* ------------------------------------------------------------------ */

function couponFields(body) {
  const type = v.oneOf(body.discountType, "Discount type", ["percent", "flat"]);
  const value = v.money(body.discountValue, "Discount value", { min: 0.01, max: type === "percent" ? 100 : 1e6 });
  return {
    code: v.str(body.code, "Code", { required: true, max: 40 }).toUpperCase().replace(/\s+/g, ""),
    type,
    value,
    min: v.money(body.minOrderAmount ?? 0, "Minimum order", { min: 0, max: 1e7 }),
    active: v.bool(body.isActive) ? 1 : 0,
  };
}

router.get("/coupons", async (_req, res) => {
  const rows = await query("SELECT * FROM coupons ORDER BY is_active DESC, code");
  res.json({
    coupons: rows.map((c) => ({
      id: c.id,
      code: c.code,
      discountType: c.discount_type,
      discountValue: Number(c.discount_value),
      minOrderAmount: Number(c.min_order_amount),
      isActive: Boolean(c.is_active),
    })),
  });
});

router.post("/coupons", async (req, res) => {
  const c = couponFields({ ...req.body, isActive: req.body.isActive ?? true });
  try {
    const r = await query("INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, is_active) VALUES (?, ?, ?, ?, ?)", [
      c.code,
      c.type,
      c.value,
      c.min,
      c.active,
    ]);
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return dup(res, "coupon (code)");
    throw err;
  }
});

router.put("/coupons/:id", async (req, res) => {
  const id = v.int(req.params.id, "id", { min: 1, max: 1e9 });
  const c = couponFields(req.body);
  try {
    await query("UPDATE coupons SET code=?, discount_type=?, discount_value=?, min_order_amount=?, is_active=? WHERE id=?", [
      c.code,
      c.type,
      c.value,
      c.min,
      c.active,
      id,
    ]);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return dup(res, "coupon (code)");
    throw err;
  }
});

router.delete("/coupons/:id", async (req, res) => {
  await query("DELETE FROM coupons WHERE id = ?", [v.int(req.params.id, "id", { min: 1, max: 1e9 })]);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Store settings                                                      */
/* ------------------------------------------------------------------ */

router.get("/settings", async (_req, res) => {
  res.json({ settings: await getSettings() });
});

router.put("/settings", async (req, res) => {
  const b = req.body || {};
  let testimonials;
  if (b.testimonials !== undefined) {
    const list = Array.isArray(b.testimonials) ? b.testimonials : [];
    testimonials = JSON.stringify(
      list.slice(0, 20).map((t) => ({
        name: v.str(t.name, "Reviewer name", { required: true, max: 80 }),
        text: v.str(t.text, "Review text", { required: true, max: 800 }),
        rating: v.int(t.rating ?? 5, "Rating", { min: 1, max: 5 }),
        source: v.str(t.source || "Google", "Source", { max: 30 }),
      })),
    );
  }
  const waDigits = String(b.whatsapp_number ?? "").replace(/\D/g, "");
  if (waDigits && (waDigits.length < 11 || waDigits.length > 15)) throw new v.ValidationError("WhatsApp number must include the country code, e.g. 917799228444", "whatsapp_number");
  await setSettings({
    announcement: v.str(b.announcement, "Announcement", { max: 200 }),
    free_delivery_threshold: v.money(b.free_delivery_threshold, "Free delivery threshold", { min: 0, max: 1e6 }),
    delivery_fee: v.money(b.delivery_fee, "Delivery charge", { min: 0, max: 1e5 }),
    store_name: v.str(b.store_name, "Store name", { required: true, max: 120 }),
    store_address: v.str(b.store_address, "Store address", { required: true, max: 300 }),
    store_phone: v.str(b.store_phone, "Store phone", { required: true, max: 30 }),
    whatsapp_number: waDigits || "917799228444",
    store_hours: v.str(b.store_hours, "Store hours", { max: 120 }),
    maps_url: v.url(b.maps_url, "Google Maps link"),
    upi_id: v.str(b.upi_id, "UPI ID", { max: 80 }),
    instagram_url: v.url(b.instagram_url, "Instagram link"),
    google_rating: v.money(b.google_rating ?? 0, "Google rating", { min: 0, max: 5 }),
    google_review_count: v.int(b.google_review_count ?? 0, "Google review count", { min: 0, max: 1e7 }),
    google_reviews_url: v.url(b.google_reviews_url, "Google reviews link"),
    ...(testimonials !== undefined ? { testimonials } : {}),
  });
  res.json({ settings: await getSettings() });
});

module.exports = { router, ORDER_STATUSES };
