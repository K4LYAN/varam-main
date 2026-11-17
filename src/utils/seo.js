"use strict";

/**
 * Server-side SEO: <title>, meta description, canonical URL, Open Graph,
 * Twitter cards and JSON-LD structured data, plus a tiny view renderer that
 * fills {{PLACEHOLDERS}} in the HTML files under views/.
 */
const fs = require("fs");
const path = require("path");
const config = require("../config");

const VIEWS = path.join(config.root, "views");
const cache = new Map();

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** JSON for a <script type="application/ld+json"> block; "<" is escaped so it can never close the tag. */
const jsonLd = (obj) =>
  `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, " ")}</script>`;

const absolute = (p) => (/^https?:\/\//i.test(p) ? p : `${config.siteUrl}${p.startsWith("/") ? "" : "/"}${p}`);

/** Head tags for one page. */
function headTags({ title, description, path: pagePath = "/", image = "/img/varam-logo.jpg", type = "website", noindex = false, jsonld = [] }) {
  const url = absolute(pagePath);
  const img = absolute(image);
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow, max-image-preview:large">',
    `<link rel="canonical" href="${esc(url)}">`,
    `<link rel="alternate" hreflang="en-IN" href="${esc(url)}">`,
    `<link rel="alternate" hreflang="x-default" href="${esc(url)}">`,
    `<meta property="og:site_name" content="Varam Cold-Pressed Oils">`,
    `<meta property="og:locale" content="en_IN">`,
    `<meta property="og:type" content="${esc(type)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(img)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    `<meta name="twitter:image" content="${esc(img)}">`,
    ...jsonld.map(jsonLd),
  ].join("\n  ");
}

/* ------------------------------------------------------------------ */
/* Structured data                                                     */
/* ------------------------------------------------------------------ */

const digits = (p) => String(p || "").replace(/\D/g, "");
/** "077992 28444" / "+91 95157 18720" → "+91-77992-28444" style E.164 for schema.org. */
function e164(p) {
  const d = digits(p);
  if (!d) return null;
  const local = d.length > 10 ? d.slice(-10) : d;
  return `+91-${local.slice(0, 5)}-${local.slice(5)}`;
}

/** The store as a schema.org Store (a LocalBusiness) — name, address, phones, emails, hours, service area. */
function storeSchema(s) {
  const pin = (String(s.store_address || "").match(/\b\d{6}\b/) || [])[0];
  const phones = [e164(s.store_phone), e164(s.store_phone_2)].filter(Boolean);
  const contact = [
    s.email_primary && { "@type": "ContactPoint", contactType: "sales", email: s.email_primary, telephone: phones[0], areaServed: ["IN", "Worldwide"], availableLanguage: ["English", "Telugu", "Hindi"] },
    s.email_info && { "@type": "ContactPoint", contactType: "customer service", email: s.email_info, telephone: phones[1] || phones[0] },
    s.email_support && { "@type": "ContactPoint", contactType: "technical support", email: s.email_support },
  ].filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": `${config.siteUrl}/#store`,
    name: "Varam Organic Oil",
    alternateName: ["Varam Cold-Pressed Oils", "వరం గానుగ నూనె"],
    description: "Traditional cold-pressed (wood-pressed, gaanuga) oils, pure ghee and natural honey from Vijayawada. Delivering across India and worldwide.",
    url: config.siteUrl,
    logo: absolute("/img/varam-logo.jpg"),
    image: absolute("/img/varam-logo.jpg"),
    telephone: phones[0],
    email: s.email_primary || undefined,
    priceRange: "₹₹",
    currenciesAccepted: "INR",
    paymentAccepted: "UPI, Bank transfer",
    address: {
      "@type": "PostalAddress",
      streetAddress: "BRTS Rd, Lakshmi Nagar, Satyaranayana Puram",
      addressLocality: "Vijayawada",
      addressRegion: "Andhra Pradesh",
      postalCode: pin || "520011",
      addressCountry: "IN",
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: "08:00",
        closes: "21:30",
      },
    ],
    areaServed: [{ "@type": "Country", name: "India" }, { "@type": "Place", name: "Worldwide" }],
    hasMap: s.maps_url || undefined,
    sameAs: [s.instagram_url, s.google_reviews_url].filter(Boolean),
    contactPoint: contact,
  };
}

function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${config.siteUrl}/#website`,
    name: "Varam Cold-Pressed Oils",
    url: config.siteUrl,
    inLanguage: "en-IN",
    publisher: { "@id": `${config.siteUrl}/#store` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${config.siteUrl}/?q={search_term_string}#shop` },
      "query-input": "required name=search_term_string",
    },
  };
}

function faqSchema(faq) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

function breadcrumbSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absolute(it.path) })),
  };
}

/** Product + Offer(s) for a product page. */
function productSchema(p) {
  const prices = p.variants.map((v) => v.price);
  const inStock = p.variants.some((v) => v.stockQty > 0);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description || p.tagline,
    image: p.imageUrl ? [absolute(p.imageUrl)] : [absolute("/img/varam-logo.jpg")],
    sku: p.variants[0]?.sku,
    brand: { "@type": "Brand", name: "Varam" },
    category: p.category?.name,
    url: absolute(`/product/${encodeURIComponent(p.slug)}`),
    offers:
      p.variants.length > 1
        ? {
            "@type": "AggregateOffer",
            priceCurrency: "INR",
            lowPrice: Math.min(...prices),
            highPrice: Math.max(...prices),
            offerCount: p.variants.length,
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          }
        : {
            "@type": "Offer",
            priceCurrency: "INR",
            price: prices[0],
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: absolute(`/product/${encodeURIComponent(p.slug)}`),
            seller: { "@id": `${config.siteUrl}/#store` },
          },
  };
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function readView(name) {
  if (config.isProd && cache.has(name)) return cache.get(name);
  const html = fs.readFileSync(path.join(VIEWS, name), "utf8");
  if (config.isProd) cache.set(name, html);
  return html;
}

/**
 * Render a view: {{SEO_HEAD}} gets the head tags, any other {{KEY}} gets
 * `blocks[KEY]` (trusted HTML built by the controller — escape user data there).
 */
function render(res, name, { seo, blocks = {}, status = 200 }) {
  const html = readView(name).replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => {
    if (key === "SEO_HEAD") return headTags(seo);
    return blocks[key] ?? "";
  });
  res.status(status).type("html").set("Cache-Control", "no-cache").send(html);
}

module.exports = { esc, headTags, render, storeSchema, websiteSchema, faqSchema, breadcrumbSchema, productSchema, absolute };
