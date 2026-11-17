"use strict";

const express = require("express");
const c = require("../controllers/cartController");
const { requireUser } = require("../middleware/auth");

const router = express.Router();
router.use(requireUser);

router.get("/", c.get);
router.put("/items", c.setQuantity);
router.delete("/items/:variantId", c.remove);
router.delete("/", c.clear);
router.post("/merge", c.merge);

module.exports = router;
