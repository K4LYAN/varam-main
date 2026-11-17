"use strict";

/**
 * CSV for Excel / Google Sheets. Cells that start with = + - @ (or a tab/CR)
 * are prefixed with ' so a spreadsheet never runs them as formulas (CSV injection).
 */
function cell(value) {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Header + rows → CSV text with a UTF-8 BOM (so Excel shows ₹ and Telugu correctly). */
function toCsv(header, rows) {
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

module.exports = { cell, toCsv };
