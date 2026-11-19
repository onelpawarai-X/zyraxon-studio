/* NOCTURNE — a generative light studio.
   One canvas, one field. No assets, no network calls. */

(() => {
  "use strict";

  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const panel = document.getElementById("panel");
  const hero = document.getElementById("hero");
  const toastEl = document.getElementById("toast");
  const statusWrap = document.querySelector(".status");
  const statusText = document.getElementById("statusText");
  const aurora = document.querySelector(".aurora");

  const PALETTES = {
    ember: ["#ffe9b0", "#ffb03a", "#ff6b3d", "#ff2e63"],
    tidal: ["#d8f6ff", "#6ad0ff", "#4b7bff", "#8a5cff"],
    bloom: ["#ffe3f1", "#ff9ecb", "#ff5c9e", "#b13cff"],
    moss: ["#f2ffd6", "#b6f36a", "#48d59a", "#1a9e8f"],
    bone: ["#ffffff", "#e8dfcd", "#b8a88c", "#6e6555"],
  };

  const MOODS = {
    calm: { mode: "flow", speed: 34, density: 46, trail: 94, palette: "tidal" },
    storm: { mode: "silk", speed: 170, density: 88, trail: 72, palette: "ember" },
    bloom: { mode: "orbits", speed: 62, density: 58, trail: 76, palette: "bloom" },
    drift: { mode: "flow", speed: 22, density: 34, trail: 96, palette: "moss" },
  };

  const state = {
    mode: "flow",
    palette: "ember",
    density: 62,
    speed: 60,
    trail: 88,
    paused: false,
    colors: PALETTES.ember.map(hexToRgb),
  };

  /* ---------- value noise ---------- */
  const PERM = new Uint8Array(512);
  (() => {
    let seed = 20261119;
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const j = seed % (i + 1);
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
    for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  })();

  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  const grad = (h, x, y) => {
    switch (h & 3) {
      case 0: return x + y;
      case 1: return -x + y;
      case 2: return x - y;
      default: return -x - y;
    }
  };

  function noise2(x, y) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const aa = PERM[PERM[xi] + yi];
    const ab = PERM[PERM[xi] + yi + 1];
    const ba = PERM[PERM[xi + 1] + yi];
    const bb = PERM[PERM[xi + 1] + yi + 1];
    return lerp(
      lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
      lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
      v
    );
  }

  // stream function; the flow is its curl, so particles never pile up in sinks
  function stream(x, y, t) {
    return (
      noise2(x * 0.0021 + t * 0.00013, y * 0.0021 - t * 0.0001) +
      noise2(x * 0.0062 - t * 0.00021, y * 0.0062 + t * 0.00017) * 0.42
    );
  }

  const CURL_H = 1.6;
  const curl = { x: 0, y: 0 };

  function flow(x, y, t) {
    curl.x = (stream(x, y + CURL_H, t) - stream(x, y - CURL_H, t)) / (2 * CURL_H);
    curl.y = -(stream(x + CURL_H, y, t) - stream(x - CURL_H, y, t)) / (2 * CURL_H);
    return curl;
  }

  /* ---------- the field ---------- */
  const P_STRIDE = 9; // x, y, vx, vy, tint, a, e, phase, theta
  let W = 0, H = 0, dpr = 1;
  let particles = new Float32Array(0);
  let count = 0, cap = 0;
  let time = 0;
  let segBuf = [];
  let segLen = [];
  let quality = 1;

  function targetCount() {
    const area = W * H;
    const base = Math.min(9000, Math.max(1100, area / 250));
    return Math.round(base * (state.density / 100) * quality);
  }

  function alloc(n) {
    const next = new Float32Array(n * P_STRIDE);
    for (let i = 0; i < n; i++) {
      const o = i * P_STRIDE;
      next[o] = Math.random() * W;
      next[o + 1] = Math.random() * H;
      next[o + 4] = Math.random();
      next[o + 5] = 0.08 + Math.random() * 0.92;
      next[o + 6] = 0.15 + Math.random() * 0.55;
      next[o + 7] = Math.random() * Math.PI;
      next[o + 8] = Math.random() * Math.PI * 2;
    }
    particles = next;
    count = n;
    cap = n;
  }

  function syncCount() {
    const want = targetCount();
    if (want > cap) {
      const old = particles;
      const oldN = count;
      alloc(want);
      particles.set(old.subarray(0, oldN * P_STRIDE));
    }
    count = Math.min(want, cap);
    if (!segBuf.length || segBuf[0].length < cap * 4) {
      segBuf = state.colors.map(() => new Float32Array(cap * 4));
      segLen = state.colors.map(() => 0);
    }
  }

  function resize() {
    // keep the painted surface near a fixed pixel budget: the field is soft
    // light, so extra resolution buys nothing and costs frames
    const budget = 1_500_000;
    const wanted = Math.min(window.devicePixelRatio || 1, 1.5);
    dpr = Math.max(0.75, Math.min(wanted, Math.sqrt(budget / (window.innerWidth * window.innerHeight))));
    W = Math.floor(window.innerWidth);
    H = Math.floor(window.innerHeight);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!cap) alloc(targetCount());
    syncCount();
  }

  /* ---------- pointer ---------- */
  const pointer = { x: 0, y: 0, px: 0, py: 0, active: false, moved: false };
  const shock = { x: 0, y: 0, t: -1 };

  function pointerPos(e) {
    pointer.px = pointer.x;
    pointer.py = pointer.y;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.active = true;
    if (!pointer.moved) {
      pointer.px = pointer.x;
      pointer.py = pointer.y;
    }
  }

  let idleTimer = 0;
  function touchHero() {
    hero.classList.add("is-quiet");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => hero.classList.remove("is-quiet"), 4200);
  }

  const cursorEl = document.getElementById("cursor");
  let cursorRaf = 0;

  function moveCursor(x, y) {
    if (cursorRaf) return;
    cursorRaf = requestAnimationFrame(() => {
      cursorEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      cursorRaf = 0;
    });
  }

  window.addEventListener("pointermove", (e) => {
    document.body.classList.add("has-pointer");
    moveCursor(e.clientX, e.clientY);
  });

  window.addEventListener("pointerdown", (e) => {
    document.body.classList.add("has-pointer");
    moveCursor(e.clientX, e.clientY);
  });

  canvas.addEventListener("pointermove", (e) => {
    pointerPos(e);
    if (!pointer.moved) {
      pointer.moved = true;
      touchHero();
    }
  });

  canvas.addEventListener("pointerdown", (e) => {
    pointerPos(e);
    pointer.moved = true;
    touchHero();
    shock.x = e.clientX;
    shock.y = e.clientY;
    shock.t = 0;
  });

  canvas.addEventListener("pointerleave", () => {
    pointer.active = false;
  });

  /* ---------- simulation ---------- */
  function step(dt) {
    const sp = (state.speed / 100) * 1.35;
    const c = state.colors;
    const buckets = c.length;
    const p = particles;
    const mode = state.mode;

    if (shock.t >= 0) shock.t += dt * 0.0016;
    if (shock.t > 1.4) shock.t = -1;
    segLen.fill(0);

    const px0 = pointer.x;
    const py0 = pointer.y;
    const hasPointer = pointer.active;
    const dragX = pointer.x - pointer.px;
    const dragY = pointer.y - pointer.py;
    const tail = Math.min(12, 4 + sp * 5);

    for (let i = 0; i < count; i++) {
      const o = i * P_STRIDE;
      let x = p[o];
      let y = p[o + 1];
      let vx = p[o + 2];
      let vy = p[o + 3];
      const tint = p[o + 4];
      const life = 0.45 + tint * 0.75;

      if (mode === "orbits") {
        const cx = W * 0.5 + Math.cos(time * 0.00021) * W * 0.1;
        const cy = H * 0.5 + Math.sin(time * 0.00027) * H * 0.1;
        const a = p[o + 5] * Math.min(W, H) * 0.44;
        const e = p[o + 6];
        const phi = p[o + 7];
        // Kepler: inner ellipses sweep faster, so the web never settles
        p[o + 8] += dt * 0.00042 * (0.35 + sp) / (a / 90 + 0.35);
        const th = p[o + 8];
        const cos = Math.cos(th);
        const sin = Math.sin(th);
        const ex = a * cos - a * e;
        const ey = a * Math.sqrt(1 - e * e) * sin;
        const rot = Math.cos(phi);
        const rotS = Math.sin(phi);
        const gx = cx + ex * rot - ey * rotS;
        const gy = cy + ex * rotS + ey * rot;
        vx += (gx - x) * 0.0026;
        vy += (gy - y) * 0.0026;
      } else {
        const f = flow(x, y, time);
        const mag = mode === "silk" ? 1.7 : 1.25;
        vx += f.x * sp * mag * 2.6 * life;
        vy += f.y * sp * mag * 2.6 * life;
      }

      if (hasPointer) {
        const dx = x - px0;
        const dy = y - py0;
        const d2 = dx * dx + dy * dy;
        const R = 230;
        if (d2 < R * R) {
          const d = Math.sqrt(d2) + 0.001;
          const f = (1 - d / R) ** 2;
          vx += (-dy / d) * f * 3.4 * sp + dragX * f * 0.1;
          vy += (dx / d) * f * 3.4 * sp + dragY * f * 0.1;
          vx += (dx / d) * f * 0.8;
          vy += (dy / d) * f * 0.8;
        }
      }

      if (shock.t >= 0) {
        const dx = x - shock.x;
        const dy = y - shock.y;
        const d = Math.hypot(dx, dy) + 0.001;
        const ring = shock.t * 560;
        const band = Math.exp(-((d - ring) ** 2) / 6000);
        const f = band * (1 - shock.t / 1.4);
        vx += (dx / d) * f * 8;
        vy += (dy / d) * f * 8;
      }

      vx *= 0.9;
      vy *= 0.9;
      p[o + 2] = vx;
      p[o + 3] = vy;

      let nx = x + vx * dt * 0.06;
      let ny = y + vy * dt * 0.06;

      if (nx < -70) nx = W + 70;
      else if (nx > W + 70) nx = -70;
      if (ny < -70) ny = H + 70;
      else if (ny > H + 70) ny = -70;

      p[o] = nx;
      p[o + 1] = ny;

      const bi = Math.min(buckets - 1, (tint * buckets) | 0);
      const buf = segBuf[bi];
      const at = segLen[bi];
      if (at + 4 <= buf.length) {
        buf[at] = nx - vx * tail;
        buf[at + 1] = ny - vy * tail;
        buf[at + 2] = nx;
        buf[at + 3] = ny;
        segLen[bi] = at + 4;
      }
    }

    // fade towards transparency so the aurora glows through the strokes
    const keep = state.trail / 100;
    const alpha = Math.max(0.02, (1 - keep) * 0.62 + 0.02);
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(0, 0, W, H);

    ctx.lineCap = "round";
    // layered strokes in normal blending: the halo widens without ever
    // stacking to white, which additive blending always does at long trails
    ctx.globalCompositeOperation = "source-over";
    // each mode spreads light differently: orbits overlap heavily, currents
    // do not, so the currents need a brighter strand to read the same
    const modeGain = state.mode === "orbits" ? 1 : state.mode === "silk" ? 1.9 : 2.4;
    const budget = Math.min(1.4, Math.sqrt(1100 / Math.max(1, count))) * modeGain;
    const layers = [
      [10, 0.055],
      [4.4, 0.115],
      [1.35, 0.5],
    ];
    for (let l = 0; l < layers.length; l++) {
      const width = layers[l][0];
      const alpha = layers[l][1] * budget;
      for (let b = 0; b < buckets; b++) {
        const n = segLen[b];
        if (!n) continue;
        const seg = segBuf[b];
        const col = c[b];
        const step = width > 4 ? 12 : 4;
        ctx.beginPath();
        for (let k = 0; k < n; k += step) {
          ctx.moveTo(seg[k], seg[k + 1]);
          ctx.lineTo(seg[k + 2], seg[k + 3]);
        }
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha})`;
        ctx.lineWidth = width;
        ctx.stroke();
      }
    }
    pointer.px = pointer.x;
    pointer.py = pointer.y;
    time += dt;
  }

  /* ---------- loop ---------- */
  let last = performance.now();
  let smoothDt = 16;

  function frame(now) {
    const dt = Math.min(48, now - last);
    last = now;
    if (!state.paused && !document.hidden) {
      step(dt);
      smoothDt = smoothDt * 0.9 + dt * 0.1;
      if (smoothDt > 34 && quality > 0.5) {
        quality = 0.5;
        syncCount();
      } else if (smoothDt < 22 && quality < 1) {
        quality = 1;
        syncCount();
      }
    }
    requestAnimationFrame(frame);
  }

  /* ---------- helpers ---------- */
  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }

  let toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), 2100);
  }

  function fill(range) {
    const min = Number(range.min);
    const max = Number(range.max);
    const pct = ((Number(range.value) - min) / (max - min)) * 100;
    range.style.setProperty("--fill", pct + "%");
  }

  /* ---------- palettes ---------- */
  const swatchWrap = document.getElementById("swatches");

  Object.entries(PALETTES).forEach(([key, colors]) => {
    const btn = document.createElement("button");
    btn.className = "swatch" + (key === state.palette ? " is-active" : "");
    btn.dataset.palette = key;
    btn.title = key;
    btn.setAttribute("aria-label", key + " palette");
    btn.style.background = `linear-gradient(135deg, ${colors.join(", ")})`;
    btn.addEventListener("click", () => setPalette(key));
    swatchWrap.appendChild(btn);
  });

  function setPalette(key) {
    state.palette = key;
    state.colors = PALETTES[key].map(hexToRgb);
    swatchWrap.querySelectorAll(".swatch").forEach((el) => {
      el.classList.toggle("is-active", el.dataset.palette === key);
    });
    const [a, b, c, d] = PALETTES[key];
    const root = document.documentElement.style;
    aurora.style.setProperty("--a", a);
    aurora.style.setProperty("--b", b);
    aurora.style.setProperty("--c", c);
    aurora.style.setProperty("--d", d);
    root.setProperty("--accent", b);
    root.setProperty("--hot", d);
    root.setProperty("--cool", c);
  }

  /* ---------- sliders ---------- */
  const density = document.getElementById("density");
  const speed = document.getElementById("speed");
  const trail = document.getElementById("trail");
  const densityOut = document.getElementById("densityOut");
  const speedOut = document.getElementById("speedOut");
  const trailOut = document.getElementById("trailOut");

  function bindSlider(range, out, apply) {
    const run = () => {
      apply(Number(range.value));
      out.textContent = range.value + "%";
      fill(range);
    };
    range.addEventListener("input", run);
    run();
  }

  bindSlider(density, densityOut, (v) => {
    state.density = v;
    syncCount();
  });
  bindSlider(speed, speedOut, (v) => {
    state.speed = v;
  });
  bindSlider(trail, trailOut, (v) => {
    state.trail = v;
  });

  function syncSliders() {
    [
      [density, densityOut],
      [speed, speedOut],
      [trail, trailOut],
    ].forEach(([range, out]) => {
      out.textContent = range.value + "%";
      fill(range);
    });
  }

  /* ---------- modes ---------- */
  document.querySelectorAll(".segmented button").forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll(".segmented button").forEach((el) => {
      const on = el.dataset.mode === mode;
      el.classList.toggle("is-active", on);
      el.setAttribute("aria-pressed", String(on));
    });
  }

  /* ---------- moods ---------- */
  const moodWrap = document.getElementById("moods");

  moodWrap.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mood = MOODS[btn.dataset.mood];
      if (!mood) return;
      setMode(mood.mode);
      setPalette(mood.palette);
      density.value = mood.density;
      speed.value = mood.speed;
      trail.value = mood.trail;
      density.dispatchEvent(new Event("input"));
      speed.dispatchEvent(new Event("input"));
      trail.dispatchEvent(new Event("input"));
      moodWrap.querySelectorAll("button").forEach((el) => el.classList.remove("is-active"));
      btn.classList.add("is-active");
      toast(btn.textContent + " mood");
    });
  });

  /* ---------- pause + panel ---------- */
  const pauseBtn = document.getElementById("pauseBtn");
  const pauseLabel = document.getElementById("pauseLabel");

  function setPaused(next) {
    state.paused = next;
    pauseBtn.setAttribute("aria-pressed", String(next));
    pauseLabel.textContent = next ? "Resume" : "Pause";
    statusWrap.classList.toggle("is-paused", next);
    statusText.textContent = next ? "paused" : "live";
  }

  pauseBtn.addEventListener("click", () => setPaused(!state.paused));

  const panelToggle = document.getElementById("panelToggle");
  const panelClose = document.getElementById("panelClose");
  const narrow = window.matchMedia("(max-width: 880px)");

  function setPanel(open) {
    panel.classList.toggle("is-hidden", !open);
    panelToggle.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("panel-open", open && narrow.matches);
  }

  panelToggle.addEventListener("click", () => setPanel(panel.classList.contains("is-hidden")));
  panelClose.addEventListener("click", () => setPanel(false));

  /* ---------- save ---------- */
  const saveBtn = document.getElementById("saveBtn");

  function compose() {
    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    const g = out.getContext("2d");
    const w = out.width;
    const h = out.height;

    g.fillStyle = "#07070a";
    g.fillRect(0, 0, w, h);

    const tint = state.colors[1];
    const glow = g.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, Math.max(w, h) * 0.62);
    glow.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},0.18)`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);

    g.globalCompositeOperation = "lighter";
    g.drawImage(canvas, 0, 0);
    g.globalCompositeOperation = "source-over";

    const vig = g.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.2, w / 2, h * 0.5, Math.max(w, h) * 0.78);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(3,3,6,0.84)");
    g.fillStyle = vig;
    g.fillRect(0, 0, w, h);

    const scale = Math.max(1, w / 1200);
    g.font = `${11 * scale}px "IBM Plex Mono", monospace`;
    g.fillStyle = "rgba(244,241,234,0.42)";
    g.textAlign = "right";
    g.fillText("NOCTURNE", w - 26 * scale, h - 24 * scale);
    return out;
  }

  function save() {
    const out = compose();
    out.toBlob((blob) => {
      if (!blob) return toast("could not save");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.href = url;
      a.download = `nocturne-${stamp}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      addThumb(out);
      toast("image saved");
    }, "image/png");
  }

  /* ---------- the shelf of kept pieces ---------- */
  const gallery = document.getElementById("gallery");
  const galleryEmpty = document.getElementById("galleryEmpty");
  const KEPT = 6;

  function addThumb(source) {
    if (!gallery || !galleryEmpty) return;
    const small = document.createElement("canvas");
    const scale = 240 / source.width;
    small.width = 240;
    small.height = Math.round(source.height * scale);
    small.getContext("2d").drawImage(source, 0, 0, small.width, small.height);

    const btn = document.createElement("button");
    btn.className = "thumb";
    btn.type = "button";
    btn.title = "Open full size";
    const img = document.createElement("img");
    img.alt = "Your saved piece";
    img.src = small.toDataURL("image/jpeg", 0.72);
    btn.appendChild(img);
    btn.addEventListener("click", () => {
      source.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener");
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }, "image/png");
    });

    gallery.prepend(btn);
    while (gallery.querySelectorAll(".thumb").length > KEPT) {
      gallery.querySelector(".thumb:last-of-type").remove();
    }
    galleryEmpty.hidden = true;
  }

  saveBtn.addEventListener("click", save);

  /* ---------- immersive ---------- */
  const immersiveBtn = document.getElementById("immersiveBtn");

  function setImmersive(on) {
    document.body.classList.toggle("immersive", on);
    immersiveBtn.setAttribute("aria-pressed", String(on));
    if (on && !panel.classList.contains("is-hidden")) setPanel(false);
  }

  immersiveBtn.addEventListener("click", () =>
    setImmersive(!document.body.classList.contains("immersive"))
  );

  /* ---------- surprise ---------- */
  const MOOD_KEYS = Object.keys(MOODS);
  const PALETTE_KEYS = Object.keys(PALETTES);

  function surprise() {
    const mood = MOODS[MOOD_KEYS[(Math.random() * MOOD_KEYS.length) | 0]];
    const palette = PALETTE_KEYS[(Math.random() * PALETTE_KEYS.length) | 0];
    setMode(mood.mode);
    setPalette(palette);
    state.speed = mood.speed + Math.round((Math.random() - 0.5) * 30);
    state.density = mood.density + Math.round((Math.random() - 0.5) * 20);
    state.trail = mood.trail;
    speed.value = state.speed;
    density.value = state.density;
    trail.value = state.trail;
    syncSliders();
    syncCount();
    document.querySelectorAll("#moods .pills button").forEach((b) => b.classList.remove("is-active"));
    toast(`${palette} / ${mood.mode}`);
    remember();
  }

  document.getElementById("surpriseBtn").addEventListener("click", surprise);

  /* ---------- keyboard ---------- */
  window.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement) return;
    const k = e.key.toLowerCase();
    if (k === " ") {
      e.preventDefault();
      setPaused(!state.paused);
    } else if (k === "s") {
      save();
    } else if (k === "h") {
      hero.classList.toggle("is-quiet");
    } else if (k === "p") {
      setPanel(panel.classList.contains("is-hidden"));
    } else if (k === "i") {
      setImmersive(!document.body.classList.contains("immersive"));
    } else if (k === "escape") {
      setImmersive(false);
    }
  });

  /* ---------- remembered settings ---------- */
  const STORE = "nocturne.settings.v1";

  // read the controls themselves: the panel listener runs in the capture
  // phase, before the control's own handler has touched `state`
  function remember() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        mode: document.querySelector(".segmented .is-active")?.dataset.mode || state.mode,
        palette: document.querySelector(".swatch.is-active")?.dataset.palette || state.palette,
        density: Number(density.value),
        speed: Number(speed.value),
        trail: Number(trail.value),
      }));
    } catch (err) { /* storage can be blocked; the studio still works */ }
  }

  function restore() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORE) || "null");
    } catch (err) {
      saved = null;
    }
    if (!saved || !PALETTES[saved.palette]) return;
    setMode(saved.mode === "orbits" || saved.mode === "silk" ? saved.mode : "flow");
    setPalette(saved.palette);
    density.value = saved.density ?? density.value;
    speed.value = saved.speed ?? speed.value;
    trail.value = saved.trail ?? trail.value;
    density.dispatchEvent(new Event("input"));
    speed.dispatchEvent(new Event("input"));
    trail.dispatchEvent(new Event("input"));
  }

  /* ---------- boot ---------- */
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    last = performance.now();
  });

  setPalette("ember");
  restore();
  ["change", "input", "click"].forEach((evt) =>
    panel.addEventListener(evt, remember, true)
  );
  if (narrow.matches) setPanel(false);
  narrow.addEventListener("change", (e) => {
    setPanel(!e.matches);
  });
  resize();
  for (let i = 0; i < 140; i++) step(16);
  requestAnimationFrame(frame);
})();
