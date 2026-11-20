/* Varam — /shop: category tiles, filters (sidebar on desktop, bottom sheet on phones), search, sort */
(function () {
  "use strict";
  const { $, $$, esc, I, state, loadCatalog, debounce } = window.Varam;
  const C = window.VaramCatalog;

  $$("[data-icon]").forEach((el) => {
    if (I[el.dataset.icon]) el.innerHTML = I[el.dataset.icon];
  });
  $(".sf-close").innerHTML = I.close;

  const params = new URLSearchParams(location.search);
  const view = {
    category: params.get("category") || "all",
    q: params.get("q") || "",
    sort: params.get("sort") || "featured",
    price: params.get("price") || "all",
    stock: params.get("stock") === "1",
  };

  const grid = $("#shop-grid");
  const panel = $("#shop-filters");
  const backdrop = $(".sf-backdrop");
  const openBtn = $("#open-filters");

  function priceOk(p) {
    if (view.price === "all") return true;
    const [lo, hi] = view.price.split("-").map((n) => (n === "" ? null : Number(n)));
    const price = C.minPrice(p);
    return (lo === null || price >= lo) && (hi === null || price < hi);
  }

  function filtered() {
    const term = view.q.trim().toLowerCase();
    const list = state.catalog.products.filter(
      (p) =>
        (view.category === "all" || p.category?.slug === view.category) &&
        priceOk(p) &&
        (!view.stock || C.inStock(p)) &&
        (!term || [p.name, p.tagline, p.description, p.category?.name].join(" ").toLowerCase().includes(term)),
    );
    if (view.sort === "price-asc") list.sort((a, b) => C.minPrice(a) - C.minPrice(b));
    if (view.sort === "price-desc") list.sort((a, b) => C.minPrice(b) - C.minPrice(a));
    if (view.sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }

  function syncUrl() {
    const p = new URLSearchParams();
    if (view.category !== "all") p.set("category", view.category);
    if (view.q) p.set("q", view.q);
    if (view.sort !== "featured") p.set("sort", view.sort);
    if (view.price !== "all") p.set("price", view.price);
    if (view.stock) p.set("stock", "1");
    history.replaceState(null, "", `${location.pathname}${p.toString() ? "?" + p : ""}`);
  }

  const priceLabel = { "0-500": "Under ₹500", "500-800": "₹500 – ₹800", "800-": "₹800 and above" };

  function renderFilters() {
    const cats = state.catalog.categories;
    $("#f-category").innerHTML = [{ slug: "all", name: "All products", count: state.catalog.products.length }, ...cats]
      .map(
        (c) =>
          `<label><input type="radio" name="category" value="${esc(c.slug)}" ${view.category === c.slug ? "checked" : ""}> <span>${esc(c.name)}</span><small>${c.count}</small></label>`,
      )
      .join("");
    $$('#f-price input[name="price"]').forEach((r) => (r.checked = r.value === view.price));
    $("#f-stock").checked = view.stock;
    $("#shop-sort").value = view.sort;
    $("#shop-search").value = view.q;
    $$("#cat-tiles [data-cat]").forEach((t) => t.setAttribute("aria-current", String(t.dataset.cat === view.category)));
  }

  function renderChips() {
    const chips = [];
    const cat = state.catalog.categories.find((c) => c.slug === view.category);
    if (cat) chips.push(["category", cat.name]);
    if (view.price !== "all") chips.push(["price", priceLabel[view.price]]);
    if (view.stock) chips.push(["stock", "In stock"]);
    if (view.q) chips.push(["q", `“${view.q}”`]);
    $("#active-chips").innerHTML = chips
      .map(([k, label]) => `<button type="button" class="chip on" data-remove-filter="${k}" aria-label="Remove filter ${esc(label)}">${esc(label)} <span aria-hidden="true">×</span></button>`)
      .join("");
    const n = chips.filter(([k]) => k !== "q").length;
    $("#sf-badge").textContent = String(n);
    $("#sf-badge").classList.toggle("hidden", n === 0);
  }

  function render({ animate = true } = {}) {
    const list = filtered();
    $("#shop-count").textContent = `${list.length} product${list.length === 1 ? "" : "s"}`;
    $("#sf-count").textContent = String(list.length);
    grid.innerHTML = list.length
      ? list.map(C.cardHtml).join("")
      : `<div class="empty" style="grid-column:1/-1"><h3>Nothing matches yet</h3>
          <p class="muted" style="margin:6px 0 14px">Try another word, or clear the filters.</p>
          <button class="btn btn-outline" type="button" data-reset>Clear filters</button></div>`;
    renderChips();
    renderFilters();
    if (animate) C.animateIn(grid);
  }

  function update(changes) {
    Object.assign(view, changes);
    syncUrl();
    render();
  }

  function reset() {
    update({ category: "all", q: "", price: "all", stock: false });
  }

  /* ---------------- Mobile bottom sheet ---------------- */

  const isSheet = () => window.matchMedia("(max-width: 979px)").matches;
  function openFilters() {
    panel.classList.add("open");
    backdrop.hidden = false;
    openBtn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    setTimeout(() => panel.querySelector("input")?.focus(), 50);
  }
  function closeFilters() {
    if (!panel.classList.contains("open")) return;
    panel.classList.remove("open");
    backdrop.hidden = true;
    openBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    openBtn.focus();
  }
  openBtn.addEventListener("click", openFilters);
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-filters]")) closeFilters();
  });
  document.addEventListener("keydown", (e) => e.key === "Escape" && closeFilters());
  window.addEventListener("resize", () => !isSheet() && closeFilters());

  /* ---------------- Events ---------------- */

  panel.addEventListener("change", (e) => {
    if (e.target.name === "category") update({ category: e.target.value });
    if (e.target.name === "price") update({ price: e.target.value });
    if (e.target.id === "f-stock") update({ stock: e.target.checked });
  });
  panel.addEventListener("click", (e) => {
    if (e.target.closest("[data-clear-filters]")) reset();
  });
  $("#shop-sort").addEventListener("change", (e) => update({ sort: e.target.value }));
  $("#shop-search").addEventListener(
    "input",
    debounce((e) => update({ q: e.target.value.trim() }), 160),
  );
  $("#active-chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-remove-filter]");
    if (!b) return;
    const k = b.dataset.removeFilter;
    update(k === "category" ? { category: "all" } : k === "price" ? { price: "all" } : k === "stock" ? { stock: false } : { q: "" });
  });
  $("#cat-tiles").addEventListener("click", (e) => {
    const t = e.target.closest("[data-cat]");
    if (!t) return;
    e.preventDefault();
    update({ category: view.category === t.dataset.cat ? "all" : t.dataset.cat });
    $("#shop-count").scrollIntoView({ behavior: window.VaramMotion?.reduce ? "auto" : "smooth", block: "start" });
  });

  C.bindGrid(grid, { onReset: reset });

  // Header search on this page filters in place
  window.VARAM_HOME = {
    search(term) {
      update({ q: term, category: "all" });
    },
  };
  window.addEventListener("varam:catalog-stale", async () => {
    await loadCatalog();
    render({ animate: false });
  });

  window.Varam.ready().then(async () => {
    try {
      await loadCatalog();
      render();
    } catch (err) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><h3>Couldn't load products</h3><p class="muted">${esc(err.message)}</p></div>`;
    }
    const s = state.settings;
    if (s && s.whatsappNumber) {
      $("#shop-wa").href = `https://wa.me/${s.whatsappNumber}?text=${encodeURIComponent("Hello Varam! Which oil would you suggest for my cooking? I mostly make: ")}`;
    }
  });
})();
