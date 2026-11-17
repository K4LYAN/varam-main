"use strict";

/**
 * Varam Organic Cold-Pressed Oils — store + admin panel
 * Node.js + Express + MySQL. Start with:  node server.js
 */

const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const compression = require("compression");

const config = require("./src/config");
const { connect, close } = require("./src/db");
const { migrate } = require("./src/migrate");
const { loadUser } = require("./src/middleware/auth");
const { securityHeaders, sameOrigin, apiLimiter } = require("./src/middleware/security");
const { ValidationError } = require("./src/lib/validate");

const app = express();
app.disable("x-powered-by");
if (config.trustProxy) app.set("trust proxy", 1); // cPanel / Passenger sits behind a proxy

app.use(securityHeaders);
app.use(compression());
app.use(express.json({ limit: "200kb" }));
app.use(cookieParser());

// Static assets (long cache for images/uploads, revalidate CSS/JS)
app.use(
  express.static(path.join(__dirname, "public"), {
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
    },
  }),
);

app.use(loadUser);

// APIs
const api = express.Router();
api.use(apiLimiter);
api.use(sameOrigin);
api.use("/auth", require("./src/routes/auth").router);
api.use("/", require("./src/routes/catalog").router);
api.use("/cart", require("./src/routes/cart").router);
api.use("/", require("./src/routes/checkout").router);
api.use("/account", require("./src/routes/account").router);
api.use("/admin", require("./src/routes/admin").router);
api.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use("/api", api);

// Pages
app.use("/", require("./src/routes/pages").router);
app.use((_req, res) => res.status(404).sendFile(path.join(__dirname, "views", "404.html")));

// Errors
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status = err instanceof ValidationError ? 400 : err.status || (err.type === "entity.parse.failed" ? 400 : 500);
  if (status >= 500) console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  const message = status >= 500 ? "Something went wrong. Please try again." : err.message;
  if (req.originalUrl.startsWith("/api")) return res.status(status).json({ error: message, field: err.field, details: err.details });
  res.status(status).type("text").send(message);
});

async function start() {
  await connect();
  await migrate();
  const server = app.listen(config.port, () => console.log(`[server] Varam store running on port ${config.port}`));
  const shutdown = () => {
    server.close(() => close().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

// cPanel's Node.js Selector (Phusion Passenger) loads this file through its own
// loader, so start unconditionally unless a script imports the app on purpose.
if (process.env.VARAM_NO_AUTOSTART !== "1") {
  start().catch((err) => {
    console.error("[server] failed to start:", err);
    process.exit(1);
  });
}

module.exports = { app, start };
