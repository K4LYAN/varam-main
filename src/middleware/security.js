"use strict";

const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const config = require("../config");

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
      "upgrade-insecure-requests": config.isProd ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
});

/**
 * CSRF defence for cookie-authenticated APIs: state-changing requests must
 * come from our own origin (Origin or Referer header must match the Host).
 */
function sameOrigin(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const source = req.get("origin") || req.get("referer");
  if (!source) return res.status(403).json({ error: "Missing origin" });
  try {
    const { host } = new URL(source);
    if (host !== req.get("host")) return res.status(403).json({ error: "Cross-site request blocked" });
  } catch {
    return res.status(403).json({ error: "Invalid origin" });
  }
  next();
}

const json429 = (_req, res) => res.status(429).json({ error: "Too many attempts. Please wait a few minutes and try again." });

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false, handler: json429 });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false, handler: json429 });
const orderLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false, handler: json429 });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: "draft-8", legacyHeaders: false, handler: json429 });

module.exports = { securityHeaders, sameOrigin, loginLimiter, registerLimiter, orderLimiter, apiLimiter };
