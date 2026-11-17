"use strict";

const express = require("express");
const path = require("path");
const { query } = require("../db");
const { requireUser, requireAdmin } = require("../middleware/auth");
const { getSettings } = require("../lib/settings");
const { renderInvoice, verifyInvoiceToken } = require("../lib/invoice");
const config = require("../config");
const v = require("../lib/validate");

const router = express.Router();
const VIEWS = path.join(__dirname, "..", "..", "views");
const view = (name) => (_req, res) => res.sendFile(path.join(VIEWS, name));

router.get("/", view("index.html"));
router.get("/login", (req, res) => (req.user ? res.redirect("/account") : res.sendFile(path.join(VIEWS, "login.html"))));
router.get("/register", (req, res) => (req.user ? res.redirect("/account") : res.sendFile(path.join(VIEWS, "register.html"))));
router.get("/account", requireUser, view("account.html"));

router.get("/admin/login", (req, res) =>
  req.user?.role === "admin" ? res.redirect("/admin") : res.sendFile(path.join(VIEWS, "admin", "login.html")),
);
router.get(["/admin", "/admin/products", "/admin/orders", "/admin/settings"], requireAdmin, (_req, res) => {
  res.set("X-Robots-Tag", "noindex, nofollow");
  res.sendFile(path.join(VIEWS, "admin", "index.html"));
});

async function loadOrder(orderNumber) {
  const [order] = await query("SELECT * FROM orders WHERE order_number = ? LIMIT 1", [v.clean(orderNumber, 30)]);
  if (!order) return null;
  const items = await query("SELECT * FROM order_items WHERE order_id = ? ORDER BY id", [order.id]);
  return { order, items };
}

/** Printable invoice: the customer who placed it, an admin, or anyone holding the signed link. */
router.get("/invoice/:orderNumber", async (req, res) => {
  const data = await loadOrder(req.params.orderNumber);
  const allowed =
    data &&
    (req.user?.role === "admin" ||
      (req.user && data.order.user_id === req.user.id) ||
      verifyInvoiceToken(data.order.order_number, req.query.t));
  if (!allowed) return res.status(404).sendFile(path.join(VIEWS, "404.html"));
  res.set("X-Robots-Tag", "noindex");
  res.type("html").send(renderInvoice(data.order, data.items, await getSettings()));
});

router.get("/admin/orders/:orderNumber/slip", requireAdmin, async (req, res) => {
  const data = await loadOrder(req.params.orderNumber);
  if (!data) return res.status(404).sendFile(path.join(VIEWS, "404.html"));
  res.type("html").send(renderInvoice(data.order, data.items, await getSettings(), { packingSlip: true }));
});

router.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /account\nDisallow: /invoice/\nSitemap: ${config.siteUrl}/sitemap.xml\n`);
});

router.get("/sitemap.xml", (_req, res) => {
  const urls = ["/", "/login", "/register"].map((u) => `<url><loc>${config.siteUrl}${u}</loc></url>`).join("");
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
});

module.exports = { router };
