"use strict";

/**
 * Idempotent migration, run on every boot:
 *   1. CREATE TABLE IF NOT EXISTS for every table
 *   2. upgrade steps for databases created by older versions (indexes, FKs, CHECKs, new columns)
 *   3. seed defaults (only what is missing)
 */
const bcrypt = require("bcryptjs");
const { query, db } = require("./pool");
const { TABLES, UPGRADES } = require("./schema");
const { seedSettings, seedCatalog, seedAdmin } = require("./seed");
const { DEFAULT_ADMIN } = require("../config/defaults");

const IDENT = /^[a-z_][a-z0-9_]*$/i; // table / index / constraint names come from schema.js only

async function columnInfo(table, column) {
  const rows = await query(
    "SELECT IS_NULLABLE AS nullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [table, column],
  );
  return rows[0] || null;
}

async function hasIndex(table, name) {
  const rows = await query(
    "SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1",
    [table, name],
  );
  return rows.length > 0;
}

async function hasConstraint(table, name) {
  const rows = await query(
    "SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? LIMIT 1",
    [table, name],
  );
  return rows.length > 0;
}

/** Flag admin accounts that still use the shipped default password (shows the dashboard reminder). */
async function flagDefaultAdminPassword() {
  const admins = await query("SELECT id, password_hash FROM users WHERE role = 'admin' AND must_change_password = 0");
  for (const a of admins) {
    if (await bcrypt.compare(DEFAULT_ADMIN.password, a.password_hash)) {
      await query("UPDATE users SET must_change_password = 1 WHERE id = ?", [a.id]);
    }
  }
}

async function applyUpgrade(step) {
  const { table } = step;
  for (const n of [table, step.name, step.column, step.replacedBy].filter(Boolean)) {
    if (!IDENT.test(n)) throw new Error(`[migrate] invalid identifier in schema: ${n}`);
  }
  switch (step.type) {
    case "column":
      if (await columnInfo(table, step.column)) return false;
      await query(`ALTER TABLE \`${table}\` ADD COLUMN ${step.ddl}`);
      return true;
    case "index":
      if (await hasIndex(table, step.name)) return false;
      await query(`ALTER TABLE \`${table}\` ADD ${step.ddl}`);
      return true;
    case "dropIndex":
      if (!(await hasIndex(table, step.name)) || !(await hasIndex(table, step.replacedBy))) return false;
      await query(`ALTER TABLE \`${table}\` DROP INDEX \`${step.name}\``);
      return true;
    case "notNull": {
      const info = await columnInfo(table, step.column);
      if (!info || info.nullable === "NO") return false;
      if (step.backfill) await query(step.backfill);
      await query(`ALTER TABLE \`${table}\` MODIFY ${step.ddl}`);
      return true;
    }
    case "fk":
      if (await hasConstraint(table, step.name)) return false;
      if (step.cleanup) await query(step.cleanup);
      await query(`ALTER TABLE \`${table}\` ADD ${step.ddl}`);
      return true;
    case "check":
      if (await hasConstraint(table, step.name)) return false;
      try {
        await query(`ALTER TABLE \`${table}\` ADD CONSTRAINT \`${step.name}\` CHECK (${step.expr})`);
        return true;
      } catch (err) {
        // Old MySQL/MariaDB versions or rows that violate the rule: keep running, the app enforces it too
        console.warn(`[migrate] could not add ${step.name} (${err.code || err.message}); continuing`);
        return false;
      }
    default:
      throw new Error(`[migrate] unknown upgrade type ${step.type}`);
  }
}

/**
 * Passenger can start several workers at once, and each runs this on boot.
 * A MySQL named lock makes them take turns, so two workers never ALTER the
 * same table or seed the catalogue twice.
 */
async function migrate() {
  const lockConn = await db().getConnection();
  try {
    const [[{ got }]] = await lockConn.query("SELECT GET_LOCK('varam_migrate', 120) AS got");
    if (Number(got) !== 1) throw new Error("[migrate] timed out waiting for another worker's migration");
    for (const sql of TABLES) await query(sql);

    let applied = 0;
    for (const step of UPGRADES) if (await applyUpgrade(step)) applied++;
    if (applied) console.log(`[migrate] applied ${applied} schema upgrade step(s)`);

    await seedSettings();
    await seedCatalog();
    await seedAdmin();
    await flagDefaultAdminPassword();
  } finally {
    await lockConn.query("SELECT RELEASE_LOCK('varam_migrate')").catch(() => {});
    lockConn.release();
  }
}

module.exports = { migrate };
