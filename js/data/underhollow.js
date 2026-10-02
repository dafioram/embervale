/* The Underhollow: an optional post-game dungeon of ten generated cave floors
   beneath Hollowmere. Unlocked by Elder Odrin's quest after Act I.

   To remove it from the game, set G.FEATURES.underhollow = false: the quest,
   the sinkhole and its waystones all disappear, and saves stay compatible. */

G.FEATURES = G.FEATURES || {};
G.FEATURES.underhollow = true;

G.DEEP_FLOORS = 10;

// Exits the player can currently see: hides switched-off features and exits
// that stay invisible until their flag is set (the sinkhole).
G.exitsOf = (Z) => Z.exits.filter((ex) => !(ex.feature && !G.FEATURES[ex.feature]) && !(ex.hideLocked && ex.flag && !G.state.flags[ex.flag]));

// Enemy level on each floor: one level deeper per floor. Floor 1 plays like the
// Ashen Barrows; past floor 6 the enemies out-level a capped (level 15) party, so
// tomes and gear from the earlier floors carry you the rest of the way.
G.deepLevel = (n) => 9 + n;

// How much tougher a unit is when spawned above its normal level: each level
// adds 9% health and damage, and gold and experience scale the same way.
G.deepScale = (unitId, level) => Math.pow(1.09, Math.max(0, level - G.UNITS[unitId].level));

/* ---------------- new enemies ---------------- */
Object.assign(G.UNITS, {
  deep_crawler: { name: 'Deep Crawler', level: 9, hp: 520, dmg: 34, armor: 2, atkCd: 1.2, range: 1.0, speed: 3.8, r: 0.46, xp: 105, gold: [10, 20],
    shape: 'spider', color: '#33405e', accent: '#8fd8ff', size: 1.1, dropChance: 0.08, poison: { dps: 10, t: 4 } },
  hollow_knight: { name: 'Hollow Knight', level: 10, hp: 980, dmg: 46, armor: 6, atkCd: 1.6, range: 1.2, speed: 2.9, r: 0.5, xp: 150, gold: [16, 28],
    shape: 'humanoid', weapon: 'sword', color: '#3a4250', accent: '#9fd8ff', ghost: true, helmet: true, size: 1.15, dropChance: 0.1, chill: true },
  gloom_wisp: { name: 'Gloom Wisp', level: 10, hp: 560, dmg: 44, armor: 0, atkCd: 1.9, range: 5.5, speed: 3.0, r: 0.4, xp: 130, gold: [14, 24],
    shape: 'wisp', color: '#a07aff', accent: '#ffffff', spell: true, dropChance: 0.1, projectile: { color: '#c7a8ff', size: 4, speed: 8.5 } },
  stone_sentinel: { name: 'Stone Sentinel', level: 11, hp: 2600, dmg: 62, armor: 8, atkCd: 2.0, range: 1.4, speed: 2.4, r: 0.8, xp: 420, gold: [60, 90],
    shape: 'golem', color: '#3e4652', accent: '#7fd8ff', size: 1.5, elite: true, dropChance: 1, skills: [{ id: 'slam', cd: 9, first: 4 }] },
  brood_mother: { name: 'The Brood Mother', level: 14, hp: 12000, dmg: 82, armor: 6, atkCd: 1.5, range: 1.8, speed: 2.8, r: 1.15, xp: 2400, gold: [700, 850],
    shape: 'spider', color: '#2a2f45', accent: '#b7f06a', size: 2.5, boss: true, drops: ['brood_carapace', 'tome_mastery'],
    skills: [{ id: 'webVolley', cd: 10, first: 5 }, { id: 'venomPools', cd: 12, first: 8 }, { id: 'broodSpawn', cd: 16, first: 12 }] },
  hollow_king: { name: 'The Hollow King', level: 19, hp: 22000, dmg: 108, armor: 9, atkCd: 1.6, range: 1.7, speed: 2.7, r: 1.0, xp: 6000, gold: [1500, 1800],
    shape: 'humanoid', weapon: 'sword', color: '#2c2f3e', accent: '#c7a8ff', ghost: true, crown: true, size: 2.1, boss: true, drops: ['hollow_crown', 'tome_mastery', 'tome_mastery'],
    skills: [{ id: 'graveCircles', cd: 9, first: 5 }, { id: 'soulNova', cd: 18, first: 14 }, { id: 'raiseDead', at: 0.7 }, { id: 'raiseDead', at: 0.35 }, { id: 'kingEnrage', at: 0.25 }] },
});

