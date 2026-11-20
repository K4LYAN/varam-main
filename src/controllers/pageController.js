"use strict";

const path = require("path");
const config = require("../config");
const catalogService = require("../services/catalogService");
const orderService = require("../services/orderService");
const settingsService = require("../services/settingsService");
const { verifyInvoiceToken } = require("../services/invoiceService");
const { renderInvoice } = require("../utils/invoiceTemplate");
const validate = require("../validators");
const { clean } = require("../utils/validate");
const seo = require("../utils/seo");
const { faqFor } = require("../content/faq");
const photos = require("../content/photos");

const VIEWS = path.join(config.root, "views");
const send = (res, ...parts) => res.sendFile(path.join(VIEWS, ...parts));
const notFoundPage = (res) => res.status(404).sendFile(path.join(VIEWS, "404.html"));

const view = (...parts) => (_req, res) => send(res, ...parts);

const telHref = (p) => `tel:+91${String(p || "").replace(/\D/g, "").slice(-10)}`;

/** Phones, WhatsApp and the three email addresses — server-rendered so search engines see them. */
function contactBlock(s) {
  const e = seo.esc;
  const rows = [
    s.store_phone && `<li><span class="ci" data-icon="phone"></span><span><small>Call / WhatsApp</small><a href="${telHref(s.store_phone)}">${e(s.store_phone)}</a></span></li>`,
    s.store_phone_2 && `<li><span class="ci" data-icon="phone"></span><span><small>Call</small><a href="${telHref(s.store_phone_2)}">${e(s.store_phone_2)}</a></span></li>`,
    s.email_primary && `<li><span class="ci" data-icon="mail"></span><span><small>Orders</small><a href="mailto:${e(s.email_primary)}">${e(s.email_primary)}</a></span></li>`,
    s.email_info && `<li><span class="ci" data-icon="mail"></span><span><small>Products &amp; bulk enquiries</small><a href="mailto:${e(s.email_info)}">${e(s.email_info)}</a></span></li>`,
    s.email_support && `<li><span class="ci" data-icon="mail"></span><span><small>Order help &amp; support</small><a href="mailto:${e(s.email_support)}">${e(s.email_support)}</a></span></li>`,
  ].filter(Boolean);
  return `<ul class="contact-list">${rows.join("")}</ul>`;
}

/** <details> list of FAQs (works without JavaScript). */
function faqItems(list, { idPrefix = "faq" } = {}) {
  const e = seo.esc;
  return list
    .map((f, i) => `<details class="faq-d" id="${idPrefix}-${i + 1}" data-cat="${e(f.cat)}"><summary>${e(f.q)}<span class="faq-plus" aria-hidden="true"></span></summary><div class="faq-a"><p>${e(f.a)}</p></div></details>`)
    .join("");
}

/** Category tiles with photos — links work without JavaScript; shop.js filters in place. */
function categoryTiles(categories, { linkBase = "/shop" } = {}) {
  const e = seo.esc;
  return categories
    .map(
      (c) => `<a class="cat-tile" role="listitem" href="${linkBase}?category=${encodeURIComponent(c.slug)}" data-cat="${e(c.slug)}">
        <img src="${e(photos.categoryPhoto(c.slug, 360, 270))}" alt="${e(c.name)}" loading="lazy" width="360" height="270">
        <span><b>${e(c.name)}</b><small>${c.count} product${c.count === 1 ? "" : "s"}</small></span></a>`,
    )
    .join("");
}

const HOME_TITLE = "Cold-Pressed Oils Online | Wood-Pressed Groundnut, Sesame & Coconut Oil – Varam";
const HOME_DESC =
  "Buy traditional cold-pressed (wood-pressed, gaanuga) groundnut, sesame, coconut, mustard and castor oils, pure ghee and honey from Varam, Vijayawada. Delivery across India and worldwide.";

async function home(_req, res) {
  const s = await settingsService.getSettings();
  const faq = faqFor(s);
  seo.render(res, "index.html", {
    seo: { title: HOME_TITLE, description: HOME_DESC, path: "/", jsonld: [seo.storeSchema(s), seo.websiteSchema()] },
    blocks: {
      CONTACT_BLOCK: contactBlock(s),
      FAQ_TEASER: faqItems(faq.filter((f) => f.featured).slice(0, 4), { idPrefix: "q" }),
      STORE_ADDRESS: seo.esc(s.store_address),
      CATEGORY_TILES: categoryTiles((await catalogService.activeCatalog()).categories),
      PHOTO_HERO: photos.photo("hero", 900, 1100),
      PHOTO_SEEDS: photos.photo("seeds", 640, 420),
      PHOTO_PRESSING: photos.photo("pressing", 640, 420),
      PHOTO_SETTLED: photos.photo("settled", 640, 420),
      PHOTO_KITCHEN: photos.photo("kitchen", 900, 700),
      STORE_HOURS: seo.esc(s.store_hours),
    },
  });
}

async function shop(req, res) {
  const { products, categories } = await catalogService.activeCatalog();
  const cat = categories.find((c) => c.slug === String(req.query.category || ""));
  const title = cat
    ? `${/oil/i.test(cat.name) ? "Cold-Pressed" : "Pure"} ${cat.name} – Buy Online | Varam`
    : "Shop Cold-Pressed Oils, Ghee & Honey Online | Varam";
  seo.render(res, "shop.html", {
    seo: {
      title,
      description:
        "Shop Varam's cold-pressed (wood-pressed) groundnut, sesame, coconut, mustard, sunflower and castor oils, pure ghee and honey. Pack sizes, live prices and delivery across India and worldwide.",
      // Filtered views point search engines at the canonical category or the main shop page
      path: cat ? `/shop?category=${encodeURIComponent(cat.slug)}` : "/shop",
      jsonld: [
        {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Varam cold-pressed oils, ghee and honey",
          itemListElement: products
            .filter((p) => !cat || p.category?.slug === cat.slug)
            .map((p, i) => ({ "@type": "ListItem", position: i + 1, url: seo.absolute(`/product/${encodeURIComponent(p.slug)}`), name: p.name })),
        },
        seo.breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Shop", path: "/shop" }]),
      ],
    },
    blocks: { CATEGORY_TILES: categoryTiles(categories) },
  });
}

