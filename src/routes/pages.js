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
const indexnow = require("../indexnow");

const router = express.Router();

const html = (res, body) => res.type("html").set("Cache-Control", "no-cache").send(body);

router.get("/js/data.js", (req, res) => {
  res.type("text/javascript").set("Cache-Control", "no-cache").send(store.browserScript());
});

router.get(["/", "/index.html"], (req, res) => html(res, render.home()));
router.get(["/shop", "/shop.html"], (req, res) => html(res, render.shop()));
router.get(["/faq", "/faq.html"], (req, res) => res.sendFile(path.join(__dirname, "..", "..", "public", "faq.html")));

router.get(["/product/:slug", "/products/:slug"], (req, res, next) => {
  // /products/<slug>.md — the same product as plain Markdown, for AI assistants
  if (req.params.slug.endsWith(".md")) {
    const p = store.product(req.params.slug.slice(0, -3));
    if (!p) return next();
    return res.type("text/markdown; charset=utf-8").set("Cache-Control", "no-cache").send(render.productMarkdown(p, store.settings()));
  }
  const page = render.product(req.params.slug.replace(/\.html$/, ""));
  if (!page) return next();
  html(res, page);
});

router.get("/sitemap.xml", (req, res) => {
  res.type("application/xml").set("Cache-Control", "public, max-age=3600").send(render.sitemap());
});

const text = (res, body) => res.type("text/plain; charset=utf-8").set("Cache-Control", "public, max-age=3600").send(body);
router.get("/llms.txt", (req, res) => text(res, render.llmsTxt()));
router.get("/llms-full.txt", (req, res) => text(res, render.llmsFull()));

router.get("/feed.xml", (req, res) => {
  res.type("application/xml").set("Cache-Control", "public, max-age=3600").send(render.merchantFeed());
});

// IndexNow (Bing, Yandex, Seznam, Naver): the key file proves we own the site
router.get(`/${indexnow.KEY}.txt`, (req, res) => text(res, indexnow.KEY));

// Store pages that no longer exist
router.get(/^\/(login|register|account|admin)(\/.*)?$/, (req, res) => res.redirect(301, "/"));

module.exports = router;
