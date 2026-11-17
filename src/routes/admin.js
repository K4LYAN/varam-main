"use strict";

const express = require("express");
const multer = require("multer");
const config = require("../config");
const c = require("../controllers/adminController");
const users = require("../controllers/userAdminController");
const { requireAdmin } = require("../middleware/auth");
const { uploadLimiter, passwordLimiter: passwordResetLimiter } = require("../middleware/security");
const { badRequest } = require("../utils/httpError");

const router = express.Router();
router.use(requireAdmin); // server-side RBAC: every route below needs role = 'admin' (read from MySQL)

// Memory storage + size cap; the file's magic bytes are checked before anything touches disk
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadBytes, files: 1, fields: 5 } });
const singleImage = (req, res, next) =>
  upload.single("image")(req, res, (err) => {
    if (!err) return next();
    next(badRequest(err.code === "LIMIT_FILE_SIZE" ? "Images must be 3 MB or smaller" : "Upload failed"));
  });

router.get("/stats", c.stats);
router.get("/audit", c.audit);
router.get("/customers", c.customers);

// User management (customers + admins)
router.get("/users", users.list);
router.post("/users", users.create);
router.get("/users/:id", users.detail);
router.put("/users/:id", users.update);
router.patch("/users/:id/role", users.setRole);
router.patch("/users/:id/status", users.setStatus);
router.post("/users/:id/reset-password", passwordResetLimiter, users.resetPassword);
router.post("/users/:id/revoke-sessions", users.revokeSessions);
router.delete("/users/:id", users.remove);

router.get("/categories", c.listCategories);
router.post("/categories", c.createCategory);

router.get("/products", c.listProducts);
router.post("/products", c.createProduct);
router.put("/products/:id", c.updateProduct);
router.patch("/products/:id/flags", c.setProductFlags);
router.delete("/products/:id", c.deleteProduct);
router.post("/products/:id/variants", c.addVariant);

router.put("/variants/:id", c.updateVariant);
router.patch("/variants/:id/stock", c.setStock);
router.delete("/variants/:id", c.deleteVariant);

router.post("/upload", uploadLimiter, singleImage, c.upload);

router.get("/orders", c.listOrders);
router.get("/orders.csv", c.exportOrders);
router.get("/orders/:orderNumber", c.orderDetail);
router.put("/orders/:orderNumber/status", c.updateOrderStatus);

router.get("/coupons", c.listCoupons);
router.post("/coupons", c.createCoupon);
router.put("/coupons/:id", c.updateCoupon);
router.delete("/coupons/:id", c.deleteCoupon);

router.get("/settings", c.getSettings);
router.put("/settings", c.updateSettings);

module.exports = router;
