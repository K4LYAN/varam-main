"use strict";

/**
 * Page routes: clean URLs, product pages, the generated js/data.js, sitemap.xml,
 * llms.txt and old links. Home, shop and product pages are sent with real product
 * content filled in (src/render.js) so every crawler can read them.
 */
const express = require("express");
const path = require("path");
const store = require("../store");
const render = require("../render");

const router = express.Router();

const html = (res, body) => res.type("html").set("Cache-Control", "no-cache").send(body);

router.get("/js/data.js", (req, res) => {
  res.type("text/javascript").set("Cache-Control", "no-cache").send(store.browserScript());
});

router.get(["/", "/index.html"], (req, res) => html(res, render.home()));
router.get(["/shop", "/shop.html"], (req, res) => html(res, render.shop()));
router.get(["/faq", "/faq.html"], (req, res) => res.sendFile(path.join(__dirname, "..", "..", "public", "faq.html")));

router.get(["/product/:slug", "/products/:slug"], (req, res, next) => {
  const page = render.product(req.params.slug.replace(/\.html$/, ""));
  if (!page) return next();
  html(res, page);
});

router.get("/sitemap.xml", (req, res) => {
  res.type("application/xml").set("Cache-Control", "public, max-age=3600").send(render.sitemap());
});

router.get("/llms.txt", (req, res) => {
  res.type("text/plain").set("Cache-Control", "public, max-age=3600").send(render.llmsTxt());
});

// Store pages that no longer exist
router.get(/^\/(login|register|account|admin)(\/.*)?$/, (req, res) => res.redirect(301, "/"));

module.exports = router;
