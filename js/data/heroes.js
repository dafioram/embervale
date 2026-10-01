/* Hero definitions and stat math. Heroes are data; their live state (level, xp,
   tomes read, items, skill ranks) lives in G.state.party and is what gets saved. */

G.HEROES = {
  maren: {
    name: 'Maren Ashvow', title: 'Warden of the Vale', role: 'Melee guardian',
    primary: 'str',
    base: { str: 22, agi: 14, int: 14 }, gain: { str: 2.6, agi: 1.4, int: 1.5 },
    baseHp: 120, baseMp: 40, baseDmg: 14, armor: 2, range: 1.3, atkCd: 1.6, speed: 3.1,
    melee: true, color: '#b8642f', accent: '#ecd6a4', trim: '#5b3a21', shape: 'warden',
    abilities: ['shieldRush', 'rallyingRoar', 'emberHound', 'earthbreaker', 'attributeTraining'],
    blurb: 'A warden who walked away from the Vale after the Cinderfall, and has just come home to find it burning again.',
  },
  tobin: {
    name: 'Tobin Reedwhistle', title: 'Hedge-Shaman', role: 'Healer and storm-caller',
    primary: 'int',
    base: { str: 15, agi: 13, int: 21 }, gain: { str: 1.8, agi: 1.2, int: 2.8 },
    baseHp: 100, baseMp: 40, baseDmg: 10, armor: 1, range: 5.2, atkCd: 1.75, speed: 3.0,
    melee: false, projectile: { color: '#9fe8ff', size: 3.5, speed: 11 },
    color: '#3f7f6a', accent: '#d9f2c9', trim: '#2a4a3c', shape: 'shaman',
    abilities: ['mendingLight', 'chainSpark', 'thornward', 'spiritTide', 'attributeTraining'],
    blurb: 'A reed-flute hedge-shaman from the marsh villages. Talks to rain. Rain mostly listens.',
  },
  ysolde: {
    name: 'Ysolde Vane', title: 'Ember Hunter', role: 'Ranged skirmisher',
    primary: 'agi',
    base: { str: 16, agi: 22, int: 13 }, gain: { str: 1.9, agi: 2.8, int: 1.4 },
    baseHp: 100, baseMp: 30, baseDmg: 12, armor: 1, range: 6.2, atkCd: 1.5, speed: 3.25,
    melee: false, projectile: { color: '#ffd27a', size: 2.5, speed: 16, arrow: true },
    color: '#6a4c8f', accent: '#f1d7ff', trim: '#2f2240', shape: 'hunter',
    abilities: ['piercingShot', 'smokeStep', 'arrowVolley', 'huntersMark', 'attributeTraining'],
    blurb: 'A hunter of the Ember Cult, tracking its zealots from the coast with a longbow and a long memory.',
  },
};

G.MAX_LEVEL = 15;

// XP needed to go from level L to L+1.
G.xpToNext = (L) => 150 + 120 * L + 10 * L * L;

// XP a hero earns from an enemy, reduced when the hero heavily out-levels it,
// so grinding old zones works "a little" but not forever.
G.xpFromKill = (heroLevel, enemyLevel, baseXp) => {
  const diff = heroLevel - enemyLevel;
  if (diff <= 2) return baseXp;
  return Math.round(baseXp * Math.max(0.15, 1 - 0.22 * (diff - 2)));
};

G.newHeroState = (id, level = 1) => {
  const hs = {
    id, level: 1, xp: 0, skillPoints: 1,
    ranks: {}, bonus: { str: 0, agi: 0, int: 0, hp: 0 },
    items: [null, null, null, null, null, null],
    hp: null, mp: null, dead: false,
  };
  G.HEROES[id].abilities.forEach((a) => (hs.ranks[a] = 0));
  while (hs.level < level) { hs.level++; hs.skillPoints++; }
  return hs;
};

// Rank r (1-based) of an ability needs this hero level.
G.abilityReqLevel = (abilityId, rank) => {
  const ab = G.ABILITIES[abilityId];
  if (ab.ult) return 6 + (rank - 1) * 6;
  if (ab.reqLevels) return ab.reqLevels[rank - 1];
  return 1 + (rank - 1) * 2;
};

