/* Varam — admin sign in */
(function () {
  "use strict";
  const form = document.getElementById("admin-login");
  const csrfToken = () => {
    const m = document.cookie.match(/(?:^|;\s*)varam_csrf=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  };
  const err = form.querySelector(".form-error");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.classList.add("hidden");
    const btn = form.querySelector("button");
    btn.disabled = true;
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken() },
        body: JSON.stringify({ identifier: form.identifier.value.trim(), password: form.password.value, adminOnly: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Sign in failed");
      location.href = "/admin";
    } catch (ex) {
      err.textContent = ex.message;
      err.classList.remove("hidden");
      btn.disabled = false;
    }
  });
})();
