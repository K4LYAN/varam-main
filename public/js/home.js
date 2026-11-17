/* Varam — home page: catalogue, process switcher, reviews, store, FAQ */
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
    window.VaramMotion?.count($("#hero-products"), catalog.products.length);
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

  /* ---------------- Process switcher ---------------- */

  const STEPS = [
    {
      title: "Careful seed selection",
      text: "Groundnuts, sesame, coconut and mustard seeds are cleaned and sorted by hand before they reach the press.",
      tag: "Step 1",
      img: "https://images.unsplash.com/photo-1785619564649-658675821809?auto=format&fit=crop&w=1200&q=70",
    },
    {
      title: "Slow wood-pressing (mara chekku)",
      text: "The seeds are crushed slowly in a traditional wooden ghani. Slow pressing keeps the heat low and the natural aroma intact.",
      tag: "Step 2",
      img: "https://images.unsplash.com/photo-1768689033119-c3ac1e437d20?auto=format&fit=crop&w=1200&q=70",
    },
    {
      title: "Natural settling",
      text: "Freshly pressed oil is left to rest so fine particles settle naturally — no bleaching, no deodorising, no chemicals.",
      tag: "Step 3",
      img: "https://images.unsplash.com/photo-1709293078197-370c804d610c?auto=format&fit=crop&w=1200&q=70",
    },
    {
      title: "Filtering & bottling",
      text: "The settled oil is filtered and packed in bottles and tins, ready for your kitchen or for pickup at our store.",
      tag: "Step 4",
      img: "https://images.unsplash.com/photo-1611608927037-4e8da6aa170e?auto=format&fit=crop&w=1200&q=70",
    },
  ];
  let stepIndex = 0;

  function renderProcess() {
    $("#process-steps").innerHTML = STEPS.map(
      (s, i) =>
        `<button type="button" class="step" role="tab" id="step-${i}" aria-controls="process-visual" aria-selected="${i === stepIndex}" tabindex="${i === stepIndex ? 0 : -1}" data-step="${i}">
          <span class="num">${i + 1}</span><span><b>${esc(s.title)}</b><span>${esc(s.text.split(".")[0])}.</span></span></button>`,
    ).join("");
    const s = STEPS[stepIndex];
    const vis = $("#process-visual");
    vis.setAttribute("aria-labelledby", `step-${stepIndex}`);
    vis.innerHTML = `<img src="${s.img}" alt="" loading="lazy"><div class="overlay"></div>
      <div class="copy"><span class="tag">${esc(s.tag)}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>`;
  }
  $("#process-steps").addEventListener("click", (e) => {
    const b = e.target.closest("[data-step]");
    if (!b) return;
    stepIndex = Number(b.dataset.step);
    renderProcess();
    $(`#step-${stepIndex}`).focus();
  });
  $("#process-steps").addEventListener("keydown", (e) => {
    if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)) return;
    e.preventDefault();
    stepIndex = (stepIndex + (e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1) + STEPS.length) % STEPS.length;
    renderProcess();
    $(`#step-${stepIndex}`).focus();
  });
  renderProcess();

  /* ---------------- Reviews ---------------- */

  function renderReviews() {
    const s = state.settings;
    if (!s) return;
    const stars = (n) => `<span class="stars" aria-label="${n} out of 5">${I.star.repeat(Math.round(n))}</span>`;
    $("#reviews-summary").innerHTML = s.googleRating
      ? `<span class="score">${s.googleRating.toFixed(1)}</span>
         <div>${stars(s.googleRating)}<div class="muted" style="font-size:14px">Based on ${s.googleReviewCount} Google reviews</div></div>
         <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
           ${s.googleReviewsUrl ? `<a class="btn btn-outline btn-sm" href="${esc(s.googleReviewsUrl)}" target="_blank" rel="noopener">Read reviews on Google</a>
           <a class="btn btn-primary btn-sm" href="${esc(s.googleReviewsUrl)}" target="_blank" rel="noopener">Write a review</a>` : ""}</div>`
      : "";
    $("#testimonials").innerHTML = s.testimonials
      .map(
        (t) => `<figure class="testimonial">${stars(t.rating || 5)}<p>“${esc(t.text)}”</p><footer>${esc(t.name)} <span>· ${esc(t.source || "Customer")}</span></footer></figure>`,
      )
      .join("");
    if (s.googleRating && window.VaramMotion) window.VaramMotion.count($("#hero-rating"), s.googleRating, 1, "", "★");
    else $("#hero-rating").textContent = s.googleRating ? `${s.googleRating.toFixed(1)}★` : "—";
    $("#badge-rating").textContent = s.googleRating ? `${s.googleRating.toFixed(1)} on Google` : "Loved locally";
    $("#trust-delivery").textContent = s.freeDeliveryThreshold ? `Free delivery ${inr(s.freeDeliveryThreshold)}+` : "Home delivery";
  }

  /* ---------------- Store ---------------- */

  function renderStore() {
    const s = state.settings;
    if (!s) return;
    const tel = "+91" + String(s.storePhone).replace(/\D/g, "").slice(-10);
    const mapQ = encodeURIComponent(`${s.storeName}, ${s.storeAddress}`);
    $("#store-card").innerHTML = `
      <iframe title="Map showing the Varam store" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${mapQ}&z=16&output=embed"></iframe>
      <div class="info"><span class="kicker">Varam store</span><h3>${esc(s.storeName)}</h3>
        <div class="row">${I.pin}<span>${esc(s.storeAddress)}</span></div>
        <div class="row">${I.clock}<span>${esc(s.storeHours)}</span></div>
        <div class="row">${I.phone}<a href="tel:${tel}">${esc(s.storePhone)}</a></div>
        <div class="actions">
          <a class="btn btn-primary" href="https://www.google.com/maps/dir/?api=1&destination=${mapQ}" target="_blank" rel="noopener">${I.nav} Get directions</a>
          <a class="btn btn-wa" href="https://wa.me/${esc(s.whatsappNumber)}?text=${encodeURIComponent("Hello Varam! I'd like to visit your store.")}" target="_blank" rel="noopener">${I.wa} WhatsApp</a>
          ${s.mapsUrl ? `<a class="btn btn-outline" href="${esc(s.mapsUrl)}" target="_blank" rel="noopener">Google Maps</a>` : ""}
        </div></div>`;
    $("#hero-wa").href = `https://wa.me/${s.whatsappNumber}?text=${encodeURIComponent("Hello Varam! I'd like to order wood-pressed oil.")}`;
    $("#bulk-wa").href = `https://wa.me/${s.whatsappNumber}?text=${encodeURIComponent("Hello Varam! I'd like a quote for a bulk / monthly order:\n\nProducts:\nQuantity:\nDelivery area:")}`;
  }

  /* ---------------- FAQ ---------------- */

  const FAQ = [
    { cat: "Ordering", q: "How do I place an order?", a: "Add products to your cart, choose home delivery or free store pickup, and either place the order online or send it to us on WhatsApp in one tap. You'll get an order number and a printable invoice." },
    { cat: "Ordering", q: "Do I need an account to order?", a: "No — you can order as a guest. Creating an account saves your address, keeps your cart across devices and lets you reorder past orders in one click." },
    { cat: "Ordering", q: "How do I pay?", a: "Pay by UPI — we share the payment details on WhatsApp when we confirm your order. For store pickup you can also pay at the store. Cash on delivery is not available." },
    { cat: "Ordering", q: "Do you take bulk or monthly orders?", a: "Yes. Families, restaurants, sweet shops and events can message us on WhatsApp for a bulk or monthly quote." },
    { cat: "Delivery", q: "What are the delivery charges?", a: "Home delivery is free on orders above the free-delivery amount shown in your cart; below that a small delivery charge applies. Store pickup is always free." },
    { cat: "Delivery", q: "Where is your store?", a: "BRTS Rd, Lakshmi Nagar, Satyaranayana Puram, Vijayawada 520011. Pickup orders can be collected during store hours." },
    { cat: "Products", q: "What does 'wood-pressed' (gaanuga / mara chekku) mean?", a: "The seeds are crushed slowly in a traditional wooden press instead of a high-speed industrial expeller. The oil is then left to settle naturally and filtered — it is never refined, bleached or deodorised." },
    { cat: "Products", q: "Why is there sediment in the bottle?", a: "Wood-pressed oils are unrefined, so a little natural sediment can settle over time. It's normal — store the bottle upright and pour gently." },
    { cat: "Storage", q: "How should I store the oils?", a: "Keep them in a cool, dry place away from direct sunlight and close the cap tightly. Coconut oil and ghee may solidify in cooler weather — that's natural." },
    { cat: "Storage", q: "My honey has crystallised. Is it okay?", a: "Yes. Natural honey can crystallise over time. Stand the jar in warm water for a while and it will turn runny again." },
  ];
  const faqView = { cat: "All", q: "" };
  let openFaq = 0;

  function renderFaq() {
    const cats = ["All", ...new Set(FAQ.map((f) => f.cat))];
    $("#faq-pills").innerHTML = cats.map((c) => `<button type="button" class="pill" data-faq-cat="${c}" aria-pressed="${faqView.cat === c}">${c}</button>`).join("");
    const term = faqView.q.toLowerCase();
    const list = FAQ.map((f, i) => ({ ...f, i })).filter(
      (f) => (faqView.cat === "All" || f.cat === faqView.cat) && (!term || (f.q + " " + f.a).toLowerCase().includes(term)),
    );
    $("#faq-list").innerHTML = list.length
      ? list
          .map(
            (f) => `<div class="faq-item"><button type="button" aria-expanded="${openFaq === f.i}" aria-controls="faq-a-${f.i}" data-faq="${f.i}">${esc(f.q)}${I.plus}</button>
              <div class="answer${openFaq === f.i ? "" : " hidden"}" id="faq-a-${f.i}">${esc(f.a)}</div></div>`,
          )
          .join("")
      : `<p class="muted">No questions match “${esc(faqView.q)}”. Ask us on WhatsApp!</p>`;
  }
  $("#faq-pills").addEventListener("click", (e) => {
    const b = e.target.closest("[data-faq-cat]");
    if (!b) return;
    faqView.cat = b.dataset.faqCat;
    renderFaq();
  });
  $("#faq-search").addEventListener(
    "input",
    debounce((e) => {
      faqView.q = e.target.value.trim();
      renderFaq();
    }, 120),
  );
  $("#faq-list").addEventListener("click", (e) => {
    const b = e.target.closest("[data-faq]");
    if (!b) return;
    const i = Number(b.dataset.faq);
    openFaq = openFaq === i ? -1 : i;
    renderFaq();
    $(`[data-faq="${i}"]`)?.focus();
  });
  renderFaq();

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
