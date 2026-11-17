"use strict";

const adminService = require("../services/adminService");
const productAdminService = require("../services/productAdminService");
const orderService = require("../services/orderService");
const couponService = require("../services/couponService");
const settingsService = require("../services/settingsService");
const auditService = require("../services/auditService");
const uploadService = require("../services/uploadService");
const validate = require("../validators");
const { id, int, clean, oneOf } = require("../utils/validate");
const { toCsv } = require("../utils/csv");
const { ORDER_STATUSES } = require("../config/defaults");

const ctx = auditService.contextFrom;

/* ---------------- Dashboard ---------------- */

async function stats(req, res) {
  const s = await adminService.dashboardStats();
  // Reminder while the shipped default password is still in use (flag set at seed time — no bcrypt per request)
  res.json({ ...s, defaultPassword: Boolean(req.user.must_change_password) });
}

async function audit(req, res) {
  res.json({ entries: await auditService.list({ limit: req.query.limit, entityType: clean(req.query.entityType, 30) }) });
}

async function customers(req, res) {
  res.json({ customers: await adminService.customers(clean(req.query.q, 60)) });
}

/* ---------------- Catalogue ---------------- */

async function listCategories(_req, res) {
  res.json({ categories: await productAdminService.listCategories() });
}

async function createCategory(req, res) {
  res.status(201).json(await productAdminService.createCategory(ctx(req), validate.category(req.body)));
}

async function listProducts(_req, res) {
  const [products, categories] = await Promise.all([productAdminService.listProducts(), productAdminService.listCategories()]);
  res.json({ products, categories: categories.map(({ id: cid, name, slug }) => ({ id: cid, name, slug })) });
}

async function createProduct(req, res) {
  const { product, variants } = validate.productWithVariants(req.body);
  res.status(201).json({ id: await productAdminService.createProduct(ctx(req), product, variants) });
}

async function updateProduct(req, res) {
  await productAdminService.updateProduct(ctx(req), id(req.params.id), validate.product(req.body));
  res.json({ ok: true });
}

async function setProductFlags(req, res) {
  await productAdminService.setFlags(ctx(req), id(req.params.id), validate.flags(req.body));
  res.json({ ok: true });
}

async function deleteProduct(req, res) {
  await productAdminService.deleteProduct(ctx(req), id(req.params.id));
  res.json({ ok: true });
}

async function addVariant(req, res) {
  res.status(201).json({ id: await productAdminService.addVariant(ctx(req), id(req.params.id), validate.variant(req.body)) });
}

async function updateVariant(req, res) {
  await productAdminService.updateVariant(ctx(req), id(req.params.id), validate.variant(req.body));
  res.json({ ok: true });
}

async function setStock(req, res) {
  const stockQty = await productAdminService.setStock(ctx(req), id(req.params.id), int(req.body.stockQty, "Stock", { min: 0, max: 1e6 }));
  res.json({ ok: true, stockQty });
}

async function deleteVariant(req, res) {
  await productAdminService.deleteVariant(ctx(req), id(req.params.id));
  res.json({ ok: true });
}

async function upload(req, res) {
  res.status(201).json({ url: await uploadService.saveProductImage(req.file) });
}

/* ---------------- Orders ---------------- */

const orderFilters = (q) => ({ status: q.status, fulfillment: q.fulfillment, q: clean(q.q, 60) });

async function listOrders(req, res) {
  const page = Math.max(1, Math.min(10000, Math.floor(Number(req.query.page) || 1)));
  res.json(await orderService.adminList(orderFilters(req.query), page));
}

async function exportOrders(req, res) {
  const rows = await orderService.adminExport(orderFilters(req.query));
  const header = ["Order", "Date", "Status", "Customer", "Phone", "Fulfilment", "Address", "Pincode", "Payment", "Items", "Subtotal", "Discount", "Delivery", "Total", "Coupon"];
  const body = rows.map((o) => [
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
  ]);
  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Content-Disposition", `attachment; filename="varam-orders-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(toCsv(header, body));
}

async function orderDetail(req, res) {
  res.json({ order: await orderService.adminDetail(validate.orderNumber(req.params.orderNumber)) });
}

async function updateOrderStatus(req, res) {
  const status = oneOf(req.body.status, "Status", ORDER_STATUSES);
  await orderService.updateStatus(ctx(req), validate.orderNumber(req.params.orderNumber), status);
  res.json({ ok: true, status });
}

/* ---------------- Coupons & settings ---------------- */

async function listCoupons(_req, res) {
  res.json({ coupons: await couponService.list() });
}

async function createCoupon(req, res) {
  res.status(201).json({ id: await couponService.create(ctx(req), validate.coupon(req.body)) });
}

async function updateCoupon(req, res) {
  await couponService.update(ctx(req), id(req.params.id), validate.coupon(req.body));
  res.json({ ok: true });
}

async function deleteCoupon(req, res) {
  await couponService.remove(ctx(req), id(req.params.id));
  res.json({ ok: true });
}

async function getSettings(_req, res) {
  res.json({ settings: await settingsService.getSettings() });
}

async function updateSettings(req, res) {
  res.json({ settings: await settingsService.updateSettings(ctx(req), validate.settings(req.body || {})) });
}

module.exports = {
  stats,
  audit,
  customers,
  listCategories,
  createCategory,
  listProducts,
  createProduct,
  updateProduct,
  setProductFlags,
  deleteProduct,
  addVariant,
  updateVariant,
  setStock,
  deleteVariant,
  upload,
  listOrders,
  exportOrders,
  orderDetail,
  updateOrderStatus,
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getSettings,
  updateSettings,
};
