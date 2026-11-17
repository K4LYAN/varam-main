-- =====================================================================
-- Varam — schema hardening (idempotent; safe to run any number of times)
--
-- The app applies exactly these changes automatically on boot
-- (src/db/schema.js → UPGRADES). Use this file only if you prefer to run
-- it by hand: cPanel → phpMyAdmin → select the Varam database → SQL tab →
-- paste and run. Needs MySQL 8.0.16+ or MariaDB 10.2+ for CHECK rules
-- (older servers simply skip them) and the CREATE ROUTINE privilege that
-- cPanel database users have by default.
--
-- Adds: session revocation + forced password change columns, coupon usage
-- limits/expiry, composite indexes, order_items foreign keys, CHECK rules
-- and the admin_audit_logs table.
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- Helper procedures (dropped again at the end)
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS varam_add_column;
DROP PROCEDURE IF EXISTS varam_add_index;
DROP PROCEDURE IF EXISTS varam_drop_index;
DROP PROCEDURE IF EXISTS varam_add_constraint;

DELIMITER $$

CREATE PROCEDURE varam_add_column(IN p_table VARCHAR(64), IN p_column VARCHAR(64), IN p_ddl TEXT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_column) THEN
    SET @varam_sql = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN ', p_ddl);
    PREPARE stmt FROM @varam_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$

CREATE PROCEDURE varam_add_index(IN p_table VARCHAR(64), IN p_index VARCHAR(64), IN p_ddl TEXT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND INDEX_NAME = p_index) THEN
    SET @varam_sql = CONCAT('ALTER TABLE `', p_table, '` ADD ', p_ddl);
    PREPARE stmt FROM @varam_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$

-- Drops a redundant index only when its replacement already exists
CREATE PROCEDURE varam_drop_index(IN p_table VARCHAR(64), IN p_index VARCHAR(64), IN p_replacement VARCHAR(64))
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND INDEX_NAME = p_index)
     AND EXISTS (SELECT 1 FROM information_schema.STATISTICS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND INDEX_NAME = p_replacement) THEN
    SET @varam_sql = CONCAT('ALTER TABLE `', p_table, '` DROP INDEX `', p_index, '`');
    PREPARE stmt FROM @varam_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$

-- Foreign keys and CHECK constraints
CREATE PROCEDURE varam_add_constraint(IN p_table VARCHAR(64), IN p_name VARCHAR(64), IN p_ddl TEXT)
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
    SELECT CONCAT('Skipped ', p_name, ' (not supported by this server or existing rows violate it)') AS notice;
  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND CONSTRAINT_NAME = p_name) THEN
    SET @varam_sql = CONCAT('ALTER TABLE `', p_table, '` ADD ', p_ddl);
    PREPARE stmt FROM @varam_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$

DELIMITER ;

-- ---------------------------------------------------------------------
-- 1. Users: revoke old sessions on password change; force default-password change
-- ---------------------------------------------------------------------
CALL varam_add_column('users', 'token_version', 'token_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER pincode');
CALL varam_add_column('users', 'must_change_password', 'must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER token_version');
-- User management: disable accounts without deleting them; show last sign-in
CALL varam_add_column('users', 'is_active', 'is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER must_change_password');
CALL varam_add_column('users', 'last_login_at', 'last_login_at TIMESTAMP NULL DEFAULT NULL AFTER is_active');
-- Account lockout after repeated wrong passwords
CALL varam_add_column('users', 'failed_login_count', 'failed_login_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER last_login_at');
CALL varam_add_column('users', 'locked_until', 'locked_until TIMESTAMP NULL DEFAULT NULL AFTER failed_login_count');
CALL varam_add_index('users', 'idx_users_role_created', 'KEY idx_users_role_created (role, created_at)');

-- ---------------------------------------------------------------------
-- 2. Coupons: usage limit, usage counter, expiry
-- ---------------------------------------------------------------------
CALL varam_add_column('coupons', 'usage_limit', 'usage_limit INT UNSIGNED NULL AFTER min_order_amount');
CALL varam_add_column('coupons', 'used_count', 'used_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER usage_limit');
CALL varam_add_column('coupons', 'expires_at', 'expires_at DATETIME NULL AFTER used_count');

