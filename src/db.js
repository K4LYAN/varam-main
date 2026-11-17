"use strict";

const fs = require("fs");
const mysql = require("mysql2/promise");
const config = require("./config");

let pool = null;

const common = {
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  maxIdle: config.db.connectionLimit,
  idleTimeout: 60000,
  enableKeepAlive: true,
  charset: "utf8mb4",
  timezone: "+05:30",
  decimalNumbers: true,
  dateStrings: false,
};

async function tryPool(options, label) {
  const p = mysql.createPool({ ...common, ...options });
  try {
    await p.query("SELECT 1");
    console.log(`[db] connected via ${label}`);
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
  pool = await tryPool({ host: config.db.host, port: config.db.port }, `TCP ${config.db.host}:${config.db.port}`);
  return pool;
}

function db() {
  if (!pool) throw new Error("Database not connected yet");
  return pool;
}

/** Run a parameterised query and return rows. */
async function query(sql, params = []) {
  const [rows] = await db().execute(sql, params);
  return rows;
}

/** Same as query() but uses client-side formatting (needed for IN (?) lists). */
async function queryRaw(sql, params = []) {
  const [rows] = await db().query(sql, params);
  return rows;
}

/** Run fn(conn) inside a transaction; commits on success, rolls back on error. */
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

async function close() {
  if (pool) await pool.end();
  pool = null;
}

module.exports = { connect, db, query, queryRaw, transaction, close };