// Spawn reinforcements at the current floor's level.
G.deepSpawn = (u, x, y, rad, levelOffset = 0) => {
  const lvl = G.deepLevel(G.world.zone.deep || 1) + levelOffset, m = G.deepScale(u, lvl), d = G.UNITS[u];
  const override = m > 1 ? { level: Math.max(d.level, lvl), hp: Math.round(d.hp * m), dmg: Math.round(d.dmg * m), armor: Math.round((lvl - d.level) * 0.3), reward: m } : undefined;
  return G.world.spawnNear(u, x, y, rad, { team: 'enemy', aggro: true, noRespawn: true, override });
};

/* ---------------- boss moves ---------------- */
// Telegraphed circles under each hero; overlapping circles only hurt a target once per cast.
function deepCircles(e, r, delay, dmg, color, onHit) {
  const hs = G.combat.hostilesNear(e.x, e.y, 14, e.team).filter((h) => h.kind === 'hero');
  if (!hs.length) return false;
  const hit = new Set();
  for (const h of hs) {
    const x = h.x, y = h.y;
    G.fx.telegraph({ x, y, r, delay, color, onDone: () => {
      for (const t of G.combat.hostilesNear(x, y, r, e.team)) {
        if (hit.has(t)) continue;
        hit.add(t);
        G.combat.dealDamage(e, t, dmg, { spell: true });
        if (onHit) onHit(t);
      }
      G.fx.burst(x, y, color, 24, 4); G.audio.play('boom');
    } });
  }
  return true;
}
Object.assign(G.ENEMY_SKILLS, {
  webVolley(e) {
    const hs = G.combat.hostilesNear(e.x, e.y, 10, e.team).filter((h) => h.kind === 'hero');
    if (!hs.length) return false;
    for (const h of hs) G.fx.projectile({ from: e, to: h, color: '#e8e8f0', size: 5, speed: 10, onHit: (t) => G.combat.buff(t, { id: 'webbed', name: 'Webbed', t: 3.5, mods: { moveMul: -0.55 }, color: '#ddd' }) });
    G.audio.play('whoosh');
    return true;
  },
  venomPools(e) {
    return deepCircles(e, 1.9, 1.5, 170, '#9be35a', (t) => G.combat.buff(t, { id: 'venom', name: 'Venom', t: 5, dot: 18, src: e, color: '#9be35a' }));
  },
  broodSpawn(e) {
    G.ui.toast('The Brood Mother’s young skitter out of the dark!');
    for (let i = 0; i < 3; i++) G.deepSpawn('deep_crawler', e.x, e.y, 3, -3);
    G.audio.play('splash');
    return true;
  },
  graveCircles(e) {
    return deepCircles(e, 2.1, 1.6, 260, '#a07aff');
  },
  soulNova(e) {
    G.ui.toast('The Hollow King draws the dark inward. Get clear of him!');
    e.busy = 2.1;
    G.fx.telegraph({ x: e.x, y: e.y, r: 5.2, delay: 2.0, follow: e, color: '#7a4aff', onDone: () => {
      if (e.dead) return;
      for (const t of G.combat.hostilesNear(e.x, e.y, 5.2, e.team)) G.combat.dealDamage(e, t, 420, { spell: true });
      G.fx.ring(e.x, e.y, 5.2, '#d9c2ff', 0.6, true); G.fx.burst(e.x, e.y, '#a07aff', 60, 7); G.fx.shake(0.5, 8); G.audio.play('quake');
    } });
    return true;
  },
  raiseDead(e) {
    G.ui.toast('The Hollow King raises his fallen guard!');
    G.deepSpawn('hollow_knight', e.x, e.y, 4, -3);
    G.deepSpawn('hollow_knight', e.x, e.y, 4, -3);
    G.deepSpawn('gloom_wisp', e.x, e.y, 5, -4);
    return true;
  },
  kingEnrage(e) {
    G.ui.toast('The Hollow King’s crown blazes with cold fire!');
    G.combat.buff(e, { id: 'enrage', name: 'Enraged', t: 9999, mods: { atkSpeed: 0.25, moveMul: 0.15 }, color: '#a07aff' });
    return true;
  },
});

