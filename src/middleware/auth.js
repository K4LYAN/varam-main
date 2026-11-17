"use strict";

const jwt = require("jsonwebtoken");
const config = require("../config");
const { query } = require("../db");

const COOKIE = "varam_session";

function issueSession(res, user) {
  const token = jwt.sign({ sub: String(user.id), role: user.role }, config.jwtSecret, {
    algorithm: "HS256",
    expiresIn: `${config.sessionDays}d`,
    issuer: "varam",
  });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProd,
    path: "/",
    maxAge: config.sessionDays * 24 * 60 * 60 * 1000,
  });
}

function clearSession(res) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: "lax", secure: config.isProd, path: "/" });
}

/** Attaches req.user (id, name, email, phone, role, …) when a valid session cookie is present. */
async function loadUser(req, _res, next) {
  req.user = null;
  const token = req.cookies?.[COOKIE];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"], issuer: "varam" });
    const rows = await query(
      "SELECT id, name, email, phone, role, default_address, pincode, created_at FROM users WHERE id = ? LIMIT 1",
      [Number(payload.sub)],
    );
    // Role is always read from the database, never trusted from the token alone
    if (rows[0]) req.user = rows[0];
  } catch {
    req.user = null;
  }
  next();
}

function requireUser(req, res, next) {
  if (!req.user) {
    if (req.path.startsWith("/api") || req.originalUrl.startsWith("/api")) return res.status(401).json({ error: "Please sign in" });
    return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    if (req.originalUrl.startsWith("/api")) return res.status(req.user ? 403 : 401).json({ error: "Admin access required" });
    return res.redirect("/admin/login");
  }
  next();
}

module.exports = { COOKIE, issueSession, clearSession, loadUser, requireUser, requireAdmin };
