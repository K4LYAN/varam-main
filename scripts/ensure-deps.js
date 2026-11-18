"use strict";

/**
 * Runs automatically before `npm start` (the "prestart" script).
 * Some hosts (e.g. MilesWeb mPanel) deploy each commit into a fresh folder and run
 * `npm start` without `npm install`, so node_modules is missing. Install the
 * production dependencies once if any of them can't be found.
 */
const { execSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const pkg = require(path.join(root, "package.json"));

const missing = Object.keys(pkg.dependencies || {}).filter((name) => {
  try {
    require.resolve(name, { paths: [root] });
    return false;
  } catch {
    return true;
  }
});

if (!missing.length) process.exit(0);

console.log(`[deps] missing: ${missing.join(", ")} — installing production dependencies…`);
const lock = require("fs").existsSync(path.join(root, "package-lock.json"));
const cmd = lock ? "npm ci --omit=dev --no-audit --no-fund" : "npm install --omit=dev --no-audit --no-fund";
try {
  execSync(cmd, { cwd: root, stdio: "inherit" });
} catch {
  if (!lock) process.exit(1);
  console.log("[deps] npm ci failed — retrying with npm install");
  execSync("npm install --omit=dev --no-audit --no-fund", { cwd: root, stdio: "inherit" });
}
console.log("[deps] done");
