# Varam — Wood-Pressed Oils Store & Admin Panel

E-commerce store and admin panel for **Varam Organic Oil (గానుగ నూనె)**, BRTS Rd, Lakshmi Nagar, Vijayawada.

- **Stack:** Node.js 18+ · Express 5 · MySQL (`mysql2/promise`, parameterised queries) · plain HTML/CSS/JavaScript (no build step)
- **Hosting:** MilesWeb cPanel → *Setup Node.js App* (Phusion Passenger). Starts with `node server.js`.
- **Storefront:** hero, category filter + search, pack-size switching with live price/MRP, stock badges, process switcher, comparison table, reviews, store map, FAQ, wishlist hearts. Motion effects (scroll reveals, parallax, tilt, magnetic buttons, counters, fly-to-cart) come from a tiny Web Animations library (`public/js/motion.js`) and respect *prefers-reduced-motion*.
- **Look & feel:** natural, traditional "gaanuga" theme (`public/css/theme.css`) — parchment paper, kumkum red, turmeric and curry-leaf green, Fraunces serif headings, Telugu accents and kolam motifs. The home page is short: hero, promises, shop, the ghani process, reviews, "order from anywhere" contact + store map, and an FAQ teaser.
- **FAQ page** (`/faq`): server-rendered from `src/content/faq.js` with topic filters and search; also feeds the home-page teaser and Google's FAQ rich results.
- **SEO:** every public page is rendered with a title, meta description, canonical URL, hreflang, Open Graph/Twitter tags and JSON-LD (Store with address, phones, emails and service area; WebSite with site search; FAQPage; Product + BreadcrumbList). `sitemap.xml` lists home, FAQ and every product; login/account/cart pages are `noindex`.
- **India & worldwide orders:** customers in India get delivery or free pickup with UPI / pay at store; customers abroad choose **Outside India** in the cart, enter country, international phone, email and postal code, and receive the shipping charge + a secure payment link by email (orders store `country` and `customer_email`).
- **Contact details** (editable in Admin → Coupons & settings): +91 77992 28444 (call/WhatsApp), +91 95157 18720, varam@varams.in (orders), info@varams.in (products & bulk), support@varams.in (order help).
- **Product page** (`/product/:slug`): pack sizes (`?size=`), quantity, live price with savings, stock, Add to cart / Buy now, WhatsApp enquiry, description/details/delivery tabs, related products, JSON-LD for Google.
- **Cart:** savings banner, "You may also like" upsells, remove with Undo, saved-address picker at checkout. Guests use `localStorage`; on login/register the guest cart is merged into MySQL (`/api/cart/merge`), so it follows the customer across devices.
- **Checkout:** home delivery (free above the threshold, otherwise a delivery charge) or free store pickup · payment by **UPI** or **pay at the store** (pickup only) — cash on delivery is not offered · coupons (`VARAM10` = 10% off) · **Place order** (MySQL transaction creates the order, its items, and decrements stock) or **Order via WhatsApp** (`wa.me/917799228444`).
- **Customer account** (`/account`): dashboard with member tier and stats, order tracker timeline, cancel pending orders (stock is restored), reorder, printable invoices (`/invoice/:orderNumber`), address book (up to 10, default address), wishlist, profile and password change with a strength meter.
- **Admin** (`/admin`): KPIs, 14-day sales chart, order-status pills, top products, low-stock quick restock, user management (customers + admins: roles, disable, password reset, sign-out everywhere), orders CSV export, products with inline per-pack-size price / MRP / SKU / stock editing, image upload, orders manager (filters, status updates, packing slip, WhatsApp update), coupons and store settings.

---

## Folder structure

Strict layers: **routes** map URLs to **controllers** (HTTP only: parse input, call a service, send the response) → **services** (business logic and *all* SQL) → **db** (pool, schema, migration). Controllers and routes contain no SQL.

