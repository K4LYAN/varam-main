"use strict";

/**
 * Database schema.
 *
 * TABLES   — full definitions for a fresh install (CREATE TABLE IF NOT EXISTS).
 * UPGRADES — idempotent steps that bring an existing database (created by an
 *            older version) up to the same shape. Each step checks
 *            information_schema first, so running it twice is a no-op.
 *
 * The same changes are available as plain SQL in database/hardening.sql
 * for running by hand in phpMyAdmin.
 */

const OPTS = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

const TABLES = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL,
    phone VARCHAR(20) NULL,
    password_hash VARCHAR(100) NOT NULL,
    role ENUM('customer','admin') NOT NULL DEFAULT 'customer',
    default_address VARCHAR(500) NULL,
    pincode VARCHAR(10) NULL,
    token_version INT UNSIGNED NOT NULL DEFAULT 0,
    must_change_password TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    last_login_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_email (email),
    KEY idx_users_phone (phone),
    KEY idx_users_role_created (role, created_at)
  ) ${OPTS}`,

  `CREATE TABLE IF NOT EXISTS categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    slug VARCHAR(80) NOT NULL,
    icon_svg TEXT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    UNIQUE KEY uq_categories_slug (slug)
  ) ${OPTS}`,

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
    KEY idx_products_category_active (category_id, is_active),
    KEY idx_products_active_sort (is_active, sort_order),
    CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    CONSTRAINT chk_products_rating CHECK (rating >= 0 AND rating <= 5)
  ) ${OPTS}`,

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
    KEY idx_variants_product_sort (product_id, sort_order),
    KEY idx_variants_stock (stock_qty),
    CONSTRAINT fk_variants_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT chk_variants_stock CHECK (stock_qty >= 0),
    CONSTRAINT chk_variants_price CHECK (price >= 0 AND mrp >= price)
  ) ${OPTS}`,

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
    CONSTRAINT fk_cart_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
    CONSTRAINT chk_cart_quantity CHECK (quantity BETWEEN 1 AND 50)
  ) ${OPTS}`,

  `CREATE TABLE IF NOT EXISTS orders (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(30) NOT NULL,
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
    KEY idx_orders_user_created (user_id, created_at),
    KEY idx_orders_status_created (status, created_at),
    KEY idx_orders_created (created_at),
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_orders_amounts CHECK (subtotal >= 0 AND discount_amount >= 0 AND delivery_fee >= 0 AND total_amount >= 0)
  ) ${OPTS}`,

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
    CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    CONSTRAINT fk_items_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
    CONSTRAINT chk_items_quantity CHECK (quantity > 0)
  ) ${OPTS}`,

  `CREATE TABLE IF NOT EXISTS coupons (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(40) NOT NULL,
    discount_type ENUM('percent','flat') NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL,
    min_order_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    usage_limit INT UNSIGNED NULL,
    used_count INT UNSIGNED NOT NULL DEFAULT 0,
    expires_at DATETIME NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_coupons_code (code),
    CONSTRAINT chk_coupons_value CHECK (discount_value > 0 AND min_order_amount >= 0)
  ) ${OPTS}`,

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
    KEY idx_addresses_user_default (user_id, is_default),
    CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ${OPTS}`,

  `CREATE TABLE IF NOT EXISTS wishlist_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wishlist_user_product (user_id, product_id),
    CONSTRAINT fk_wishlist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_wishlist_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  ) ${OPTS}`,

  `CREATE TABLE IF NOT EXISTS site_settings (
    setting_key VARCHAR(80) NOT NULL PRIMARY KEY,
    setting_value TEXT NOT NULL
  ) ${OPTS}`,

  `CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_id INT UNSIGNED NULL,
    admin_email VARCHAR(190) NOT NULL DEFAULT '',
    action VARCHAR(40) NOT NULL,
    entity_type VARCHAR(30) NOT NULL,
    entity_id INT UNSIGNED NULL,
    summary VARCHAR(255) NOT NULL DEFAULT '',
    before_json TEXT NULL,
    after_json TEXT NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_audit_created (created_at),
    KEY idx_audit_entity (entity_type, entity_id, created_at),
    KEY idx_audit_admin (admin_id, created_at),
    CONSTRAINT fk_audit_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
  ) ${OPTS}`,
];

/**
 * Upgrade steps for databases created by earlier versions. Types:
 *  column  — add a column if missing
 *  index   — add an index if missing
 *  dropIndex — drop a redundant index if present (only after its replacement exists)
 *  notNull — make a column NOT NULL after backfilling NULLs
 *  fk      — add a foreign key if missing, after cleaning orphaned rows
 *  check   — add a CHECK constraint if missing (best effort: logged, never fatal)
 */
