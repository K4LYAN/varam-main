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
  const html = swap(readPage("shop.html"), `<div class="grid shop-grid" id="shop-grid">\n            ${SKELETONS_6}\n          </div>`, `<div class="grid shop-grid" id="shop-grid">${products.map(card).join("")}</div>`);
  return html.replace(LD_ITEMLIST, () => ldScript(itemListLd(products)));
}

function product(slug) {
  const p = store.product(slug);
  if (!p) return null;
  let html = readPage(path.join("products", `${slug}.html`));
  html = html.replace(SKELETON_PDP, () => productBlock(p, store.settings()));
  html = swap(html, '<div class="grid" id="related"></div>', `<div class="grid" id="related">${related(store.products(), p).map(card).join("")}</div>`);
  // Structured data and preview image always match the live prices, stock and label photos
  html = html.replace(LD_PRODUCT, () => ldScript(productLd(p, store.settings())));
  if (p.labelFront) html = setPreviewImage(html, abs(p.labelFront));
  // Point AI agents at the plain-Markdown copy of this page
  html = html.replace("</head>", () => `  <link rel="alternate" type="text/markdown" href="${productUrl(p).replace(/\.html$/, ".md")}">\n</head>`);
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
- Everything in one file (all products, prices and FAQ answers): ${SITE}/llms-full.txt
- Each product as Markdown: ${SITE}/products/<slug>.md (for example ${SITE}/products/wood-pressed-groundnut-oil.md)
- Product catalogue as JSON: ${SITE}/api/products
- Product feed (Google Merchant format): ${SITE}/feed.xml
`;
}

/* ---------------- Structured data built from store.json ---------------- */

const abs = (src) => (/^https?:/.test(src) ? src : `${SITE}/${String(src).replace(/^\//, "")}`);
const productUrl = (p) => `${SITE}/products/${p.slug}.html`;
const productImages = (p) => [p.labelFront, p.labelFull].filter(Boolean).map(abs);
const ldScript = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;

/** One year ahead, so Google's "priceValidUntil" never looks stale. */
const priceValidUntil = () => new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);

function shippingDetails(s) {
  return {
    "@type": "OfferShippingDetails",
    shippingDestination: { "@type": "DefinedRegion", addressCountry: "IN" },
    shippingRate: { "@type": "MonetaryAmount", currency: "INR", value: s.deliveryFee ?? 60 },
    description: `Free delivery in India on orders of ₹${s.freeDeliveryThreshold ?? 999} or more; free pickup at the Vijayawada store.`,
  };
}

function productLd(p, s) {
  const until = priceValidUntil();
  const offers = p.variants.map((v) => ({
    "@type": "Offer",
    sku: v.sku,
    name: `${p.name} – ${v.sizeLabel}`,
    price: v.price,
    priceCurrency: "INR",
    priceValidUntil: until,
    availability: v.stockQty > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    itemCondition: "https://schema.org/NewCondition",
    url: productUrl(p),
    seller: { "@id": `${SITE}/index.html#store` },
    shippingDetails: shippingDetails(s),
  }));
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl(p)}#product`,
    name: p.name,
    description: p.description || p.tagline,
    image: productImages(p).length ? productImages(p) : [`${SITE}/img/varam-logo.jpg`],
    sku: p.variants[0]?.sku,
    brand: { "@type": "Brand", name: "Varam's" },
    manufacturer: { "@id": `${SITE}/index.html#store` },
    category: p.category?.name,
    countryOfOrigin: "IN",
    url: productUrl(p),
    offers: offers.length === 1 ? offers[0] : offers,
  };
}

function itemListLd(products) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Varam's cold-pressed oils, ghee and honey",
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: productUrl(p), name: p.name })),
  };
}

