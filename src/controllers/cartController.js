"use strict";

const cartService = require("../services/cartService");
const validate = require("../validators");
const { id } = require("../utils/validate");

async function get(req, res) {
  res.json({ items: await cartService.getItems(req.user.id) });
}

/** Set the absolute quantity of one variant (0 removes it). Idempotent, so retries are safe. */
async function setQuantity(req, res) {
  const { variantId, quantity } = validate.cartQuantity(req.body);
  res.json({ items: await cartService.setQuantity(req.user.id, variantId, quantity) });
}

async function remove(req, res) {
  res.json({ items: await cartService.removeItem(req.user.id, id(req.params.variantId, "variantId")) });
}

async function clear(req, res) {
  await cartService.clear(req.user.id);
  res.json({ items: [] });
}

/** Merge a guest (localStorage) cart into the account cart in one atomic upsert. */
async function merge(req, res) {
  res.json({ items: await cartService.merge(req.user.id, req.body.items) });
}

module.exports = { get, setQuantity, remove, clear, merge };
