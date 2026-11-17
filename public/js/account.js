/* Varam — customer dashboard: orders, reorder, profile, password */
(function () {
  "use strict";
  const { $, $$, api, esc, inr, toast, Cart, state, openDrawer, renderHeader } = window.Varam;

  const statusClass = (s) => "st-" + String(s).split(" ")[0];

  async function loadOrders() {
    const box = $("#orders");
    try {
      const { orders } = await api("GET", "/api/account/orders");
      if (!orders.length) {
        box.innerHTML = `<div class="empty"><h3>No orders yet</h3><p class="muted" style="margin:6px 0 14px">Your orders will appear here.</p><a class="btn btn-primary" href="/#shop">Start shopping</a></div>`;
        return;
      }
      box.innerHTML = orders
        .map(
          (o) => `<article class="order-card">
            <div class="top"><b>${esc(o.orderNumber)}</b><span class="status ${statusClass(o.status)}">${esc(o.status)}</span></div>
            <div class="muted" style="font-size:13px">${new Date(o.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} ·
              ${o.fulfillmentType === "pickup" ? "Store pickup" : "Home delivery"} · ${esc(o.paymentMethod === "STORE" ? "Pay at store" : o.paymentMethod)}</div>
            <div class="items">${o.items.map((i) => `${esc(i.productName)} (${esc(i.sizeLabel)}) × ${i.quantity}`).join(" · ")}</div>
            <div class="top"><b>${inr(o.totalAmount)}</b>
              <div class="actions">
                <a class="btn btn-outline btn-sm" href="${esc(o.invoiceUrl)}" target="_blank" rel="noopener">Invoice</a>
                <button class="btn btn-primary btn-sm" type="button" data-reorder="${esc(o.orderNumber)}">Reorder</button>
              </div></div>
          </article>`,
        )
        .join("");
    } catch (err) {
      box.innerHTML = `<p class="form-error">${esc(err.message)}</p>`;
    }
  }

  $("#orders").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-reorder]");
    if (!b) return;
    b.disabled = true;
    try {
      const r = await api("POST", `/api/account/orders/${encodeURIComponent(b.dataset.reorder)}/reorder`);
      Cart.items = r.items;
      Cart.changed(true);
      if (r.skipped.length) toast(`Added to cart. Not available: ${r.skipped.join(", ")}`, { error: true });
      openDrawer();
    } catch (err) {
      toast(err.message, { error: true });
    } finally {
      b.disabled = false;
    }
  });

  function fillProfile() {
    const u = state.user;
    if (!u) return;
    const f = $("#profile-form");
    f.name.value = u.name || "";
    $("#p-email").value = u.email || "";
    f.phone.value = u.phone || "";
    f.defaultAddress.value = u.defaultAddress || "";
    f.pincode.value = u.pincode || "";
  }

  $("#profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const err = $(".form-error", f);
    err.classList.add("hidden");
    try {
      const { user } = await api("PUT", "/api/account/profile", {
        name: f.name.value,
        phone: f.phone.value,
        defaultAddress: f.defaultAddress.value,
        pincode: f.pincode.value,
      });
      state.user = user;
      renderHeader();
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
      toast("Password updated");
    } catch (ex) {
      err.textContent = ex.message;
      err.classList.remove("hidden");
    }
  });

  $("#logout").addEventListener("click", async () => {
    await api("POST", "/api/auth/logout");
    location.href = "/";
  });

  window.Varam.ready().then(() => {
    if (!state.user) {
      location.href = "/login?next=/account";
      return;
    }
    fillProfile();
    loadOrders();
    $$("main input")[0]?.blur();
  });
})();
