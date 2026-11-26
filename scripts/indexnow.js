#!/usr/bin/env node
/* Ping IndexNow with every page on varams.in. Run after each deploy: npm run indexnow */
"use strict";
const { submit } = require("../src/indexnow");

submit()
  .then(({ status, count }) => {
    // 200 = accepted, 202 = accepted (key check pending)
    console.log(`IndexNow: sent ${count} URLs, response ${status}`);
    process.exitCode = status === 200 || status === 202 ? 0 : 1;
  })
  .catch((err) => {
    console.error("IndexNow failed:", err.message);
    process.exitCode = 1;
  });
