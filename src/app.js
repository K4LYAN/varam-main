"use strict";

/**
 * Builds the Express app (no network or database side effects here — see server.js).
 *
 * Request flow:
 *   security headers → compression → body/cookie parsing → static files →
 *   CSRF cookie → session (req.user) → /api (rate limit, origin + CSRF checks, routes) →
 *   pages → 404 → central error handler
 */
const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const compression = require("compression");

const config = require("./config");
const { securityHeaders } = require("./middleware/security");
const { issueCsrfToken } = require("./middleware/csrf");
const { loadUser } = require("./middleware/auth");
const { notFound, errorHandler } = require("./middleware/errorHandler");

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", 1); // cPanel / Passenger sits behind one proxy hop

  app.use(securityHeaders);
  app.use(compression());
  app.use(express.json({ limit: "200kb" }));
  app.use(cookieParser());

  // Static assets: long cache for images/fonts, revalidate CSS/JS
  app.use(
    express.static(path.join(config.root, "public"), {
      index: false,
      setHeaders(res, filePath) {
        if (/\.(jpg|jpeg|png|webp|svg|ico|woff2?)$/i.test(filePath)) res.setHeader("Cache-Control", "public, max-age=2592000");
        else res.setHeader("Cache-Control", "no-cache");
      },
    }),
  );

  // Product images uploaded from the admin panel (UPLOAD_DIR can live outside the app folder)
  app.use(
    "/uploads",
    express.static(config.uploadDir, {
      index: false,
      maxAge: "30d",
      setHeaders(res) {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'none'; sandbox");
      },
    }),
  );

  app.use(issueCsrfToken);
  app.use(loadUser);

  app.use("/api", require("./routes/api"));
  app.use("/", require("./routes/pages"));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
