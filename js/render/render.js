/* Isometric canvas renderer: terrain cache, depth-sorted props and units,
   effects, health bars, lighting, minimap. */
G.render = (() => {
  const HW = 32, HH = 16, ISO_R = Math.SQRT2;
  const S = G.sprites;
  const R = {
    canvas: null, ctx: null, W: 0, H: 0, dpr: 1,
    cam: { x: 0, y: 0, zoom: 1.25, follow: true },
    cache: null, ox: 0, mini: null, light: null, theme: 'meadow', time: 0, waterTiles: [],
  };
  const iso = (x, y) => [(x - y) * HW, (x + y) * HH];

  function init(canvas) {
    R.canvas = canvas; R.ctx = canvas.getContext('2d');
    R.light = document.createElement('canvas');
    resize();
    window.addEventListener('resize', resize);
  }
  function resize() {
    R.dpr = Math.min(window.devicePixelRatio || 1, 2);
    R.W = window.innerWidth; R.H = window.innerHeight;
    R.canvas.width = R.W * R.dpr; R.canvas.height = R.H * R.dpr;
    R.canvas.style.width = R.W + 'px'; R.canvas.style.height = R.H + 'px';
    // lighting is soft, so it renders at half resolution
    R.light.width = Math.ceil(R.W / 2); R.light.height = Math.ceil(R.H / 2);
    // the vignette never changes between resizes, so draw it once
    R.vig = document.createElement('canvas'); R.vig.width = Math.ceil(R.W / 2); R.vig.height = Math.ceil(R.H / 2);
    const vx = R.vig.getContext('2d'), w2 = R.vig.width, h2 = R.vig.height;
    const g = vx.createRadialGradient(w2 / 2, h2 / 2, Math.min(w2, h2) * 0.45, w2 / 2, h2 / 2, Math.max(w2, h2) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
    vx.fillStyle = g; vx.fillRect(0, 0, w2, h2);
  }

  function toScreen(x, y) {
    const [ix, iy] = iso(x, y), [cx, cy] = iso(R.cam.x, R.cam.y);
    return { x: (ix - cx) * R.cam.zoom + R.W / 2, y: (iy - cy) * R.cam.zoom + R.H / 2 };
  }
  function toWorld(sx, sy) {
    const [cx, cy] = iso(R.cam.x, R.cam.y);
    const ix = (sx - R.W / 2) / R.cam.zoom + cx, iy = (sy - R.H / 2) / R.cam.zoom + cy;
    return { x: (ix / HW + iy / HH) / 2, y: (iy / HH - ix / HW) / 2 };
  }
  function centerOn(p, instant) {
    if (instant) { R.cam.x = p.x; R.cam.y = p.y; }
    R.cam.follow = true;
  }
  function clampCam() {
    const g = G.world.grid;
    if (!g) return;
    R.cam.x = G.util.clamp(R.cam.x, 0, g.w);
    R.cam.y = G.util.clamp(R.cam.y, 0, g.h);
  }

  /* ---------------- palettes ---------------- */
  const PAL = {
    village: { bg: '#2a3320', grass: ['#6b8c4a', '#7d9c55', '#5f8044'], dirt: '#a3845a', stone: '#9b978c', water: '#3d7898', field: '#b49a50', mud: '#6d6044' },
    meadow: { bg: '#2c3a22', grass: ['#79a252', '#8cb05e', '#6a964a'], dirt: '#ab8a5c', stone: '#9b978c', water: '#3f80a0', field: '#c2a654', mud: '#6d6044' },
    forest: { bg: '#18241a', grass: ['#4a6a3a', '#577842', '#3f5e33'], dirt: '#7d6645', stone: '#7a776c', water: '#355f72', field: '#8a7a40', mud: '#5d5038' },
    swamp: { bg: '#1c2420', grass: ['#56653e', '#62714a', '#4a5838'], dirt: '#6a5d40', stone: '#6f6c60', water: '#36574b', field: '#7a7040', mud: '#5d5236' },
    cave: { bg: '#0a0807', grass: ['#3a302d', '#40352f', '#342b28'], dirt: '#4a3d34', stone: '#4a4440', water: '#2a3a40', field: '#4a3d34', mud: '#3a302a', cave: ['#56473d', '#615044', '#4c3f36'], rock: '#100c0b' },
  };
  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  function tileColor(pal, t, sh) {
    const T = G.T;
    if (t === T.GRASS) { const g = pal.grass.map(hexToRgb); return sh < 0.5 ? mix(g[2], g[0], sh * 2) : mix(g[0], g[1], (sh - 0.5) * 2); }
    if (t === T.CAVE) { const g = pal.cave.map(hexToRgb); return sh < 0.5 ? mix(g[2], g[0], sh * 2) : mix(g[0], g[1], (sh - 0.5) * 2); }
    const base = hexToRgb({ [T.DIRT]: pal.dirt, [T.STONE]: pal.stone, [T.WATER]: pal.water, [T.FIELD]: pal.field, [T.MUD]: pal.mud, [T.ROCK]: pal.rock || '#222' }[t]);
    return mix(base, [0, 0, 0], (0.5 - sh) * 0.18);
  }

  /* ---------------- terrain cache ---------------- */
  function buildZone(grid, Z) {
    R.theme = Z.theme;
    const pal = PAL[Z.theme];
    const cw = (grid.w + grid.h) * HW, ch = (grid.w + grid.h) * HH + 4;
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const x = c.getContext('2d');
    R.ox = grid.h * HW;
    const ox = R.ox;
    x.fillStyle = pal.bg; x.fillRect(0, 0, cw, ch);
    const T = G.T;
    const diamond = (tx, ty, grow = 0.6) => {
      const [ix, iy] = iso(tx, ty);
      x.beginPath();
      x.moveTo(ox + ix, iy - grow); x.lineTo(ox + ix + HW + grow, iy + HH); x.lineTo(ox + ix, iy + 2 * HH + grow); x.lineTo(ox + ix - HW - grow, iy + HH); x.closePath();
    };
    const blob = (tx, ty, col, rad, alpha) => {
      const [ix, iy] = iso(tx + 0.5, ty + 0.5);
      const g = x.createRadialGradient(ox + ix, iy, 0, ox + ix, iy, rad * HW);
      g.addColorStop(0, css(col, alpha)); g.addColorStop(0.6, css(col, alpha * 0.8)); g.addColorStop(1, css(col, 0));
      x.fillStyle = g;
      x.beginPath(); x.ellipse(ox + ix, iy, rad * HW, rad * HH, 0, 0, Math.PI * 2); x.fill();
    };
    // 1) base: everything as the "background ground"
    for (let ty = 0; ty < grid.h; ty++) for (let tx = 0; tx < grid.w; tx++) {
      const t = grid.tiles[ty * grid.w + tx];
      const sh = grid.shade[ty * grid.w + tx];
      const baseT = Z.cave ? (t === T.ROCK ? T.ROCK : T.CAVE) : T.GRASS;
      x.fillStyle = css(tileColor(pal, baseT, sh));
      diamond(tx, ty); x.fill();
    }
    // 2) painted ground types as soft blobs, in layering order
    const order = [T.FIELD, T.MUD, T.DIRT, T.STONE];
    for (const layer of order) for (let ty = 0; ty < grid.h; ty++) for (let tx = 0; tx < grid.w; tx++) {
      const k = ty * grid.w + tx;
      if (grid.tiles[k] !== layer) continue;
      const col = tileColor(pal, layer, grid.shade[k]);
      x.fillStyle = css(col, 0.9); diamond(tx, ty, -2); x.fill();
      blob(tx, ty, col, 1.05, 0.85);
    }
    // crop rows on fields
    for (let ty = 0; ty < grid.h; ty++) for (let tx = 0; tx < grid.w; tx++) {
      if (grid.tiles[ty * grid.w + tx] !== T.FIELD) continue;
      for (let i = 0; i < 3; i++) {
        const [ix, iy] = iso(tx + 0.2 + i * 0.3, ty + 0.5);
        x.strokeStyle = 'rgba(120,90,30,0.55)'; x.lineWidth = 1;
        x.beginPath(); x.moveTo(ox + ix - 5, iy - 2); x.lineTo(ox + ix + 5, iy + 3); x.stroke();
        x.strokeStyle = 'rgba(235,205,110,0.75)'; x.lineWidth = 1.4;
        for (let j = 0; j < 3; j++) { x.beginPath(); x.moveTo(ox + ix - 4 + j * 4, iy - 1 + j * 1.5); x.lineTo(ox + ix - 4 + j * 4, iy - 7 + j * 1.5); x.stroke(); }
      }
    }
    // 3) water
    R.waterTiles = [];
    const wcol = hexToRgb(pal.water);
    for (let ty = 0; ty < grid.h; ty++) for (let tx = 0; tx < grid.w; tx++) {
      if (grid.tiles[ty * grid.w + tx] !== T.WATER) continue;
      R.waterTiles.push([tx, ty]);
      blob(tx, ty, mix(wcol, [200, 220, 200], 0.25), 1.25, 0.7);
    }
    for (const [tx, ty] of R.waterTiles) {
      const sh = grid.shade[ty * grid.w + tx];
      x.fillStyle = css(mix(wcol, [10, 20, 30], 0.15 + sh * 0.2)); diamond(tx, ty, 0.8); x.fill();
    }
    // 4) decor
    const rr = G.util.rng(Z.seed + 5);
    for (const d of grid.decor) {
      const [ix, iy] = iso(d.x, d.y);
      const px = ox + ix, py = iy;
      if (Z.cave) {
        if (d.v < 3) { // ember cracks
          x.strokeStyle = 'rgba(255,110,30,0.55)'; x.lineWidth = 1.4;
          x.beginPath(); x.moveTo(px - 6, py); x.lineTo(px - 1, py - 2); x.lineTo(px + 3, py + 1); x.lineTo(px + 8, py - 1); x.stroke();
          x.strokeStyle = 'rgba(255,200,90,0.5)'; x.lineWidth = 0.6; x.stroke();
        } else if (d.v < 6) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.ellipse(px, py, 3, 1.5, 0, 0, 7); x.fill(); x.fillStyle = '#5a4d45'; x.beginPath(); x.ellipse(px, py - 1, 2.5, 1.6, 0, 0, 7); x.fill(); }
        else { x.fillStyle = '#d8d0c0'; x.fillRect(px - 3, py - 1, 6, 1.4); x.fillRect(px - 1, py - 3, 1.4, 5); }
        continue;
      }
      if (d.t === T.GRASS) {
        if (d.v < 5) { // tufts
          x.strokeStyle = Z.theme === 'swamp' ? 'rgba(120,140,70,0.8)' : Z.theme === 'forest' ? 'rgba(110,150,80,0.75)' : 'rgba(150,190,100,0.8)';
          x.lineWidth = 1;
          for (let i = -2; i <= 2; i++) { x.beginPath(); x.moveTo(px + i * 1.5, py); x.lineTo(px + i * 2.2, py - 4 - Math.abs(i % 2) * 2); x.stroke(); }
        } else if (d.v < 7 && Z.theme !== 'swamp') { // flowers
          const fc = Z.theme === 'forest' ? ['#c8b8ff', '#ffffff'] : ['#ffe066', '#ffffff', '#f5a3c7', '#a3c4f5'];
          for (let i = 0; i < 3; i++) { x.fillStyle = fc[(d.v + i) % fc.length]; x.beginPath(); x.arc(px + (rr() - 0.5) * 8, py + (rr() - 0.5) * 4, 1.3, 0, 7); x.fill(); }
        } else if (d.v === 7) { x.fillStyle = '#8a857a'; x.beginPath(); x.ellipse(px, py, 2.6, 1.6, 0, 0, 7); x.fill(); }
        else if (Z.theme === 'swamp') { x.strokeStyle = 'rgba(90,110,60,0.9)'; x.lineWidth = 1.2; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(px + i * 2 - 3, py); x.lineTo(px + i * 2 - 4, py - 9 - i); x.stroke(); } x.fillStyle = '#5a3d24'; x.fillRect(px - 2, py - 12, 2, 4); }
        else if (Z.theme === 'forest') { x.fillStyle = '#c45a3a'; x.beginPath(); x.arc(px, py - 2, 2, Math.PI, 0); x.fill(); x.fillStyle = '#eee'; x.fillRect(px - 0.5, py - 2, 1, 2); }
      } else if (d.t === T.DIRT || d.t === T.MUD) {
        x.fillStyle = 'rgba(60,45,30,0.35)'; x.beginPath(); x.ellipse(px, py, 2, 1.2, 0, 0, 7); x.fill();
      } else if (d.t === T.STONE) {
        x.strokeStyle = 'rgba(70,65,60,0.35)'; x.lineWidth = 1; x.beginPath(); x.moveTo(px - 6, py); x.lineTo(px, py - 3); x.lineTo(px + 6, py); x.stroke();
      }
    }
    // edge darkening for map rim
    R.cache = c;
    buildMinimap(grid, Z);
    // props list with iso positions
    R.props = grid.props;
  }

  function buildMinimap(grid, Z) {
    const m = document.createElement('canvas');
    const mw = 440, mh = 220;
    m.width = mw; m.height = mh;
    const x = m.getContext('2d');
    x.drawImage(R.cache, 0, 0, mw, mh);
    // blockers as darker dots
    const sx = mw / R.cache.width, sy = mh / R.cache.height;
    for (const p of grid.props) {
      const [ix, iy] = iso(p.x + (p.w || 1) / 2, p.y + (p.h || 1) / 2);
      x.fillStyle = p.kind === 'tree' ? 'rgba(20,40,15,0.55)' : p.kind === 'building' ? '#c9a46a' : p.kind === 'cavewall' ? 'rgba(10,8,8,0.6)' : 'rgba(60,50,40,0.6)';
      const s = p.kind === 'building' ? 8 : 3.2;
      x.fillRect((R.ox + ix) * sx - s / 2, (iy + HH) * sy - s / 2, s, s);
    }
    R.mini = m;
    R.miniScale = { sx, sy };
  }

  /* ---------------- frame ---------------- */
  function draw(dt) {
    R.time += dt;
    const ctx = R.ctx, cam = R.cam;
    const world = G.world;
    if (!world.grid || !R.cache) return;
    // camera follow
    const lead = G.input.activeHero();
    if (cam.follow && lead) {
      const k = 1 - Math.pow(0.0015, dt);
      cam.x += (lead.x - cam.x) * k; cam.y += (lead.y - cam.y) * k;
    }
    clampCam();
    const [sx0, sy0] = G.fx.shakeOffset();
    const z = cam.zoom;
    const [cx, cy] = iso(cam.x, cam.y);
    ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    ctx.fillStyle = PAL[R.theme].bg;
    ctx.fillRect(0, 0, R.W, R.H);
    ctx.save();
    ctx.translate(R.W / 2 + sx0, R.H / 2 + sy0);
    ctx.scale(z, z);
    ctx.translate(-cx, -cy);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(R.cache, -R.ox, 0);

    // view bounds in iso space
    const vx0 = cx - R.W / 2 / z - 80, vx1 = cx + R.W / 2 / z + 80;
    const vy0 = cy - R.H / 2 / z - 40, vy1 = cy + R.H / 2 / z + 140;
    const visible = (ix, iy) => ix > vx0 && ix < vx1 && iy > vy0 && iy < vy1;

    const skip = R.skip || {};
    if (!skip.water) drawWater(ctx, visible);
    if (!skip.ground) drawGround(ctx, visible);

    // collect drawables: small things sort by a single ground point, big things
    // (buildings, gates, the mill) by their whole footprint
    const list = [], bigs = [];
    for (const p of R.props) {
      if (p.kind === 'building' || p.kind === 'gate') {
        const [ix, iy] = iso(p.x + p.w / 2, p.y + p.h / 2);
        if (!(ix > vx0 - 160 && ix < vx1 + 160 && iy > vy0 - 160 && iy < vy1 + 160)) continue;
        bigs.push({ p, foot: [p.x, p.y, p.w, p.h], d: p.x + p.y });
        continue;
      }
      const off = p.kind === 'cavewall' || p.kind === 'fence' || p.kind === 'palisade' ? 0.5 : 0;
      const wx = p.x + off, wy = p.y + off;
      const [ix, iy] = iso(wx, wy);
      if (!visible(ix, iy)) continue;
      list.push({ d: p.depth, p, wx, wy, ix, iy });
    }
    for (const e of world.entities) {
      const [ix, iy] = iso(e.x, e.y);
      if (e.kind === 'structure') {
        if (!(ix > vx0 - 160 && ix < vx1 + 160 && iy > vy0 - 160 && iy < vy1 + 160)) continue;
        bigs.push({ e, foot: e.foot, d: e.foot[0] + e.foot[1] });
        continue;
      }
      if (!visible(ix, iy)) continue;
      if (e.kind === 'object' && !world.objVisible(e)) continue;
      let d = e.x + e.y;
      if (e.dead) d -= 0.3;
      list.push({ d, e, wx: e.x, wy: e.y, ix, iy });
    }
    list.sort((a, b) => a.d - b.d);
    bigs.sort((a, b) => a.d - b.d);
    for (const b of bigs) placeBig(list, b);
    for (const it of list) {
      if (it.p) { if (!skip.props) drawProp(ctx, it.p); }
      else if (!skip.ents) drawEntity(ctx, it.e, dt);
    }
    if (!skip.fx) drawFx(ctx);
    ctx.restore();

    if (!skip.light && (R.theme === 'cave' || R.theme === 'forest' || R.theme === 'swamp')) drawLighting(ctx);
    if (!skip.overlay) drawOverlay(ctx);
  }

  /* Insert a building-sized item into the depth-sorted list. Anything overlapping it
     on screen is in front if it stands past the footprint's right or front edge,
     otherwise behind. Items in front that sorted too early are moved after it. */
  function placeBig(list, b) {
    const [fx, fy, fw, fh] = b.foot;
    const left = iso(fx, fy + fh)[0] - 12, right = iso(fx + fw, fy)[0] + 12;
    const top = iso(fx, fy)[1] - 150, bottom = iso(fx + fw, fy + fh)[1] + 6;
    let lastBehind = -1;
    const fronts = [];
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      if (it.foot) { // another big item placed earlier
        const [ox, oy, ow, oh] = it.foot;
        const l2 = iso(ox, oy + oh)[0], r2 = iso(ox + ow, oy)[0];
        if (r2 > left && l2 < right) lastBehind = i;
        continue;
      }
      if (it.ix + 30 < left || it.ix - 30 > right || it.iy + 8 < top || it.iy - 90 > bottom) continue;
      const inFront = it.wx >= fx + fw - 0.02 || it.wy >= fy + fh - 0.02;
      if (inFront) fronts.push(i); else lastBehind = i;
    }
    let pos = lastBehind + 1;
    const early = fronts.filter((i) => i < pos);
    const moved = early.map((i) => list[i]);
    for (let k = early.length - 1; k >= 0; k--) list.splice(early[k], 1);
    pos -= early.length;
    list.splice(pos, 0, b, ...moved);
  }

  /* ---------------- ground layer ---------------- */
  function drawWater(ctx, visible) {
    const t = R.time;
    ctx.strokeStyle = 'rgba(220,240,255,0.18)'; ctx.lineWidth = 1;
    for (const [tx, ty] of R.waterTiles) {
      if (((tx * 7 + ty * 13) % 3) !== 0) continue;
      const [ix, iy] = iso(tx + 0.5, ty + 0.5);
      if (!visible(ix, iy)) continue;
      const o = Math.sin(t * 1.3 + tx * 0.7 + ty) * 4;
      ctx.beginPath(); ctx.moveTo(ix - 8 + o, iy); ctx.quadraticCurveTo(ix + o, iy - 2, ix + 8 + o, iy); ctx.stroke();
    }
  }

  function isoEllipse(ctx, x, y, r) { const [ix, iy] = iso(x, y); ctx.beginPath(); ctx.ellipse(ix, iy, r * HW * ISO_R, r * HH * ISO_R, 0, 0, Math.PI * 2); }

  function drawGround(ctx, visible) {
    const inp = G.input;
    // exits
    for (const ex of G.world.zone.exits) {
      const [ix, iy] = iso(ex.x, ex.y);
      if (!visible(ix, iy)) continue;
      const locked = ex.flag && !G.state.flags[ex.flag];
      const pulse = 0.5 + Math.sin(R.time * 3) * 0.2;
      isoEllipse(ctx, ex.x, ex.y, ex.r * 0.9);
      ctx.fillStyle = locked ? `rgba(255,90,40,${0.12 * pulse})` : `rgba(255,230,140,${0.18 * pulse})`; ctx.fill();
      ctx.strokeStyle = locked ? 'rgba(255,90,40,0.4)' : 'rgba(255,230,140,0.55)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]); ctx.stroke(); ctx.setLineDash([]);
    }
    // selection rings
    for (const e of G.world.entities) {
      if (e.dead && e.kind !== 'hero') continue;
      const sel = inp.selected.includes(e);
      const hov = inp.hover === e;
      const tgt = inp.attackTarget === e;
      if (!sel && !hov && !tgt) continue;
      const col = e.team === 'player' ? '#5dff7a' : e.team === 'enemy' ? '#ff5a4a' : '#ffd84a';
      isoEllipse(ctx, e.x, e.y, (e.r + 0.18) * (e.def && e.def.structure ? 1.3 : 1));
      ctx.strokeStyle = col; ctx.lineWidth = sel && inp.activeHero() === e ? 2.6 : 1.6;
      ctx.globalAlpha = hov && !sel ? 0.7 : 1; ctx.stroke(); ctx.globalAlpha = 1;
    }
    // move marker
    if (inp.marker && inp.marker.t > 0) {
      const m = inp.marker, p = m.t / 0.6;
      isoEllipse(ctx, m.x, m.y, 0.15 + (1 - p) * 0.35);
      ctx.strokeStyle = m.attack ? `rgba(255,90,70,${p})` : `rgba(120,255,140,${p})`; ctx.lineWidth = 2; ctx.stroke();
    }
    // telegraphs + ground rings
    for (const f of G.fx.list) {
      if (f.type === 'tele') {
        const p = Math.min(1, f.t / f.dur);
        isoEllipse(ctx, f.x, f.y, f.r);
        ctx.fillStyle = S.rgba(f.color, 0.16 + p * 0.1); ctx.fill();
        ctx.strokeStyle = S.rgba(f.color, 0.8); ctx.lineWidth = 2; ctx.stroke();
        isoEllipse(ctx, f.x, f.y, f.r * p);
        ctx.fillStyle = S.rgba(f.color, 0.25); ctx.fill();
      } else if (f.type === 'ring') {
        const p = f.t / f.dur;
        isoEllipse(ctx, f.x, f.y, f.r * (0.55 + 0.45 * p));
        if (f.fill) { ctx.fillStyle = S.rgba(f.color, 0.18 * (1 - p)); ctx.fill(); }
        ctx.strokeStyle = S.rgba(f.color, 0.9 * (1 - p)); ctx.lineWidth = 2.5; ctx.stroke();
      }
    }
    // targeting preview
    const tg = inp.targeting;
    if (tg) {
      const h = tg.hero, ab = G.ABILITIES[tg.ability];
      if (ab.range) {
        isoEllipse(ctx, h.x, h.y, ab.range);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.setLineDash([8, 6]); ctx.stroke(); ctx.setLineDash([]);
      }
      const m = inp.mouseWorld;
      if (ab.radius && ab.target === 'point') {
        isoEllipse(ctx, m.x, m.y, ab.radius);
        ctx.fillStyle = S.rgba(ab.color, 0.22); ctx.fill(); ctx.strokeStyle = S.rgba(ab.color, 0.9); ctx.lineWidth = 2; ctx.stroke();
      } else if (ab.line) {
        const a = Math.atan2(m.y - h.y, m.x - h.x);
        const [x0, y0] = iso(h.x, h.y), [x1, y1] = iso(h.x + Math.cos(a) * ab.range, h.y + Math.sin(a) * ab.range);
        ctx.strokeStyle = S.rgba(ab.color, 0.5); ctx.lineWidth = ab.line * HW; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.lineCap = 'butt';
      } else if (ab.target === 'point') {
        isoEllipse(ctx, m.x, m.y, 0.6);
        ctx.strokeStyle = S.rgba(ab.color, 0.9); ctx.lineWidth = 2; ctx.stroke();
      }
    }
    // self-AoE preview on ability button hover
    if (inp.previewAbility) {
      const { hero, ability } = inp.previewAbility, ab = G.ABILITIES[ability];
      if (ab.radius && ab.target === 'none') { isoEllipse(ctx, hero.x, hero.y, ab.radius); ctx.fillStyle = S.rgba(ab.color, 0.15); ctx.fill(); ctx.strokeStyle = S.rgba(ab.color, 0.7); ctx.lineWidth = 1.5; ctx.stroke(); }
      else if (ab.range) { isoEllipse(ctx, hero.x, hero.y, ab.range); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5; ctx.setLineDash([8, 6]); ctx.stroke(); ctx.setLineDash([]); }
    }
  }

  /* ---------------- props ---------------- */
  function drawProp(ctx, p) {
    if (p.kind === 'tree') {
      const s = S.treeSprite(R.theme, p.v);
      const [ix, iy] = iso(p.x, p.y);
      const sc = p.s;
      ctx.drawImage(s, ix - s.ax * sc, iy - s.ay * sc, s.lw * sc, s.lh * sc);
      return;
    }
    if (p.kind === 'boulder') {
      const s = S.boulderSprite(R.theme, p.v);
      const [ix, iy] = iso(p.x, p.y);
      ctx.drawImage(s, ix - s.ax * p.s, iy - s.ay * p.s, s.lw * p.s, s.lh * p.s);
      return;
    }
    if (p.kind === 'cavewall') return drawCaveWall(ctx, p);
    if (p.kind === 'fence') return drawFence(ctx, p, false);
    if (p.kind === 'palisade') return drawFence(ctx, p, true);
    if (p.kind === 'building') return drawBuilding(ctx, p);
    if (p.kind === 'gate') return drawGate(ctx, p);
  }

  function drawCaveWall(ctx, p) {
    const h = 18 + p.hgt * 15;
    const [ax, ay] = iso(p.x, p.y), [bx, by] = iso(p.x + 1, p.y), [cx2, cy2] = iso(p.x + 1, p.y + 1), [dx, dy] = iso(p.x, p.y + 1);
    const base = ['#211a18', '#251d1a', '#1e1816', '#271e1e'][p.v];
    ctx.fillStyle = S.shade(base, -0.25);
    ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(cx2, cy2); ctx.lineTo(cx2, cy2 - h); ctx.lineTo(dx, dy - h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = S.shade(base, -0.45);
    ctx.beginPath(); ctx.moveTo(cx2, cy2); ctx.lineTo(bx, by); ctx.lineTo(bx, by - h); ctx.lineTo(cx2, cy2 - h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = S.shade(base, 0.08);
    ctx.beginPath(); ctx.moveTo(ax, ay - h); ctx.lineTo(bx, by - h); ctx.lineTo(cx2, cy2 - h); ctx.lineTo(dx, dy - h); ctx.closePath(); ctx.fill();
    if (p.v === 0) { ctx.strokeStyle = 'rgba(255,120,40,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(dx + 6, dy - h * 0.3); ctx.lineTo(dx + 14, dy - h * 0.55 + 4); ctx.lineTo(dx + 20, dy - h * 0.4 + 6); ctx.stroke(); }
  }

  function drawFence(ctx, p, tall) {
    const [ix, iy] = iso(p.x + 0.5, p.y + 0.5);
    if (tall) {
      for (let i = -1; i <= 1; i++) {
        const x = ix + i * 9, y = iy + i * 2;
        ctx.fillStyle = i === 0 ? '#6a4a2a' : '#5a3d22';
        ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x - 4, y - 34); ctx.lineTo(x, y - 41); ctx.lineTo(x + 4, y - 34); ctx.lineTo(x + 4, y); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.strokeStyle = '#3d2a18'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ix - 14, iy - 12); ctx.lineTo(ix + 14, iy - 10); ctx.stroke();
      return;
    }
    ctx.strokeStyle = '#7a5a36'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(ix - 14, iy - 9); ctx.lineTo(ix + 14, iy - 9); ctx.moveTo(ix - 14, iy - 4); ctx.lineTo(ix + 14, iy - 4); ctx.stroke();
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(ix - 2, iy - 14, 4, 14);
  }

  const BSTYLE = {
    hall: { wall: '#b8a07a', roof: '#6a3a2a', h: 34, r: 22 },
    inn: { wall: '#c9b08a', roof: '#3a5a6a', h: 36, r: 20, sign: '#e8c35a' },
    smithy: { wall: '#8a8078', roof: '#4a3a32', h: 28, r: 16, chimney: true },
    tower: { wall: '#a0a8b8', roof: '#3a3a7a', h: 64, r: 34, cone: true },
    shop: { wall: '#c8b088', roof: '#7a4a2a', h: 28, r: 18, awning: '#c0392b' },
    house: { wall: '#bfa680', roof: '#7a3a2a', h: 26, r: 16 },
    farmhouse: { wall: '#c4a87e', roof: '#8a5a2a', h: 28, r: 18 },
  };

  function drawBuilding(ctx, p) {
    const st = BSTYLE[p.style] || BSTYLE.house;
    const { x, y, w, h } = p;
    const H = st.h;
    const P = (a, b) => iso(a, b);
    const [ax, ay] = P(x, y), [bx, by] = P(x + w, y), [cx2, cy2] = P(x + w, y + h), [dx, dy] = P(x, y + h);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(cx2, cy2); ctx.lineTo(cx2 + 24, cy2 + 4); ctx.lineTo(bx + 24, by + 4); ctx.lineTo(bx, by); ctx.closePath(); ctx.fill();
    // walls
    ctx.fillStyle = st.wall;
    ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(cx2, cy2); ctx.lineTo(cx2, cy2 - H); ctx.lineTo(dx, dy - H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = S.shade(st.wall, -0.22);
    ctx.beginPath(); ctx.moveTo(cx2, cy2); ctx.lineTo(bx, by); ctx.lineTo(bx, by - H); ctx.lineTo(cx2, cy2 - H); ctx.closePath(); ctx.fill();
    // timber frame lines
    ctx.strokeStyle = 'rgba(70,45,25,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(dx, dy - H); ctx.lineTo(cx2, cy2 - H); ctx.lineTo(bx, by - H); ctx.moveTo(dx, dy); ctx.lineTo(dx, dy - H); ctx.moveTo(cx2, cy2); ctx.lineTo(cx2, cy2 - H); ctx.moveTo(bx, by); ctx.lineTo(bx, by - H); ctx.stroke();
    // door on left face, windows
    const fx = (t) => [dx + (cx2 - dx) * t, dy + (cy2 - dy) * t];
    const [doorx, doory] = fx(0.5);
    ctx.fillStyle = '#4a2e1a';
    ctx.beginPath(); ctx.moveTo(doorx - 6, doory + 3 - 3); ctx.lineTo(doorx - 6, doory - 18 - 3); ctx.quadraticCurveTo(doorx, doory - 24, doorx + 6, doory - 18 + 3); ctx.lineTo(doorx + 6, doory + 3); ctx.closePath(); ctx.fill();
    const lit = 'rgba(255,214,120,0.9)';
    for (const t of [0.2, 0.8]) { const [wx, wy] = fx(t); if (H > 26) { ctx.fillStyle = lit; ctx.fillRect(wx - 3.5, wy - H * 0.62, 7, 8); ctx.strokeStyle = '#4a2e1a'; ctx.lineWidth = 1.5; ctx.strokeRect(wx - 3.5, wy - H * 0.62, 7, 8); } }
    const rx = (t) => [cx2 + (bx - cx2) * t, cy2 + (by - cy2) * t];
    for (const t of [0.33, 0.7]) { const [wx, wy] = rx(t); ctx.fillStyle = 'rgba(255,214,120,0.7)'; ctx.fillRect(wx - 3, wy - H * 0.62, 6, 8); }
    if (st.awning) drawAwning(ctx, fx, H, dx, dy, cx2, cy2, st.awning);
    // roof
    const ov = 0.25;
    const top = (a, b) => { const [ix, iy] = iso(a, b); return [ix, iy - H]; };
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
    if (st.cone) {
      const [tx, ty] = top(x + w / 2, y + h / 2);
      const rr = (w / 2 + 0.08) * HW * ISO_R;
      ctx.fillStyle = st.roof;
      ctx.beginPath(); ctx.moveTo(tx - rr, ty); ctx.lineTo(tx, ty - st.r * 1.5); ctx.lineTo(tx + rr, ty); ctx.ellipse(tx, ty, rr, rr / 2, 0, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = S.shade(st.roof, 0.2); ctx.beginPath(); ctx.moveTo(tx - rr * 0.6, ty + 2); ctx.lineTo(tx, ty - st.r * 1.5); ctx.lineTo(tx - rr * 0.1, ty + 6); ctx.fill();
      ctx.fillStyle = '#9fe8ff'; ctx.beginPath(); ctx.arc(tx, ty - st.r * 1.5 - 3, 3 + Math.sin(R.time * 3), 0, 7); ctx.fill();
      return;
    }
    const alongX = w >= h;
    let A, B, C, D, P1, P2;
    A = top(x - ov, y - ov); B = top(x + w + ov, y - ov); C = top(x + w + ov, y + h + ov); D = top(x - ov, y + h + ov);
    if (alongX) { P1 = top(x - ov, y + h / 2); P2 = top(x + w + ov, y + h / 2); }
    else { P1 = top(x + w / 2, y - ov); P2 = top(x + w / 2, y + h + ov); }
    P1[1] -= st.r; P2[1] -= st.r;
    const poly = (pts, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) ctx.lineTo(q[0], q[1]); ctx.closePath(); ctx.fill(); ctx.stroke(); };
    if (alongX) {
      poly([A, B, P2, P1], S.shade(st.roof, -0.25));
      poly([B, C, P2], S.shade(st.wall, -0.1));
      poly([D, C, P2, P1], st.roof);
    } else {
      poly([A, D, P2, P1], S.shade(st.roof, -0.25));
      poly([D, C, P2], S.shade(st.wall, -0.05));
      poly([B, C, P2, P1], S.shade(st.roof, -0.1));
    }
    // shingle lines
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    for (let i = 1; i < 4; i++) {
      const t = i / 4;
      const L1 = alongX ? [D[0] + (P1[0] - D[0]) * t, D[1] + (P1[1] - D[1]) * t] : [B[0] + (P1[0] - B[0]) * t, B[1] + (P1[1] - B[1]) * t];
      const L2 = alongX ? [C[0] + (P2[0] - C[0]) * t, C[1] + (P2[1] - C[1]) * t] : [C[0] + (P2[0] - C[0]) * t, C[1] + (P2[1] - C[1]) * t];
      ctx.beginPath(); ctx.moveTo(L1[0], L1[1]); ctx.lineTo(L2[0], L2[1]); ctx.stroke();
    }
    if (st.chimney) {
      const [chx, chy] = top(x + w * 0.7, y + h * 0.3);
      ctx.fillStyle = '#5a4a42'; ctx.fillRect(chx - 4, chy - st.r - 10, 8, 18);
      for (let i = 0; i < 3; i++) { const t = (R.time * 0.6 + i / 3) % 1; ctx.fillStyle = `rgba(200,200,200,${0.35 * (1 - t)})`; ctx.beginPath(); ctx.arc(chx + Math.sin(t * 5 + i) * 4, chy - st.r - 12 - t * 30, 3 + t * 5, 0, 7); ctx.fill(); }
      ctx.fillStyle = `rgba(255,140,40,${0.5 + Math.sin(R.time * 9) * 0.2})`;
      const [fx2, fy2] = fx(0.2); ctx.fillRect(fx2 - 4, fy2 - 12, 8, 8);
    }
    if (st.sign) { const [sx2, sy2] = fx(0.85); ctx.fillStyle = '#4a2e1a'; ctx.fillRect(sx2 + 4, sy2 - H * 0.7, 2, 10); ctx.fillStyle = st.sign; ctx.fillRect(sx2 + 2, sy2 - H * 0.7 + 8, 12, 8); }
  }

  // A striped canvas awning sloping out from the front wall over the door, with a
  // small hanging shop sign at its end.
  function drawAwning(ctx, fx, H, dx, dy, cx2, cy2, color) {
    const out = 0.7, drop = 9, hTop = H * 0.86, t0 = 0.28, t1 = 0.72, n = 6;
    const cream = '#f3e6c8';
    const P = (t, o, h) => { const [px, py] = fx(t); return [px - 32 * o, py + 16 * o - h]; };
    const quad = (q, fill) => { ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); for (let i = 1; i < q.length; i++) ctx.lineTo(q[i][0], q[i][1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
    // shadow cast on the wall under the awning
    quad([P(t0, 0, hTop), P(t1, 0, hTop), P(t1, 0, hTop - drop - 7), P(t0, 0, hTop - drop - 7)], 'rgba(0,0,0,0.18)');
    for (let i = 0; i < n; i++) {
      const a = t0 + ((t1 - t0) * i) / n, b = t0 + ((t1 - t0) * (i + 1)) / n;
      quad([P(a, 0, hTop), P(b, 0, hTop), P(b, out, hTop - drop), P(a, out, hTop - drop)], i % 2 ? cream : color);
    }
    // scalloped front edge
    const L = Math.hypot(cx2 - dx, cy2 - dy), seg = (L * (t1 - t0)) / n, ang = Math.atan2(cy2 - dy, cx2 - dx);
    for (let i = 0; i < n; i++) {
      const [sx, sy] = P(t0 + ((t1 - t0) * (i + 0.5)) / n, out, hTop - drop);
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(ang);
      ctx.beginPath(); ctx.ellipse(0, 0, seg / 2, 3.2, 0, 0, Math.PI); ctx.fillStyle = i % 2 ? cream : color; ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(40,20,10,0.45)'; ctx.lineWidth = 1;
    const e0 = P(t0, 0, hTop), e1 = P(t1, 0, hTop), e2 = P(t1, out, hTop - drop), e3 = P(t0, out, hTop - drop);
    ctx.beginPath(); ctx.moveTo(e0[0], e0[1]); ctx.lineTo(e3[0], e3[1]); ctx.lineTo(e2[0], e2[1]); ctx.lineTo(e1[0], e1[1]); ctx.stroke();
    // hanging sign
    const [hx, hy] = P(t1 + 0.04, out * 0.75, hTop - drop - 1);
    ctx.strokeStyle = '#3a2416'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hx - 3, hy); ctx.lineTo(hx - 3, hy + 4); ctx.moveTo(hx + 3, hy); ctx.lineTo(hx + 3, hy + 4); ctx.stroke();
    ctx.fillStyle = '#8a5a2e'; ctx.fillRect(hx - 6, hy + 4, 12, 9);
    ctx.strokeStyle = '#3a2416'; ctx.strokeRect(hx - 6, hy + 4, 12, 9);
    ctx.fillStyle = '#d9483a'; ctx.beginPath(); ctx.arc(hx, hy + 8.5, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4f8a3a'; ctx.fillRect(hx - 0.5, hy + 5, 1.4, 2);
  }

  function drawGate(ctx, p) {
    const g = p.gate;
    const [cx2, cy2] = iso(p.x + p.w / 2, p.y + p.h / 2);
    if (p.style === 'barrowgate') {
      // stone arch with ember-glass door
      ctx.fillStyle = '#5a5550';
      ctx.fillRect(cx2 - 46, cy2 - 54, 16, 54); ctx.fillRect(cx2 + 30, cy2 - 54, 16, 54);
      ctx.beginPath(); ctx.moveTo(cx2 - 50, cy2 - 50); ctx.quadraticCurveTo(cx2, cy2 - 92, cx2 + 50, cy2 - 50); ctx.lineTo(cx2 + 50, cy2 - 40); ctx.quadraticCurveTo(cx2, cy2 - 78, cx2 - 50, cy2 - 40); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
      if (!g.open) {
        const pul = 0.6 + Math.sin(R.time * 2) * 0.2;
        const gr = ctx.createLinearGradient(0, cy2 - 64, 0, cy2);
        gr.addColorStop(0, `rgba(255,140,40,${pul})`); gr.addColorStop(1, `rgba(140,40,10,${pul})`);
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.moveTo(cx2 - 30, cy2); ctx.lineTo(cx2 - 30, cy2 - 44); ctx.quadraticCurveTo(cx2, cy2 - 70, cx2 + 30, cy2 - 44); ctx.lineTo(cx2 + 30, cy2); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,220,150,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx2 - 20, cy2 - 6); ctx.lineTo(cx2 - 4, cy2 - 30); ctx.lineTo(cx2 + 10, cy2 - 14); ctx.lineTo(cx2 + 22, cy2 - 40); ctx.stroke();
      } else {
        ctx.fillStyle = '#120c0a';
        ctx.beginPath(); ctx.moveTo(cx2 - 30, cy2); ctx.lineTo(cx2 - 30, cy2 - 44); ctx.quadraticCurveTo(cx2, cy2 - 70, cx2 + 30, cy2 - 44); ctx.lineTo(cx2 + 30, cy2); ctx.closePath(); ctx.fill();
      }
      return;
    }
    // ember crystal wall
    if (!g.open) {
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        const [ix, iy] = iso(p.x + 0.3 + t * (p.w - 0.6), p.y + 0.3 + t * (p.h - 0.6) * 0 + p.h / 2);
        const hgt = 30 + ((i * 37) % 20);
        const pul = 0.75 + Math.sin(R.time * 3 + i) * 0.25;
        ctx.fillStyle = `rgba(255,${110 + i * 8},40,${pul})`;
        ctx.beginPath(); ctx.moveTo(ix - 7, iy); ctx.lineTo(ix - 2, iy - hgt); ctx.lineTo(ix + 7, iy); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,230,180,0.7)'; ctx.lineWidth = 1; ctx.stroke();
      }
    } else {
      ctx.fillStyle = 'rgba(120,60,30,0.8)';
      for (let i = 0; i < 9; i++) { const [ix, iy] = iso(p.x + (i * 0.47) % p.w, p.y + ((i * 0.73) % p.h)); ctx.beginPath(); ctx.moveTo(ix - 4, iy); ctx.lineTo(ix, iy - 5); ctx.lineTo(ix + 4, iy); ctx.fill(); }
    }
  }

  /* ---------------- entities ---------------- */
  function drawEntity(ctx, e, dt) {
    const [ix, iy] = iso(e.x, e.y);
    if (e.kind === 'object') return drawObject(ctx, e, ix, iy);
    if (e.kind === 'loot') return drawLoot(ctx, e, ix, iy);
    if (e.kind === 'structure') return drawMill(ctx, e);
    const d = e.def || {};
    const size = d.size || 1;
    ctx.save();
    ctx.translate(ix, iy);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(0, 0, e.r * HW * 1.25, e.r * HH * 1.25, 0, 0, Math.PI * 2); ctx.fill();
    if (e.dead) {
      if (e.kind === 'hero') {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#7a7266'; S.rrect(ctx, -5, -16, 10, 16, 4); ctx.fill();
        ctx.fillStyle = '#5a5248'; ctx.fillRect(-1.2, -13, 2.4, 8); ctx.fillRect(-4, -11, 8, 2.4);
        ctx.restore(); return;
      }
      ctx.globalAlpha = Math.max(0, 1 - (e.deathT || 0) / 3);
      ctx.scale(1, 0.55); ctx.rotate(e.facing > 0 ? 0.25 : -0.25);
    }
    if (e.moving) e.wp = (e.wp || 0) + dt * 11 * (e.speed / 3);
    const vw = viewOf(e, dt);
    const st = {
      walk: e.wp || 0, moving: e.moving, t: e.anim || 0,
      atk: e.swing > 0 ? 1 - e.swing / (e.swingDur || 0.3) : 0,
      cast: e.castAnim > 0 || !!e.channel, flip: vw.flip, view: vw.view,
    };
    if (e.spinning > 0) ctx.rotate(Math.sin(R.time * 30) * 0.3);
    if (d.ghost) ctx.globalAlpha *= 0.8;
    if (e.stunned) { st.moving = false; }
    S.unit(ctx, 1.3 * size, e, st);
    if (e.flash > 0) {
      // hit flash: redraw additively instead of using ctx.filter, which is slow
      const ga = ctx.globalAlpha;
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = ga * 0.45;
      S.unit(ctx, 1.3 * size, e, st);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = ga;
    }
    // stun stars
    if (e.stunned) {
      for (let i = 0; i < 3; i++) { const a = R.time * 5 + i * 2.1; ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(Math.cos(a) * 9, -50 * size + Math.sin(a) * 3, 2.2, 0, 7); ctx.fill(); }
    }
    // buff glows
    if (e.buffs.some((b) => b.id === 'roar')) { ctx.strokeStyle = 'rgba(255,215,100,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, -2, 14, 6, 0, 0, 7); ctx.stroke(); }
    if (e.buffs.some((b) => b.id === 'mark')) { ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -60 * size, 5, 0, 7); ctx.moveTo(-8, -60 * size); ctx.lineTo(8, -60 * size); ctx.moveTo(0, -68 * size); ctx.lineTo(0, -52 * size); ctx.stroke(); }
    if (e.buffs.some((b) => b.id === 'smoke')) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#b9acd6'; ctx.beginPath(); ctx.arc(0, -20, 18, 0, 7); ctx.fill(); }
    if (e.kind === 'summon' && e.ttl < 5 && e.ttl > 0) { ctx.globalAlpha = 0.5 + Math.sin(R.time * 12) * 0.3; }
    if (e.channel) { ctx.strokeStyle = 'rgba(255,240,180,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -22, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - e.channel.t / e.channel.dur)); ctx.stroke(); }
    ctx.restore();
  }

  /* Which of the 8 screen directions a unit faces. The on-screen angle turns smoothly
     toward the unit's real heading, and the pose only changes once the angle is well
     inside the next sector, so units don't flicker between poses while jostling. */
  const VIEW_MAP = [[2, false], [1, false], [0, null], [1, true], [2, true], [3, true], [4, null], [3, false]];
  function viewOf(e, dt) {
    const f = e.facing || 0;
    const target = Math.atan2((Math.cos(f) + Math.sin(f)) * 0.5, Math.cos(f) - Math.sin(f));
    if (e.sAng == null) e.sAng = target;
    let d = target - e.sAng; d = Math.atan2(Math.sin(d), Math.cos(d));
    e.sAng += d * Math.min(1, dt * 12);
    const raw = e.sAng / (Math.PI / 4);
    let sec = e.sec;
    if (sec == null) sec = Math.round(raw);
    else { const diff = ((((raw - sec) % 8) + 12) % 8) - 4; if (Math.abs(diff) > 0.65) sec = Math.round(raw); }
    sec = ((sec % 8) + 8) % 8;
    e.sec = sec;
    const [view, flip] = VIEW_MAP[sec];
    if (flip !== null) e.vflip = flip;
    return { view, flip: !!e.vflip };
  }

  function drawMill(ctx, e) {
    const [fx, fy, fw, fh] = e.foot;
    drawBuilding(ctx, { x: fx, y: fy, w: fw, h: fh, style: 'mill' in BSTYLE ? 'mill' : 'house' });
    // tower + sails
    const [tx, ty] = iso(fx + fw / 2, fy + fh / 2);
    ctx.fillStyle = e.dead ? '#3a3632' : '#d8c8a8';
    ctx.beginPath(); ctx.moveTo(tx - 16, ty - 20); ctx.lineTo(tx - 11, ty - 74); ctx.lineTo(tx + 11, ty - 74); ctx.lineTo(tx + 16, ty - 20); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.stroke();
    ctx.fillStyle = '#6a3a2a'; ctx.beginPath(); ctx.moveTo(tx - 14, ty - 72); ctx.lineTo(tx, ty - 90); ctx.lineTo(tx + 14, ty - 72); ctx.closePath(); ctx.fill();
    if (!e.dead) {
      const a0 = R.time * (G.events.active ? 0.4 : 1.1);
      ctx.save(); ctx.translate(tx + 4, ty - 66);
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.save(); ctx.rotate(a0);
        ctx.fillStyle = '#efe6d2'; ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 1.2;
        ctx.fillRect(3, -4, 34, 8); ctx.strokeRect(3, -4, 34, 8);
        ctx.restore();
      }
      ctx.fillStyle = '#4a2e1a'; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, 7); ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(255,120,40,0.7)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(tx - 10 + i * 5, ty - 30 - Math.sin(R.time * 8 + i) * 6, 4, 0, 7); ctx.fill(); }
    }
  }
  BSTYLE.mill = { wall: '#b8a07a', roof: '#6a3a2a', h: 20, r: 10 };

  function drawObject(ctx, e, ix, iy) {
    const k = e.objKind, used = G.world.objUsed(e), t = R.time + e.anim;
    ctx.save(); ctx.translate(ix, iy);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 0, 14, 6, 0, 0, 7); ctx.fill();
    switch (k) {
      case 'waystone': {
        const on = G.state.waystones[e.objId];
        ctx.fillStyle = '#7a7a84'; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-6, -40); ctx.lineTo(0, -46); ctx.lineTo(6, -40); ctx.lineTo(9, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#9a9aa4'; ctx.beginPath(); ctx.moveTo(-6, -40); ctx.lineTo(0, -46); ctx.lineTo(1, -2); ctx.lineTo(-9, 0); ctx.closePath(); ctx.fill();
        const glow = on ? '#7fe3ff' : '#8a8a9a';
        ctx.strokeStyle = glow; ctx.lineWidth = 1.6; ctx.globalAlpha = on ? 0.7 + Math.sin(t * 2.5) * 0.3 : 0.6;
        ctx.beginPath(); ctx.moveTo(-2, -34); ctx.lineTo(2, -28); ctx.lineTo(-2, -22); ctx.lineTo(2, -16); ctx.moveTo(-3, -10); ctx.lineTo(3, -10); ctx.stroke();
        if (on) { const g = ctx.createRadialGradient(0, -28, 0, 0, -28, 20); g.addColorStop(0, 'rgba(127,227,255,0.35)'); g.addColorStop(1, 'rgba(127,227,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -28, 20, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
        break;
      }
      case 'cage':
        ctx.fillStyle = '#5a3d24'; ctx.fillRect(-14, -3, 28, 4); ctx.fillRect(-14, -34, 28, 4);
        if (!used) { ctx.save(); ctx.translate(0, -2); S.unit(ctx, 0.75, { kind: 'hero', heroId: 'tobin' }, { t }); ctx.restore(); questSparkle(ctx, t); }
        ctx.strokeStyle = '#4a3420'; ctx.lineWidth = 2.4;
        for (let i = 0; i < 6; i++) { const x = -12 + i * 4.8; if (used && (i === 2 || i === 3)) continue; ctx.beginPath(); ctx.moveTo(x, -2); ctx.lineTo(x, -32); ctx.stroke(); }
        break;
      case 'cocoon':
        if (used) { ctx.fillStyle = 'rgba(230,225,215,0.5)'; ctx.beginPath(); ctx.ellipse(0, -2, 10, 4, 0, 0, 7); ctx.fill(); break; }
        ctx.fillStyle = '#e9e4d8'; ctx.beginPath(); ctx.ellipse(0, -18, 9, 18, Math.sin(t) * 0.05, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(160,150,130,0.7)'; ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-9, -30 + i * 6); ctx.quadraticCurveTo(0, -27 + i * 6, 9, -31 + i * 6); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(240,240,240,0.5)'; ctx.beginPath(); ctx.moveTo(0, -36); ctx.lineTo(-14, -60); ctx.moveTo(0, -36); ctx.lineTo(12, -62); ctx.stroke();
        questSparkle(ctx, t);
        break;
      case 'seal':
        ctx.fillStyle = '#3a3230'; ctx.fillRect(-10, -8, 20, 8); ctx.fillStyle = '#4a403c'; ctx.fillRect(-12, -10, 24, 3);
        if (used) { ctx.fillStyle = 'rgba(80,60,50,0.9)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-8 + i * 4, -10); ctx.lineTo(-6 + i * 4, -14); ctx.lineTo(-4 + i * 4, -10); ctx.fill(); } break; }
        { const y = -26 + Math.sin(t * 2) * 3;
          const g = ctx.createRadialGradient(0, y, 0, 0, y, 26); g.addColorStop(0, 'rgba(255,150,40,0.55)'); g.addColorStop(1, 'rgba(255,90,0,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, y, 26, 0, 7); ctx.fill();
          ctx.fillStyle = '#ff8a2a'; ctx.beginPath(); ctx.moveTo(0, y - 12); ctx.lineTo(7, y); ctx.lineTo(0, y + 12); ctx.lineTo(-7, y); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ffd08a'; ctx.beginPath(); ctx.moveTo(0, y - 12); ctx.lineTo(3, y); ctx.lineTo(0, y + 4); ctx.lineTo(-3, y); ctx.closePath(); ctx.fill(); }
        break;
      case 'grain':
        ctx.fillStyle = '#c9a86a'; ctx.beginPath(); ctx.ellipse(0, -7, 8, 8, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#b8955a'; ctx.beginPath(); ctx.moveTo(-4, -14); ctx.lineTo(0, -19); ctx.lineTo(4, -14); ctx.fill();
        ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-4, -14); ctx.lineTo(4, -14); ctx.stroke();
        if (G.quests.wants('grain')) questSparkle(ctx, t);
        break;
      case 'glowcap': {
        const g = ctx.createRadialGradient(0, -6, 0, 0, -6, 18); g.addColorStop(0, 'rgba(150,255,220,0.45)'); g.addColorStop(1, 'rgba(150,255,220,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -6, 18, 0, 7); ctx.fill();
        for (const [x, s] of [[-5, 0.8], [2, 1.1], [7, 0.7]]) { ctx.fillStyle = '#e8f0e0'; ctx.fillRect(x - 1, -8 * s, 2, 8 * s); ctx.fillStyle = '#6fffd0'; ctx.beginPath(); ctx.ellipse(x, -8 * s, 5 * s, 3 * s, 0, Math.PI, 0); ctx.fill(); }
        if (G.quests.wants('glowcap')) questSparkle(ctx, t);
        break;
      }
      case 'chest':
        ctx.fillStyle = '#7a4a24'; ctx.fillRect(-11, -14, 22, 14); ctx.strokeStyle = '#c9a046'; ctx.lineWidth = 1.5; ctx.strokeRect(-11, -14, 22, 14);
        if (used) { ctx.fillStyle = '#5a3418'; ctx.beginPath(); ctx.moveTo(-11, -14); ctx.lineTo(-9, -26); ctx.lineTo(13, -26); ctx.lineTo(11, -14); ctx.fill(); }
        else { ctx.fillStyle = '#8a5a2a'; ctx.beginPath(); ctx.moveTo(-11, -14); ctx.quadraticCurveTo(0, -24, 11, -14); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e8c35a'; ctx.fillRect(-2, -16, 4, 5); questSparkle(ctx, t, '#ffe9a0'); }
        break;
      case 'wagon':
        ctx.rotate(0.3);
        ctx.fillStyle = '#7a5432'; ctx.fillRect(-18, -14, 34, 10);
        ctx.strokeStyle = '#4a3420'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-10, -4, 6, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.ellipse(12, -2, 6, 3, 0, 0, 7); ctx.stroke();
        break;
      case 'tent':
        ctx.fillStyle = '#9a8a6a'; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(0, -30); ctx.lineTo(20, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#7a6a4a'; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(20, 0); ctx.lineTo(26, -4); ctx.lineTo(6, -32); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2a2018'; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(0, -14); ctx.lineTo(6, 0); ctx.fill();
        break;
    }
    ctx.restore();
  }
  function questSparkle(ctx, t, col = '#fff6b0') {
    for (let i = 0; i < 3; i++) {
      const a = t * 2 + i * 2.1;
      ctx.fillStyle = col; ctx.globalAlpha = 0.5 + Math.sin(t * 4 + i) * 0.4;
      ctx.beginPath(); ctx.arc(Math.cos(a) * 10, -14 + Math.sin(a) * 4 - 6, 1.6, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const lootImgs = {};
  function drawLoot(ctx, e, ix, iy) {
    const it = G.ITEMS[e.itemId];
    const t = R.time + e.id;
    const g = ctx.createLinearGradient(ix, iy - 50, ix, iy);
    const c = it.kind === 'tome' ? '255,220,120' : it.unique ? '255,170,60' : '200,230,255';
    g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(1, `rgba(${c},${0.35 + Math.sin(t * 3) * 0.1})`);
    ctx.fillStyle = g; ctx.fillRect(ix - 6, iy - 50, 12, 50);
    const key = it.icon + it.color;
    if (!lootImgs[key]) { const im = new Image(); im.src = S.icon(it.icon, it.color, 48); lootImgs[key] = im; }
    const im = lootImgs[key];
    if (im.complete) ctx.drawImage(im, ix - 9, iy - 22 + Math.sin(t * 3) * 2, 18, 18);
  }

  /* ---------------- fx ---------------- */
  function drawFx(ctx) {
    for (const f of G.fx.list) {
      const p = f.t / f.dur;
      if (f.type === 'beam') {
        const [ax, ay] = iso(f.a.x, f.a.y), [bx, by] = iso(f.b.x, f.b.y);
        ctx.strokeStyle = S.rgba(f.color, 1 - p); ctx.lineWidth = 4 * (1 - p) + 1;
        ctx.beginPath(); ctx.moveTo(ax, ay - 20); ctx.lineTo(bx, by - 18); ctx.stroke();
      } else if (f.type === 'bolt') {
        ctx.strokeStyle = S.rgba(f.color, 1 - p); ctx.lineWidth = 2.5;
        ctx.shadowColor = f.color; ctx.shadowBlur = 8;
        ctx.beginPath();
        f.pts.forEach((q, i) => { const [x, y] = iso(q.x, q.y); i ? ctx.lineTo(x, y - q.z) : ctx.moveTo(x, y - q.z); });
        ctx.stroke(); ctx.shadowBlur = 0;
      } else if (f.type === 'streak') {
        const [ax, ay] = iso(f.x0, f.y0), [bx, by] = iso(f.x1, f.y1);
        ctx.strokeStyle = S.rgba(f.color, 1 - p); ctx.lineWidth = f.width * (1 - p * 0.5);
        ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax, ay - 16); ctx.lineTo(bx, by - 16); ctx.stroke(); ctx.lineCap = 'butt';
      } else if (f.type === 'drop') {
        if (f.t < 0) continue;
        const [x, y] = iso(f.x, f.y);
        const h = (1 - p) * 70;
        ctx.strokeStyle = S.rgba(f.color, 0.9); ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(x - 2, y - h - 12); ctx.lineTo(x, y - h); ctx.stroke();
      }
    }
    for (const pr of G.fx.projs) {
      const [x, y] = iso(pr.x, pr.y);
      if (pr.arrow) {
        const [x2, y2] = iso(pr.x - Math.cos(pr.ang) * 0.45, pr.y - Math.sin(pr.ang) * 0.45);
        ctx.strokeStyle = pr.color; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(x2, y2 - pr.z); ctx.lineTo(x, y - pr.z); ctx.stroke();
      } else if (pr.spin) {
        ctx.save(); ctx.translate(x, y - pr.z); ctx.rotate(R.time * 20);
        ctx.fillStyle = pr.color; ctx.fillRect(-6, -2, 12, 4); ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-1.5, -7, 3, 14);
        ctx.restore();
      } else {
        for (let i = 0; i < pr.trail.length; i++) {
          const q = pr.trail[i]; const [tx, ty] = iso(q.x, q.y);
          ctx.fillStyle = S.rgba(pr.color, (i / pr.trail.length) * 0.4);
          ctx.beginPath(); ctx.arc(tx, ty - pr.z, pr.size * 0.7, 0, 7); ctx.fill();
        }
        const g = ctx.createRadialGradient(x, y - pr.z, 0, x, y - pr.z, pr.size * 2.5);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, pr.color); g.addColorStop(1, S.rgba(pr.color, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - pr.z, pr.size * 2.5, 0, 7); ctx.fill();
      }
    }
    for (const q of G.fx.parts) {
      const [x, y] = iso(q.x, q.y);
      ctx.globalAlpha = Math.max(0, 1 - q.t / q.life);
      ctx.fillStyle = q.color;
      ctx.fillRect(x - q.size / 2, y - q.z - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- lighting ---------------- */
  function drawLighting(ctx) {
    const L = R.light, lx = L.getContext('2d');
    lx.setTransform(1, 0, 0, 1, 0, 0);
    lx.globalCompositeOperation = 'source-over';
    lx.clearRect(0, 0, L.width, L.height);
    const dark = R.theme === 'cave' ? 0.62 : R.theme === 'swamp' ? 0.22 : 0.16;
    lx.fillStyle = R.theme === 'swamp' ? `rgba(10,25,15,${dark})` : `rgba(5,5,10,${dark})`;
    lx.fillRect(0, 0, L.width, L.height);
    lx.globalCompositeOperation = 'destination-out';
    const d = 0.5, z = R.cam.zoom;
    const hole = (x, y, r, a = 1) => {
      const s = toScreen(x, y);
      const g = lx.createRadialGradient(s.x * d, (s.y - 10 * z) * d, 0, s.x * d, (s.y - 10 * z) * d, r * z * d);
      g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.55, `rgba(0,0,0,${a * 0.7})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      lx.fillStyle = g; lx.beginPath(); lx.arc(s.x * d, (s.y - 10 * z) * d, r * z * d, 0, Math.PI * 2); lx.fill();
    };
    for (const e of G.world.entities) {
      if (e.kind === 'hero' && !e.dead) hole(e.x, e.y, R.theme === 'cave' ? 230 : 300, 1);
      else if (R.theme === 'cave' && !e.dead) {
        if (e.kind === 'object' && (e.objKind === 'seal' || e.objKind === 'waystone')) hole(e.x, e.y, 120, 0.9);
        else if (e.def && (e.def.shape === 'imp' || e.def.shape === 'golem' || e.defId === 'ash_zealot')) hole(e.x, e.y, 70, 0.6);
        else if (e.kind === 'summon') hole(e.x, e.y, 80, 0.6);
      }
    }
    if (R.theme === 'cave') for (const pr of G.fx.projs) hole(pr.x, pr.y, 60, 0.8);
    lx.globalCompositeOperation = 'source-over';
    ctx.drawImage(L, 0, 0, R.W, R.H);
  }

  /* ---------------- screen-space overlay ---------------- */
  function drawOverlay(ctx) {
    const inp = G.input;
    const z = R.cam.zoom;
    ctx.save();
    // health bars
    for (const e of G.world.entities) {
      if (e.dead || e.kind === 'object' || e.kind === 'loot' || e.kind === 'npc') continue;
      if (e.kind === 'structure' && e.invuln) continue;
      const hurt = e.hp < e.maxHp;
      const show = e.kind === 'hero' || e.kind === 'structure' || hurt || inp.hover === e || (e.def && e.def.boss) || G.settings.allBars;
      if (!show) continue;
      const s = toScreen(e.x, e.y);
      if (s.x < -40 || s.x > R.W + 40 || s.y < -60 || s.y > R.H + 60) continue;
      const size = (e.def && e.def.size) || 1;
      const h = e.kind === 'structure' ? 100 : 54 * size;
      const w = e.kind === 'structure' ? 70 : e.def && e.def.boss ? 56 : e.kind === 'hero' ? 40 : 30;
      const x = s.x - w / 2, y = s.y - h * z - 8;
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(x - 1, y - 1, w + 2, e.kind === 'hero' ? 9 : 6);
      const f = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = e.team === 'player' ? (f > 0.35 ? '#4cd964' : '#ffb300') : e.team === 'enemy' ? '#e53935' : '#fdd835';
      ctx.fillRect(x, y, w * f, 4);
      if (e.kind === 'hero') { ctx.fillStyle = '#3b82f6'; ctx.fillRect(x, y + 5, w * (e.mp / e.maxMp), 2.5); }
      if (e.def && (e.def.elite || e.def.boss)) { ctx.fillStyle = '#ffd54a'; ctx.font = 'bold 10px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText(e.def.boss ? '☠' : '★', s.x - w / 2 - 7, y + 5); }
    }
    // quest markers
    for (const e of G.world.entities) {
      if (e.kind !== 'npc') continue;
      const m = G.quests.marker(e.npcId);
      const shop = e.def.shop || e.def.rest;
      if (!m && !shop) continue;
      const s = toScreen(e.x, e.y);
      const bob = Math.sin(R.time * 3) * 3;
      ctx.textAlign = 'center';
      if (m) {
        ctx.font = `bold ${Math.round(22 * Math.min(1.2, z))}px Georgia, serif`;
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        const ch = m === 'available' ? '!' : '?';
        const y = s.y - 64 * z + bob;
        ctx.strokeText(ch, s.x, y);
        ctx.fillStyle = m === 'active' ? '#b8b8b8' : '#ffd23f';
        ctx.fillText(ch, s.x, y);
      } else if (shop) {
        ctx.font = `${Math.round(13 * Math.min(1.2, z))}px Georgia, serif`;
        ctx.fillStyle = 'rgba(255,230,160,0.85)';
        ctx.fillText(e.def.rest ? '☕' : '⚖', s.x, s.y - 60 * z + bob * 0.3);
      }
    }
    // floating combat text
    ctx.textAlign = 'center';
    for (const t of G.fx.texts) {
      if (t.t < 0) continue;
      const p = t.t / t.dur;
      const s = toScreen(t.x, t.y);
      ctx.globalAlpha = Math.min(1, (1 - p) * 2);
      ctx.font = `bold ${t.size}px system-ui, sans-serif`;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      const y = s.y - 52 * z - p * 34;
      ctx.strokeText(t.str, s.x, y); ctx.fillStyle = t.color; ctx.fillText(t.str, s.x, y);
    }
    ctx.globalAlpha = 1;
    // exit signposts: shown when a hero is close or the mouse is over the exit
    for (const ex of G.world.zone.exits) {
      const near = G.world.heroes().some((h) => !h.dead && G.util.dist2(h.x, h.y, ex.x, ex.y) < 6);
      const hov = G.util.dist2(inp.mouseWorld.x, inp.mouseWorld.y, ex.x, ex.y) < ex.r + 1;
      if (!near && !hov) continue;
      const s = toScreen(ex.x, ex.y);
      if (s.x < -100 || s.x > R.W + 100 || s.y < -40 || s.y > R.H + 40) continue;
      const locked = ex.flag && !G.state.flags[ex.flag];
      const wz = G.zoneWarn(ex.to);
      const line1 = `To ${ex.label}`;
      const line2 = locked ? 'Sealed' : wz ? wz.text : 'Safe';
      const col2 = locked ? '#ff8a6a' : wz ? wz.color : '#cfe8b0';
      ctx.font = '13px Georgia, serif';
      const w = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width) + 18;
      const y = s.y - 58 * Math.min(1.2, R.cam.zoom);
      ctx.fillStyle = 'rgba(15,10,6,0.85)'; ctx.fillRect(s.x - w / 2, y, w, 36);
      ctx.strokeStyle = 'rgba(232,199,125,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(s.x - w / 2 + 0.5, y + 0.5, w - 1, 35);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f2e2b8'; ctx.fillText(line1, s.x, y + 15);
      ctx.font = '12px Georgia, serif'; ctx.fillStyle = col2; ctx.fillText(line2, s.x, y + 30);
    }
    // hover name
    if (inp.hover && !inp.hover.dead && inp.hover.kind !== 'hero') {
      const e = inp.hover;
      const s = toScreen(e.x, e.y);
      const danger = e.team === 'enemy' && e.level ? G.dangerOf(e.level, G.partyLevel()) : null;
      let label = e.kind === 'npc' ? `${e.def.name}` : e.kind === 'object' ? objLabel(e) : e.kind === 'loot' ? G.ITEMS[e.itemId].name
        : danger ? `${e.name}  \u00b7  lvl ${e.level}  \u00b7  ${danger.tag}` : `${e.name}${e.level ? '  (lvl ' + e.level + ')' : ''}`;
      if (e.kind === 'npc') label += `  \u2014 ${e.def.title}`;
      if (label) {
        ctx.font = '12px Georgia, serif';
        const w = ctx.measureText(label).width + 12;
        const y = s.y + 12;
        ctx.fillStyle = 'rgba(15,10,6,0.85)'; ctx.fillRect(s.x - w / 2, y, w, 18);
        if (danger) { ctx.fillStyle = danger.color; ctx.fillRect(s.x - w / 2, y + 16, w, 2); }
        ctx.fillStyle = danger ? danger.color : '#f2e2b8'; ctx.fillText(label, s.x, y + 13);
      }
    }
    // drag selection box
    if (inp.drag && inp.drag.active) {
      const d = inp.drag;
      ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 1; ctx.fillStyle = 'rgba(125,255,154,0.08)';
      ctx.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0); ctx.strokeRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
    }
    // edge vignette
    ctx.drawImage(R.vig, 0, 0, R.W, R.H);
    ctx.restore();
  }
  function objLabel(e) {
    const names = { waystone: 'Waystone', cage: 'Bandit cage', cocoon: 'Silk cocoon', seal: 'Ember seal', grain: 'Grain sack', glowcap: 'Glowcap', chest: 'Chest', wagon: 'Overturned wagon', tent: 'Tent' };
    return names[e.objKind];
  }

  /* ---------------- minimap ---------------- */
  function drawMinimap(mc) {
    if (!R.mini) return;
    const x = mc.getContext('2d');
    // the minimap canvas is 2x its logical size (220x110) so dots stay crisp
    const L = mc.width / 220, lw = mc.width / L, lh = mc.height / L;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, mc.width, mc.height);
    x.setTransform(L, 0, 0, L, 0, 0);
    x.drawImage(R.mini, 0, 0, lw, lh);
    const { sx, sy } = R.miniScale;
    const kx = lw / R.mini.width, ky = lh / R.mini.height;
    const pt = (wx, wy) => { const [ix, iy] = iso(wx, wy); return [(R.ox + ix) * sx * kx, iy * sy * ky]; };
    for (const ex of G.world.zone.exits) { const [px, py] = pt(ex.x, ex.y); x.fillStyle = ex.flag && !G.state.flags[ex.flag] ? '#ff6a3a' : '#ffe08a'; x.fillRect(px - 3, py - 3, 6, 6); }
    const dot = (px, py, r, fill) => {
      x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2);
      x.fillStyle = fill; x.fill();
      x.lineWidth = 1; x.strokeStyle = 'rgba(0,0,0,0.85)'; x.stroke();
    };
    // draw in layers so heroes are never hidden under a crowd of enemies
    for (const e of G.world.entities) {
      if (e.dead) continue;
      const [px, py] = pt(e.x, e.y);
      if (e.kind === 'npc') { const m = G.quests.marker(e.npcId); x.fillStyle = m === 'available' || m === 'ready' ? '#ffd23f' : '#e0d0a0'; x.fillRect(px - 2, py - 2, 4, 4); }
      else if (e.kind === 'object' && e.objKind === 'waystone') { x.fillStyle = '#7fe3ff'; x.fillRect(px - 2, py - 2, 4, 4); }
    }
    for (const e of G.world.entities) {
      if (e.dead || e.kind !== 'enemy') continue;
      const [px, py] = pt(e.x, e.y);
      if (e.def.boss) {
        const pr = 4.2 + Math.sin(R.time * 5) * 0.8;
        dot(px, py, pr, '#ff1f1f');
        x.strokeStyle = '#ffd23f'; x.lineWidth = 1; x.beginPath(); x.arc(px, py, pr + 1.8, 0, Math.PI * 2); x.stroke();
      } else dot(px, py, e.def.elite ? 3.2 : 2.4, '#ff3030');
    }
    for (const e of G.world.entities) {
      if (e.kind === 'summon' && !e.dead) { const [px, py] = pt(e.x, e.y); dot(px, py, 1.8, '#5dff7a'); }
    }
    for (const e of G.world.entities) {
      if (e.kind !== 'hero') continue;
      const [px, py] = pt(e.x, e.y);
      dot(px, py, 3, e.dead ? '#888' : '#5dff7a');
    }
    // quest objective markers (or the exit that leads toward them)
    const pulse = 3 + Math.sin(R.time * 4) * 1.2;
    for (const m of G.questTargets()) {
      const [px, py] = pt(m.x, m.y);
      x.save(); x.translate(px, py); x.rotate(Math.PI / 4);
      x.fillStyle = '#ffd23f'; x.strokeStyle = '#000'; x.lineWidth = 1;
      x.fillRect(-pulse, -pulse, pulse * 2, pulse * 2); x.strokeRect(-pulse, -pulse, pulse * 2, pulse * 2);
      x.restore();
    }
    // camera view polygon
    const corners = [toWorld(0, 0), toWorld(R.W, 0), toWorld(R.W, R.H), toWorld(0, R.H)].map((w) => pt(w.x, w.y));
    x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 1;
    x.beginPath(); corners.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.stroke();
  }
  function minimapToWorld(mc, mx, my) {
    const { sx, sy } = R.miniScale;
    const kx = mc.width / R.mini.width, ky = mc.height / R.mini.height;
    const ix = mx / (sx * kx) - R.ox, iy = my / (sy * ky);
    return { x: (ix / HW + iy / HH) / 2, y: (iy / HH - ix / HW) / 2 };
  }

  /* ---------------- picking ---------------- */
  function pick(sx, sy) {
    let best = null, bd = -1e9;
    for (const e of G.world.entities) {
      if (e.removed) continue;
      if (e.dead && e.kind !== 'hero') continue;
      if (e.kind === 'object' && !G.world.objVisible(e)) continue;
      const s = toScreen(e.x, e.y);
      const z = R.cam.zoom * ((e.def && e.def.size) || 1);
      let rx = 16 * z, ry = 26 * z, cy = s.y - 22 * z;
      if (e.kind === 'structure') { if (e.invuln) continue; rx = 50 * R.cam.zoom; ry = 50 * R.cam.zoom; cy = s.y - 40 * R.cam.zoom; }
      if (e.kind === 'loot') { rx = 12 * z; ry = 14 * z; cy = s.y - 12 * z; }
      if (e.kind === 'object') { rx = 14 * z; ry = 22 * z; }
      const dx = (sx - s.x) / rx, dy = (sy - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const pri = (e.kind === 'enemy' ? 2 : e.kind === 'hero' ? 1.5 : e.kind === 'npc' ? 1.5 : e.kind === 'loot' ? 1.2 : 1) * 1000 + (e.x + e.y);
      if (pri > bd) { bd = pri; best = e; }
    }
    return best;
  }

  return Object.assign(R, { init, resize, toScreen, toWorld, centerOn, buildZone, draw, drawMinimap, minimapToWorld, pick, iso });
})();
