"use strict";

const orderService = require("../services/orderService");
const accountService = require("../services/accountService");
const authService = require("../services/authService");
const validate = require("../validators");
const { id } = require("../utils/validate");

async function orders(req, res) {
  res.json({ orders: await orderService.listForUser(req.user.id) });
}

async function cancelOrder(req, res) {
  await orderService.cancelByCustomer(req.user.id, validate.orderNumber(req.params.orderNumber));
  res.json({ ok: true, status: "Cancelled" });
}

async function reorder(req, res) {
  res.json(await orderService.reorder(req.user.id, validate.orderNumber(req.params.orderNumber)));
}

async function updateProfile(req, res) {
  const user = await accountService.updateProfile(req.user.id, validate.profile(req.body));
  res.json({ user: authService.publicUser(user) });
}

async function listAddresses(req, res) {
  res.json({ addresses: await accountService.listAddresses(req.user.id) });
}

async function addAddress(req, res) {
  res.status(201).json({ addresses: await accountService.addAddress(req.user.id, validate.address(req.body)) });
}

async function updateAddress(req, res) {
  res.json({ addresses: await accountService.updateAddress(req.user.id, id(req.params.id), validate.address(req.body)) });
}

async function deleteAddress(req, res) {
  res.json({ addresses: await accountService.deleteAddress(req.user.id, id(req.params.id)) });
}

async function wishlist(req, res) {
  res.json({ productIds: await accountService.wishlistIds(req.user.id) });
}

async function addToWishlist(req, res) {
  res.json({ productIds: await accountService.addToWishlist(req.user.id, id(req.params.productId, "productId")) });
}

async function removeFromWishlist(req, res) {
  res.json({ productIds: await accountService.removeFromWishlist(req.user.id, id(req.params.productId, "productId")) });
}

module.exports = {
  orders,
  cancelOrder,
  reorder,
  updateProfile,
  listAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  wishlist,
  addToWishlist,
  removeFromWishlist,
};
