"use strict";

const express = require("express");
const c = require("../controllers/accountController");
const { requireUser } = require("../middleware/auth");

const router = express.Router();
router.use(requireUser);

router.get("/orders", c.orders);
router.post("/orders/:orderNumber/reorder", c.reorder);
router.post("/orders/:orderNumber/cancel", c.cancelOrder);
router.put("/profile", c.updateProfile);

router.get("/addresses", c.listAddresses);
router.post("/addresses", c.addAddress);
router.put("/addresses/:id", c.updateAddress);
router.delete("/addresses/:id", c.deleteAddress);

router.get("/wishlist", c.wishlist);
router.post("/wishlist/:productId", c.addToWishlist);
router.delete("/wishlist/:productId", c.removeFromWishlist);

module.exports = router;
