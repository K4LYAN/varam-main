"use strict";

require("dotenv").config({ quiet: true });

const isProd = process.env.NODE_ENV === "production";

// Local development: use the throwaway MySQL started by `npm run dev:db` when no DB is configured
if (!isProd && !process.env.DB_HOST && !process.env.DB_SOCKET) {
  try {
    const dev = JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "..", ".dev-db.json"), "utf8"));
    process.env.DB_HOST = dev.host;
    process.env.DB_PORT = String(dev.port);
    process.env.DB_USER = process.env.DB_USER || dev.user;
    process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? dev.password;
    process.env.DB_NAME = process.env.DB_NAME || dev.database;
  } catch {
    /* no dev database running */
  }
}

function required(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") throw new Error(`Missing required environment variable ${name}`);
  return v;
}

const jwtSecret = process.env.JWT_SECRET || (isProd ? "" : "dev-only-insecure-secret-change-me-0123456789");
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be set to a random string of at least 32 characters.");
}

module.exports = {
  isProd,
  port: Number(process.env.PORT || 3000),
  siteUrl: (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  trustProxy: process.env.TRUST_PROXY !== "false",
  jwtSecret,
  sessionDays: Number(process.env.SESSION_DAYS || 14),
  db: {
    socket: process.env.DB_SOCKET || "",
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: required("DB_USER", isProd ? undefined : "root"),
    password: process.env.DB_PASSWORD ?? "",
    database: required("DB_NAME", isProd ? undefined : "varam"),
    connectionLimit: Number(process.env.DB_POOL_SIZE || 5),
  },
  admin: {
    email: (process.env.ADMIN_EMAIL || "").trim().toLowerCase(),
    password: process.env.ADMIN_PASSWORD || "",
    name: process.env.ADMIN_NAME || "Varam Admin",
  },
  uploadDir: process.env.UPLOAD_DIR || require("path").join(__dirname, "..", "public", "uploads"),
  maxUploadBytes: 3 * 1024 * 1024,
};
