/* =====================================================================
   Varam — customer dashboard
   Overview · Orders (tracker, cancel, reorder) · Addresses · Wishlist · Profile & security
   ===================================================================== */
(function () {
  "use strict";
  const { $, $$, api, esc, inr, I, toast, Cart, state, openDrawer, renderHeader, productVisual, loadCatalog, Wishlist, addToCart } = window.Varam;
  const M = window.VaramMotion;

  const data = { orders: [], addresses: [], tab: "overview", filter: "all" };
  const STEPS_DELIVERY = ["Pending", "Confirmed", "Packed", "Out for Delivery", "Delivered"];
  const STEPS_PICKUP = ["Pending", "Confirmed", "Packed", "Delivered"];
  const STEP_LABELS = { Pending: "Placed", Confirmed: "Confirmed", Packed: "Packed", "Out for Delivery": "On the way", Delivered: "Delivered" };
  const statusClass = (s) => "st-" + String(s).split(" ")[0];
  const fmtDate = (d) => new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

  /* ---------------- Header & stats ---------------- */

  function tierFor(spent) {
    if (spent >= 10000) return { name: "Varam Family", icon: "👑" };
    if (spent >= 2500) return { name: "Gold member", icon: "✨" };
    return { name: "Varam friend", icon: "🌿" };
  }

  function renderHeaderArea() {
    const u = state.user;
    const first = u.name.split(" ")[0];
    $("#avatar").textContent = u.name.trim().charAt(0).toUpperCase();
    $("#hello").textContent = `Namaste, ${first}!`;
    $("#member").textContent = u.memberSince ? `Member since ${new Date(u.memberSince).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}` : "Your Varam account";
    const valid = data.orders.filter((o) => o.status !== "Cancelled");
    const spent = valid.reduce((s, o) => s + o.totalAmount, 0);
    const tier = tierFor(spent);
    $("#tier").textContent = `${tier.icon} ${tier.name}`;
    const active = data.orders.filter((o) => !["Delivered", "Cancelled"].includes(o.status)).length;
    const saved = valid.reduce((s, o) => s + o.discountAmount, 0);
    const stats = [
      ["Orders", data.orders.length, (n) => String(Math.round(n))],
      ["Total spent", spent, (n) => inr(Math.round(n))],
      ["Active orders", active, (n) => String(Math.round(n))],
      ["Saved with coupons", saved, (n) => inr(Math.round(n))],
    ];
    $("#stats").innerHTML = stats.map(([label]) => `<div class="stat"><span>${label}</span><b>0</b></div>`).join("");
    $$("#stats .stat b").forEach((el, i) => countTo(el, stats[i][1], stats[i][2]));
    $("#c-orders").textContent = String(data.orders.length);
    $("#c-addresses").textContent = String(data.addresses.length);
    $("#c-wishlist").textContent = String(Wishlist.ids.size);
  }

  function countTo(el, to, fmt) {
    if (!M || M.reduce) return void (el.textContent = fmt(to));
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / 1000);
      el.textContent = fmt(to * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------------- Tabs ---------------- */

  function selectTab(tab, focus) {
    data.tab = tab;
    $$("#tabs [data-tab]").forEach((b) => {
      const on = b.dataset.tab === tab;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    if (location.hash !== `#${tab}`) history.replaceState(null, "", `#${tab}`);
    ({ overview: renderOverview, orders: renderOrders, addresses: renderAddresses, wishlist: renderWishlist, profile: renderProfile })[tab]();
    M?.animate($("#panel"), [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: 420 });
  }

  $("#tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (b) selectTab(b.dataset.tab);
  });
  $("#tabs").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const tabs = $$("#tabs [data-tab]");
    const i = tabs.findIndex((t) => t.dataset.tab === data.tab);
    selectTab(tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length].dataset.tab, true);
  });

  /* ---------------- Orders ---------------- */

  function tracker(o) {
    if (o.status === "Cancelled") return `<p class="coupon-msg err" style="margin:10px 0">This order was cancelled.</p>`;
    const steps = o.fulfillmentType === "pickup" ? STEPS_PICKUP : STEPS_DELIVERY;
    const at = steps.indexOf(o.status);
    const label = (s) => (o.fulfillmentType === "pickup" && s === "Packed" ? "Ready" : o.fulfillmentType === "pickup" && s === "Delivered" ? "Collected" : STEP_LABELS[s]);
    const parts = [];
    steps.forEach((s, i) => {
      parts.push(`<span class="dot ${i < at || (i === at && s === "Delivered") ? "done" : i === at ? "now" : ""}" title="${esc(label(s))}">${i <= at ? I.check : ""}</span>`);
      if (i < steps.length - 1) parts.push(`<span class="bar"><i style="width:${i < at ? 100 : 0}%"></i></span>`);
    });
    return `<div class="tracker" aria-label="Order progress: ${esc(label(o.status) || o.status)}">${parts.join("")}</div>
      <div class="tracker-labels">${steps.map((s) => `<span>${esc(label(s))}</span>`).join("")}</div>`;
  }

  function orderCard(o) {
    const s = state.settings || {};
    const help = `https://wa.me/${s.whatsappNumber || "917799228444"}?text=${encodeURIComponent(`Hello Varam! I have a question about my order ${o.orderNumber}.`)}`;
    const thumbs = o.items
      .slice(0, 5)
      .map((i) => `<span title="${esc(i.productName)}">${window.Varam.bottleSvg(i.productName, colourFor(i.productName))}</span>`)
      .join("");
    return `<article class="order-card" data-order="${esc(o.orderNumber)}">
      <div class="top"><div><b>${esc(o.orderNumber)}</b><div class="muted" style="font-size:13px">${fmtDate(o.createdAt)} · ${o.fulfillmentType === "pickup" ? "Store pickup" : "Home delivery"} · ${esc(o.paymentMethod === "STORE" ? "Pay at store" : o.paymentMethod)}</div></div>
        <span class="status ${statusClass(o.status)}">${esc(o.status)}</span></div>
      ${tracker(o)}
      <div class="thumbs">${thumbs}</div>
      <div class="top"><b style="font-size:18px">${inr(o.totalAmount)}</b>
        <div class="actions">
          ${o.canCancel ? `<button class="btn btn-outline btn-sm" type="button" data-cancel="${esc(o.orderNumber)}">Cancel</button>` : ""}
          <a class="btn btn-outline btn-sm" href="${esc(o.invoiceUrl)}" target="_blank" rel="noopener">Invoice</a>
          <a class="btn btn-outline btn-sm" href="${help}" target="_blank" rel="noopener">Help</a>
          <button class="btn btn-primary btn-sm" type="button" data-reorder="${esc(o.orderNumber)}">Reorder</button>
        </div></div>
      <details><summary>View ${o.items.length} item${o.items.length === 1 ? "" : "s"}</summary>
        <table>${o.items.map((i) => `<tr><td>${esc(i.productName)} · ${esc(i.sizeLabel)} × ${i.quantity}</td><td>${inr(i.lineTotal)}</td></tr>`).join("")}
          ${o.discountAmount > 0 ? `<tr><td>Discount ${o.couponCode ? `(${esc(o.couponCode)})` : ""}</td><td>− ${inr(o.discountAmount)}</td></tr>` : ""}
          <tr><td>${o.fulfillmentType === "pickup" ? "Store pickup" : "Delivery"}</td><td>${o.deliveryFee > 0 ? inr(o.deliveryFee) : "Free"}</td></tr>
          <tr><td><b>Total</b></td><td><b>${inr(o.totalAmount)}</b></td></tr></table>
        ${o.fulfillmentType === "delivery" && o.deliveryAddress ? `<p class="muted" style="font-size:13px;margin-top:8px">Delivering to: ${esc(o.deliveryAddress)}${o.pincode ? ` — ${esc(o.pincode)}` : ""}</p>` : ""}
      </details>
    </article>`;
  }

  function colourFor(name) {
    const p = (state.catalog?.products || []).find((x) => x.name === name);
    return p ? p.accentColor : "#D97706";
  }

  function emptyOrders() {
    return `<div class="empty"><div class="empty-art">${I.bag}</div><h3>No orders yet</h3><p class="muted" style="margin:6px 0 14px">Your orders and their live status will appear here.</p><a class="btn btn-primary" href="/#shop">Start shopping</a></div>`;
  }

  function renderOverview() {
    const latest = data.orders[0];
    const s = state.settings || {};
    $("#panel").innerHTML = `
      <div class="account-grid" style="padding:0">
        <section class="panel"><h2>Latest order</h2>${latest ? orderCard(latest) : emptyOrders()}</section>
        <section class="panel"><h2>Quick actions</h2>
          <div style="display:grid;gap:10px">
            <a class="btn btn-primary" href="/#shop">${I.bag} Shop wood-pressed oils</a>
            ${latest ? `<button class="btn btn-outline" type="button" data-reorder="${esc(latest.orderNumber)}">Reorder last order</button>` : ""}
            <button class="btn btn-outline" type="button" data-goto="addresses">Manage addresses</button>
            <a class="btn btn-wa" href="https://wa.me/${esc(s.whatsappNumber || "917799228444")}" target="_blank" rel="noopener">${I.wa} Chat with Varam</a>
          </div>
          <div class="bulk" style="margin-top:16px"><div><b>Free store pickup</b><div class="muted" style="font-size:14px">${esc(s.storeAddress || "")}</div></div></div>
        </section>
      </div>`;
  }

  function renderOrders() {
    const filters = [
      ["all", "All"],
      ["active", "Active"],
      ["Delivered", "Delivered"],
      ["Cancelled", "Cancelled"],
    ];
    const list = data.orders.filter((o) =>
      data.filter === "all" ? true : data.filter === "active" ? !["Delivered", "Cancelled"].includes(o.status) : o.status === data.filter,
    );
    $("#panel").innerHTML = `<div class="order-filters">${filters
      .map(([k, l]) => `<button type="button" class="pill" data-filter="${k}" aria-pressed="${data.filter === k}">${l}</button>`)
      .join("")}</div>
      <div data-reveal data-stagger="70">${list.length ? list.map(orderCard).join("") : data.orders.length ? '<p class="muted">No orders in this view.</p>' : emptyOrders()}</div>`;
  }

  /* ---------------- Addresses ---------------- */

  function renderAddresses() {
    $("#panel").innerHTML = `<div class="addr-grid" data-reveal data-stagger="70">
      ${data.addresses
        .map(
          (a) => `<div class="addr-card${a.isDefault ? " default" : ""}">
            <div class="top"><span class="tag">${esc(a.label)}</span>${a.isDefault ? '<span class="badge badge-brand">Default</span>' : ""}</div>
            <b>${esc(a.name)}</b><span class="muted">${esc(a.phone)}</span><span>${esc(a.address)}</span><span>${esc(a.pincode)}</span>
            <div class="actions">
              <button class="link-btn" type="button" data-edit-address="${a.id}">Edit</button>
              ${a.isDefault ? "" : `<button class="link-btn" type="button" data-default-address="${a.id}">Make default</button>`}
              <button class="link-btn" type="button" data-delete-address="${a.id}" style="color:var(--muted)">Delete</button>
            </div></div>`,
        )
        .join("")}
      ${data.addresses.length < 10 ? `<button class="addr-add" type="button" data-add-address>+ Add a new address</button>` : ""}
    </div>`;
  }

  function addressForm(a) {
    const isNew = !a;
    a = a || { label: "Home", name: state.user.name, phone: state.user.phone || "", address: "", pincode: "", isDefault: data.addresses.length === 0 };
    const wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-label", isNew ? "Add address" : "Edit address");
    wrap.innerHTML = `<div class="backdrop show" data-x></div><div class="modal-card" style="text-align:left">
      <h2 style="margin:0 0 14px">${isNew ? "Add a new address" : "Edit address"}</h2>
      <form class="form" novalidate>
        <div class="form-error hidden" role="alert"></div>
        <div class="field"><span class="label">Label</span><div class="radio-row">
          ${["Home", "Work", "Other"].map((l) => `<label><input type="radio" name="label" value="${l}" ${a.label === l ? "checked" : ""}> <span>${l}</span></label>`).join("")}</div></div>
        <div class="field"><label for="ad-name">Recipient name</label><input class="input" id="ad-name" name="name" value="${esc(a.name)}" autocomplete="name" required></div>
        <div class="field"><label for="ad-phone">Mobile number</label><input class="input" id="ad-phone" name="phone" value="${esc(a.phone)}" inputmode="tel" autocomplete="tel" required></div>
        <div class="field"><label for="ad-address">Full address</label><textarea class="input" id="ad-address" name="address" autocomplete="street-address" required placeholder="House no., street, area, landmark, city">${esc(a.address)}</textarea></div>
        <div class="field"><label for="ad-pin">Pincode</label><input class="input" id="ad-pin" name="pincode" value="${esc(a.pincode)}" inputmode="numeric" maxlength="6" autocomplete="postal-code" required></div>
        <label class="radio-row" style="gap:8px"><input type="checkbox" name="isDefault" ${a.isDefault ? "checked" : ""}> <span>Make this my default address</span></label>
        <div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn btn-outline" type="button" data-x>Cancel</button><button class="btn btn-primary" type="submit">${isNew ? "Save address" : "Save changes"}</button></div>
      </form></div>`;
    document.body.appendChild(wrap);
    document.body.style.overflow = "hidden";
    const close = () => {
      wrap.remove();
      document.body.style.overflow = "";
    };
    $$("[data-x]", wrap).forEach((b) => b.addEventListener("click", close));
    wrap.addEventListener("keydown", (e) => e.key === "Escape" && close());
    const f = $("form", wrap);
    f.name.focus();
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $(".form-error", f);
      err.classList.add("hidden");
      const body = { label: f.label.value, name: f.name.value, phone: f.phone.value, address: f.address.value, pincode: f.pincode.value, isDefault: f.isDefault.checked };
      try {
        const r = await api(isNew ? "POST" : "PUT", isNew ? "/api/account/addresses" : `/api/account/addresses/${a.id}`, body);
        data.addresses = r.addresses;
        state.addresses = r.addresses;
        close();
        toast(isNew ? "Address saved" : "Address updated");
        refreshUser();
        renderHeaderArea();
        renderAddresses();
      } catch (ex) {
        err.textContent = ex.message;
        err.classList.remove("hidden");
      }
    });
  }

  async function refreshUser() {
    try {
      state.user = (await api("GET", "/api/auth/me")).user;
    } catch {
      /* keep current */
    }
  }

  /* ---------------- Wishlist ---------------- */

  async function renderWishlist() {
    const { products } = await loadCatalog();
    const list = products.filter((p) => Wishlist.has(p.id));
    $("#c-wishlist").textContent = String(list.length);
    if (!list.length) {
      $("#panel").innerHTML = `<div class="empty"><div class="empty-art">${I.heart}</div><h3>Your wishlist is empty</h3><p class="muted" style="margin:6px 0 14px">Tap the heart on any product to save it here.</p><a class="btn btn-primary" href="/#shop">Browse products</a></div>`;
      return;
    }
    $("#panel").innerHTML = `<div class="grid" data-reveal data-stagger="70">${list
      .map((p) => {
        const v = p.variants.find((x) => x.stockQty > 0) || p.variants[0];
        return `<article class="card" data-tilt="5"><a class="card-link" href="/product/${esc(p.slug)}" aria-label="View ${esc(p.name)}"></a>
          <div class="card-media"><button class="heart" type="button" data-wish="${p.id}" aria-pressed="true" aria-label="Remove ${esc(p.name)} from wishlist">${I.heart}</button>${productVisual(p, v.sizeLabel)}</div>
          <div class="card-body"><span class="card-cat">${esc(p.category?.name || "")}</span><h3>${esc(p.name)}</h3>
            <div class="price-row"><div class="price">${inr(v.price)}<small>${esc(v.sizeLabel)}</small></div>
            <button class="btn btn-primary add-btn" type="button" data-wl-add="${v.id}" data-name="${esc(p.name)}" ${v.stockQty <= 0 ? "disabled" : ""}>${I.plus}<span class="lbl">Add</span></button></div></div></article>`;
      })
      .join("")}</div>`;
  }

  /* ---------------- Profile & security ---------------- */

  function renderProfile() {
    const u = state.user;
    $("#panel").innerHTML = `<div class="profile-grid">
      <section class="panel"><h2>Personal details</h2>
        <form class="form" id="profile-form" novalidate>
          <div class="form-error hidden" role="alert"></div>
          <div class="field"><label for="p-name">Full name</label><input class="input" id="p-name" name="name" value="${esc(u.name)}" autocomplete="name" required></div>
          <div class="field"><label for="p-email">Email</label><input class="input" id="p-email" value="${esc(u.email)}" disabled><span class="muted" style="font-size:12px">To change your email, message us on WhatsApp.</span></div>
          <div class="field"><label for="p-phone">Mobile number</label><input class="input" id="p-phone" name="phone" value="${esc(u.phone || "")}" inputmode="tel" autocomplete="tel" required></div>
          <button class="btn btn-primary" type="submit">Save changes</button>
        </form></section>
      <section class="panel"><h2>Change password</h2>
        <form class="form" id="password-form" novalidate>
          <div class="form-error hidden" role="alert"></div>
          <div class="field"><label for="pw-current">Current password</label><input class="input" id="pw-current" name="currentPassword" type="password" autocomplete="current-password" required></div>
          <div class="field"><label for="pw-new">New password</label><input class="input" id="pw-new" name="newPassword" type="password" autocomplete="new-password" minlength="8" required>
            <div class="strength" aria-hidden="true"><i id="pw-bar"></i></div><span class="muted" style="font-size:12px" id="pw-hint">At least 8 characters. Mix letters, numbers and symbols.</span></div>
          <button class="btn btn-dark" type="submit">Update password</button>
        </form>
        <hr style="border:0;border-top:1px solid var(--line);margin:22px 0">
        <button class="btn btn-outline btn-block" type="button" id="logout">Sign out</button>
      </section></div>`;

    $("#pw-new").addEventListener("input", (e) => {
      const v = e.target.value;
      let score = 0;
      if (v.length >= 8) score++;
      if (v.length >= 12) score++;
      if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
      if (/\d/.test(v)) score++;
      if (/[^A-Za-z0-9]/.test(v)) score++;
      const pct = (score / 5) * 100;
      const colour = score <= 1 ? "#dc2626" : score <= 3 ? "#f59e0b" : "#65a30d";
      $("#pw-bar").style.width = `${pct}%`;
      $("#pw-bar").style.background = colour;
      $("#pw-hint").textContent = ["Too short", "Weak", "Okay", "Good", "Strong", "Very strong"][score];
    });

    $("#profile-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      const err = $(".form-error", f);
      err.classList.add("hidden");
      try {
        const { user } = await api("PUT", "/api/account/profile", { name: f.name.value, phone: f.phone.value, defaultAddress: state.user.defaultAddress, pincode: state.user.pincode });
        state.user = user;
        renderHeader();
        renderHeaderArea();
        toast("Profile saved");
      } catch (ex) {
        err.textContent = ex.message;
        err.classList.remove("hidden");
      }
    });
    $("#password-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      const err = $(".form-error", f);
      err.classList.add("hidden");
      try {
        await api("POST", "/api/auth/password", { currentPassword: f.currentPassword.value, newPassword: f.newPassword.value });
        f.reset();
        $("#pw-bar").style.width = "0";
        toast("Password updated — other devices have been signed out");
      } catch (ex) {
        err.textContent = ex.message;
        err.classList.remove("hidden");
      }
    });
    $("#logout").addEventListener("click", async () => {
      await Cart.flush(); // save any pending cart edits to the account first
      await api("POST", "/api/auth/logout");
      location.href = "/";
    });
  }

  /* ---------------- Panel actions ---------------- */

  $("#panel").addEventListener("click", async (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.filter) {
      data.filter = t.dataset.filter;
      renderOrders();
      return;
    }
    if (t.dataset.goto) return selectTab(t.dataset.goto);
    if (t.dataset.reorder) {
      t.disabled = true;
      try {
        const r = await api("POST", `/api/account/orders/${encodeURIComponent(t.dataset.reorder)}/reorder`);
        Cart.items = r.items;
        Cart.changed(true);
        if (r.skipped.length) toast(`Added to cart. Not available now: ${r.skipped.join(", ")}`, { error: true });
        openDrawer();
      } catch (err) {
        toast(err.message, { error: true });
      } finally {
        t.disabled = false;
      }
      return;
    }
    if (t.dataset.cancel) {
      if (!confirm(`Cancel order ${t.dataset.cancel}? This can't be undone.`)) return;
      try {
        await api("POST", `/api/account/orders/${encodeURIComponent(t.dataset.cancel)}/cancel`);
        toast("Order cancelled");
        await loadOrders();
        renderHeaderArea();
        selectTab(data.tab);
      } catch (err) {
        toast(err.message, { error: true });
      }
      return;
    }
    if (t.hasAttribute("data-add-address")) return addressForm(null);
    if (t.dataset.editAddress) return addressForm(data.addresses.find((a) => a.id === Number(t.dataset.editAddress)));
    if (t.dataset.defaultAddress) {
      const a = data.addresses.find((x) => x.id === Number(t.dataset.defaultAddress));
      try {
        data.addresses = (await api("PUT", `/api/account/addresses/${a.id}`, { ...a, isDefault: true })).addresses;
        state.addresses = data.addresses;
        refreshUser();
        renderAddresses();
        toast(`${a.label} is now your default address`);
      } catch (err) {
        toast(err.message, { error: true });
      }
      return;
    }
    if (t.dataset.deleteAddress) {
      if (!confirm("Delete this address?")) return;
      try {
        data.addresses = (await api("DELETE", `/api/account/addresses/${t.dataset.deleteAddress}`)).addresses;
        state.addresses = data.addresses;
        refreshUser();
        renderHeaderArea();
        renderAddresses();
      } catch (err) {
        toast(err.message, { error: true });
      }
      return;
    }
    if (t.dataset.wlAdd) {
      try {
        await addToCart(t.dataset.wlAdd, 1, t.closest(".card").querySelector(".card-media svg, .card-media img"), t.dataset.name);
      } catch (err) {
        toast(err.message, { error: true });
      }
    }
  });

  window.addEventListener("varam:wishlist", () => {
    $("#c-wishlist").textContent = String(Wishlist.ids.size);
    if (data.tab === "wishlist") renderWishlist();
  });

  async function loadOrders() {
    data.orders = (await api("GET", "/api/account/orders")).orders;
  }

  window.Varam.ready().then(async () => {
    if (!state.user) {
      location.href = "/login?next=/account";
      return;
    }
    try {
      const [, addr] = await Promise.all([loadOrders(), api("GET", "/api/account/addresses"), loadCatalog(), Wishlist.load()]);
      data.addresses = addr.addresses;
      state.addresses = addr.addresses;
    } catch (err) {
      toast(err.message, { error: true });
    }
    renderHeaderArea();
    const fromHash = location.hash.slice(1);
    selectTab(["overview", "orders", "addresses", "wishlist", "profile"].includes(fromHash) ? fromHash : "overview");
  });
})();
