"use strict";

const catalogService = require("../services/catalogService");
const settingsService = require("../services/settingsService");
const { clean } = require("../utils/validate");
const { notFound } = require("../utils/httpError");

async function catalog(_req, res) {
  const [data, settings] = await Promise.all([catalogService.activeCatalog(), settingsService.getSettings()]);
  res.set("Cache-Control", "no-store");
  res.json({ ...data, settings: settingsService.publicSettings(settings) });
}

/** One product + related products (same category first) for the product details page. */
async function product(req, res) {
  const data = await catalogService.productWithRelated(clean(req.params.slug, 150));
  if (!data) throw notFound("Product not found");
  res.set("Cache-Control", "no-store");
  res.json(data);
}

async function settings(_req, res) {
  res.set("Cache-Control", "no-store");
  res.json(settingsService.publicSettings(await settingsService.getSettings()));
}

module.exports = { catalog, product, settings };
