/* Zone layouts for Act I. Coordinates are tile units. In the isometric view the
   y=0 edge runs along the top-right of the screen and the x=0 edge along the
   top-left. The generator in world.js turns these feature lists into tiles,
   blockers and props using the zone seed, so editing a zone is just editing data. */

G.ZONES = {
  hollowmere: {
    name: 'Hollowmere', subtitle: 'Village of the lower Vale', level: 'Safe', theme: 'village', w: 34, h: 34, seed: 101, safe: true,
    treeDensity: 0.05, border: 2,
    features: [
      { t: 'clear', x: 17, y: 17, r: 6 },
      { t: 'paint', tile: 'stone', x: 17, y: 17, r: 4.2 },
      { t: 'path', pts: [[17, 17], [20, 8], [22, 0]], w: 2.4 },
      { t: 'path', pts: [[17, 17], [8, 15], [0, 14]], w: 2.4 },
      { t: 'path', pts: [[17, 17], [24, 27], [28, 33]], w: 2 },
      { t: 'path', pts: [[17, 17], [17, 23]], w: 2 },
      { t: 'building', x: 9, y: 9, w: 5, h: 4, style: 'hall', name: "Elder's Hall" },
      { t: 'building', x: 22, y: 11, w: 4, h: 4, style: 'inn', name: 'The Low Lantern' },
      { t: 'building', x: 23, y: 19, w: 4, h: 3, style: 'smithy', name: 'Forge' },
      { t: 'building', x: 10, y: 20, w: 3, h: 3, style: 'tower', name: 'Arcanist' },
      { t: 'building', x: 15, y: 25, w: 4, h: 3, style: 'shop', name: 'Provisions' },
      { t: 'building', x: 4, y: 5, w: 3, h: 3, style: 'house' },
      { t: 'building', x: 26, y: 26, w: 3, h: 3, style: 'house' },
      { t: 'building', x: 5, y: 25, w: 3, h: 3, style: 'house' },
      { t: 'building', x: 27, y: 5, w: 3, h: 3, style: 'house' },
      { t: 'fence', pts: [[3, 22], [3, 29], [9, 29]] },
      { t: 'water', x: 29, y: 15, rx: 2.5, ry: 3.5 },
    ],
    exits: [
      { x: 22, y: 0.6, r: 1.8, to: 'brindle', entry: 'fromTown', label: 'Brindle Fields' },
      { x: 0.6, y: 14, r: 1.8, to: 'whisperwood', entry: 'fromTown', label: 'Whisperwood' },
    ],
    entries: { start: [16.5, 19], fromBrindle: [21.2, 3.5], fromWhisperwood: [3.5, 14.2], hearth: [17.5, 19.5] },
    npcs: [
      { id: 'odrin', x: 12.5, y: 14.5 },
      { id: 'wenna', x: 21, y: 15.6 },
      { id: 'brannoc', x: 21.6, y: 20.4 },
      { id: 'ilse', x: 13.6, y: 21.2 },
      { id: 'marta', x: 17.5, y: 23.6 },
      { id: 'bryn', x: 7.5, y: 17.5 },
      { id: 'ossa', x: 18.8, y: 8.2 },
    ],
    objects: [{ id: 'ws_town', kind: 'waystone', x: 17, y: 17 }],
    camps: [],
  },

  brindle: {
    name: 'Brindle Fields', subtitle: 'Farmland east of the village', level: '1–5', minLevel: 1, theme: 'meadow', w: 56, h: 56, seed: 202,
    treeDensity: 0.1, border: 2,
    features: [
      { t: 'path', pts: [[12, 56], [14, 44], [24, 34], [34, 32], [36, 24], [40, 14], [40, 0]], w: 2.4 },
      { t: 'path', pts: [[24, 34], [30, 40]], w: 2 },
      { t: 'path', pts: [[24, 34], [16, 22], [9, 11]], w: 1.4, tile: 'grass' },
      { t: 'path', pts: [[36, 24], [48, 22], [50, 30], [46, 36]], w: 1.4, tile: 'grass' },
      { t: 'path', pts: [[34, 12], [40, 14]], w: 1.4, tile: 'grass' },
      { t: 'path', pts: [[18, 14], [16, 22]], w: 1.4, tile: 'grass' },
      { t: 'path', pts: [[46, 36], [50, 50]], w: 1.4, tile: 'grass' },
      { t: 'field', x: 32, y: 38, w: 11, h: 9 },
      { t: 'water', x: 22, y: 21, rx: 4, ry: 3 },
      { t: 'water', x: 6, y: 44, rx: 3, ry: 4 },
      { t: 'building', x: 26, y: 42, w: 4, h: 3, style: 'farmhouse', name: 'Hesk Farm' },
      { t: 'fence', pts: [[31, 37], [44, 37], [44, 47]] },
      { t: 'clear', x: 9, y: 9, r: 5 },
      { t: 'clear', x: 41, y: 29, r: 5 },
      { t: 'clear', x: 40, y: 6, r: 4 },
      { t: 'rocks', n: 18 },
      { t: 'gate', x: 39, y: 0, w: 3, h: 2, flag: 'barrowsOpen', style: 'barrowgate' },
    ],
    structures: [{ id: 'mill', unit: 'mill', x: 41.5, y: 29.5, foot: [40, 28, 3, 3] }],
    exits: [
      { x: 12, y: 55.4, r: 1.8, to: 'hollowmere', entry: 'fromBrindle', label: 'Hollowmere' },
      { x: 40, y: 0.6, r: 1.8, to: 'barrows', entry: 'fromBrindle', label: 'Ashen Barrows', flag: 'barrowsOpen',
        locked: 'The barrow door is fused shut with ember-glass. Someone will need to find a way in.' },
    ],
    entries: { fromTown: [12.5, 52], fromBarrows: [40, 4], hearthOut: [12.5, 52] },
    npcs: [
      { id: 'hesk', x: 30.5, y: 41 },
      { id: 'ovan', x: 37.8, y: 31.4 },
      { id: 'ysolde_npc', x: 38.6, y: 27, flag: 'ysoldeWaiting' },
    ],
    objects: [
      { id: 'ws_brindle', kind: 'waystone', x: 16, y: 49 },
      { id: 'grain1', kind: 'grain', x: 34, y: 40, quest: 'grain' },
      { id: 'grain2', kind: 'grain', x: 39.5, y: 44.5, quest: 'grain' },
      { id: 'grain3', kind: 'grain', x: 42.5, y: 40.5, quest: 'grain' },
      { id: 'grain4', kind: 'grain', x: 36, y: 46, quest: 'grain' },
      { id: 'grain5', kind: 'grain', x: 47.5, y: 41.5, quest: 'grain' },
      { id: 'grain6', kind: 'grain', x: 33.5, y: 45, quest: 'grain' },
      { id: 'wagon', kind: 'wagon', x: 45.5, y: 43.5 },
      { id: 'chest_brindle', kind: 'chest', x: 50, y: 50, gold: 80, item: 'tome_vigor' },
    ],
    camps: [
      { id: 'b1', x: 17, y: 46, units: ['boar', 'boar'] },
      { id: 'b2', x: 21, y: 39, units: ['boar', 'boar', 'boar'] },
      { id: 'b3', x: 10, y: 35, units: ['boar', 'boar'] },
      { id: 'b4', x: 29, y: 29, units: ['boar', 'boar'] },
      { id: 'b5', x: 30, y: 21, units: ['wolf', 'wolf'] },
      { id: 'b6', x: 41, y: 43, units: ['wolf', 'wolf'] },
      { id: 'b7', x: 47, y: 34, units: ['wolf', 'boar', 'boar'] },
      { id: 'b8', x: 18, y: 14, units: ['wolf', 'wolf', 'wolf'] },
      { id: 'b9', x: 33, y: 12, units: ['wolf', 'wolf'] },
      { id: 'b10', x: 48, y: 23, units: ['boar', 'boar', 'wolf'] },
      { id: 'b11', x: 49, y: 49, units: ['wolf', 'wolf', 'boar'] },
      { id: 'greymane', x: 9, y: 9, units: ['greymane', 'wolf', 'wolf'], unique: 'greymane' },
    ],
  },

  whisperwood: {
    name: 'Whisperwood', subtitle: 'Old forest, new bandits', level: '3–7', minLevel: 3, theme: 'forest', w: 60, h: 60, seed: 303,
    treeDensity: 0.26, border: 2,
    features: [
      { t: 'path', pts: [[60, 46], [48, 44], [38, 34], [30, 26], [22, 20], [18, 17]], w: 2.2 },
      { t: 'path', pts: [[38, 34], [44, 22], [47, 14]], w: 1.8 },
      { t: 'path', pts: [[47, 14], [52, 10]], w: 1.6 },
      { t: 'path', pts: [[38, 34], [28, 40], [20, 46], [12, 52], [12, 60]], w: 2 },
      { t: 'path', pts: [[48, 44], [52, 30], [54, 22]], w: 1.4, tile: 'grass' },
      { t: 'path', pts: [[30, 26], [30, 16]], w: 1.6 },
      { t: 'path', pts: [[28, 40], [30, 50], [8, 54]], w: 1.4, tile: 'grass' },
      { t: 'path', pts: [[20, 46], [18, 40], [26, 32]], w: 1.4, tile: 'grass' },
      { t: 'clear', x: 34, y: 30, r: 5.5 },
      { t: 'clear', x: 47, y: 15, r: 5.5 },
      { t: 'clear', x: 24, y: 24, r: 3.5 },
      { t: 'stockade', x: 7, y: 4, w: 15, h: 13, gate: [16, 20] },
      { t: 'water', x: 44, y: 54, rx: 5, ry: 3 },
      { t: 'rocks', n: 22 },
    ],
    exits: [
      { x: 59.4, y: 46, r: 1.8, to: 'hollowmere', entry: 'fromWhisperwood', label: 'Hollowmere' },
      { x: 12, y: 59.4, r: 1.8, to: 'mirefen', entry: 'fromWhisperwood', label: 'Mirefen' },
    ],
    entries: { fromTown: [56, 46], fromMirefen: [12.5, 56] },
    npcs: [{ id: 'pell', x: 45.5, y: 13.2, flag: 'pellFreed' }],
    objects: [
      { id: 'ws_whisper', kind: 'waystone', x: 52, y: 46 },
      { id: 'cage_tobin', kind: 'cage', x: 35.5, y: 28.5, requiresCamp: 'w_tobin', quest: 'missing_shaman' },
      { id: 'cocoon_pell', kind: 'cocoon', x: 45.5, y: 12.5, requiresCamp: 'w4' },
      { id: 'tent1', kind: 'tent', x: 31.5, y: 28 },
      { id: 'tent2', kind: 'tent', x: 33, y: 33 },
      { id: 'cap1', kind: 'glowcap', x: 46, y: 36, quest: 'glowcaps', respawn: 150 },
      { id: 'cap2', kind: 'glowcap', x: 52.5, y: 30.5, quest: 'glowcaps', respawn: 150 },
      { id: 'cap3', kind: 'glowcap', x: 41, y: 45, quest: 'glowcaps', respawn: 150 },
      { id: 'cap4', kind: 'glowcap', x: 26, y: 32.5, quest: 'glowcaps', respawn: 150 },
      { id: 'cap5', kind: 'glowcap', x: 18.5, y: 41, quest: 'glowcaps', respawn: 150 },
      { id: 'cap6', kind: 'glowcap', x: 38.5, y: 20.5, quest: 'glowcaps', respawn: 150 },
      { id: 'cap7', kind: 'glowcap', x: 54, y: 22.5, quest: 'glowcaps', respawn: 150 },
      { id: 'cap8', kind: 'glowcap', x: 30.5, y: 50.5, quest: 'glowcaps', respawn: 150 },
      { id: 'chest_wood', kind: 'chest', x: 8.5, y: 54, gold: 120, item: 'bandit_dirk' },
    ],
    camps: [
      { id: 'w1', x: 50, y: 40, units: ['webspinner', 'webspinner'] },
      { id: 'w2', x: 43, y: 49, units: ['webspinner', 'webspinner'] },
      { id: 'w3', x: 40, y: 26, units: ['webspinner', 'venomfang'] },
      { id: 'w4', x: 48.5, y: 17.5, units: ['venomfang', 'webspinner', 'webspinner'] },
      { id: 'w5', x: 52, y: 10, units: ['venomfang', 'venomfang'] },
      { id: 'w_tobin', x: 34, y: 31, units: ['cutthroat', 'cutthroat', 'bandit_archer'] },
      { id: 'w6', x: 28, y: 41, units: ['cutthroat', 'bandit_archer'] },
      { id: 'w7', x: 24, y: 24, units: ['cutthroat', 'cutthroat', 'bruiser'] },
      { id: 'w8', x: 30, y: 17, units: ['bandit_archer', 'bandit_archer', 'cutthroat'] },
      { id: 'w9', x: 19, y: 47, units: ['webspinner', 'venomfang'] },
      { id: 'w10', x: 24, y: 52, units: ['venomfang', 'venomfang', 'webspinner'] },
      { id: 's1', x: 12.5, y: 13.5, units: ['cutthroat', 'cutthroat', 'bruiser'] },
      { id: 's2', x: 18.5, y: 8.5, units: ['bandit_archer', 'bandit_archer', 'cutthroat'] },
      { id: 'grell', x: 11.5, y: 8.5, units: ['grell'], unique: 'grell', leash: 9 },
    ],
  },

  mirefen: {
    name: 'Mirefen', subtitle: 'Sunken marsh (optional)', level: '4–8', minLevel: 6, theme: 'swamp', w: 50, h: 50, seed: 404,
    treeDensity: 0.12, border: 2,
    features: [
      { t: 'path', pts: [[38, 0], [34, 12], [24, 22], [18, 32], [13, 40]], w: 2, tile: 'mud' },
      { t: 'path', pts: [[34, 12], [42, 22], [40, 26]], w: 1.6, tile: 'mud' },
      { t: 'path', pts: [[24, 22], [28, 30], [30, 42]], w: 1.6, tile: 'mud' },
      { t: 'path', pts: [[18, 32], [12, 22]], w: 1.6, tile: 'mud' },
      { t: 'path', pts: [[34, 12], [6, 6]], w: 1.4, tile: 'mud' },
      { t: 'water', x: 14, y: 12, rx: 5, ry: 3 },
      { t: 'water', x: 37, y: 33, rx: 4, ry: 6 },
      { t: 'water', x: 23, y: 40, rx: 3.5, ry: 2.5 },
      { t: 'water', x: 45, y: 13, rx: 2.5, ry: 3.5 },
      { t: 'water', x: 5, y: 30, rx: 2.5, ry: 4 },
      { t: 'water', x: 44, y: 44, rx: 3, ry: 2.5 },
      { t: 'clear', x: 12, y: 41, r: 6 },
      { t: 'paint', tile: 'mud', x: 12, y: 41, r: 5 },
      { t: 'rocks', n: 10 },
    ],
    exits: [{ x: 38, y: 0.6, r: 1.8, to: 'whisperwood', entry: 'fromMirefen', label: 'Whisperwood' }],
    entries: { fromWhisperwood: [37.6, 4] },
    npcs: [],
    objects: [
      { id: 'ws_mire', kind: 'waystone', x: 40, y: 6.5 },
      { id: 'chest_mire', kind: 'chest', x: 6.5, y: 6.5, gold: 150, item: 'tome_lore' },
    ],
    camps: [
      { id: 'm1', x: 33, y: 9, units: ['bog_lurker', 'bog_lurker'] },
      { id: 'm2', x: 26, y: 17, units: ['wisp', 'bog_lurker'] },
      { id: 'm3', x: 41, y: 23, units: ['fen_stalker', 'wisp'] },
      { id: 'm4', x: 19, y: 27, units: ['fen_stalker', 'fen_stalker'] },
      { id: 'm5', x: 28, y: 31, units: ['bog_lurker', 'wisp', 'wisp'] },
      { id: 'm6', x: 12, y: 22, units: ['fen_stalker', 'bog_lurker'] },
      { id: 'm7', x: 30, y: 42, units: ['fen_stalker', 'wisp', 'bog_lurker'] },
      { id: 'm8', x: 12, y: 6, units: ['wisp', 'wisp'] },
      { id: 'bogmother', x: 11, y: 42, units: ['bogmother'], unique: 'bogmother', leash: 9 },
    ],
  },

  barrows: {
    name: 'Ashen Barrows', subtitle: 'Tombs beneath the old mountain', level: '5–10', minLevel: 8, theme: 'cave', w: 52, h: 52, seed: 505, cave: true,
    treeDensity: 0, border: 0,
    features: [
      { t: 'room', x: 26, y: 46, r: 4 },
      { t: 'room', x: 26, y: 32, r: 5.5 },
      { t: 'room', x: 10, y: 30, r: 5 },
      { t: 'room', x: 42, y: 30, r: 5 },
      { t: 'room', x: 13, y: 15, r: 4.5 },
      { t: 'room', x: 40, y: 44, r: 4 },
      { t: 'room', x: 28, y: 10, r: 7.5 },
      { t: 'tunnel', pts: [[26, 52], [26, 46], [26, 32]], w: 3 },
      { t: 'tunnel', pts: [[22, 32], [12, 30]], w: 2.6 },
      { t: 'tunnel', pts: [[30, 32], [40, 30]], w: 2.6 },
      { t: 'tunnel', pts: [[10, 26], [13, 18]], w: 2.6 },
      { t: 'tunnel', pts: [[28, 44], [38, 44]], w: 2.4 },
      { t: 'tunnel', pts: [[26, 28], [27, 16]], w: 3 },
      { t: 'gate', x: 25, y: 19, w: 4, h: 2, flag: 'sealsBroken', style: 'embergate' },
    ],
    exits: [{ x: 26, y: 51.4, r: 1.8, to: 'brindle', entry: 'fromBarrows', label: 'Brindle Fields' }],
    entries: { fromBrindle: [26, 48.5] },
    npcs: [],
    objects: [
      { id: 'ws_barrows', kind: 'waystone', x: 23.5, y: 46 },
      { id: 'seal_a', kind: 'seal', x: 7.5, y: 29.5, quest: 'barrows', requiresCamp: 'c3' },
      { id: 'seal_b', kind: 'seal', x: 45, y: 29.5, quest: 'barrows', requiresCamp: 'c4' },
      { id: 'seal_c', kind: 'seal', x: 11.5, y: 13, quest: 'barrows', requiresCamp: 'c5' },
      { id: 'chest_barrow', kind: 'chest', x: 42.5, y: 46, gold: 200, item: 'circlet', requiresCamp: 'c6' },
    ],
    camps: [
      { id: 'c1', x: 26, y: 42, units: ['cinderling', 'cinderling', 'cinderling'] },
      { id: 'c2', x: 26, y: 33, units: ['ash_zealot', 'cinderling', 'cinderling'] },
      { id: 'c3', x: 11, y: 31, units: ['revenant', 'revenant', 'ash_zealot'] },
      { id: 'c4', x: 42, y: 31, units: ['cinder_brute', 'cinderling', 'cinderling'] },
      { id: 'c5', x: 14, y: 16, units: ['revenant', 'ash_zealot', 'ash_zealot'] },
      { id: 'c6', x: 40, y: 43, units: ['cinder_brute', 'revenant'] },
      { id: 'c7', x: 34, y: 31, units: ['revenant', 'cinderling'] },
      { id: 'c8', x: 18, y: 31, units: ['cinderling', 'cinderling'] },
      { id: 'warden', x: 28, y: 8, units: ['cinder_warden'], unique: 'cinder_warden', leash: 11 },
    ],
  },
};