/* ---------------- loot ---------------- */
Object.assign(G.ITEMS, {
  deepsteel_blade: { name: 'Deepsteel Blade', kind: 'equip', icon: 'sword', color: '#7fb8ff', price: 900, stats: { dmg: 20 }, desc: '+20 damage.' },
  gloomweave_cloak: { name: 'Gloomweave Cloak', kind: 'equip', icon: 'cloak', color: '#6a4ab0', price: 900, stats: { hp: 320, armor: 3 }, desc: '+320 health, +3 armor.' },
  crawler_fang: { name: 'Crawler Fang', kind: 'equip', icon: 'dagger', color: '#8fd8ff', price: 800, stats: { dmg: 10, atkSpeed: 0.18 }, desc: '+10 damage, +18% attack speed.' },
  deep_lantern: { name: 'Deep Lantern', kind: 'equip', icon: 'gem', color: '#7fd8ff', price: 850, stats: { hpRegen: 3, mpRegen: 2 }, desc: '+3 health and +2 mana regeneration.' },
  brood_carapace: { name: 'Brood Carapace', kind: 'equip', icon: 'armor', color: '#4a5a3a', price: 1400, unique: true, stats: { armor: 9, hp: 250 }, desc: '+9 armor, +250 health. Taken from the Brood Mother.' },
  hollow_crown: { name: 'The Hollow Crown', kind: 'equip', icon: 'crown', color: '#c7a8ff', price: 3000, unique: true, stats: { all: 10, hp: 400 }, desc: '+10 to all attributes, +400 health. Cold to the touch, and quiet at last.' },
});
G.LOOT.deep = [['greater_healing', 6], ['mana_tonic', 4], ['rejuvenation_herb', 3], ['deepsteel_blade', 0.5], ['gloomweave_cloak', 0.5], ['crawler_fang', 0.5],
  ['deep_lantern', 0.5], ['tome_might', 0.7], ['tome_grace', 0.7], ['tome_insight', 0.7], ['tome_vigor', 0.7], ['tome_mastery', 0.35]];

/* ---------------- quest ---------------- */
G.QUESTS.trouble_below = {
  name: 'Trouble Below', giver: 'odrin', turnIn: 'odrin', req: { quests: ['barrows'] }, feature: 'underhollow',
  summary: 'Creatures are crawling out of a sinkhole south-east of the Hollowmere square, by the forge. Go down into the Underhollow and stop whatever is sending them.',
  objectives: [
    { type: 'kill', unit: 'brood_mother', count: 1, text: 'Slay the Brood Mother (floor 5)' },
    { type: 'kill', unit: 'hollow_king', count: 1, text: 'Destroy the Hollow King (floor 10)' },
  ],
  offer: [
    'Maren. I hoped we’d have one quiet night. The road by Brannoc\u2019s forge gave way at dusk, and something has been climbing out of the hole ever since.',
    'Old songs call it the Underhollow: tunnels older than the barrows, older than the village. Ten levels deep, they say, and something at the bottom that never stopped being king.',
    'We won’t be safe until someone stops whatever is down there. Take your time. Go down, come back up, go down again. The waystones below should hold.',
  ],
  acceptLabel: 'We’ll go down.',
  progress: 'The sinkhole is in the road just past the forge. Mind the dark.',
  complete: 'The tremors have stopped. The children slept through the night for the first time since spring. Whatever you did down there, Hollowmere owes you more than I can pay. Still, take this.',
  rewards: { xp: 3000, gold: 2000, items: [['tome_mastery', 2]] },
  markers: [],
  onAccept: () => { G.state.flags.underhollowOpen = true; },
};

