/* =====================================================================
   Varam — shared product cards (home bestsellers + /shop)
   - pack-size chips, live price, stock badge, wishlist heart
   - "Add" turns into a − qty + stepper once that pack is in the cart,
     and every card stays in sync with the cart drawer
   ===================================================================== */
(function () {
  "use strict";
  const { $, $$, esc, inr, I, Cart, state, productVisual, toast } = window.Varam;

  const selected = new Map(); // productId -> chosen variantId

  const minPrice = (p) => Math.min(...p.variants.map((v) => v.price));
  const inStock = (p) => p.variants.some((v) => v.stockQty > 0);
  const qtyInCart = (variantId) => Cart.items.find((i) => i.variantId === variantId)?.quantity || 0;

  function pickVariant(p) {
    const id = selected.get(p.id);
    return p.variants.find((v) => v.id === id) || p.variants.find((v) => v.stockQty > 0) || p.variants[0];
  }

  const stockBadge = (v) =>
    v.stockStatus === "out"
      ? '<span class="badge badge-out"><i class="dot"></i>Sold out</span>'
      : v.stockStatus === "low"
        ? `<span class="badge badge-low"><i class="dot"></i>Only ${v.stockQty} left</span>`
        : '<span class="badge badge-in"><i class="dot"></i>In stock</span>';

  /** The buy area of a card: Add button, or a stepper when the pack is already in the cart. */
  function ctaHtml(p, v) {
    if (v.stockQty <= 0) return `<button class="btn btn-outline add-btn" type="button" disabled>Sold out</button>`;
    const q = qtyInCart(v.id);
    if (!q) {
      return `<button class="btn btn-primary add-btn" type="button" data-add="${v.id}" aria-label="Add ${esc(p.name)} ${esc(v.sizeLabel)} to cart">${I.plus}<span class="lbl">Add</span></button>`;
    }
    const max = Math.min(50, v.stockQty);
    return `<div class="stepper" role="group" aria-label="${esc(p.name)} ${esc(v.sizeLabel)} in cart">
      <button type="button" data-step-qty="${v.id}" data-delta="-1" aria-label="Remove one">−</button>
      <output aria-live="polite">${q}</output>
      <button type="button" data-step-qty="${v.id}" data-delta="1" aria-label="Add one" ${q >= max ? "disabled" : ""}>+</button>
    </div>`;
  }

  function cardHtml(p) {
    const v = pickVariant(p);
    const save = v.mrp > v.price ? Math.round(((v.mrp - v.price) / v.mrp) * 100) : 0;
    return `<article class="card" data-product="${p.id}" id="p-${esc(p.slug)}">
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
        ${
          p.variants.length > 1
            ? `<div class="sizes" role="radiogroup" aria-label="Pack size for ${esc(p.name)}">${p.variants
                .map(
                  (x) =>
                    `<button type="button" class="size${x.stockQty <= 0 ? " out" : ""}" role="radio" aria-checked="${x.id === v.id}" data-variant="${x.id}">${esc(x.sizeLabel)}</button>`,
                )
                .join("")}</div>`
            : `<div class="sizes single"><span class="size" aria-label="Pack size">${esc(v.sizeLabel)}</span></div>`
        }
        <div class="price-row">
          <div class="price">${inr(v.price)}${v.mrp > v.price ? `<s>${inr(v.mrp)}</s>` : ""}
            <small>${esc(v.sizeLabel)}${save ? ` · <span class="save">${save}% off</span>` : ""}</small></div>
          <div class="card-cta" data-cta="${p.id}">${ctaHtml(p, v)}</div>
        </div>
      </div>
    </article>`;
  }

  /** Re-draw only the buy buttons (cheap — runs on every cart change). */
  function refreshCtas(root = document) {
    if (!state.catalog) return;
    $$("[data-cta]", root).forEach((el) => {
      const p = state.catalog.products.find((x) => x.id === Number(el.dataset.cta));
      if (!p) return;
      const v = pickVariant(p);
      const q = qtyInCart(v.id);
      const out = el.querySelector(".stepper output");
      // Same pack still in the cart: update the number in place so keyboard focus stays on the button
      if (out && q > 0 && el.querySelector(`[data-step-qty="${v.id}"]`)) {
        out.textContent = String(q);
        const plus = el.querySelector("[data-delta='1']");
        if (plus) plus.disabled = q >= Math.min(50, v.stockQty);
        return;
      }
      el.innerHTML = ctaHtml(p, v);
    });
  }

  function animateIn(grid) {
    const M = window.VaramMotion;
    if (!M || M.reduce) return;
    $$(".card", grid).forEach((card, i) =>
      M.animate(card, [{ opacity: 0, transform: "translateY(18px)" }, { opacity: 1, transform: "none" }], { duration: 500, delay: Math.min(i, 8) * 50 }),
    );
  }

  /**
   * Wire a product grid: size chips, add, steppers. `onReset` (optional) runs for [data-reset] buttons.
   */
  function bindGrid(grid, { onReset } = {}) {
    grid.addEventListener("click", async (e) => {
      if (e.target.closest("[data-reset]")) return onReset && onReset();

      const sizeBtn = e.target.closest("[data-variant]");
      if (sizeBtn) {
        const card = sizeBtn.closest("[data-product]");
        const productId = Number(card.dataset.product);
        selected.set(productId, Number(sizeBtn.dataset.variant));
        const p = state.catalog.products.find((x) => x.id === productId);
        card.outerHTML = cardHtml(p);
        const fresh = grid.querySelector(`[data-product="${productId}"]`);
        window.VaramMotion?.animate(fresh.querySelector(".price"), [{ opacity: 0.3, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 300 });
        fresh.querySelector(`[data-variant="${sizeBtn.dataset.variant}"]`)?.focus();
        return;
      }

      const addBtn = e.target.closest("[data-add]");
      if (addBtn) {
        addBtn.disabled = true;
        const card = addBtn.closest(".card");
        try {
          await window.Varam.addToCart(addBtn.dataset.add, 1, card.querySelector(".card-media .bottle-svg, .card-media img.photo, .card-media img"), card.querySelector("h3").textContent);
        } catch (err) {
          toast(err.message, { error: true });
        }
        refreshCtas(card);
        card.querySelector("[data-step-qty][data-delta='1']")?.focus();
        return;
      }

      const step = e.target.closest("[data-step-qty]");
      if (step) {
        const id = Number(step.dataset.stepQty);
        const next = qtyInCart(id) + Number(step.dataset.delta);
        try {
          await Cart.setQty(id, next);
        } catch (err) {
          toast(err.message, { error: true });
        }
      }
    });
  }

  // Any cart change (drawer, other cards, undo) updates every card's buttons
  Cart.listeners.add(() => refreshCtas());
  window.addEventListener("varam:wishlist", () => window.Varam.Wishlist.paint());

  window.VaramCatalog = { cardHtml, bindGrid, refreshCtas, animateIn, minPrice, inStock, pickVariant };
})();
