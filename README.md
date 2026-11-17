# Varam — Wood-Pressed Oils Store & Admin Panel

E-commerce store and admin panel for **Varam Organic Oil (గానుగ నూనె)**, BRTS Rd, Lakshmi Nagar, Vijayawada.

- **Stack:** Node.js 18+ · Express 5 · MySQL (`mysql2/promise`, parameterised queries) · plain HTML/CSS/JavaScript (no build step)
- **Hosting:** MilesWeb cPanel → *Setup Node.js App* (Phusion Passenger). Starts with `node server.js`.
- **Storefront:** hero, category filter + search, pack-size switching with live price/MRP, stock badges, process switcher, comparison table, reviews, store map, FAQ, wishlist hearts. Motion effects (scroll reveals, parallax, tilt, magnetic buttons, counters, fly-to-cart) come from a tiny Web Animations library (`public/js/motion.js`) and respect *prefers-reduced-motion*.
- **Product page** (`/product/:slug`): pack sizes (`?size=`), quantity, live price with savings, stock, Add to cart / Buy now, WhatsApp enquiry, description/details/delivery tabs, related products, JSON-LD for Google.
- **Cart:** savings banner, "You may also like" upsells, remove with Undo, saved-address picker at checkout. Guests use `localStorage`; on login/register the guest cart is merged into MySQL (`/api/cart/merge`), so it follows the customer across devices.
- **Checkout:** home delivery (free above the threshold, otherwise a delivery charge) or free store pickup · payment by **UPI** or **pay at the store** (pickup only) — cash on delivery is not offered · coupons (`VARAM10` = 10% off) · **Place order** (MySQL transaction creates the order, its items, and decrements stock) or **Order via WhatsApp** (`wa.me/917799228444`).
- **Customer account** (`/account`): dashboard with member tier and stats, order tracker timeline, cancel pending orders (stock is restored), reorder, printable invoices (`/invoice/:orderNumber`), address book (up to 10, default address), wishlist, profile and password change with a strength meter.
- **Admin** (`/admin`): KPIs, 14-day sales chart, order-status pills, top products, low-stock quick restock, customers list (orders, total spent, WhatsApp), orders CSV export, products with inline per-pack-size price / MRP / SKU / stock editing, image upload, orders manager (filters, status updates, packing slip, WhatsApp update), coupons and store settings.

---

## Folder structure

```
.
├── server.js                  # Express app: security, static files, APIs, pages, error handler, boot
├── package.json
├── .env.example               # all configuration (copy to .env)
├── src/
│   ├── config.js              # reads environment variables
│   ├── db.js                  # MySQL pool: Unix socket first, TCP fallback; query/transaction helpers
│   ├── migrate.js             # idempotent schema + seed (categories, products, VARAM10, settings, admin)
│   ├── lib/
│   │   ├── pricing.js         # single source of truth for prices, coupons, delivery fee, totals
│   │   ├── settings.js        # store settings (cached)
│   │   ├── invoice.js         # printable invoice / packing slip + signed invoice links
│   │   └── validate.js        # input validation & sanitising
│   ├── middleware/
│   │   ├── auth.js            # JWT session cookie (HTTP-only, SameSite=Lax), requireUser/requireAdmin
│   │   └── security.js        # helmet CSP, same-origin (CSRF) check, rate limits
│   └── routes/
│       ├── auth.js            # register, login, logout, me, change password
│       ├── catalog.js         # public catalogue + settings
│       ├── cart.js            # account cart + guest-cart merge
│       ├── checkout.js        # quote, coupon validation, place order (transaction)
│       ├── account.js         # order history, reorder, profile
│       ├── admin.js           # dashboard, products/variants, upload, orders, coupons, settings
│       └── pages.js           # HTML pages, invoices, packing slips, robots, sitemap
├── views/                     # HTML pages (index, login, register, account, 404, admin/*)
├── public/
│   ├── css/                   # style.css (store), admin.css, invoice.css
│   ├── js/                    # common.js (header/cart/checkout), home.js, auth.js, account.js, admin.js, …
│   ├── img/varam-logo.jpg
│   └── uploads/               # admin-uploaded product images
└── scripts/
    ├── check.js               # syntax-check all JS
    ├── dev-db.js              # local throwaway MySQL for development
    └── smoke-test.js          # end-to-end tests against real MySQL
```

### Database tables
`users`, `addresses`, `wishlist_items`, `categories`, `products`, `product_variants`, `cart_items`, `orders`, `order_items`, `coupons`, `site_settings` — created automatically on every boot with `CREATE TABLE IF NOT EXISTS` (safe to re-run). Seed data is inserted only into an empty database; existing data and admin changes are never overwritten.

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
Open `https://varam.in/admin/login` and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. (If you left the password empty, a one-time random password is printed in the app's log — cPanel → Setup Node.js App → your app → log, or `~/varam/stderr.log`.) Change it under **Admin → Coupons & settings**, then remove `ADMIN_PASSWORD` from the environment variables.

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
- **Delivery charge / free-delivery threshold / announcement / UPI ID / Google rating / testimonials:** Admin → *Coupons & settings*.

## Content notes
- Prices are VARAM's price list (per 1 Litre; honey per 1 Kg). Stock starts at 50 per pack — set real stock in the admin.
- Product claims are deliberately conservative (wood-pressed, unrefined, natural settling). Add specific claims (temperatures, sedimentation hours, certifications, "organic") only when they can be backed up.
- Testimonials start empty — add only genuine customer or Google reviews.

## Security summary
bcrypt password hashing (cost 12) · JWT in HTTP-only, SameSite=Lax cookies (Secure in production) · role checked from the database on every request · same-origin check on all state-changing API calls · rate limits on login, registration and orders · parameterised SQL everywhere · server-side validation · prices always recomputed on the server · stock locked with `SELECT … FOR UPDATE` inside the order transaction · uploads verified by file signature · strict Content-Security-Policy (no inline scripts) · invoices only for the customer, admins, or a signed link.
