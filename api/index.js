"use strict";

/**
 * Vercel entry point. Every request is rewritten here by vercel.json.
 * The store boots once per function instance (connect MySQL → migrate) and is reused.
 * Needs the same environment variables as .env.example, set in Vercel → Settings →
 * Environment Variables, and a MySQL server that accepts connections from the internet.
 */
const { handle } = require("../src/boot");

module.exports = (req, res) => handle(req, res);