```
.
├── server.js                      # boot (connect → migrate → listen) + graceful SIGTERM/SIGINT shutdown
├── database/hardening.sql         # optional: the schema upgrades as plain SQL for phpMyAdmin
├── src/
│   ├── app.js                     # builds the Express app (middleware order, routers, error handler)
│   ├── config/
│   │   ├── index.js               # environment variables (validated, frozen)
│   │   └── defaults.js            # business constants, default settings, default admin login
│   ├── db/
│   │   ├── pool.js                # mysql2 pool: Unix socket first, TCP fallback; query/transaction/ping
│   │   ├── schema.js              # tables + idempotent upgrade steps (indexes, FKs, CHECKs, columns)
│   │   ├── migrate.js             # runs schema + upgrades + seed under a MySQL named lock
│   │   └── seed.js                # categories, VARAM's products & prices, settings, VARAM10, admin
│   ├── middleware/
│   │   ├── auth.js                # JWT session cookie, token_version revocation, requireUser/requireAdmin
│   │   ├── csrf.js                # double-submit CSRF token (cookie + X-CSRF-Token header)
│   │   ├── security.js            # helmet CSP/HSTS, same-origin check, rate limits
│   │   └── errorHandler.js        # 404 + central error handler (no stack traces to clients)
│   ├── validators/index.js        # request-body parsers (never read prices/totals from the client)
│   ├── services/                  # business logic + SQL
│   │   ├── pricingService.js      # single source of truth for prices, coupons, delivery fee, totals
│   │   ├── orderService.js        # checkout transaction, random order numbers, cancel/restock, admin orders
│   │   ├── cartService.js         # account cart, atomic guest-cart merge
│   │   ├── catalogService.js      # storefront catalogue (short in-process cache)
│   │   ├── productAdminService.js # products, pack sizes, prices, stock (audited)
│   │   ├── couponService.js       # coupon preview + admin CRUD (usage limits, expiry; audited)
│   │   ├── settingsService.js     # store settings (cached; audited updates)
│   │   ├── accountService.js      # profile, address book, wishlist
│   │   ├── authService.js         # register, login, password change
│   │   ├── adminService.js        # dashboard figures, customers
│   │   ├── userAdminService.js    # user management (roles, disable, password reset, delete)
│   │   ├── auditService.js        # admin_audit_logs
│   │   ├── invoiceService.js      # HMAC-signed invoice links
│   │   ├── uploadService.js       # image magic-byte check + save
│   │   └── healthService.js       # /api/health
│   ├── controllers/               # one per area: auth, catalog, cart, checkout, account, admin, page, health
│   ├── routes/                    # api.js (mounts all API routers) + auth, catalog, cart, checkout, account, admin, pages
│   └── utils/                     # httpError, validate, csv (formula-safe), invoiceTemplate
├── views/                         # HTML pages (index, product, login, register, account, 404, admin/*)
├── public/
│   ├── css/                       # style.css, effects.css, admin.css, invoice.css
│   ├── js/                        # common.js (header/cart/checkout), motion.js, home.js, product.js, account.js, admin.js, …
│   ├── img/varam-logo.jpg
│   └── uploads/                   # admin-uploaded product images
├── docs/ARCHITECTURE-AUDIT.md     # audit findings and what changed
└── scripts/
    ├── check.js                   # syntax-check all JS
    ├── dev-db.js                  # local throwaway MySQL for development
    └── smoke-test.js              # 36 end-to-end checks against real MySQL
```

### Database tables
`users`, `addresses`, `wishlist_items`, `categories`, `products`, `product_variants`, `cart_items`, `orders`, `order_items`, `coupons`, `site_settings`, `admin_audit_logs` — created automatically on every boot with `CREATE TABLE IF NOT EXISTS`, then brought up to date by idempotent upgrade steps (safe to re-run; several Passenger workers take turns via a MySQL lock). Seed data is inserted only into an empty database; existing data and admin changes are never overwritten. `database/hardening.sql` contains the same upgrades as plain SQL if you prefer to run them in phpMyAdmin.

### Health check
`GET /api/health` returns `200 {"status":"ok", "database":{"ok":true,"transport":"socket /run/mysqld/mysqld.sock","latencyMs":1}, ...}` or `503` when MySQL is unreachable — point an uptime monitor (e.g. UptimeRobot) at it.

---

## Deploying on MilesWeb (cPanel)

### 1. Create the database
cPanel → **MySQL® Databases**
1. Create a database (e.g. `cpuser_varam`).
2. Create a user with a strong password.
3. **Add User To Database** → *All Privileges*.

### 2. Upload the code
Either **Git™ Version Control** in cPanel (clone `https://github.com/K4LYAN/varam-main.git` into e.g. `/home/<cpuser>/varam`) or upload a zip with **File Manager** and extract it. Do not upload `node_modules`.

### 3. Create the Node.js app
cPanel → **Setup Node.js App** → **Create Application**
| Field | Value |
|---|---|
| Node.js version | 18 or newer (20 recommended) |
| Application mode | Production |
| Application root | `varam` (the folder from step 2) |
| Application URL | `varam.in` |
| Application startup file | `server.js` |

