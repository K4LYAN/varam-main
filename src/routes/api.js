"use strict";

/** Read-only JSON API: catalog, settings and single products. Orders go out on WhatsApp. */
const express = require("express");
const store = require("../store");

const router = express.Router();

router.get("/health", (req, res) => res.json({ ok: true }));

router.get("/catalog", (req, res) => {
  const { catalog, settings } = store.all();
  res.json({ ...catalog, settings });
});

router.get("/settings", (req, res) => res.json(store.settings()));

router.get("/products", (req, res) => res.json(store.products()));

router.get("/products/:slug", (req, res) => {
  const product = store.product(req.params.slug);
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});

router.use((req, res) => res.status(404).json({ error: "Not found" }));

module.exports = router;