/* ---------------- floor generator ---------------- */
const DEEP_POOLS = [
  // floors 1-3
  { camps: [['revenant', 'revenant', 'ash_zealot'], ['deep_crawler', 'deep_crawler', 'cinderling'], ['revenant', 'deep_crawler', 'ash_zealot'], ['cinder_brute', 'cinderling', 'cinderling']],
    guard: ['stone_sentinel', 'revenant', 'revenant'] },
  // floors 4-6
  { camps: [['hollow_knight', 'deep_crawler', 'deep_crawler'], ['gloom_wisp', 'gloom_wisp', 'hollow_knight'], ['deep_crawler', 'deep_crawler', 'deep_crawler'], ['hollow_knight', 'revenant', 'gloom_wisp']],
    guard: ['stone_sentinel', 'hollow_knight', 'gloom_wisp'] },
  // floors 7-10
  { camps: [['hollow_knight', 'hollow_knight', 'gloom_wisp'], ['stone_sentinel', 'deep_crawler', 'deep_crawler'], ['gloom_wisp', 'gloom_wisp', 'gloom_wisp', 'hollow_knight'], ['hollow_knight', 'deep_crawler', 'gloom_wisp']],
    guard: ['stone_sentinel', 'stone_sentinel', 'hollow_knight'] },
];