Under **Environment variables**, add every variable from `.env.example`:
```
NODE_ENV=production
SITE_URL=https://varam.in
JWT_SECRET=<64 random characters>
DB_SOCKET=/run/mysqld/mysqld.sock
DB_HOST=10.169.9.188
DB_PORT=3306
DB_USER=<cpuser_dbuser>
DB_PASSWORD=<db password>
DB_NAME=<cpuser_varam>
ADMIN_EMAIL=<your email>
ADMIN_PASSWORD=<strong password, 10+ characters>
UPLOAD_DIR=/home/<cpuser>/varam-uploads
```
Click **Create**, then **Run NPM Install**, then **Restart**.

### 4. Same thing over SSH
```bash
cd ~/varam
git pull
source ~/nodevenv/varam/20/bin/activate   # path shown at the top of the Setup Node.js App screen
npm ci --omit=dev
touch tmp/restart.txt                     # or click Restart in cPanel
```

### 5. First login
Open `https://varam.in/admin/login` and sign in with the default login:

| Email | Password |
|---|---|
| `admin@varam.in` | `Varam@12345` |

(Or whatever you set in `ADMIN_EMAIL` / `ADMIN_PASSWORD` before the first start.) Then change the password under **Admin → Coupons & settings → Change admin password** — the dashboard shows a reminder until you do. The default only applies when the first admin account is created; changing it later is permanent.

### 6. HTTPS
cPanel → **SSL/TLS Status** → run AutoSSL for `varam.in`. Session cookies are marked `Secure` in production, so the site must be served over HTTPS.

### Backups
cPanel → **Backup** → download a MySQL backup regularly (or enable JetBackup if your plan includes it). Also back up `UPLOAD_DIR`.

---

## Local development

```bash
npm install
npm run dev:db     # terminal 1: temporary MySQL 8 (first run downloads ~250 MB)
npm run dev        # terminal 2: http://localhost:3000  (admin: /admin/login)
```
Put `JWT_SECRET`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` in a local `.env` (it is git-ignored).

```bash
npm run check      # syntax-check every JS file
npm test           # 20 end-to-end checks against a fresh MySQL
```

---

## Managing the store
- **Prices, MRP, SKU, stock:** Admin → *Products & prices* → edit the row → **Save**. Live immediately. MRP above price shows a strikethrough and “% off”.
- **New pack sizes** (500ml, 2L Can, 5L Tin, 15L Bulk Tin…): fill the empty row under a product → **+ Add size**.
- **Hide a product** without deleting: switch off *Active*.
- **Orders:** Admin → *Orders* → click an order → change status. *Cancelled* returns the items to stock. *Send WhatsApp update* opens a pre-written message to the customer.
- **Users** (Admin → *Users*): search and filter every account (customers and admins) with orders, total spent and last sign-in. **+ Add user** creates a customer or admin (leave the password empty to generate one, shown once). *Manage* lets you edit details, change role, disable/enable the account, reset the password, sign the user out everywhere, or delete the account (orders are kept). Users given a password by the store must choose their own at next sign-in. You can't disable, demote or delete your own account, and the store always keeps at least one active admin. Every action is in the activity log.
- **Delivery charge / free-delivery threshold / announcement / UPI ID / Google rating / testimonials:** Admin → *Coupons & settings*.

## Content notes
- Prices are VARAM's price list (per 1 Litre; honey per 1 Kg). Stock starts at 50 per pack — set real stock in the admin.
- Product claims are deliberately conservative (wood-pressed, unrefined, natural settling). Add specific claims (temperatures, sedimentation hours, certifications, "organic") only when they can be backed up.
- Testimonials start empty — add only genuine customer or Google reviews.

## Security summary
bcrypt password hashing (cost 12) · JWT in HTTP-only, SameSite=Lax cookies (Secure in production); a password change revokes every other session (`token_version`) · role checked from the database on every request · CSRF: same-origin check **and** double-submit token on every state-changing API call · rate limits on login (failed attempts), registration, password change, orders and uploads · parameterised SQL everywhere · server-side validation · prices, discounts and totals always recomputed from MySQL (client values ignored) · stock locked with `SELECT … FOR UPDATE` and decremented with a guarded `UPDATE … WHERE stock_qty >= ?` inside the order transaction · coupon usage limits enforced inside the same transaction · random, non-sequential order numbers plus ownership check or HMAC-signed link for invoices · uploads verified by file signature · strict Content-Security-Policy (no inline scripts or `<style>` tags) · every admin price/stock/coupon/settings/order-status change written to `admin_audit_logs` · stack traces never sent to clients.
