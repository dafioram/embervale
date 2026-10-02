/* Zone atmosphere: drifting particles, wind sway, cloud shadows, mist, light shafts,
   wall torches and a colour grade per zone theme. Everything is drawn in code on top
   of the normal renderer. The "Zone atmosphere" setting switches all of it off.

   Kept cheap so it runs well in every browser:
   - soft glows and blobs are painted once into small images and reused every frame;
   - the colour grade and light shafts are separate page layers that the browser
     blends on the graphics chip, instead of full-screen blends on the game canvas. */
G.atmos = (() => {
  const A = { t: 0, parts: [], torches: [], theme: 'meadow', wind: 0 };
  const TAU = Math.PI * 2;
  const iso = (x, y) => [(x - y) * 32, (x + y) * 16];
  const toW = (ix, iy) => ({ x: (ix / 32 + iy / 16) / 2, y: (iy / 16 - ix / 32) / 2 });
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* Per-theme recipe: which particles, how many per screen, and the colour grade. */
  const CFG = {
    village: { kinds: { pollen: 26, butterfly: 3 }, clouds: true, grade: [['soft-light', 'rgba(255,200,120,0.28)'], ['screen', 'rgba(255,230,170,0.05)']], wind: 0.6 },
    meadow: { kinds: { pollen: 46, butterfly: 9 }, clouds: true, grade: [['soft-light', 'rgba(255,205,120,0.30)'], ['screen', 'rgba(255,235,180,0.05)']], wind: 0.8 },
    forest: { kinds: { firefly: 35, leaf: 30, mote: 24 }, rays: true, mist: 8, dapple: 16, grade: [['multiply', 'rgba(170,205,185,0.55)'], ['soft-light', 'rgba(40,110,90,0.35)']], wind: 0.45 },
    swamp: { kinds: { midge: 80, rain: 170 }, mist: 18, grade: [['multiply', 'rgba(165,190,160,0.6)'], ['soft-light', 'rgba(60,110,80,0.4)']], wind: 0.3 },
    cave: { kinds: { ember: 46, ash: 40 }, torches: '#ff9a3a', grade: [['soft-light', 'rgba(255,110,40,0.32)'], ['multiply', 'rgba(230,200,190,0.6)']], wind: 0.1 },
    deep: { kinds: { mote: 50 }, torches: '#7fd8ff', grade: [['soft-light', 'rgba(80,120,255,0.3)']], wind: 0.05 },
  };
  const cfg = () => CFG[A.theme] || CFG.meadow;

  /* ---------------- reusable soft sprites ---------------- */
  const sprites = new Map();
  // A radial glow painted once: stops are [offset, 'r,g,b', alpha].
  function glow(key, stops, size = 64) {
    if (sprites.has(key)) return sprites.get(key);
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d'), h = size / 2, g = x.createRadialGradient(h, h, 0, h, h, h);
    for (const [o, rgb, a] of stops) g.addColorStop(o, `rgba(${rgb},${a})`);
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    sprites.set(key, c);
    return c;
  }
  // Draw a sprite as an ellipse with radii rx, ry around (cx, cy).
  function blob(ctx, img, cx, cy, rx, ry, alpha) {
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, cx - rx, cy - ry, rx * 2, ry * 2);
    ctx.globalAlpha = 1;
  }
  const rgbOf = (h) => { const n = parseInt(h.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };
  const SPR = {
    cloud: () => glow('cloud', [[0, '20,30,40', 0.24], [0.6, '20,30,40', 0.15], [1, '20,30,40', 0]], 128),
    mist: () => glow('mist', [[0, '220,235,225', 1], [1, '220,235,225', 0]], 128),
    dapple: () => glow('dapple', [[0, '255,240,170', 1], [1, '255,240,170', 0]], 96),
    firefly: () => glow('firefly', [[0, '230,255,140', 0.7], [0.4, '200,255,120', 0.25], [1, '230,255,140', 0]]),
    ember: () => glow('ember', [[0, '255,170,60', 0.6], [1, '255,90,20', 0]], 32),
    flame: (col) => glow('flame' + col, [[0, rgbOf(col), 0.5], [1, rgbOf(col), 0]]),
    torchLight: (col) => glow('tl' + col, [[0, rgbOf(col), 0.26], [0.5, rgbOf(col), 0.09], [1, rgbOf(col), 0]], 128),
  };

  /* ---------------- page layers: light shafts and the colour grade ---------------- */
  const L = { rays: null, rx: null, grades: [], key: '' };
  function init(canvas) {
    L.rays = document.createElement('canvas'); L.rays.id = 'view-rays'; L.rays.style.display = 'none';
    L.rx = L.rays.getContext('2d');
    L.grades = [0, 1].map(() => { const d = document.createElement('div'); d.className = 'grade-layer'; d.style.display = 'none'; return d; });
    canvas.after(L.rays, ...L.grades);
  }
  function resize(W, H) {
    if (!L.rays) return;
    // light shafts are soft, so half resolution is plenty
    L.rays.width = Math.ceil(W / 2); L.rays.height = Math.ceil(H / 2);
  }
  function setLayers(on) {
    const c = cfg(), key = on ? A.theme : 'off';
    if (key !== L.key) {
      L.key = key;
      const grade = on ? c.grade || [] : [];
      L.grades.forEach((d, i) => {
        const g = grade[i];
        d.style.display = g ? 'block' : 'none';
        if (g) { d.style.mixBlendMode = g[0]; d.style.background = g[1]; }
      });
    }
    if (L.rays) L.rays.style.display = on && c.rays ? 'block' : 'none';
  }

  /* ---------------- zone setup: torches along cave walls ---------------- */
  function zone(grid, Z) {
    A.theme = Z.theme; A.parts = []; A.torches = []; A.seeded = false;
    A.clouds = Array.from({ length: 6 }, (_, i) => ({ x: rnd(0, grid.w), y: rnd(0, grid.h), r: rnd(5, 9), s: rnd(0.6, 1) }));
    A.mists = [];
    if (cfg().torches) {
      const wall = new Set(grid.props.filter((p) => p.kind === 'cavewall').map((p) => p.x + ',' + p.y));
      const r = G.util.rng(Z.seed + 99);
      for (let y = 1; y < grid.h - 1; y++) for (let x = 1; x < grid.w - 1; x++) {
        if (!grid.walk(x, y)) continue;
        // a torch stands on floor right in front of a wall to its north or west (so it reads against the wall)
        if (!(wall.has(x + ',' + (y - 1)) || wall.has(x - 1 + ',' + y))) continue;
        if (r() > 0.5) continue;
        if (A.torches.some((t) => Math.abs(t.x - x) + Math.abs(t.y - y) < 9)) continue;
        const t = { kind: 'torch', x: x + 0.5, y: y + 0.5, depth: x + y + 1.2, ph: r() * 10 };
        A.torches.push(t); grid.props.push(t);
      }
    }
  }

  /* ---------------- particles ---------------- */
  function spawn(kind, b, anywhere) {
    const ix = rnd(b[0], b[1]), iy = rnd(b[2], b[3]);
    const w = toW(ix, iy);
    const p = { kind, x: w.x, y: w.y, z: 0, t: 0, life: 6, ph: Math.random() * TAU, vx: 0, vy: 0, vz: 0 };
    switch (kind) {
      case 'pollen': p.z = rnd(8, 70); p.life = rnd(6, 12); p.size = rnd(1, 1.8); break;
      case 'butterfly': p.z = rnd(14, 40); p.life = rnd(10, 18); p.col = ['#fff6d0', '#ffd84a', '#f5a3c7', '#a3c4f5'][Math.floor(Math.random() * 4)]; break;
      case 'firefly': p.z = rnd(6, 34); p.life = rnd(5, 10); break;
      case 'leaf': p.z = anywhere ? rnd(0, 140) : rnd(110, 160); p.life = 14; p.rot = rnd(0, TAU); p.col = ['#c8862a', '#d9a23a', '#8aa840', '#b85a2a'][Math.floor(Math.random() * 4)]; break;
      case 'mote': p.z = rnd(10, 90); p.life = rnd(6, 12); break;
      case 'midge': p.z = rnd(12, 30); p.life = rnd(8, 14); p.cx = p.x; p.cy = p.y; break;
      case 'rain': p.z = anywhere ? rnd(0, 260) : rnd(220, 300); p.life = 3; break;
      case 'ember': p.z = anywhere ? rnd(0, 120) : rnd(0, 8); p.life = rnd(3, 6); p.vz = rnd(14, 30); break;
      case 'ash': p.z = anywhere ? rnd(0, 150) : rnd(120, 170); p.life = 12; p.size = rnd(1.2, 2.4); break;
    }
    if (anywhere) p.t = Math.random() * p.life * 0.8;
    return p;
  }
  // Torches throw extra embers upward.
  function torchEmber(t) { const p = spawn('ember', [0, 0, 0, 0]); p.x = t.x + rnd(-0.1, 0.1); p.y = t.y + rnd(-0.1, 0.1); p.z = 30; p.vz = rnd(20, 40); p.life = rnd(1.2, 2.4); return p; }

  function update(dt, b) {
    const c = cfg();
    A.wind = Math.sin(A.t * 0.35) * 0.6 + Math.sin(A.t * 0.13) * 0.4;
    const area = ((b[1] - b[0]) * (b[3] - b[2])) / (1200 * 700);
    for (const kind in c.kinds) {
      const want = Math.round(c.kinds[kind] * area);
      let have = 0; for (const p of A.parts) if (p.kind === kind) have++;
      for (let i = have; i < want; i++) A.parts.push(spawn(kind, b, !A.seeded));
    }
    if (c.torches) for (const t of A.torches) if (Math.random() < dt * 3) A.parts.push(torchEmber(t));
    A.seeded = true;
    const w = A.wind * (c.wind || 0.5);
    for (const p of A.parts) {
      p.t += dt;
      switch (p.kind) {
        case 'pollen': p.x += (w * 0.6 + Math.sin(p.t + p.ph) * 0.15) * dt; p.y += (-w * 0.3) * dt; p.z += Math.sin(p.t * 1.3 + p.ph) * 6 * dt; break;
        case 'butterfly': p.x += Math.cos(p.t * 0.4 + p.ph) * 0.9 * dt; p.y += Math.sin(p.t * 0.33 + p.ph) * 0.9 * dt; p.z = 22 + Math.sin(p.t * 2.2 + p.ph) * 8; break;
        case 'firefly': p.x += Math.cos(p.t * 0.7 + p.ph) * 0.35 * dt; p.y += Math.sin(p.t * 0.5 + p.ph * 2) * 0.35 * dt; p.z += Math.sin(p.t * 1.1 + p.ph) * 5 * dt; break;
        case 'leaf': p.z -= 14 * dt; p.x += (w * 0.9 + Math.sin(p.t * 1.6 + p.ph) * 0.6) * dt; p.rot += dt * 2.4; if (p.z <= 0) { p.z = 0; p.landed = (p.landed || 0) + dt; } break;
        case 'mote': p.x += (w * 0.2 + Math.sin(p.t * 0.6 + p.ph) * 0.08) * dt; p.z += Math.sin(p.t * 0.8 + p.ph) * 3 * dt; break;
        case 'midge': p.x = p.cx + Math.cos(p.t * 3.1 + p.ph) * 0.35; p.y = p.cy + Math.sin(p.t * 2.3 + p.ph * 1.7) * 0.35; p.z = 20 + Math.sin(p.t * 4 + p.ph) * 6; break;
        case 'rain': p.z -= 420 * dt; p.x += 1.5 * dt; if (p.z <= 0 && !p.splash) { p.splash = p.t; } break;
        case 'ember': p.z += p.vz * dt; p.x += (w * 0.4 + Math.sin(p.t * 3 + p.ph) * 0.25) * dt; break;
        case 'ash': p.z -= 9 * dt; p.x += (Math.sin(p.t * 0.9 + p.ph) * 0.25 + w * 0.2) * dt; break;
      }
    }
    A.parts = A.parts.filter((p) => p.t < p.life && !(p.kind === 'rain' && p.splash && p.t - p.splash > 0.25) && !(p.kind === 'ash' && p.z < 0) && !(p.kind === 'leaf' && p.landed > 3));
    for (const cl of A.clouds) { cl.x += 0.35 * dt * cl.s; cl.y -= 0.12 * dt * cl.s; const g = G.world.grid; if (g && cl.x > g.w + 10) { cl.x = -10; cl.y = rnd(0, g.h); } }
  }
  const fade = (p) => Math.min(1, p.t / 0.8, (p.life - p.t) / 0.8);

  /* World-space pass (inside the iso camera transform): drawn over units, under labels. */
  function world(ctx, dt, vx0, vx1, vy0, vy1) {
    A.t += dt;
    const b = [vx0, vx1, vy0, vy1];
    update(dt, b);
    const c = cfg();
    // cloud shadows sliding over the fields
    if (c.clouds) for (const cl of A.clouds) {
      const [ix, iy] = iso(cl.x, cl.y), r = cl.r * 45;
      if (ix + r < vx0 || ix - r > vx1 || iy + r < vy0 || iy - r > vy1) continue;
      blob(ctx, SPR.cloud(), ix, iy, r, r * 0.55, 1);
    }
    // low mist banks drifting across the ground
    if (c.mist) {
      if (!A.mists.length) for (let i = 0; i < c.mist; i++) { const w = toW(rnd(vx0, vx1), rnd(vy0, vy1)); A.mists.push({ x: w.x, y: w.y, r: rnd(80, 150), ph: Math.random() * TAU }); }
      for (const m of A.mists) {
        m.x += 0.12 * dt;
        const [ix, iy] = iso(m.x, m.y);
        if (ix < vx0 - 200) { const w = toW(vx1 + 100, rnd(vy0, vy1)); m.x = w.x; m.y = w.y; }
        if (ix > vx1 + 220) { const w = toW(vx0 - 150, rnd(vy0, vy1)); m.x = w.x; m.y = w.y; }
        const a = 0.2 + Math.sin(A.t * 0.4 + m.ph) * 0.05;
        blob(ctx, SPR.mist(), ix, iy - 6, m.r, m.r * 0.4, a);
      }
    }
    // sunlight dappling through the canopy, drifting as the leaves move
    if (c.dapple) {
      if (!A.dapples || A.dapplesFor !== G.world.grid) { A.dapplesFor = G.world.grid; A.dapples = []; for (let i = 0; i < c.dapple; i++) { const w = toW(rnd(vx0, vx1), rnd(vy0, vy1)); A.dapples.push({ x: w.x, y: w.y, r: rnd(30, 70), ph: Math.random() * TAU }); } }
      ctx.globalCompositeOperation = 'soft-light';
      for (const d of A.dapples) {
        const [ix, iy] = iso(d.x + Math.sin(A.t * 0.3 + d.ph) * 0.4, d.y + Math.cos(A.t * 0.25 + d.ph) * 0.3);
        const a = 0.4 + Math.sin(A.t * 0.7 + d.ph) * 0.15;
        blob(ctx, SPR.dapple(), ix, iy, d.r, d.r * 0.5, a);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    for (const p of A.parts) {
      const [ix, iy0] = iso(p.x, p.y), iy = iy0 - p.z, f = fade(p);
      if (ix < vx0 - 20 || ix > vx1 + 20 || iy < vy0 - 40 || iy > vy1 + 20) continue;
      switch (p.kind) {
        case 'pollen': ctx.fillStyle = `rgba(255,248,200,${0.75 * f})`; ctx.beginPath(); ctx.arc(ix, iy, p.size, 0, TAU); ctx.fill(); break;
        case 'butterfly': {
          const flap = Math.abs(Math.sin(p.t * 14 + p.ph)), wv = 4.4 * (0.25 + flap * 0.75);
          ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(ix, iy0, 2.5, 1.1, 0, 0, TAU); ctx.fill();
          ctx.globalAlpha = f; ctx.fillStyle = p.col;
          ctx.beginPath(); ctx.ellipse(ix - wv * 0.6, iy, wv, 3.4, -0.4, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.ellipse(ix + wv * 0.6, iy, wv, 3.4, 0.4, 0, TAU); ctx.fill();
          ctx.fillStyle = '#3a2a1a'; ctx.fillRect(ix - 0.5, iy - 2, 1, 4); ctx.globalAlpha = 1; break;
        }
        case 'firefly': {
          const pulse = 0.35 + 0.65 * Math.max(0, Math.sin(p.t * 2.2 + p.ph)) ** 2, a = pulse * f;
          ctx.globalCompositeOperation = 'lighter'; blob(ctx, SPR.firefly(), ix, iy, 13, 13, a);
          ctx.fillStyle = `rgba(250,255,210,${a})`; ctx.beginPath(); ctx.arc(ix, iy, 1.9, 0, TAU); ctx.fill();
          ctx.globalCompositeOperation = 'source-over'; break;
        }
        case 'leaf': {
          const a = p.landed ? Math.max(0, 1 - p.landed / 3) : f;
          if (!p.landed) { ctx.fillStyle = `rgba(0,0,0,${0.12 * a})`; ctx.beginPath(); ctx.ellipse(ix, iy0, 2.5, 1, 0, 0, TAU); ctx.fill(); }
          ctx.save(); ctx.translate(ix, iy); ctx.rotate(p.rot); ctx.scale(1, p.landed ? 0.5 : Math.abs(Math.cos(p.rot * 1.3)) * 0.8 + 0.2);
          ctx.globalAlpha = a; ctx.fillStyle = p.col; ctx.beginPath(); ctx.ellipse(0, 0, 4.6, 2.4, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(80,40,10,0.5)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(3, 0); ctx.stroke();
          ctx.restore(); ctx.globalAlpha = 1; break;
        }
        case 'mote': ctx.fillStyle = A.theme === 'deep' ? `rgba(160,220,255,${0.5 * f})` : `rgba(255,250,220,${0.4 * f})`; ctx.beginPath(); ctx.arc(ix, iy, 1.1, 0, TAU); ctx.fill(); break;
        case 'midge': ctx.fillStyle = `rgba(20,25,15,${0.7 * f})`; ctx.fillRect(ix - 0.7, iy - 0.7, 1.4, 1.4); break;
        case 'rain':
          if (p.splash) { const s = (p.t - p.splash) / 0.25; ctx.strokeStyle = `rgba(200,225,235,${0.5 * (1 - s)})`; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(ix, iy0, 2 + s * 4, 1 + s * 2, 0, 0, TAU); ctx.stroke(); }
          else { ctx.strokeStyle = 'rgba(205,228,240,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ix, iy); ctx.lineTo(ix - 3, iy - 14); ctx.stroke(); }
          break;
        case 'ember': {
          const a = f * (0.6 + Math.sin(p.t * 20 + p.ph) * 0.4);
          ctx.globalCompositeOperation = 'lighter';
          blob(ctx, SPR.ember(), ix, iy, 5, 5, a);
          ctx.fillStyle = `rgba(255,230,160,${a})`; ctx.fillRect(ix - 0.8, iy - 0.8, 1.6, 1.6);
          ctx.globalCompositeOperation = 'source-over'; break;
        }
        case 'ash': ctx.fillStyle = `rgba(170,165,160,${0.55 * f})`; ctx.save(); ctx.translate(ix, iy); ctx.rotate(p.t + p.ph); ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore(); break;
      }
    }
  }

  /* Screen-space pass: torch glow on the game canvas, then the light shafts and
     colour grade on their own page layers. */
  function screen(ctx) {
    const on = A.on;
    setLayers(on);
    if (!on) return;
    const R = G.render, W = R.W, H = R.H, c = cfg();
    if (c.torches) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const img = SPR.torchLight(c.torches);
      for (const l of lights()) {
        const s = R.toScreen(l.x, l.y), r = l.r * R.cam.zoom * 0.9;
        if (s.x < -r || s.x > W + r || s.y < -r || s.y > H + r) continue;
        blob(ctx, img, s.x, s.y - 20 * R.cam.zoom, r, r, l.a);
      }
      ctx.restore();
    }
    if (c.rays && L.rx) {
      // drawn at half size on their own layer, which the page blends with "screen"
      const x = L.rx, k = 0.5;
      x.setTransform(k, 0, 0, k, 0, 0);
      x.clearRect(0, 0, W, H);
      for (let i = 0; i < 5; i++) {
        const x0 = W * (0.05 + i * 0.22) + Math.sin(A.t * 0.15 + i * 1.7) * 40, w = 50 + (i % 3) * 40;
        const a = 0.05 + 0.03 * Math.sin(A.t * 0.3 + i * 2.3);
        const g = x.createLinearGradient(x0, 0, x0 + H * 0.55, H);
        g.addColorStop(0, `rgba(255,245,200,${a})`); g.addColorStop(0.7, `rgba(255,245,200,${a * 0.4})`); g.addColorStop(1, 'rgba(255,245,200,0)');
        x.fillStyle = g;
        x.beginPath(); x.moveTo(x0, 0); x.lineTo(x0 + w, 0); x.lineTo(x0 + w + H * 0.55, H); x.lineTo(x0 + H * 0.55, H); x.closePath(); x.fill();
      }
    }
  }

  // Light holes in the darkness: torches, flickering.
  function lights() {
    const out = [];
    for (const t of A.torches) out.push({ x: t.x, y: t.y, r: 190 + Math.sin(A.t * 9 + t.ph) * 8 + Math.sin(A.t * 23 + t.ph) * 5, a: 0.95 });
    return out;
  }
  // How far a tree top leans in the wind right now.
  function sway(p) {
    const w = A.wind * (cfg().wind || 0.5);
    return (w * 0.05 + Math.sin(A.t * 1.7 + p.x * 0.7 + p.y * 0.4) * 0.025) * (A.theme === 'cave' || A.theme === 'deep' ? 0 : 1);
  }
  function drawTorch(ctx, p) {
    const [ix, iy] = iso(p.x, p.y), c = cfg(), col = c.torches || '#ff9a3a', t = A.t + p.ph;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(ix, iy, 8, 3.5, 0, 0, TAU); ctx.fill();
    // iron brazier on a post
    ctx.fillStyle = '#2a2420'; ctx.fillRect(ix - 1.6, iy - 26, 3.2, 26);
    ctx.fillStyle = '#3a322c'; ctx.beginPath(); ctx.moveTo(ix - 7, iy - 30); ctx.lineTo(ix + 7, iy - 30); ctx.lineTo(ix + 4, iy - 24); ctx.lineTo(ix - 4, iy - 24); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#151210'; ctx.lineWidth = 1; ctx.stroke();
    // layered flame
    const fl = (h, w, cl, dx) => { ctx.fillStyle = cl; ctx.beginPath(); ctx.moveTo(ix - w + dx, iy - 30); ctx.quadraticCurveTo(ix - w * 0.8 + dx, iy - 30 - h * 0.6, ix + dx + Math.sin(t * 11) * 1.5, iy - 30 - h); ctx.quadraticCurveTo(ix + w * 0.8 + dx, iy - 30 - h * 0.6, ix + w + dx, iy - 30); ctx.closePath(); ctx.fill(); };
    const h = 15 + Math.sin(t * 13) * 2.5 + Math.sin(t * 29) * 1.5;
    ctx.globalCompositeOperation = 'lighter';
    blob(ctx, SPR.flame(col), ix, iy - 38, 30, 30, 1);
    ctx.globalCompositeOperation = 'source-over';
    if (col === '#7fd8ff') { fl(h, 6, '#2a6aa0', 0); fl(h * 0.75, 4.5, '#7fd8ff', 0.5); fl(h * 0.45, 2.5, '#e8f8ff', 0); }
    else { fl(h, 6, '#c8381a', 0); fl(h * 0.78, 4.6, '#ff8a2a', 0.5); fl(h * 0.48, 2.6, '#ffe08a', 0); }
  }

  Object.defineProperty(A, 'on', { get: () => !G.settings || G.settings.atmosphere !== false });
  return Object.assign(A, { init, resize, zone, world, screen, lights, sway, drawTorch });
})();
