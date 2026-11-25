"use strict";

/**
 * Server-side content for search engines, social previews and AI crawlers.
 *
 * The pages draw products with JavaScript, which Google can run but many other
 * crawlers (Bing, WhatsApp/Facebook previews, ChatGPT/Perplexity) cannot. Before a
 * page is sent, the loading skeletons are replaced with real, readable content
 * from src/data/store.json — names, prices, pack sizes, descriptions, links and
 * label images. In the browser the page scripts then redraw it as before.
 *
 * Also generates /sitemap.xml (with last-modified dates and product images) and
 * /llms.txt (a plain-text summary for AI answer engines).
 */
const fs = require("fs");
const path = require("path");
const store = require("./store");

const PUBLIC = path.join(__dirname, "..", "public");
const DATA = path.join(__dirname, "data", "store.json");
const SITE = "https://varams.in";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

/* ---------------- HTML files (cached until they change on disk) ---------------- */

const fileCache = new Map();
function readPage(rel) {
  const file = path.join(PUBLIC, rel);
  const { mtimeMs } = fs.statSync(file);
  const hit = fileCache.get(file);
  if (hit && hit.mtimeMs === mtimeMs) return hit.html;
  // Normalise Windows line endings so the skeleton markers below always match
  const html = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  fileCache.set(file, { mtimeMs, html });
  return html;
}

/** Replace `from` once if present; pages keep working unchanged if a marker is missing. */
const swap = (html, from, to) => (html.includes(from) ? html.replace(from, () => to) : html);

/* ---------------- Product snippets ---------------- */

const fromPrice = (p) => Math.min(...p.variants.map((v) => v.price));
const sizes = (p) => p.variants.map((v) => v.sizeLabel).join(", ");
const inStock = (p) => p.variants.some((v) => v.stockQty > 0);

/** A plain product card: real link, name, category, price and tagline. */
function card(p) {
  return `<article class="card ssr-card">
  <a class="card-link" href="products/${esc(p.slug)}.html" aria-label="View ${esc(p.name)}"></a>
  <div class="card-media">${p.labelFront ? `<img src="${esc(p.labelFront)}" alt="${esc(p.name)} — Varam's label" width="400" height="400" loading="lazy">` : ""}</div>
  <div class="card-body">
    <span class="kicker">${esc(p.category?.name || "Varam's")}</span>
    <h3><a href="products/${esc(p.slug)}.html">${esc(p.name)}</a></h3>
    <p class="tagline">${esc(p.tagline)}</p>
    <p class="price"><b>${inr(fromPrice(p))}</b> <span>${esc(sizes(p))}</span> · ${inStock(p) ? "In stock" : "Sold out"}</p>
  </div>
</article>`;
}

function bestsellers(products) {
  const featured = products.filter((p) => p.isFeatured && inStock(p));
  return (featured.length >= 4 ? featured : [...featured, ...products.filter((p) => !featured.includes(p))]).slice(0, 4);
}

function related(products, product) {
  const others = products.filter((p) => p.id !== product.id);
  const same = others.filter((p) => p.category?.slug === product.category?.slug);
  return [...same, ...others.filter((p) => !same.includes(p))].slice(0, 4);
}

/** Readable product details in place of the loading skeleton. */
function productBlock(p, s) {
  const isOil = !/ghee|honey/i.test(p.name);
  return `<div class="pdp" id="pdp">
      <div class="pdp-media">${p.labelFront ? `<img src="${esc(p.labelFront)}" alt="${esc(p.name)} bottle label by Varam's" width="400" height="400">` : ""}</div>
      <div class="pdp-info">
        <span class="kicker">${esc(p.category?.name || "Varam's")}</span>
        <h1>${esc(p.name)}</h1>
        <p class="lead">${esc(p.tagline)}</p>
        <p class="price-big"><b>${inr(fromPrice(p))}</b> <span>${esc(sizes(p))}</span></p>
        <p>${inStock(p) ? "In stock" : "Currently sold out"} · Delivery across India and worldwide · Free pickup at our Vijayawada store.</p>
        <h2>About this ${isOil ? "oil" : "product"}</h2>
        <p>${esc(p.description || p.tagline)}</p>
        <dl>
          <dt>Pack sizes</dt><dd>${p.variants.map((v) => `${esc(v.sizeLabel)} — ${inr(v.price)}`).join("; ")}</dd>
          <dt>Process</dt><dd>${isOil ? "Cold-pressed in a traditional wooden ghani (gaanuga), naturally settled and filtered — unrefined, no chemicals." : "Traditionally prepared, filtered and packed."}</dd>
          <dt>Order</dt><dd>Add to cart and send the order on WhatsApp (${esc(s.storePhone || "")}), or email ${esc(s.emails?.primary || "")}.</dd>
        </dl>
        ${p.labelFull ? `<figure><img src="${esc(p.labelFull)}" alt="Printed label of Varam's ${esc(p.name)}: nutrition facts, benefits, FSSAI licence and outlets" width="1600" height="320" loading="lazy"><figcaption>Full label: nutrition facts and benefits</figcaption></figure>` : ""}
      </div>
    </div>`;
}

