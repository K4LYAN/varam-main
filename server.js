"use strict";

/**
 * Varam Organic Cold-Pressed Oils — store + admin panel.
 * Entry point for cPanel (Phusion Passenger), PM2 or `node server.js`.
 *
 * Boot:     connect MySQL (socket → TCP fallback) → idempotent migration → listen
 * Shutdown: SIGTERM/SIGINT → stop accepting → finish in-flight requests →
 *           close the MySQL pool → exit (forced after SHUTDOWN_TIMEOUT_MS)
 */
const config = require("./src/config");
const { connect, close } = require("./src/db/pool");
const { migrate } = require("./src/db/migrate");
const { createApp } = require("./src/app");

const app = createApp();
let server = null;
let shuttingDown = false;

async function start() {
  await connect();
  await migrate();
  await new Promise((resolve, reject) => {
    server = app.listen(config.port, resolve);
    server.once("error", reject);
  });
  // Keep-alive slightly above typical proxy timeouts so Passenger/Apache never reuse a socket we just closed
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.requestTimeout = 30000;
  console.log(`[server] Varam store running on port ${config.port} (pid ${process.pid})`);
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

module.exports = { app, start, shutdown };
