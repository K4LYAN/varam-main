"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");

// Settings file. Hosts like MilesWeb mPanel deploy each commit into a fresh
// <app>/deploys/<commit>/ folder, so a .env inside the code would be lost on every
// deploy. The first file found wins; real environment variables always take priority.
const ENV_FILES = [
  process.env.VARAM_ENV_FILE,
  path.join(ROOT, ".env"),
  path.join(ROOT, "..", "..", ".env"), // <app>/.env, next to the deploys/ folder
  path.join(require("os").homedir(), "varam.env"), // ~/varam.env
].filter(Boolean);
const envFile = ENV_FILES.find((f) => fs.existsSync(f));
if (envFile) require("dotenv").config({ path: envFile, quiet: true });
const env = process.env;
const isProd = env.NODE_ENV === "production";

// Local development: use the throwaway MySQL started by `npm run dev:db` when no DB is configured
if (!isProd && !env.DB_HOST && !env.DB_SOCKET) {
  try {
    const dev = JSON.parse(fs.readFileSync(path.join(ROOT, ".dev-db.json"), "utf8"));
    env.DB_HOST = dev.host;
    env.DB_PORT = String(dev.port);
    env.DB_USER = env.DB_USER || dev.user;
    env.DB_PASSWORD = env.DB_PASSWORD ?? dev.password;
    env.DB_NAME = env.DB_NAME || dev.database;
  } catch {
    /* no dev database running */
  }
}

// Setup problems are collected instead of thrown, so the server can still start and
// show the owner exactly what is missing (names only, never values) instead of crash-looping.
const problems = [];

function required(name, fallback) {
  const v = env[name] ?? fallback;
  if (v === undefined || v === "") {
    problems.push(`${name} is not set`);
    return "";
  }
  return v;
}

function intEnv(name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    problems.push(`${name} must be a whole number between ${min} and ${max}`);
    return fallback;
  }
  return n;
}

const jwtSecret = env.JWT_SECRET || (isProd ? "" : "dev-only-insecure-secret-change-me-0123456789");
if (!jwtSecret || jwtSecret.length < 32) {
  problems.push("JWT_SECRET must be set to a random string of at least 32 characters");
}

const connectionLimit = intEnv("DB_POOL_SIZE", 10, { min: 1, max: 50 });

module.exports = Object.freeze({
  isProd,
  problems,
  envFile: envFile || null,
  isVercel: Boolean(env.VERCEL),
  root: ROOT,
  port: intEnv("PORT", 3000, { min: 1, max: 65535 }),
  siteUrl: (env.SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  trustProxy: env.TRUST_PROXY !== "false",
  jwtSecret,
  sessionDays: intEnv("SESSION_DAYS", 14, { min: 1, max: 90 }),
  bcryptRounds: intEnv("BCRYPT_ROUNDS", 12, { min: 10, max: 14 }),
  shutdownTimeoutMs: intEnv("SHUTDOWN_TIMEOUT_MS", 10000, { min: 1000, max: 60000 }),
  db: Object.freeze({
    socket: env.DB_SOCKET || "",
    host: env.DB_HOST || "127.0.0.1",
    port: intEnv("DB_PORT", 3306, { min: 1, max: 65535 }),
    user: required("DB_USER", isProd ? undefined : "root"),
    password: env.DB_PASSWORD ?? "",
    database: required("DB_NAME", isProd ? undefined : "varam"),
    // Shared hosting: a small, bounded pool. queueLimit makes overload fail fast instead of growing memory.
    connectionLimit,
    maxIdle: intEnv("DB_POOL_MAX_IDLE", Math.min(3, connectionLimit), { min: 0, max: connectionLimit }),
    queueLimit: intEnv("DB_QUEUE_LIMIT", 100, { min: 0, max: 10000 }),
    connectTimeout: intEnv("DB_CONNECT_TIMEOUT_MS", 10000, { min: 1000, max: 60000 }),
  }),
  admin: Object.freeze({
    email: (env.ADMIN_EMAIL || "").trim().toLowerCase(),
    password: env.ADMIN_PASSWORD || "",
    name: env.ADMIN_NAME || "Varam Admin",
  }),
  // Vercel's file system is read-only except /tmp (and /tmp is wiped between instances)
  uploadDir: env.UPLOAD_DIR || (env.VERCEL ? "/tmp/varam-uploads" : path.join(ROOT, "public", "uploads")),
  maxUploadBytes: 3 * 1024 * 1024,
  // In-process caches (each Passenger worker has its own; keep TTLs short)
  catalogCacheMs: intEnv("CATALOG_CACHE_MS", 10000, { min: 0, max: 300000 }),
  settingsCacheMs: intEnv("SETTINGS_CACHE_MS", 15000, { min: 0, max: 300000 }),
});
