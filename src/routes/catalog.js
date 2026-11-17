"use strict";

const express = require("express");
const c = require("../controllers/catalogController");

const router = express.Router();

router.get("/catalog", c.catalog);
router.get("/products/:slug", c.product);
router.get("/settings", c.settings);

module.exports = router;