G.WAYSTONES = {
  ws_town: { zone: 'hollowmere', name: 'Hollowmere' },
  ws_brindle: { zone: 'brindle', name: 'Brindle Fields' },
  ws_whisper: { zone: 'whisperwood', name: 'Whisperwood' },
  ws_mire: { zone: 'mirefen', name: 'Mirefen' },
  ws_barrows: { zone: 'barrows', name: 'Ashen Barrows' },
};

/* How a party of `partyLevel` should feel about something of `level`.
   Used for enemy name colors. */
G.dangerOf = (level, partyLevel) => {
  const d = level - partyLevel;
  if (d <= -4) return { tag: 'trivial', color: '#9e9e9e' };
  if (d <= -2) return { tag: 'easy', color: '#8fe39b' };
  if (d <= 1) return { tag: 'even', color: '#ffe08a' };
  if (d <= 3) return { tag: 'hard', color: '#ffad4a' };
  return { tag: 'deadly', color: '#ff5a4a' };
};
// A zone's recommended level, colored by how far below it the party is.
G.zoneWarn = (zoneId) => {
  const Z = G.ZONES[zoneId];
  if (!Z.minLevel) return null;
  const gap = Z.minLevel - G.partyLevel();
  const color = gap >= 3 ? '#ff5a4a' : gap >= 1 ? '#ffad4a' : '#cfe8b0';
  const note = gap >= 3 ? 'Your party is badly under-levelled for this area.' : gap >= 1 ? 'Your party is a little under-levelled for this area.' : '';
  return { text: `Recommended level ${Z.minLevel}+`, color, note, gap };
};
