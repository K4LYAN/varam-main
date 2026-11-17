"use strict";

/**
 * First-run seed data: categories, VARAM's products and price list, default
 * settings, the VARAM10 coupon and the admin account. Every step is
 * insert-if-missing — existing data and admin changes are never overwritten.
 */
const bcrypt = require("bcryptjs");
const config = require("../config");
const { DEFAULT_SETTINGS, DEFAULT_ADMIN } = require("../config/defaults");
const { query, queryRaw, transaction } = require("./pool");

const ICONS = {
  drop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3c3.5 4.6 5.5 8 5.5 11a5.5 5.5 0 0 1-11 0c0-3 2-6.4 5.5-11Z"/></svg>',
  seed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><ellipse cx="12" cy="12" rx="5" ry="8"/><path d="M12 4v16"/></svg>',
  coconut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="13" r="7"/><circle cx="10" cy="11" r=".8" fill="currentColor"/><circle cx="14" cy="11" r=".8" fill="currentColor"/><circle cx="12" cy="14" r=".8" fill="currentColor"/></svg>',
  flower: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>',
  leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Z"/><path d="M5 19 13 11"/></svg>',
  jar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6" y="7" width="12" height="13" rx="3"/><path d="M8 4h8v3H8z"/></svg>',
  honey: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3 19 7v10l-7 4-7-4V7z"/><path d="M12 8v8"/></svg>',
};

const CATEGORIES = [
  { slug: "groundnut-oil", name: "Groundnut Oil", icon: "seed" },
  { slug: "sesame-oil", name: "Sesame Oil", icon: "drop" },
  { slug: "coconut-oil", name: "Coconut Oil", icon: "coconut" },
  { slug: "mustard-oil", name: "Mustard Oil", icon: "flower" },
  { slug: "other-oils", name: "Other Oils", icon: "leaf" },
  { slug: "ghee", name: "Ghee", icon: "jar" },
  { slug: "honey", name: "Honey", icon: "honey" },
];

/** Prices from VARAM's price list. Add more pack sizes in Admin → Products. */
const PRODUCTS = [
  {
    category: "groundnut-oil", slug: "wood-pressed-groundnut-oil", name: "Wood-Pressed Groundnut Oil",
    tagline: "Golden and nutty — the everyday oil of Andhra kitchens.",
    description: "Pressed slowly from groundnuts in a traditional wooden ghani (gaanuga), then left to settle naturally before bottling. Rich nutty aroma for tempering, curries, chutneys and everyday home cooking.",
    accent: "#D7A436", badge: "Bestseller", featured: 1, sku: "VRM-GN", size: "1 Litre", price: 370,
  },
  {
    category: "sesame-oil", slug: "wood-pressed-white-sesame-oil", name: "Wood-Pressed White Sesame Oil",
    tagline: "Traditional gingelly (nuvvula nune) with a gentle aroma.",
    description: "Wood-pressed from white sesame seeds — a staple for pickles, podis, pulusu and traditional South Indian recipes.",
    accent: "#D6A13A", badge: "", featured: 1, sku: "VRM-WS", size: "1 Litre", price: 550,
  },
  {
    category: "sesame-oil", slug: "wood-pressed-black-sesame-oil", name: "Wood-Pressed Black Sesame Oil",
    tagline: "Deep, earthy oil from black sesame seeds.",
    description: "Wood-pressed from black sesame seeds; darker and more robust than white sesame oil. Used in traditional recipes and also traditionally for oil massage.",
    accent: "#7B4B1F", badge: "", featured: 0, sku: "VRM-BS", size: "1 Litre", price: 520,
  },
  {
    category: "coconut-oil", slug: "wood-pressed-coconut-oil", name: "Wood-Pressed Coconut Oil",
    tagline: "Clear, fragrant oil from mature coconuts.",
    description: "Wood-pressed from mature coconuts. Naturally fragrant; it may solidify in cool weather — keep the bottle somewhere warm to liquefy.",
    accent: "#EFE3BF", badge: "", featured: 1, sku: "VRM-CO", size: "1 Litre", price: 700,
  },
  {
    category: "mustard-oil", slug: "kachi-ghani-mustard-oil", name: "Kachi Ghani Mustard Oil",
    tagline: "Bold and pungent — made for pickles and curries.",
    description: "Cold, slow-pressed (kachi ghani) from mustard seeds, with the bold pungency that defines North and East Indian dishes and Andhra avakaya.",
    accent: "#C18414", badge: "", featured: 1, sku: "VRM-MU", size: "1 Litre", price: 480,
  },
  {
    category: "other-oils", slug: "wood-pressed-sunflower-oil", name: "Wood-Pressed Sunflower Oil",
    tagline: "Light and mild for everyday cooking.",
    description: "Wood-pressed from sunflower seeds — light in colour and mild in flavour for everyday cooking.",
    accent: "#E6C14C", badge: "", featured: 0, sku: "VRM-SF", size: "1 Litre", price: 550,
  },
  {
    category: "other-oils", slug: "pure-castor-oil", name: "Pure Castor Oil",
    tagline: "Thick, traditional castor (amudam) oil.",
    description: "Pressed from castor seeds. Traditionally used in hair and skin care routines and for lamps. Please follow the label for usage.",
    accent: "#E8D9A0", badge: "", featured: 0, sku: "VRM-CA", size: "1 Litre", price: 480,
  },
  {
    category: "ghee", slug: "pure-ghee", name: "Pure Ghee",
    tagline: "Golden, aromatic ghee prepared the traditional way.",
    description: "Butter heated slowly until clear and golden, then filtered — for rice and dal, sweets, rotis and pooja.",
    accent: "#E9B949", badge: "", featured: 1, sku: "VRM-GH", size: "1 Litre", price: 800,
  },
  {
    category: "honey", slug: "pure-honey", name: "Pure Honey",
    tagline: "Thick, golden natural honey.",
    description: "Golden natural honey with a rich, floral sweetness — for breakfast, warm drinks and desserts. May crystallise naturally; stand the jar in warm water to make it runny.",
    accent: "#D88F14", badge: "New", featured: 0, sku: "VRM-HO", size: "1 Kg", price: 1000,
  },
];

