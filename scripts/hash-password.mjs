#!/usr/bin/env node
// Usage: npm run hash-password -- "your-strong-password"
// Prints the value to use for ADMIN_PASSWORD_HASH (base64-encoded bcrypt hash,
// safe to paste into .env files and hosting dashboards).
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const password = process.argv[2];
if (!password || password.length < 10) {
  console.error('Please provide a password of at least 10 characters:\n  npm run hash-password -- "your-strong-password"');
  process.exit(1);
}
const hash = bcrypt.hashSync(password, 12);
console.log("\nADMIN_PASSWORD_HASH=" + Buffer.from(hash).toString("base64"));
console.log("\n# Also generate a session secret if you don't have one:");
console.log("AUTH_SECRET=" + randomBytes(32).toString("base64url") + "\n");
