"use strict";

/**
 * Admin user management: list, view, create, edit, change role, enable or
 * disable, reset password, sign out everywhere, delete.
 *
 * Safety rules, enforced here (not just in the UI):
 *  - an admin cannot change their own role or status, reset their own password
 *    here, or delete themselves;
 *  - the store can never be left without an active admin (checked under a row
 *    lock, so two admins demoting each other at once cannot both succeed);
 *  - disabling, resetting a password or "sign out everywhere" bumps
 *    token_version, which ends that user's existing sessions immediately.
 * Every change is written to admin_audit_logs in the same transaction.
 */
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const config = require("../config");
const { query, queryRaw, transaction } = require("../db/pool");
const auditService = require("./auditService");
const { badRequest, notFound, conflict, forbidden } = require("../utils/httpError");

const PER_PAGE = 25;
const ROLES = ["customer", "admin"];

/** Readable random password, e.g. "k7mq-4tzr-9hxa" (60 bits). */
function generatePassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const group = () => Array.from({ length: 4 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
  const chars = `${group()}${group()}${group()}`.split("");
  // Guarantee at least one letter and one digit so it meets the password rules
  chars[crypto.randomInt(12)] = "23456789"[crypto.randomInt(8)];
  if (!chars.some((c) => /[a-z]/.test(c))) chars[0] = "k";
  const s = chars.join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

const snapshot = (u) => ({
  name: u.name,
  email: u.email,
  phone: u.phone || null,
  role: u.role,
  isActive: Boolean(u.is_active),
});

function shapeUser(u, stats = {}) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone || "",
    role: u.role,
    isActive: Boolean(u.is_active),
    mustChangePassword: Boolean(u.must_change_password),
    lockedUntil: u.locked_until && new Date(u.locked_until) > new Date() ? u.locked_until : null,
    joinedAt: u.created_at,
    lastLoginAt: u.last_login_at,
    orders: Number(stats.orders || 0),
    spent: Number(stats.spent || 0),
    lastOrderAt: stats.last_order || null,
  };
}

const likeOf = (q) => `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;

/* ------------------------------------------------------------------ */
/* Read                                                                */
/* ------------------------------------------------------------------ */

async function list({ q = "", role = "", status = "", page = 1 }) {
  const where = ["1=1"];
  const params = [];
  if (ROLES.includes(role)) {
    where.push("u.role = ?");
    params.push(role);
  }
  if (status === "active" || status === "disabled") {
    where.push("u.is_active = ?");
    params.push(status === "active" ? 1 : 0);
  }
  if (q) {
    where.push("(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)");
    const like = likeOf(q);
    params.push(like, like, like);
  }
  const w = where.join(" AND ");
  const offset = (page - 1) * PER_PAGE;

  const [[{ n }], users, [summary]] = await Promise.all([
    queryRaw(`SELECT COUNT(*) AS n FROM users u WHERE ${w}`, params),
    queryRaw(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.is_active, u.must_change_password, u.locked_until, u.created_at, u.last_login_at
       FROM users u WHERE ${w} ORDER BY u.role = 'admin' DESC, u.id DESC LIMIT ${PER_PAGE} OFFSET ${offset}`,
      params,
    ),
    query(
      `SELECT COUNT(*) AS total, COALESCE(SUM(role = 'admin'), 0) AS admins, COALESCE(SUM(role = 'customer'), 0) AS customers,
              COALESCE(SUM(is_active = 0), 0) AS disabled
       FROM users`,
    ),
  ]);

  // Order stats for this page only — one grouped query, not one per user
  const stats = new Map();
  if (users.length) {
    const rows = await queryRaw(
      `SELECT user_id, COUNT(*) AS orders, COALESCE(SUM(CASE WHEN status <> 'Cancelled' THEN total_amount END), 0) AS spent,
              MAX(created_at) AS last_order
       FROM orders WHERE user_id IN (?) GROUP BY user_id`,
      [users.map((u) => u.id)],
    );
    for (const r of rows) stats.set(r.user_id, r);
  }

  return {
    total: Number(n),
    page,
    pages: Math.max(1, Math.ceil(Number(n) / PER_PAGE)),
    summary: {
      total: Number(summary.total),
      admins: Number(summary.admins),
      customers: Number(summary.customers),
      disabled: Number(summary.disabled),
    },
    users: users.map((u) => shapeUser(u, stats.get(u.id))),
  };
}

