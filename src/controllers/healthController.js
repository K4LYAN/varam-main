"use strict";

const healthService = require("../services/healthService");

/** GET /api/health — 200 when MySQL answers, 503 otherwise (for uptime monitors). */
async function health(_req, res) {
  const report = await healthService.check();
  res.set("Cache-Control", "no-store");
  res.status(report.database.ok ? 200 : 503).json(report);
}

module.exports = { health };
