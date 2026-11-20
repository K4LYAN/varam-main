"use strict";

const express = require("express");
const c = require("../controllers/pageController");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/", c.home);
router.get("/shop", c.shop);
router.get("/faq", c.faqPage);
router.get("/product/:slug", c.product);
// Customer accounts were removed: orders go through WhatsApp. Old links land on the home page.
router.get(["/login", "/register", "/account"], (req, res) => res.redirect(301, "/"));

router.get("/admin/login", c.adminLogin);
router.get(["/admin", "/admin/products", "/admin/orders", "/admin/customers", "/admin/users", "/admin/settings"], requireAdmin, c.adminApp);
router.get("/admin/orders/:orderNumber/slip", requireAdmin, c.packingSlip);

router.get("/invoice/:orderNumber", c.invoice);
router.get("/robots.txt", c.robots);
router.get("/sitemap.xml", c.sitemap);

module.exports = router;