const SKELETON_PDP = /<div class="pdp" id="pdp">\s*<div class="pdp-media skeleton"[^>]*><\/div>\s*<div><div class="skeleton"[^>]*><\/div><\/div>\s*<\/div>/;
const SKELETONS_4 = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
const SKELETONS_6 = SKELETONS_4 + '<div class="skeleton"></div><div class="skeleton"></div>';

/* ---------------- Pages ---------------- */

function home() {
  const products = store.products();
  return swap(readPage("index.html"), `<div class="grid" id="product-grid">\n          ${SKELETONS_4}\n        </div>`, `<div class="grid" id="product-grid">${bestsellers(products).map(card).join("")}</div>`);
}

function shop() {
  const products = store.products();
  return swap(readPage("shop.html"), `<div class="grid shop-grid" id="shop-grid">\n            ${SKELETONS_6}\n          </div>`, `<div class="grid shop-grid" id="shop-grid">${products.map(card).join("")}</div>`);
}

function product(slug) {
  const p = store.product(slug);
  if (!p) return null;
  let html = readPage(path.join("products", `${slug}.html`));
  html = html.replace(SKELETON_PDP, () => productBlock(p, store.settings()));
  html = swap(html, '<div class="grid" id="related"></div>', `<div class="grid" id="related">${related(store.products(), p).map(card).join("")}</div>`);
  return html;
}

/* ---------------- sitemap.xml and llms.txt ---------------- */

function lastModified() {
  return new Date(fs.statSync(DATA).mtimeMs).toISOString().slice(0, 10);
}

function sitemap() {
  const day = lastModified();
  const url = (loc, extra = "", priority = "0.7") => `  <url><loc>${SITE}/${loc}</loc><lastmod>${day}</lastmod><priority>${priority}</priority>${extra}</url>`;
  const img = (src, title) => `<image:image><image:loc>${SITE}/${esc(src)}</image:loc><image:title>${esc(title)}</image:title></image:image>`;
  const rows = [
    url("", "", "1.0"),
    url("shop.html", "", "0.9"),
    url("faq.html", "", "0.6"),
    ...store.products().map((p) =>
      url(
        `products/${p.slug}.html`,
        [p.labelFront && img(p.labelFront, `${p.name} — Varam's`), p.labelFull && img(p.labelFull, `${p.name} label and nutrition facts`)].filter(Boolean).join(""),
        "0.8",
      ),
    ),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${rows.join("\n")}
</urlset>
`;
}

function llmsTxt() {
  const s = store.settings();
  const lines = store
    .products()
    .map((p) => `- [${p.name}](${SITE}/products/${p.slug}.html): ${inr(fromPrice(p))} (${sizes(p)}). ${p.tagline}`);
  return `# Varam's — Cold-Pressed Oils, Vijayawada

> Varam's (Varam Organic Oil, వరం గానుగ నూనె) makes traditional cold-pressed (wood-pressed, gaanuga / mara chekku) oils, pure ghee and natural honey in Vijayawada, Andhra Pradesh, India. Oils are pressed slowly in a wooden ghani, left to settle naturally and bottled unrefined. Orders are accepted from all over India and other countries.

## Products
${lines.join("\n")}

## Ordering
- Shop: ${SITE}/shop.html — add to cart, then send the order on WhatsApp (+${s.whatsappNumber || "917799228444"}).
- Delivery across India (free above ${inr(s.freeDeliveryThreshold)}, otherwise ${inr(s.deliveryFee)}); free pickup at the store; international shipping quoted by email.
- Payment: UPI in India, pay at the store for pickups, payment link for orders from other countries.

## Contact
- Store: ${s.storeAddress || "BRTS Rd, Vijayawada"} (${s.storeHours || ""})
- Phone / WhatsApp: ${s.storePhone || ""}${s.storePhone2 ? `, ${s.storePhone2}` : ""}
- Email: ${[s.emails?.primary, s.emails?.info, s.emails?.support].filter(Boolean).join(", ")}

## More
- FAQ: ${SITE}/faq.html
`;
}

module.exports = { home, shop, product, sitemap, llmsTxt };