G.makeDeepFloor = (n) => {
  const r = G.util.rng(9001 + n * 7919);
  const W = 48, H = 48;
  const lvl = G.deepLevel(n);
  const boss = n === 5 ? 'brood_mother' : n === 10 ? 'hollow_king' : null;
  const pool = DEEP_POOLS[n <= 3 ? 0 : n <= 6 ? 1 : 2];
  const clamp = G.util.clamp;

  // a chain of rooms climbing from the bottom of the map to the top
  const rooms = [];
  let x = 24, y = 41;
  rooms.push({ x, y, r: 4.2 });
  const steps = boss ? 3 : 4;
  for (let i = 0; i < steps; i++) {
    y -= r.range(6.5, 8);
    x = clamp(x + r.range(-10, 10), 9, 39);
    rooms.push({ x, y, r: r.range(3.6, 4.8) });
  }
  const fr = boss ? 7.5 : 5.2;
  rooms.push({ x: clamp(x + r.range(-6, 6), 11, 37), y: Math.max(fr + 2.5, y - (boss ? 10 : 8)), r: fr });
  // one or two side rooms branching off the middle of the chain
  const sides = [];
  for (let k = 0; k < (n % 2 ? 2 : 1); k++) {
    const from = rooms[1 + ((k * 2 + n) % (rooms.length - 2))];
    const dir = from.x < 24 ? 1 : -1;
    sides.push({ x: clamp(from.x + dir * r.range(10, 13), 7, 41), y: clamp(from.y + r.range(-2, 2), 7, 41), r: r.range(3.2, 4), from });
  }

  const features = [];
  for (const rm of [...rooms, ...sides]) features.push({ t: 'room', x: rm.x, y: rm.y, r: rm.r });
  for (let i = 0; i < rooms.length - 1; i++) {
    const a = rooms[i], b = rooms[i + 1];
    const mid = [(a.x + b.x) / 2 + r.range(-3, 3), (a.y + b.y) / 2];
    features.push({ t: 'tunnel', pts: [[a.x, a.y], mid, [b.x, b.y]], w: 2.8 });
  }
  for (const s of sides) features.push({ t: 'tunnel', pts: [[s.from.x, s.from.y], [s.x, s.y]], w: 2.4 });

  const first = rooms[0], last = rooms[rooms.length - 1];
  const camps = [];
  rooms.slice(1, -1).forEach((rm, i) => camps.push({ id: `d${n}_${i}`, x: rm.x, y: rm.y, units: pool.camps[(i + n) % pool.camps.length], scale: lvl }));
  sides.forEach((s, i) => camps.push({ id: `d${n}_s${i}`, x: s.x, y: s.y + 0.5, units: pool.camps[(i + n + 2) % pool.camps.length], scale: lvl }));
  if (boss) camps.push({ id: `d${n}_boss`, x: last.x, y: last.y - 1, units: [boss], unique: boss, leash: 11 });
  else camps.push({ id: `d${n}_guard`, x: last.x, y: last.y + 0.5, units: pool.guard, scale: lvl, opens: `deep${n}_open`, guardian: true });

  const objects = [];
  if (n === 1 || n === 4 || n === 7) objects.push({ id: `ws_deep${n}`, kind: 'waystone', x: first.x - 2.2, y: first.y - 1.2 });
  sides.forEach((s, i) => objects.push({ id: `chest_deep${n}_${i}`, kind: 'chest', x: s.x + 1.2, y: s.y - 1.4, gold: 120 + n * 40, item: G.LOOT.deep[(n + i * 3) % G.LOOT.deep.length][0], requiresCamp: `d${n}_s${i}` }));

  const exits = [
    { x: first.x, y: first.y + 3.1, r: 1.1, to: n === 1 ? 'hollowmere' : `deep${n - 1}`, entry: n === 1 ? 'fromDeep' : 'fromBelow',
      label: n === 1 ? 'Hollowmere' : `Floor ${n - 1}`, style: 'up' },
  ];
  if (!boss || n < G.DEEP_FLOORS) {
    exits.push({ x: last.x, y: last.y - fr + 1.6, r: 1.1, to: `deep${n + 1}`, entry: 'fromAbove', label: `Floor ${n + 1}`, style: 'down',
      flag: boss ? `deep${n}_open` : `deep${n}_open`,
      locked: boss ? 'The way down is blocked until the Brood Mother is dead.' : 'A sentinel seals the stairs. Defeat the guardian of this floor to open the way down.' });
  }
  if (boss === 'brood_mother') camps[camps.length - 1].opens = `deep${n}_open`;

  return {
    name: 'The Underhollow', subtitle: `Floor ${n} of ${G.DEEP_FLOORS}`, level: `${lvl - 1}–${lvl + 1}`, minLevel: Math.min(15, lvl - 1),
    theme: 'deep', w: W, h: H, seed: 9100 + n, cave: true, treeDensity: 0, border: 0, deep: n, loot: 'deep',
    features, exits, objects, camps, npcs: [],
    entries: { fromAbove: [first.x, first.y - 0.8], fromBelow: [last.x, last.y - fr + 3.6] },
    feature: 'underhollow',
  };
};

for (let n = 1; n <= G.DEEP_FLOORS; n++) {
  G.ZONES['deep' + n] = G.makeDeepFloor(n);
  const Z = G.ZONES['deep' + n], bossCamp = Z.camps.find((c) => c.unique);
  if (bossCamp) G.QUESTS.trouble_below.markers.push({ zone: 'deep' + n, x: bossCamp.x, y: bossCamp.y, objective: n === 5 ? 0 : 1 });
  if (n === 1 || n === 4 || n === 7) G.WAYSTONES['ws_deep' + n] = { zone: 'deep' + n, name: `Underhollow, floor ${n}`, feature: 'underhollow' };
}

// The sinkhole in Hollowmere: hidden until the quest opens it.
(() => {
  const Z = G.ZONES.hollowmere;
  Z.features.push({ t: 'clear', x: 21.8, y: 24.6, r: 2.2 }, { t: 'paint', tile: 'dirt', x: 21.8, y: 24.6, r: 1.9 });
  Z.exits.push({ x: 21.8, y: 24.6, r: 1.0, to: 'deep1', entry: 'fromAbove', label: 'The Underhollow', flag: 'underhollowOpen', hideLocked: true, style: 'sinkhole', feature: 'underhollow' });
  Z.entries.fromDeep = [20.2, 23.0];
})();
