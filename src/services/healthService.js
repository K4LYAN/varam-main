"use strict";

const { ping } = require("../db/pool");

const startedAt = Date.now();

/**
 * Liveness + readiness: process uptime and a timed MySQL round trip over
 * whichever transport is in use (Unix socket or TCP fallback).
 */
async function check() {
  const db = await ping();
  return {
    status: db.ok ? "ok" : "degraded",
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    database: db.ok ? { ok: true, transport: db.transport, latencyMs: db.latencyMs } : { ok: false, transport: db.transport, error: db.error },
    memoryMb: Math.round(process.memoryUsage().rss / 1048576),
    timestamp: new Date().toISOString(),
  };
}

module.exports = { check };
