"use strict";

const bcrypt = require("bcryptjs");
const { query } = require("./db");
const config = require("./config");

// Default admin login used when ADMIN_EMAIL / ADMIN_PASSWORD are not set
const DEFAULT_ADMIN = { email: "admin@varam.in", password: "Varam@12345" };

/* ------------------------------------------------------------------ */
/* Schema (idempotent)                                                 */
/* ------------------------------------------------------------------ */

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL,
    phone VARCHAR(20) NULL,
    password_hash VARCHAR(100) NOT NULL,
    role ENUM('customer','admin') NOT NULL DEFAULT 'customer',
    default_address VARCHAR(500) NULL,
    pincode VARCHAR(10) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_email (email),
    KEY idx_users_phone (phone)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    slug VARCHAR(80) NOT NULL,
    icon_svg TEXT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    UNIQUE KEY uq_categories_slug (slug)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS products (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_id INT UNSIGNED NULL,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) NOT NULL,
    tagline VARCHAR(255) NOT NULL DEFAULT '',
    description TEXT NULL,
    image_url VARCHAR(500) NOT NULL DEFAULT '',
    accent_color CHAR(7) NOT NULL DEFAULT '#D97706',
    badge_text VARCHAR(40) NOT NULL DEFAULT '',
    rating DECIMAL(2,1) NOT NULL DEFAULT 0.0,
    review_count INT UNSIGNED NOT NULL DEFAULT 0,
    is_featured TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_products_slug (slug),
    KEY idx_products_category (category_id),
    CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS product_variants (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id INT UNSIGNED NOT NULL,
    size_label VARCHAR(40) NOT NULL,
    sku VARCHAR(60) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    mrp DECIMAL(10,2) NOT NULL,
    stock_qty INT NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    UNIQUE KEY uq_variants_sku (sku),
    KEY idx_variants_product (product_id),
    CONSTRAINT fk_variants_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS cart_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    variant_id INT UNSIGNED NOT NULL,
    quantity INT UNSIGNED NOT NULL DEFAULT 1,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_cart_user_variant (user_id, variant_id),
    CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_cart_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_cart_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS orders (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(30) NULL,
    user_id INT UNSIGNED NULL,
    customer_name VARCHAR(120) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    fulfillment_type ENUM('delivery','pickup') NOT NULL,
    delivery_address VARCHAR(500) NULL,
    pincode VARCHAR(10) NULL,
    payment_method ENUM('UPI','COD','STORE') NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    coupon_code VARCHAR(40) NULL,
    notes VARCHAR(500) NULL,
    status ENUM('Pending','Confirmed','Packed','Out for Delivery','Delivered','Cancelled') NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_orders_number (order_number),
    KEY idx_orders_user (user_id),
    KEY idx_orders_status (status),
    KEY idx_orders_created (created_at),
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS order_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NULL,
    variant_id INT UNSIGNED NULL,
    product_name VARCHAR(150) NOT NULL,
    size_label VARCHAR(40) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    quantity INT UNSIGNED NOT NULL,
    line_total DECIMAL(10,2) NOT NULL,
    KEY idx_items_order (order_id),
    CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS coupons (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(40) NOT NULL,
    discount_type ENUM('percent','flat') NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL,
    min_order_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_coupons_code (code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS addresses (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    label VARCHAR(40) NOT NULL DEFAULT 'Home',
    recipient_name VARCHAR(120) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address_line VARCHAR(500) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_addresses_user (user_id),
    CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS wishlist_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wishlist_user_product (user_id, product_id),
    CONSTRAINT fk_wishlist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_wishlist_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS site_settings (
    setting_key VARCHAR(80) NOT NULL PRIMARY KEY,
    setting_value TEXT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

/* ------------------------------------------------------------------ */
/* Seed data                                                           */
/* ------------------------------------------------------------------ */

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

const DEFAULT_SETTINGS = {
  announcement: "Free home delivery on orders above ₹999 · Free pickup at our Vijayawada store",
  free_delivery_threshold: "999",
  delivery_fee: "60",
  store_name: "Varam Organic Oil (గానుగ నూనె)",
  store_address: "BRTS Rd, Lakshmi Nagar, Satyaranayana Puram, Vijayawada, Andhra Pradesh 520011",
  store_phone: "077992 28444",
  whatsapp_number: "917799228444",
  store_hours: "Open every day · 8:00 AM – 9:30 PM",
  maps_url: "https://maps.google.com/?cid=7883840299429229573",
  upi_id: "",
  instagram_url: "https://www.instagram.com/varamorganicoil_india/",
  google_rating: "4.9",
  google_review_count: "19",
  google_reviews_url: "https://maps.google.com/?cid=7883840299429229573",
  // Genuine reviews only: [{"name":"…","text":"…","rating":5,"source":"Google"}]
  testimonials: "[]",
};

/* ------------------------------------------------------------------ */

async function migrate() {
  for (const sql of SCHEMA) await query(sql);

  // Settings: insert any missing keys (never overwrite admin changes)
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    await query("INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES (?, ?)", [k, v]);
  }

  await query(
    "INSERT IGNORE INTO coupons (code, discount_type, discount_value, min_order_amount, is_active) VALUES ('VARAM10', 'percent', 10, 0, 1)",
  );

  const [{ n: catCount }] = await query("SELECT COUNT(*) AS n FROM categories");
  if (Number(catCount) === 0) {
    for (const [i, c] of CATEGORIES.entries()) {
      await query("INSERT INTO categories (name, slug, icon_svg, sort_order) VALUES (?, ?, ?, ?)", [c.name, c.slug, ICONS[c.icon], i]);
    }
    const cats = await query("SELECT id, slug FROM categories");
    const catId = Object.fromEntries(cats.map((c) => [c.slug, c.id]));
    for (const [i, p] of PRODUCTS.entries()) {
      const res = await query(
        `INSERT INTO products (category_id, name, slug, tagline, description, accent_color, badge_text, is_featured, is_active, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [catId[p.category], p.name, p.slug, p.tagline, p.description, p.accent, p.badge, p.featured, i],
      );
      const sizeCode = p.size.replace(/\s+/g, "").toUpperCase();
      await query(
        "INSERT INTO product_variants (product_id, size_label, sku, price, mrp, stock_qty, sort_order) VALUES (?, ?, ?, ?, ?, ?, 0)",
        [res.insertId, p.size, `${p.sku}-${sizeCode}`, p.price, p.price, 50],
      );
    }
    console.log(`[migrate] seeded ${CATEGORIES.length} categories and ${PRODUCTS.length} products`);
  }

  // Default admin account (change the password later from Admin -> Coupons & settings)
  const admins = await query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (!admins.length) {
    const email = config.admin.email || DEFAULT_ADMIN.email;
    const password = config.admin.password && config.admin.password.length >= 8 ? config.admin.password : DEFAULT_ADMIN.password;
    const hash = await bcrypt.hash(password, 12);
    await query(
      `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')
       ON DUPLICATE KEY UPDATE role = 'admin', password_hash = VALUES(password_hash)`,
      [config.admin.name, email, hash],
    );
    console.log(`[migrate] Admin account created: ${email}` + (password === DEFAULT_ADMIN.password ? " (default password - change it in Admin -> Coupons & settings)" : ""));
  }
}

module.exports = { migrate, DEFAULT_SETTINGS, DEFAULT_ADMIN };
