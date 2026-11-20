"use strict";

const jwt = require("jsonwebtoken");
const config = require("../config");
const authService = require("../services/authService");
const { unauthorized, forbidden } = require("../utils/httpError");

const COOKIE = "varam_session";
const cookieOptions = () => ({ httpOnly: true, sameSite: "lax", secure: config.isProd, path: "/" });

/** Sign a session for this user. `tv` (token version) lets a password change revoke every older session. */
function issueSession(res, user) {
  const token = jwt.sign({ sub: String(user.id), tv: Number(user.token_version || 0) }, config.jwtSecret, {
    algorithm: "HS256",
    expiresIn: `${config.sessionDays}d`,
    issuer: "varam",
  });
  res.cookie(COOKIE, token, { ...cookieOptions(), maxAge: config.sessionDays * 24 * 60 * 60 * 1000 });
}

function clearSession(res) {
  res.clearCookie(COOKIE, cookieOptions());
}

/**
 * Attach req.user when a valid session cookie is present. The role and token
 * version are always read from the database, never trusted from the token.
 */
async function loadUser(req, res, next) {
  req.user = null;
  const token = req.cookies?.[COOKIE];
  if (!token) return next();
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"], issuer: "varam" });
  } catch {
    clearSession(res);
    return next();
  }
  try {
    req.user = await authService.findSessionUser(Number(payload.sub), Number(payload.tv || 0));
    if (!req.user) clearSession(res);
    next();
  } catch (err) {
    next(err); // database trouble is a 500, not a silent sign-out
  }
}

const isApi = (req) => req.originalUrl.startsWith("/api");

function requireUser(req, res, next) {
  if (req.user) return next();
  if (isApi(req)) return next(unauthorized());
  res.redirect("/");
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === "admin") return next();
  if (isApi(req)) return next(req.user ? forbidden("Admin access required") : unauthorized("Admin access required"));
  res.redirect("/admin/login");
}

module.exports = { COOKIE, issueSession, clearSession, loadUser, requireUser, requireAdmin };
