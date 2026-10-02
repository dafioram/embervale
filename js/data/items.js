/* Items, tomes and shops. Item slots hold {id, n} where n is the stack count for
   consumables. Equipment works like the classic hero RPG: carrying it grants its
   stats. Tomes are read on the spot and grant permanent stats. */

G.ITEMS = {
  /* --- consumables --- */
  healing_draught: { name: 'Healing Draught', kind: 'consumable', icon: 'potion', color: '#e0474c', price: 50, stack: 10,
    desc: 'Restores 250 health.', use: (h) => { if (h.hp >= h.maxHp) return false; G.combat.heal(h, 250, h); G.fx.burst(h.x, h.y, '#ff8a8a', 12, 2, -1.5); G.audio.play('drink'); return true; } },
  greater_healing: { name: 'Greater Healing Draught', kind: 'consumable', icon: 'potion', color: '#ff2f6d', price: 110, stack: 10,
    desc: 'Restores 520 health.', use: (h) => { if (h.hp >= h.maxHp) return false; G.combat.heal(h, 520, h); G.fx.burst(h.x, h.y, '#ff8aa8', 16, 2, -1.5); G.audio.play('drink'); return true; } },
  mana_tonic: { name: 'Mana Tonic', kind: 'consumable', icon: 'potion', color: '#3f7ee8', price: 60, stack: 10,
    desc: 'Restores 150 mana.', use: (h) => { if (h.mp >= h.maxMp) return false; h.mp = Math.min(h.maxMp, h.mp + 150); G.fx.burst(h.x, h.y, '#8ab4ff', 12, 2, -1.5); G.audio.play('drink'); return true; } },
  rejuvenation_herb: { name: 'Rejuvenation Herb', kind: 'consumable', icon: 'herb', color: '#5fbf5a', price: 90, stack: 10,
    desc: 'Restores 320 health and 160 mana over 10 seconds.',
    use: (h) => { G.combat.buff(h, { id: 'rejuv', name: 'Rejuvenating', t: 10, hot: 32, mot: 16, color: '#7be07a', good: true }); G.audio.play('drink'); return true; } },
  hearth_scroll: { name: 'Hearth Scroll', kind: 'consumable', icon: 'scroll', color: '#e8c46a', price: 80, stack: 10,
    desc: 'After 3 seconds, carries the whole party home to Hollowmere.',
    use: (h) => G.game.startHearth(h) },

  /* --- tomes (read on purchase or pickup) --- */
  tome_might: { name: 'Tome of Might', kind: 'tome', icon: 'tome', color: '#c0392b', price: 300, desc: 'Permanently +2 Strength.', tome: { str: 2 } },
  tome_grace: { name: 'Tome of Grace', kind: 'tome', icon: 'tome', color: '#27ae60', price: 300, desc: 'Permanently +2 Agility.', tome: { agi: 2 } },
  tome_insight: { name: 'Tome of Insight', kind: 'tome', icon: 'tome', color: '#2e86de', price: 300, desc: 'Permanently +2 Intelligence.', tome: { int: 2 } },
  tome_vigor: { name: 'Tome of Vigor', kind: 'tome', icon: 'tome', color: '#e67e22', price: 260, desc: 'Permanently +60 maximum health.', tome: { hp: 60 } },
  tome_lore: { name: 'Tome of Lore', kind: 'tome', icon: 'tome', color: '#8e44ad', price: 400, desc: 'Grants 300 experience.', tome: { xp: 300 } },
  tome_mastery: { name: 'Tome of Mastery', kind: 'tome', icon: 'tome', color: '#f1c40f', price: 650, desc: 'Permanently +1 to all attributes and +30 health.', tome: { str: 1, agi: 1, int: 1, hp: 30 } },

  /* --- equipment --- */
  ironbark_buckler: { name: 'Ironbark Buckler', kind: 'equip', icon: 'shield', color: '#8d6e4f', price: 180, stats: { armor: 3 }, desc: '+3 armor.' },
  tempered_blade: { name: 'Tempered Blade', kind: 'equip', icon: 'sword', color: '#b8c4cf', price: 220, stats: { dmg: 7 }, desc: '+7 damage.' },
  swiftboots: { name: 'Swiftboots', kind: 'equip', icon: 'boots', color: '#9c6b3f', price: 200, stats: { speed: 0.12 }, desc: '+12% movement speed.' },
  gloves_haste: { name: 'Quickhand Gloves', kind: 'equip', icon: 'gloves', color: '#c98a4b', price: 260, stats: { atkSpeed: 0.15 }, desc: '+15% attack speed.' },
  heartstone: { name: 'Heartstone', kind: 'equip', icon: 'gem', color: '#e74c3c', price: 220, stats: { hpRegen: 2 }, desc: '+2 health regeneration per second.' },
  ember_lens: { name: 'Ember Lens', kind: 'equip', icon: 'gem', color: '#3498db', price: 220, stats: { mpRegen: 1.2 }, desc: '+1.2 mana regeneration per second.' },
  ring_brawn: { name: 'Ring of Brawn', kind: 'equip', icon: 'ring', color: '#c0392b', price: 160, stats: { str: 3 }, desc: '+3 Strength.' },
  band_haste: { name: 'Band of Haste', kind: 'equip', icon: 'ring', color: '#27ae60', price: 160, stats: { agi: 3 }, desc: '+3 Agility.' },
  sage_pendant: { name: "Sage's Pendant", kind: 'equip', icon: 'amulet', color: '#2e86de', price: 160, stats: { int: 3 }, desc: '+3 Intelligence.' },
  circlet: { name: 'Circlet of the Vale', kind: 'equip', icon: 'crown', color: '#f1c40f', price: 300, stats: { all: 2 }, desc: '+2 to all attributes.' },
  sentinel_plate: { name: 'Sentinel Plate', kind: 'equip', icon: 'armor', color: '#95a5a6', price: 600, stats: { armor: 6, hp: 150 }, desc: '+6 armor, +150 health.' },
  wolfhide_cloak: { name: 'Wolfhide Cloak', kind: 'equip', icon: 'cloak', color: '#7f8c8d', price: 250, stats: { hp: 150 }, desc: '+150 health.' },
  spider_silk_wrap: { name: 'Spider-silk Wrap', kind: 'equip', icon: 'cloak', color: '#d5d8dc', price: 280, stats: { armor: 2, hp: 80 }, desc: '+2 armor, +80 health.' },
  moonvine_charm: { name: 'Moonvine Charm', kind: 'equip', icon: 'amulet', color: '#9b59b6', price: 260, stats: { hpRegen: 1, mpRegen: 0.8 }, desc: '+1 health and +0.8 mana regeneration.' },
  bandit_dirk: { name: "Cutthroat's Dirk", kind: 'equip', icon: 'dagger', color: '#7b8a8b', price: 240, stats: { dmg: 5, atkSpeed: 0.06 }, desc: '+5 damage, +6% attack speed.' },
  // unique drops
  greymane_mantle: { name: 'Greymane Mantle', kind: 'equip', icon: 'cloak', color: '#bdc3c7', price: 400, unique: true, stats: { agi: 4, armor: 2 }, desc: '+4 Agility, +2 armor. Taken from the Old Alpha.' },
  thornjaw_cleaver: { name: "Thornjaw's Cleaver", kind: 'equip', icon: 'axe', color: '#a04000', price: 500, unique: true, stats: { dmg: 14, str: 2 }, desc: '+14 damage, +2 Strength. Notched and greasy.' },
  bogmother_eye: { name: "Bogmother's Eye", kind: 'equip', icon: 'eye', color: '#58d68d', price: 500, unique: true, stats: { int: 6, mpRegen: 1 }, desc: '+6 Intelligence, +1 mana regeneration. It blinks sometimes.' },
  warden_heart: { name: 'Heart of the Cinder Warden', kind: 'equip', icon: 'gem', color: '#ff6b1a', price: 900, unique: true, stats: { all: 5, hp: 200 }, desc: '+5 to all attributes, +200 health. Still warm.' },
};

