/* Varam — login & register (merges the guest cart into the account cart) */
(function () {
  "use strict";
  const { $, api, Cart, state } = window.Varam;

  function nextUrl(user) {
    const next = new URLSearchParams(location.search).get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) return next;
    return user.role === "admin" ? "/admin" : "/account";
  }

  function wire(form, endpoint, collect) {
    if (!form) return;
    const errBox = $(".form-error", form);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errBox.classList.add("hidden");
      const btn = $('button[type="submit"]', form);
      const label = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Please wait…";
      try {
        const { user } = await api("POST", endpoint, collect(form));
        state.user = user;
        await Cart.mergeGuest();
        location.href = nextUrl(user);
      } catch (err) {
        errBox.textContent = err.message;
        errBox.classList.remove("hidden");
        btn.disabled = false;
        btn.textContent = label;
      }
    });
  }

  wire($("#login-form"), "/api/auth/login", (f) => ({ identifier: f.identifier.value.trim(), password: f.password.value }));
  wire($("#register-form"), "/api/auth/register", (f) => ({
    name: f.name.value.trim(),
    email: f.email.value.trim(),
    phone: f.phone.value.trim(),
    password: f.password.value,
  }));
})();
