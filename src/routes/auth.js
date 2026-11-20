"use strict";

const express = require("express");
const c = require("../controllers/authController");
const { requireUser } = require("../middleware/auth");
const { loginLimiter, passwordLimiter } = require("../middleware/security");

const router = express.Router();

router.get("/csrf", c.csrfToken);
router.get("/me", c.me);
router.post("/login", loginLimiter, c.login); // also used by /admin/login (adminOnly: true)
router.post("/logout", c.logout);
router.post("/password", requireUser, passwordLimiter, c.changePassword);

module.exports = router;