const UPGRADES = [
  { type: "column", table: "users", column: "token_version", ddl: "token_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER pincode" },
  { type: "column", table: "users", column: "must_change_password", ddl: "must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER token_version" },
  { type: "column", table: "users", column: "is_active", ddl: "is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER must_change_password" },
  { type: "column", table: "users", column: "last_login_at", ddl: "last_login_at TIMESTAMP NULL DEFAULT NULL AFTER is_active" },
  { type: "index", table: "users", name: "idx_users_role_created", ddl: "KEY idx_users_role_created (role, created_at)" },

  { type: "column", table: "coupons", column: "usage_limit", ddl: "usage_limit INT UNSIGNED NULL AFTER min_order_amount" },
  { type: "column", table: "coupons", column: "used_count", ddl: "used_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER usage_limit" },
  { type: "column", table: "coupons", column: "expires_at", ddl: "expires_at DATETIME NULL AFTER used_count" },

  { type: "notNull", table: "orders", column: "order_number", ddl: "order_number VARCHAR(30) NOT NULL", backfill: "UPDATE orders SET order_number = CONCAT('VRM-LEGACY-', id) WHERE order_number IS NULL" },
  { type: "index", table: "orders", name: "idx_orders_user_created", ddl: "KEY idx_orders_user_created (user_id, created_at)" },
  { type: "index", table: "orders", name: "idx_orders_status_created", ddl: "KEY idx_orders_status_created (status, created_at)" },
  { type: "dropIndex", table: "orders", name: "idx_orders_user", replacedBy: "idx_orders_user_created" },
  { type: "dropIndex", table: "orders", name: "idx_orders_status", replacedBy: "idx_orders_status_created" },

  { type: "index", table: "products", name: "idx_products_category_active", ddl: "KEY idx_products_category_active (category_id, is_active)" },
  { type: "index", table: "products", name: "idx_products_active_sort", ddl: "KEY idx_products_active_sort (is_active, sort_order)" },
  { type: "dropIndex", table: "products", name: "idx_products_category", replacedBy: "idx_products_category_active" },

  { type: "index", table: "product_variants", name: "idx_variants_product_sort", ddl: "KEY idx_variants_product_sort (product_id, sort_order)" },
  { type: "index", table: "product_variants", name: "idx_variants_stock", ddl: "KEY idx_variants_stock (stock_qty)" },
  { type: "dropIndex", table: "product_variants", name: "idx_variants_product", replacedBy: "idx_variants_product_sort" },

  { type: "index", table: "addresses", name: "idx_addresses_user_default", ddl: "KEY idx_addresses_user_default (user_id, is_default)" },
  { type: "dropIndex", table: "addresses", name: "idx_addresses_user", replacedBy: "idx_addresses_user_default" },

  {
    type: "fk",
    table: "order_items",
    name: "fk_items_product",
    ddl: "CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL",
    cleanup: "UPDATE order_items oi LEFT JOIN products p ON p.id = oi.product_id SET oi.product_id = NULL WHERE oi.product_id IS NOT NULL AND p.id IS NULL",
  },
  {
    type: "fk",
    table: "order_items",
    name: "fk_items_variant",
    ddl: "CONSTRAINT fk_items_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL",
    cleanup: "UPDATE order_items oi LEFT JOIN product_variants v ON v.id = oi.variant_id SET oi.variant_id = NULL WHERE oi.variant_id IS NOT NULL AND v.id IS NULL",
  },

  { type: "check", table: "products", name: "chk_products_rating", expr: "rating >= 0 AND rating <= 5" },
  { type: "check", table: "product_variants", name: "chk_variants_stock", expr: "stock_qty >= 0" },
  { type: "check", table: "product_variants", name: "chk_variants_price", expr: "price >= 0 AND mrp >= price" },
  { type: "check", table: "cart_items", name: "chk_cart_quantity", expr: "quantity BETWEEN 1 AND 50" },
  { type: "check", table: "orders", name: "chk_orders_amounts", expr: "subtotal >= 0 AND discount_amount >= 0 AND delivery_fee >= 0 AND total_amount >= 0" },
  { type: "check", table: "order_items", name: "chk_items_quantity", expr: "quantity > 0" },
  { type: "check", table: "coupons", name: "chk_coupons_value", expr: "discount_value > 0 AND min_order_amount >= 0" },
];

module.exports = { TABLES, UPGRADES };
