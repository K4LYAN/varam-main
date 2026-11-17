"use strict";

/** Syntax-check every JavaScript file (server and browser) with `node --check`. */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "uploads"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".js")) files.push(full);
  }
})(root);

let failed = 0;
for (const f of files) {
  try {
    execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
  } catch (err) {
    failed++;
    console.error(`✗ ${path.relative(root, f)}\n${err.stderr.toString()}`);
  }
}
console.log(`${files.length - failed}/${files.length} files OK`);
process.exit(failed ? 1 : 0);
