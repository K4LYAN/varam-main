/* Varam — sign in & create account (merges the guest cart into the account cart) */
(function () {
  "use strict";
  const { $, $$, api, Cart, state, I } = window.Varam;

  $$("[data-icon]").forEach((el) => {
    if (I[el.dataset.icon]) el.innerHTML = I[el.dataset.icon];
  });

  /**
   * Where to go after signing in. Only same-site paths are allowed: "/\evil.com"
   * and "//evil.com" both parse to another origin and are rejected.
   */
  function safeNext() {
    const raw = new URLSearchParams(location.search).get("next");
    if (!raw) return null;
    try {
      const url = new URL(raw, location.origin);
      if (url.origin !== location.origin || /^\/(login|register)\b/.test(url.pathname)) return null;
      return url.pathname + url.search + url.hash;
    } catch {
      return null;
    }
  }
  const nextUrl = (user) => safeNext() || (user.role === "admin" ? "/admin" : "/account");

  // Keep ?next= when switching between sign in and sign up
  const next = safeNext();
  if (next) $$("[data-keep-next]").forEach((a) => (a.href = `${a.getAttribute("href")}?next=${encodeURIComponent(next)}`));

  /* ---------------- Show / hide password, Caps Lock ---------------- */

  $$(".pw-toggle").forEach((btn) => {
    const input = document.getElementById(btn.getAttribute("aria-controls"));
    btn.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.textContent = show ? "Hide" : "Show";
      btn.setAttribute("aria-pressed", String(show));
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
      input.focus();
    });
  });
  $$('input[type="password"]').forEach((input) => {
    const warn = input.closest(".field")?.querySelector(".caps");
    if (!warn) return;
    const check = (e) => warn.classList.toggle("hidden", !(e.getModifierState && e.getModifierState("CapsLock")));
    input.addEventListener("keyup", check);
    input.addEventListener("keydown", check);
    input.addEventListener("blur", () => warn.classList.add("hidden"));
  });

  /* ---------------- Password strength (sign up) ---------------- */

  const reg = $("#register-form");
  function personalBits(f) {
    return [f.email.value.split("@")[0], ...f.name.value.split(/\s+/), f.phone.value.replace(/\D/g, "").slice(-10)]
      .map((t) => t.toLowerCase())
      .filter((t) => t.length >= 4);
  }
  function rules(f) {
    const pw = f.password.value;
    const lower = pw.toLowerCase();
    return {
      len: pw.length >= 8,
      mix: /[a-z]/i.test(pw) && /\d/.test(pw),
      personal: pw.length > 0 && !personalBits(f).some((t) => lower.includes(t)),
    };
  }
  function score(pw) {
    let s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  }
  function paintStrength() {
    if (!reg) return;
    const r = rules(reg);
    $$(".pw-rules [data-rule]", reg).forEach((li) => li.classList.toggle("ok", Boolean(r[li.dataset.rule])));
    const sc = reg.password.value ? Math.max(1, score(reg.password.value)) : 0;
    const bar = $(".pw-meter", reg);
    bar.dataset.score = String(sc);
    $(".pw-meter i", reg).style.width = `${sc * 25}%`;
  }
  if (reg) ["password", "name", "email", "phone"].forEach((n) => reg[n].addEventListener("input", paintStrength));

  /* ---------------- Submit ---------------- */

  function fail(form, message, field) {
    const box = $(".form-error", form);
    box.textContent = message;
    box.classList.remove("hidden");
    $$("[aria-invalid]", form).forEach((el) => el.removeAttribute("aria-invalid"));
    if (field && form[field]) {
      form[field].setAttribute("aria-invalid", "true");
      form[field].focus();
    }
  }

  function wire(form, endpoint, collect, check) {
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      $(".form-error", form).classList.add("hidden");
      const problem = check ? check(form) : null;
      if (problem) return fail(form, problem[0], problem[1]);
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
        fail(form, err.message, err.data && err.data.field);
        btn.disabled = false;
        btn.textContent = label;
        if (form.password) form.password.value = "";
        paintStrength();
      }
    });
  }

  wire(
    $("#login-form"),
    "/api/auth/login",
    (f) => ({ identifier: f.identifier.value.trim(), password: f.password.value, website: f.website.value }),
    (f) => (!f.identifier.value.trim() ? ["Enter your email or mobile number", "identifier"] : !f.password.value ? ["Enter your password", "password"] : null),
  );

  wire(
    reg,
    "/api/auth/register",
    (f) => ({
      name: f.name.value.trim(),
      email: f.email.value.trim(),
      phone: f.phone.value.trim(),
      password: f.password.value,
      confirmPassword: f.confirmPassword.value,
      acceptTerms: f.acceptTerms.checked,
      website: f.website.value,
    }),
    (f) => {
      if (f.name.value.trim().length < 2) return ["Enter your full name", "name"];
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim())) return ["Enter a valid email address", "email"];
      if (!/^[6-9]\d{9}$/.test(f.phone.value.replace(/\D/g, "").slice(-10))) return ["Enter a valid 10-digit mobile number", "phone"];
      const r = rules(f);
      if (!r.len) return ["Your password needs at least 8 characters", "password"];
      if (!r.mix) return ["Your password needs at least one letter and one number", "password"];
      if (!r.personal) return ["Your password must not contain your name, email or phone number", "password"];
      if (f.confirmPassword.value !== f.password.value) return ["The two passwords don't match", "confirmPassword"];
      if (!f.acceptTerms.checked) return ["Please tick the box to accept the terms", "acceptTerms"];
      return null;
    },
  );

  window.Varam.ready().then(() => {
    const s = state.settings;
    const forgot = $("[data-forgot]");
    if (forgot && s && s.whatsappNumber) {
      forgot.href = `https://wa.me/${s.whatsappNumber}?text=${encodeURIComponent("Hello Varam! I forgot my account password. My registered email/phone is: ")}`;
    }
  });
})();
