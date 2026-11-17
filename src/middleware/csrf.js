"use strict";

/**
 * CSRF protection (double-submit cookie).
 *
 * Every page response carries a random `varam_csrf` cookie (readable by our
 * own JavaScript, SameSite=Strict). State-changing API calls must echo it in
 * the `X-CSRF-Token` header. Another site can make the browser send the
 * cookie, but cannot read it to fill the header. This runs in addition to the
 * Origin/Referer check in security.js.
 */
const crypto = require("crypto");
const config = require("../config");
const { forbidden } = require("../utils/httpError");

const COOKIE = "varam_csrf";
const HEADER = "x-csrf-token";
const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);
const VALID = /^[A-Za-z0-9_-]{32,64}$/;

/** Make sure the browser has a token; exposes it as req.csrfToken. */
function issueCsrfToken(req, res, next) {
  let token = req.cookies?.[COOKIE];
  if (!token || !VALID.test(token)) {
    token = crypto.randomBytes(24).toString("base64url");
    res.cookie(COOKIE, token, {
      httpOnly: false, // the page's own script reads it to fill X-CSRF-Token
      sameSite: "strict",
      secure: config.isProd,
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
  req.csrfToken = token;
  next();
}

function verifyCsrfToken(req, _res, next) {
  if (SAFE.has(req.method)) return next();
  const cookie = req.cookies?.[COOKIE];
  const header = req.get(HEADER);
  const ok =
    typeof cookie === "string" &&
    typeof header === "string" &&
    VALID.test(cookie) &&
    cookie.length === header.length &&
    crypto.timingSafeEqual(Buffer.from(cookie), Buffer.from(header));
  if (!ok) return next(forbidden("Your session expired. Please refresh the page and try again.", "CSRF_INVALID"));
  next();
}

module.exports = { COOKIE, HEADER, issueCsrfToken, verifyCsrfToken };
