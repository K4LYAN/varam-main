"use strict";

const crypto = require("crypto");
const config = require("../config");

/**
 * Signed invoice links. Order numbers are random, and the link also carries an
 * HMAC so a guest can open their own invoice — and nobody else's.
 */
function invoiceToken(orderNumber) {
  return crypto.createHmac("sha256", config.jwtSecret).update(`invoice:${orderNumber}`).digest("base64url").slice(0, 24);
}

function verifyInvoiceToken(orderNumber, token) {
  const expected = Buffer.from(invoiceToken(orderNumber));
  const given = Buffer.from(String(token || ""));
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

const invoiceUrl = (orderNumber) => `/invoice/${encodeURIComponent(orderNumber)}?t=${invoiceToken(orderNumber)}`;

module.exports = { invoiceToken, verifyInvoiceToken, invoiceUrl };
