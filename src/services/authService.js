"use strict";

const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const config = require("../config");
const { query } = require("../db/pool");
const { conflict, unauthorized, forbidden, HttpError } = require("../utils/httpError");

// After MAX_FAILED wrong passwords in a row the account is locked for LOCK_MINUTES,
// on top of the per-IP rate limit — so a slow attack from many IPs still stops.
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const lockedError = () =>
  new HttpError(429, `Too many wrong passwords. For your safety this account is locked for ${LOCK_MINUTES} minutes — or ask us to reset your password.`, {
    code: "ACCOUNT_LOCKED",
  });

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

/** Verify credentials by email or 10-digit phone. Constant-ish time whether or not the account exists. */
async function login({ identifier, password, adminOnly }) {
  const digits = identifier.replace(/\D/g, "");
  const phone = digits.length >= 10 ? digits.slice(-10) : "";
  const [user] = await query(
    `SELECT ${SESSION_COLUMNS}, password_hash, (locked_until IS NOT NULL AND locked_until > CURRENT_TIMESTAMP) AS is_locked
     FROM users WHERE email = ? OR (phone = ? AND ? <> '') LIMIT 1`,
    [identifier, phone, phone],
  );
  const ok = await bcrypt.compare(password, user ? user.password_hash : await getDummyHash());
  if (user && Number(user.is_locked)) throw lockedError(); // even a correct password waits out the lock
  if (!user || !ok) {
    if (user) {
      // MySQL applies SET assignments left to right, so the IF sees the incremented count
      await query(
        `UPDATE users SET failed_login_count = failed_login_count + 1,
           locked_until = IF(failed_login_count >= ?, CURRENT_TIMESTAMP + INTERVAL ? MINUTE, locked_until)
         WHERE id = ?`,
        [MAX_FAILED, LOCK_MINUTES, user.id],
      );
    }
    throw unauthorized("Incorrect email/phone or password");
  }
  // Checked only after the password, so a disabled account is not revealed to someone guessing
  if (!user.is_active) throw forbidden("This account has been disabled. Please contact the store on WhatsApp.", "ACCOUNT_DISABLED");
  if (adminOnly && user.role !== "admin") throw forbidden("This account does not have admin access");
  await query("UPDATE users SET last_login_at = CURRENT_TIMESTAMP, failed_login_count = 0, locked_until = NULL WHERE id = ?", [user.id]);
  delete user.password_hash;
  delete user.is_locked;
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

module.exports = { MAX_FAILED, LOCK_MINUTES, publicUser, findSessionUser, findById, login, changePassword };
