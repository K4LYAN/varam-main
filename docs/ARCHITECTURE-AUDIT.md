# Varam — architecture & security audit

Scope: the Node.js + Express + MySQL store and admin panel as of commit `2f157d9`, judged for MilesWeb cPanel hosting: Phusion Passenger, possibly several worker processes, little RAM, a shared MySQL server, and a Unix socket with TCP fallback.

## What was already sound (kept as is)

- **SQL:** every query is parameterised, and every money column is `DECIMAL(10,2)`.
- **Pricing:**
  - Prices are recalculated from MySQL for quotes and orders.
  - Checkout locks variant rows `FOR UPDATE` and decrements stock with a guarded `UPDATE … WHERE stock_qty >= ?`, all in one transaction.
  - The guest-cart merge was already one atomic `ON DUPLICATE KEY UPDATE quantity = LEAST(…, 50)` per line.
- **Security:**
  - helmet CSP; the user's role is re-read from MySQL on every request.
  - Images are checked by their magic bytes; rate limits cover login and orders.
  - Invoices need an HMAC-signed link or ownership of the order.
- **Infrastructure:** a central error handler (Express 5 catches async errors), and the Unix socket is tried first with a TCP fallback.

## Findings

Severity reflects impact on this deployment. Every item below is fixed in this change.

### Critical
None found. Prices, stock and authorisation were already enforced on the server.

### High

| # | Finding | Why it matters on MilesWeb | Fix |
|---|---|---|---|
| H1 | **MySQL session time zone was never set.** The `timezone: '+05:30'` pool option only converts JS Dates. `CURDATE()`, `NOW()` and `TIMESTAMP` values used the server's zone. | Shared MySQL servers usually run in UTC. Order times, invoices, "today's orders" and the 14-day chart would be off by 5½ hours, and coupon expiry would be wrong. | Every pooled connection runs `SET time_zone = '+05:30'` (`db/pool.js`). |
| H2 | **Sequential order numbers** (`VRM-2026-1003`). | They expose order volume and make every order guessable. Invoices were still protected, but the numbers appear in admin and WhatsApp links. | The format is now `VRM-YYMMDD-XXXXXXXX`, with 40 random bits (Crockford base32) and a retry on collision. It's generated before the insert, and `order_number` is now `NOT NULL`. |
| H3 | **Sessions survived a password change.** | A stolen 14-day cookie kept working after the victim changed their password. | Adds `users.token_version`, which is stored in the JWT and checked on every request. A password change bumps it, signing out other devices and keeping the current one. |
| H4 | **No audit trail** for price, stock, coupon, settings or order-status edits. | There's no way to tell who changed a price, or when. | Adds an `admin_audit_logs` table holding actor, IP, before/after JSON (changed keys only) and a summary. Each entry is written in the same transaction as the change, and the dashboard shows "Recent admin activity". |
| H5 | **Cart race on rapid +/− clicks.** Each click sent a PUT with a quantity computed from stale state. Responses could arrive out of order, and an edit still in flight could re-add items after checkout cleared the cart. | Customers saw wrong quantities, and the server cart drifted from the screen. | Updates are now optimistic. Each line's sync is debounced (250 ms), writes go through one serial queue, and each sends the quantity *at send time* (the last click wins). On error the cart rolls back to the server's copy. `flush()` runs before checkout and sign-out, and `keepalive` sends pending edits on `pagehide`. Quote responses carry a sequence number, so stale ones are dropped. |
| H6 | **Concurrent migrations.** Passenger can start several workers at once, and each ran `ALTER TABLE` and seeding. | On a fresh install, two workers could both seed and crash on duplicate keys, or run conflicting `ALTER`s. | The migration now runs under `GET_LOCK('varam_migrate')`. |

### Medium

