"use strict";

/**
 * Admin audit trail: who changed what, when, from where — with before/after
 * values for prices, stock, coupons, settings and order statuses.
 */
const { query, queryRaw } = require("../db/pool");

const MAX_JSON = 20000;

function toJson(v) {
  if (v === undefined || v === null) return null;
  const s = JSON.stringify(v);
  return s.length > MAX_JSON ? s.slice(0, MAX_JSON) : s;
}

/** Only the keys whose values actually changed (keeps the log readable). */
function diff(before, after) {
  if (!before || !after) return { before, after };
  const b = {};
  const a = {};
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (String(before[k] ?? "") !== String(after[k] ?? "")) {
      b[k] = before[k] ?? null;
      a[k] = after[k] ?? null;
    }
  }
  return { before: b, after: a };
}

/**
 * Record one admin action. Pass the transaction connection so the log entry
 * commits (or rolls back) together with the change itself.
 * ctx = { adminId, adminEmail, ip }
 */
async function record(conn, ctx, { action, entityType, entityId = null, summary = "", before = null, after = null }) {
  await query(
    `INSERT INTO admin_audit_logs (admin_id, admin_email, action, entity_type, entity_id, summary, before_json, after_json, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ctx.adminId ?? null,
      String(ctx.adminEmail || "").slice(0, 190),
      action,
      entityType,
      entityId,
      String(summary).slice(0, 255),
      toJson(before),
      toJson(after),
      ctx.ip ? String(ctx.ip).slice(0, 45) : null,
    ],
    conn,
  );
}

const parse = (s) => {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

async function list({ limit = 50, entityType = "" } = {}) {
  const lim = Math.max(1, Math.min(200, Number(limit) || 50));
  const rows = await queryRaw(
    `SELECT id, admin_email, action, entity_type, entity_id, summary, before_json, after_json, ip_address, created_at
     FROM admin_audit_logs ${entityType ? "WHERE entity_type = ?" : ""} ORDER BY id DESC LIMIT ${lim}`,
    entityType ? [entityType] : [],
  );
  return rows.map((r) => ({
    id: r.id,
    adminEmail: r.admin_email,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    summary: r.summary,
    before: parse(r.before_json),
    after: parse(r.after_json),
    ip: r.ip_address,
    createdAt: r.created_at,
  }));
}

/** Build the audit context from an authenticated admin request. */
const contextFrom = (req) => ({ adminId: req.user?.id ?? null, adminEmail: req.user?.email || "", ip: req.ip });

module.exports = { record, list, diff, contextFrom };