// Shops: list entries may carry an `unlock` predicate evaluated against G.state.
G.SHOPS = {
  provisioner: { name: "Marta's Provisions", items: [
    { id: 'healing_draught' }, { id: 'mana_tonic' }, { id: 'rejuvenation_herb' }, { id: 'hearth_scroll' },
    { id: 'greater_healing', unlock: (s) => G.quests.isDone('thornjaw'), hint: 'After the bandit threat ends' },
  ] },
  smith: { name: "Brannoc's Forge", items: [
    { id: 'ironbark_buckler' }, { id: 'tempered_blade' }, { id: 'swiftboots' }, { id: 'gloves_haste' }, { id: 'heartstone' },
    { id: 'sentinel_plate', unlock: (s) => G.quests.isDone('hold_mill'), hint: 'After the mill is saved' },
  ] },
  arcanist: { name: "Ilse's Tomes & Trinkets", items: [
    { id: 'tome_might' }, { id: 'tome_grace' }, { id: 'tome_insight' }, { id: 'tome_vigor' }, { id: 'tome_lore' },
    { id: 'tome_mastery', unlock: (s) => G.quests.isDone('hold_mill'), hint: 'After the mill is saved' },
    { id: 'ring_brawn' }, { id: 'band_haste' }, { id: 'sage_pendant' }, { id: 'ember_lens' }, { id: 'circlet' },
  ] },
  pell: { name: "Pell's Pack", items: [
    { id: 'greater_healing' }, { id: 'rejuvenation_herb' }, { id: 'hearth_scroll' }, { id: 'spider_silk_wrap' }, { id: 'moonvine_charm' }, { id: 'tome_vigor' },
  ] },
};

