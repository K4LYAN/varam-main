/* Varam — product details page */
(function () {
  "use strict";
  const { $, $$, api, esc, inr, I, toast, productVisual, state, openDrawer, Wishlist, addToCart } = window.Varam;
  const M = window.VaramMotion;
  const slug = new URLSearchParams(location.search).get("p") || decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() || "").replace(/\.html$/, "");

  let product;
  let related = [];
  let variant;
  let qty = 1;

  const stockText = (v) =>
    v.stockStatus === "out"
      ? '<span class="badge badge-out"><i class="dot"></i>Out of stock</span>'
      : v.stockStatus === "low"
        ? `<span class="badge badge-low"><i class="dot"></i>Only ${v.stockQty} left</span>`
        : '<span class="badge badge-in"><i class="dot"></i>In stock</span>';

  function priceHtml(v) {
    const save = v.mrp > v.price ? Math.round(((v.mrp - v.price) / v.mrp) * 100) : 0;
    return `<b>${inr(v.price * qty)}</b>${v.mrp > v.price ? `<s>${inr(v.mrp * qty)}</s><span class="badge badge-in">${save}% off</span>` : ""}
      <span class="per">${qty > 1 ? `${qty} × ${inr(v.price)} · ` : ""}${esc(v.sizeLabel)}</span>`;
  }

  function render() {
    const s = state.settings || {};
    // Title, description, canonical and Product structured data are rendered on the server for search engines
    $("#crumbs").innerHTML = `<a href="index.html">Home</a><span>/</span><a href="shop.html">Shop</a><span>/</span>${
      product.category ? `<a href="shop.html?category=${esc(product.category.slug)}">${esc(product.category.name)}</a><span>/</span>` : ""
    }<span aria-current="page">${esc(product.name)}</span>`;

    $("#pdp").innerHTML = `
      <div class="pdp-media" data-reveal="scale-in">
        <span class="ring" aria-hidden="true"></span>
        <button class="heart" type="button" data-wish="${product.id}" aria-pressed="${Wishlist.has(product.id)}" aria-label="Save ${esc(product.name)} to wishlist">${I.heart}</button>
        <div id="pdp-visual" style="display:contents">${productVisual(product, variant.sizeLabel)}</div>
      </div>
      <div data-reveal="fade-left">
        <span class="kicker">${esc(product.category?.name || "Varam")}</span>
        <h1>${esc(product.name)}</h1>
        ${product.reviewCount > 0 ? `<div class="stars" style="margin-top:8px">${I.star.repeat(Math.round(product.rating))}<b>${product.rating.toFixed(1)}</b> (${product.reviewCount} reviews)</div>` : ""}
        <p class="lead">${esc(product.tagline)}</p>
        <div class="price-big" id="price" aria-live="polite">${priceHtml(variant)}</div>
        <div style="margin-top:10px" id="stock">${stockText(variant)}</div>

        <div style="margin-top:22px"><span class="label">Pack size</span>
          <div class="sizes" role="radiogroup" aria-label="Pack size">
            ${product.variants
              .map((x) => `<button type="button" class="size${x.stockQty <= 0 ? " out" : ""}" role="radio" aria-checked="${x.id === variant.id}" data-size="${x.id}">${esc(x.sizeLabel)} · ${inr(x.price)}</button>`)
              .join("")}
          </div></div>

        <div class="buy-row">
          <div class="qty lg" role="group" aria-label="Quantity">
            <button type="button" data-q="-1" aria-label="Decrease quantity">−</button><span id="qty">${qty}</span><button type="button" data-q="1" aria-label="Increase quantity">+</button>
          </div>
          <button class="btn btn-primary shine" type="button" id="add" data-magnetic="0.15">${I.plus} Add to cart</button>
          <button class="btn btn-dark" type="button" id="buy">Buy now</button>
        </div>
        <a class="btn btn-wa btn-block" style="margin-top:10px" target="_blank" rel="noopener" id="wa-enquire">${I.wa} Ask about this on WhatsApp</a>

        <div class="perks" data-reveal data-stagger="80">
          <div><span class="ic ic-red">${I.drop}</span><span><b>Cold-pressed</b>Slow wooden ghani</span></div>
          <div><span class="ic ic-green">${I.leaf}</span><span><b>Unrefined</b>No bleaching or deodorising</span></div>
          <div><span class="ic ic-amber">${I.truck}</span><span><b>${s.freeDeliveryThreshold ? `Free delivery ${inr(s.freeDeliveryThreshold)}+` : "Home delivery"}</b>${s.deliveryFee ? `${inr(s.deliveryFee)} below that` : "Across Vijayawada"}</span></div>
          <div><span class="ic ic-red">${I.store}</span><span><b>Free store pickup</b>BRTS Rd, Vijayawada</span></div>
        </div>

        <div class="tabs">
          <div class="tab-list" role="tablist" aria-label="Product information">
            <button type="button" role="tab" aria-selected="true" aria-controls="tp-0" id="tb-0" data-tab="0">Description</button>
            <button type="button" role="tab" aria-selected="false" aria-controls="tp-1" id="tb-1" data-tab="1" tabindex="-1">Details</button>
            <button type="button" role="tab" aria-selected="false" aria-controls="tp-2" id="tb-2" data-tab="2" tabindex="-1">Delivery &amp; pickup</button>
            ${product.labelFull ? `<button type="button" role="tab" aria-selected="false" aria-controls="tp-3" id="tb-3" data-tab="3" tabindex="-1">Label &amp; nutrition</button>` : ""}
          </div>
          <div class="tab-panel" role="tabpanel" id="tp-0" aria-labelledby="tb-0"><p>${esc(product.description || product.tagline)}</p></div>
          <div class="tab-panel hidden" role="tabpanel" id="tp-1" aria-labelledby="tb-1"><dl>
            <dt>Category</dt><dd>${esc(product.category?.name || "—")}</dd>
            <dt>Pack sizes</dt><dd>${product.variants.map((x) => esc(x.sizeLabel)).join(", ")}</dd>
            <dt>SKU</dt><dd id="sku">${esc(variant.sku)}</dd>
            <dt>Process</dt><dd>${/ghee|honey/i.test(product.name) ? "Traditionally prepared, filtered and packed" : "Cold-pressed in a wooden ghani (gaanuga), naturally settled and filtered — unrefined"}</dd>
            <dt>Storage</dt><dd>Keep in a cool, dry place away from direct sunlight. Close the cap tightly after use.</dd>
          </dl></div>
          <div class="tab-panel hidden" role="tabpanel" id="tp-2" aria-labelledby="tb-2">
            <p><b>Home delivery:</b> ${s.freeDeliveryThreshold ? `free on orders above ${inr(s.freeDeliveryThreshold)}, otherwise ${inr(s.deliveryFee)}.` : "available across Vijayawada."}</p>
            <p style="margin-top:8px"><b>Store pickup:</b> always free — ${esc(s.storeAddress || "")}. ${esc(s.storeHours || "")}</p>
            <p style="margin-top:8px"><b>How to order:</b> add to cart and send your order on WhatsApp. We confirm stock, delivery and payment there.</p>
          </div>
          ${
            product.labelFull
              ? `<div class="tab-panel hidden" role="tabpanel" id="tp-3" aria-labelledby="tb-3">
            <p class="muted" style="margin-bottom:10px">The full printed label on our ${esc(product.name)} bottle — nutrition facts, benefits, FSSAI licence and our Vijayawada outlets.</p>
            <a class="label-full" href="${esc(product.labelFull)}" target="_blank" rel="noopener" aria-label="Open the full ${esc(product.name)} label">
              <img src="${esc(product.labelFull)}" alt="Printed label of Varam ${esc(product.name)}: nutrition facts, benefits of cold-pressed oil, FSSAI licence and outlet addresses" loading="lazy" width="1600" height="320"></a>
            <p style="margin-top:8px;font-size:13px"><a href="${esc(product.labelFull)}" target="_blank" rel="noopener">Open the label full size ↗</a></p>
          </div>`
              : ""
          }
        </div>
      </div>`;
    updateLive();
    wireTabs();
    renderSticky();
  }

  function updateLive() {
    const s = state.settings || {};
    $("#price").innerHTML = priceHtml(variant);
    $("#stock").innerHTML = stockText(variant);
    const sku = $("#sku");
    if (sku) sku.textContent = variant.sku;
    $("#qty").textContent = String(qty);
    const out = variant.stockQty <= 0;
    $("#add").disabled = out;
    $("#buy").disabled = out;
    $("#add").innerHTML = out ? "Out of stock" : `${I.plus} Add to cart`;
    $('[data-q="-1"]').disabled = qty <= 1;
    $('[data-q="1"]').disabled = qty >= Math.min(50, variant.stockQty || 1);
    $$("[data-size]").forEach((b) => b.setAttribute("aria-checked", String(Number(b.dataset.size) === variant.id)));
    const text = `Hello Varam! I'd like to ask about ${product.name} (${variant.sizeLabel}, ${inr(variant.price)}).`;
    $("#wa-enquire").href = `https://wa.me/${s.whatsappNumber || "917799228444"}?text=${encodeURIComponent(text)}`;
    renderSticky();
  }

  function renderSticky() {
    const bar = $("#sticky-buy");
    bar.innerHTML = `<div class="info"><b>${esc(product.name)}</b><span class="muted">${esc(variant.sizeLabel)} · ${inr(variant.price)}</span></div>
      <button class="btn btn-primary" type="button" data-sticky-add ${variant.stockQty <= 0 ? "disabled" : ""}>Add to cart</button>`;
  }

  function wireTabs() {
    const tabs = $$("[data-tab]");
    const select = (i) => {
      tabs.forEach((t, n) => {
        t.setAttribute("aria-selected", String(n === i));
        t.tabIndex = n === i ? 0 : -1;
        $(`#tp-${n}`).classList.toggle("hidden", n !== i);
      });
      M?.animate($(`#tp-${i}`), [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 350 });
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(i));
      t.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const next = (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        select(next);
        tabs[next].focus();
      });
    });
  }

  function relatedCard(p) {
    const v = p.variants.find((x) => x.stockQty > 0) || p.variants[0];
    return `<article class="card" data-tilt="5">
      <a class="card-link" href="products/${esc(p.slug)}.html" aria-label="View ${esc(p.name)}"></a>
      <div class="card-media"><button class="heart" type="button" data-wish="${p.id}" aria-pressed="${Wishlist.has(p.id)}" aria-label="Save ${esc(p.name)}">${I.heart}</button>${productVisual(p, v.sizeLabel)}</div>
      <div class="card-body"><span class="card-cat">${esc(p.category?.name || "")}</span><h3>${esc(p.name)}</h3><p class="tagline">${esc(p.tagline)}</p>
        <div class="price-row"><div class="price">${inr(v.price)}<small>${esc(v.sizeLabel)}</small></div>
        <button class="btn btn-primary add-btn" type="button" data-related-add="${v.id}" data-name="${esc(p.name)}" ${v.stockQty <= 0 ? "disabled" : ""} aria-label="Add ${esc(p.name)} to cart">${I.plus}<span class="lbl">Add</span></button></div></div></article>`;
  }

  /* ---------------- Events ---------------- */

  document.addEventListener("click", async (e) => {
    const size = e.target.closest("[data-size]");
    if (size) {
      variant = product.variants.find((x) => x.id === Number(size.dataset.size));
      qty = Math.min(qty, Math.max(1, variant.stockQty));
      $("#pdp-visual").innerHTML = productVisual(product, variant.sizeLabel);
      M?.animate($("#pdp-visual svg, #pdp-visual img"), [{ opacity: 0, transform: "translateY(18px) scale(0.96)" }, { opacity: 1, transform: "none" }], { duration: 500, easing: M.spring });
      updateLive();
      history.replaceState(null, "", `${location.pathname}?size=${variant.id}`);
      return;
    }
    const q = e.target.closest("[data-q]");
    if (q) {
      qty = Math.max(1, Math.min(Math.min(50, variant.stockQty || 1), qty + Number(q.dataset.q)));
      updateLive();
      M?.animate($("#qty"), [{ transform: "scale(1.4)" }, { transform: "scale(1)" }], { duration: 300, fill: "none" });
      return;
    }
    if (e.target.closest("#add") || e.target.closest("[data-sticky-add]")) {
      try {
        await addToCart(variant.id, qty, $("#pdp-visual svg, #pdp-visual img"), `${product.name} (${variant.sizeLabel}) × ${qty}`);
      } catch (err) {
        toast(err.message, { error: true });
      }
      return;
    }
    if (e.target.closest("#buy")) {
      try {
        await window.Varam.Cart.add(variant.id, qty);
        openDrawer();
      } catch (err) {
        toast(err.message, { error: true });
      }
      return;
    }
    const rel = e.target.closest("[data-related-add]");
    if (rel) {
      try {
        await addToCart(rel.dataset.relatedAdd, 1, rel.closest(".card").querySelector(".card-media svg, .card-media img"), rel.dataset.name);
      } catch (err) {
        toast(err.message, { error: true });
      }
    }
  });

  // Mobile sticky buy bar appears once the main Add button scrolls away
  const watchSticky = () => {
    const add = $("#add");
    const bar = $("#sticky-buy");
    if (!add || !("IntersectionObserver" in window)) return;
    new IntersectionObserver(([entry]) => {
      const show = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      bar.classList.toggle("show", show);
      bar.setAttribute("aria-hidden", String(!show));
    }).observe(add);
  };

  /** Replace the flat bottle with the interactive 3D one (js/bottle3d.js); on any failure the flat bottle stays. */
  async function mount3d() {
    if (!product || product.imageUrl) return; // a real product photo wins over the bottle
    try {
      if (!window.VaramBottle3D) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "js/bottle3d.js";
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      await window.VaramBottle3D.mount($(".pdp-media"), product);
    } catch (err) {
      console.warn("[varam] 3D bottle unavailable, showing the flat bottle:", err && err.message);
    }
  }

  window.Varam.ready().then(async () => {
    try {
      const data = await api("GET", `/api/products/${encodeURIComponent(slug)}`);
      product = data.product;
      related = data.related;
      const wanted = Number(new URLSearchParams(location.search).get("size"));
      variant = product.variants.find((x) => x.id === wanted) || product.variants.find((x) => x.stockQty > 0) || product.variants[0];
      render();
      $("#related").innerHTML = related.map(relatedCard).join("");
      M?.init();
      watchSticky();
      mount3d();
    } catch (err) {
      $("#pdp").innerHTML = `<div class="empty" style="grid-column:1/-1"><h1>Product not found</h1><p class="muted" style="margin:8px 0 16px">${esc(err.message)}</p><a class="btn btn-primary" href="shop.html">Back to shop</a></div>`;
    }
  });
})();
