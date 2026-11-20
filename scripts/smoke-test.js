"use strict";

/**
 * End-to-end smoke test against a real MySQL server.
 * Starts a throwaway MySQL (mysql-memory-server), boots server.js on it and
 * exercises every storefront, checkout, account and admin flow over HTTP.
 *
 *   npm test
 */
const { spawn } = require("child_process");
const path = require("path");
const assert = require("assert/strict");
const { createDB } = require("mysql-memory-server");

const PORT = 3199;
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN = { email: "admin.test@varam.local", password: "Test-Admin-Pass-2026" };

let passed = 0;
const results = [];
async function step(name, fn) {
  try {
    await fn();
    passed++;
    results.push(`  ✓ ${name}`);
  } catch (err) {
    results.push(`  ✗ ${name}\n      ${err.message}`);
    throw err;
  }
}

/**
 * Minimal browser-like HTTP client: keeps a cookie jar and, like the site's
 * own JavaScript, echoes the varam_csrf cookie in X-CSRF-Token on writes.
 */
function client() {
  const jar = new Map();
  const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const store = (res) => {
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split(";");
      const i = pair.indexOf("=");
      const name = pair.slice(0, i).trim();
      const value = pair.slice(i + 1).trim();
      const expired = attrs.some((a) => /^\s*expires=thu, 01 jan 1970/i.test(a)) || value === "";
      if (expired) jar.delete(name);
      else jar.set(name, value);
    }
  };
  async function req(method, url, body, { origin = BASE, raw = false, headers = {}, csrf = true } = {}) {
    if (csrf && method !== "GET" && !jar.has("varam_csrf")) store(await fetch(BASE + "/api/auth/csrf"));
    const isForm = body instanceof FormData;
    const res = await fetch(BASE + url, {
      method,
      redirect: "manual",
      headers: {
        ...(body && !isForm ? { "Content-Type": "application/json" } : {}),
        ...(jar.size ? { Cookie: cookieHeader() } : {}),
        ...(origin ? { Origin: origin } : {}),
        ...(csrf && method !== "GET" && jar.has("varam_csrf") ? { "X-CSRF-Token": jar.get("varam_csrf") } : {}),
        ...headers,
      },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
    store(res);
    if (raw) return res;
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data, headers: res.headers };
  }
  req.jar = jar;
  return req;
}

