"use strict";

const path = require("path");
const config = require("../config");
const catalogService = require("../services/catalogService");
const orderService = require("../services/orderService");
const settingsService = require("../services/settingsService");
const { verifyInvoiceToken } = require("../services/invoiceService");
const { renderInvoice } = require("../utils/invoiceTemplate");
const validate = require("../validators");
const { clean } = require("../utils/validate");

const VIEWS = path.join(config.root, "views");
const send = (res, ...parts) => res.sendFile(path.join(VIEWS, ...parts));
const notFoundPage = (res) => res.status(404).sendFile(path.join(VIEWS, "404.html"));

const view = (...parts) => (_req, res) => send(res, ...parts);

async function product(req, res) {
  if (!(await catalogService.isActiveSlug(clean(req.params.slug, 150)))) return notFoundPage(res);
  send(res, "product.html");
}

const login = (req, res) => (req.user ? res.redirect("/account") : send(res, "login.html"));
const register = (req, res) => (req.user ? res.redirect("/account") : send(res, "register.html"));
const adminLogin = (req, res) => (req.user?.role === "admin" ? res.redirect("/admin") : send(res, "admin", "login.html"));

function adminApp(_req, res) {
  res.set("X-Robots-Tag", "noindex, nofollow");
  send(res, "admin", "index.html");
}

/**
 * Printable invoice. Allowed for: an admin, the signed-in customer who owns
 * the order, or anyone holding the HMAC-signed link. Anyone else gets a 404
 * (not 403) so order numbers cannot be probed.
 */
async function invoice(req, res) {
  const data = await orderService.findByNumber(validate.orderNumber(req.params.orderNumber));
  const allowed =
    data &&
    (req.user?.role === "admin" ||
      (req.user && data.order.user_id === req.user.id) ||
      verifyInvoiceToken(data.order.order_number, req.query.t));
  if (!allowed) return notFoundPage(res);
  res.set("X-Robots-Tag", "noindex");
  res.set("Cache-Control", "private, no-store");
  res.type("html").send(renderInvoice(data.order, data.items, await settingsService.getSettings()));
}

async function packingSlip(req, res) {
  const data = await orderService.findByNumber(validate.orderNumber(req.params.orderNumber));
  if (!data) return notFoundPage(res);
  res.set("Cache-Control", "private, no-store");
  res.type("html").send(renderInvoice(data.order, data.items, await settingsService.getSettings(), { packingSlip: true }));
}

function robots(_req, res) {
  res
    .type("text/plain")
    .send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /account\nDisallow: /invoice/\nSitemap: ${config.siteUrl}/sitemap.xml\n`);
}

async function sitemap(_req, res) {
  const slugs = await catalogService.activeSlugs();
  const urls = ["/", ...slugs.map((s) => `/product/${encodeURIComponent(s)}`)].map((u) => `<url><loc>${config.siteUrl}${u}</loc></url>`).join("");
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
}

module.exports = { view, product, login, register, adminLogin, adminApp, invoice, packingSlip, robots, sitemap };