| # | Finding | Fix |
|---|---|---|
| M1 | Business logic and SQL lived inside route files (admin.js had 625 lines). | Split into layers: `routes → controllers → services → db`, plus `validators/` and `utils/`. No SQL remains in routes or controllers. |
| M2 | The dashboard ran a bcrypt comparison (pure-JS bcryptjs, about 250 ms of CPU) on **every** load to detect the default password. | Adds a `users.must_change_password` flag, set at seed or boot and cleared on password change. |
| M3 | The coupon preview trusted a `subtotal` sent by the browser. | The preview now always prices the cart items on the server. |
| M4 | Coupons had no usage limit or expiry, and redemption wasn't recorded. | Adds `usage_limit`, `used_count` and `expires_at`. The coupon row is locked `FOR UPDATE` and redeemed with a guarded `UPDATE … WHERE used_count < usage_limit` inside the order transaction. Cancelling an order gives the use back. Admin coupon rows gained limit, used and expiry fields. |
| M5 | Query efficiency. | <ul><li>`DATE(created_at) = CURDATE()` couldn't use an index; it's now a range.</li><li>Five dashboard aggregate queries are merged into one.</li><li>Correlated per-row subqueries in the admin order list and CSV are now one grouped `IN (…)` query.</li><li>Per-item loops became single statements: cart merge and reorder are one multi-row upsert, order items one multi-row `INSERT`, restock one `UPDATE … JOIN`, settings one multi-row upsert, and seed batch inserts.</li><li>Single-line cart writes are one `INSERT … SELECT` that validates and upserts together.</li></ul> |
| M6 | Every page view re-read the whole catalogue, and the product page loaded every product to find one. | Adds a per-process catalogue cache (10 s TTL, so one in-flight load is shared by concurrent requests). It's cleared on any admin edit, order or cancellation. Checkout always reads live rows. |
| M7 | Indexes and constraints were incomplete. | <ul><li>New composite indexes: `orders(user_id, created_at)`, `orders(status, created_at)`, `products(category_id, is_active)`, `products(is_active, sort_order)`, `product_variants(product_id, sort_order)`, `product_variants(stock_qty)`, `addresses(user_id, is_default)` and `users(role, created_at)`. Redundant single-column indexes are dropped once their replacement exists.</li><li>`cart_items(user_id, variant_id)` was already `UNIQUE`.</li><li>New foreign keys `order_items → products/variants` (`ON DELETE SET NULL`, after cleaning orphans).</li><li>`CHECK` rules for stock ≥ 0, MRP ≥ price, cart quantity 1–50, non-negative amounts and coupon values.</li></ul> |
| M8 | The pool's queue had no limit (`queueLimit: 0`), and mysql2 caches up to 16,000 prepared statements per connection. Under overload, memory grew without bound, risking an out-of-memory kill in a small container. | Defaults are now `connectionLimit: 10` (`DB_POOL_SIZE`), `maxIdle: 3`, `queueLimit: 100` (overload returns a fast 503 instead), `connectTimeout: 10 s`, keep-alive on, and `maxPreparedStatements: 256`. |
| M9 | No health endpoint and no process-level error handlers. If the database failed during the session lookup, the user was silently signed out. Shutdown waited for idle keep-alive sockets. | <ul><li>Adds `GET /api/health`: database transport, latency, uptime and memory; it returns 200 or 503.</li><li>Adds `unhandledRejection` and `uncaughtException` handlers.</li><li>Database errors during the session lookup now return a 500 instead of a silent sign-out.</li><li>Shutdown calls `closeIdleConnections()`, has a forced-exit timeout, and keeps keep-alive above the proxy timeout.</li><li>Lock and connection errors map to 503 with `Retry-After`.</li></ul> |
| M10 | CSRF defence was one layer (an Origin/Referer check). | Adds a second layer, a double-submit token: a `varam_csrf` cookie (SameSite=Strict) that is echoed in `X-CSRF-Token`, with one automatic retry if the token is stale. |

### Low

- **CSP violation:** `motion.js` injected a `<style>` tag that the CSP blocked, logging a console error on every page. The rule moved to `effects.css`.
- **Uploaded files:** `/uploads` is now served with its own sandbox CSP.
- **Headers:** HSTS is on in production, and `object-src 'none'` and `base-uri 'self'` were added.
- **Login rate limit:** the limiter now counts failed attempts only, so a shared shop Wi-Fi isn't locked out by successful logins.
- **Upload rate limit:** a new limiter covers image uploads.

## Notes and trade-offs

- **Per-worker state:** Passenger may run several workers. Each has its own rate-limit counters and its own 10 s catalogue and 15 s settings caches. That's fine for this traffic. Moving rate limits into MySQL or Redis is only worth it if abuse shows up.
- **Connection budget:** (Passenger workers × `DB_POOL_SIZE`) must stay below the MySQL user's `max_user_connections`. For example, 2 workers × 10 = 20.
- **Deprecated syntax:** `VALUES()` in `ON DUPLICATE KEY UPDATE` is deprecated in MySQL 8.0.20+, but it's kept because MariaDB doesn't support the newer row-alias syntax.
- **Old servers:** `CHECK` constraints are best effort. On MySQL older than 8.0.16 the upgrade logs a notice and continues, because the app enforces the same rules.

## Verification

- **Tests:** `npm test` runs 30 end-to-end checks against a real MySQL 8.4 server. The new checks cover:
  - both CSRF layers;
  - the health check over the TCP fallback;
  - the random order-number format;
  - the coupon usage limit and its release on cancel;
  - expired coupons;
  - that a subtotal sent by the browser is ignored;
  - audit entries;
  - that a password change signs out other devices.
- **Upgrade path:** booting against a database created by the previous version applied all 28 upgrade steps. A restart applied none.
- **Browser:**
  - Eight fast + clicks sent **one** PUT with the final quantity. Spaced clicks were written in order, and the server matched the screen.
  - The console was clean on the storefront, product and account pages.