async function detail(id) {
  const [u] = await query(
    "SELECT id, name, email, phone, role, is_active, must_change_password, locked_until, created_at, last_login_at, default_address, pincode FROM users WHERE id = ?",
    [id],
  );
  if (!u) throw notFound("User not found");
  const [[stats], [addr], [wish], recent] = await Promise.all([
    query(
      `SELECT COUNT(*) AS orders, COALESCE(SUM(CASE WHEN status <> 'Cancelled' THEN total_amount END), 0) AS spent, MAX(created_at) AS last_order
       FROM orders WHERE user_id = ?`,
      [id],
    ),
    query("SELECT COUNT(*) AS n FROM addresses WHERE user_id = ?", [id]),
    query("SELECT COUNT(*) AS n FROM wishlist_items WHERE user_id = ?", [id]),
    query("SELECT order_number, status, total_amount, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 5", [id]),
  ]);
  return {
    ...shapeUser(u, stats),
    defaultAddress: u.default_address || "",
    pincode: u.pincode || "",
    addressCount: Number(addr.n),
    wishlistCount: Number(wish.n),
    recentOrders: recent.map((o) => ({ orderNumber: o.order_number, status: o.status, totalAmount: Number(o.total_amount), createdAt: o.created_at })),
  };
}

/* ------------------------------------------------------------------ */
/* Guards                                                              */
/* ------------------------------------------------------------------ */

function notSelf(ctx, id, what) {
  if (ctx.adminId === id) throw forbidden(`You can't ${what} your own account here.`, "SELF_ACTION");
}

/** Lock the target row; returns it or throws 404. */
async function lockUser(conn, id) {
  const [u] = await query("SELECT * FROM users WHERE id = ? FOR UPDATE", [id], conn);
  if (!u) throw notFound("User not found");
  return u;
}

/** Make sure at least one other active admin remains if `target` stops being one. */
async function keepAnAdmin(conn, target) {
  if (target.role !== "admin" || !target.is_active) return;
  const others = await query("SELECT id FROM users WHERE role = 'admin' AND is_active = 1 AND id <> ? FOR UPDATE", [target.id], conn);
  if (!others.length) throw badRequest("The store needs at least one active admin. Make someone else an admin first.");
}

async function assertUnique(conn, { email, phone }, exceptId = 0) {
  const rows = await query(
    "SELECT email, phone FROM users WHERE (email = ? OR (phone = ? AND ? IS NOT NULL)) AND id <> ? LIMIT 1",
    [email, phone, phone, exceptId],
    conn,
  );
  if (!rows.length) return;
  throw conflict(rows[0].email === email ? "Another account already uses this email" : "Another account already uses this phone number");
}

/* ------------------------------------------------------------------ */
/* Write                                                               */
/* ------------------------------------------------------------------ */

/**
 * Create a customer or admin. Without a password a readable one is generated
 * and returned once. Either way the user must choose their own at next sign-in.
 */
async function create(ctx, input) {
  const temporaryPassword = input.password || generatePassword();
  const hash = await bcrypt.hash(temporaryPassword, config.bcryptRounds);
  try {
    const id = await transaction(async (conn) => {
      await assertUnique(conn, input);
      const r = await query(
        "INSERT INTO users (name, email, phone, password_hash, role, must_change_password) VALUES (?, ?, ?, ?, ?, 1)",
        [input.name, input.email, input.phone, hash, input.role],
        conn,
      );
      await auditService.record(conn, ctx, {
        action: "user.create",
        entityType: "user",
        entityId: r.insertId,
        summary: `${input.email} (${input.role})`,
        after: { name: input.name, email: input.email, phone: input.phone, role: input.role },
      });
      return r.insertId;
    });
    return { user: await detail(id), temporaryPassword: input.password ? null : temporaryPassword };
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") throw conflict("Another account already uses this email");
    throw err;
  }
}

