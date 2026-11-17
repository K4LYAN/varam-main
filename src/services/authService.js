"use strict";

const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const config = require("../config");
const { query } = require("../db/pool");
const { conflict, unauthorized, forbidden } = require("../utils/httpError");

const SESSION_COLUMNS = "id, name, email, phone, role, default_address, pincode, token_version, must_change_password, is_active, created_at";

// A real bcrypt hash of a random string, so a login for an unknown account costs the same time as a real one.
let dummyHash = null;
const getDummyHash = () => (dummyHash ||= bcrypt.hash(crypto.randomBytes(16).toString("hex"), config.bcryptRounds));

/** Safe user shape for the browser. */
function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    defaultAddress: u.default_address || "",
    pincode: u.pincode || "",
    memberSince: u.created_at || null,
    mustChangePassword: Boolean(u.must_change_password),
  };
}

/** Load the user for a session; null if the account is gone, disabled, or the token was revoked. */
async function findSessionUser(id, tokenVersion) {
  if (!Number.isInteger(id) || id <= 0) return null;
  const [u] = await query(`SELECT ${SESSION_COLUMNS} FROM users WHERE id = ? LIMIT 1`, [id]);
  if (!u || !u.is_active || Number(u.token_version) !== Number(tokenVersion)) return null;
  return u;
}

async function findById(id) {
  const [u] = await query(`SELECT ${SESSION_COLUMNS} FROM users WHERE id = ? LIMIT 1`, [id]);
  return u || null;
}

async function register({ name, email, phone, password }) {
  const existing = await query("SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1", [email, phone]);
  if (existing.length) throw conflict("An account with this email or phone already exists. Please sign in.");
  const hash = await bcrypt.hash(password, config.bcryptRounds);
  let result;
  try {
    result = await query("INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'customer')", [name, email, phone, hash]);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") throw conflict("An account with this email or phone already exists. Please sign in.");
    throw err;
  }
  return findById(result.insertId);
}

/** Verify credentials by email or 10-digit phone. Constant-ish time whether or not the account exists. */
async function login({ identifier, password, adminOnly }) {
  const digits = identifier.replace(/\D/g, "");
  const phone = digits.length >= 10 ? digits.slice(-10) : "";
  const [user] = await query(
    `SELECT ${SESSION_COLUMNS}, password_hash FROM users WHERE email = ? OR (phone = ? AND ? <> '') LIMIT 1`,
    [identifier, phone, phone],
  );
  const ok = await bcrypt.compare(password, user ? user.password_hash : await getDummyHash());
  if (!user || !ok) throw unauthorized("Incorrect email/phone or password");
  // Checked only after the password, so a disabled account is not revealed to someone guessing
  if (!user.is_active) throw forbidden("This account has been disabled. Please contact the store on WhatsApp.", "ACCOUNT_DISABLED");
  if (adminOnly && user.role !== "admin") throw forbidden("This account does not have admin access");
  await query("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);
  delete user.password_hash;
  return user;
}

/**
 * Change password. Bumps token_version so every other signed-in device is
 * signed out; the caller re-issues a session for the current device.
 */
async function changePassword(userId, current, next) {
  const [row] = await query("SELECT password_hash FROM users WHERE id = ?", [userId]);
  if (!row || !(await bcrypt.compare(current, row.password_hash))) throw unauthorized("Current password is incorrect");
  const hash = await bcrypt.hash(next, config.bcryptRounds);
  await query("UPDATE users SET password_hash = ?, token_version = token_version + 1, must_change_password = 0 WHERE id = ?", [hash, userId]);
  return findById(userId);
}

module.exports = { publicUser, findSessionUser, findById, register, login, changePassword };
