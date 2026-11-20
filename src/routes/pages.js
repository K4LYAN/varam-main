"use strict";

/** Page routes: clean URLs, product pages, the generated js/data.js and old links. */
const express = require("express");
const path = require("path");
const store = require("../store");

const PUBLIC = path.join(__dirname, "..", "..", "public");
const router = express.Router();

const page = (file) => (req, res) => res.sendFile(path.join(PUBLIC, file));

router.get("/js/data.js", (req, res) => {
  res.type("text/javascript").set("Cache-Control", "no-cache").send(store.browserScript());
});

router.get(["/shop", "/shop.html"], page("shop.html"));
router.get(["/faq", "/faq.html"], page("faq.html"));

router.get(["/product/:slug", "/products/:slug"], (req, res, next) => {
  const slug = req.params.slug.replace(/\.html$/, "");
  if (!store.product(slug)) return next();
  res.sendFile(path.join(PUBLIC, "products", `${slug}.html`));
});

// Store pages that no longer exist
router.get(/^\/(login|register|account|admin)(\/.*)?$/, (req, res) => res.redirect(301, "/"));

module.exports = router;
