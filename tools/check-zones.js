// Layout checker: every camp, NPC, object, entry and exit must be reachable.
// Run with: node tools/check-zones.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { window: {}, console };
ctx.window = ctx; vm.createContext(ctx);
for (const f of ['js/core/util.js', 'js/data/zones.js', 'js/core/worldgen.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
const G = ctx.G;
let bad = 0;
for (const id in G.ZONES) {
  const Z = G.ZONES[id];
  const grid = G.genZone(id, { barrowsOpen: true, sealsBroken: true });
  const e0 = Object.values(Z.entries)[0];
  const seen = G.reachable(grid, e0[0], e0[1]);
  const ok = (x, y, rad = 1.6) => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const cx = Math.floor(x) + dx, cy = Math.floor(y) + dy;
      if (cx < 0 || cy < 0 || cx >= grid.w || cy >= grid.h) continue;
      if (Math.hypot(cx + 0.5 - x, cy + 0.5 - y) <= rad + 0.8 && seen[cy * grid.w + cx]) return true;
    }
    return false;
  };
  const check = (what, x, y, rad) => { if (!ok(x, y, rad)) { bad++; console.log(`  ✗ ${id}: ${what} at (${x},${y}) unreachable`); } };
  for (const k in Z.entries) check('entry ' + k, ...Z.entries[k]);
  for (const c of Z.camps) check('camp ' + c.id, c.x, c.y);
  for (const n of Z.npcs) check('npc ' + n.id, n.x, n.y);
  for (const o of Z.objects) check('object ' + o.id, o.x, o.y);
  for (const x of Z.exits) check('exit ' + x.to, x.x, x.y, x.r);
  for (const s of Z.structures || []) check('structure ' + s.id, s.x, s.y, 2.5);
  let walk = 0, reach = 0;
  for (let i = 0; i < seen.length; i++) { if (grid.block[i] === 0) walk++; if (seen[i]) reach++; }
  console.log(`${id}: ${grid.w}x${grid.h}, walkable ${walk}, reachable ${reach}, props ${grid.props.length}`);
}
console.log(bad ? `${bad} problems` : 'All points of interest reachable.');
process.exit(bad ? 1 : 0);