const LD_PRODUCT = /<script type="application\/ld\+json">\{"@context":"https:\/\/schema\.org","@type":"Product".*?<\/script>/;
const LD_ITEMLIST = /<script type="application\/ld\+json">\{"@context":"https:\/\/schema\.org","@type":"ItemList".*?<\/script>/;

/** Social preview image: the product's own label instead of the logo. */
function setPreviewImage(html, src) {
  return html
    .replace(/(<meta property="og:image" content=")[^"]*(">)/, (m, a, b) => a + esc(src) + b)
    .replace(/(<meta name="twitter:image" content=")[^"]*(">)/, (m, a, b) => a + esc(src) + b);
}

/* ---------------- FAQ (read from faq.html, the single source) ---------------- */

const stripTags = (s) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

function faqs() {
  const html = readPage("faq.html");
  const out = [];
  const re = /<details class="faq-d"[^>]*data-cat="([^"]*)"[^>]*><summary>([\s\S]*?)<span[\s\S]*?<\/summary><div class="faq-a">([\s\S]*?)<\/div><\/details>/g;
  let m;
  while ((m = re.exec(html))) out.push({ topic: stripTags(m[1]), q: stripTags(m[2]), a: stripTags(m[3]) });
  return out;
}

/* ---------------- Plain-text and feed formats for crawlers ---------------- */

function productMarkdown(p, s) {
  const isOil = !/ghee|honey/i.test(p.name);
  return `# ${p.name} — Varam's

${p.tagline}

- Category: ${p.category?.name || ""}
- Price: ${p.variants.map((v) => `${inr(v.price)} for ${v.sizeLabel}${v.stockQty > 0 ? "" : " (sold out)"}`).join("; ")}
- Process: ${isOil ? "Cold-pressed (wood-pressed) in a traditional wooden ghani (gaanuga); unrefined, no chemicals." : "Traditionally prepared and filtered."}
- Made in: Vijayawada, Andhra Pradesh, India
- Page: ${productUrl(p)}
${productImages(p).map((src, i) => `- ${i ? "Full label (nutrition facts)" : "Label image"}: ${src}`).join("\n")}

## About
${p.description || p.tagline}

## How to order
Add to cart on ${productUrl(p)} and send the order on WhatsApp (+${s.whatsappNumber || "917799228444"}), or email ${s.emails?.primary || "varam@varams.in"}. Free delivery in India above ${inr(s.freeDeliveryThreshold)}, otherwise ${inr(s.deliveryFee)}; free pickup at the Vijayawada store; international orders quoted by email.
`;
}

function llmsFull() {
  const s = store.settings();
  const products = store.products();
  const byTopic = {};
  for (const f of faqs()) (byTopic[f.topic] ||= []).push(f);
  return `${llmsTxt().trim()}

---

# Full product details

${products.map((p) => productMarkdown(p, s).replace(/^# /, "## ").replace(/^## (About|How to order)/gm, "### $1")).join("\n")}
---

# Frequently asked questions

${Object.entries(byTopic)
  .map(([topic, list]) => `## ${topic}\n\n${list.map((f) => `### ${f.q}\n${f.a}\n`).join("\n")}`)
  .join("\n")}
---

# About Varam's
${s.storeName || "Varam Organic Oil"} — ${s.storeAddress || "Vijayawada, Andhra Pradesh"}. ${s.storeHours || ""}.
Google rating: ${s.googleRating || "–"} from ${s.googleReviewCount || 0} reviews (${s.googleReviewsUrl || s.mapsUrl || ""}).
Instagram: ${s.instagramUrl || ""}
`;
}

/** Google Merchant Center product feed (RSS 2.0) — for free listings in Google Shopping. */
function merchantFeed() {
  const s = store.settings();
  const items = store
    .products()
    .flatMap((p) =>
      p.variants.map(
        (v) => `  <item>
    <g:id>${esc(v.sku)}</g:id>
    <g:item_group_id>${esc(p.slug)}</g:item_group_id>
    <title>${esc(`Varam's ${p.name} – ${v.sizeLabel}`)}</title>
    <description>${esc(p.description || p.tagline)}</description>
    <link>${productUrl(p)}</link>
    <g:image_link>${esc(productImages(p)[0] || `${SITE}/img/varam-logo.jpg`)}</g:image_link>${productImages(p)
          .slice(1)
          .map((src) => `\n    <g:additional_image_link>${esc(src)}</g:additional_image_link>`)
          .join("")}
    <g:availability>${v.stockQty > 0 ? "in_stock" : "out_of_stock"}</g:availability>
    <g:price>${Number(v.price).toFixed(2)} INR</g:price>
    <g:condition>new</g:condition>
    <g:brand>Varam's</g:brand>
    <g:identifier_exists>no</g:identifier_exists>
    <g:product_type>${esc(p.category?.name || "")}</g:product_type>
    <g:size>${esc(v.sizeLabel)}</g:size>
    <g:shipping><g:country>IN</g:country><g:price>${Number(s.deliveryFee ?? 60).toFixed(2)} INR</g:price></g:shipping>
  </item>`,
      ),
    );
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>Varam's Cold-Pressed Oils</title>
  <link>${SITE}/</link>
  <description>Cold-pressed oils, pure ghee and natural honey from Vijayawada.</description>
${items.join("\n")}
</channel>
</rss>
`;
}

module.exports = { home, shop, product, sitemap, llmsTxt, llmsFull, productMarkdown, merchantFeed, faqs };
