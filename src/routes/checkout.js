"use strict";

const express = require("express");
const c = require("../controllers/checkoutController");
const { orderLimiter } = require("../middleware/security");

const router = express.Router();

router.post("/checkout/quote", c.quoteCart);
router.post("/coupons/validate", c.validateCoupon);
router.post("/orders", orderLimiter, c.placeOrder); // guests and signed-in customers

module.exports = router;