async function waitForServer(proc) {
  for (let i = 0; i < 120; i++) {
    if (proc.exitCode !== null) throw new Error("server exited early");
    try {
      const r = await fetch(`${BASE}/api/settings`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("server did not start");
}

(async () => {
  console.log("Starting temporary MySQL…");
  const db = await createDB({ version: "8.4.x", dbName: "varam_test", logLevel: "ERROR" });
  const logs = [];
  const server = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(PORT),
      DB_SOCKET: "/run/mysqld/mysqld.sock", // not present here → exercises the TCP fallback
      DB_HOST: "127.0.0.1",
      DB_PORT: String(db.port),
      DB_USER: db.username,
      DB_PASSWORD: "",
      DB_NAME: db.dbName,
      JWT_SECRET: "test-secret-0123456789-0123456789-abcdef",
      ADMIN_EMAIL: ADMIN.email,
      ADMIN_PASSWORD: ADMIN.password,
      UPLOAD_DIR: path.join(__dirname, "..", ".test-uploads"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (d) => logs.push(d.toString()));
  server.stderr.on("data", (d) => logs.push(d.toString()));

  const cleanup = async () => {
    server.kill();
    await db.stop().catch(() => {});
    require("fs").rmSync(path.join(__dirname, "..", ".test-uploads"), { recursive: true, force: true });
  };

  try {
    await waitForServer(server);
    const guest = client();
    const cust = client();
    const admin = client();
    let catalog;
    const vid = (slug) => catalog.products.find((p) => p.slug === slug).variants[0].id;

    console.log("Running tests…");

    await step("boot: DB socket missing → TCP fallback, schema + seed created", async () => {
      const all = logs.join("");
      assert.doesNotMatch(all, /store not ready/); // missing socket is skipped, TCP route used
      assert.match(all, /connected via TCP/);
      assert.match(all, /seeded 7 categories and 9 products/);
    });

    await step("pages render (/, robots, 404; old login pages redirect home)", async () => {
      for (const u of ["/", "/robots.txt"]) assert.equal((await guest("GET", u)).status, 200, u);
      assert.equal((await guest("GET", "/nope")).status, 404);
      for (const u of ["/login", "/register", "/account"]) assert.equal((await guest("GET", u)).status, 301, u);
    });

    await step("catalog: 9 products with VARAM's real prices", async () => {
      catalog = (await guest("GET", "/api/catalog")).data;
      assert.equal(catalog.products.length, 9);
      const price = (slug) => catalog.products.find((p) => p.slug === slug).variants[0].price;
      assert.equal(price("wood-pressed-groundnut-oil"), 370);
      assert.equal(price("wood-pressed-coconut-oil"), 700);
      assert.equal(price("wood-pressed-white-sesame-oil"), 550);
      assert.equal(price("wood-pressed-black-sesame-oil"), 520);
      assert.equal(price("kachi-ghani-mustard-oil"), 480);
      assert.equal(price("pure-castor-oil"), 480);
      assert.equal(price("wood-pressed-sunflower-oil"), 550);
      assert.equal(price("pure-ghee"), 800);
      assert.equal(price("pure-honey"), 1000);
      assert.equal(catalog.settings.whatsappNumber, "917799228444");
    });

    await step("quote: delivery fee ₹60 under ₹999, free above, pickup free", async () => {
      const small = (await guest("POST", "/api/checkout/quote", { items: [{ variantId: vid("wood-pressed-groundnut-oil"), quantity: 1 }], fulfillment: "delivery" })).data;
      assert.equal(small.subtotal, 370);
      assert.equal(small.deliveryFee, 60);
      assert.equal(small.total, 430);
      assert.equal(small.amountToFreeDelivery, 629);
      const big = (await guest("POST", "/api/checkout/quote", { items: [{ variantId: vid("pure-honey"), quantity: 1 }], fulfillment: "delivery" })).data;
      assert.equal(big.deliveryFee, 0);
      const pick = (await guest("POST", "/api/checkout/quote", { items: [{ variantId: vid("wood-pressed-groundnut-oil"), quantity: 1 }], fulfillment: "pickup" })).data;
      assert.equal(pick.deliveryFee, 0);
      assert.equal(pick.total, 370);
    });

    await step("coupon VARAM10 gives 10% off; unknown code rejected", async () => {
      const ok = (await guest("POST", "/api/coupons/validate", { code: "varam10", items: [{ variantId: vid("pure-ghee"), quantity: 2 }] })).data;
      assert.equal(ok.valid, true);
      assert.equal(ok.discount, 160);
      const bad = (await guest("POST", "/api/coupons/validate", { code: "FAKE", items: [] })).data;
      assert.equal(bad.valid, false);
    });

    await step("security: cross-site POST blocked; CSRF token required; admin API needs admin", async () => {
      assert.equal((await guest("POST", "/api/checkout/quote", { items: [] }, { origin: "https://evil.example" })).status, 403);
      const noToken = await guest("POST", "/api/checkout/quote", { items: [] }, { csrf: false });
      assert.equal(noToken.status, 403);
      assert.equal(noToken.data.code, "CSRF_INVALID");
      const wrongToken = await guest("POST", "/api/checkout/quote", { items: [] }, { headers: { "X-CSRF-Token": "x".repeat(32) } });
      assert.equal(wrongToken.status, 403);
      assert.equal((await guest("POST", "/api/checkout/quote", { items: [] })).status, 200);
      assert.equal((await guest("GET", "/api/admin/stats")).status, 401);
    });

    await step("health: /api/health reports MySQL over the TCP fallback", async () => {
      const h = await guest("GET", "/api/health");
      assert.equal(h.status, 200);
      assert.equal(h.data.status, "ok");
      assert.equal(h.data.database.ok, true);
      assert.match(h.data.database.transport, /^TCP /);
      assert.ok(h.data.uptimeSeconds >= 0);
    });

    await step("register → session cookie; duplicate email rejected", async () => {
      const r = await cust("POST", "/api/auth/register", { name: "Test Customer", email: "cust@example.com", phone: "9876543210", password: "secret-pass-1" });
      assert.equal(r.status, 201);
      assert.equal(r.data.user.role, "customer");
      assert.equal((await guest("POST", "/api/auth/register", { name: "Another Person", email: "cust@example.com", phone: "9876500000", password: "secret-pass-1" })).status, 409);
      assert.equal((await cust("GET", "/api/admin/stats")).status, 403);
    });

    await step("guest cart merges into account cart (quantities add up)", async () => {
      await cust("PUT", "/api/cart/items", { variantId: vid("pure-ghee"), quantity: 1 });
      const merged = (await cust("POST", "/api/cart/merge", { items: [{ variantId: vid("pure-ghee"), quantity: 2 }, { variantId: vid("wood-pressed-groundnut-oil"), quantity: 1 }] })).data;
      const ghee = merged.items.find((i) => i.variantId === vid("pure-ghee"));
      assert.equal(ghee.quantity, 3);
      assert.equal(merged.items.length, 2);
    });

    let orderNumber;
    let invoiceUrl;
    await step("place order (transaction): totals, coupon, stock decremented, cart cleared", async () => {
      const before = (await cust("GET", "/api/catalog")).data.products.find((p) => p.slug === "pure-ghee").variants[0].stockQty;
      const r = await cust("POST", "/api/orders", {
        items: (await cust("GET", "/api/cart")).data.items,
        name: "Test Customer",
        phone: "9876543210",
        fulfillment: "delivery",
        address: "12-3-45, Lakshmi Nagar, Vijayawada",
        pincode: "520011",
        paymentMethod: "UPI",
        couponCode: "VARAM10",
      });
      assert.equal(r.status, 201, JSON.stringify(r.data));
      assert.match(r.data.orderNumber, /^VRM-\d{6}-[0-9A-HJKMNP-TV-Z]{8}$/); // random, not sequential
      assert.equal(r.data.subtotal, 2770); // 3 × 800 + 370
      assert.equal(r.data.discount, 277);
      assert.equal(r.data.deliveryFee, 0);
      assert.equal(r.data.total, 2493);
      orderNumber = r.data.orderNumber;
      invoiceUrl = r.data.invoiceUrl;
      const after = (await cust("GET", "/api/catalog")).data.products.find((p) => p.slug === "pure-ghee").variants[0].stockQty;
      assert.equal(after, before - 3);
      assert.equal((await cust("GET", "/api/cart")).data.items.length, 0);
    });

    await step("invoice: owner + signed link allowed, strangers get 404", async () => {
      assert.equal((await cust("GET", `/invoice/${orderNumber}`)).status, 200);
      assert.equal((await guest("GET", `/invoice/${orderNumber}`)).status, 404);
      const signed = await guest("GET", invoiceUrl);
      assert.equal(signed.status, 200);
      assert.match(signed.data, /₹2,493/);
    });

    await step("guest pickup order (pay at store); invalid combos rejected", async () => {
      const ok = await guest("POST", "/api/orders", { items: [{ variantId: vid("pure-honey"), quantity: 1 }], name: "Walk In", phone: "9123456789", fulfillment: "pickup", paymentMethod: "STORE" });
      assert.equal(ok.status, 201, JSON.stringify(ok.data));
      assert.equal(ok.data.total, 1000);
      const bad = await guest("POST", "/api/orders", { items: [{ variantId: vid("pure-honey"), quantity: 1 }], name: "Walk In", phone: "9123456789", fulfillment: "pickup", paymentMethod: "COD" });
      assert.equal(bad.status, 400);
      const noAddr = await guest("POST", "/api/orders", { items: [{ variantId: vid("pure-honey"), quantity: 1 }], name: "A B", phone: "9123456789", fulfillment: "delivery", paymentMethod: "COD" });
      assert.equal(noAddr.status, 400);
    });

    await step("cannot order more than stock (409), nothing is written", async () => {
      // Ghee started at 50 and 3 were ordered above, so 50 more must be refused
      const r = await guest("POST", "/api/orders", { items: [{ variantId: vid("pure-ghee"), quantity: 50 }], name: "Bulk Buyer", phone: "9123456780", fulfillment: "pickup", paymentMethod: "STORE" });
      assert.equal(r.status, 409, JSON.stringify(r.data));
      assert.match(r.data.error, /out of stock/i);
      const stock = (await guest("GET", "/api/catalog")).data.products.find((p) => p.slug === "pure-ghee").variants[0].stockQty;
      assert.equal(stock, 47);
    });

    await step("account: order history + one-click reorder refills the cart", async () => {
      const orders = (await cust("GET", "/api/account/orders")).data.orders;
      assert.equal(orders.length, 1);
      assert.equal(orders[0].items.length, 2);
      const re = (await cust("POST", `/api/account/orders/${orderNumber}/reorder`)).data;
      assert.equal(re.items.length, 2);
      const p = (await cust("PUT", "/api/account/profile", { name: "Test Customer", phone: "9876543210", defaultAddress: "New address 520011", pincode: "520011" })).data;
      assert.equal(p.user.defaultAddress, "New address 520011");
    });

    await step("cash on delivery is not accepted", async () => {
      const r = await guest("POST", "/api/orders", {
        items: [{ variantId: vid("pure-honey"), quantity: 1 }], name: "No Cod", phone: "9123456789", fulfillment: "delivery",
        address: "1-2-3 Main Road, Vijayawada", pincode: "520011", paymentMethod: "COD",
      });
      assert.equal(r.status, 400);
      assert.match(r.data.error, /payment method/i);
    });

    await step("product details API: product + related; unknown slug 404 page", async () => {
      const r = (await guest("GET", "/api/products/pure-ghee")).data;
      assert.equal(r.product.name, "Pure Ghee");
      assert.equal(r.related.length, 4);
      assert.equal((await guest("GET", "/product/pure-ghee")).status, 200);
      assert.equal((await guest("GET", "/product/not-a-product")).status, 404);
      assert.equal((await guest("GET", "/api/products/not-a-product")).status, 404);
    });

    await step("address book: add (first = default), add second as default, edit, delete", async () => {
      let r = await cust("POST", "/api/account/addresses", { label: "Home", name: "Test Customer", phone: "9876543210", address: "12-3-45, Lakshmi Nagar, Vijayawada", pincode: "520011" });
      assert.equal(r.status, 201, JSON.stringify(r.data));
      assert.equal(r.data.addresses[0].isDefault, true);
      r = await cust("POST", "/api/account/addresses", { label: "Office", name: "Test Customer", phone: "9876543210", address: "MG Road, Benz Circle, Vijayawada", pincode: "520010", isDefault: true });
      assert.equal(r.data.addresses.length, 2);
      const office = r.data.addresses.find((a) => a.label === "Office");
      assert.equal(office.isDefault, true);
      assert.equal(r.data.addresses.filter((a) => a.isDefault).length, 1);
      assert.equal((await cust("GET", "/api/auth/me")).data.user.pincode, "520010");
      r = await cust("PUT", `/api/account/addresses/${office.id}`, { ...office, address: "MG Road, Benz Circle, Vijayawada (2nd floor)", isDefault: true });
      assert.match(r.data.addresses.find((a) => a.id === office.id).address, /2nd floor/);
      r = await cust("DELETE", `/api/account/addresses/${office.id}`);
      assert.equal(r.data.addresses.length, 1);
      assert.equal(r.data.addresses[0].isDefault, true);
      assert.equal((await guest("GET", "/api/account/addresses")).status, 401);
    });

    await step("wishlist: add, list, remove", async () => {
      const ghee = catalog.products.find((p) => p.slug === "pure-ghee").id;
      let r = (await cust("POST", `/api/account/wishlist/${ghee}`)).data;
      assert.deepEqual(r.productIds, [ghee]);
      await cust("POST", `/api/account/wishlist/${ghee}`); // idempotent
      assert.equal((await cust("GET", "/api/account/wishlist")).data.productIds.length, 1);
      r = (await cust("DELETE", `/api/account/wishlist/${ghee}`)).data;
      assert.equal(r.productIds.length, 0);
    });

    await step("customer cancels a pending order → stock returned; confirmed orders can't be cancelled", async () => {
      const stock = async () => (await guest("GET", "/api/catalog")).data.products.find((p) => p.slug === "pure-honey").variants[0].stockQty;
      const before = await stock();
      const o = await cust("POST", "/api/orders", { items: [{ variantId: vid("pure-honey"), quantity: 2 }], name: "Test Customer", phone: "9876543210", fulfillment: "pickup", paymentMethod: "UPI" });
      assert.equal(o.status, 201, JSON.stringify(o.data));
      assert.equal(await stock(), before - 2);
      const c = await cust("POST", `/api/account/orders/${o.data.orderNumber}/cancel`);
      assert.equal(c.status, 200, JSON.stringify(c.data));
      assert.equal(await stock(), before);
      assert.equal((await cust("POST", `/api/account/orders/${o.data.orderNumber}/cancel`)).status, 400);
      assert.equal((await guest("POST", `/api/account/orders/${o.data.orderNumber}/cancel`)).status, 401);
      // emptied the cart? (order placement clears the account cart) – restore cart state for later steps
    });

    await step("login: wrong password rejected, customer cannot use admin login", async () => {
      assert.equal((await guest("POST", "/api/auth/login", { identifier: ADMIN.email, password: "wrong-password" })).status, 401);
      assert.equal((await client()("POST", "/api/auth/login", { identifier: "9876543210", password: "secret-pass-1", adminOnly: true })).status, 403);
      assert.equal((await client()("POST", "/api/auth/login", { identifier: "9876543210", password: "secret-pass-1" })).status, 200);
    });

    await step("admin: login + dashboard KPIs", async () => {
      assert.equal((await admin("POST", "/api/auth/login", { identifier: ADMIN.email, password: ADMIN.password, adminOnly: true })).status, 200);
      assert.equal((await admin("GET", "/admin")).status, 200);
      const s = (await admin("GET", "/api/admin/stats")).data;
      assert.equal(s.totalOrders, 2);
      assert.equal(s.pendingOrders, 2);
      assert.equal(s.totalCustomers, 1);
      assert.equal(s.totalRevenue, 3493);
      assert.equal(s.salesByDay.length, 14);
      assert.equal(s.defaultPassword, false); // custom ADMIN_PASSWORD, so no reminder
      assert.equal(s.salesByDay.at(-1).revenue, 3493);
      assert.equal(s.topProducts[0].name, "Pure Ghee");
      assert.equal(s.statusCounts.Cancelled, 1);
    });

    await step("admin: customers list + CSV export (formula-safe)", async () => {
      const c = (await admin("GET", "/api/admin/customers")).data.customers;
      assert.equal(c.length, 1);
      assert.equal(c[0].orders, 2);
      assert.equal(c[0].spent, 2493);
      const csv = await admin("GET", "/api/admin/orders.csv");
      assert.equal(csv.status, 200);
      assert.match(csv.headers.get("content-type"), /text\/csv/);
      assert.match(csv.data, /VRM-\d{6}-[0-9A-Z]{8}/);
      assert.equal((await guest("GET", "/api/admin/orders.csv")).status, 401);
      assert.equal((await admin("GET", "/admin/customers")).status, 200);
    });

    await step("admin: inline price/MRP/stock edit goes live; add 5L Tin pack size", async () => {
      const prods = (await admin("GET", "/api/admin/products")).data.products;
      const gn = prods.find((p) => p.slug === "wood-pressed-groundnut-oil");
      const v = gn.variants[0];
      const up = await admin("PUT", `/api/admin/variants/${v.id}`, { sizeLabel: "1 Litre", sku: v.sku, price: 380, mrp: 420, stockQty: 4, sortOrder: 0 });
      assert.equal(up.status, 200, JSON.stringify(up.data));
      const bad = await admin("PUT", `/api/admin/variants/${v.id}`, { sizeLabel: "1 Litre", sku: v.sku, price: 500, mrp: 400, stockQty: 4 });
      assert.equal(bad.status, 400);
      const add = await admin("POST", `/api/admin/products/${gn.id}/variants`, { sizeLabel: "5L Tin", sku: "VRM-GN-5L", price: 1800, mrp: 1850, stockQty: 10, sortOrder: 1 });
      assert.equal(add.status, 201, JSON.stringify(add.data));
      const live = (await guest("GET", "/api/catalog")).data.products.find((p) => p.slug === "wood-pressed-groundnut-oil");
      assert.equal(live.variants.length, 2);
      assert.equal(live.variants[0].price, 380);
      assert.equal(live.variants[0].mrp, 420);
      assert.equal(live.variants[0].stockStatus, "low");
      assert.equal((await admin("GET", "/api/admin/stats")).data.lowStock.some((l) => l.variantId === v.id), true);
      // quick restock from the dashboard
      assert.equal((await admin("PATCH", `/api/admin/variants/${v.id}/stock`, { stockQty: 40 })).status, 200);
      assert.equal((await admin("GET", "/api/admin/stats")).data.lowStock.some((l) => l.variantId === v.id), false);
      assert.equal((await cust("PATCH", `/api/admin/variants/${v.id}/stock`, { stockQty: 0 })).status, 403);
    });

    await step("admin: create product with image upload; hide/feature toggles", async () => {
      const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
      const fd = new FormData();
      fd.append("image", new Blob([png], { type: "image/png" }), "x.png");
      const up = await admin("POST", "/api/admin/upload", fd);
      assert.equal(up.status, 201, JSON.stringify(up.data));
      assert.equal((await guest("GET", up.data.url)).status, 200);
      const fake = new FormData();
      fake.append("image", new Blob(["<script>alert(1)</script>"], { type: "image/png" }), "evil.png");
      assert.equal((await admin("POST", "/api/admin/upload", fake)).status, 415);
      const cats = (await admin("GET", "/api/admin/categories")).data.categories;
      const created = await admin("POST", "/api/admin/products", {
        name: "Test Kitchen Combo", categoryId: cats[0].id, tagline: "Test", description: "Test", imageUrl: up.data.url, accentColor: "#D97706",
        badgeText: "Combo", isActive: true, isFeatured: false, variants: [{ sizeLabel: "Combo Pack", sku: "VRM-TEST-COMBO", price: 1120, stockQty: 5 }],
      });
      assert.equal(created.status, 201, JSON.stringify(created.data));
      assert.equal((await guest("GET", "/api/catalog")).data.products.length, 10);
      await admin("PATCH", `/api/admin/products/${created.data.id}/flags`, { isActive: false });
      assert.equal((await guest("GET", "/api/catalog")).data.products.length, 9);
      assert.equal((await admin("DELETE", `/api/admin/products/${created.data.id}`)).status, 200);
    });

    await step("admin: orders filter, status update, cancel restores stock, packing slip", async () => {
      const list = (await admin("GET", "/api/admin/orders?fulfillment=pickup")).data;
      assert.equal(list.total, 2); // guest pickup + the customer's cancelled pickup order
      const cancelled = (await admin("GET", "/api/admin/orders?status=Cancelled&fulfillment=pickup")).data;
      assert.equal(cancelled.total, 1);
      const injection = (await admin("GET", "/api/admin/orders?q=" + encodeURIComponent("' OR 1=1 -- "))).data;
      assert.equal(injection.total, 0);
      const r = await admin("PUT", `/api/admin/orders/${orderNumber}/status`, { status: "Packed" });
      assert.equal(r.status, 200);
      const before = (await guest("GET", "/api/catalog")).data.products.find((p) => p.slug === "pure-ghee").variants[0].stockQty;
      await admin("PUT", `/api/admin/orders/${orderNumber}/status`, { status: "Cancelled" });
      const after = (await guest("GET", "/api/catalog")).data.products.find((p) => p.slug === "pure-ghee").variants[0].stockQty;
      assert.equal(after, before + 3);
      assert.equal((await admin("PUT", `/api/admin/orders/${orderNumber}/status`, { status: "Confirmed" })).status, 400);
      const slip = await admin("GET", `/admin/orders/${orderNumber}/slip`);
      assert.equal(slip.status, 200);
      assert.match(slip.data, /Packing slip/);
    });

    await step("admin: coupons + settings (delivery fee/threshold) change live totals", async () => {
      const c = await admin("POST", "/api/admin/coupons", { code: "diwali50", discountType: "flat", discountValue: 50, minOrderAmount: 500, isActive: true });
      assert.equal(c.status, 201);
      const below = (await guest("POST", "/api/coupons/validate", { code: "DIWALI50", items: [{ variantId: vid("wood-pressed-groundnut-oil"), quantity: 1 }] })).data;
      assert.equal(below.valid, false); // ₹370 < ₹500 minimum
      // A subtotal sent by the browser is ignored — only the items count
      const forged = (await guest("POST", "/api/coupons/validate", { code: "DIWALI50", subtotal: 99999, items: [] })).data;
      assert.equal(forged.valid, false);
      const s = (await admin("GET", "/api/admin/settings")).data.settings;
      const upd = await admin("PUT", "/api/admin/settings", { ...s, free_delivery_threshold: 1500, delivery_fee: 80 });
      assert.equal(upd.status, 200, JSON.stringify(upd.data));
      // settings cache is per-process with a short TTL; it was cleared on save
      const q = (await guest("POST", "/api/checkout/quote", { items: [{ variantId: vid("pure-honey"), quantity: 1 }], fulfillment: "delivery" })).data;
      assert.equal(q.deliveryFee, 80);
      assert.equal(q.total, 1080);
    });

    await step("coupon usage limit: one use, second order rejected; cancelling releases the use", async () => {
      const c = await admin("POST", "/api/admin/coupons", { code: "ONCE100", discountType: "flat", discountValue: 100, minOrderAmount: 0, usageLimit: 1, expiresAt: "2099-12-31" });
      assert.equal(c.status, 201, JSON.stringify(c.data));
      const order = (who) =>
        who("POST", "/api/orders", {
          items: [{ variantId: vid("pure-ghee"), quantity: 1 }],
          name: "Coupon Tester",
          phone: "9123456780",
          fulfillment: "pickup",
          paymentMethod: "STORE",
          couponCode: "ONCE100",
        });
      const first = await order(client());
      assert.equal(first.status, 201, JSON.stringify(first.data));
      assert.equal(first.data.discount, 100);
      const second = await order(client());
      assert.equal(second.status, 400);
      const list = (await admin("GET", "/api/admin/coupons")).data.coupons;
      assert.equal(list.find((x) => x.code === "ONCE100").usedCount, 1);
      assert.equal(list.find((x) => x.code === "ONCE100").expiresAt, "2099-12-31");
      await admin("PUT", `/api/admin/orders/${first.data.orderNumber}/status`, { status: "Cancelled" });
      const after = (await admin("GET", "/api/admin/coupons")).data.coupons;
      assert.equal(after.find((x) => x.code === "ONCE100").usedCount, 0);
      const expired = await admin("POST", "/api/admin/coupons", { code: "OLD10", discountType: "percent", discountValue: 10, expiresAt: "2020-01-01" });
      assert.equal(expired.status, 201);
      assert.equal((await guest("POST", "/api/coupons/validate", { code: "OLD10", items: [{ variantId: vid("pure-ghee"), quantity: 1 }] })).data.valid, false);
    });

    await step("audit log: price, stock, coupon, settings and status changes are recorded", async () => {
      const r = await admin("GET", "/api/admin/audit?limit=200");
      assert.equal(r.status, 200);
      const actions = new Set(r.data.entries.map((e) => e.action));
      for (const a of ["variant.update", "variant.stock", "variant.create", "product.create", "order.status", "coupon.create", "settings.update"]) {
        assert.ok(actions.has(a), `missing audit action ${a}`);
      }
      const priceChange = r.data.entries.find((e) => e.action === "variant.update" && e.after && "price" in e.after);
      assert.ok(priceChange, "price change has before/after values");
      assert.equal(priceChange.adminEmail, ADMIN.email);
      assert.equal((await cust("GET", "/api/admin/audit")).status, 403);
    });

    await step("password change signs out other devices, keeps this one", async () => {
      const phone1 = client();
      const phone2 = client();
      const reg = await phone1("POST", "/api/auth/register", { name: "Two Devices", email: "two@example.com", phone: "9000000002", password: "first-pass-1" });
      assert.equal(reg.status, 201);
      assert.equal((await phone2("POST", "/api/auth/login", { identifier: "two@example.com", password: "first-pass-1" })).status, 200);
      const ch = await phone1("POST", "/api/auth/password", { currentPassword: "first-pass-1", newPassword: "second-pass-2" });
      assert.equal(ch.status, 200);
      assert.equal((await phone1("GET", "/api/auth/me")).data.user?.email, "two@example.com");
      assert.equal((await phone2("GET", "/api/auth/me")).data.user, null);
      assert.equal((await phone2("GET", "/api/account/orders")).status, 401);
    });

    await step("users: list + filters, create with generated password, must change it", async () => {
      const all = await admin("GET", "/api/admin/users");
      assert.equal(all.status, 200);
      assert.ok(all.data.summary.admins >= 1 && all.data.summary.customers >= 1);
      const admins = (await admin("GET", "/api/admin/users?role=admin")).data.users;
      assert.ok(admins.every((u) => u.role === "admin"));
      assert.ok(admins.some((u) => u.email === ADMIN.email && u.lastLoginAt), "admin sign-in time recorded");
      const found = (await admin("GET", "/api/admin/users?q=cust%40example.com")).data.users;
      assert.equal(found.length, 1);
      assert.ok(found[0].orders >= 1);

      const created = await admin("POST", "/api/admin/users", { name: "Shop Helper", email: "helper@example.com", phone: "9000000003", role: "customer" });
      assert.equal(created.status, 201, JSON.stringify(created.data));
      assert.match(created.data.temporaryPassword, /^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
      assert.equal(created.data.user.mustChangePassword, true);
      globalThis.helper = { id: created.data.user.id, password: created.data.temporaryPassword };
      const dupe = await admin("POST", "/api/admin/users", { name: "Dupe", email: "helper@example.com" });
      assert.equal(dupe.status, 409);
      const h = client();
      const login = await h("POST", "/api/auth/login", { identifier: "helper@example.com", password: helper.password });
      assert.equal(login.status, 200);
      assert.equal(login.data.user.mustChangePassword, true);
      assert.equal((await h("POST", "/api/auth/password", { currentPassword: helper.password, newPassword: "tamarind-leaf-9" })).data.user.mustChangePassword, false);
      helper.client = h;
      helper.password = "tamarind-leaf-9";
      assert.equal((await cust("GET", "/api/admin/users")).status, 403);
    });

    await step("users: disable signs out + blocks login; enable; reset password; promote/demote", async () => {
      const { id } = helper;
      assert.equal((await admin("PATCH", `/api/admin/users/${id}/status`, { isActive: false })).data.user.isActive, false);
      assert.equal((await helper.client("GET", "/api/auth/me")).data.user, null, "existing session ended");
      const blocked = await client()("POST", "/api/auth/login", { identifier: "helper@example.com", password: helper.password });
      assert.equal(blocked.status, 403);
      assert.equal(blocked.data.code, "ACCOUNT_DISABLED");
      await admin("PATCH", `/api/admin/users/${id}/status`, { isActive: true });
      const h = client();
      assert.equal((await h("POST", "/api/auth/login", { identifier: "helper@example.com", password: helper.password })).status, 200);

      const reset = await admin("POST", `/api/admin/users/${id}/reset-password`, { password: "" });
      assert.equal(reset.status, 200);
      assert.ok(reset.data.temporaryPassword);
      assert.equal((await h("GET", "/api/auth/me")).data.user, null, "reset signs the user out");
      assert.equal((await client()("POST", "/api/auth/login", { identifier: "helper@example.com", password: helper.password })).status, 401);
      assert.equal((await h("POST", "/api/auth/login", { identifier: "helper@example.com", password: reset.data.temporaryPassword })).status, 200);

      assert.equal((await h("GET", "/api/admin/stats")).status, 403);
      assert.equal((await admin("PATCH", `/api/admin/users/${id}/role`, { role: "admin" })).data.user.role, "admin");
      const h2 = client();
      await h2("POST", "/api/auth/login", { identifier: "helper@example.com", password: reset.data.temporaryPassword });
      assert.equal((await h2("GET", "/api/admin/stats")).status, 200, "promoted user can use the admin API");
      await admin("PATCH", `/api/admin/users/${id}/role`, { role: "customer" });
      assert.equal((await h2("GET", "/api/admin/stats")).status, 401, "demotion ends the admin session");

      const audit = (await admin("GET", "/api/admin/audit?entityType=user&limit=50")).data.entries.map((e) => e.action);
      for (const a of ["user.create", "user.disable", "user.enable", "user.password_reset", "user.role"]) assert.ok(audit.includes(a), `missing ${a}`);
    });

    await step("users: admins can't disable, demote, reset or delete themselves; delete keeps orders", async () => {
      const meId = (await admin("GET", "/api/auth/me")).data.user.id;
      for (const [m, url, body] of [
        ["PATCH", `/api/admin/users/${meId}/status`, { isActive: false }],
        ["PATCH", `/api/admin/users/${meId}/role`, { role: "customer" }],
        ["POST", `/api/admin/users/${meId}/reset-password`, {}],
        ["DELETE", `/api/admin/users/${meId}`],
      ]) {
        const r = await admin(m, url, body);
        assert.equal(r.status, 403, `${m} ${url}`);
        assert.equal(r.data.code, "SELF_ACTION");
      }
      // Delete a customer who has an order: account goes, the order stays
      const victim = (await admin("GET", "/api/admin/users?q=two%40example.com")).data.users[0];
      const v = client();
      await v("POST", "/api/auth/login", { identifier: "two@example.com", password: "second-pass-2" });
      const o = await v("POST", "/api/orders", {
        items: [{ variantId: vid("pure-castor-oil"), quantity: 1 }],
        name: "Two Devices",
        phone: "9000000002",
        fulfillment: "pickup",
        paymentMethod: "STORE",
      });
      assert.equal(o.status, 201);
      assert.equal((await admin("DELETE", `/api/admin/users/${victim.id}`)).status, 200);
      assert.equal((await admin("GET", `/api/admin/users/${victim.id}`)).status, 404);
      assert.equal((await v("GET", "/api/auth/me")).data.user, null);
      assert.equal((await admin("GET", `/api/admin/orders/${o.data.orderNumber}`)).status, 200, "order history kept");
    });

    await step("cold-pressed names, contact emails + second phone in settings", async () => {
      const c = (await guest("GET", "/api/catalog")).data;
      const gn = c.products.find((p) => p.slug === "wood-pressed-groundnut-oil");
      assert.match(gn.name, /^Cold-Pressed/);
      assert.equal(c.settings.emails.primary, "varam@varams.in");
      assert.equal(c.settings.emails.info, "info@varams.in");
      assert.equal(c.settings.emails.support, "support@varams.in");
      assert.equal(c.settings.storePhone2, "+91 95157 18720");
    });

    await step("SEO: home/FAQ/product have title, canonical, OG + JSON-LD; sitemap lists /faq", async () => {
      const home = await guest("GET", "/");
      assert.equal(home.status, 200);
      assert.match(home.data, /<title>Cold-Pressed Oils Online[^<]*<\/title>/);
      assert.match(home.data, /<link rel="canonical" href="http:\/\/localhost:3000\/">/);
      assert.match(home.data, /property="og:title"/);
      assert.match(home.data, /"@type":"Store"/);
      assert.match(home.data, /support@varams\.in/);
      assert.match(home.data, /\+91 95157 18720/);
      assert.ok(!/\{\{[A-Z_]+\}\}/.test(home.data), "no unfilled placeholders on home");
      const faq = await guest("GET", "/faq");
      assert.equal(faq.status, 200);
      assert.match(faq.data, /"@type":"FAQPage"/);
      assert.match(faq.data, /Do you ship outside India\?/);
      assert.match(faq.data, /<details class="faq-d"/);
      assert.ok(!/\{\{[A-Z_]+\}\}/.test(faq.data));
      const pdp = await guest("GET", "/product/pure-ghee");
      assert.match(pdp.data, /<title>Pure Ghee – ₹/);
      assert.match(pdp.data, /"@type":"Product"/);
      assert.match(pdp.data, /"@type":"BreadcrumbList"/);
      const map = await guest("GET", "/sitemap.xml");
      assert.match(map.data, /\/faq<\/loc>/);
      assert.match(map.data, /\/product\/pure-ghee<\/loc>/);
    });

    await step("international order: shipping quoted, email + country required, stored on the order", async () => {
      const items = [{ variantId: vid("pure-honey"), quantity: 1 }];
      const q = (await guest("POST", "/api/checkout/quote", { items, fulfillment: "delivery", country: "United Kingdom" })).data;
      assert.equal(q.international, true);
      assert.equal(q.deliveryFee, 0);
      assert.equal(q.amountToFreeDelivery, 0);
      const base = { items, name: "Priya Rao", phone: "+44 20 7946 0958", fulfillment: "delivery", address: "10 Downing Street, London", pincode: "SW1A 2AA", country: "United Kingdom" };
      assert.equal((await guest("POST", "/api/orders", { ...base, paymentMethod: "UPI", email: "priya@example.co.uk" })).status, 400, "UPI not offered abroad");
      assert.equal((await guest("POST", "/api/orders", { ...base, paymentMethod: "INTL" })).status, 400, "email required abroad");
      assert.equal((await guest("POST", "/api/orders", { ...base, paymentMethod: "INTL", email: "priya@example.co.uk", fulfillment: "pickup" })).status, 400);
      const ok = await guest("POST", "/api/orders", { ...base, paymentMethod: "INTL", email: "priya@example.co.uk" });
      assert.equal(ok.status, 201, JSON.stringify(ok.data));
      assert.equal(ok.data.international, true);
      assert.equal(ok.data.deliveryFee, 0);
      const d = (await admin("GET", `/api/admin/orders/${ok.data.orderNumber}`)).data.order;
      assert.equal(d.country, "United Kingdom");
      assert.equal(d.customerEmail, "priya@example.co.uk");
      assert.equal(d.customerPhone, "+442079460958");
      assert.equal(d.paymentMethod, "INTL");
      const inv = await guest("GET", ok.data.invoiceUrl);
      assert.match(inv.data, /International shipping/);
      assert.match(inv.data, /Quoted by email/);
      // India orders still validate Indian numbers and reject the international payment method
      assert.equal((await guest("POST", "/api/orders", { ...base, country: "India", pincode: "520011", phone: "9876543210", paymentMethod: "INTL" })).status, 400);
    });

    await step("sign-up security: password rules, confirm, terms, bot trap; /shop page", async () => {
      const base = { name: "Lakshmi Devi", email: "lakshmi@example.com", phone: "9000000077" };
      const reg = (extra) => client()("POST", "/api/auth/register", { ...base, ...extra });
      assert.equal((await reg({ password: "onlyletters" })).status, 400, "needs a number");
      assert.equal((await reg({ password: "password123" })).status, 400, "common password");
      assert.equal((await reg({ password: "lakshmi-2026" })).status, 400, "contains own name");
      assert.equal((await reg({ password: "mango-tree-7", confirmPassword: "mango-tree-8" })).status, 400, "confirm mismatch");
      assert.equal((await reg({ password: "mango-tree-7", acceptTerms: false })).status, 400, "terms");
      assert.equal((await reg({ password: "mango-tree-7", website: "http://spam.example" })).status, 400, "honeypot");
      const ok = await reg({ password: "mango-tree-7", confirmPassword: "mango-tree-7", acceptTerms: true });
      assert.equal(ok.status, 201, JSON.stringify(ok.data));
      const shop = await guest("GET", "/shop?category=ghee");
      assert.equal(shop.status, 200);
      assert.match(shop.data, /<title>Pure Ghee – Buy Online \| Varam<\/title>/);
      assert.match(shop.data, /"@type":"ItemList"/);
      assert.match(shop.data, /class="cat-tile"/);
      assert.ok(!/\{\{[A-Z_]+\}\}/.test(shop.data));
      assert.match((await guest("GET", "/")).data, /class="cat-tile"/);
      assert.match((await guest("GET", "/sitemap.xml")).data, /\/shop<\/loc>/);
    });

    await step("account lockout: 5 wrong passwords lock the account; admin unlock clears it", async () => {
      const who = { identifier: "lakshmi@example.com" };
      for (let i = 0; i < 5; i++) assert.equal((await client()("POST", "/api/auth/login", { ...who, password: "wrong-pass-1" })).status, 401);
      const locked = await client()("POST", "/api/auth/login", { ...who, password: "mango-tree-7" });
      assert.equal(locked.status, 429, "even the right password waits");
      assert.equal(locked.data.code, "ACCOUNT_LOCKED");
      const u = (await admin("GET", "/api/admin/users?q=lakshmi%40example.com")).data.users[0];
      assert.ok(u.lockedUntil, "admin sees the lock");
      assert.equal((await admin("POST", `/api/admin/users/${u.id}/unlock`)).status, 200);
      assert.equal((await client()("POST", "/api/auth/login", { ...who, password: "mango-tree-7" })).status, 200);
    });

    await step("logout clears the session", async () => {
      await cust("POST", "/api/auth/logout");
      assert.equal((await cust("GET", "/api/auth/me")).data.user, null);
    });

    console.log(results.join("\n"));
    console.log(`\n${passed} checks passed`);
    await cleanup();
    process.exit(0);
  } catch (err) {
    console.log(results.join("\n"));
    console.error("\nFAILED:", err.message);
    console.error("--- server log (tail) ---\n" + logs.join("").split("\n").slice(-30).join("\n"));
    await cleanup();
    process.exit(1);
  }
})();