async function faqPage(_req, res) {
  const s = await settingsService.getSettings();
  const faq = faqFor(s);
  const cats = [...new Set(faq.map((f) => f.cat))];
  const grouped = cats
    .map(
      (c) => `<section class="faq-group" data-group="${seo.esc(c)}" aria-labelledby="g-${seo.esc(c).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}">
        <h2 id="g-${seo.esc(c).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}">${seo.esc(c)}</h2>${faqItems(faq.filter((f) => f.cat === c), { idPrefix: c.replace(/[^a-z0-9]+/gi, "-").toLowerCase() })}</section>`,
    )
    .join("");
  seo.render(res, "faq.html", {
    seo: {
      title: "FAQ – Cold-Pressed Oils, Delivery in India & Worldwide | Varam",
      description:
        "Answers about Varam's cold-pressed (wood-pressed) oils, ordering, UPI payment, delivery across India, international shipping, storage and how to contact us.",
      path: "/faq",
      jsonld: [seo.faqSchema(faq), seo.breadcrumbSchema([{ name: "Home", path: "/" }, { name: "FAQ", path: "/faq" }])],
    },
    blocks: {
      FAQ_FILTERS: ["All", ...cats].map((c, i) => `<button type="button" class="chip" data-faq-cat="${seo.esc(c)}" aria-pressed="${i === 0}">${seo.esc(c)}</button>`).join(""),
      FAQ_GROUPS: grouped,
      CONTACT_BLOCK: contactBlock(s),
    },
  });
}

async function product(req, res) {
  const data = await catalogService.productWithRelated(clean(req.params.slug, 150));
  if (!data) return notFoundPage(res);
  const p = data.product;
  const from = Math.min(...p.variants.map((v) => v.price));
  const sizes = p.variants.map((v) => v.sizeLabel).join(", ");
  seo.render(res, "product.html", {
    seo: {
      title: `${p.name} – ₹${from.toLocaleString("en-IN")} (${sizes}) | Varam`,
      description: `${p.tagline ? p.tagline + " " : ""}${p.name} from Varam, Vijayawada — traditionally made, unrefined. Delivery across India and worldwide.`.slice(0, 300),
      path: `/product/${encodeURIComponent(p.slug)}`,
      image: p.imageUrl || "/img/varam-logo.jpg",
      type: "product",
      jsonld: [
        seo.productSchema(p),
        seo.breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Shop", path: "/shop" },
          ...(p.category ? [{ name: p.category.name, path: `/shop?category=${encodeURIComponent(p.category.slug)}` }] : []),
          { name: p.name, path: `/product/${encodeURIComponent(p.slug)}` },
        ]),
      ],
    },
    blocks: { PRODUCT_NAME: seo.esc(p.name) },
  });
}

const adminLogin = (req, res) => (req.user?.role === "admin" ? res.redirect("/admin") : send(res, "admin", "login.html"));

function adminApp(_req, res) {
  res.set("X-Robots-Tag", "noindex, nofollow");
  send(res, "admin", "index.html");
}

/**
 * Printable invoice. Allowed for: an admin, the signed-in customer who owns
 * the order, or anyone holding the HMAC-signed link. Anyone else gets a 404
 * (not 403) so order numbers cannot be probed.
 */
async function invoice(req, res) {
  const data = await orderService.findByNumber(validate.orderNumber(req.params.orderNumber));
  const allowed =
    data &&
    (req.user?.role === "admin" ||
      (req.user && data.order.user_id === req.user.id) ||
      verifyInvoiceToken(data.order.order_number, req.query.t));
  if (!allowed) return notFoundPage(res);
  res.set("X-Robots-Tag", "noindex");
  res.set("Cache-Control", "private, no-store");
  res.type("html").send(renderInvoice(data.order, data.items, await settingsService.getSettings()));
}

async function packingSlip(req, res) {
  const data = await orderService.findByNumber(validate.orderNumber(req.params.orderNumber));
  if (!data) return notFoundPage(res);
  res.set("Cache-Control", "private, no-store");
  res.type("html").send(renderInvoice(data.order, data.items, await settingsService.getSettings(), { packingSlip: true }));
}

function robots(_req, res) {
  res
    .type("text/plain")
    .send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /account\nDisallow: /invoice/\nSitemap: ${config.siteUrl}/sitemap.xml\n`);
}

async function sitemap(_req, res) {
  const slugs = await catalogService.activeSlugs();
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    ["/", "daily", "1.0"],
    ["/shop", "daily", "0.9"],
    ["/faq", "monthly", "0.6"],
    ...slugs.map((s) => [`/product/${encodeURIComponent(s)}`, "weekly", "0.8"]),
  ]
    .map(([u, freq, pri]) => `<url><loc>${config.siteUrl}${u}</loc><lastmod>${today}</lastmod><changefreq>${freq}</changefreq><priority>${pri}</priority></url>`)
    .join("");
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
}

module.exports = { view, home, shop, faqPage, product, adminLogin, adminApp, invoice, packingSlip, robots, sitemap };
