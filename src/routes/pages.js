"use strict";

const express = require("express");
const c = require("../controllers/pageController");
const { requireUser, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/", c.view("index.html"));
router.get("/product/:slug", c.product);
router.get("/login", c.login);
router.get("/register", c.register);
router.get("/account", requireUser, c.view("account.html"));

router.get("/admin/login", c.adminLogin);
router.get(["/admin", "/admin/products", "/admin/orders", "/admin/customers", "/admin/settings"], requireAdmin, c.adminApp);
router.get("/admin/orders/:orderNumber/slip", requireAdmin, c.packingSlip);

router.get("/invoice/:orderNumber", c.invoice);
router.get("/robots.txt", c.robots);
router.get("/sitemap.xml", c.sitemap);

module.exports = router;
