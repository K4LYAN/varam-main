"use strict";

/**
 * Varam Organic Cold-Pressed Oils — store + admin panel.
 * Entry point for cPanel (Phusion Passenger), PM2 or `node server.js`.
 *
 * Boot:     listen → connect MySQL (socket → TCP fallback) → idempotent migration.
 *           Until that succeeds, visitors see a "setup needed" page naming the
 *           problem and the database is retried (no crash loop on the host).
 * Shutdown: SIGTERM/SIGINT → stop accepting → finish in-flight requests →
 *           close the MySQL pool → exit (forced after SHUTDOWN_TIMEOUT_MS)
 */
const http = require("http");
const config = require("./src/config");
const { close } = require("./src/db/pool");
const boot = require("./src/boot");

let server = null;
let shuttingDown = false;

async function start() {
  if (config.problems.length) console.error(`[server] setup needed: ${config.problems.join("; ")}`);
  await new Promise((resolve, reject) => {
    server = http.createServer(boot.handle);
    server.once("error", reject);
    server.listen(config.port, resolve);
  });
  // Keep-alive slightly above typical proxy timeouts so Passenger/Apache never reuse a socket we just closed
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.requestTimeout = 30000;
  console.log(`[server] listening on port ${config.port} (pid ${process.pid})`);
  boot
    .init()
    .then(() => console.log("[server] Varam store is ready"))
    .catch(() => console.error("[server] store not ready yet — visitors see the setup page; retrying the database every 15s"));
  return server;
}

function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] ${signal} received — shutting down`);
  const force = setTimeout(() => {
    console.error("[server] forced exit after timeout");
    process.exit(1);
  }, config.shutdownTimeoutMs);
  force.unref();

  const finish = () =>
    close()
      .catch((err) => console.error("[server] error closing database pool:", err.message))
      .finally(() => process.exit(exitCode));

  if (!server) return finish();
  server.close(finish); // stops new connections; callback runs once in-flight requests finish
  server.closeIdleConnections?.(); // drop idle keep-alive sockets now instead of waiting for their timeout
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Last-resort logging. A rejected promise is logged and the process keeps serving;
// an uncaught exception leaves the process in an unknown state, so exit cleanly and let Passenger/PM2 restart it.
process.on("unhandledRejection", (reason) => console.error("[server] unhandled promise rejection:", reason));
process.on("uncaughtException", (err) => {
  console.error("[server] uncaught exception:", err);
  shutdown("uncaughtException", 1);
});

// cPanel's Node.js Selector (Phusion Passenger) loads this file through its own
// loader, so start unconditionally unless a script imports the app on purpose.
if (process.env.VARAM_NO_AUTOSTART !== "1") {
  start().catch((err) => {
    console.error("[server] failed to start:", err);
    process.exit(1);
  });
}

module.exports = { start, shutdown };
