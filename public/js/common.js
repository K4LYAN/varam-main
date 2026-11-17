/* =====================================================================
   Varam — shared storefront script (header, cart, checkout, helpers)
   ===================================================================== */
(function () {
  "use strict";

  /* ---------------- Helpers ---------------- */

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  async function api(method, url, body) {
    const res = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  const store = {
    get(k, fallback) {
      try {
        const v = localStorage.getItem(k);
        return v === null ? fallback : JSON.parse(v);
      } catch {
        return fallback;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch {
        /* storage unavailable */
      }
    },
  };

  /* ---------------- Icons ---------------- */

  const I = {
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l1 14H5L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg>',
    star: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 1.5l2.6 5.5 6 .7-4.4 4.1 1.2 5.9L10 14.8l-5.4 2.9 1.2-5.9L1.4 7.7l6-.7z"/></svg>',
    leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Z"/><path d="M5 19 13 11"/></svg>',
    drop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3c3.5 4.6 5.5 8 5.5 11a5.5 5.5 0 0 1-11 0c0-3 2-6.4 5.5-11Z"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
    store: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9 5 4h14l1 5M4 9v11h16V9M4 9h16M9 20v-6h6v6"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.91-7.01Zm-7.01 15.24a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.5 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.5 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2Z"/></svg>',
    nav: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 22 2l-9 19-2-8-8-2Z"/></svg>',
  };

  /* ---------------- Bottle render (used when no product photo) ---------------- */

  let bottleId = 0;
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v * (1 + amt))));
    return "#" + ((c((n >> 16) & 255) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).padStart(6, "0");
  }
  function bottleSvg(name, tone, size) {
    const id = "b" + ++bottleId;
    const t = /^#[0-9a-f]{6}$/i.test(tone || "") ? tone : "#D97706";
    const jar = /ghee|honey/i.test(name);
    const label = String(name)
      .replace(/^(wood-pressed|kachi ghani|pure)\s+/i, "")
      .replace(/\s+oil$/i, "")
      .toUpperCase();
    const body = jar
      ? "M58 150 Q44 150 44 168 L44 428 Q44 450 66 450 L174 450 Q196 450 196 428 L196 168 Q196 150 182 150 Z"
      : "M103 74 L103 112 C103 134 52 146 52 180 L52 430 Q52 450 72 450 L168 450 Q188 450 188 430 L188 180 C188 146 137 134 137 112 L137 74 Z";
    const top = jar ? 178 : 196;
    const cap = jar
      ? `<rect x="50" y="110" width="140" height="46" rx="8" fill="url(#c${id})"/><rect x="50" y="144" width="140" height="7" fill="#F59E0B"/>`
      : `<rect x="99" y="30" width="42" height="50" rx="5" fill="url(#c${id})"/><rect x="99" y="66" width="42" height="7" fill="#F59E0B"/>`;
    const fs = label.length > 12 ? 10 : 12.5;
    return `<svg class="bottle-svg" viewBox="0 0 240 480" role="img" aria-label="${esc(name)}">
<defs><clipPath id="k${id}"><path d="${body}"/></clipPath>
<linearGradient id="o${id}" x1="0" x2="1"><stop offset="0" stop-color="${shade(t, -0.38)}"/><stop offset=".3" stop-color="${t}"/><stop offset=".55" stop-color="${shade(t, 0.2)}"/><stop offset=".8" stop-color="${t}"/><stop offset="1" stop-color="${shade(t, -0.38)}"/></linearGradient>
<linearGradient id="c${id}" x1="0" x2="1"><stop offset="0" stop-color="#7f1d1d"/><stop offset=".45" stop-color="#dc2626"/><stop offset="1" stop-color="#7f1d1d"/></linearGradient></defs>
<ellipse cx="120" cy="456" rx="92" ry="12" fill="#000" opacity=".12"/>
<g clip-path="url(#k${id})"><rect width="240" height="480" fill="#fdf8ee" opacity=".6"/><rect y="${top}" width="240" height="300" fill="url(#o${id})"/><rect x="64" y="150" width="9" height="290" rx="4.5" fill="#fff" opacity=".35"/></g>
<path d="${body}" fill="none" stroke="#3b2a17" stroke-opacity=".25" stroke-width="1.2"/>${cap}
<rect x="62" y="248" width="116" height="156" rx="3" fill="#fffdf8"/><rect x="67" y="253" width="106" height="146" rx="2" fill="none" stroke="#D92D20" stroke-width=".9"/>
<text x="120" y="300" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif" font-weight="800" font-size="22" letter-spacing="4" fill="#D92D20">VARAM</text>
<line x1="94" x2="146" y1="312" y2="312" stroke="#F59E0B" stroke-width="1.2"/>
<text x="120" y="336" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif" font-weight="700" font-size="${fs}" fill="#111827">${esc(label)}</text>
<text x="120" y="353" text-anchor="middle" font-family="Inter, sans-serif" font-weight="600" font-size="6.6" letter-spacing="1.6" fill="#4B5563">${jar ? (/honey/i.test(name) ? "NATURAL HONEY" : "TRADITIONAL GHEE") : "WOOD-PRESSED OIL"}</text>
${size ? `<text x="120" y="386" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="8" letter-spacing="1.2" fill="#D97706">${esc(String(size).toUpperCase())}</text>` : ""}
</svg>`;
  }

  function productVisual(p, size) {
    return p.imageUrl
      ? `<img class="photo" src="${esc(p.imageUrl)}" alt="${esc(p.name)}" loading="lazy">`
      : bottleSvg(p.name, p.accentColor, size);
  }

  /* ---------------- Toasts ---------------- */

  function toast(message, { error = false, action } = {}) {
    let box = $(".toasts");
    if (!box) {
      box = document.createElement("div");
      box.className = "toasts";
      box.setAttribute("aria-live", "polite");
      document.body.appendChild(box);
    }
    const el = document.createElement("div");
    el.className = "toast" + (error ? " err" : "");
    el.innerHTML = `<span>${esc(message)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ""}`;
    if (action) el.querySelector("button").addEventListener("click", () => {
      action.onClick();
      el.remove();
    });
    box.appendChild(el);
    setTimeout(() => el.remove(), 3800);
  }

  /* ---------------- App state ---------------- */

  const state = {
    settings: null,
    user: null,
    catalog: null, // { products, categories }
    ready: null,
  };

  async function loadCatalog() {
    if (!state.catalog) {
      const data = await api("GET", "/api/catalog");
      state.catalog = { products: data.products, categories: data.categories };
      state.settings = data.settings;
    }
    return state.catalog;
  }

  function findVariant(variantId) {
    for (const p of state.catalog?.products || []) {
      const v = p.variants.find((x) => x.id === variantId);
      if (v) return { product: p, variant: v };
    }
    return null;
  }

  /* ---------------- Cart (guest localStorage ⇄ MySQL when signed in) ---------------- */

  const CART_KEY = "varam_cart_v1";
  const PREF_KEY = "varam_checkout_v1";

  const Cart = {
    items: [],
    prefs: Object.assign({ fulfillment: "delivery", couponCode: "" }, store.get(PREF_KEY, {})),
    quote: null,
    listeners: new Set(),

    get signedIn() {
      return Boolean(state.user);
    },
    count() {
      return this.items.reduce((n, i) => n + i.quantity, 0);
    },
    async load() {
      if (this.signedIn) {
        this.items = (await api("GET", "/api/cart")).items;
      } else {
        this.items = (store.get(CART_KEY, []) || []).filter((i) => Number(i.variantId) > 0 && Number(i.quantity) > 0);
      }
      this.changed(false);
    },
    saveLocal() {
      if (!this.signedIn) store.set(CART_KEY, this.items);
    },
    async setQty(variantId, quantity) {
      quantity = Math.max(0, Math.min(50, Math.floor(quantity)));
      if (this.signedIn) {
        this.items = (await api("PUT", "/api/cart/items", { variantId, quantity })).items;
      } else {
        const existing = this.items.find((i) => i.variantId === variantId);
        if (quantity === 0) this.items = this.items.filter((i) => i.variantId !== variantId);
        else if (existing) existing.quantity = quantity;
        else this.items.push({ variantId, quantity });
        this.saveLocal();
      }
      this.changed(true);
    },
    async add(variantId, quantity = 1) {
      const current = this.items.find((i) => i.variantId === variantId)?.quantity || 0;
      await this.setQty(variantId, current + quantity);
    },
    async remove(variantId) {
      await this.setQty(variantId, 0);
    },
    async clear() {
      if (this.signedIn) await api("DELETE", "/api/cart");
      this.items = [];
      store.set(CART_KEY, []);
      this.changed(true);
    },
    /** After login/register: push the guest cart to MySQL and switch to the account cart. */
    async mergeGuest() {
      const guest = store.get(CART_KEY, []) || [];
      if (guest.length) {
        this.items = (await api("POST", "/api/cart/merge", { items: guest })).items;
        store.set(CART_KEY, []);
      }
    },
    setPref(k, v) {
      this.prefs[k] = v;
      store.set(PREF_KEY, this.prefs);
      this.refreshQuote();
    },
    changed(bump) {
      updateBadge(bump);
      this.refreshQuote();
      this.listeners.forEach((fn) => fn());
    },
    refreshQuote: debounce(async function () {
      try {
        Cart.quote = await api("POST", "/api/checkout/quote", {
          items: Cart.items,
          couponCode: Cart.prefs.couponCode,
          fulfillment: Cart.prefs.fulfillment,
        });
      } catch {
        Cart.quote = null;
      }
      renderDrawer();
    }, 120),
  };

  function updateBadge(bump) {
    const n = Cart.count();
    $$(".cart-count").forEach((el) => {
      el.textContent = n > 99 ? "99+" : String(n);
      el.classList.toggle("hidden", n === 0);
      if (bump) {
        el.classList.remove("bump");
        void el.offsetWidth;
        el.classList.add("bump");
      }
    });
    $$("[data-cart-label]").forEach((el) => el.setAttribute("aria-label", `Open cart, ${n} item${n === 1 ? "" : "s"}`));
  }

  /* ---------------- Header & footer ---------------- */

  const NAV = [
    { href: "/#shop", label: "Shop Oils" },
    { href: "/#process", label: "Our Process" },
    { href: "/#store", label: "Store & Bulk" },
    { href: "/#faq", label: "FAQ" },
  ];

  function telHref(p) {
    return "tel:+91" + String(p || "").replace(/\D/g, "").slice(-10);
  }

  function renderHeader() {
    const s = state.settings;
    const mount = $("#site-header");
    if (!mount || !s) return;
    const account = state.user
      ? `<a class="icon-btn account-btn" href="${state.user.role === "admin" ? "/admin" : "/account"}" aria-label="My account">${I.user}<span>${esc(state.user.name.split(" ")[0])}</span></a>`
      : `<a class="icon-btn account-btn" href="/login" aria-label="Login or create account">${I.user}<span>Login</span></a>`;
    mount.innerHTML = `
      <a class="skip" href="#main">Skip to content</a>
      <div class="utility"><div class="container">
        <div class="u-left"><span class="u-addr">${I.pin}${esc(s.storeAddress)}</span>
          <a href="${telHref(s.storePhone)}">${I.phone}${esc(s.storePhone)}</a></div>
        <span class="u-hide">${I.clock}${esc(s.storeHours)}</span>
      </div></div>
      ${s.announcement ? `<div class="announce">${esc(s.announcement)}</div>` : ""}
      <header class="site-header"><div class="container">
        <a class="brand" href="/" aria-label="Varam home"><img src="/img/varam-logo.jpg" alt="" width="44" height="44"><span><b>VARAM</b><small>WOOD-PRESSED OILS</small></span></a>
        <nav class="main-nav" aria-label="Main">${NAV.map((n) => `<a href="${n.href}">${n.label}</a>`).join("")}</nav>
        <div class="header-search" role="search">${I.search}
          <input type="search" id="site-search" placeholder="Search oils, ghee, honey…" autocomplete="off" aria-label="Search products" aria-controls="search-results">
          <div class="search-results hidden" id="search-results" role="listbox"></div></div>
        <div class="header-actions">${account}
          <button class="icon-btn cart-btn" type="button" data-open-cart data-cart-label aria-label="Open cart">${I.bag}<span class="cart-count hidden">0</span></button>
          <button class="icon-btn menu-btn" type="button" aria-expanded="false" aria-controls="mobile-nav" aria-label="Menu">${I.menu}</button>
        </div>
      </div>
      <nav class="mobile-nav hidden" id="mobile-nav" aria-label="Mobile">
        <div class="mobile-search header-search" style="display:block;max-width:none">${I.search}<input type="search" id="mobile-search" placeholder="Search products…" aria-label="Search products"></div>
        ${NAV.map((n) => `<a href="${n.href}">${n.label}</a>`).join("")}
        <a href="${state.user ? "/account" : "/login"}">${state.user ? "My Account" : "Login / Register"}</a>
      </nav></header>`;

    const menuBtn = $(".menu-btn", mount);
    const mobile = $("#mobile-nav", mount);
    menuBtn.addEventListener("click", () => {
      const open = mobile.classList.toggle("hidden") === false;
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.innerHTML = open ? I.close : I.menu;
    });
    $$("#mobile-nav a", mount).forEach((a) => a.addEventListener("click", () => menuBtn.click()));
    wireSearch($("#site-search", mount), $("#search-results", mount));
    $("#mobile-search", mount).addEventListener("keydown", (e) => {
      if (e.key === "Enter") goSearch(e.target.value);
    });
    updateBadge(false);
  }

  function goSearch(q) {
    const term = String(q || "").trim();
    if (window.VARAM_HOME && typeof window.VARAM_HOME.search === "function") {
      window.VARAM_HOME.search(term);
      document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });
    } else {
      location.href = "/?q=" + encodeURIComponent(term) + "#shop";
    }
  }

  function wireSearch(input, box) {
    let active = -1;
    const run = debounce(async () => {
      const term = input.value.trim().toLowerCase();
      if (!term) {
        box.classList.add("hidden");
        return;
      }
      const { products } = await loadCatalog();
      const hits = products
        .filter((p) => [p.name, p.tagline, p.category?.name].join(" ").toLowerCase().includes(term))
        .slice(0, 6);
      active = -1;
      box.innerHTML = hits.length
        ? hits
            .map(
              (p) =>
                `<a href="/product/${esc(p.slug)}" role="option" data-name="${esc(p.name)}"><span class="thumb">${bottleSvg(p.name, p.accentColor)}</span><span><b>${esc(p.name)}</b><br><span class="muted">from ${inr(Math.min(...p.variants.map((v) => v.price)))}</span></span></a>`,
            )
            .join("")
        : `<p class="muted">No products found for “${esc(input.value.trim())}”</p>`;
      box.classList.remove("hidden");
    }, 120);
    input.addEventListener("input", run);
    input.addEventListener("keydown", (e) => {
      const links = $$("a", box);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        active = (active + (e.key === "ArrowDown" ? 1 : -1) + links.length) % Math.max(1, links.length);
        links.forEach((l, i) => l.classList.toggle("active", i === active));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (active >= 0 && links[active]) links[active].click();
        else {
          box.classList.add("hidden");
          goSearch(input.value);
        }
      } else if (e.key === "Escape") box.classList.add("hidden");
    });
    document.addEventListener("click", (e) => {
      if (!box.contains(e.target) && e.target !== input) box.classList.add("hidden");
    });
  }

  function renderFooter() {
    const s = state.settings;
    const mount = $("#site-footer");
    if (!mount || !s) return;
    const cats = (state.catalog?.categories || []).map((c) => `<li><a href="/?category=${esc(c.slug)}#shop">${esc(c.name)}</a></li>`).join("");
    mount.innerHTML = `<footer class="site-footer"><div class="container">
      <div class="cols">
        <div><a class="brand" href="/"><img src="/img/varam-logo.jpg" alt="" width="44" height="44"><span><b>VARAM</b><small>WOOD-PRESSED OILS</small></span></a>
          <p style="margin-top:14px;font-size:14px;max-width:340px">Traditionally wood-pressed (gaanuga) oils, pure ghee and honey from Vijayawada. Pure · Natural · Traditional.</p></div>
        <div><h4>Shop</h4><ul>${cats}</ul></div>
        <div><h4>Help</h4><ul><li><a href="/#process">Our Process</a></li><li><a href="/#store">Store &amp; Bulk Orders</a></li><li><a href="/#faq">FAQ</a></li><li><a href="/account">My Account</a></li>${
          s.instagramUrl ? `<li><a href="${esc(s.instagramUrl)}" target="_blank" rel="noopener">Instagram</a></li>` : ""
        }</ul></div>
        <div><h4>Visit us</h4><ul><li>${esc(s.storeAddress)}</li><li><a href="${telHref(s.storePhone)}">${esc(s.storePhone)}</a></li>
          <li><a href="https://wa.me/${esc(s.whatsappNumber)}" target="_blank" rel="noopener">WhatsApp us</a></li><li>${esc(s.storeHours)}</li></ul></div>
      </div>
      <div class="legal"><span>© ${new Date().getFullYear()} Varam Organic Oil, Vijayawada</span><span>Prices in ₹ include all items listed; delivery charges shown at checkout.</span></div>
    </div></footer>
    <a class="wa-float" href="https://wa.me/${esc(s.whatsappNumber)}?text=${encodeURIComponent("Hello Varam! I'd like to know more about your oils.")}" target="_blank" rel="noopener" aria-label="Chat with Varam on WhatsApp">${I.wa}</a>`;
  }

  /* ---------------- Cart drawer & checkout ---------------- */

  let drawerEl;
  let backdropEl;
  let drawerStep = "cart"; // cart | checkout

  function ensureDrawer() {
    if (drawerEl) return;
    backdropEl = document.createElement("div");
    backdropEl.className = "backdrop hidden";
    drawerEl = document.createElement("aside");
    drawerEl.className = "drawer";
    drawerEl.setAttribute("role", "dialog");
    drawerEl.setAttribute("aria-modal", "true");
    drawerEl.setAttribute("aria-label", "Your cart");
    drawerEl.setAttribute("aria-hidden", "true");
    drawerEl.inert = true;
    document.body.append(backdropEl, drawerEl);
    backdropEl.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawerEl.classList.contains("open")) closeDrawer();
    });
    drawerEl.addEventListener("click", onDrawerClick);
    drawerEl.addEventListener("change", (e) => {
      const id = e.target.dataset && e.target.dataset.useAddress;
      const a = id && (state.addresses || []).find((x) => String(x.id) === id);
      if (a) fillAddress(a);
    });
    drawerEl.addEventListener("submit", onCheckoutSubmit);
  }

  function openDrawer() {
    ensureDrawer();
    drawerStep = "cart";
    backdropEl.classList.remove("hidden");
    requestAnimationFrame(() => backdropEl.classList.add("show"));
    drawerEl.classList.add("open");
    drawerEl.inert = false;
    drawerEl.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    renderDrawer();
    Cart.refreshQuote();
    setTimeout(() => $(".drawer-head button", drawerEl)?.focus(), 50);
  }

  function closeDrawer() {
    if (!drawerEl) return;
    drawerEl.classList.remove("open");
    drawerEl.inert = true;
    drawerEl.setAttribute("aria-hidden", "true");
    backdropEl.classList.remove("show");
    setTimeout(() => backdropEl.classList.add("hidden"), 250);
    document.body.style.overflow = "";
  }

  function lineView(l) {
    const meta = findVariant(l.variantId);
    const name = l.name || meta?.product.name || "Product";
    const visual = l.imageUrl ? `<img src="${esc(l.imageUrl)}" alt="">` : bottleSvg(name, l.accentColor || meta?.product.accentColor);
    const problem = !l.available || l.stock < l.quantity;
    const slug = l.slug || meta?.product.slug;
    return `<div class="line-item" data-line="${l.variantId}">
      <a class="thumb" href="${slug ? `/product/${esc(slug)}` : "#"}" tabindex="-1">${visual}</a>
      <div class="info">${slug ? `<a class="name" href="/product/${esc(slug)}"><b>${esc(name)}</b></a>` : `<b>${esc(name)}</b>`}
        <div class="meta">${esc(l.sizeLabel || "")}${l.unitPrice ? ` · ${inr(l.unitPrice)} each${l.mrp > l.unitPrice ? `<span class="mrp">${inr(l.mrp)}</span>` : ""}` : ""}</div>
        ${problem ? `<div class="warn">${esc(l.reason || "Unavailable")}</div>` : ""}
        <div class="controls">
          <div class="qty" role="group" aria-label="Quantity for ${esc(name)}">
            <button type="button" data-qty="${l.variantId}" data-delta="-1" aria-label="Decrease">−</button>
            <span>${l.quantity}</span>
            <button type="button" data-qty="${l.variantId}" data-delta="1" aria-label="Increase" ${l.stock && l.quantity >= l.stock ? "disabled" : ""}>+</button>
          </div>
          <b>${l.lineTotal ? inr(l.lineTotal) : ""}</b>
        </div>
        <button class="link-btn" type="button" data-remove="${l.variantId}">Remove</button>
      </div></div>`;
  }

  function renderDrawer() {
    if (!drawerEl || !drawerEl.classList.contains("open")) return;
    const q = Cart.quote;
    const s = state.settings || {};
    const count = Cart.count();
    let body;
    let foot = "";

    if (!Cart.items.length) {
      body = `<div class="empty" style="margin-top:24px;border:0"><div class="empty-art">${I.bag}</div><h3>Your cart is empty</h3><p class="muted" style="margin:6px 0 16px">Add some wood-pressed goodness.</p><a class="btn btn-primary" href="/#shop" data-close>Shop Oils</a></div>${upsellHtml()}`;
    } else if (drawerStep === "checkout") {
      const u = state.user || {};
      const pickup = Cart.prefs.fulfillment === "pickup";
      body = `<form class="form" id="checkout-form" novalidate>
        <button type="button" class="link-btn" data-step="cart">← Back to cart</button>
        <div class="form-error hidden" id="checkout-error" role="alert"></div>
        <div class="field"><label for="co-name">Full name</label><input class="input" id="co-name" name="name" autocomplete="name" required value="${esc(u.name || "")}"></div>
        <div class="field"><label for="co-phone">Mobile number (WhatsApp)</label><input class="input" id="co-phone" name="phone" inputmode="tel" autocomplete="tel" required value="${esc(u.phone || "")}" placeholder="10-digit mobile"></div>
        ${
          pickup
            ? `<div class="bulk" style="margin:0"><div><b>Free store pickup</b><div class="muted" style="font-size:14px">${esc(s.storeAddress)}</div></div></div>`
            : `${addressPickerHtml()}<div class="field"><label for="co-address">Delivery address</label><textarea class="input" id="co-address" name="address" autocomplete="street-address" required>${esc(u.defaultAddress || "")}</textarea></div>
               <div class="field"><label for="co-pin">Pincode</label><input class="input" id="co-pin" name="pincode" inputmode="numeric" autocomplete="postal-code" maxlength="6" required value="${esc(u.pincode || "")}"></div>`
        }
        <div class="field"><span class="label">Payment</span><div class="radio-row">
          <label><input type="radio" name="paymentMethod" value="UPI" checked> <span>UPI</span></label>
          ${pickup ? `<label><input type="radio" name="paymentMethod" value="STORE"> <span>Pay at store</span></label>` : ""}
        </div></div>
        <div class="field"><label for="co-notes">Notes (optional)</label><input class="input" id="co-notes" name="notes" maxlength="300" placeholder="e.g. preferred delivery time"></div>
      </form>`;
      foot = totalsHtml(q) + `<div class="drawer-actions">
        <button class="btn btn-primary btn-block" type="submit" form="checkout-form" ${!q || q.hasProblems ? "disabled" : ""}>Place order · ${q ? inr(q.total) : ""}</button>
        <button class="btn btn-wa btn-block" type="button" data-wa-order>${I.wa} Order via WhatsApp</button>
      </div>`;
    } else {
      const lines = q ? q.lines : Cart.items;
      const saved = q ? q.lines.reduce((sum, l) => sum + (l.available && l.mrp > l.unitPrice ? (l.mrp - l.unitPrice) * l.quantity : 0), 0) : 0;
      body =
        lines.map(lineView).join("") +
        (saved > 0 ? `<div class="savings">You save ${inr(saved)} on MRP with this order 🎉</div>` : "") +
        upsellHtml();
      const pct = q && q.freeDeliveryThreshold ? Math.min(100, Math.round((q.subtotal / q.freeDeliveryThreshold) * 100)) : 0;
      foot = `<div class="seg" role="group" aria-label="Fulfilment">
          <button type="button" data-fulfil="delivery" aria-pressed="${Cart.prefs.fulfillment === "delivery"}">Home Delivery<small>Free above ${inr(s.freeDeliveryThreshold)}</small></button>
          <button type="button" data-fulfil="pickup" aria-pressed="${Cart.prefs.fulfillment === "pickup"}">Store Pickup<small>Free · BRTS Rd, Vijayawada</small></button>
        </div>
        ${
          Cart.prefs.fulfillment === "delivery" && q
            ? `<div class="progress">${q.amountToFreeDelivery > 0 ? `Add <b>${inr(q.amountToFreeDelivery)}</b> more for free delivery` : "<b>You've unlocked free delivery!</b>"}<div class="bar"><i style="width:${pct}%"></i></div></div>`
            : ""
        }
        <form class="coupon" data-coupon-form><input name="code" placeholder="Coupon code" aria-label="Coupon code" value="${esc(Cart.prefs.couponCode)}" maxlength="40">
          ${Cart.prefs.couponCode ? `<button class="btn btn-outline btn-sm" type="button" data-coupon-remove>Remove</button>` : `<button class="btn btn-dark btn-sm" type="submit">Apply</button>`}</form>
        ${
          q && Cart.prefs.couponCode
            ? q.couponCode
              ? `<div class="coupon-msg ok">${esc(q.couponCode)} applied — you save ${inr(q.discount)}</div>`
              : `<div class="coupon-msg err">${esc(q.couponError)}</div>`
            : ""
        }
        ${totalsHtml(q)}
        <div class="drawer-actions">
          <button class="btn btn-primary btn-block" type="button" data-step="checkout" ${!q || q.hasProblems || !q.subtotal ? "disabled" : ""}>Checkout</button>
          <button class="btn btn-wa btn-block" type="button" data-wa-order ${!q || !q.subtotal ? "disabled" : ""}>${I.wa} Order via WhatsApp</button>
          ${q && q.hasProblems ? `<p class="coupon-msg err" style="text-align:center">Remove unavailable items to continue.</p>` : ""}
        </div>`;
    }

    drawerEl.innerHTML = `<div class="drawer-head"><h2>${drawerStep === "checkout" ? "Checkout" : `Your cart${count ? ` (${count})` : ""}`}</h2>
      <button class="icon-btn" type="button" data-close aria-label="Close cart">${I.close}</button></div>
      <div class="drawer-body">${body}</div>${foot ? `<div class="drawer-foot">${foot}</div>` : ""}`;
  }

  /** "You may also like": featured, in-stock products that aren't in the cart yet. */
  function upsellHtml() {
    const inCart = new Set(Cart.items.map((i) => i.variantId));
    const picks = (state.catalog?.products || [])
      .map((p) => ({ p, v: p.variants.find((x) => x.stockQty > 0) }))
      .filter(({ p, v }) => v && !p.variants.some((x) => inCart.has(x.id)))
      .sort((a, b) => Number(b.p.isFeatured) - Number(a.p.isFeatured))
      .slice(0, 3);
    if (!picks.length) return "";
    return `<div class="upsell"><h3>You may also like</h3><div class="upsell-row">${picks
      .map(
        ({ p, v }) => `<div class="upsell-item"><a class="thumb" href="/product/${esc(p.slug)}">${productVisual(p, v.sizeLabel)}</a>
          <b>${esc(p.name)}</b><span class="muted">${inr(v.price)} · ${esc(v.sizeLabel)}</span>
          <button type="button" data-upsell="${v.id}" aria-label="Add ${esc(p.name)} to cart">+ Add</button></div>`,
      )
      .join("")}</div></div>`;
  }

  function addressPickerHtml() {
    const list = state.addresses || [];
    if (!list.length) return "";
    return `<div class="field"><span class="label">Saved addresses</span><div class="addr-pick">${list
      .map(
        (a) => `<label><input type="radio" name="savedAddress" ${a.isDefault ? "checked" : ""} data-use-address="${a.id}">
          <span><b>${esc(a.label)}</b>${a.isDefault ? ' <span class="muted">(default)</span>' : ""}<br>${esc(a.address)} — ${esc(a.pincode)}</span></label>`,
      )
      .join("")}</div></div>`;
  }

  function fillAddress(a) {
    const f = $("#checkout-form", drawerEl);
    if (!f) return;
    if (f.address) f.address.value = a.address;
    if (f.pincode) f.pincode.value = a.pincode;
    if (f.name && !f.name.value) f.name.value = a.name;
    if (f.phone && !f.phone.value) f.phone.value = a.phone;
  }

  async function loadAddresses() {
    if (!state.user || state.addresses) return;
    try {
      state.addresses = (await api("GET", "/api/account/addresses")).addresses;
    } catch {
      state.addresses = [];
    }
  }

  function totalsHtml(q) {
    if (!q) return `<div class="totals"><div><span>Calculating…</span></div></div>`;
    return `<div class="totals">
      <div><span>Subtotal (${q.itemCount} item${q.itemCount === 1 ? "" : "s"})</span><span>${inr(q.subtotal)}</span></div>
      ${q.discount > 0 ? `<div class="disc"><span>Discount (${esc(q.couponCode)})</span><span>− ${inr(q.discount)}</span></div>` : ""}
      <div><span>${Cart.prefs.fulfillment === "pickup" ? "Store pickup" : "Delivery"}</span><span>${q.deliveryFee > 0 ? inr(q.deliveryFee) : "Free"}</span></div>
      <div class="grand"><span>Total</span><span>${inr(q.total)}</span></div></div>`;
  }

  async function onDrawerClick(e) {
    const t = e.target.closest("button, a");
    if (!t) return;
    if (t.hasAttribute("data-close")) return closeDrawer();
    if (t.dataset.qty) {
      const id = Number(t.dataset.qty);
      const item = Cart.items.find((i) => i.variantId === id);
      if (item) await guard(() => Cart.setQty(id, item.quantity + Number(t.dataset.delta)));
      return;
    }
    if (t.dataset.remove) {
      const id = Number(t.dataset.remove);
      const prevQty = Cart.items.find((i) => i.variantId === id)?.quantity || 1;
      const row = t.closest(".line-item");
      if (row) {
        row.classList.add("leaving");
        await new Promise((r) => setTimeout(r, 220));
      }
      await guard(() => Cart.remove(id));
      const meta = findVariant(id);
      toast(`${meta ? meta.product.name : "Item"} removed`, { action: { label: "Undo", onClick: () => guard(() => Cart.setQty(id, prevQty)) } });
      return;
    }
    if (t.dataset.upsell) return guard(() => Cart.add(Number(t.dataset.upsell), 1));
    if (t.dataset.fulfil) return Cart.setPref("fulfillment", t.dataset.fulfil);
    if (t.hasAttribute("data-coupon-remove")) return Cart.setPref("couponCode", "");
    if (t.dataset.step) {
      drawerStep = t.dataset.step;
      if (drawerStep === "checkout") await loadAddresses();
      renderDrawer();
      if (drawerStep === "checkout") {
        const def = (state.addresses || []).find((a) => a.isDefault);
        if (def) fillAddress(def);
      }
      $(".drawer-body", drawerEl).scrollTop = 0;
      return;
    }
    if (t.hasAttribute("data-wa-order")) return orderViaWhatsApp();
  }

  async function guard(fn) {
    try {
      await fn();
    } catch (err) {
      toast(err.message, { error: true });
    }
  }

  drawerSubmitCoupon();
  function drawerSubmitCoupon() {
    document.addEventListener("submit", async (e) => {
      const form = e.target.closest("[data-coupon-form]");
      if (!form) return;
      e.preventDefault();
      const code = form.code.value.trim().toUpperCase();
      if (!code) return;
      try {
        const r = await api("POST", "/api/coupons/validate", { code, items: Cart.items });
        if (!r.valid) {
          toast(r.error, { error: true });
          return;
        }
        Cart.setPref("couponCode", r.code);
        toast(r.message);
      } catch (err) {
        toast(err.message, { error: true });
      }
    });
  }

  function formValues() {
    const f = $("#checkout-form", drawerEl);
    if (!f) return {};
    const data = Object.fromEntries(new FormData(f).entries());
    return data;
  }

  async function onCheckoutSubmit(e) {
    if (e.target.id !== "checkout-form") return;
    e.preventDefault();
    const errBox = $("#checkout-error", drawerEl);
    errBox.classList.add("hidden");
    const v = formValues();
    const phone = String(v.phone || "").replace(/\D/g, "").slice(-10);
    const problems = [];
    if (!v.name || v.name.trim().length < 2) problems.push("Enter your name");
    if (!/^[6-9]\d{9}$/.test(phone)) problems.push("Enter a valid 10-digit mobile number");
    if (Cart.prefs.fulfillment === "delivery") {
      if (!v.address || v.address.trim().length < 8) problems.push("Enter your full delivery address");
      if (!/^[1-9]\d{5}$/.test(String(v.pincode || ""))) problems.push("Enter a valid 6-digit pincode");
    }
    if (problems.length) {
      errBox.textContent = problems.join(" · ");
      errBox.classList.remove("hidden");
      return;
    }
    const btn = $('button[type="submit"]', drawerEl);
    btn.disabled = true;
    btn.textContent = "Placing order…";
    try {
      const order = await api("POST", "/api/orders", {
        items: Cart.items,
        name: v.name,
        phone,
        fulfillment: Cart.prefs.fulfillment,
        address: v.address,
        pincode: v.pincode,
        paymentMethod: v.paymentMethod,
        notes: v.notes,
        couponCode: Cart.prefs.couponCode,
      });
      Cart.items = [];
      store.set(CART_KEY, []);
      Cart.prefs.couponCode = "";
      store.set(PREF_KEY, Cart.prefs);
      Cart.changed(false);
      closeDrawer();
      showReceipt(order, v.name);
      state.catalog = null; // stock changed
      window.dispatchEvent(new Event("varam:catalog-stale"));
    } catch (err) {
      errBox.textContent = err.message + (err.data?.details ? " — " + err.data.details.map((d) => `${d.name}: ${d.reason}`).join(", ") : "");
      errBox.classList.remove("hidden");
      btn.disabled = false;
      btn.textContent = "Place order";
      Cart.refreshQuote();
    }
  }

  function showReceipt(order, name) {
    const s = state.settings || {};
    const wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-label", "Order placed");
    const pay =
      order.paymentMethod === "UPI"
        ? order.upiId
          ? `Pay <b>${inr(order.total)}</b> by UPI to <b>${esc(order.upiId)}</b> and share the screenshot on WhatsApp.`
          : "We'll share UPI payment details on WhatsApp when we confirm your order."
        : "Pay at the store when you collect your order.";
    const waText = `Hello Varam! I just placed order ${order.orderNumber} (${inr(order.total)}). Name: ${name}.`;
    wrap.innerHTML = `<div class="backdrop show" data-x></div><div class="modal-card">
      <div class="tick">${I.check}</div>
      <h2>Thank you, ${esc(String(name).split(" ")[0])}!</h2>
      <p class="muted" style="margin-top:6px">Your order has been placed.</p>
      <div class="order-no">${esc(order.orderNumber)}</div>
      <div class="receipt">
        ${order.lines.map((l) => `<div><span>${esc(l.name)} · ${esc(l.sizeLabel)} × ${l.quantity}</span><span>${inr(l.lineTotal)}</span></div>`).join("")}
        ${order.discount > 0 ? `<div><span>Discount</span><span>− ${inr(order.discount)}</span></div>` : ""}
        <div><span>${order.fulfillment === "pickup" ? "Store pickup" : "Delivery"}</span><span>${order.deliveryFee > 0 ? inr(order.deliveryFee) : "Free"}</span></div>
        <div style="font-weight:800"><span>Total</span><span>${inr(order.total)}</span></div>
      </div>
      <p style="margin-top:14px;font-size:14px">${pay}</p>
      <div class="actions">
        <a class="btn btn-primary" href="${esc(order.invoiceUrl)}" target="_blank" rel="noopener">View &amp; print invoice</a>
        <a class="btn btn-wa" href="https://wa.me/${esc(s.whatsappNumber)}?text=${encodeURIComponent(waText)}" target="_blank" rel="noopener">${I.wa} Message us on WhatsApp</a>
        <button class="btn btn-outline" type="button" data-x>Continue shopping</button>
      </div></div>`;
    document.body.appendChild(wrap);
    document.body.style.overflow = "hidden";
    const close = () => {
      wrap.remove();
      document.body.style.overflow = "";
    };
    $$("[data-x]", wrap).forEach((el) => el.addEventListener("click", close));
    wrap.addEventListener("keydown", (e) => e.key === "Escape" && close());
    $(".btn", wrap).focus();
  }

  /** Build an itemised WhatsApp message from the live quote and open Click-to-Chat. */
  function orderViaWhatsApp() {
    const q = Cart.quote;
    const s = state.settings || {};
    if (!q || !q.subtotal) return;
    const v = formValues();
    const u = state.user || {};
    const name = (v.name || u.name || "").trim();
    const phone = (v.phone || u.phone || "").trim();
    const address = (v.address || u.defaultAddress || "").trim();
    const pin = (v.pincode || u.pincode || "").trim();
    const lines = q.lines.filter((l) => l.available && l.stock >= l.quantity);
    const msg = [
      "Hello Varam! 🙏 I would like to place an order.",
      "",
      "*ORDER DETAILS*",
      ...lines.map((l, i) => `${i + 1}. *${l.name}* — ${l.sizeLabel} × ${l.quantity} = ${inr(l.lineTotal)}`),
      "",
      `Subtotal: ${inr(q.subtotal)}`,
      ...(q.discount > 0 ? [`Discount (${q.couponCode}): −${inr(q.discount)}`] : []),
      `${Cart.prefs.fulfillment === "pickup" ? "Store pickup (BRTS Rd, Vijayawada)" : "Home delivery"}: ${q.deliveryFee > 0 ? inr(q.deliveryFee) : "Free"}`,
      `*Total: ${inr(q.total)}*`,
      "",
      ...(name ? [`Name: ${name}`] : []),
      ...(phone ? [`Phone: ${phone}`] : []),
      ...(Cart.prefs.fulfillment === "delivery" && address ? [`Address: ${address}${pin ? " - " + pin : ""}`] : []),
      "",
      "Please confirm availability and payment details. Thank you!",
    ].join("\n");
    const url = `https://wa.me/${s.whatsappNumber}?text=${encodeURIComponent(msg)}`;
    const win = window.open(url, "_blank");
    if (win) win.opener = null;
    else location.href = url;
    toast("Opening WhatsApp with your order…");
  }

  /* ---------------- Wishlist ---------------- */

  const Wishlist = {
    ids: new Set(),
    async load() {
      if (!state.user) return;
      try {
        this.ids = new Set((await api("GET", "/api/account/wishlist")).productIds);
      } catch {
        this.ids = new Set();
      }
      this.paint();
    },
    has(id) {
      return this.ids.has(Number(id));
    },
    paint(root = document) {
      $$("[data-wish]", root).forEach((b) => b.setAttribute("aria-pressed", String(this.has(b.dataset.wish))));
    },
    async toggle(productId, btn) {
      if (!state.user) {
        toast("Sign in to save your favourites", {
          action: { label: "Sign in", onClick: () => (location.href = "/login?next=" + encodeURIComponent(location.pathname)) },
        });
        return;
      }
      const id = Number(productId);
      const on = !this.has(id);
      try {
        const r = await api(on ? "POST" : "DELETE", `/api/account/wishlist/${id}`);
        this.ids = new Set(r.productIds);
        this.paint();
        if (btn) {
          btn.classList.remove("pop");
          void btn.offsetWidth;
          btn.classList.add("pop");
        }
        toast(on ? "Saved to your wishlist" : "Removed from your wishlist");
        window.dispatchEvent(new Event("varam:wishlist"));
      } catch (err) {
        toast(err.message, { error: true });
      }
    },
  };
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-wish]");
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    Wishlist.toggle(b.dataset.wish, b);
  });

  /** Add to cart with a fly-to-cart animation from the product visual. */
  async function addToCart(variantId, quantity = 1, fromEl, label) {
    if (fromEl && window.VaramMotion) window.VaramMotion.flyToCart(fromEl);
    await Cart.add(Number(variantId), quantity);
    if (label) toast(`${label} added to cart`, { action: { label: "View cart", onClick: openDrawer } });
  }

  /* ---------------- Boot ---------------- */

  async function boot() {
    try {
      const [me] = await Promise.all([api("GET", "/api/auth/me"), loadCatalog()]);
      state.user = me.user;
    } catch (err) {
      console.error(err);
      state.settings = state.settings || (await api("GET", "/api/settings").catch(() => null));
    }
    renderHeader();
    renderFooter();
    Wishlist.load();
    try {
      await Cart.load();
    } catch (err) {
      toast(err.message, { error: true });
    }
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-open-cart]")) {
        e.preventDefault();
        openDrawer();
      }
    });
    if (location.hash === "#cart") openDrawer();
  }

  state.ready = boot();

  window.Varam = {
    api,
    esc,
    inr,
    $,
    $$,
    I,
    toast,
    debounce,
    store,
    state,
    Cart,
    Wishlist,
    addToCart,
    bottleSvg,
    productVisual,
    loadCatalog,
    openDrawer,
    closeDrawer,
    renderHeader,
    ready: () => state.ready,
  };
})();
