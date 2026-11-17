/* Varam — home page: bestsellers, reviews, store map (tiles, FAQ teaser and contact details are server-rendered) */
(function () {
  "use strict";
  const { $, $$, esc, I, loadCatalog, state } = window.Varam;

  // Fill [data-icon] placeholders with SVG icons
  function paintIcons(root = document) {
    $$("[data-icon]", root).forEach((el) => {
      if (I[el.dataset.icon]) el.innerHTML = I[el.dataset.icon];
    });
  }
  paintIcons();

  /* ---------------- Bestsellers ---------------- */

  // Old links like /?category=ghee#shop or /?q=sesame now live on the Shop page
  const params = new URLSearchParams(location.search);
  if (params.get("category") || params.get("q")) {
    location.replace(`/shop?${params.toString()}`);
    return;
  }

  const C = window.VaramCatalog;
  const grid = $("#product-grid");

  function renderBestsellers() {
    const products = state.catalog.products;
    const featured = products.filter((p) => p.isFeatured && C.inStock(p));
    const list = (featured.length >= 4 ? featured : [...featured, ...products.filter((p) => !featured.includes(p))]).slice(0, 4);
    grid.innerHTML = list.map(C.cardHtml).join("");
    C.animateIn(grid);
  }
  C.bindGrid(grid);

  window.addEventListener("varam:catalog-stale", async () => {
    await loadCatalog();
    renderBestsellers();
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
      await loadCatalog();
      renderBestsellers();
    } catch (err) {
      $("#product-grid").innerHTML = `<div class="empty" style="grid-column:1/-1"><h3>Couldn't load products</h3><p class="muted">${esc(err.message)}</p></div>`;
    }
    renderReviews();
    renderStore();
    if (location.hash && location.hash !== "#cart") document.querySelector(location.hash)?.scrollIntoView();
  });
})();
