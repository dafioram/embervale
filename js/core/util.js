/* Embervale — shared helpers. Everything hangs off the global G namespace so the
   game runs from plain <script> tags (works on GitHub Pages and from file://). */
window.G = window.G || {};

G.util = (() => {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const dist2 = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const angle = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);

  // Small deterministic RNG (mulberry32) so zones generate identically every load.
  function rng(seed) {
    let s = seed >>> 0;
    const f = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = (a, b) => a + f() * (b - a);
    f.int = (a, b) => Math.floor(a + f() * (b - a + 1));
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    return f;
  }

  // Value noise for clustered forests / color variation.
  function noise2(seed) {
    const r = rng(seed);
    const perm = new Uint8Array(512);
    const vals = new Float32Array(256);
    for (let i = 0; i < 256; i++) { perm[i] = i; vals[i] = r(); }
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
    const v = (x, y) => vals[perm[(x & 255) + perm[y & 255]]];
    const sm = (t) => t * t * (3 - 2 * t);
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = sm(x - xi), yf = sm(y - yi);
      const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
      return lerp(lerp(a, b, xf), lerp(c, d, xf), yf);
    };
  }

  function fmtTime(sec) {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let _id = 1;
  const uid = () => _id++;

  return { clamp, lerp, dist, dist2, angle, rng, noise2, fmtTime, esc, uid };
})();

/* ---------- Grid pathfinding (A* with 8-way moves, no corner cutting) ---------- */
G.path = (() => {
  // Binary heap keyed on f-score.
  class Heap {
    constructor() { this.a = []; }
    push(n) { const a = this.a; a.push(n); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
    pop() {
      const a = this.a; const top = a[0]; const last = a.pop();
      if (a.length) { a[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < a.length && a[l].f < a[m].f) m = l; if (r < a.length && a[r].f < a[m].f) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
      return top;
    }
    get size() { return this.a.length; }
  }

  // Line-of-walk check between two world points (used for path smoothing + AI).
  function clearLine(grid, x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(d / 0.25);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      if (!grid.walk(Math.floor(x), Math.floor(y))) return false;
      // keep a small margin so units don't scrape wall corners
      if (!grid.walk(Math.floor(x + 0.3), Math.floor(y)) || !grid.walk(Math.floor(x - 0.3), Math.floor(y)) ||
          !grid.walk(Math.floor(x), Math.floor(y + 0.3)) || !grid.walk(Math.floor(x), Math.floor(y - 0.3))) return false;
    }
    return true;
  }

  // Nearest walkable cell to (x,y), searching outward in rings.
  function nearestWalkable(grid, x, y, maxR = 8) {
    const cx = Math.floor(x), cy = Math.floor(y);
    if (grid.walk(cx, cy)) return [cx, cy];
    for (let r = 1; r <= maxR; r++) {
      let best = null, bd = 1e9;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (grid.walk(cx + dx, cy + dy)) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [cx + dx, cy + dy]; } }
      }
      if (best) return best;
    }
    return null;
  }

  function find(grid, sx, sy, tx, ty, maxNodes = 6000) {
    const start = nearestWalkable(grid, sx, sy, 3);
    const goal = nearestWalkable(grid, tx, ty, 6);
    if (!start || !goal) return null;
    if (start[0] === goal[0] && start[1] === goal[1]) return [{ x: tx, y: ty }];
    const W = grid.w, H = grid.h;
    const key = (x, y) => y * W + x;
    const g = new Map(), came = new Map(), closed = new Set();
    const h = (x, y) => { const dx = Math.abs(x - goal[0]), dy = Math.abs(y - goal[1]); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    const open = new Heap();
    const sk = key(start[0], start[1]);
    g.set(sk, 0);
    open.push({ x: start[0], y: start[1], f: h(start[0], start[1]) });
    let found = null, visited = 0, bestNode = null, bestH = 1e9;
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (open.size) {
      const cur = open.pop();
      const ck = key(cur.x, cur.y);
      if (closed.has(ck)) continue;
      closed.add(ck);
      const hh = h(cur.x, cur.y);
      if (hh < bestH) { bestH = hh; bestNode = cur; }
      if (cur.x === goal[0] && cur.y === goal[1]) { found = cur; break; }
      if (++visited > maxNodes) break;
      for (const [dx, dy, c] of dirs) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || !grid.walk(nx, ny)) continue;
        if (dx && dy && (!grid.walk(cur.x + dx, cur.y) || !grid.walk(cur.x, cur.y + dy))) continue;
        const nk = key(nx, ny);
        if (closed.has(nk)) continue;
        const ng = g.get(ck) + c;
        if (ng < (g.has(nk) ? g.get(nk) : 1e9)) { g.set(nk, ng); came.set(nk, ck); open.push({ x: nx, y: ny, f: ng + h(nx, ny) }); }
      }
    }
    const end = found || bestNode;
    if (!end) return null;
    // rebuild
    const cells = [];
    let k = key(end.x, end.y);
    while (k !== undefined) { cells.push([k % W, Math.floor(k / W)]); k = came.get(k); }
    cells.reverse();
    const pts = cells.map(([x, y]) => ({ x: x + 0.5, y: y + 0.5 }));
    if (found) pts[pts.length - 1] = grid.walk(Math.floor(tx), Math.floor(ty)) ? { x: tx, y: ty } : pts[pts.length - 1];
    // smooth: skip intermediate points while the straight line is clear
    const out = [];
    let i = 0;
    let fromX = sx, fromY = sy;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !clearLine(grid, fromX, fromY, pts[j].x, pts[j].y)) j--;
      out.push(pts[j]);
      fromX = pts[j].x; fromY = pts[j].y;
      i = j + 1;
    }
    return out;
  }

  return { find, clearLine, nearestWalkable };
})();
