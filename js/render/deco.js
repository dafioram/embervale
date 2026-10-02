/* Decorative props: small things that stand on the ground (bushes, stumps, barrels,
   gravestones, bones, crystals...). They don't block movement, so they go mostly at the
   edges of open ground, next to trees, walls and buildings. Each kind is drawn once
   into a small cached sprite and stamped wherever it appears. */
G.deco = (() => {
  const OUT = '#1a120c';
  const RES = 3; // sprite pixels per screen pixel at zoom 1
  const sprites = new Map();

  const sh = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (f > 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  };
  function P(c, d, fill, lw = 0.9) { const p = new Path2D(d); c.fillStyle = fill; c.fill(p); if (lw) { c.strokeStyle = OUT; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(p); } }
  function E(c, x, y, rx, ry, fill, lw = 0.9) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fillStyle = fill; c.fill(); if (lw) { c.strokeStyle = OUT; c.lineWidth = lw; c.stroke(); } }
  function Ln(c, d, col, lw) { c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(new Path2D(d)); }
  const grad = (c, y0, y1, top, bot) => { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, top); g.addColorStop(1, bot); return g; };
  const shadow = (c, rx, ry = rx * 0.42) => { c.fillStyle = 'rgba(0,0,0,0.26)'; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, 7); c.fill(); };

  // Each drawer works in screen pixels at zoom 1 with the foot point at 0,0.
  // [x0, y0, x1, y1] bounds, then the drawing function (c, v, theme).
  const KINDS = {
    bush: [[-14, -20, 14, 4], (c, v, th) => {
      shadow(c, 12);
      const base = th === 'forest' ? '#3f6a32' : th === 'swamp' ? '#56663a' : th === 'village' ? '#5a8a3c' : '#5f9440';
      const blobs = [[-6, -6, 7], [6, -6, 7], [0, -11, 8], [-3, -4, 6], [4, -3, 6]];
      for (const [x, y, r] of blobs) E(c, x, y, r, r * 0.85, grad(c, y - r, y + r, sh(base, 0.22), sh(base, -0.25)));
      for (const [x, y, r] of blobs.slice(0, 3)) E(c, x - r * 0.3, y - r * 0.35, r * 0.35, r * 0.22, 'rgba(255,255,220,0.22)', 0);
      if (v === 1 && th !== 'swamp') for (const [x, y] of [[-5, -10], [4, -12], [7, -5], [-1, -5]]) E(c, x, y, 1.3, 1.3, th === 'forest' ? '#c03a3a' : '#f4f0e0', 0.4);
    }],
    fern: [[-12, -14, 12, 3], (c, v, th) => {
      shadow(c, 9);
      const col = th === 'swamp' ? '#6a7a3a' : '#4f8a3a';
      for (let i = 0; i < 6; i++) {
        const a = -2.6 + i * 0.42, x1 = Math.cos(a) * 11, y1 = Math.sin(a) * 11 - 1;
        Ln(c, `M 0 0 Q ${x1 * 0.5} ${y1 * 0.9 - 3} ${x1} ${y1}`, OUT, 2.6);
        Ln(c, `M 0 0 Q ${x1 * 0.5} ${y1 * 0.9 - 3} ${x1} ${y1}`, i % 2 ? sh(col, 0.15) : col, 1.6);
      }
    }],
    stump: [[-10, -14, 10, 4], (c, v) => {
      shadow(c, 9);
      P(c, 'M -7 0 L -6 -8 L 6 -8 L 7 0 Q 9 1 8 2 L -8 2 Q -9 1 -7 0 Z', grad(c, -8, 2, '#7a5634', '#4a321e'));
      E(c, 0, -8, 6, 2.6, '#c9a46a');
      c.strokeStyle = 'rgba(110,70,40,0.7)'; c.lineWidth = 0.6; c.beginPath(); c.ellipse(0, -8, 3.6, 1.5, 0, 0, 7); c.stroke(); c.beginPath(); c.ellipse(0, -8, 1.6, 0.7, 0, 0, 7); c.stroke();
      Ln(c, 'M -4 -6 L -4.5 -1 M 2 -6 L 2.4 -1', 'rgba(40,25,14,0.6)', 0.7);
      if (v === 1) { E(c, 5, -3, 2.4, 1.2, '#d8c8a0', 0.6); E(c, 6.5, -1.4, 1.6, 0.8, '#d8c8a0', 0.6); }
    }],
    log: [[-18, -10, 18, 4], (c, v, th) => {
      shadow(c, 16, 4);
      const bark = th === 'swamp' ? '#4e4430' : '#6a4a2e';
      P(c, 'M -14 -2 L 12 -7 L 14 -2 L -12 3 Z', grad(c, -7, 3, sh(bark, 0.15), sh(bark, -0.3)));
      E(c, 13, -4.5, 2.4, 2.8, '#c9a46a');
      c.strokeStyle = 'rgba(110,70,40,0.7)'; c.lineWidth = 0.5; c.beginPath(); c.ellipse(13, -4.5, 1.2, 1.4, 0, 0, 7); c.stroke();
      Ln(c, 'M -8 -1 L 4 -4 M -4 1 L 8 -2', 'rgba(30,20,10,0.5)', 0.6);
      if (th === 'forest' || th === 'swamp') { E(c, -6, -3, 3, 1, '#5a8a3a', 0.5); E(c, 2, -5.4, 2.4, 0.9, '#6a9a44', 0.5); }
    }],
    mushrooms: [[-9, -11, 9, 3], (c, v, th) => {
      shadow(c, 7, 2.4);
      const cap = v === 1 ? '#c8a878' : th === 'swamp' ? '#9a7ab8' : '#c4482e';
      for (const [x, s] of [[-4, 0.8], [1, 1.2], [5, 0.7]]) {
        P(c, `M ${x - 1 * s} 0 L ${x - 0.8 * s} ${-5 * s} L ${x + 0.8 * s} ${-5 * s} L ${x + 1 * s} 0 Z`, '#ece4d0', 0.6);
        P(c, `M ${x - 4 * s} ${-4.6 * s} Q ${x} ${-10 * s} ${x + 4 * s} ${-4.6 * s} Z`, grad(c, -9 * s, -4 * s, sh(cap, 0.2), sh(cap, -0.2)), 0.7);
        if (v !== 1) for (const dx of [-1.6, 1.2]) E(c, x + dx * s, -6.4 * s, 0.6 * s, 0.4 * s, '#fff6e0', 0);
      }
    }],
    reeds: [[-8, -24, 8, 2], (c, v) => {
      shadow(c, 6, 2.2);
      for (let i = 0; i < 6; i++) {
        const x = -5 + i * 2, top = -14 - ((i * 7) % 9), lean = (i - 2.5) * 0.8;
        Ln(c, `M ${x} 0 Q ${x + lean * 0.4} ${top * 0.5} ${x + lean} ${top}`, OUT, 2.2);
        Ln(c, `M ${x} 0 Q ${x + lean * 0.4} ${top * 0.5} ${x + lean} ${top}`, i % 2 ? '#7a8a44' : '#8c9c50', 1.2);
        if (i % 2 === 0) P(c, `M ${x + lean - 0.9} ${top + 1} L ${x + lean - 0.8} ${top + 5} L ${x + lean * 0.95 + 0.8} ${top + 5} L ${x + lean + 0.9} ${top + 1} Z`, '#5a3a22', 0.6);
      }
    }],
    barrel: [[-8, -18, 8, 3], (c) => {
      shadow(c, 7);
      P(c, 'M -6 0 Q -7.4 -7 -6 -14 L 6 -14 Q 7.4 -7 6 0 Z', grad(c, -14, 0, '#9a6a3c', '#5a3a1e'));
      E(c, 0, -14, 6, 2.2, '#7a5430');
      for (const y of [-3, -11]) Ln(c, `M -6.6 ${y} Q 0 ${y + 1.6} 6.6 ${y}`, '#3a3230', 1.2);
      Ln(c, 'M -2 -13 L -2.4 -1', 'rgba(255,230,180,0.25)', 1.2);
    }],
    crate: [[-10, -16, 10, 3], (c, v) => {
      shadow(c, 9);
      P(c, 'M -8 -3 L 0 1 L 0 -9 L -8 -13 Z', '#8a6438');
      P(c, 'M 0 1 L 8 -3 L 8 -13 L 0 -9 Z', '#6a4a28');
      P(c, 'M -8 -13 L 0 -17 L 8 -13 L 0 -9 Z', '#a87c48');
      Ln(c, 'M -8 -3 L 0 -9 M 0 1 L 8 -13', 'rgba(40,25,10,0.55)', 0.8);
      if (v === 1) { E(c, -2, -15, 2.2, 1, '#e8d8a8', 0.5); }
    }],
    sacks: [[-10, -12, 10, 3], (c) => {
      shadow(c, 9);
      for (const [x, y] of [[-4, 0], [4, 0], [0, -4]]) {
        P(c, `M ${x - 4} ${y} Q ${x - 5} ${y - 5} ${x - 2} ${y - 7} L ${x + 2} ${y - 7} Q ${x + 5} ${y - 5} ${x + 4} ${y} Z`, grad(c, y - 7, y, '#d8c49a', '#9a8460'));
        Ln(c, `M ${x - 1.4} ${y - 7} L ${x + 1.4} ${y - 7}`, '#6a5434', 1);
      }
    }],
    hay: [[-12, -14, 12, 3], (c) => {
      shadow(c, 11);
      P(c, 'M -10 0 L -10 -8 Q 0 -13 10 -8 L 10 0 Q 0 3 -10 0 Z', grad(c, -12, 2, '#e8cc78', '#a8883c'));
      Ln(c, 'M -10 -4 Q 0 -1 10 -4', '#7a5a24', 1);
      for (let i = 0; i < 7; i++) Ln(c, `M ${-8 + i * 2.6} -9 L ${-7.4 + i * 2.6} -6`, 'rgba(255,240,170,0.6)', 0.6);
    }],
    grave: [[-8, -20, 8, 3], (c, v) => {
      shadow(c, 7);
      const st = v === 2 ? '#6a665e' : '#8a857a';
      if (v === 1) { // a weathered cross
        P(c, 'M -1.6 0 L -1.6 -10 L -5 -10 L -5 -13 L -1.6 -13 L -1.6 -17 L 1.6 -17 L 1.6 -13 L 5 -13 L 5 -10 L 1.6 -10 L 1.6 0 Z', grad(c, -17, 0, sh(st, 0.15), sh(st, -0.25)));
      } else {
        P(c, 'M -5 0 L -5 -11 Q 0 -18 5 -11 L 5 0 Z', grad(c, -16, 0, sh(st, 0.15), sh(st, -0.25)));
        Ln(c, 'M -2.4 -10 L 2.4 -10 M -2 -7.5 L 2 -7.5', 'rgba(30,25,20,0.6)', 0.7);
        if (v === 2) Ln(c, 'M 2 -14 L 0.5 -9 L 2 -6', 'rgba(20,15,10,0.7)', 0.6);
      }
      E(c, -3, -1, 2.4, 1, '#5a6a3a', 0.4);
    }],
    bones: [[-10, -7, 10, 3], (c, v) => {
      const bone = '#e4dccb';
      Ln(c, 'M -8 -1 L 2 -3', OUT, 2.6); Ln(c, 'M -8 -1 L 2 -3', bone, 1.4);
      Ln(c, 'M -3 1 L 7 0', OUT, 2.6); Ln(c, 'M -3 1 L 7 0', bone, 1.4);
      if (v !== 1) { E(c, 4, -3.4, 3, 2.6, bone, 0.7); E(c, 3, -3.6, 0.8, 0.8, '#2a2018', 0); E(c, 5.2, -3.6, 0.8, 0.8, '#2a2018', 0); }
      else for (let i = 0; i < 3; i++) Ln(c, `M ${-5 + i * 2.5} -4 Q ${-4 + i * 2.5} -1 ${-5.5 + i * 2.5} 1`, bone, 0.9);
    }],
    urn: [[-6, -15, 6, 3], (c, v) => {
      shadow(c, 5, 2);
      const col = v === 1 ? '#7a5a44' : '#8a6a4a';
      P(c, 'M -2.5 -12 L 2.5 -12 L 2 -10 Q 5.6 -7 4 -2 L 2.6 0 L -2.6 0 L -4 -2 Q -5.6 -7 -2 -10 Z', grad(c, -12, 0, sh(col, 0.2), sh(col, -0.3)));
      Ln(c, 'M -4.6 -6 L 4.6 -6', '#c9a046', 0.8);
      if (v === 1) Ln(c, 'M 1 -11 L 2.6 -7 L 1.4 -4', OUT, 0.6);
    }],
    web: [[-14, -26, 14, 2], (c) => {
      c.strokeStyle = 'rgba(235,235,240,0.65)'; c.lineWidth = 0.6;
      const cx = 0, cy = -14;
      for (let i = 0; i < 7; i++) { const a = i * 0.9; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * 13, cy + Math.sin(a) * 11); c.stroke(); }
      for (let r = 3; r < 13; r += 3) { c.beginPath(); for (let i = 0; i <= 7; i++) { const a = i * 0.9, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.85; i ? c.quadraticCurveTo(cx + Math.cos(a - 0.45) * r * 0.85, cy + Math.sin(a - 0.45) * r * 0.72, x, y) : c.moveTo(x, y); } c.stroke(); }
    }],
    crystal: [[-9, -20, 9, 3], (c, v) => {
      const col = ['#7fd8ff', '#b79aff', '#8fe8d0'][v % 3];
      const g = c.createRadialGradient(0, -6, 0, 0, -6, 12); g.addColorStop(0, col + '66'); g.addColorStop(1, col + '00');
      c.fillStyle = g; c.beginPath(); c.arc(0, -6, 12, 0, 7); c.fill();
      for (const [x, h, w, a] of [[-3.5, 11, 2.4, -0.25], [1, 16, 3, 0.05], [4.5, 9, 2.2, 0.3]]) {
        c.save(); c.translate(x, 0); c.rotate(a);
        P(c, `M ${-w} 0 L ${-w} ${-h * 0.75} L 0 ${-h} L ${w} ${-h * 0.75} L ${w} 0 Z`, grad(c, -h, 0, '#ffffff', col), 0.7);
        Ln(c, `M 0 ${-h} L 0 0`, 'rgba(255,255,255,0.5)', 0.5);
        c.restore();
      }
    }],
    stalagmite: [[-8, -22, 8, 3], (c, v, th) => {
      shadow(c, 7);
      const col = th === 'deep' ? '#4e5366' : '#615044';
      P(c, `M -6 0 Q -4 -8 -1 ${-18 - v * 2} Q 1 -10 2 -9 Q 3 -12 4 -13 Q 5 -6 6 0 Z`, grad(c, -20, 0, sh(col, 0.25), sh(col, -0.35)));
      Ln(c, 'M -3 -2 Q -2 -8 -1 -13', 'rgba(255,255,255,0.15)', 0.8);
    }],
    rocks: [[-10, -9, 10, 3], (c, v, th) => {
      shadow(c, 9, 3);
      const col = th === 'deep' ? '#5a5f72' : th === 'cave' ? '#6a5a4c' : '#8a857a';
      E(c, -3, -3, 5, 3.6, grad(c, -7, 0, sh(col, 0.2), sh(col, -0.3)));
      E(c, 4, -2, 3.4, 2.4, grad(c, -5, 0, sh(col, 0.15), sh(col, -0.3)));
      if (th !== 'cave' && th !== 'deep') E(c, -4, -5.6, 2.4, 0.9, '#6a9a44', 0.4);
    }],
  };

  // Which kinds each theme uses, with weights, for edge spots and for open ground.
  const THEMES = {
    village: { edge: { bush: 3, barrel: 2, crate: 2, sacks: 1, hay: 1, rocks: 1 }, open: { bush: 1, rocks: 1 } },
    meadow: { edge: { bush: 4, stump: 2, log: 1, rocks: 2, fern: 1, hay: 1 }, open: { bush: 1, rocks: 2, mushrooms: 1 } },
    forest: { edge: { bush: 3, fern: 3, stump: 2, log: 2, mushrooms: 2 }, open: { fern: 2, mushrooms: 1, stump: 1 } },
    swamp: { edge: { reeds: 4, stump: 2, log: 2, mushrooms: 2, bones: 1 }, open: { reeds: 3, bones: 1 } },
    cave: { edge: { grave: 3, urn: 2, bones: 2, web: 2, stalagmite: 2, rocks: 1 }, open: { bones: 2, rocks: 1 } },
    deep: { edge: { crystal: 3, stalagmite: 3, web: 2, bones: 2, rocks: 1 }, open: { crystal: 1, bones: 1 } },
  };

  function sprite(kind, v, theme) {
    const key = kind + v + theme;
    let s = sprites.get(key);
    if (s) return s;
    const [x0, y0, x1, y1] = KINDS[kind][0];
    const pad = 2;
    const c = document.createElement('canvas');
    c.width = Math.ceil((x1 - x0 + pad * 2) * RES); c.height = Math.ceil((y1 - y0 + pad * 2) * RES);
    const x = c.getContext('2d');
    x.scale(RES, RES); x.translate(-x0 + pad, -y0 + pad);
    try { KINDS[kind][1](x, v, theme); } catch (e) { console.error(e); }
    s = { c, ax: -x0 + pad, ay: -y0 + pad, w: c.width / RES, h: c.height / RES };
    sprites.set(key, s);
    return s;
  }

  function pickW(table, r) {
    let tot = 0; for (const k in table) tot += table[k];
    let n = r() * tot;
    for (const k in table) { n -= table[k]; if (n <= 0) return k; }
    return Object.keys(table)[0];
  }

  // Decide where decorations go in a zone. Returns prop records for the renderer.
  function place(grid, Z) {
    const th = THEMES[Z.theme];
    if (!th) return [];
    const r = G.util.rng((Z.seed || 1) * 31 + 7 + (Z.deep || 0));
    const avoid = [];
    for (const ex of G.exitsOf(Z)) avoid.push([ex.x, ex.y, (ex.r || 1) + 1.5]);
    for (const o of Z.objects || []) avoid.push([o.x, o.y, 1.6]);
    for (const e of G.world.entities) if (e.kind === 'npc' || e.kind === 'object' || e.kind === 'structure') avoid.push([e.x, e.y, 1.8]);
    for (const k in Z.entries || {}) avoid.push([Z.entries[k][0], Z.entries[k][1], 2.5]);
    const out = [];
    const W = grid.w, H = grid.h;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (!grid.walk(x, y)) continue;
      const t = grid.tiles[y * W + x];
      if (t === G.T.WATER) continue;
      let edge = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!grid.walk(x + dx, y + dy)) edge++;
      const roll = r();
      const chance = edge ? 0.16 : (t === G.T.DIRT || t === G.T.STONE ? 0 : 0.012);
      if (roll > chance) continue;
      const px = x + 0.25 + r() * 0.5, py = y + 0.25 + r() * 0.5;
      if (avoid.some(([ax, ay, ar]) => (ax - px) ** 2 + (ay - py) ** 2 < ar * ar)) continue;
      let kind = pickW(edge ? th.edge : th.open, r);
      // farm things only beside fields or buildings
      if (kind === 'hay' || kind === 'sacks' || kind === 'barrel' || kind === 'crate') {
        let farm = false;
        for (let dy = -2; dy <= 2 && !farm; dy++) for (let dx = -2; dx <= 2; dx++) { const tt = grid.tiles[(y + dy) * W + x + dx]; if (tt === G.T.FIELD || grid.block[(y + dy) * W + x + dx] === G.B.BUILDING) { farm = true; break; } }
        if (!farm) kind = Z.cave ? 'rocks' : 'bush';
      }
      out.push({ kind: 'deco', type: kind, v: r.int(0, 2), x: px, y: py, s: 0.85 + r() * 0.3, flip: r() < 0.5, depth: px + py });
    }
    return out;
  }

  function draw(ctx, p, iso, theme) {
    const s = sprite(p.type, p.v, theme);
    const [ix, iy] = iso(p.x, p.y);
    const k = p.s;
    if (p.flip) { ctx.save(); ctx.translate(ix, iy); ctx.scale(-1, 1); ctx.drawImage(s.c, -s.ax * k, -s.ay * k, s.w * k, s.h * k); ctx.restore(); }
    else ctx.drawImage(s.c, ix - s.ax * k, iy - s.ay * k, s.w * k, s.h * k);
  }

  return { place, draw, sprite, KINDS, clear: () => sprites.clear() };
})();
