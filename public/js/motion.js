/* =====================================================================
   Varam Motion — a tiny, dependency-free motion toolkit (Web Animations API)
   Framer-Motion-style effects: scroll reveals with stagger, parallax, 3D tilt,
   magnetic buttons, counters, word reveals, scroll progress and fly-to-cart.
   Everything is disabled for visitors who prefer reduced motion.
   ===================================================================== */
(function () {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const EASE = "cubic-bezier(0.22, 1, 0.36, 1)"; // "easeOutQuint"-like
  const SPRING = "linear(0, 0.009, 0.035 2.1%, 0.141, 0.281 6.7%, 0.723 12.9%, 0.938 16.7%, 1.017, 1.077, 1.121, 1.149 24.3%, 1.159, 1.163, 1.161, 1.154 29.9%, 1.129 32.8%, 1.051 39.6%, 1.017 43.1%, 0.991, 0.977 51%, 0.974 53.8%, 0.975 57.1%, 0.997 69.8%, 1.003 76.9%, 1)";
  const supportsLinear = CSS.supports && CSS.supports("animation-timing-function", "linear(0, 1)");
  const spring = supportsLinear ? SPRING : EASE;

  const VARIANTS = {
    "fade-up": [{ opacity: 0, transform: "translateY(28px)" }, { opacity: 1, transform: "none" }],
    "fade-down": [{ opacity: 0, transform: "translateY(-20px)" }, { opacity: 1, transform: "none" }],
    "fade-left": [{ opacity: 0, transform: "translateX(36px)" }, { opacity: 1, transform: "none" }],
    "fade-right": [{ opacity: 0, transform: "translateX(-36px)" }, { opacity: 1, transform: "none" }],
    "scale-in": [{ opacity: 0, transform: "scale(0.92)" }, { opacity: 1, transform: "none" }],
    "blur-in": [{ opacity: 0, filter: "blur(10px)", transform: "translateY(12px)" }, { opacity: 1, filter: "blur(0)", transform: "none" }],
    fade: [{ opacity: 0 }, { opacity: 1 }],
  };

  function animate(el, keyframes, opts = {}) {
    if (reduce || !el.animate) return { finished: Promise.resolve() };
    const anim = el.animate(keyframes, { duration: 700, easing: EASE, fill: "both", ...opts });
    // Hand the final state back to normal styles so hover effects (tilt, transitions) keep working
    if ((opts.fill || "both") !== "none") {
      anim.finished
        .then(() => {
          try {
            anim.commitStyles();
          } catch {
            /* element removed */
          }
          anim.cancel();
          el.style.removeProperty("transform");
          el.style.removeProperty("filter");
          el.style.removeProperty("opacity");
        })
        .catch(() => {});
    }
    return anim;
  }

  /* ---------- Scroll reveals (data-reveal="fade-up", data-stagger on parents) ---------- */

  const io =
    !reduce && "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (!e.isIntersecting) continue;
              io.unobserve(e.target);
              // One failing element must never stop the rest of the batch from revealing
              try {
                play(e.target);
              } catch (err) {
                console.warn("[motion] reveal failed", err);
                show(e.target);
              }
            }
          },
          { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
        )
      : null;

  function play(el) {
    if (el.classList.contains("in")) return;
    const variant = VARIANTS[el.dataset.reveal] || VARIANTS["fade-up"];
    const delay = Number(el.dataset.delay || 0);
    if (el.hasAttribute("data-stagger")) {
      const step = Number(el.dataset.stagger) || 70;
      Array.from(el.children).forEach((child, i) => {
        animate(child, VARIANTS[child.dataset.reveal] || variant, { duration: 650, delay: delay + i * step }).finished.then(() => child.classList.add("in"));
      });
      el.style.opacity = "";
    } else {
      animate(el, variant, { duration: Number(el.dataset.duration || 800), delay });
    }
    el.classList.add("in");
  }

  /** Make an element (and staggered children) visible without animation. */
  function show(el) {
    el.style.removeProperty("opacity");
    if (el.hasAttribute("data-stagger")) Array.from(el.children).forEach((c) => c.style.removeProperty("opacity"));
    el.classList.add("in");
  }

  /** Safety net: anything that has scrolled into (or above) view but is still hidden gets shown. */
  function sweep() {
    document.querySelectorAll("[data-observed]:not(.in)").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight * 0.95 && r.height > 0) {
        io?.unobserve(el);
        try {
          play(el);
        } catch {
          show(el);
        }
      }
    });
  }

  function reveal(root = document) {
    const els = root.querySelectorAll("[data-reveal]:not(.in):not([data-observed])");
    els.forEach((el) => {
      el.setAttribute("data-observed", "");
      if (!io) return;
      if (el.hasAttribute("data-stagger")) Array.from(el.children).forEach((c) => (c.style.opacity = "0"));
      else el.style.opacity = "0";
      io.observe(el);
    });
  }
  // Children of staggered containers start hidden; the animation's fill takes over.
  const style = document.createElement("style");
  style.textContent = "[data-reveal][data-stagger] > *{will-change:opacity,transform}";
  document.head.appendChild(style);

  /* ---------- Word-by-word headline reveal ---------- */

  function splitWords(el) {
    if (reduce || el.dataset.split === "done") return;
    el.dataset.split = "done";
    const walk = (node) => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) return frag.appendChild(document.createTextNode(part));
            const outer = document.createElement("span");
            outer.className = "w";
            const inner = document.createElement("span");
            inner.textContent = part;
            outer.appendChild(inner);
            frag.appendChild(outer);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) walk(child);
      }
    };
    walk(el);
    el.querySelectorAll(".w > span").forEach((s, i) => {
      animate(s, [{ transform: "translateY(110%)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 900, delay: 120 + i * 55 });
    });
  }

  /* ---------- Counters (data-count="4.9" data-decimals="1") ---------- */

  function count(el, to, decimals = 0, prefix = "", suffix = "") {
    if (reduce) {
      el.textContent = prefix + Number(to).toFixed(decimals) + suffix;
      return;
    }
    const start = performance.now();
    const dur = 1200;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = prefix + (to * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Parallax (data-parallax="0.15") ---------- */

  const parallaxEls = new Set();
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const vh = innerHeight;
      parallaxEls.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        const speed = Number(el.dataset.parallax) || 0.15;
        const offset = (r.top + r.height / 2 - vh / 2) * -speed;
        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
      });
      const bar = document.querySelector(".scroll-progress");
      if (bar) {
        const max = document.documentElement.scrollHeight - vh;
        bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
      }
    });
  }
  function parallax(root = document) {
    if (reduce) return;
    root.querySelectorAll("[data-parallax]").forEach((el) => parallaxEls.add(el));
    onScroll();
  }

  /* ---------- 3D tilt with glare (data-tilt) ---------- */

  function tilt(root = document) {
    if (reduce || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    root.querySelectorAll("[data-tilt]:not([data-tilt-bound])").forEach((el) => {
      el.setAttribute("data-tilt-bound", "");
      const max = Number(el.dataset.tilt) || 6;
      let raf = 0;
      el.addEventListener("pointermove", (e) => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const r = el.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          el.style.transform = `perspective(900px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg) translateY(-4px)`;
          el.style.setProperty("--gx", `${(x + 0.5) * 100}%`);
          el.style.setProperty("--gy", `${(y + 0.5) * 100}%`);
        });
      });
      el.addEventListener("pointerleave", () => {
        cancelAnimationFrame(raf);
        el.style.transform = "";
      });
    });
  }

  /* ---------- Magnetic buttons (data-magnetic) ---------- */

  function magnetic(root = document) {
    if (reduce || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    root.querySelectorAll("[data-magnetic]:not([data-magnet-bound])").forEach((el) => {
      el.setAttribute("data-magnet-bound", "");
      const strength = Number(el.dataset.magnetic) || 0.25;
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * strength;
        const y = (e.clientY - r.top - r.height / 2) * strength;
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      });
      el.addEventListener("pointerleave", () => {
        animate(el, [{ transform: el.style.transform || "none" }, { transform: "none" }], { duration: 600, easing: spring, fill: "none" });
        el.style.transform = "";
      });
    });
  }

  /* ---------- Fly to cart ---------- */

  function flyToCart(fromEl) {
    const target = document.querySelector(".cart-btn");
    if (reduce || !fromEl || !target) return Promise.resolve();
    const a = fromEl.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const ghost = fromEl.cloneNode(true);
    ghost.removeAttribute("id");
    Object.assign(ghost.style, {
      position: "fixed",
      left: `${a.left}px`,
      top: `${a.top}px`,
      width: `${a.width}px`,
      height: `${a.height}px`,
      margin: 0,
      zIndex: 150,
      pointerEvents: "none",
    });
    ghost.classList.add("fly-ghost");
    document.body.appendChild(ghost);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const anim = ghost.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 90}px) scale(0.6) rotate(-12deg)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.12) rotate(-24deg)`, opacity: 0.2 },
      ],
      { duration: 820, easing: "cubic-bezier(0.5, 0, 0.3, 1)", fill: "forwards" },
    );
    return anim.finished.then(() => {
      ghost.remove();
      target.animate([{ transform: "scale(1)" }, { transform: "scale(1.22)" }, { transform: "scale(1)" }], { duration: 500, easing: spring });
    });
  }

  /* ---------- Page-level wiring ---------- */

  function init(root = document) {
    reveal(root);
    tilt(root);
    magnetic(root);
    parallax(root);
    root.querySelectorAll("[data-split]:not([data-split='done'])").forEach(splitWords);
  }

  if (!reduce) {
    const bar = document.createElement("div");
    bar.className = "scroll-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.prepend(bar);
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll, { passive: true });
    let sweepTimer = 0;
    addEventListener(
      "scroll",
      () => {
        clearTimeout(sweepTimer);
        sweepTimer = setTimeout(sweep, 400);
      },
      { passive: true },
    );
    setTimeout(sweep, 2500);
  }

  // Re-scan when content is rendered dynamically
  const mo = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) init(n.parentElement || document);
  });
  mo.observe(document.body, { childList: true, subtree: true });
  init();

  window.VaramMotion = { animate, reveal, tilt, magnetic, parallax, count, flyToCart, splitWords, init, reduce, EASE, spring };
})();
