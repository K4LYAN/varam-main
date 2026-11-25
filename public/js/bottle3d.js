/* =====================================================================
   Varam — 3D product bottle for the product page (WebGL, three.js r128)
   - Oils: glass bottle, oil inside, red cap with gold band, and the real
     printed wrap-around label (img/labels/…-label.jpg) all the way round.
   - Ghee / honey: glass jar with a drawn Varam label.
   - Drag (mouse or touch) to turn it; it turns slowly on its own.
   - Loads only on product pages. If WebGL or the library is unavailable,
     the flat SVG bottle simply stays visible.
   ===================================================================== */
(function () {
  "use strict";

  const THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
  const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  let threeLoading = null;
  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    threeLoading =
      threeLoading ||
      new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = THREE_URL;
        s.async = true;
        s.crossOrigin = "anonymous";
        s.referrerPolicy = "no-referrer";
        s.onload = () => (window.THREE ? resolve(window.THREE) : reject(new Error("3D library missing")));
        s.onerror = () => reject(new Error("3D library failed to load"));
        document.head.appendChild(s);
      });
    return threeLoading;
  }

  function webglAvailable() {
    try {
      const c = document.createElement("canvas");
      return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      return false;
    }
  }

  /* ---------------- Shapes (radius, height) for LatheGeometry ---------------- */

  /** 1-litre oil bottle: straight body, soft shoulder, narrow neck with a lip. */
  function bottleProfile(T) {
    const V = (r, y) => new T.Vector2(r, y);
    const R = 0.72;
    const B = 1.72; // top of the straight body
    const pts = [V(0, 0), V(R - 0.08, 0), V(R - 0.02, 0.014), V(R, 0.08), V(R, B)];
    for (let i = 1; i <= 18; i++) {
      const t = i / 18;
      pts.push(V(0.215 + (R - 0.215) * (0.5 + 0.5 * Math.cos(Math.PI * t)), B + 0.74 * t));
    }
    pts.push(V(0.215, B + 0.98), V(0.25, B + 1.01), V(0.25, B + 1.07), V(0.22, B + 1.09), V(0.19, B + 1.09));
    return { pts, R, bodyTop: B, fill: B + 0.2, top: B + 1.09, labelCenter: 0.92, capY: B + 1.0 };
  }

  /** Wide glass jar for ghee and honey. */
  function jarProfile(T) {
    const V = (r, y) => new T.Vector2(r, y);
    const R = 0.86;
    const pts = [V(0, 0), V(R - 0.08, 0), V(R - 0.02, 0.014), V(R, 0.08), V(R, 1.5)];
    for (let i = 1; i <= 10; i++) {
      const t = i / 10;
      pts.push(V(0.74 + (R - 0.74) * Math.cos((Math.PI / 2) * t), 1.5 + 0.16 * Math.sin((Math.PI / 2) * t)));
    }
    pts.push(V(0.74, 1.76), V(0.7, 1.78));
    return { pts, R, bodyTop: 1.5, fill: 1.42, top: 1.78, labelCenter: 0.76 };
  }

  /** Inner volume up to the fill level, slightly inside the glass. */
  function contentProfile(T, shape) {
    const inner = [];
    for (const p of shape.pts) {
      if (p.y < 0.05 || p.y > shape.fill) continue;
      inner.push(new T.Vector2(Math.max(0, p.x * 0.955), p.y));
    }
    const rAtFill = inner.length ? inner[inner.length - 1].x : shape.R * 0.95;
    return [new T.Vector2(0, 0.05), ...inner, new T.Vector2(rAtFill, shape.fill), new T.Vector2(0, shape.fill + 0.012)];
  }

  /* ---------------- Textures ---------------- */

  /** Studio-style reflections: a dim room with soft light panels, pre-filtered for glass. */
  function studioEnvironment(T, renderer) {
    const room = new T.Scene();
    const walls = new T.Mesh(new T.BoxGeometry(12, 8, 12), new T.MeshBasicMaterial({ color: 0x120e0a, side: T.BackSide }));
    room.add(walls);
    const panel = (w, h, x, y, z, intensity, ry = 0, rx = 0) => {
      const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(1, 0.97, 0.9).multiplyScalar(intensity), side: T.DoubleSide }));
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, 0);
      room.add(m);
    };
    panel(1.6, 5, -4.5, 1, 1.5, 3.2, Math.PI / 2); // tall soft box left → long highlight on the glass
    panel(1, 4, 4.5, 0.5, -1, 1.8, -Math.PI / 2); // fill right
    panel(5, 2, 0, 3.9, 0, 1.2, 0, Math.PI / 2); // top
    panel(3, 3, 0, 1, -5.9, 0.6); // back glow
    const pmrem = new T.PMREMGenerator(renderer);
    const env = pmrem.fromScene(room, 0.03).texture;
    pmrem.dispose();
    return env;
  }

  function shadowTexture(T) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(128, 128, 8, 128, 128, 128);
    grad.addColorStop(0, "rgba(40,24,10,0.55)");
    grad.addColorStop(0.45, "rgba(40,24,10,0.22)");
    grad.addColorStop(1, "rgba(40,24,10,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return new T.CanvasTexture(c);
  }

  /** Drawn label for products without print artwork (ghee, honey). */
  function drawnLabelTexture(T, product) {
    const c = document.createElement("canvas");
    c.width = 2048;
    c.height = 420;
    const g = c.getContext("2d");
    g.fillStyle = "#fffaf0";
    g.fillRect(0, 0, c.width, c.height);
    const cx = c.width / 2;
    g.strokeStyle = "#B4532A";
    g.lineWidth = 6;
    g.strokeRect(cx - 360, 26, 720, c.height - 52);
    g.textAlign = "center";
    g.fillStyle = "#9A2A1A";
    g.font = "800 112px Georgia, 'Times New Roman', serif";
    g.fillText("VARAM", cx, 150);
    g.fillStyle = "#C98A12";
    g.fillRect(cx - 120, 178, 240, 5);
    const name = String(product.name).replace(/^pure\s+/i, "").toUpperCase();
    g.fillStyle = "#2B1A10";
    g.font = "700 76px Georgia, 'Times New Roman', serif";
    g.fillText(name, cx, 272);
    g.fillStyle = "#6B5A48";
    g.font = "600 34px Arial, sans-serif";
    g.fillText(/honey/i.test(product.name) ? "NATURAL HONEY · VIJAYAWADA" : "TRADITIONAL GHEE · VIJAYAWADA", cx, 336);
    // A small mark on the back of the jar
    g.fillStyle = "#9A2A1A";
    g.font = "700 40px Georgia, serif";
    g.fillText("VARAM", 120, 220);
    g.fillText("VARAM", c.width - 120, 220);
    return new T.CanvasTexture(c);
  }

  function loadTexture(T, url) {
    return new Promise((resolve, reject) => new T.TextureLoader().load(url, resolve, undefined, () => reject(new Error("label image failed"))));
  }

  /* ---------------- Viewer ---------------- */

  /**
   * Mount a 3D bottle inside `host` (the .pdp-media box). Returns { destroy() }.
   * The flat SVG stays visible until the first 3D frame is ready.
   */
  async function mount(host, product) {
    if (!host || !webglAvailable()) return null;
    const T = await loadThree();

    const isJar = /ghee|honey/i.test(product.name);
    const shape = isJar ? jarProfile(T) : bottleProfile(T);
    const tone = /^#[0-9a-f]{6}$/i.test(product.accentColor || "") ? product.accentColor : "#D7A436";
    // Hex colours are sRGB; with sRGB output three.js expects linear material colours
    const col = (hex) => new T.Color(hex).convertSRGBToLinear();

    const labelTex = product.labelFull && !isJar ? await loadTexture(T, product.labelFull) : drawnLabelTexture(T, product);

    const wrap = document.createElement("div");
    wrap.className = "pdp-3d";
    wrap.setAttribute("aria-hidden", "true");
    const hint = document.createElement("span");
    hint.className = "pdp-3d-hint";
    hint.textContent = isJar ? "Drag to turn the jar" : "Drag to turn the bottle — the full label is printed all round";
    wrap.appendChild(hint);

    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.setClearColor(0x000000, 0);
    wrap.insertBefore(renderer.domElement, hint);

    const scene = new T.Scene();
    scene.environment = studioEnvironment(T, renderer);

    const key = new T.DirectionalLight(0xfff4e2, 1.25);
    key.position.set(-3, 5, 4);
    scene.add(key);
    const rim = new T.DirectionalLight(0xffe2b8, 0.8);
    rim.position.set(3.5, 2.5, -3);
    scene.add(rim);
    scene.add(new T.AmbientLight(0xfff2de, 0.38));

    const model = new T.Group();
    scene.add(model);

    // Glass
    const glass = new T.Mesh(
      new T.LatheGeometry(shape.pts, 120),
      new T.MeshPhysicalMaterial({
        color: col("#FFFDF7"),
        metalness: 0,
        roughness: 0.04,
        ior: 1.5,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        envMapIntensity: 0.9,
        transparent: true,
        opacity: 0.1,
        side: T.DoubleSide,
        depthWrite: false,
      }),
    );
    glass.renderOrder = 3;

    // Glass reflections: a mirror-like shell drawn with additive blending, so bright studio
    // panels show as long highlights down the bottle while dark areas stay see-through.
    const sheen = new T.Mesh(
      new T.LatheGeometry(shape.pts.map((p) => new T.Vector2(p.x * 1.002, p.y)), 120),
      new T.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 1,
        roughness: 0.07,
        envMapIntensity: 0.55,
        transparent: true,
        blending: T.AdditiveBlending,
        depthWrite: false,
      }),
    );
    sheen.renderOrder = 4;

    // Oil / ghee / honey inside
    const content = new T.Mesh(
      new T.LatheGeometry(contentProfile(T, shape), 120),
      new T.MeshPhysicalMaterial({
        color: col(tone),
        roughness: isJar && /ghee/i.test(product.name) ? 0.55 : 0.18,
        metalness: 0,
        clearcoat: 0.5,
        clearcoatRoughness: 0.15,
        envMapIntensity: 0.6,
        emissive: col(tone).multiplyScalar(0.05),
      }),
    );

    // Label wrapped round the body (just outside the glass)
    labelTex.encoding = T.sRGBEncoding;
    labelTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const img = labelTex.image || { width: 4, height: 1 };
    const circumference = 2 * Math.PI * (shape.R + 0.006);
    const labelH = Math.min(shape.bodyTop - 0.16, circumference * (img.height / img.width));
    // thetaStart = -π puts the middle of the artwork (logo + product name) at the front
    const label = new T.Mesh(
      new T.CylinderGeometry(shape.R + 0.006, shape.R + 0.006, labelH, 160, 1, true, -Math.PI, Math.PI * 2),
      new T.MeshStandardMaterial({ map: labelTex, roughness: 0.5, metalness: 0, envMapIntensity: 0.8 }),
    );
    label.position.y = shape.labelCenter;
    label.renderOrder = 2;

    // Cap / lid
    const capRed = new T.MeshPhysicalMaterial({ color: col("#A3160F"), roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.18, envMapIntensity: 0.55 });
    const gold = new T.MeshStandardMaterial({ color: col("#D9A021"), roughness: 0.28, metalness: 0.85, envMapIntensity: 1.2 });
    const cap = new T.Group();
    if (isJar) {
      const lid = new T.Mesh(new T.CylinderGeometry(0.79, 0.79, 0.3, 96), capRed);
      lid.position.y = shape.top + 0.12;
      const band = new T.Mesh(new T.CylinderGeometry(0.795, 0.795, 0.06, 96), gold);
      band.position.y = shape.top + 0.0;
      cap.add(lid, band);
    } else {
      const body = new T.Mesh(new T.CylinderGeometry(0.27, 0.28, 0.42, 64), capRed);
      body.position.y = shape.capY + 0.2;
      const top = new T.Mesh(new T.CylinderGeometry(0.25, 0.27, 0.05, 64), capRed);
      top.position.y = shape.capY + 0.435;
      const band = new T.Mesh(new T.CylinderGeometry(0.285, 0.285, 0.07, 64), gold);
      band.position.y = shape.capY - 0.02;
      cap.add(body, top, band);
    }

    // Soft contact shadow
    const shadow = new T.Mesh(
      new T.PlaneGeometry(shape.R * 4.2, shape.R * 4.2),
      new T.MeshBasicMaterial({ map: shadowTexture(T), transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.002;

    model.add(content, label, glass, sheen, cap);
    scene.add(shadow);

    // Frame the object
    const height = (isJar ? shape.top + 0.3 : shape.capY + 0.46) + 0.1;
    const camera = new T.PerspectiveCamera(26, 1, 0.1, 100);
    const target = new T.Vector3(0, height * 0.47, 0);
    function frame() {
      const w = wrap.clientWidth || 1;
      const h = wrap.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const fitH = height * 1.28;
      const fitW = (shape.R * 2.6) / camera.aspect;
      const dist = Math.max(fitH, fitW) / (2 * Math.tan((camera.fov * Math.PI) / 360));
      camera.position.set(0, target.y + dist * 0.16, dist);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
    }

    /* ---- Interaction: drag to turn, gentle idle spin ---- */
    let yaw = 0;
    let pitch = 0;
    let velocity = 0;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let lastInteract = performance.now() + 1500; // show the front first, then start the slow spin
    const canvas = renderer.domElement;
    canvas.addEventListener("pointerdown", (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      lastInteract = performance.now();
      canvas.setPointerCapture?.(e.pointerId);
      hint.classList.add("gone");
      wrap.classList.add("grabbing");
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      velocity = dx * 0.012;
      yaw += velocity;
      pitch = Math.max(-0.22, Math.min(0.22, pitch + dy * 0.004));
      lastInteract = performance.now();
      wake();
    });
    const release = () => {
      dragging = false;
      lastInteract = performance.now();
      wrap.classList.remove("grabbing");
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("dblclick", () => {
      yaw = 0;
      pitch = 0;
      velocity = 0;
      wake();
    });

    /* ---- Render loop (paused when off-screen or tab hidden) ---- */
    let raf = 0;
    let visible = true;
    let last = performance.now();
    let alive = true;
    function tick(now) {
      raf = 0;
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!dragging) {
        velocity *= Math.pow(0.04, dt); // inertia after a flick
        yaw += velocity;
        pitch *= Math.pow(0.2, dt);
        const idle = now - lastInteract > 2500;
        if (idle && !reduceMotion) yaw += dt * 0.32;
      }
      model.rotation.set(pitch, yaw, 0);
      renderer.render(scene, camera);
      const moving = dragging || Math.abs(velocity) > 0.0005 || Math.abs(pitch) > 0.001 || !reduceMotion;
      if (visible && moving && !document.hidden) raf = requestAnimationFrame(tick);
    }
    function wake() {
      if (!raf && alive) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    }

    const io = "IntersectionObserver" in window ? new IntersectionObserver(([e]) => ((visible = e.isIntersecting), visible && wake())) : null;
    io?.observe(wrap);
    const ro = "ResizeObserver" in window ? new ResizeObserver(() => (frame(), wake())) : null;
    ro?.observe(wrap);
    const onVis = () => !document.hidden && wake();
    document.addEventListener("visibilitychange", onVis);

    host.appendChild(wrap);
    frame();
    renderer.render(scene, camera);
    host.classList.add("has-3d");
    requestAnimationFrame(() => wrap.classList.add("ready"));
    wake();
    if (reduceMotion) setTimeout(() => hint.classList.add("gone"), 4000);

    return {
      destroy() {
        alive = false;
        if (raf) cancelAnimationFrame(raf);
        io?.disconnect();
        ro?.disconnect();
        document.removeEventListener("visibilitychange", onVis);
        scene.traverse((o) => {
          o.geometry?.dispose();
          const m = o.material;
          if (m) (Array.isArray(m) ? m : [m]).forEach((x) => (x.map?.dispose(), x.dispose()));
        });
        scene.environment?.dispose();
        renderer.dispose();
        wrap.remove();
        host.classList.remove("has-3d");
      },
    };
  }

  window.VaramBottle3D = { mount };
})();