// Tomes get pricier each time you buy one, so gold from grinding helps without
// letting a hero become untouchable.
G.itemPrice = (id) => {
  const it = G.ITEMS[id];
  if (it.kind === 'tome') {
    const n = (G.state.tomesBought && G.state.tomesBought[id]) || 0;
    return Math.round(it.price * (1 + 0.18 * n) / 5) * 5;
  }
  return it.price;
};
G.sellPrice = (id) => Math.floor(G.ITEMS[id].price * 0.5);

// Random drops by zone (weights). Normal enemies roll `dropChance`.
G.LOOT = {
  brindle: [['healing_draught', 6], ['mana_tonic', 4], ['ring_brawn', 1], ['band_haste', 1], ['sage_pendant', 1], ['tome_vigor', 0.6]],
  whisperwood: [['healing_draught', 6], ['mana_tonic', 4], ['rejuvenation_herb', 2], ['bandit_dirk', 1], ['spider_silk_wrap', 0.8], ['tome_might', 0.4], ['tome_grace', 0.4], ['tome_insight', 0.4]],
  mirefen: [['greater_healing', 4], ['mana_tonic', 4], ['rejuvenation_herb', 3], ['moonvine_charm', 1], ['heartstone', 1], ['tome_lore', 0.6], ['tome_insight', 0.5]],
  barrows: [['greater_healing', 5], ['mana_tonic', 4], ['ember_lens', 1], ['circlet', 0.6], ['tome_might', 0.5], ['tome_grace', 0.5], ['tome_insight', 0.5], ['tome_mastery', 0.25]],
};

G.rollLoot = (zoneId) => {
  const Z = G.ZONES[zoneId];
  const t = G.LOOT[(Z && Z.loot) || zoneId];
  if (!t) return null;
  const total = t.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [id, w] of t) { r -= w; if (r <= 0) return id; }
  return t[0][0];
};
