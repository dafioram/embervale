/* Zone generator: turns a zone definition into a tile grid, blockers and props.
   Pure data, no DOM, so it can also run under Node for layout checks. */

G.T = { GRASS: 0, DIRT: 1, STONE: 2, WATER: 3, FIELD: 4, MUD: 5, CAVE: 6, ROCK: 7 };
G.B = { NONE: 0, TREE: 1, BOULDER: 2, BUILDING: 3, FENCE: 4, WATER: 5, CAVEWALL: 6, GATE: 7, OBJECT: 8, STRUCTURE: 9 };

G.genZone = (zoneId, flags = {}) => {
  const Z = G.ZONES[zoneId];
  const { w, h } = Z;
  const r = G.util.rng(Z.seed);
  const nz = G.util.noise2(Z.seed * 7 + 3);
  const tiles = new Uint8Array(w * h);
  const block = new Uint8Array(w * h);
  const prot = new Uint8Array(w * h); // 1 = keep free of random trees/rocks
  const shade = new Float32Array(w * h); // per-tile color jitter
  const props = [];
  const gates = [];
  const I = (x, y) => y * w + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;

  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) shade[I(x, y)] = nz(x / 3.1, y / 3.1) * 0.6 + r() * 0.4;

  const base = Z.cave ? G.T.ROCK : G.T.GRASS;
  tiles.fill(base);
  if (Z.cave) block.fill(G.B.CAVEWALL);

  const eachCircle = (cx, cy, rad, fn) => {
    for (let y = Math.floor(cy - rad - 1); y <= Math.ceil(cy + rad + 1); y++)
      for (let x = Math.floor(cx - rad - 1); x <= Math.ceil(cx + rad + 1); x++)
        if (inb(x, y) && Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= rad) fn(x, y);
  };
  const eachEllipse = (cx, cy, rx, ry, fn) => {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        if (!inb(x, y)) continue;
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) fn(x, y);
      }
  };
  const eachSeg = (pts, width, fn) => {
    const hw = width / 2;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const minx = Math.floor(Math.min(x0, x1) - hw - 1), maxx = Math.ceil(Math.max(x0, x1) + hw + 1);
      const miny = Math.floor(Math.min(y0, y1) - hw - 1), maxy = Math.ceil(Math.max(y0, y1) + hw + 1);
      const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1;
      for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
        if (!inb(x, y)) continue;
        const px = x + 0.5, py = y + 0.5;
        const t = G.util.clamp(((px - x0) * dx + (py - y0) * dy) / L2, 0, 1);
        // a little wobble so roads don't look ruler-straight
        const wob = (nz(px / 2.3, py / 2.3) - 0.5) * 0.7;
        if (Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t)) <= hw + wob) fn(x, y);
      }
    }
  };
  const lineTiles = (pts, fn) => {
    for (let i = 0; i < pts.length - 1; i++) {
      let [x0, y0] = pts[i]; const [x1, y1] = pts[i + 1];
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let k = 0; k <= n; k++) fn(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n));
    }
  };

  // Border forest / wall
  if (Z.border) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (d < Z.border) block[I(x, y)] = G.B.TREE;
    }
  }

  // Pass 1: terrain features (water, fields, painted ground, rooms)
  for (const f of Z.features) {
    if (f.t === 'water') eachEllipse(f.x, f.y, f.rx, f.ry, (x, y) => { tiles[I(x, y)] = G.T.WATER; block[I(x, y)] = G.B.WATER; });
    if (f.t === 'field') for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) if (inb(x, y)) { tiles[I(x, y)] = G.T.FIELD; prot[I(x, y)] = 1; }
    if (f.t === 'room') eachCircle(f.x, f.y, f.r + (r() - 0.5) * 0.6, (x, y) => { tiles[I(x, y)] = G.T.CAVE; block[I(x, y)] = 0; });
    if (f.t === 'tunnel') eachSeg(f.pts, f.w, (x, y) => { tiles[I(x, y)] = G.T.CAVE; block[I(x, y)] = 0; });
  }
  // Pass 2: paths and clearings (override water = fords)
  for (const f of Z.features) {
    if (f.t === 'path') eachSeg(f.pts, f.w, (x, y) => {
      const tile = f.tile === 'grass' ? null : f.tile === 'mud' ? G.T.MUD : G.T.DIRT;
      if (tile !== null) tiles[I(x, y)] = tile; else if (tiles[I(x, y)] === G.T.WATER) tiles[I(x, y)] = G.T.MUD;
      block[I(x, y)] = 0; prot[I(x, y)] = 1;
    });
    if (f.t === 'clear') eachCircle(f.x, f.y, f.r, (x, y) => { if (block[I(x, y)] !== G.B.WATER) block[I(x, y)] = 0; prot[I(x, y)] = 1; });
    if (f.t === 'paint') eachCircle(f.x, f.y, f.r, (x, y) => { tiles[I(x, y)] = G.T[f.tile.toUpperCase()]; block[I(x, y)] = 0; prot[I(x, y)] = 1; });
  }
  // Pass 3: constructed things
  for (const f of Z.features) {
    if (f.t === 'building') {
      for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) { block[I(x, y)] = G.B.BUILDING; prot[I(x, y)] = 1; }
      for (let y = f.y - 1; y <= f.y + f.h; y++) for (let x = f.x - 1; x <= f.x + f.w; x++) if (inb(x, y)) { prot[I(x, y)] = 1; if (block[I(x, y)] === G.B.TREE) block[I(x, y)] = 0; }
      props.push({ kind: 'building', x: f.x, y: f.y, w: f.w, h: f.h, style: f.style, name: f.name, depth: f.x + f.w + f.y + f.h - 1 });
    }
    if (f.t === 'fence') lineTiles(f.pts, (x, y) => { if (inb(x, y) && block[I(x, y)] === 0) { block[I(x, y)] = G.B.FENCE; props.push({ kind: 'fence', x, y, depth: x + y + 1 }); } });
    if (f.t === 'stockade') {
      for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) {
        const edge = x === f.x || y === f.y || x === f.x + f.w - 1 || y === f.y + f.h - 1;
        const isGate = y === f.y + f.h - 1 && x >= f.gate[0] && x <= f.gate[1];
        if (edge && !isGate) { block[I(x, y)] = G.B.FENCE; props.push({ kind: 'palisade', x, y, depth: x + y + 1 }); }
        else { block[I(x, y)] = 0; tiles[I(x, y)] = G.T.DIRT; }
        prot[I(x, y)] = 1;
      }
    }
    if (f.t === 'gate') {
      const g = { flag: f.flag, cells: [], style: f.style, x: f.x, y: f.y, w: f.w, h: f.h };
      for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) g.cells.push([x, y]);
      gates.push(g);
      props.push({ kind: 'gate', gate: g, x: f.x, y: f.y, w: f.w, h: f.h, style: f.style, depth: f.x + f.w + f.y + f.h - 1 });
    }
  }

  // Protect points of interest
  const protect = (x, y, rad) => eachCircle(x, y, rad, (cx, cy) => { prot[I(cx, cy)] = 1; if (block[I(cx, cy)] === G.B.TREE || block[I(cx, cy)] === G.B.BOULDER) block[I(cx, cy)] = 0; });
  for (const c of Z.camps) protect(c.x, c.y, 2.8);
  for (const o of Z.objects) protect(o.x, o.y, 1.6);
  for (const n of Z.npcs) protect(n.x, n.y, 1.4);
  for (const k in Z.entries) protect(Z.entries[k][0], Z.entries[k][1], 2);
  for (const s of Z.structures || []) protect(s.x, s.y, 3);

  // Random trees (clustered by noise)
  if (Z.treeDensity > 0) {
    const tn = G.util.noise2(Z.seed + 99);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = I(x, y);
      if (prot[k] || block[k] || tiles[k] === G.T.WATER) continue;
      const n = tn(x / 5.5, y / 5.5);
      const p = Z.treeDensity * Math.max(0, n * 2.4 - 0.55);
      if (r() < p) block[k] = G.B.TREE;
    }
  }
  // Boulders
  for (const f of Z.features) if (f.t === 'rocks') {
    let placed = 0, tries = 0;
    while (placed < f.n && tries++ < 2000) {
      const x = r.int(2, w - 3), y = r.int(2, h - 3), k = I(x, y);
      if (prot[k] || block[k] || tiles[k] === G.T.WATER) continue;
      block[k] = G.B.BOULDER; placed++;
    }
  }

  // Gates block until their flag is set
  for (const g of gates) {
    const open = !!flags[g.flag];
    g.open = open;
    for (const [x, y] of g.cells) if (inb(x, y)) { block[I(x, y)] = open ? 0 : G.B.GATE; tiles[I(x, y)] = Z.cave ? G.T.CAVE : G.T.DIRT; }
  }

  // Structures (mill etc.) occupy footprints
  for (const s of Z.structures || []) {
    const [fx, fy, fw, fh] = s.foot;
    for (let y = fy; y < fy + fh; y++) for (let x = fx; x < fx + fw; x++) block[I(x, y)] = G.B.STRUCTURE;
  }
  // Solid objects block their tile
  const SOLID = { waystone: 1, cage: 1, seal: 1, chest: 1, wagon: 1, tent: 1 };
  for (const o of Z.objects) if (SOLID[o.kind]) block[I(Math.floor(o.x), Math.floor(o.y))] = G.B.OBJECT;

  // Props for blockers (trees / boulders / cave walls facing floor)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = I(x, y), b = block[k];
    if (b === G.B.TREE) props.push({ kind: 'tree', x: x + 0.5 + (r() - 0.5) * 0.3, y: y + 0.5 + (r() - 0.5) * 0.3, v: r.int(0, 5), s: 0.85 + r() * 0.35, depth: x + y + 1 });
    else if (b === G.B.BOULDER) props.push({ kind: 'boulder', x: x + 0.5, y: y + 0.5, v: r.int(0, 2), s: 0.8 + r() * 0.4, depth: x + y + 1 });
    else if (b === G.B.CAVEWALL) {
      let nearFloor = false;
      for (let dy = -1; dy <= 1 && !nearFloor; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (inb(nx, ny) && block[I(nx, ny)] !== G.B.CAVEWALL && tiles[I(nx, ny)] === G.T.CAVE) { nearFloor = true; break; }
      }
      if (nearFloor) props.push({ kind: 'cavewall', x, y, v: r.int(0, 3), hgt: 0.8 + r() * 0.7, depth: x + y + 1 });
    }
  }
  // Ground decor (drawn into the terrain cache)
  const decor = [];
  const decorN = Math.floor(w * h * (Z.cave ? 0.05 : 0.12));
  for (let i = 0; i < decorN; i++) {
    const x = r() * w, y = r() * h, k = I(Math.floor(x), Math.floor(y));
    if (block[k] && block[k] !== G.B.TREE) continue;
    if (tiles[k] === G.T.WATER) continue;
    decor.push({ x, y, v: r.int(0, 9), t: tiles[k] });
  }

  const grid = {
    w, h, tiles, block, shade, props, gates, decor,
    walk: (x, y) => x >= 0 && y >= 0 && x < w && y < h && block[y * w + x] === 0,
    tile: (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? tiles[y * w + x] : -1),
    setGate(flag, open) {
      for (const g of gates) if (g.flag === flag) {
        g.open = open;
        for (const [x, y] of g.cells) block[y * w + x] = open ? 0 : G.B.GATE;
      }
    },
  };
  return grid;
};

// Flood fill from a point; used by the layout checker and for safety.
G.reachable = (grid, sx, sy) => {
  const seen = new Uint8Array(grid.w * grid.h);
  const st = [[Math.floor(sx), Math.floor(sy)]];
  if (!grid.walk(st[0][0], st[0][1])) return seen;
  seen[st[0][1] * grid.w + st[0][0]] = 1;
  while (st.length) {
    const [x, y] = st.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (grid.walk(nx, ny) && !seen[ny * grid.w + nx]) { seen[ny * grid.w + nx] = 1; st.push([nx, ny]); }
    }
  }
  return seen;
};