G.canLearn = (hs, abilityId) => {
  const ab = G.ABILITIES[abilityId];
  const r = hs.ranks[abilityId] || 0;
  return hs.skillPoints > 0 && r < ab.maxRank && hs.level >= G.abilityReqLevel(abilityId, r + 1);
};

// Does this hero have a skill point it can spend right now?
G.canSpend = (hs) => hs.skillPoints > 0 && G.HEROES[hs.id].abilities.some((a) => G.canLearn(hs, a));
// The next hero level at which a saved point becomes spendable (null if none).
G.nextUnlockLevel = (hs) => {
  let best = null;
  for (const a of G.HEROES[hs.id].abilities) {
    const ab = G.ABILITIES[a], r = hs.ranks[a] || 0;
    if (r >= ab.maxRank) continue;
    const L = G.abilityReqLevel(a, r + 1);
    if (L > hs.level && (best == null || L < best.level)) best = { level: L, name: ab.name };
  }
  return best;
};
G.KEYS = 'QWERT';

G.itemBonuses = (hs) => {
  const b = { str: 0, agi: 0, int: 0, hp: 0, mp: 0, dmg: 0, armor: 0, atkSpeed: 0, speed: 0, hpRegen: 0, mpRegen: 0, evasion: 0 };
  for (const slot of hs.items) {
    if (!slot) continue;
    const it = G.ITEMS[slot.id];
    if (!it || !it.stats) continue;
    for (const k in it.stats) b[k] = (b[k] || 0) + it.stats[k];
    if (it.stats.all) { b.str += it.stats.all; b.agi += it.stats.all; b.int += it.stats.all; }
  }
  return b;
};

G.heroStats = (hs) => {
  const d = G.HEROES[hs.id];
  const ib = G.itemBonuses(hs);
  const L = hs.level - 1;
  const tr = 2 * (hs.ranks.attributeTraining || 0); // Attribute Training
  const str = Math.floor(d.base.str + d.gain.str * L) + hs.bonus.str + tr + ib.str;
  const agi = Math.floor(d.base.agi + d.gain.agi * L) + hs.bonus.agi + tr + ib.agi;
  const int = Math.floor(d.base.int + d.gain.int * L) + hs.bonus.int + tr + ib.int;
  const prim = d.primary === 'str' ? str : d.primary === 'agi' ? agi : int;
  return {
    str, agi, int,
    baseStr: Math.floor(d.base.str + d.gain.str * L) + hs.bonus.str + tr,
    baseAgi: Math.floor(d.base.agi + d.gain.agi * L) + hs.bonus.agi + tr,
    baseInt: Math.floor(d.base.int + d.gain.int * L) + hs.bonus.int + tr,
    training: tr,
    maxHp: Math.round(d.baseHp + str * 19 + hs.bonus.hp + ib.hp),
    maxMp: Math.round(d.baseMp + int * 13 + ib.mp),
    dmg: Math.round(d.baseDmg + prim + ib.dmg),
    armor: Math.round((d.armor + agi * 0.15 + ib.armor) * 10) / 10,
    atkCd: d.atkCd / (1 + agi * 0.015 + ib.atkSpeed),
    hpRegen: 0.3 + str * 0.04 + ib.hpRegen,
    mpRegen: 0.25 + int * 0.045 + ib.mpRegen,
    speed: d.speed * (1 + ib.speed),
    range: d.range,
    evasion: ib.evasion || 0,
    melee: d.melee,
  };
};

// Damage reduction from armor (same shape as classic RTS armor curves).
G.armorReduction = (armor) => {
  if (armor >= 0) return (armor * 0.06) / (1 + armor * 0.06);
  return -(1 - Math.pow(0.94, -armor));
};

// Grant XP to a hero state; returns number of levels gained.
G.grantXp = (hs, amount) => {
  if (hs.level >= G.MAX_LEVEL) return 0;
  hs.xp += amount;
  let gained = 0;
  while (hs.level < G.MAX_LEVEL && hs.xp >= G.xpToNext(hs.level)) {
    hs.xp -= G.xpToNext(hs.level);
    hs.level++; hs.skillPoints++; gained++;
  }
  if (hs.level >= G.MAX_LEVEL) hs.xp = 0;
  return gained;
};