async function seedSettings() {
  const rows = Object.entries(DEFAULT_SETTINGS);
  await queryRaw("INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES ?", [rows]);
  await query(
    "INSERT IGNORE INTO coupons (code, discount_type, discount_value, min_order_amount, is_active) VALUES ('VARAM10', 'percent', 10, 0, 1)",
  );
}

async function seedCatalog() {
  const [{ n }] = await query("SELECT COUNT(*) AS n FROM categories");
  if (Number(n) > 0) return false;
  await transaction(async (conn) => {
    await queryRaw(
      "INSERT INTO categories (name, slug, icon_svg, sort_order) VALUES ?",
      [CATEGORIES.map((c, i) => [c.name, c.slug, ICONS[c.icon], i])],
      conn,
    );
    const cats = await query("SELECT id, slug FROM categories", [], conn);
    const catId = Object.fromEntries(cats.map((c) => [c.slug, c.id]));
    await queryRaw(
      `INSERT INTO products (category_id, name, slug, tagline, description, accent_color, badge_text, is_featured, is_active, sort_order) VALUES ?`,
      [PRODUCTS.map((p, i) => [catId[p.category], p.name, p.slug, p.tagline, p.description, p.accent, p.badge, p.featured, 1, i])],
      conn,
    );
    const prods = await query("SELECT id, slug FROM products", [], conn);
    const prodId = Object.fromEntries(prods.map((p) => [p.slug, p.id]));
    await queryRaw(
      "INSERT INTO product_variants (product_id, size_label, sku, price, mrp, stock_qty, sort_order) VALUES ?",
      [PRODUCTS.map((p) => [prodId[p.slug], p.size, `${p.sku}-${p.size.replace(/\s+/g, "").toUpperCase()}`, p.price, p.price, 50, 0])],
      conn,
    );
  });
  console.log(`[migrate] seeded ${CATEGORIES.length} categories and ${PRODUCTS.length} products`);
  return true;
}

/** Create the first admin account if none exists. */
async function seedAdmin() {
  const admins = await query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (admins.length) return;
  const email = config.admin.email || DEFAULT_ADMIN.email;
  const usingDefault = !(config.admin.password && config.admin.password.length >= 8);
  const password = usingDefault ? DEFAULT_ADMIN.password : config.admin.password;
  const hash = await bcrypt.hash(password, config.bcryptRounds);
  await query(
    `INSERT INTO users (name, email, password_hash, role, must_change_password) VALUES (?, ?, ?, 'admin', ?)
     ON DUPLICATE KEY UPDATE role = 'admin', password_hash = VALUES(password_hash), must_change_password = VALUES(must_change_password)`,
    [config.admin.name, email, hash, usingDefault ? 1 : 0],
  );
  console.log(`[migrate] Admin account created: ${email}${usingDefault ? " (default password - change it in Admin -> Coupons & settings)" : ""}`);
}

module.exports = { seedSettings, seedCatalog, seedAdmin };
