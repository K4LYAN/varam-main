"use strict";

/**
 * Read-only database connection check. Changes nothing.
 *
 *   npm run db:check                                   (uses .env / ~/varam.env like the app)
 *   VARAM_ENV_FILE=/path/to/file.env npm run db:check  (test another settings file)
 *
 * Prints: which settings file was used, the address tried (never the password),
 * the server version, the account's privileges, and which Varam tables exist.
 */
const config = require("../src/config");
const { connect, query, close } = require("../src/db/pool");

const EXPECTED = [
  "users",
  "categories",
  "products",
  "product_variants",
  "cart_items",
  "orders",
  "order_items",
  "coupons",
  "addresses",
  "wishlist_items",
  "site_settings",
  "admin_audit_logs",
];

const HINTS = {
  ER_ACCESS_DENIED_ERROR: "Wrong DB_USER / DB_PASSWORD, or this user isn't allowed to connect from this computer's IP (add it under Remote MySQL / access hosts).",
  ER_DBACCESS_DENIED_ERROR: "The user exists but has no rights on DB_NAME. In the panel, add the user to the database with ALL PRIVILEGES.",
  ER_BAD_DB_ERROR: "DB_NAME doesn't exist. Use the full name shown in phpMyAdmin (e.g. prefix_dbname).",
  ETIMEDOUT: "No answer from DB_HOST:DB_PORT. Check the address, and that remote MySQL access is allowed for this IP.",
  ECONNREFUSED: "Nothing is listening on DB_HOST:DB_PORT.",
  ENOTFOUND: "DB_HOST is not a known host name.",
  HANDSHAKE_SSL_ERROR: "TLS failed. Try DB_SSL_VERIFY=false, or DB_SSL=false if the server has no TLS.",
};

(async () => {
  console.log(`Settings file : ${config.envFile || "(none — environment variables only)"}`);
  console.log(`Database      : ${config.db.database || "(DB_NAME not set)"}`);
  console.log(`Address       : ${config.db.socket ? `socket ${config.db.socket}, then ` : ""}TCP ${config.db.host}:${config.db.port}${config.db.ssl ? " with TLS" : ""}`);
  console.log(`User          : ${config.db.user || "(DB_USER not set)"}`);
  const missing = config.problems.filter((p) => /^DB_/.test(p));
  if (missing.length) {
    console.error(`\n✗ ${missing.join("; ")}`);
    process.exit(1);
  }

  try {
    await connect();
  } catch (err) {
    console.error(`\n✗ Could not connect: ${err.code || ""} ${err.message}`);
    const hint = HINTS[err.code] || (/ssl|tls|certificate/i.test(err.message) ? HINTS.HANDSHAKE_SSL_ERROR : "");
    if (hint) console.error(`  → ${hint}`);
    process.exit(1);
  }

  try {
    const [v] = await query("SELECT VERSION() AS version, DATABASE() AS db, CURRENT_USER() AS who, @@time_zone AS tz");
    const [tls] = await query("SHOW SESSION STATUS LIKE 'Ssl_cipher'").catch(() => [{}]);
    console.log(`\n✓ Connected   : ${v.version} as ${v.who}, database ${v.db}`);
    console.log(`  Encryption  : ${tls && tls.Value ? `TLS (${tls.Value})` : "none"}`);
    console.log(`  Time zone   : ${v.tz} (the app sets +05:30 on every connection)`);

    const grants = (await query("SHOW GRANTS FOR CURRENT_USER()")).map((r) => Object.values(r)[0]);
    const canBuild = grants.some((g) => /ALL PRIVILEGES|CREATE.*ALTER|ALTER.*CREATE/i.test(g));
    console.log(`  Privileges  : ${canBuild ? "can create and alter tables ✓" : "may NOT be able to create/alter tables ✗"}`);
    for (const g of grants) console.log(`                ${g.replace(/IDENTIFIED BY PASSWORD '[^']*'/i, "IDENTIFIED BY PASSWORD '…'")}`);

    const tables = new Set((await query("SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()")).map((r) => r.t));
    const present = EXPECTED.filter((t) => tables.has(t));
    console.log(`  Varam tables: ${present.length}/${EXPECTED.length} present`);
    if (present.length === 0) console.log("                Empty database — the app creates every table and the starting products on first start.");
    else if (present.length < EXPECTED.length) console.log(`                Missing: ${EXPECTED.filter((t) => !tables.has(t)).join(", ")} — added automatically on next start.`);
    if (tables.has("products")) {
      const [{ n }] = await query("SELECT COUNT(*) AS n FROM products");
      const [{ o }] = tables.has("orders") ? await query("SELECT COUNT(*) AS o FROM orders") : [{ o: 0 }];
      console.log(`  Data        : ${n} products, ${o} orders`);
    }
    const other = [...tables].filter((t) => !EXPECTED.includes(t));
    if (other.length) console.log(`  Other tables: ${other.join(", ")} (left untouched)`);
  } catch (err) {
    console.error(`\n✗ Connected, but a check failed: ${err.code || ""} ${err.message}`);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