-- ---------------------------------------------------------------------
-- 3. Orders: order_number is always set; composite indexes for
--    "my orders, newest first" and dashboard status/date queries
-- ---------------------------------------------------------------------
UPDATE orders SET order_number = CONCAT('VRM-LEGACY-', id) WHERE order_number IS NULL;
ALTER TABLE orders MODIFY order_number VARCHAR(30) NOT NULL;
-- International orders: country, contact email, payment link / bank transfer
CALL varam_add_column('orders', 'customer_email', 'customer_email VARCHAR(190) NULL AFTER customer_phone');
CALL varam_add_column('orders', 'country', 'country VARCHAR(60) NOT NULL DEFAULT ''India'' AFTER pincode');
ALTER TABLE orders MODIFY pincode VARCHAR(12) NULL;
ALTER TABLE orders MODIFY payment_method ENUM('UPI','COD','STORE','INTL') NOT NULL;
CALL varam_add_index('orders', 'idx_orders_user_created', 'KEY idx_orders_user_created (user_id, created_at)');
CALL varam_add_index('orders', 'idx_orders_status_created', 'KEY idx_orders_status_created (status, created_at)');
CALL varam_drop_index('orders', 'idx_orders_user', 'idx_orders_user_created');
CALL varam_drop_index('orders', 'idx_orders_status', 'idx_orders_status_created');

-- ---------------------------------------------------------------------
-- 4. Products / variants / addresses: composite indexes
--    (cart_items already has UNIQUE (user_id, variant_id))
-- ---------------------------------------------------------------------
CALL varam_add_index('products', 'idx_products_category_active', 'KEY idx_products_category_active (category_id, is_active)');
CALL varam_add_index('products', 'idx_products_active_sort', 'KEY idx_products_active_sort (is_active, sort_order)');
CALL varam_drop_index('products', 'idx_products_category', 'idx_products_category_active');

CALL varam_add_index('product_variants', 'idx_variants_product_sort', 'KEY idx_variants_product_sort (product_id, sort_order)');
CALL varam_add_index('product_variants', 'idx_variants_stock', 'KEY idx_variants_stock (stock_qty)');
CALL varam_drop_index('product_variants', 'idx_variants_product', 'idx_variants_product_sort');

CALL varam_add_index('addresses', 'idx_addresses_user_default', 'KEY idx_addresses_user_default (user_id, is_default)');
CALL varam_drop_index('addresses', 'idx_addresses_user', 'idx_addresses_user_default');

-- ---------------------------------------------------------------------
-- 5. order_items → products / variants foreign keys (history survives deletes)
-- ---------------------------------------------------------------------
UPDATE order_items oi LEFT JOIN products p ON p.id = oi.product_id
  SET oi.product_id = NULL WHERE oi.product_id IS NOT NULL AND p.id IS NULL;
UPDATE order_items oi LEFT JOIN product_variants v ON v.id = oi.variant_id
  SET oi.variant_id = NULL WHERE oi.variant_id IS NOT NULL AND v.id IS NULL;
CALL varam_add_constraint('order_items', 'fk_items_product',
  'CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL');
CALL varam_add_constraint('order_items', 'fk_items_variant',
  'CONSTRAINT fk_items_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL');

-- ---------------------------------------------------------------------
-- 6. CHECK rules (the app validates these too; the database is the last line)
-- ---------------------------------------------------------------------
CALL varam_add_constraint('products', 'chk_products_rating', 'CONSTRAINT chk_products_rating CHECK (rating >= 0 AND rating <= 5)');
CALL varam_add_constraint('product_variants', 'chk_variants_stock', 'CONSTRAINT chk_variants_stock CHECK (stock_qty >= 0)');
CALL varam_add_constraint('product_variants', 'chk_variants_price', 'CONSTRAINT chk_variants_price CHECK (price >= 0 AND mrp >= price)');
CALL varam_add_constraint('cart_items', 'chk_cart_quantity', 'CONSTRAINT chk_cart_quantity CHECK (quantity BETWEEN 1 AND 50)');
CALL varam_add_constraint('orders', 'chk_orders_amounts',
  'CONSTRAINT chk_orders_amounts CHECK (subtotal >= 0 AND discount_amount >= 0 AND delivery_fee >= 0 AND total_amount >= 0)');
CALL varam_add_constraint('order_items', 'chk_items_quantity', 'CONSTRAINT chk_items_quantity CHECK (quantity > 0)');
CALL varam_add_constraint('coupons', 'chk_coupons_value', 'CONSTRAINT chk_coupons_value CHECK (discount_value > 0 AND min_order_amount >= 0)');

-- ---------------------------------------------------------------------
-- 7. Admin audit log (who changed which price / stock / coupon / setting / order, when, from where)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_audit_logs (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Clean up helpers
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS varam_add_column;
DROP PROCEDURE IF EXISTS varam_add_index;
DROP PROCEDURE IF EXISTS varam_drop_index;
DROP PROCEDURE IF EXISTS varam_add_constraint;

-- Note: on its next start the app checks whether the admin still uses the
-- default password and, if so, shows a "change it now" reminder on the dashboard.
