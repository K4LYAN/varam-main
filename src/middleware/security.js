"use strict";

const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const config = require("../config");
const { forbidden } = require("../utils/httpError");

const securityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'"],
      "style-src": ["'self'", "https://fonts.googleapis.com"],
      // Inline style attributes only (e.g. progress-bar width); <style> blocks and scripts stay blocked
      "style-src-attr": ["'unsafe-inline'"],
      "font-src": ["'self'", "https://fonts.gstatic.com"],
      "img-src": ["'self'", "data:", "https:"],
      "frame-src": ["https://www.google.com", "https://maps.google.com"],
      "connect-src": ["'self'"],
      "form-action": ["'self'"],
      "frame-ancestors": ["'self'"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
      "upgrade-insecure-requests": config.isProd ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  strictTransportSecurity: config.isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
});

/**
 * First CSRF layer for cookie-authenticated APIs: state-changing requests must
 * come from our own origin (Origin or Referer host must match Host).
 */
function sameOrigin(req, _res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const source = req.get("origin") || req.get("referer");
  if (!source) return next(forbidden("Missing origin", "ORIGIN_MISSING"));
  let host;
  try {
    host = new URL(source).host;
  } catch {
    return next(forbidden("Invalid origin", "ORIGIN_INVALID"));
  }
  if (host !== req.get("host")) return next(forbidden("Cross-site request blocked", "ORIGIN_MISMATCH"));
  next();
}

const json429 = (_req, res) => res.status(429).json({ error: "Too many attempts. Please wait a few minutes and try again.", code: "RATE_LIMITED" });
const limiter = (windowMs, limit, extra = {}) => rateLimit({ windowMs, limit, standardHeaders: "draft-8", legacyHeaders: false, handler: json429, ...extra });

// Note: the default store is in-memory per process; with several Passenger workers each keeps its own count.
// Per IP; each account also locks itself after 5 wrong passwords (authService)
const loginLimiter = limiter(15 * 60 * 1000, 20, { skipSuccessfulRequests: true });
const passwordLimiter = limiter(15 * 60 * 1000, 10);
const orderLimiter = limiter(10 * 60 * 1000, 20);
const uploadLimiter = limiter(10 * 60 * 1000, 60);
const apiLimiter = limiter(60 * 1000, 300);

module.exports = { securityHeaders, sameOrigin, loginLimiter, passwordLimiter, orderLimiter, uploadLimiter, apiLimiter };
