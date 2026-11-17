/* Varam — home page: catalogue, reviews, store map (FAQ teaser and contact details are server-rendered) */
(function () {
  "use strict";
  const { $, $$, esc, inr, I, Cart, toast, bottleSvg, productVisual, loadCatalog, state, debounce } = window.Varam;

  // Fill [data-icon] placeholders with SVG icons
  function paintIcons(root = document) {
    $$("[data-icon]", root).forEach((el) => {
      if (I[el.dataset.icon]) el.innerHTML = I[el.dataset.icon];
    });
  }
  paintIcons();

  /* ---------------- Catalogue ---------------- */

  const params = new URLSearchParams(location.search);
  const view = { category: params.get("category") || "all", q: params.get("q") || "", sort: "featured" };
  const selected = new Map(); // productId -> variantId

  const minPrice = (p) => Math.min(...p.variants.map((v) => v.price));
  const stockBadge = (v) =>
    v.stockStatus === "out"
      ? '<span class="badge badge-out"><i class="dot"></i>Out of Stock</span>'
      : v.stockStatus === "low"
        ? `<span class="badge badge-low"><i class="dot"></i>Low Stock</span>`
        : '<span class="badge badge-in"><i class="dot"></i>In Stock</span>';

  function pickVariant(p) {
    const id = selected.get(p.id);
    return p.variants.find((v) => v.id === id) || p.variants.find((v) => v.stockQty > 0) || p.variants[0];
  }

  function cardHtml(p) {
    const v = pickVariant(p);
    const save = v.mrp > v.price ? Math.round(((v.mrp - v.price) / v.mrp) * 100) : 0;
    return `<article class="card" data-product="${p.id}" id="p-${esc(p.slug)}" data-tilt="5">
      <a class="card-link" href="/product/${esc(p.slug)}" aria-label="View ${esc(p.name)}"></a>
      <div class="card-media">
        <div class="badges"><span>${p.badgeText ? `<span class="badge badge-brand">${esc(p.badgeText)}</span>` : ""}</span>${stockBadge(v)}</div>
        <button class="heart" type="button" data-wish="${p.id}" aria-pressed="${window.Varam.Wishlist.has(p.id)}" aria-label="Save ${esc(p.name)} to wishlist">${I.heart}</button>
        ${productVisual(p, v.sizeLabel)}
      </div>
      <div class="card-body">
        <span class="card-cat">${esc(p.category?.name || "")}</span>
        <h3>${esc(p.name)}</h3>
        <p class="tagline">${esc(p.tagline)}</p>
        ${p.reviewCount > 0 ? `<div class="stars">${I.star}<b>${p.rating.toFixed(1)}</b> (${p.reviewCount})</div>` : ""}
        <div class="sizes" role="radiogroup" aria-label="Pack size for ${esc(p.name)}">
          ${p.variants
            .map(
              (x) =>
                `<button type="button" class="size${x.stockQty <= 0 ? " out" : ""}" role="radio" aria-checked="${x.id === v.id}" data-variant="${x.id}">${esc(x.sizeLabel)}</button>`,
            )
            .join("")}
        </div>
        <div class="price-row">
          <div class="price">${inr(v.price)}${v.mrp > v.price ? `<s>${inr(v.mrp)}</s>` : ""}
            <small>${esc(v.sizeLabel)}${save ? ` · <span class="save">${save}% off</span>` : ""}</small></div>
          <button class="btn btn-primary add-btn" type="button" data-add="${v.id}" ${v.stockQty <= 0 ? "disabled" : ""} aria-label="Add ${esc(p.name)} ${esc(v.sizeLabel)} to cart">
            ${I.plus}<span class="lbl">${v.stockQty <= 0 ? "Sold out" : "Add"}</span></button>
        </div>
      </div>
    </article>`;
  }

  function filtered(products) {
    const term = view.q.trim().toLowerCase();
    let list = products.filter((p) => {
      if (view.category !== "all" && p.category?.slug !== view.category) return false;
      if (!term) return true;
      return [p.name, p.tagline, p.description, p.category?.name].join(" ").toLowerCase().includes(term);
    });
    list = [...list];
    if (view.sort === "price-asc") list.sort((a, b) => minPrice(a) - minPrice(b));
    if (view.sort === "price-desc") list.sort((a, b) => minPrice(b) - minPrice(a));
    if (view.sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }

  function renderPills(categories, total) {
    const all = [{ slug: "all", name: "All", count: total, iconSvg: "" }, ...categories];
    $("#category-pills").innerHTML = all
      .map(
        (c) =>
          `<button type="button" class="pill" data-cat="${esc(c.slug)}" aria-pressed="${view.category === c.slug}">${c.iconSvg || ""}${esc(c.name)} <span class="count">${c.count}</span></button>`,
      )
      .join("");
  }

  function renderGrid() {
    const { products } = state.catalog;
    const list = filtered(products);
    const cat = state.catalog.categories.find((c) => c.slug === view.category);
    $("#result-count").textContent = `${list.length} product${list.length === 1 ? "" : "s"}${cat ? ` in ${cat.name}` : ""}${view.q ? ` matching “${view.q}”` : ""}`;
    $("#product-grid").innerHTML = list.length
      ? list.map(cardHtml).join("")
      : `<div class="empty" style="grid-column:1/-1"><h3>No products found</h3><p class="muted" style="margin:6px 0 14px">Try another word or category.</p><button class="btn btn-outline" type="button" data-reset>Show all products</button></div>`;
    $$("#category-pills .pill").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cat === view.category)));
    // Staggered entrance (Framer-Motion-style) every time the grid re-filters
    const M = window.VaramMotion;
    if (M) {
      $$("#product-grid .card").forEach((card, i) =>
        M.animate(card, [{ opacity: 0, transform: "translateY(24px) scale(0.97)" }, { opacity: 1, transform: "none" }], { duration: 600, delay: Math.min(i, 8) * 60 }),
      );
      M.tilt($("#product-grid"));
    }
  }

  function syncUrl() {
    const p = new URLSearchParams();
    if (view.category !== "all") p.set("category", view.category);
    if (view.q) p.set("q", view.q);
    history.replaceState(null, "", `${location.pathname}${p.toString() ? "?" + p : ""}${location.hash}`);
  }

  async function initCatalog() {
    const catalog = await loadCatalog();
    renderPills(catalog.categories, catalog.products.length);
    $("#catalog-search").value = view.q;
    renderGrid();
    $("#hero-bottles").innerHTML = catalog.products
      .filter((p) => !/ghee|honey/i.test(p.name))
      .slice(0, 3)
      .map((p) => bottleSvg(p.name, p.accentColor))
      .join("");
  }

  $("#category-pills").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    view.category = b.dataset.cat;
    syncUrl();
    renderGrid();
  });
  $("#catalog-search").addEventListener(
    "input",
    debounce((e) => {
      view.q = e.target.value.trim();
      syncUrl();
      renderGrid();
    }, 150),
  );
  $("#catalog-sort").addEventListener("change", (e) => {
    view.sort = e.target.value;
    renderGrid();
  });

  $("#product-grid").addEventListener("click", async (e) => {
    if (e.target.closest("[data-reset]")) {
      view.category = "all";
      view.q = "";
      $("#catalog-search").value = "";
      syncUrl();
      renderGrid();
      return;
    }
    const sizeBtn = e.target.closest("[data-variant]");
    if (sizeBtn) {
      const card = sizeBtn.closest("[data-product]");
      const productId = Number(card.dataset.product);
      selected.set(productId, Number(sizeBtn.dataset.variant));
      const p = state.catalog.products.find((x) => x.id === productId);
      card.outerHTML = cardHtml(p);
      const fresh = document.querySelector(`[data-product="${productId}"]`);
      window.VaramMotion?.tilt(fresh.parentElement);
      window.VaramMotion?.animate(fresh.querySelector(".price"), [{ opacity: 0.2, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 350 });
      fresh.querySelector(`[data-variant="${sizeBtn.dataset.variant}"]`)?.focus();
      return;
    }
    const addBtn = e.target.closest("[data-add]");
    if (addBtn) {
      addBtn.disabled = true;
      try {
        const card = addBtn.closest(".card");
        const name = card.querySelector("h3").textContent;
        await window.Varam.addToCart(addBtn.dataset.add, 1, card.querySelector(".card-media svg, .card-media img"), name);
      } catch (err) {
        toast(err.message, { error: true });
      } finally {
        addBtn.disabled = false;
      }
    }
  });

  // Header search jumps here on the home page
  window.VARAM_HOME = {
    search(term) {
      view.q = term;
      view.category = "all";
      $("#catalog-search").value = term;
      syncUrl();
      if (state.catalog) renderGrid();
    },
  };

  // Stock changes after an order → reload catalogue
  window.addEventListener("varam:wishlist", () => window.Varam.Wishlist.paint());
  window.addEventListener("varam:catalog-stale", async () => {
    await loadCatalog();
    renderGrid();
  });

  /* ---------------- Reviews ---------------- */

  function renderReviews() {
    const s = state.settings;
    if (!s) return;
    const stars = (n) => `<span class="stars" aria-label="${n} out of 5">${I.star.repeat(Math.round(n))}</span>`;
    $("#reviews-summary").innerHTML = s.googleRating
      ? `<span class="score">${s.googleRating.toFixed(1)}</span>
         <div>${stars(s.googleRating)}<div class="muted" style="font-size:14px">Based on ${s.googleReviewCount} Google reviews</div></div>
         <div class="rs-actions">
           ${s.googleReviewsUrl ? `<a class="btn btn-outline btn-sm" href="${esc(s.googleReviewsUrl)}" target="_blank" rel="noopener">Read reviews on Google</a>
           <a class="btn btn-primary btn-sm" href="${esc(s.googleReviewsUrl)}" target="_blank" rel="noopener">Write a review</a>` : ""}</div>`
      : "";
    $("#testimonials").innerHTML = s.testimonials
      .map(
        (t) => `<figure class="testimonial">${stars(t.rating || 5)}<p>“${esc(t.text)}”</p><footer>${esc(t.name)} <span>· ${esc(t.source || "Customer")}</span></footer></figure>`,
      )
      .join("");
    if (!s.googleRating && !s.testimonials.length) $("#reviews").hidden = true;
  }

  /* ---------------- Store map ---------------- */

  function renderStore() {
    const s = state.settings;
    if (!s) return;
    const mapQ = encodeURIComponent(`${s.storeName}, ${s.storeAddress}`);
    $("#store-card").innerHTML = `
      <iframe title="Map showing the Varam store in Vijayawada" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${mapQ}&z=16&output=embed"></iframe>
      <div class="info"><span class="kicker">Varam store</span><h3>Visit us in Vijayawada</h3>
        <div class="row">${I.pin}<span>${esc(s.storeAddress)}</span></div>
        <div class="row">${I.clock}<span>${esc(s.storeHours)}</span></div>
        <div class="actions">
          <a class="btn btn-primary" href="https://www.google.com/maps/dir/?api=1&destination=${mapQ}" target="_blank" rel="noopener">${I.nav} Get directions</a>
          ${s.mapsUrl ? `<a class="btn btn-outline" href="${esc(s.mapsUrl)}" target="_blank" rel="noopener">Google Maps</a>` : ""}
        </div></div>`;
    $("#hero-wa").href = `https://wa.me/${s.whatsappNumber}?text=${encodeURIComponent("Hello Varam! I'd like to order cold-pressed oil.")}`;
    $("#bulk-wa").href = `https://wa.me/${s.whatsappNumber}?text=${encodeURIComponent("Hello Varam! I'd like a quote for a bulk / monthly order:\n\nProducts:\nQuantity:\nDelivery city & country:")}`;
  }

  /* ---------------- Boot ---------------- */

  window.Varam.ready().then(async () => {
    try {
      await initCatalog();
    } catch (err) {
      $("#product-grid").innerHTML = `<div class="empty" style="grid-column:1/-1"><h3>Couldn't load products</h3><p class="muted">${esc(err.message)}</p></div>`;
    }
    renderReviews();
    renderStore();
    if (location.hash && location.hash !== "#cart") document.querySelector(location.hash)?.scrollIntoView();
  });
})();
