"use strict";

/**
 * Local development only: starts a throwaway MySQL 8 server (mysql-memory-server)
 * and writes its connection details to .dev-db.json. Not used in production.
 *
 *   npm run dev:db      (leave running)  →  then in another terminal: npm run dev
 */
const fs = require("fs");
const path = require("path");
const { createDB } = require("mysql-memory-server");

(async () => {
  console.log("Starting a temporary MySQL server (first run downloads MySQL, ~250 MB)…");
  const db = await createDB({ version: "8.4.x", dbName: "varam", logLevel: "WARN" });
  const info = { host: "127.0.0.1", port: db.port, user: db.username, password: "", database: db.dbName };
  fs.writeFileSync(path.join(__dirname, "..", ".dev-db.json"), JSON.stringify(info, null, 2));
  console.log(`MySQL ready on 127.0.0.1:${db.port} (user ${db.username}, database ${db.dbName}). Press Ctrl+C to stop.`);
  const stop = async () => {
    await db.stop().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  setInterval(() => {}, 1 << 30);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
