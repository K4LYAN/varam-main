/* =====================================================================
   Varam — admin panel (dashboard, products & prices, orders, settings)
   ===================================================================== */
(function () {
  "use strict";

  /* ---------------- Helpers ---------------- */

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const dt = (d) => new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  const STATUSES = ["Pending", "Confirmed", "Packed", "Out for Delivery", "Delivered", "Cancelled"];
  const statusClass = (s) => "st-" + String(s).split(" ")[0];

  async function api(method, url, body, isForm) {
    const res = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body && !isForm ? { "Content-Type": "application/json" } : {},
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
    if (res.status === 401) {
      location.href = "/admin/login";
      throw new Error("Session expired");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  function toast(message, error = false) {
    const box = $(".toasts");
    const el = document.createElement("div");
    el.className = "toast" + (error ? " err" : "");
    el.textContent = message;
    box.appendChild(el);
    setTimeout(() => el.remove(), 3800);
  }

  async function run(fn, okMessage) {
    try {
      const r = await fn();
      if (okMessage) toast(okMessage);
      return r;
    } catch (err) {
      toast(err.message, true);
      return undefined;
    }
  }

  function thumb(p) {
    if (p.imageUrl) return `<img src="${esc(p.imageUrl)}" alt="">`;
    const t = /^#[0-9a-f]{6}$/i.test(p.accentColor || "") ? p.accentColor : "#D97706";
    const jar = /ghee|honey/i.test(p.name);
    const body = jar
      ? "M10 22 Q6 22 6 26 L6 66 Q6 70 10 70 L38 70 Q42 70 42 66 L42 26 Q42 22 38 22 Z"
      : "M20 10 L20 18 C20 22 10 24 10 30 L10 66 Q10 70 14 70 L34 70 Q38 70 38 66 L38 30 C38 24 28 22 28 18 L28 10 Z";
    return `<svg viewBox="0 0 48 76" aria-hidden="true"><path d="${body}" fill="${t}" stroke="#3b2a17" stroke-opacity=".3"/>${
      jar ? '<rect x="8" y="16" width="32" height="8" rx="2" fill="#B91C1C"/>' : '<rect x="19" y="4" width="10" height="8" rx="2" fill="#B91C1C"/>'
    }<rect x="13" y="40" width="22" height="18" rx="2" fill="#fffdf8"/></svg>`;
  }

  function modal(html, { wide = false } = {}) {
    const wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.innerHTML = `<div class="backdrop show" data-close></div><div class="modal-card"${wide ? ' style="width:min(100%,900px)"' : ""}>
      <button class="icon-btn" type="button" data-close aria-label="Close" style="position:absolute;right:16px;top:16px">✕</button>${html}</div>`;
    document.body.appendChild(wrap);
    document.body.style.overflow = "hidden";
    const close = () => {
      wrap.remove();
      document.body.style.overflow = "";
    };
    wrap.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) close();
    });
    wrap.addEventListener("keydown", (e) => e.key === "Escape" && close());
    setTimeout(() => $("input, select, textarea, button:not([data-close])", wrap)?.focus(), 30);
    return { el: wrap, close };
  }

  /* ---------------- Router ---------------- */

  const view = $("#admin-view");
  const ROUTES = {
    "/admin": ["dashboard", "Dashboard", renderDashboard],
    "/admin/products": ["products", "Products & prices", renderProducts],
    "/admin/orders": ["orders", "Orders", renderOrders],
    "/admin/settings": ["settings", "Coupons & settings", renderSettings],
  };

  function navigate(path, push = true) {
    const route = ROUTES[path] || ROUTES["/admin"];
    if (push) history.pushState(null, "", path);
    $("#admin-title").textContent = route[1];
    document.title = `${route[1]} · Varam Admin`;
    $$(".admin-nav a[data-route]").forEach((a) => (a.dataset.route === route[0] ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
    $("#admin-side").classList.remove("open");
    $(".admin-menu").setAttribute("aria-expanded", "false");
    view.innerHTML = '<p class="muted">Loading…</p>';
    route[2]().catch((err) => {
      view.innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
    });
  }

  document.addEventListener("click", (e) => {
    const a = e.target.closest(".admin-nav a[data-route], a[data-nav]");
    if (!a) return;
    e.preventDefault();
    navigate(a.getAttribute("href"));
  });
  window.addEventListener("popstate", () => navigate(location.pathname, false));
  $(".admin-menu").addEventListener("click", () => {
    const open = $("#admin-side").classList.toggle("open");
    $(".admin-menu").setAttribute("aria-expanded", String(open));
  });
  $("#admin-logout").addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    location.href = "/admin/login";
  });

  /* ---------------- Dashboard ---------------- */

  async function renderDashboard() {
    const s = await api("GET", "/api/admin/stats");
    view.innerHTML = `
      <div class="kpis">
        <div class="kpi"><span>Total revenue</span><b>${inr(s.totalRevenue)}</b><span>${s.totalOrders} orders</span></div>
        <div class="kpi"><span>Today's orders</span><b>${s.todayOrders}</b><span>${inr(s.todayRevenue)}</span></div>
        <div class="kpi red"><span>Pending orders</span><b>${s.pendingOrders}</b><a href="/admin/orders" data-nav class="link-btn">Review →</a></div>
        <div class="kpi warn"><span>Low-stock packs (≤ 5)</span><b>${s.lowStock.length}</b><a href="/admin/products" data-nav class="link-btn">Restock →</a></div>
        <div class="kpi"><span>Customers</span><b>${s.totalCustomers}</b><span>registered</span></div>
      </div>
      <div class="two-col">
        <section class="a-panel"><div class="head"><h2>Recent orders</h2><a class="btn btn-outline btn-sm" href="/admin/orders" data-nav>All orders</a></div>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Order</th><th>Customer</th><th>Type</th><th>Total</th><th>Status</th></tr></thead><tbody>
          ${
            s.recentOrders.length
              ? s.recentOrders
                  .map(
                    (o) =>
                      `<tr class="clickable" data-order="${esc(o.orderNumber)}"><td><b>${esc(o.orderNumber)}</b><br><span class="muted">${dt(o.createdAt)}</span></td><td>${esc(o.customerName)}</td><td>${o.fulfillmentType === "pickup" ? "Pickup" : "Delivery"}</td><td>${inr(o.totalAmount)}</td><td><span class="status ${statusClass(o.status)}">${esc(o.status)}</span></td></tr>`,
                  )
                  .join("")
              : '<tr class="empty-row"><td colspan="5">No orders yet</td></tr>'
          }</tbody></table></div></section>
        <section class="a-panel"><div class="head"><h2>Low stock</h2></div>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Product</th><th>Pack</th><th>SKU</th><th>Stock</th></tr></thead><tbody>
          ${
            s.lowStock.length
              ? s.lowStock
                  .map(
                    (v) =>
                      `<tr><td>${esc(v.name)}</td><td>${esc(v.sizeLabel)}</td><td class="muted">${esc(v.sku)}</td><td><span class="badge ${v.stockQty <= 0 ? "badge-out" : "badge-low"}">${v.stockQty}</span></td></tr>`,
                  )
                  .join("")
              : '<tr class="empty-row"><td colspan="4">All packs are well stocked</td></tr>'
          }</tbody></table></div></section>
      </div>`;
  }

  // One listener for every clickable order row (dashboard + orders list)
  view.addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-order]");
    if (tr) openOrder(tr.dataset.order).catch((err) => toast(err.message, true));
  });

  /* ---------------- Products & prices ---------------- */

  let productData = { products: [], categories: [] };
  let productFilter = "";

  async function renderProducts() {
    productData = await api("GET", "/api/admin/products");
    view.innerHTML = `
      <section class="a-panel">
        <div class="head"><h2>${productData.products.length} products</h2>
          <div class="filters"><input class="input" type="search" id="prod-filter" placeholder="Filter products…" value="${esc(productFilter)}" aria-label="Filter products">
          <button class="btn btn-primary btn-sm" type="button" id="add-product">+ Add product</button></div></div>
        <p class="muted" style="font-size:13px;margin-bottom:14px">Edit prices, MRP, SKU and stock directly in the table and press <b>Save</b> on the row — the store updates instantly. MRP higher than price shows a strikethrough and “% off”.</p>
        <div id="product-list"></div>
      </section>`;
    drawProducts();
    $("#prod-filter").addEventListener("input", (e) => {
      productFilter = e.target.value;
      drawProducts();
    });
    $("#add-product").addEventListener("click", () => productForm(null));
  }

  function variantRow(v) {
    return `<tr data-variant="${v.id}">
      <td><input class="inline" name="sizeLabel" value="${esc(v.sizeLabel)}" aria-label="Pack size"></td>
      <td><input class="inline" name="sku" value="${esc(v.sku)}" aria-label="SKU"></td>
      <td><input class="inline" name="price" type="number" min="0" step="0.01" value="${v.price}" aria-label="Price"></td>
      <td><input class="inline" name="mrp" type="number" min="0" step="0.01" value="${v.mrp}" aria-label="MRP"></td>
      <td><input class="inline" name="stockQty" type="number" min="0" step="1" value="${v.stockQty}" aria-label="Stock"></td>
      <td><input class="inline" name="sortOrder" type="number" min="0" step="1" value="${v.sortOrder ?? 0}" aria-label="Sort" style="min-width:56px"></td>
      <td style="white-space:nowrap"><button class="btn btn-dark btn-sm" type="button" data-save-variant disabled>Save</button>
        <button class="link-btn" type="button" data-delete-variant style="margin-left:8px">Delete</button></td></tr>`;
  }

  function drawProducts() {
    const term = productFilter.trim().toLowerCase();
    const list = productData.products.filter((p) => !term || (p.name + " " + (p.category?.name || "")).toLowerCase().includes(term));
    $("#product-list").innerHTML = list.length
      ? list
          .map(
            (p) => `<article class="prod${p.isActive ? "" : " inactive"}" data-product="${p.id}">
          <div class="prod-head"><span class="thumb">${thumb(p)}</span>
            <div class="name"><b>${esc(p.name)}</b><small>${esc(p.category?.name || "No category")}${p.badgeText ? ` · ${esc(p.badgeText)}` : ""}</small></div>
            <label class="toggle"><input type="checkbox" data-flag="isActive" ${p.isActive ? "checked" : ""}> Active</label>
            <label class="toggle"><input type="checkbox" data-flag="isFeatured" ${p.isFeatured ? "checked" : ""}> Featured</label>
            <button class="btn btn-outline btn-sm" type="button" data-edit-product>Edit</button>
            <button class="link-btn" type="button" data-delete-product>Delete</button>
          </div>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pack size</th><th>SKU</th><th>Price ₹</th><th>MRP ₹</th><th>Stock</th><th>Sort</th><th></th></tr></thead><tbody>
            ${p.variants.map((v, i) => variantRow({ ...v, sortOrder: i })).join("")}
            <tr data-new-variant>
              <td><input class="inline" name="sizeLabel" placeholder="e.g. 5L Tin" aria-label="New pack size"></td>
              <td><input class="inline" name="sku" placeholder="SKU" aria-label="New SKU"></td>
              <td><input class="inline" name="price" type="number" min="0" step="0.01" placeholder="0" aria-label="New price"></td>
              <td><input class="inline" name="mrp" type="number" min="0" step="0.01" placeholder="= price" aria-label="New MRP"></td>
              <td><input class="inline" name="stockQty" type="number" min="0" step="1" placeholder="0" aria-label="New stock"></td>
              <td><input class="inline" name="sortOrder" type="number" min="0" step="1" value="${p.variants.length}" aria-label="New sort" style="min-width:56px"></td>
              <td><button class="btn btn-primary btn-sm" type="button" data-add-variant>+ Add size</button></td></tr>
          </tbody></table></div></article>`,
          )
          .join("")
      : '<p class="muted">No products match.</p>';
  }

  const rowValues = (tr) => Object.fromEntries($$("input", tr).map((i) => [i.name, i.value.trim()]));

  view.addEventListener("input", (e) => {
    const tr = e.target.closest("tr[data-variant]");
    if (tr && e.target.classList.contains("inline")) {
      e.target.classList.add("dirty");
      $("[data-save-variant]", tr).disabled = false;
    }
  });

  view.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.classList.contains("inline")) {
      e.preventDefault();
      const tr = e.target.closest("tr");
      ($("[data-save-variant]", tr) || $("[data-add-variant]", tr))?.click();
    }
  });

  view.addEventListener("change", async (e) => {
    const flag = e.target.closest("[data-flag]");
    if (!flag) return;
    const id = Number(flag.closest("[data-product]").dataset.product);
    const ok = await run(() => api("PATCH", `/api/admin/products/${id}/flags`, { [flag.dataset.flag]: flag.checked }), "Saved");
    if (ok === undefined) flag.checked = !flag.checked;
    const p = productData.products.find((x) => x.id === id);
    if (p) p[flag.dataset.flag] = flag.checked;
    flag.closest(".prod").classList.toggle("inactive", !p.isActive);
  });

  view.addEventListener("click", async (e) => {
    const card = e.target.closest("[data-product]");
    if (!card || !location.pathname.startsWith("/admin/products")) return;
    const productId = Number(card.dataset.product);
    const product = productData.products.find((p) => p.id === productId);

    const save = e.target.closest("[data-save-variant]");
    if (save) {
      const tr = save.closest("tr");
      save.disabled = true;
      const ok = await run(() => api("PUT", `/api/admin/variants/${tr.dataset.variant}`, rowValues(tr)), "Pack size saved — live on the store");
      if (ok === undefined) save.disabled = false;
      else $$("input", tr).forEach((i) => i.classList.remove("dirty"));
      return;
    }
    if (e.target.closest("[data-delete-variant]")) {
      const tr = e.target.closest("tr");
      if (!confirm("Delete this pack size?")) return;
      const ok = await run(() => api("DELETE", `/api/admin/variants/${tr.dataset.variant}`), "Pack size deleted");
      if (ok !== undefined) renderProducts();
      return;
    }
    if (e.target.closest("[data-add-variant]")) {
      const tr = e.target.closest("tr");
      const v = rowValues(tr);
      if (!v.sizeLabel || !v.sku || v.price === "") return toast("Enter pack size, SKU and price", true);
      const ok = await run(() => api("POST", `/api/admin/products/${productId}/variants`, v), "Pack size added");
      if (ok !== undefined) renderProducts();
      return;
    }
    if (e.target.closest("[data-edit-product]")) return productForm(product);
    if (e.target.closest("[data-delete-product]")) {
      if (!confirm(`Delete “${product.name}”? Past orders keep their details. To hide it temporarily, switch off “Active” instead.`)) return;
      const ok = await run(() => api("DELETE", `/api/admin/products/${productId}`), "Product deleted");
      if (ok !== undefined) renderProducts();
    }
  });

  function productForm(p) {
    const isNew = !p;
    p = p || { name: "", slug: "", tagline: "", description: "", imageUrl: "", accentColor: "#D97706", badgeText: "", rating: 0, reviewCount: 0, isFeatured: false, isActive: true, sortOrder: 0, categoryId: productData.categories[0]?.id };
    const cats = productData.categories.map((c) => `<option value="${c.id}" ${c.id === p.categoryId ? "selected" : ""}>${esc(c.name)}</option>`).join("");
    const m = modal(
      `<h2 style="font-size:22px;margin-bottom:16px">${isNew ? "Add product" : "Edit product"}</h2>
      <form class="grid-form" id="product-form" novalidate>
        <div class="field full"><label for="pf-name">Product name</label><input class="input" id="pf-name" name="name" value="${esc(p.name)}" required></div>
        <div class="field"><label for="pf-slug">URL slug</label><input class="input" id="pf-slug" name="slug" value="${esc(p.slug)}" placeholder="auto from name"></div>
        <div class="field"><label for="pf-cat">Category</label><div style="display:flex;gap:8px"><select class="input" id="pf-cat" name="categoryId">${cats}</select>
          <button class="btn btn-outline btn-sm" type="button" id="pf-newcat">+ New</button></div></div>
        <div class="field full"><label for="pf-tag">Tagline</label><input class="input" id="pf-tag" name="tagline" value="${esc(p.tagline)}" maxlength="255"></div>
        <div class="field full"><label for="pf-desc">Description</label><textarea class="input" id="pf-desc" name="description">${esc(p.description || "")}</textarea></div>
        <div class="field full"><span class="label">Product image</span>
          <div class="img-pick"><span class="preview" id="pf-preview">${thumb(p)}</span>
            <input class="input" style="flex:1;min-width:200px" name="imageUrl" id="pf-image" value="${esc(p.imageUrl)}" placeholder="https://… or upload">
            <label class="btn btn-outline btn-sm">Upload<input type="file" accept="image/jpeg,image/png,image/webp" id="pf-file" hidden></label></div>
          <span class="muted" style="font-size:12px">Without an image, a bottle drawing in the colour below is shown.</span></div>
        <div class="field"><label for="pf-color">Bottle colour</label><input class="input" id="pf-color" name="accentColor" type="color" value="${esc(p.accentColor)}" style="padding:4px;height:44px"></div>
        <div class="field"><label for="pf-badge">Badge text</label><input class="input" id="pf-badge" name="badgeText" value="${esc(p.badgeText)}" maxlength="40" placeholder="e.g. Bestseller"></div>
        <div class="field"><label for="pf-rating">Rating (0–5)</label><input class="input" id="pf-rating" name="rating" type="number" min="0" max="5" step="0.1" value="${p.rating}"></div>
        <div class="field"><label for="pf-reviews">Review count</label><input class="input" id="pf-reviews" name="reviewCount" type="number" min="0" value="${p.reviewCount}"></div>
        <div class="field"><label for="pf-sort">Sort order</label><input class="input" id="pf-sort" name="sortOrder" type="number" min="0" value="${p.sortOrder ?? 0}"></div>
        <div class="field" style="display:flex;gap:18px;align-items:end">
          <label class="toggle"><input type="checkbox" name="isActive" ${p.isActive ? "checked" : ""}> Active</label>
          <label class="toggle"><input type="checkbox" name="isFeatured" ${p.isFeatured ? "checked" : ""}> Featured</label></div>
        ${
          isNew
            ? `<div class="field full"><span class="label">First pack size</span><div class="grid-form" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr))">
                <input class="input" name="v_sizeLabel" placeholder="Pack size e.g. 1 Litre" required>
                <input class="input" name="v_sku" placeholder="SKU e.g. VRM-GN-1L" required>
                <input class="input" name="v_price" type="number" min="0" step="0.01" placeholder="Price ₹" required>
                <input class="input" name="v_mrp" type="number" min="0" step="0.01" placeholder="MRP ₹ (optional)">
                <input class="input" name="v_stockQty" type="number" min="0" placeholder="Stock"></div>
                <span class="muted" style="font-size:12px">Add more sizes (500ml, 2L Can, 5L Tin, 15L Bulk Tin…) from the products list after saving.</span></div>`
            : ""
        }
        <div class="form-error hidden full" role="alert"></div>
        <div class="full" style="display:flex;gap:10px;justify-content:flex-end"><button class="btn btn-outline" type="button" data-close>Cancel</button>
          <button class="btn btn-primary" type="submit">${isNew ? "Create product" : "Save changes"}</button></div>
      </form>`,
      { wide: true },
    );
    const f = $("#product-form", m.el);
    const err = $(".form-error", f);
    const refreshPreview = () => {
      $("#pf-preview", m.el).innerHTML = thumb({ name: f.name.value, imageUrl: f.imageUrl.value.trim(), accentColor: f.accentColor.value });
    };
    f.imageUrl.addEventListener("change", refreshPreview);
    f.accentColor.addEventListener("input", refreshPreview);
    $("#pf-file", m.el).addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append("image", file);
      const r = await run(() => api("POST", "/api/admin/upload", fd, true), "Image uploaded");
      if (r) {
        f.imageUrl.value = r.url;
        refreshPreview();
      }
    });
    $("#pf-newcat", m.el).addEventListener("click", async () => {
      const name = prompt("New category name");
      if (!name) return;
      const c = await run(() => api("POST", "/api/admin/categories", { name }), "Category added");
      if (c) {
        productData.categories.push(c);
        f.categoryId.insertAdjacentHTML("beforeend", `<option value="${c.id}" selected>${esc(c.name)}</option>`);
      }
    });
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.classList.add("hidden");
      const body = {
        name: f.name.value,
        slug: f.slug.value || f.name.value,
        categoryId: f.categoryId.value,
        tagline: f.tagline.value,
        description: f.description.value,
        imageUrl: f.imageUrl.value.trim(),
        accentColor: f.accentColor.value,
        badgeText: f.badgeText.value,
        rating: f.rating.value || 0,
        reviewCount: f.reviewCount.value || 0,
        sortOrder: f.sortOrder.value || 0,
        isActive: f.isActive.checked,
        isFeatured: f.isFeatured.checked,
      };
      if (isNew) {
        body.variants = [{ sizeLabel: f.v_sizeLabel.value, sku: f.v_sku.value, price: f.v_price.value, mrp: f.v_mrp.value, stockQty: f.v_stockQty.value || 0 }];
      }
      try {
        await api(isNew ? "POST" : "PUT", isNew ? "/api/admin/products" : `/api/admin/products/${p.id}`, body);
        m.close();
        toast(isNew ? "Product created" : "Product saved");
        renderProducts();
      } catch (ex) {
        err.textContent = ex.message;
        err.classList.remove("hidden");
      }
    });
  }

  /* ---------------- Orders ---------------- */

  const orderQuery = { status: "", fulfillment: "", q: "", page: 1 };

  async function renderOrders() {
    view.innerHTML = `<section class="a-panel">
      <div class="head"><h2 id="orders-count">Orders</h2>
        <div class="filters">
          <input class="input" type="search" id="o-q" placeholder="Order no., name or phone" value="${esc(orderQuery.q)}" aria-label="Search orders">
          <select class="select" id="o-status" aria-label="Filter by status"><option value="">All statuses</option>${STATUSES.map((s) => `<option ${orderQuery.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
          <select class="select" id="o-ful" aria-label="Filter by fulfilment"><option value="">Delivery &amp; pickup</option><option value="delivery" ${orderQuery.fulfillment === "delivery" ? "selected" : ""}>Delivery</option><option value="pickup" ${orderQuery.fulfillment === "pickup" ? "selected" : ""}>Vijayawada pickup</option></select>
        </div></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Order</th><th>Customer</th><th>Type</th><th>Payment</th><th>Items</th><th>Total</th><th>Status</th></tr></thead><tbody id="orders-body"></tbody></table></div>
      <div class="pager" id="orders-pager"></div></section>`;
    let t;
    $("#o-q").addEventListener("input", (e) => {
      clearTimeout(t);
      t = setTimeout(() => {
        orderQuery.q = e.target.value.trim();
        orderQuery.page = 1;
        loadOrders();
      }, 250);
    });
    $("#o-status").addEventListener("change", (e) => {
      orderQuery.status = e.target.value;
      orderQuery.page = 1;
      loadOrders();
    });
    $("#o-ful").addEventListener("change", (e) => {
      orderQuery.fulfillment = e.target.value;
      orderQuery.page = 1;
      loadOrders();
    });
    $("#orders-pager").addEventListener("click", (e) => {
      const b = e.target.closest("[data-page]");
      if (!b) return;
      orderQuery.page = Number(b.dataset.page);
      loadOrders();
    });
    await loadOrders();
  }

  async function loadOrders() {
    const qs = new URLSearchParams(Object.entries(orderQuery).filter(([, v]) => v !== "" && v !== null));
    const r = await api("GET", `/api/admin/orders?${qs}`);
    $("#orders-count").textContent = `${r.total} order${r.total === 1 ? "" : "s"}`;
    $("#orders-body").innerHTML = r.orders.length
      ? r.orders
          .map(
            (o) => `<tr class="clickable" data-order="${esc(o.orderNumber)}"><td><b>${esc(o.orderNumber)}</b><br><span class="muted">${dt(o.createdAt)}</span></td>
              <td>${esc(o.customerName)}<br><span class="muted">${esc(o.customerPhone)}</span></td>
              <td>${o.fulfillmentType === "pickup" ? "Pickup" : "Delivery"}</td><td>${esc(o.paymentMethod)}</td><td>${o.itemCount}</td>
              <td><b>${inr(o.totalAmount)}</b></td><td><span class="status ${statusClass(o.status)}">${esc(o.status)}</span></td></tr>`,
          )
          .join("")
      : '<tr class="empty-row"><td colspan="7">No orders match these filters</td></tr>';
    $("#orders-pager").innerHTML =
      r.pages > 1
        ? `<button class="btn btn-outline btn-sm" type="button" data-page="${r.page - 1}" ${r.page <= 1 ? "disabled" : ""}>← Prev</button>
           <span>Page ${r.page} of ${r.pages}</span>
           <button class="btn btn-outline btn-sm" type="button" data-page="${r.page + 1}" ${r.page >= r.pages ? "disabled" : ""}>Next →</button>`
        : "";
  }

  async function openOrder(orderNumber) {
    const { order: o } = await api("GET", `/api/admin/orders/${encodeURIComponent(orderNumber)}`);
    const m = modal(
      `<div class="order-detail">
        <div class="row"><h2 style="font-size:22px">${esc(o.orderNumber)}</h2><span class="status ${statusClass(o.status)}" id="od-status-badge">${esc(o.status)}</span></div>
        <dl class="dl">
          <dt>Placed</dt><dd>${dt(o.createdAt)}</dd>
          <dt>Customer</dt><dd>${esc(o.customerName)}</dd>
          <dt>Phone</dt><dd><a href="tel:+91${esc(o.customerPhone)}">${esc(o.customerPhone)}</a></dd>
          <dt>Fulfilment</dt><dd>${o.fulfillmentType === "pickup" ? "Store pickup (BRTS Rd, Vijayawada)" : "Home delivery"}</dd>
          ${o.fulfillmentType === "delivery" ? `<dt>Address</dt><dd>${esc(o.deliveryAddress)}${o.pincode ? ` — ${esc(o.pincode)}` : ""}</dd>` : ""}
          <dt>Payment</dt><dd>${esc(o.paymentMethod === "STORE" ? "Pay at store" : o.paymentMethod)}</dd>
          ${o.couponCode ? `<dt>Coupon</dt><dd>${esc(o.couponCode)}</dd>` : ""}
          ${o.notes ? `<dt>Notes</dt><dd>${esc(o.notes)}</dd>` : ""}
        </dl>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Item</th><th>Pack</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>
          ${o.items.map((i) => `<tr><td>${esc(i.productName)}</td><td>${esc(i.sizeLabel)}</td><td>${i.quantity}</td><td>${inr(i.unitPrice)}</td><td>${inr(i.lineTotal)}</td></tr>`).join("")}
          <tr><td colspan="4" style="text-align:right">Subtotal</td><td>${inr(o.subtotal)}</td></tr>
          ${o.discountAmount > 0 ? `<tr><td colspan="4" style="text-align:right">Discount</td><td>− ${inr(o.discountAmount)}</td></tr>` : ""}
          <tr><td colspan="4" style="text-align:right">Delivery</td><td>${o.deliveryFee > 0 ? inr(o.deliveryFee) : "Free"}</td></tr>
          <tr><td colspan="4" style="text-align:right"><b>Total</b></td><td><b>${inr(o.totalAmount)}</b></td></tr>
        </tbody></table></div>
        <div class="row">
          <label class="label" for="od-status" style="margin:0">Status</label>
          <select class="select" id="od-status" ${o.status === "Cancelled" ? "disabled" : ""}>${STATUSES.map((s) => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}</select>
          <button class="btn btn-primary btn-sm" type="button" id="od-update" ${o.status === "Cancelled" ? "disabled" : ""}>Update status</button>
        </div>
        <div class="row">
          <a class="btn btn-outline btn-sm" href="${esc(o.invoiceUrl)}" target="_blank" rel="noopener">Print invoice</a>
          <a class="btn btn-outline btn-sm" href="${esc(o.packingSlipUrl)}" target="_blank" rel="noopener">Packing slip</a>
          <a class="btn btn-wa btn-sm" id="od-wa" target="_blank" rel="noopener">Send WhatsApp update</a>
        </div>
        <p class="muted" style="font-size:12px">Cancelling an order returns its items to stock.</p>
      </div>`,
      { wide: true },
    );
    const setWa = (status) => {
      const msg = {
        Pending: `Hello ${o.customerName}, we've received your Varam order ${o.orderNumber} (${inr(o.totalAmount)}). We'll confirm it shortly.`,
        Confirmed: `Hello ${o.customerName}, your Varam order ${o.orderNumber} is confirmed! Total: ${inr(o.totalAmount)}.${o.paymentMethod === "UPI" ? " We'll share UPI payment details here." : ""}`,
        Packed: `Hello ${o.customerName}, your Varam order ${o.orderNumber} is packed${o.fulfillmentType === "pickup" ? " and ready for pickup at our BRTS Rd store, Vijayawada." : " and will be on its way soon."}`,
        "Out for Delivery": `Hello ${o.customerName}, your Varam order ${o.orderNumber} is out for delivery today.`,
        Delivered: `Hello ${o.customerName}, your Varam order ${o.orderNumber} has been delivered. Thank you for choosing Varam! 🙏`,
        Cancelled: `Hello ${o.customerName}, your Varam order ${o.orderNumber} has been cancelled. Please reply if you have any questions.`,
      }[status];
      $("#od-wa", m.el).href = `https://wa.me/91${o.customerPhone}?text=${encodeURIComponent(msg)}`;
    };
    setWa(o.status);
    $("#od-status", m.el).addEventListener("change", (e) => setWa(e.target.value));
    $("#od-update", m.el).addEventListener("click", async () => {
      const status = $("#od-status", m.el).value;
      if (status === "Cancelled" && !confirm("Cancel this order? Its items will be returned to stock and it can't be reopened.")) return;
      const r = await run(() => api("PUT", `/api/admin/orders/${encodeURIComponent(o.orderNumber)}/status`, { status }), `Status updated to ${status}`);
      if (r) {
        o.status = status;
        const badge = $("#od-status-badge", m.el);
        badge.textContent = status;
        badge.className = `status ${statusClass(status)}`;
        if (status === "Cancelled") {
          $("#od-status", m.el).disabled = true;
          $("#od-update", m.el).disabled = true;
        }
        if (location.pathname === "/admin/orders") loadOrders();
      }
    });
  }

  /* ---------------- Coupons & settings ---------------- */

  const SETTING_FIELDS = [
    ["announcement", "Announcement banner", "text", "full"],
    ["free_delivery_threshold", "Free delivery above (₹)", "number"],
    ["delivery_fee", "Delivery charge (₹)", "number"],
    ["store_name", "Store name", "text"],
    ["store_phone", "Store phone", "text"],
    ["store_address", "Store address", "text", "full"],
    ["whatsapp_number", "WhatsApp number (with 91)", "text"],
    ["store_hours", "Store hours", "text"],
    ["upi_id", "UPI ID (shown after UPI orders)", "text"],
    ["maps_url", "Google Maps link", "url"],
    ["instagram_url", "Instagram link", "url"],
    ["google_reviews_url", "Google reviews link", "url"],
    ["google_rating", "Google rating", "number"],
    ["google_review_count", "Google review count", "number"],
  ];

  async function renderSettings() {
    const [{ settings }, { coupons }] = await Promise.all([api("GET", "/api/admin/settings"), api("GET", "/api/admin/coupons")]);
    let testimonials = [];
    try {
      testimonials = JSON.parse(settings.testimonials || "[]");
    } catch {
      testimonials = [];
    }
    view.innerHTML = `
      <section class="a-panel"><div class="head"><h2>Coupons</h2></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Min. order ₹</th><th>Active</th><th></th></tr></thead><tbody id="coupon-body">
          ${coupons.map(couponRow).join("")}
          <tr data-new-coupon><td><input class="inline" name="code" placeholder="NEWCODE" aria-label="New coupon code"></td>
            <td><select class="inline input" name="discountType" style="height:36px;min-height:36px" aria-label="Type"><option value="percent">% off</option><option value="flat">₹ off</option></select></td>
            <td><input class="inline" name="discountValue" type="number" min="0" step="0.01" placeholder="10" aria-label="Value"></td>
            <td><input class="inline" name="minOrderAmount" type="number" min="0" step="1" value="0" aria-label="Minimum order"></td>
            <td><label class="toggle"><input type="checkbox" name="isActive" checked aria-label="Active"></label></td>
            <td><button class="btn btn-primary btn-sm" type="button" data-add-coupon>+ Add</button></td></tr>
        </tbody></table></div></section>

      <section class="a-panel"><div class="head"><h2>Store settings</h2></div>
        <form class="grid-form" id="settings-form" novalidate>
          ${SETTING_FIELDS.map(
            ([k, label, type, full]) =>
              `<div class="field${full ? " full" : ""}"><label for="s-${k}">${label}</label><input class="input" id="s-${k}" name="${k}" type="${type === "url" ? "url" : type}" ${type === "number" ? 'step="0.1" min="0"' : ""} value="${esc(settings[k] ?? "")}"></div>`,
          ).join("")}
          <div class="field full"><span class="label">Testimonials (genuine customer or Google reviews only)</span>
            <div id="testimonial-rows" style="display:grid;gap:10px"></div>
            <button class="btn btn-outline btn-sm" type="button" id="add-testimonial" style="margin-top:10px">+ Add testimonial</button></div>
          <div class="form-error hidden full" role="alert"></div>
          <div class="full"><button class="btn btn-primary" type="submit">Save settings</button></div>
        </form></section>

      <section class="a-panel"><div class="head"><h2>Change admin password</h2></div>
        <form class="grid-form" id="admin-pw" novalidate>
          <div class="field"><label for="apw-cur">Current password</label><input class="input" id="apw-cur" type="password" name="currentPassword" autocomplete="current-password"></div>
          <div class="field"><label for="apw-new">New password (min 8)</label><input class="input" id="apw-new" type="password" name="newPassword" autocomplete="new-password" minlength="8"></div>
          <div class="full"><button class="btn btn-dark" type="submit">Update password</button></div>
        </form></section>`;

    const tRows = $("#testimonial-rows");
    const tRow = (t = { name: "", text: "", rating: 5, source: "Google" }) => {
      const div = document.createElement("div");
      div.className = "grid-form";
      div.style.cssText = "grid-template-columns:1fr 2fr 80px 110px auto;align-items:start";
      div.innerHTML = `<input class="input" data-t="name" placeholder="Name" value="${esc(t.name)}" aria-label="Reviewer name">
        <textarea class="input" data-t="text" placeholder="Review text" style="min-height:44px" aria-label="Review text">${esc(t.text)}</textarea>
        <input class="input" data-t="rating" type="number" min="1" max="5" value="${Number(t.rating) || 5}" aria-label="Stars">
        <input class="input" data-t="source" value="${esc(t.source || "Google")}" aria-label="Source">
        <button class="link-btn" type="button" data-remove-t>Remove</button>`;
      tRows.appendChild(div);
    };
    testimonials.forEach(tRow);
    $("#add-testimonial").addEventListener("click", () => tRow());
    tRows.addEventListener("click", (e) => e.target.closest("[data-remove-t]")?.parentElement.remove());

    $("#settings-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      const err = $(".form-error", f);
      err.classList.add("hidden");
      const body = Object.fromEntries(SETTING_FIELDS.map(([k]) => [k, f[k].value.trim()]));
      body.testimonials = $$("#testimonial-rows > div").map((row) =>
        Object.fromEntries($$("[data-t]", row).map((i) => [i.dataset.t, i.value.trim()])),
      ).filter((t) => t.name || t.text);
      try {
        await api("PUT", "/api/admin/settings", body);
        toast("Settings saved — live on the store");
      } catch (ex) {
        err.textContent = ex.message;
        err.classList.remove("hidden");
      }
    });

    $("#admin-pw").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      const ok = await run(() => api("POST", "/api/auth/password", { currentPassword: f.currentPassword.value, newPassword: f.newPassword.value }), "Password updated");
      if (ok) f.reset();
    });

    $("#coupon-body").addEventListener("click", async (e) => {
      const tr = e.target.closest("tr");
      if (!tr) return;
      const values = () => ({
        code: $('[name="code"]', tr).value.trim(),
        discountType: $('[name="discountType"]', tr).value,
        discountValue: $('[name="discountValue"]', tr).value,
        minOrderAmount: $('[name="minOrderAmount"]', tr).value || 0,
        isActive: $('[name="isActive"]', tr).checked,
      });
      if (e.target.closest("[data-add-coupon]")) {
        const ok = await run(() => api("POST", "/api/admin/coupons", values()), "Coupon added");
        if (ok) renderSettings();
      } else if (e.target.closest("[data-save-coupon]")) {
        await run(() => api("PUT", `/api/admin/coupons/${tr.dataset.coupon}`, values()), "Coupon saved");
      } else if (e.target.closest("[data-delete-coupon]")) {
        if (!confirm("Delete this coupon?")) return;
        const ok = await run(() => api("DELETE", `/api/admin/coupons/${tr.dataset.coupon}`), "Coupon deleted");
        if (ok) renderSettings();
      }
    });
    $("#coupon-body").addEventListener("change", async (e) => {
      const tr = e.target.closest("tr[data-coupon]");
      if (tr && e.target.name === "isActive") $("[data-save-coupon]", tr).click();
    });
  }

  function couponRow(c) {
    return `<tr data-coupon="${c.id}"><td><input class="inline" name="code" value="${esc(c.code)}" aria-label="Code"></td>
      <td><select class="inline input" name="discountType" style="height:36px;min-height:36px" aria-label="Type"><option value="percent" ${c.discountType === "percent" ? "selected" : ""}>% off</option><option value="flat" ${c.discountType === "flat" ? "selected" : ""}>₹ off</option></select></td>
      <td><input class="inline" name="discountValue" type="number" min="0" step="0.01" value="${c.discountValue}" aria-label="Value"></td>
      <td><input class="inline" name="minOrderAmount" type="number" min="0" step="1" value="${c.minOrderAmount}" aria-label="Minimum order"></td>
      <td><label class="toggle"><input type="checkbox" name="isActive" ${c.isActive ? "checked" : ""} aria-label="Active"></label></td>
      <td style="white-space:nowrap"><button class="btn btn-dark btn-sm" type="button" data-save-coupon>Save</button>
        <button class="link-btn" type="button" data-delete-coupon style="margin-left:8px">Delete</button></td></tr>`;
  }

  /* ---------------- Boot ---------------- */

  (async () => {
    try {
      const { user } = await api("GET", "/api/auth/me");
      if (!user || user.role !== "admin") {
        location.href = "/admin/login";
        return;
      }
      $("#admin-email").textContent = user.email;
      navigate(location.pathname, false);
    } catch {
      location.href = "/admin/login";
    }
  })();
})();