async function update(ctx, id, input) {
  try {
    await transaction(async (conn) => {
      const before = await lockUser(conn, id);
      await assertUnique(conn, input, id);
      await query("UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?", [input.name, input.email, input.phone, id], conn);
      const d = auditService.diff(snapshot(before), { ...snapshot(before), name: input.name, email: input.email, phone: input.phone });
      if (Object.keys(d.after).length) await auditService.record(conn, ctx, { action: "user.update", entityType: "user", entityId: id, summary: input.email, ...d });
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") throw conflict("Another account already uses this email");
    throw err;
  }
  return detail(id);
}

async function setRole(ctx, id, role) {
  notSelf(ctx, id, "change the role of");
  if (!ROLES.includes(role)) throw badRequest("Role is invalid");
  await transaction(async (conn) => {
    const u = await lockUser(conn, id);
    if (u.role === role) return;
    if (role !== "admin") await keepAnAdmin(conn, u);
    // Bump token_version so an admin who is demoted loses any open admin tab right away
    await query("UPDATE users SET role = ?, token_version = token_version + 1 WHERE id = ?", [role, id], conn);
    await auditService.record(conn, ctx, { action: "user.role", entityType: "user", entityId: id, summary: `${u.email}: ${u.role} → ${role}`, before: { role: u.role }, after: { role } });
  });
  return detail(id);
}

async function setStatus(ctx, id, isActive) {
  notSelf(ctx, id, isActive ? "enable" : "disable");
  await transaction(async (conn) => {
    const u = await lockUser(conn, id);
    if (Boolean(u.is_active) === isActive) return;
    if (!isActive) await keepAnAdmin(conn, u);
    await query(
      `UPDATE users SET is_active = ?${isActive ? ", failed_login_count = 0, locked_until = NULL" : ", token_version = token_version + 1"} WHERE id = ?`,
      [isActive ? 1 : 0, id],
      conn,
    );
    await auditService.record(conn, ctx, {
      action: isActive ? "user.enable" : "user.disable",
      entityType: "user",
      entityId: id,
      summary: u.email,
      before: { isActive: Boolean(u.is_active) },
      after: { isActive },
    });
  });
  return detail(id);
}

/** Set a new password (given or generated); signs the user out everywhere and asks them to change it. */
async function resetPassword(ctx, id, password) {
  notSelf(ctx, id, "reset the password of");
  const temporaryPassword = password || generatePassword();
  const hash = await bcrypt.hash(temporaryPassword, config.bcryptRounds);
  await transaction(async (conn) => {
    const u = await lockUser(conn, id);
    await query(
      "UPDATE users SET password_hash = ?, must_change_password = 1, token_version = token_version + 1, failed_login_count = 0, locked_until = NULL WHERE id = ?",
      [hash, id],
      conn,
    );
    await auditService.record(conn, ctx, { action: "user.password_reset", entityType: "user", entityId: id, summary: u.email });
  });
  return { user: await detail(id), temporaryPassword: password ? null : temporaryPassword };
}

async function unlock(ctx, id) {
  await transaction(async (conn) => {
    const u = await lockUser(conn, id);
    await query("UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = ?", [id], conn);
    await auditService.record(conn, ctx, { action: "user.unlock", entityType: "user", entityId: id, summary: u.email });
  });
  return detail(id);
}

async function revokeSessions(ctx, id) {
  notSelf(ctx, id, "sign out");
  await transaction(async (conn) => {
    const u = await lockUser(conn, id);
    await query("UPDATE users SET token_version = token_version + 1 WHERE id = ?", [id], conn);
    await auditService.record(conn, ctx, { action: "user.sessions_revoked", entityType: "user", entityId: id, summary: u.email });
  });
  return detail(id);
}

/** Delete an account. Orders stay (user_id becomes NULL); cart, addresses and wishlist go with it. */
async function remove(ctx, id) {
  notSelf(ctx, id, "delete");
  await transaction(async (conn) => {
    const u = await lockUser(conn, id);
    await keepAnAdmin(conn, u);
    await query("DELETE FROM users WHERE id = ?", [id], conn);
    await auditService.record(conn, ctx, { action: "user.delete", entityType: "user", entityId: id, summary: u.email, before: snapshot(u) });
  });
}

module.exports = { list, detail, create, update, setRole, setStatus, resetPassword, unlock, revokeSessions, remove, generatePassword, ROLES };
