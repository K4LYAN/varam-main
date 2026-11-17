"use strict";

const { quote, publicQuote } = require("../services/pricingService");
const settingsService = require("../services/settingsService");
const couponService = require("../services/couponService");
const orderService = require("../services/orderService");
const validate = require("../validators");
const { clean } = require("../utils/validate");
const { badRequest } = require("../utils/httpError");

/** Live totals for the cart drawer — always priced from the database. */
async function quoteCart(req, res) {
  let country = "India";
  try {
    country = validate.country(req.body.country);
  } catch {
    country = "India"; // a half-typed country never breaks the live total
  }
  const q = await quote(
    { items: req.body.items, couponCode: clean(req.body.couponCode, 40), fulfillment: validate.fulfillment(req.body.fulfillment), country },
    await settingsService.getSettings(),
  );
  res.json(publicQuote(q));
}

/** Coupon preview. The subtotal comes from the cart items, never from the browser. */
async function validateCoupon(req, res) {
  const code = clean(req.body.code, 40).toUpperCase();
  if (!code) throw badRequest("Enter a coupon code", { field: "code" });
  res.json(await couponService.preview(code, req.body.items, await settingsService.getSettings()));
}

async function placeOrder(req, res) {
  const input = validate.order(req.body);
  const settings = await settingsService.getSettings();
  const order = await orderService.placeOrder({ user: req.user, input, settings });
  res.status(201).json({
    ...order,
    upiId: input.paymentMethod === "UPI" ? settings.upi_id || "" : "",
    paymentMethod: input.paymentMethod,
    fulfillment: input.fulfillment,
    country: input.country,
    international: input.country !== "India",
  });
}

module.exports = { quoteCart, validateCoupon, placeOrder };
