"use strict";

/**
 * Products, prices, contact details and coupons, read from src/data/store.json.
 * The file is re-read when it changes, so price edits go live without a restart.
 */
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "data", "store.json");
let cache = null;
let cachedAt = 0;

function load() {
  const { mtimeMs } = fs.statSync(FILE);
  if (!cache || mtimeMs !== cachedAt) {
    cache = JSON.parse(fs.readFileSync(FILE, "utf8"));
    cachedAt = mtimeMs;
  }
  return cache;
}

const store = {
  all: load,
  products: () => load().catalog.products,
  product: (slug) => load().catalog.products.find((p) => p.slug === slug) || null,
  settings: () => load().settings,
  /** The browser script the pages load as js/data.js */
  browserScript: () =>
    `/* Varam — products, prices and settings, served by the Node app from src/data/store.json */\n` +
    `window.VARAM_DATA = ${JSON.stringify({ generatedAt: new Date(cachedAt || Date.now()).toISOString(), ...load() })};\n`,
};

module.exports = store;
