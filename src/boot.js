"use strict";

/**
 * Brings the store up: check settings → connect MySQL → migrate.
 * Used by server.js (MilesWeb / cPanel / PM2) and api/index.js (Vercel).
 *
 * If something is wrong (missing environment variable, database unreachable) the
 * process does NOT crash. Requests get a plain "setup needed" page that names the
 * problem (never any secret values) and the database connection is retried, so the
 * host stops crash-looping and the owner can see what to fix.
 */
const config = require("./config");
const { connect, close } = require("./db/pool");
const { migrate } = require("./db/migrate");
const { createApp } = require("./app");

const RETRY_MS = 15000;

let app = null;
let ready = false;
let lastError = null;
let pending = null;
let retryTimer = null;
let lastFailAt = 0;

function describe(err) {
  if (!err) return "";
  const code = err.code ? `${err.code}: ` : "";
  const hints = {
    ECONNREFUSED: "MySQL is not reachable at DB_HOST / DB_PORT (or DB_SOCKET).",
    ENOTFOUND: "DB_HOST is not a valid host name.",
    ETIMEDOUT: "MySQL did not answer in time. On remote hosts (e.g. Vercel) the database must allow remote connections.",
    ER_ACCESS_DENIED_ERROR: "DB_USER / DB_PASSWORD are wrong, or the user has no access from this server.",
    ER_BAD_DB_ERROR: "DB_NAME does not exist. Create it in your hosting panel first.",
    ER_DBACCESS_DENIED_ERROR: "DB_USER has not been given access to DB_NAME.",
  };
  const db = config.db;
  const who = ` [user ${db.user || "(not set)"}, database ${db.database || "(not set)"}]`;
  const tried = err.attempts && err.attempts.length ? ` Tried: ${err.attempts.map((a) => `${a.via} → ${a.code}${a.seen ? ` as ${a.seen}` : ""}`).join("; ")}.` : "";
  const extra =
    err.code === "ER_ACCESS_DENIED_ERROR"
      ? " MariaDB checks user@host: a socket login is user@localhost and TCP to 127.0.0.1 is user@127.0.0.1 — allow that host for this user in the panel, and check the user name has no typo."
      : "";
  return `${code}${hints[err.code] || err.message}${who}${tried}${extra}`;
}

async function attempt() {
  if (config.problems.length) {
    lastError = new Error(config.problems.join("; "));
    lastFailAt = Date.now();
    throw lastError;
  }
  try {
    await connect();
    await migrate();
    if (!app) app = createApp();
    ready = true;
    lastError = null;
    return app;
  } catch (err) {
    lastError = err;
    lastFailAt = Date.now();
    await close().catch(() => {});
    throw err;
  }
}

/** Start (or join) a boot attempt. Resolves with the Express app once ready. */
function init({ retry = true } = {}) {
  if (ready) return Promise.resolve(app);
  if (pending) return pending;
  pending = attempt()
    .catch((err) => {
      console.error(`[boot] store not ready — ${describe(err)}`);
      if (retry && !config.problems.length && !retryTimer) {
        retryTimer = setTimeout(() => {
          retryTimer = null;
          init({ retry }).catch(() => {});
        }, RETRY_MS);
        retryTimer.unref?.();
      }
      throw err;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Minimal page shown while the store cannot start. Only setting names and error codes, never values. */
function setupPage(req, res) {
  const items = config.problems.length ? config.problems : [describe(lastError) || "Starting up — please refresh in a few seconds."];
  const wantsJson = (req.headers.accept || "").includes("application/json") || (req.url || "").startsWith("/api/");
  res.statusCode = 503;
  res.setHeader("Retry-After", "15");
  res.setHeader("Cache-Control", "no-store");
  if (wantsJson) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "The store is not ready yet.", code: "NOT_READY", problems: items }));
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Varam — setting up</title>
<style>body{font:16px/1.6 system-ui,sans-serif;background:#fbf5e8;color:#2b1a0e;margin:0;padding:40px 16px}main{max-width:620px;margin:auto;background:#fff;border:1px solid #e8dcc3;border-radius:16px;padding:28px}h1{margin:0 0 8px;color:#8a2a1a;font-size:24px}li{margin:6px 0}code{background:#f5ecd8;padding:2px 6px;border-radius:6px}small{color:#7a6a55}</style></head>
<body><main><h1>The store is not ready yet</h1><p>The server is running, but it can't open the shop because:</p>
<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
<p>Fix this in your hosting panel's <b>environment variables</b> (see <code>.env.example</code>), then restart the app.</p>
<small>This page refreshes itself every 15 seconds.</small><script>setTimeout(()=>location.reload(),15000)</script></main></body></html>`);
}

/** Node request handler: the store when ready, otherwise the setup page (and another boot attempt). */
async function handle(req, res) {
  if (ready) return app(req, res);
  // Don't let visitor traffic hammer a broken database: at most one extra attempt every 5s
  if (lastError && !pending && Date.now() - lastFailAt < 5000) return setupPage(req, res);
  try {
    const a = await init();
    return a(req, res);
  } catch {
    return setupPage(req, res);
  }
}

module.exports = { init, handle, isReady: () => ready, describe };
