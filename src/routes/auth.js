"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const { query } = require("../db");
const v = require("../lib/validate");
const { issueSession, clearSession, requireUser } = require("../middleware/auth");
const { loginLimiter, registerLimiter } = require("../middleware/security");

const router = express.Router();

// A valid bcrypt hash (same cost) so login takes the same time whether or not the account exists
const DUMMY_HASH = bcrypt.hashSync(require("crypto").randomBytes(16).toString("hex"), 12);

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  defaultAddress: u.default_address || "",
  pincode: u.pincode || "",
});

router.post("/register", registerLimiter, async (req, res) => {
  const name = v.str(req.body.name, "Name", { required: true, min: 2, max: 120 });
  const email = v.email(req.body.email);
  const phone = v.phone(req.body.phone);
  const password = String(req.body.password || "");
  if (password.length < 8 || password.length > 200) throw new v.ValidationError("Password must be at least 8 characters", "password");

  const existing = await query("SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1", [email, phone]);
  if (existing.length) return res.status(409).json({ error: "An account with this email or phone already exists. Please sign in." });

  const hash = await bcrypt.hash(password, 12);
  const result = await query("INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'customer')", [
    name,
    email,
    phone,
    hash,
  ]);
  const [user] = await query("SELECT * FROM users WHERE id = ?", [result.insertId]);
  issueSession(res, user);
  res.status(201).json({ user: publicUser(user) });
});

router.post("/login", loginLimiter, async (req, res) => {
  const identifier = v.clean(req.body.identifier ?? req.body.email, 190).toLowerCase();
  const password = String(req.body.password || "").slice(0, 200);
  if (!identifier || !password) return res.status(400).json({ error: "Enter your email or phone and password" });

  const digits = identifier.replace(/\D/g, "");
  const phone = digits.length >= 10 ? digits.slice(-10) : "";
  const rows = await query("SELECT * FROM users WHERE email = ? OR (phone = ? AND ? <> '') LIMIT 1", [identifier, phone, phone]);
  const user = rows[0];
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: "Incorrect email/phone or password" });

  if (req.body.adminOnly && user.role !== "admin") return res.status(403).json({ error: "This account does not have admin access" });
  issueSession(res, user);
  res.json({ user: publicUser(user) });
});

router.post("/logout", (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.get("/me", (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

router.post("/password", requireUser, loginLimiter, async (req, res) => {
  const current = String(req.body.currentPassword || "");
  const next = String(req.body.newPassword || "");
  if (next.length < 8 || next.length > 200) throw new v.ValidationError("New password must be at least 8 characters", "newPassword");
  const [row] = await query("SELECT password_hash FROM users WHERE id = ?", [req.user.id]);
  if (!row || !(await bcrypt.compare(current, row.password_hash))) return res.status(401).json({ error: "Current password is incorrect" });
  await query("UPDATE users SET password_hash = ? WHERE id = ?", [await bcrypt.hash(next, 12), req.user.id]);
  res.json({ ok: true });
});

module.exports = { router, publicUser };
