"use strict";

const fs = require("fs");
const mysql = require("mysql2/promise");
const config = require("../config");

let pool = null;
let transport = null; // "socket /run/mysqld/mysqld.sock" | "TCP host:port"

function baseOptions() {
  return {
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: true,
    connectionLimit: config.db.connectionLimit,
    maxIdle: config.db.maxIdle,
    idleTimeout: 60000,
    queueLimit: config.db.queueLimit,
    connectTimeout: config.db.connectTimeout,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    // mysql2 caches prepared statements per connection (default 16000); cap it to keep RAM low
    maxPreparedStatements: 256,
    multipleStatements: false,
    charset: "utf8mb4",
    timezone: "+05:30",
    decimalNumbers: true,
    dateStrings: false,
  };
}

async function tryPool(options, label) {
  const p = mysql.createPool({ ...baseOptions(), ...options });
  // `timezone` above only affects how JS Dates are converted. Also pin the MySQL session to IST so
  // NOW()/CURDATE() and TIMESTAMP columns agree with it whatever the server's own time zone is.
  p.pool.on("connection", (conn) => conn.query("SET time_zone = '+05:30'"));
  try {
    await p.query("SELECT 1");
    console.log(`[db] connected via ${label}`);
    transport = label;
    return p;
  } catch (err) {
    await p.end().catch(() => {});
    throw err;
  }
}

/**
 * Every route to try, in order. "localhost" is ambiguous: MariaDB treats a socket login as
 * user@localhost, and Node may resolve the name to IPv6 ::1 — neither matches a user that
 * is only allowed from 127.0.0.1 (MilesWeb's default). So localhost is tried as 127.0.0.1,
 * and DB_HOST may list several hosts separated by commas (e.g. "127.0.0.1,10.169.9.188").
 */
function routes() {
  const list = [];
  if (config.db.socket) list.push({ via: `socket ${config.db.socket}`, options: { socketPath: config.db.socket }, missing: !fs.existsSync(config.db.socket) });
  const hosts = String(config.db.host || "127.0.0.1")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean)
    .map((h) => (h.toLowerCase() === "localhost" ? "127.0.0.1" : h));
  for (const host of [...new Set(hosts)]) {
    const options = { host, port: config.db.port };
    if (config.db.ssl) options.ssl = { rejectUnauthorized: config.db.sslVerify, minVersion: "TLSv1.2" };
    list.push({ via: `TCP ${host}:${config.db.port}${config.db.ssl ? " (TLS)" : ""}`, options });
  }
  return list;
}

/**
 * Connect to MySQL, trying each route until one works. If all fail, the error carries
 * `attempts` (route + error code for each) so the log shows exactly what was refused.
 */
async function connect() {
  if (pool) return pool;
  const attempts = [];
  let lastErr = null;
  for (const r of routes()) {
    if (r.missing) {
      attempts.push({ via: r.via, code: "NOT_FOUND" });
      continue;
    }
    try {
      pool = await tryPool(r.options, r.via);
      return pool;
    } catch (err) {
      lastErr = err;
      // MariaDB's own message names the user@host it saw (e.g. 'varams_i1_varam'@'10.169.9.189'),
      // which is exactly the host that has to be allowed in the panel. No secrets are in it.
      const seen = (err.sqlMessage || "").match(/for user '[^']*'@'[^']*'/);
      attempts.push({ via: r.via, code: err.code || err.message, seen: seen ? seen[0].slice(9) : "" });
      console.warn(`[db] ${r.via} as ${config.db.user || "(no user)"} → ${err.code || err.message}${seen ? ` (server saw ${seen[0].slice(9)})` : ""}`);
    }
  }
  const err = lastErr || new Error("No database route configured (set DB_HOST or DB_SOCKET)");
  err.attempts = attempts;
  throw err;
}

function db() {
  if (!pool) throw new Error("Database not connected yet");
  return pool;
}

/** Parameterised query (server-side prepared statement). Pass a transaction connection as `conn` to join it. */
async function query(sql, params = [], conn) {
  const [rows] = await (conn || db()).execute(sql, params);
  return rows;
}

/** Client-side escaped query — needed for `IN (?)` lists and multi-row `VALUES ?`. */
async function queryRaw(sql, params = [], conn) {
  const [rows] = await (conn || db()).query(sql, params);
  return rows;
}

/** Run fn(conn) inside a transaction; commits on success, rolls back on any error. */
async function transaction(fn) {
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

/** Health probe: round-trip time of SELECT 1, bounded by a timeout. */
async function ping(timeoutMs = 3000) {
  const started = process.hrtime.bigint();
  let timer;
  try {
    await Promise.race([
      db().query("SELECT 1"),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("database ping timed out")), timeoutMs);
      }),
    ]);
    return { ok: true, transport, latencyMs: Number((process.hrtime.bigint() - started) / 1000000n) };
  } catch (err) {
    return { ok: false, transport, error: err.code || err.message };
  } finally {
    clearTimeout(timer);
  }
}

async function close() {
  const p = pool;
  pool = null;
  if (p) await p.end();
}

module.exports = { connect, db, query, queryRaw, transaction, ping, close };
