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
 * Connect to MySQL. On MilesWeb the Unix socket is tried first
 * (DB_SOCKET=/run/mysqld/mysqld.sock), falling back to TCP (DB_HOST/DB_PORT).
 */
async function connect() {
  if (pool) return pool;
  if (config.db.socket && fs.existsSync(config.db.socket)) {
    try {
      pool = await tryPool({ socketPath: config.db.socket }, `socket ${config.db.socket}`);
      return pool;
    } catch (err) {
      console.warn(`[db] socket connection failed (${err.code || err.message}); falling back to TCP`);
    }
  } else if (config.db.socket) {
    console.warn(`[db] socket ${config.db.socket} not found; using TCP`);
  }
  const tcp = { host: config.db.host, port: config.db.port };
  if (config.db.ssl) tcp.ssl = { rejectUnauthorized: config.db.sslVerify, minVersion: "TLSv1.2" };
  pool = await tryPool(tcp, `TCP ${config.db.host}:${config.db.port}${config.db.ssl ? " (TLS)" : ""}`);
  return pool;
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
