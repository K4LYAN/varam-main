"use strict";

class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.status = 400;
    this.field = field;
  }
}

const clean = (v, max = 255) =>
  String(v ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);

function str(v, field, { min = 0, max = 255, required = false } = {}) {
  const s = clean(v, max + 1);
  if (required && !s) throw new ValidationError(`${field} is required`, field);
  if (s.length < min) throw new ValidationError(`${field} must be at least ${min} characters`, field);
  if (s.length > max) throw new ValidationError(`${field} is too long`, field);
  return s;
}

function email(v, field = "Email", required = true) {
  const s = clean(v, 190).toLowerCase();
  if (!s && !required) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) throw new ValidationError("Enter a valid email address", field);
  return s;
}

/** Indian mobile number → 10 digits. */
function phone(v, field = "Phone", required = true) {
  const digits = String(v ?? "").replace(/\D/g, "");
  if (!digits && !required) return "";
  const d = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  if (!/^[6-9]\d{9}$/.test(d)) throw new ValidationError("Enter a valid 10-digit mobile number", field);
  return d;
}

function pincode(v, field = "Pincode", required = true) {
  const s = String(v ?? "").replace(/\s/g, "");
  if (!s && !required) return "";
  if (!/^[1-9]\d{5}$/.test(s)) throw new ValidationError("Enter a valid 6-digit pincode", field);
  return s;
}

function int(v, field, { min = 0, max = 1_000_000 } = {}) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new ValidationError(`${field} must be a whole number between ${min} and ${max}`, field);
  return n;
}

function money(v, field, { min = 0, max = 10_000_000 } = {}) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new ValidationError(`${field} must be a valid amount`, field);
  return Math.round(n * 100) / 100;
}

function oneOf(v, field, values) {
  if (!values.includes(v)) throw new ValidationError(`${field} is invalid`, field);
  return v;
}

function bool(v) {
  return v === true || v === 1 || v === "1" || v === "true" || v === "on";
}

function slug(v, field = "Slug") {
  const s = clean(v, 150)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!s) throw new ValidationError(`${field} is required`, field);
  return s;
}

function hexColor(v, field = "Colour") {
  const s = clean(v, 7);
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) throw new ValidationError(`${field} must be a hex colour like #D97706`, field);
  return s.toUpperCase();
}

function url(v, field = "URL") {
  const s = clean(v, 500);
  if (!s) return "";
  if (!/^https:\/\/[^\s"'<>]+$/i.test(s) && !/^\/uploads\/[a-z0-9._-]+$/i.test(s)) {
    throw new ValidationError(`${field} must be an https:// link or an uploaded image`, field);
  }
  return s;
}

module.exports = { ValidationError, clean, str, email, phone, pincode, int, money, oneOf, bool, slug, hexColor, url };
