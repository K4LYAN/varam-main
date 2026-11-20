/* Varam — FAQ page: topic filter + search over the server-rendered <details> list */
(function () {
  "use strict";
  const { $, $$, I, debounce, state } = window.Varam;

  $$("[data-icon]").forEach((el) => {
    if (I[el.dataset.icon]) el.innerHTML = I[el.dataset.icon];
  });

  const filters = $("#faq-filters");
  const search = $("#faq-search");
  const view = { cat: "All", q: "" };

  function apply() {
    const term = view.q.toLowerCase();
    let shown = 0;
    $$("#faq-groups .faq-group").forEach((group) => {
      let groupShown = 0;
      $$(".faq-d", group).forEach((d) => {
        const ok = (view.cat === "All" || d.dataset.cat === view.cat) && (!term || d.textContent.toLowerCase().includes(term));
        d.hidden = !ok;
        if (ok) groupShown++;
        if (ok && term) d.open = true;
      });
      group.hidden = groupShown === 0;
      shown += groupShown;
    });
    $("#faq-empty").classList.toggle("hidden", shown > 0);
    $$("[data-faq-cat]", filters).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.faqCat === view.cat)));
  }

  filters.addEventListener("click", (e) => {
    const b = e.target.closest("[data-faq-cat]");
    if (!b) return;
    view.cat = b.dataset.faqCat;
    apply();
  });
  search.addEventListener(
    "input",
    debounce((e) => {
      view.q = e.target.value.trim();
      apply();
    }, 120),
  );

  // Deep links like /faq#ordering-3 open that answer
  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    if (target && target.tagName === "DETAILS") target.open = true;
  }

  window.Varam.ready().then(() => {
    const s = state.settings;
    if (s && s.whatsappNumber) {
      $("#faq-wa").href = `https://wa.me/${s.whatsappNumber}?text=${encodeURIComponent("Hello Varam! I have a question:")}`;
    }
  });
})();
