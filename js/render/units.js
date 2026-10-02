/* Unit art: heroes, people and monsters drawn as detailed vector figures.

   - Every figure is drawn in "sprite units" (feet at 0,0, up is negative y, a person
     is about 36 units tall) with two-tone shading: each part is lit from the upper
     left and steps into shadow toward the lower right.
   - A finished pose is drawn once into a small cached image with a thick outer
     outline, then reused every frame (the cache is keyed by look, facing, pose frame
     and zoom). That keeps the detail cheap: a crowd of units costs about the same as
     before.
   - Looks are data: hero costumes, visible gear, enemy outfits, pack variation. */
G.art = (() => {
  const TAU = Math.PI * 2;
  const OUT = '#1a120c';
  const SIZE = 1.12; // units are drawn a little larger than the old art

  /* ---------------- colour helpers ---------------- */
  const hexRgb = (h) => { let s = h.replace('#', ''); if (s.length === 3) s = s.split('').map((x) => x + x).join(''); const n = parseInt(s, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  // lighten (amt > 0) or darken (amt < 0)
  function sh(h, amt) {
    let [r, g, b] = hexRgb(h);
    if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; } else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
    return toHex(r, g, b);
  }
  function mix(a, b, t) { const A = hexRgb(a), B = hexRgb(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
  const rgba = (h, a) => { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; };

  /* ---------------- drawing helpers (unit coordinates) ---------------- */
  let FLIP = false; // when a pose is mirrored, light still comes from the upper left
  // two-tone gradient across a part's bounding box
  function cel(c, x0, y0, x1, y1, base, step = 0.55, depth = 0.3) {
    if (FLIP) { const t = x0; x0 = x1; x1 = t; }
    const g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, sh(base, 0.24)); g.addColorStop(0.22, sh(base, 0.07)); g.addColorStop(Math.max(0.25, step - 0.03), base);
    g.addColorStop(Math.min(0.97, step + 0.03), sh(base, -depth)); g.addColorStop(1, sh(base, -depth - 0.12));
    return g;
  }
  function P(c, d, fill, lw = 0.32) { const p = new Path2D(d); c.fillStyle = fill; c.fill(p); if (lw) { c.strokeStyle = OUT; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(p); } return p; }
  function L(c, d, col, lw) { c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(new Path2D(d)); }
  const LP = L;
  function E(c, x, y, rx, ry, fill, lw = 0, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0.05, rx), Math.max(0.05, ry), rot, 0, TAU); c.fillStyle = fill; c.fill(); if (lw) { c.strokeStyle = OUT; c.lineWidth = lw; c.stroke(); } }
  // a limb: an outlined thick stroke along points, shaded across its length
  function limb(c, pts, w, col, outline = true) {
    const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (outline) { c.strokeStyle = OUT; c.lineWidth = w + 0.7; c.stroke(p); }
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    c.strokeStyle = cel(c, Math.min(...xs) - w, Math.min(...ys), Math.max(...xs) + w, Math.max(...ys), col, 0.6, 0.22);
    c.lineWidth = w; c.stroke(p);
  }
  function spec(c, x, y, r, a = 0.85) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  function glow(c, x, y, r, col, a = 0.6) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0)); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  // tiny seeded random from an id, for pack variation
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  const METAL = '#a3abb4', GOLD = '#d9a441', LEATHER = '#5a3d24', BOOT = '#3a2a1e';

  /* ======================= LOOKS =======================
     A look is everything a figure needs to be drawn: its kind (humanoid or a beast
     shape), colours and costume. Looks are built per unit and keyed for the cache. */
  const HERO_BASE = {
    maren: { torso: 'leather', body: '#b8642f', trim: '#5b3a21', pants: '#4a3020', boots: BOOT, skin: '#e8c39e', hair: '#3a2416', hairStyle: 'pony',
      shoulders: 'metal', cape: '#6e3a1e', emblem: '#ff8a2a', weapon: 'sword', shield: 'kite', shieldCol: '#7a4a24', bulk: 1.1, belt: '#3a2416' },
    tobin: { torso: 'robe', body: '#3f7f6a', trim: '#d9f2c9', pants: '#2a4a3c', boots: '#4a3a24', skin: '#e8c39e', hair: '#c9b38a', hairStyle: 'short', beard: '#cdb88f',
      hat: '#5a6e3a', weapon: 'staff', orb: '#9fe8ff', charms: true, belt: '#6a4a2a', pack: true },
    ysolde: { torso: 'leather', body: '#6a4c8f', trim: '#2f2240', pants: '#2f2240', boots: '#2a1e2e', skin: '#e3b894', hair: '#1e1424', hairStyle: 'long',
      hood: '#3d2a55', cape: '#3d2a55', weapon: 'bow', quiver: true, belt: '#2a1e2e', bracers: '#4a3a5a' },
  };
  // How carried gear shows on a hero. The strongest piece of each kind wins.
  const GEAR = {
    tempered_blade: { weapon: 'sword', blade: '#c8d4de', rank: 1 }, bandit_dirk: { weapon: 'dagger', rank: 1 },
    thornjaw_cleaver: { weapon: 'cleaver', rank: 3 }, deepsteel_blade: { weapon: 'sword', blade: '#8fc4ff', bladeGlow: '#7fb8ff', rank: 4 }, crawler_fang: { weapon: 'dagger', blade: '#8fd8ff', rank: 2 },
    ironbark_buckler: { shield: 'buckler', shieldCol: '#8d6e4f' },
    sentinel_plate: { plate: '#a3abb4' }, brood_carapace: { plate: '#4a5a3a' },
    wolfhide_cloak: { mantle: '#7f8c8d' }, greymane_mantle: { mantle: '#d0d6da' }, spider_silk_wrap: { capeOver: '#e4e6e8' }, gloomweave_cloak: { capeOver: '#4a3a7a' },
    swiftboots: { boots: '#9c6b3f', wingedBoots: true }, gloves_haste: { gloves: '#c98a4b' },
    circlet: { circlet: '#f1c40f' }, hollow_crown: { circlet: '#c7a8ff', crownGlow: true },
    warden_heart: { amulet: '#ff6b1a' }, moonvine_charm: { amulet: '#9b59b6' }, sage_pendant: { amulet: '#2e86de' }, bogmother_eye: { amulet: '#58d68d' },
  };
  const WEAPON_FOR = { maren: ['sword', 'cleaver'], tobin: [], ysolde: ['dagger'] };
  function heroLook(hid, hs) {
    const L = { kind: 'humanoid', ...HERO_BASE[hid] };
    const keys = [];
    let wRank = 0;
    for (const s of (hs && hs.items) || []) {
      const g = s && GEAR[s.id];
      if (!g) continue;
      keys.push(s.id);
      for (const k in g) {
        if (k === 'rank' || k === 'weapon' || k === 'blade' || k === 'bladeGlow') continue;
        if (k === 'shield' && hid !== 'maren') continue;
        if (k === 'capeOver') { L.cape = g[k]; continue; }
        L[k] = g[k];
      }
      // a better weapon replaces the hero's own, if it suits them (bow and staff users keep theirs)
      if (g.weapon && WEAPON_FOR[hid].includes(g.weapon) && g.rank > wRank) { wRank = g.rank; L.weapon = g.weapon; if (g.blade) L.blade = g.blade; if (g.bladeGlow) L.bladeGlow = g.bladeGlow; }
      if (g.weapon && hid === 'ysolde' && g.weapon === 'dagger') { L.sideDagger = g.blade || '#c8d4de'; }
    }
    if (L.shield === 'buckler' && hid === 'maren' && L.shieldCol === '#8d6e4f') L.shield = 'kite'; // Maren keeps her kite shield, recoloured
    L.key = 'hero-' + hid + '|' + keys.sort().join(',');
    return L;
  }
  const NPC_HAIR = ['#3a2416', '#6a4a2a', '#c9b38a', '#2a1a10', '#8a8a8a'];
  function npcLook(id, l) {
    const h = [...id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
    return { kind: 'humanoid', key: 'npc-' + id, torso: l.apron ? 'tunic' : 'tunic', body: l.color, trim: sh(l.color, -0.4), pants: sh(l.color, -0.5), boots: BOOT,
      skin: ['#e8c39e', '#d9a882', '#c98f6a', '#f0d2b0'][h % 4], hair: NPC_HAIR[h % 5], hairStyle: l.hood ? 'short' : ['short', 'long', 'bald', 'short', 'pony'][h % 5],
      beard: l.beard ? '#d9d4cc' : h % 3 === 0 ? NPC_HAIR[h % 5] : null, hood: l.hood ? sh(l.color, -0.3) : null, hat: l.hat ? (l.hat === true ? '#8a6a3a' : l.hat) : null,
      apron: l.apron ? '#efe4cc' : null, weapon: l.staff ? 'staff' : l.bow ? 'bow' : null, orb: l.accent && l.staff ? '#9fe8ff' : null, pack: !!l.pack, bulk: l.big ? 1.15 : 1, belt: '#3a2416',
      quiver: !!l.bow };
  }
  // Enemy humanoids by unit id; anything not listed falls back to its colours.
  const ENEMY = {
    cutthroat: (d) => ({ torso: 'leather', body: d.color, trim: '#3a1e14', pants: '#3a2a20', boots: BOOT, skin: '#d9a882', hair: '#2a1a10', hairStyle: 'short', bandana: '#a8321e', weapon: 'sword', blade: '#b8c0c6', offDagger: true, belt: '#2a1a10', scarf: '#3a2a20' }),
    bandit_archer: (d) => ({ torso: 'leather', body: d.color, trim: '#3a2a14', pants: '#3a2a20', boots: BOOT, skin: '#e0b48e', hair: '#5a3a1e', hairStyle: 'short', cap: '#6a4a2a', weapon: 'bow', quiver: true, belt: '#2a1a10' }),
    bruiser: (d) => ({ torso: 'vest', body: d.color, trim: '#3a1a10', pants: '#3a2a20', boots: BOOT, skin: '#c98f6a', hair: '#2a1a10', hairStyle: 'bald', beard: '#2a1a10', weapon: 'club', bulk: 1.3, belt: '#2a1a10', shoulders: 'leather', wraps: '#d8c8a8' }),
    grell: (d) => ({ torso: 'vest', body: '#8a2a1b', trim: '#3a1a10', pants: '#4a3020', boots: '#2e2018', skin: '#c9946a', hairStyle: 'topknot', hair: '#2a1a10', beard: '#3a2416', braid: true,
      tusks: true, warpaint: '#a01a10', weapon: 'greataxe', bulk: 1.38, mantle: '#6a5a48', shoulders: 'spiked', belt: '#2a1a10', skullBuckle: true, wraps: '#d8c8a8', scars: true }),
    ash_zealot: (d) => ({ torso: 'robe', body: '#4a2328', trim: '#ff9d4a', pants: '#2a1416', boots: '#1a1010', skin: '#c98f6a', hood: '#3a1a1e', mask: '#2a1a14', eyes: '#ffb347', weapon: 'staff', orb: '#ff8a2a', belt: '#1a1010' }),
    revenant: (d) => ({ torso: 'plate', body: '#4a5560', trim: '#2a3038', pants: '#2a3038', boots: '#2a3038', skin: '#bcd7e6', ghost: true, helm: '#6a7884', eyes: '#9fe8ff', weapon: 'sword', blade: '#c8e8ff', bladeGlow: '#9fd8ff', shoulders: 'metal', cape: '#2a3a48', tattered: true }),
    hollow_knight: (d) => ({ torso: 'plate', body: '#3a4250', trim: '#222832', pants: '#222832', boots: '#222832', skin: '#bcd7e6', ghost: true, helm: '#5a6474', plume: '#7fd8ff', eyes: '#9fe8ff', weapon: 'sword', blade: '#c8e8ff', bladeGlow: '#9fd8ff', shield: 'kite', shieldCol: '#2a3240', shoulders: 'metal', bulk: 1.12 }),
    hollow_king: (d) => ({ torso: 'robe', body: '#2c2f3e', trim: '#c7a8ff', pants: '#1a1c26', boots: '#1a1c26', skin: '#bcd7e6', ghost: true, crown: '#c7a8ff', eyes: '#d8c8ff', weapon: 'greatsword', blade: '#d8c8ff', bladeGlow: '#c7a8ff', cape: '#1e2030', tattered: true, shoulders: 'metal', bulk: 1.15, souls: true }),
  };
  function enemyLook(e) {
    const d = e.def;
    const base = ENEMY[e.defId] ? ENEMY[e.defId](d) : { torso: 'tunic', body: d.color, trim: sh(d.color, -0.4), pants: sh(d.color, -0.5), boots: BOOT, skin: d.ghost ? '#bcd7e6' : '#d9b08c', hair: '#2a1a10', hairStyle: 'short',
      hood: d.hood ? sh(d.color, -0.3) : null, ghost: d.ghost, helm: d.helmet || (d.boss && !d.crown) ? '#9aa3ab' : null, crown: d.crown ? GOLD : null, weapon: d.weapon, orb: d.accent, bulk: (d.size || 1) > 1.2 ? 1.15 : 1 };
    return { kind: 'humanoid', ...base };
  }
  // Pack variation: a few looks per enemy type, picked from the unit's id.
  function variantOf(e) { return Math.floor(hash(e.id || 1) * 3); }
  function lookFor(e) {
    if (e.kind === 'hero') return heroLook(e.heroId, e.hs);
    if (e.kind === 'npc') {
      if (e.def.look && e.def.look.hero) return heroLook(e.def.look.hero, null);
      return npcLook(e.npcId, e.def.look);
    }
    const d = e.def || {};
    const v = d.boss || d.summon ? 0 : variantOf(e);
    if (d.shape === 'humanoid') {
      const L = enemyLook(e);
      if (v === 1) { L.body = sh(L.body, 0.1); L.skin = L.ghost ? L.skin : sh(L.skin || '#d9b08c', -0.12); }
      if (v === 2) { L.body = sh(L.body, -0.12); if (L.bandana) L.bandana = '#3a5a7a'; if (L.cap) L.cap = '#4a3a2a'; }
      L.key = 'enemy-' + e.defId + '-' + v;
      return L;
    }
    const tint = v === 1 ? 0.1 : v === 2 ? -0.12 : 0;
    return { kind: d.shape, key: 'beast-' + e.defId + '-' + v, id: e.defId, color: tint ? sh(d.color, tint) : d.color, accent: d.accent, boss: !!d.boss, elite: !!d.elite, summon: !!d.summon, scar: v === 2, size: d.size || 1 };
  }

  /* ======================= HUMANOIDS =======================
     v: 0 front, 1 three-quarter front, 2 side, 3 three-quarter back, 4 back.
     Unflipped poses face screen right. P (pose): {walk, atk, cast, t, hurt}. */
  function humanoid(c, L, v, Pz) {
    const back = v >= 3, side = v === 2, front = v === 0;
    const bulk = L.bulk || 1, hulk = bulk > 1.25;
    const wF = [1, 0.9, 0.68, 0.9, 1][v];
    const tw = 6 * bulk * wF;
    const fs = [0, 1.3, 2.6, 0, 0][v];
    const moving = Pz.walk != null, ph = Pz.walk || 0, sw = Math.sin(ph);
    const legK = hulk ? 0.88 : 1;
    const hipY = -11.5 * legK, shY = hipY - 11.8 - (bulk - 1) * 3, hy = shY - 6.4 - (hulk ? 0.4 : 0);
    const melee = !['bow', 'staff'].includes(L.weapon);
    // arm angle (radians from hanging straight down; negative swings forward/up)
    let armR = moving ? sw * 0.38 : Math.sin((Pz.t || 0) * 2) * 0.04;
    let lean = 0;
    if (Pz.atk != null) {
      const p = Pz.atk;
      if (L.weapon === 'bow') armR = -1.5;
      else if (L.weapon === 'staff') armR = -0.4 - Math.sin(p * Math.PI) * 1.4;
      else if (p < 0.35) { armR = -2.4 * (p / 0.35); lean = -0.05 * (p / 0.35); }       // wind up
      else if (p < 0.6) { const q = (p - 0.35) / 0.25; armR = -2.4 + 3.8 * q; lean = 0.13 * q; } // strike
      else { const q = (p - 0.6) / 0.4; armR = 1.4 - 1.1 * q; lean = 0.13 * (1 - q); }        // follow through
    }
    if (Pz.cast) armR = -2.5;
    if (Pz.hurt) { armR = 0.5; lean = -0.14; }
    const bob = moving ? Math.abs(Math.cos(ph)) * 0.9 : Math.sin((Pz.t || 0) * 2) * 0.25;
    const cloth = L.body, skin = L.skin || '#e8c39e', ghostA = L.ghost ? 0.55 : 1;

    /* legs (not bobbing) */
    const hsF = [0, 0.55, 1, 0.55, 0][v];
    const lx = [2.1, 1.9, 1.0, 1.9, 2.1][v] * bulk;
    const la = moving ? sw * 3.2 * hsF : (Pz.atk != null && melee ? 1.2 * hsF : 0);
    const lift = (s) => (moving ? Math.max(0, s) * 1.8 * (1 - hsF * 0.6) : 0);
    const leg = (x0, dx, up, far) => {
      const col = far ? sh(L.pants, -0.25) : L.pants, bc = far ? sh(L.boots, -0.2) : L.boots;
      const kneeX = x0 + dx * 0.55 + (side ? 0.7 : 0) * (up > 0 ? 1 : 0.3), kneeY = hipY * 0.48 - up * 0.6;
      const ax = x0 + dx, ay = -1.6 - up;
      c.globalAlpha = ghostA;
      limb(c, [[x0, hipY], [kneeX, kneeY], [ax, ay]], 3.1 * (hulk ? 1.25 : 1), col);
      // boot with a cuff; the toe points the way the figure faces
      const tf = [0.3, 0.8, 1.3, 0.5, 0.2][v] * (back ? -0.4 : 1);
      const bw = 1.7 * (hulk ? 1.2 : 1);
      P_boot(c, ax, ay + 1.6, bw, tf, bc, L);
      c.globalAlpha = 1;
    };
    // far leg first in side views
    if (side) { leg(-lx, -la, lift(-sw), true); leg(lx, la, lift(sw), false); }
    else { leg(-lx, la, lift(sw), back); leg(lx, -la, lift(-sw), false); }

    c.save();
    c.translate(0, -bob);
    if (lean) { c.translate(0, hipY); c.rotate(lean); c.translate(0, -hipY); }

    /* cape behind the body (front and side views); it trails the walk a little */
    const capeSw = moving ? -Math.sin(ph - 0.9) * 1.1 : Math.sin((Pz.t || 0) * 1.3) * 0.3;
    if (L.cape && !back) capeBehind(c, L, v, tw, shY, capeSw, side);

    /* arm positions */
    const wArmX = side ? 0.7 : tw - 1.6;
    const oArmX = side ? -1 : -tw + 1.6;
    if (back) {
      weaponArm(c, L, wArmX, shY + 1.6, armR, Pz, true);
      if (L.shield) shield(c, L, -tw + 0.2, shY + 5.6, v === 3 ? 0.8 : 0.95, true);
      else offArm(c, L, oArmX, shY + 1.6, moving ? -sw : 0, side, true);
    } else {
      if (L.pack) pack(c, L, v, tw, shY, false);
      if (L.quiver) quiver(c, L, v, tw, shY, false);
      if (!L.shield || side) offArm(c, L, oArmX, shY + 1.6, moving ? -sw : 0, side, false, Pz);
    }

    /* torso */
    torso(c, L, v, tw, shY, hipY, Pz);
    if (back) { if (L.cape) capeBack(c, L, tw, shY, capeSw); if (L.pack) pack(c, L, v, tw, shY, true); if (L.quiver) quiver(c, L, v, tw, shY, true); }
    shoulders(c, L, v, tw, shY);

    /* head */
    head(c, L, v, hy, fs, Pz);

    /* in front of the body */
    if (!back) {
      if (L.shield && !side) shield(c, L, front ? -5.6 * bulk : -tw * 0.86, shY + 6, front ? 1 : 0.86, false);
      if (L.shield && side) shield(c, L, 4.2, shY + 6, 0.42, false);
      weaponArm(c, L, wArmX, shY + 1.6, armR, Pz, false);
    }
    if (L.souls) for (let i = 0; i < 3; i++) { const a = (Pz.t || 0) * 1.5 + i * 2.1; glow(c, Math.cos(a) * 9, hy + 2 + Math.sin(a) * 3, 2.6, '#c7a8ff', 0.8); E(c, Math.cos(a) * 9, hy + 2 + Math.sin(a) * 3, 0.7, 0.7, '#f2ecff'); }
    c.restore();
  }

  function P_boot(c, x, y, bw, tf, col, L) {
    const toe = tf * 1.6;
    P(c, `M ${x - bw} ${y - 2.6} L ${x + bw} ${y - 2.6} L ${x + bw + Math.max(0, toe) * 0.2} ${y - 0.9} Q ${x + bw + toe} ${y - 0.7} ${x + bw + toe} ${y + 0.35} L ${x - bw + Math.min(0, toe)} ${y + 0.35} Q ${x - bw + Math.min(0, toe) - 0.2} ${y - 0.8} ${x - bw} ${y - 2.6} Z`,
      cel(c, x - bw, y - 2.6, x + bw + toe, y + 0.4, col), 0.3);
    L_line(c, x - bw + 0.2, y - 2.2, x + bw - 0.2, y - 2.2, sh(col, 0.3), 0.35);
    if (L && L.wingedBoots) { P(c, `M ${x - bw} ${y - 2.4} L ${x - bw - 1.8} ${y - 4} L ${x - bw - 0.6} ${y - 1.6} Z`, '#f2ead8', 0.2); }
  }
  function L_line(c, x0, y0, x1, y1, col, lw) { c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }

  function torso(c, L, v, tw, shY, hipY, Pz) {
    const back = v >= 3, side = v === 2, front = v === 0;
    const robe = L.torso === 'robe', cx = [0, 0.7, 1.3, 0, 0][v];
    const bottom = robe ? -2.6 : hipY + 1.2;
    const d = `M ${-tw} ${shY} Q ${-tw - 1} ${shY + 7} ${robe ? -tw - 1.6 : -tw + 0.5} ${bottom} L ${robe ? tw + 1.6 : tw - 0.5} ${bottom} Q ${tw + 1} ${shY + 7} ${tw} ${shY} Q 0 ${shY - 2.6} ${-tw} ${shY} Z`;
    if (L.torso === 'vest') {
      // bare chest and belly under an open vest
      P(c, d, cel(c, -tw, shY - 2, tw, bottom, L.skin, 0.6, 0.24), 0.32);
      if (!back) {
        const open = side ? 1.4 : 2.6 * (v === 1 ? 0.85 : 1);
        P(c, `M ${-tw} ${shY} Q ${-tw - 1} ${shY + 7} ${-tw + 0.5} ${bottom} L ${cx - open} ${bottom} Q ${cx - open - 0.6} ${shY + 6} ${cx - open + 0.6} ${shY - 1} Z`, cel(c, -tw, shY, cx, bottom, L.body), 0.28);
        P(c, `M ${tw} ${shY} Q ${tw + 1} ${shY + 7} ${tw - 0.5} ${bottom} L ${cx + open} ${bottom} Q ${cx + open + 0.6} ${shY + 6} ${cx + open - 0.6} ${shY - 1} Z`, cel(c, cx, shY, tw, bottom, L.body, 0.3), 0.28);
        L_line(c, cx - 1.2, shY + 5, cx + 0.8, shY + 5.6, sh(L.skin, -0.3), 0.3);
        if (L.scars) L_line(c, cx - 2, shY + 2.2, cx + 1.5, shY + 6.5, '#e8b8a0', 0.4);
      } else P(c, d, cel(c, -tw, shY - 2, tw, bottom, L.body), 0.32);
    } else {
      P(c, d, cel(c, -tw, shY - 2, tw, bottom, robe ? L.body : L.body, 0.56), 0.32);
      if (L.plate) {
        // a breastplate (or backplate) over the clothes
        const pw = tw * 0.82;
        P(c, `M ${-pw} ${shY + 0.6} Q ${-pw - 0.4} ${shY + 6} ${-pw * 0.8} ${hipY + 2} Q 0 ${hipY + 3.4} ${pw * 0.8} ${hipY + 2} Q ${pw + 0.4} ${shY + 6} ${pw} ${shY + 0.6} Q 0 ${shY - 1} ${-pw} ${shY + 0.6} Z`, cel(c, -pw, shY, pw, hipY + 3, L.plate, 0.5, 0.32), 0.3);
        if (!back) { L_line(c, cx, shY + 0.4, cx, hipY + 2.6, sh(L.plate, -0.35), 0.3); spec(c, cx - pw * 0.45, shY + 3, 1.6, 0.7); }
      }
      if (L.torso === 'plate' && !L.plate && !back) { L_line(c, cx, shY + 0.5, cx, hipY + 2, sh(L.body, -0.35), 0.3); spec(c, cx - tw * 0.4, shY + 3, 1.5, 0.6); }
      if (L.torso === 'leather' && !back) { L_line(c, cx - 0.4, shY + 0.6, cx - 0.2, hipY + 1.4, sh(L.body, -0.4), 0.25); if (!side) L_line(c, cx + 0.8, shY + 1.2, cx + tw * 0.65, shY + 4.5, L.trim === '#5b3a21' ? '#ecd6a4' : sh(L.body, 0.35), 0.2); }
      if (robe && !back) {
        // robe trim down the front and around the hem
        L_line(c, cx, shY + 1, cx + (side ? 0.6 : 0), bottom - 0.3, L.trim, 0.55);
        L_line(c, robe ? -tw - 1.3 : -tw, bottom - 0.6, tw + 1.3, bottom - 0.6, L.trim, 0.5);
      }
      if (robe && back) L_line(c, -tw - 1.3, bottom - 0.6, tw + 1.3, bottom - 0.6, L.trim, 0.5);
    }
    if (L.apron && !back) { const aw = side ? 2.4 : 3.6 * (v === 1 ? 0.85 : 1); P(c, `M ${cx - aw} ${shY + 4} L ${cx + aw} ${shY + 4} L ${cx + aw + 0.6} ${hipY + 2.6} L ${cx - aw - 0.6} ${hipY + 2.6} Z`, cel(c, cx - aw, shY + 4, cx + aw, hipY + 3, L.apron, 0.6, 0.18), 0.25); }
    // belt and buckle
    if (L.belt) {
      const by = hipY - 0.6;
      P(c, `M ${-tw + 0.3} ${by - 0.9} L ${tw - 0.3} ${by - 0.9} L ${tw - 0.2} ${by + 0.7} L ${-tw + 0.2} ${by + 0.7} Z`, cel(c, -tw, by - 1, tw, by + 1, L.belt), 0.22);
      if (!back) {
        if (L.skullBuckle) { E(c, cx, by, 1.3, 1.2, '#e8e0cc', 0.22); E(c, cx - 0.45, by - 0.1, 0.3, 0.35, '#2a1a10'); E(c, cx + 0.45, by - 0.1, 0.3, 0.35, '#2a1a10'); }
        else P(c, `M ${cx - 0.8} ${by - 1} L ${cx + 0.8} ${by - 1} L ${cx + 0.8} ${by + 0.8} L ${cx - 0.8} ${by + 0.8} Z`, GOLD, 0.2);
      }
    }
    if (L.emblem && !back && !side) {
      const ex = cx + tw * 0.32, ey = shY + 3.6;
      P(c, `M ${ex} ${ey - 2} Q ${ex - 1.5} ${ey} ${ex - 0.7} ${ey + 1.5} Q ${ex} ${ey + 2.4} ${ex + 0.7} ${ey + 1.5} Q ${ex + 1.5} ${ey} ${ex} ${ey - 2} Z`, L.emblem, 0.2);
      P(c, `M ${ex} ${ey - 0.4} Q ${ex - 0.5} ${ey + 0.6} ${ex - 0.1} ${ey + 1.3} Q ${ex + 0.4} ${ey + 1} ${ex} ${ey - 0.4} Z`, '#ffe08a', 0);
    }
    if (L.amulet && !back) { L_line(c, cx - 1.4, shY - 0.4, cx, shY + 2.4, '#c9a046', 0.2); L_line(c, cx + 1.4, shY - 0.4, cx, shY + 2.4, '#c9a046', 0.2); glow(c, cx, shY + 2.8, 1.6, L.amulet, 0.6); E(c, cx, shY + 2.8, 0.6, 0.7, L.amulet, 0.15); }
    if (L.scarf && !back) P(c, `M ${-tw * 0.7} ${shY - 0.3} Q 0 ${shY + 2} ${tw * 0.7} ${shY - 0.3} L ${tw * 0.6} ${shY + 1} Q 0 ${shY + 3} ${-tw * 0.6} ${shY + 1} Z`, cel(c, -tw, shY, tw, shY + 3, L.scarf), 0.2);
  }

  function shoulders(c, L, v, tw, shY) {
    const side = v === 2;
    if (L.mantle) {
      // a fur mantle across the shoulders, jagged at the edge
      const w = tw + 1.2;
      let d = `M ${-w} ${shY + 1.6}`;
      const n = 9;
      for (let i = 0; i <= n; i++) { const x = -w + (2 * w * i) / n; d += ` L ${x} ${shY - 1.8 - (i % 2) * 1.1} L ${x + w / n} ${shY - 0.8}`; }
      d += ` L ${w} ${shY + 1.6} Q 0 ${shY + 3.2} ${-w} ${shY + 1.6} Z`;
      P(c, d, cel(c, -w, shY - 3, w, shY + 3, L.mantle, 0.55, 0.28), 0.28);
      for (let i = -2; i <= 2; i++) L_line(c, i * w * 0.35, shY - 0.4, i * w * 0.35 + 0.5, shY + 1, sh(L.mantle, -0.35), 0.22);
    }
    if (!L.shoulders) return;
    const col = L.shoulders === 'leather' ? sh(L.body, -0.2) : L.shoulders === 'spiked' ? '#5a5a62' : (L.plate || METAL);
    const pad = (x, s, near) => {
      const rx = 2.3 * (L.bulk || 1) * s, ry = 1.9 * (L.bulk || 1);
      P(c, `M ${x - rx} ${shY + 1.2} Q ${x - rx} ${shY - ry} ${x} ${shY - ry} Q ${x + rx} ${shY - ry} ${x + rx} ${shY + 1.2} Q ${x} ${shY + 2.2} ${x - rx} ${shY + 1.2} Z`, cel(c, x - rx, shY - ry, x + rx, shY + 2, col, 0.5, 0.3), 0.28);
      if (L.shoulders !== 'leather') spec(c, x - rx * 0.35, shY - ry * 0.4, 0.9, 0.8);
      if (L.shoulders === 'spiked' && near) for (const dx of [-0.9, 0.9]) P(c, `M ${x + dx - 0.5} ${shY - ry + 0.3} L ${x + dx * 1.3} ${shY - ry - 2.4} L ${x + dx + 0.5} ${shY - ry + 0.3} Z`, '#d0d0d6', 0.18);
    };
    if (side) pad(0.3, 0.8, true);
    else { pad(-tw + 0.6, 1, v >= 3); if (L.shoulders !== 'spiked' || v < 3) pad(tw - 0.6, 1, true); else pad(tw - 0.6, 1, false); }
  }

  function capeBehind(c, L, v, tw, shY, swing, side) {
    const col = L.cape, hem = -1.8;
    let d;
    if (side) d = `M ${-2.6} ${shY + 0.4} C ${-6.5} ${shY + 6} ${-8.5 + swing} ${hem - 6} ${-8 + swing} ${hem} L ${0.4 + swing * 0.3} ${hem + 0.6} Q ${1} ${shY + 10} ${1} ${shY + 0.4} Z`;
    else d = `M ${-tw - 0.4} ${shY + 0.4} L ${tw + 0.4} ${shY + 0.4} Q ${tw + 2.6} ${shY + 10} ${tw + 2.2 + swing * 0.5} ${hem} L ${-tw - 2.2 - swing * 0.5} ${hem} Q ${-tw - 2.6} ${shY + 10} ${-tw - 0.4} ${shY + 0.4} Z`;
    c.globalAlpha = L.ghost ? 0.7 : 1;
    P(c, d, cel(c, -tw - 3, shY, tw + 3, hem, sh(col, -0.12), 0.5), 0.3);
    c.globalAlpha = 1;
  }
  function capeBack(c, L, tw, shY, swing) {
    const col = L.cape, hem = -1.6;
    let d = `M ${-tw - 0.3} ${shY - 0.2} L ${tw + 0.3} ${shY - 0.2} Q ${tw + 2.2} ${shY + 10} ${tw + 2 + swing * 0.5} ${hem}`;
    if (L.tattered) { for (let i = 6; i >= 0; i--) { const x = -tw - 2 + ((2 * tw + 4) * i) / 6; d += ` L ${x + swing * 0.4} ${hem - (i % 2 ? 2.2 : 0)}`; } }
    else d += ` L ${-tw - 2 - swing * 0.5} ${hem}`;
    d += ` Q ${-tw - 2.2} ${shY + 10} ${-tw - 0.3} ${shY - 0.2} Z`;
    c.globalAlpha = L.ghost ? 0.75 : 1;
    P(c, d, cel(c, -tw - 2, shY, tw + 2, hem, col, 0.55), 0.3);
    for (const x of [-2.2, 0.6, 3]) L_line(c, x, shY + 2, x + swing * 0.4, hem - 1, sh(col, -0.3), 0.3);
    c.globalAlpha = 1;
  }

  function pack(c, L, v, tw, shY, onBack) {
    const col = '#7a5a3a';
    if (onBack) { P(c, `M -4.4 ${shY + 0.6} L 4.4 ${shY + 0.6} L 4 ${shY + 11} L -4 ${shY + 11} Z`, cel(c, -4.4, shY, 4.4, shY + 11, col), 0.3); P(c, `M -4.4 ${shY + 0.6} L 4.4 ${shY + 0.6} L 4.2 ${shY + 3.6} L -4.2 ${shY + 3.6} Z`, cel(c, -4.4, shY, 4.4, shY + 4, '#5a3d24'), 0.25); }
    else if (v === 2) P(c, `M -8.4 ${shY + 1} L -3.4 ${shY + 1} L -3.4 ${shY + 10} L -8.2 ${shY + 10} Z`, cel(c, -8.4, shY, -3.4, shY + 10, col), 0.3);
    else P(c, `M ${-tw - 2} ${shY + 2} L ${-tw + 1.6} ${shY + 2} L ${-tw + 1.6} ${shY + 10} L ${-tw - 2} ${shY + 10} Z`, cel(c, -tw - 2, shY, -tw + 2, shY + 10, col), 0.3);
  }
  function quiver(c, L, v, tw, shY, onBack) {
    c.save();
    c.translate(onBack ? -1 : v === 2 ? -4 : -tw * 0.5, shY + 5); c.rotate(onBack ? 0.45 : v === 2 ? 0.35 : 0.5);
    P(c, 'M -1.7 -6 L 1.7 -6 L 1.5 6 L -1.5 6 Z', cel(c, -1.7, -6, 1.7, 6, LEATHER), 0.28);
    L_line(c, -1.7, -3.5, 1.7, -3.5, '#c9a046', 0.35);
    for (const [x, col] of [[-0.9, '#e8e0d0'], [0, '#d64a3a'], [0.9, '#e8e0d0']]) { L_line(c, x, -6, x, -8.6, '#8a6a42', 0.3); P(c, `M ${x - 0.5} -8 L ${x} -10.2 L ${x + 0.5} -8 Z`, col, 0.12); }
    c.restore();
  }

  function shield(c, L, x, y, sq, rear) {
    c.save(); c.translate(x, y); c.scale(sq, 1);
    const col = rear ? sh(L.shieldCol, -0.3) : L.shieldCol;
    if (L.shield === 'buckler') {
      E(c, 0, 0, 3.6, 3.6, cel(c, -3.6, -3.6, 3.6, 3.6, col, 0.55), 0.35);
      c.strokeStyle = '#b9c1c9'; c.lineWidth = 0.5; c.beginPath(); c.arc(0, 0, 3.3, 0, TAU); c.stroke();
      if (!rear) { E(c, 0, 0, 1.1, 1.1, cel(c, -1, -1, 1, 1, METAL), 0.2); spec(c, -0.4, -0.4, 0.6); }
    } else {
      const d = 'M -3.4 -5.4 Q 0 -6.4 3.4 -5.4 Q 3.8 0.6 0 6.2 Q -3.8 0.6 -3.4 -5.4 Z';
      const p = P(c, d, cel(c, -3.6, -6, 3.6, 6, col, 0.58), 0.38);
      if (!rear) {
        c.save(); c.clip(p); L_line(c, -1.2, -6, -1.1, 6, sh(col, -0.3), 0.25); L_line(c, 1.2, -6, 1.2, 6, sh(col, -0.3), 0.25); c.restore();
        c.strokeStyle = '#b9c1c9'; c.lineWidth = 0.55; c.stroke(p);
        const em = L.emblem || '#d9a441';
        P(c, 'M 0 -2.8 Q -1.8 -0.2 -0.8 1.6 Q 0 2.6 0.8 1.6 Q 1.8 -0.2 0 -2.8 Z', em, 0.2);
        P(c, 'M 0 -1 Q -0.6 0.2 -0.1 1 Q 0.5 0.6 0 -1 Z', '#ffe08a', 0);
        spec(c, -2, -3.8, 1.2, 0.6);
      } else { L_line(c, -2.5, -2.6, 2.5, -2.6, '#3a2416', 0.4); L_line(c, -2.5, 0.4, 2.5, 0.4, '#3a2416', 0.4); }
    }
    c.restore();
  }

  function offArm(c, L, x, y, swing, side, behind, Pz) {
    const sleeve = L.torso === 'vest' ? L.skin : L.torso === 'robe' ? L.body : sh(L.body, -0.1);
    const hx = x + (x < 0 ? -1.2 : 1.2) * (side ? 0 : 1) + swing * 2.4 * (side ? 1 : 0.4), hy = y + 8;
    const ex = x + (hx - x) * 0.4 - (x < 0 ? 0.5 : -0.5), ey = y + 4;
    limb(c, [[x, y], [ex, ey], [hx, hy]], 2.9 * (L.bulk > 1.25 ? 1.3 : 1), behind ? sh(sleeve, -0.25) : sleeve);
    if (L.wraps || L.bracers) limb(c, [[ex + (hx - ex) * 0.35, ey + (hy - ey) * 0.35], [hx, hy - 0.6]], 3 * (L.bulk > 1.25 ? 1.3 : 1), L.wraps || L.bracers, false);
    E(c, hx, hy + 0.4, 1.4, 1.4, cel(c, hx - 1.4, hy - 1, hx + 1.4, hy + 1.8, L.gloves || L.skin), 0.25);
    if (L.offDagger && !behind) { L_line(c, hx, hy + 0.4, hx - 0.6, hy + 5, '#c8d0d6', 0.7); L_line(c, hx - 1, hy + 0.9, hx + 1, hy + 0.9, LEATHER, 0.7); }
  }

  function weaponArm(c, L, x, y, rot, Pz, behind) {
    c.save(); c.translate(x, y); c.rotate(rot);
    const sleeve = L.torso === 'vest' ? L.skin : L.torso === 'robe' ? L.body : sh(L.body, -0.05);
    const k = L.bulk > 1.25 ? 1.3 : 1;
    limb(c, [[0, 0], [0.9, 4.2], [1.6, 8.4]], 3 * k, behind ? sh(sleeve, -0.25) : sleeve);
    if (L.wraps || L.bracers) limb(c, [[1.1, 5.4], [1.6, 7.8]], 3.1 * k, L.wraps || L.bracers, false);
    if (L.scars && !behind) L_line(c, 0.2, 2, 1.4, 3.6, '#7a2a1b', 0.3);
    weapon(c, L, Pz);
    E(c, 1.6, 8.8, 1.45 * k, 1.45 * k, cel(c, 0.2, 7.4, 3, 10.2, L.gloves || L.skin), 0.25);
    c.restore();
  }

  // Weapons are drawn in the arm's frame: the hand is at (1.6, 8.8) and "down the arm" is +y.
  function weapon(c, L, Pz) {
    const w = L.weapon;
    if (w === 'sword' || w === 'greatsword') {
      const long = w === 'greatsword' ? 1.45 : 1, bl = L.blade || '#c8d0d8';
      const tip = 9 + 13 * long;
      if (L.bladeGlow) glow(c, 1.6, (9 + tip) / 2 + 2, 6 * long, L.bladeGlow, 0.35);
      P(c, `M 0.9 9.6 L 2.3 9.6 L 2.3 ${tip - 1.6} L 1.6 ${tip} L 0.9 ${tip - 1.6} Z`, cel(c, 0.8, 9, 2.4, tip, bl, 0.5, 0.25), 0.25);
      L_line(c, 1.35, 10.4, 1.35, tip - 2, 'rgba(255,255,255,0.75)', 0.25);
      P(c, 'M -0.9 9.1 L 4.1 9.1 L 4.1 10.2 L -0.9 10.2 Z', cel(c, -1, 9, 4, 10.3, GOLD), 0.2);
      E(c, 1.6, 7.6, 0.75, 0.75, GOLD, 0.15);
    } else if (w === 'dagger') {
      P(c, 'M 1 9.6 L 2.2 9.6 L 1.6 15.4 Z', cel(c, 1, 9.6, 2.2, 15.4, L.blade || '#c8d0d8'), 0.2);
      L_line(c, 0, 9.4, 3.2, 9.4, LEATHER, 0.7);
    } else if (w === 'cleaver') {
      L_line(c, 1.6, 7, 1.6, 12, '#4a2e1a', 1.2);
      P(c, 'M 0.6 11.5 L 5.6 11.5 L 6.2 19.5 L 0.6 20.5 Z', cel(c, 0.6, 11.5, 6.2, 20.5, '#9aa2aa', 0.5), 0.3);
      L_line(c, 5.6, 12, 6.1, 19.4, 'rgba(255,255,255,0.7)', 0.3);
      E(c, 2, 13, 0.4, 0.4, '#2a1a10');
    } else if (w === 'axe' || w === 'greataxe') {
      const big = w === 'greataxe';
      const end = big ? 24 : 21;
      L_line(c, 1.6, big ? 2 : 6, 1.6, end, OUT, 2.1);
      L_line(c, 1.6, big ? 2 : 6, 1.6, end, '#6a4a2a', 1.4);
      if (big) { for (const y of [12, 14.5, 17]) L_line(c, 0.9, y, 2.3, y + 0.6, '#c9a46a', 0.35); }
      const hx = 1.6, hy0 = end - (big ? 7 : 5);
      const s = big ? 1.5 : 1;
      P(c, `M ${hx} ${hy0} Q ${hx + 7 * s} ${hy0 - 1 * s} ${hx + 7.5 * s} ${hy0 + 4 * s} Q ${hx + 7.2 * s} ${hy0 + 8 * s} ${hx + 1} ${hy0 + 6 * s} Z`, cel(c, hx, hy0 - 1, hx + 7.5 * s, hy0 + 8 * s, '#aab2ba', 0.5, 0.28), 0.3);
      L_line(c, hx + 6.6 * s, hy0 + 0.8 * s, hx + 6.9 * s, hy0 + 6.4 * s, 'rgba(255,255,255,0.8)', 0.3);
      if (big) P(c, `M ${hx} ${hy0 + 1} L ${hx - 3} ${hy0 + 2} L ${hx} ${hy0 + 4} Z`, cel(c, hx - 3, hy0, hx, hy0 + 4, '#aab2ba'), 0.25);
    } else if (w === 'club') {
      L_line(c, 1.6, 8, 2.1, 17, OUT, 2.9); L_line(c, 1.6, 8, 2.1, 17, '#6b4a2a', 2.2);
      E(c, 2.2, 18.5, 2.9, 3.4, cel(c, -0.7, 15, 5.1, 22, '#7a5432'), 0.3);
      for (const [dx, dy] of [[-2.4, 17.5], [2.6, 18.5], [0.2, 21.6], [-1.6, 20.4]]) P(c, `M ${2.2 + dx * 0.8} ${dy} L ${2.2 + dx * 1.35} ${dy + 0.4} L ${2.2 + dx * 0.8} ${dy + 0.9} Z`, '#c8c8c8', 0.12);
    } else if (w === 'staff') {
      L_line(c, 1.6, -8, 1.6, 21, OUT, 1.9); L_line(c, 1.6, -8, 1.6, 21, '#6b4a2a', 1.3);
      L_line(c, 1.2, -6, 2, -4.5, '#c9a46a', 0.5);
      const g = L.orb || '#9fe8ff';
      glow(c, 1.6, -9.2, 5, g, 0.45);
      E(c, 1.6, -9.2, 2.1, 2.1, cel(c, -0.5, -11.3, 3.7, -7.1, g, 0.6, 0.2), 0.25);
      spec(c, 1, -9.8, 0.8);
      if (L.charms) { L_line(c, 2.2, -6.4, 3.4, -3.6, '#e8e0d0', 0.2); E(c, 3.4, -3.3, 0.6, 0.8, '#c96a3a', 0.12); L_line(c, 1, -6.4, -0.2, -4, '#e8e0d0', 0.2); E(c, -0.2, -3.7, 0.5, 0.5, '#e8d06a', 0.1); }
    } else if (w === 'bow') {
      c.strokeStyle = OUT; c.lineWidth = 1.5; c.beginPath(); c.moveTo(1.6 - 2, 9 - 9); c.quadraticCurveTo(1.6 + 4.6, 9, 1.6 - 2, 9 + 9); c.stroke();
      c.strokeStyle = '#8a5a34'; c.lineWidth = 0.95; c.stroke();
      c.strokeStyle = 'rgba(240,230,210,0.9)'; c.lineWidth = 0.28; c.beginPath(); c.moveTo(1.6 - 2, 0); c.lineTo(Pz.atk != null ? -2.5 : 1.6 - 2, 9); c.lineTo(1.6 - 2, 18); c.stroke();
      if (Pz.atk != null) { L_line(c, -2.5, 9, 6, 9, '#d9c49a', 0.35); P_tri(c, 6, 9); }
    }
    if (L.sideDagger) { /* Ysolde's dirk rides on her belt; nothing in hand */ }
  }
  function P_tri(c, x, y) { P(c, `M ${x} ${y - 0.6} L ${x + 1.4} ${y} L ${x} ${y + 0.6} Z`, '#d0d6da', 0.1); }

  function head(c, L, v, hy, fs, Pz) {
    const back = v >= 3, side = v === 2, front = v === 0;
    const skin = L.skin || '#e8c39e';
    const rx = 4.4 * (side ? 0.95 : 1), ry = 4.7;
    // neck
    P(c, `M -1.2 ${hy + 3} L 1.4 ${hy + 3} L 1.5 ${hy + 5.6} L -1.3 ${hy + 5.6} Z`, sh(skin, -0.2), 0.22);
    // long hair hangs behind the head
    if (L.hairStyle === 'long' && !L.hood) { if (back) P(c, `M -4 ${hy} L 4 ${hy} L 3.6 ${hy + 9} L -3.6 ${hy + 9} Z`, cel(c, -4, hy, 4, hy + 9, L.hair), 0.25); else P(c, `M ${-4.6} ${hy - 1} L ${side ? -1 : 4.6} ${hy - 1} L ${side ? -1.6 : 4.2} ${hy + 8} L ${-4.4} ${hy + 8} Z`, cel(c, -4.6, hy, 4.6, hy + 8, sh(L.hair, -0.15)), 0.25); }
    if (L.hairStyle === 'pony' && !back && !L.hood) P(c, `M ${-2.6 - fs * 0.3} ${hy - 2.4} Q ${-7} ${hy - 1.6} ${-6.2} ${hy + 4} Q ${-5.2} ${hy + 1} ${-2.4} ${hy + 0.4} Z`, cel(c, -7, hy - 3, -2, hy + 4, L.hair), 0.25);
    // skull and face
    const faceD = side
      ? `M ${-rx} ${hy} Q ${-rx} ${hy - ry} ${0} ${hy - ry} Q ${rx} ${hy - ry} ${rx} ${hy - 0.6} L ${rx + 0.7} ${hy + 0.6} L ${rx} ${hy + 1.1} Q ${rx - 0.1} ${hy + 3.2} ${rx - 1.6} ${hy + 3.9} Q ${-1} ${hy + 4.6} ${-rx + 0.6} ${hy + 2.4} Q ${-rx} ${hy + 1.2} ${-rx} ${hy} Z`
      : `M ${-rx} ${hy} Q ${-rx} ${hy - ry} 0 ${hy - ry} Q ${rx} ${hy - ry} ${rx} ${hy} Q ${rx} ${hy + ry * 0.85} 0 ${hy + ry} Q ${-rx} ${hy + ry * 0.85} ${-rx} ${hy} Z`;
    P(c, faceD, cel(c, -rx, hy - ry, rx, hy + ry, skin, 0.62, 0.22), 0.3);
    if (L.ghost) glow(c, 0, hy, 6, '#9fd8ff', 0.25);
    // ear
    if (!front && !back && !L.hood && !L.helm) E(c, side ? -0.6 : -2.4 + fs * 0.2, hy + 0.4, 0.8, 1.15, sh(skin, -0.15), 0.2);
    // face details
    if (!back) {
      const ec = L.eyes || '#2a1810', glowEyes = !!L.eyes;
      const eyes = front ? [[-1.6, 0], [1.6, 0]] : v === 1 ? [[0.5, 0], [2.8, 0]] : [[2.9, 0]];
      if (L.warpaint) for (const [ex] of eyes) P(c, `M ${ex - 0.55} ${hy - 3.4} L ${ex + 0.55} ${hy - 3.4} L ${ex + 0.4} ${hy + 1.6} L ${ex} ${hy + 2.6} L ${ex - 0.4} ${hy + 1.6} Z`, rgba(L.warpaint, 0.8), 0);
      if (!L.mask) for (const [ex] of eyes) { if (glowEyes) glow(c, ex, hy - 0.2, 1.5, ec, 0.7); E(c, ex, hy - 0.2, 0.48, 0.6, ec); if (!glowEyes) E(c, ex + 0.15, hy - 0.4, 0.15, 0.15, 'rgba(255,255,255,0.8)'); }
      if (!L.mask) {
        const brow = L.hair || '#3a2416';
        for (const [ex] of eyes) L_line(c, ex - 0.7, hy - 1.5, ex + 0.7, hy - 1.35, sh(brow, -0.1), 0.35);
        if (front) L_line(c, -0.7, hy + 2.2, 0.7, hy + 2.2, sh(skin, -0.35), 0.25);
        else L_line(c, fs + 0.2, hy + 2.2, fs + 1.2, hy + 2.1, sh(skin, -0.35), 0.25);
      }
      if (L.tusks) { const mx = front ? 0 : fs * 0.9; P(c, `M ${mx - 1.2} ${hy + 2.3} L ${mx - 0.9} ${hy + 0.8} L ${mx - 0.5} ${hy + 2.3} Z`, '#f0ead8', 0.12); P(c, `M ${mx + 0.6} ${hy + 2.3} L ${mx + 0.9} ${hy + 0.8} L ${mx + 1.3} ${hy + 2.3} Z`, '#f0ead8', 0.12); }
      if (L.mask) { P(c, `M ${-3.6 + fs * 0.4} ${hy - 2} L ${3.6 + fs * 0.4} ${hy - 2} L ${3 + fs * 0.4} ${hy + 3.4} L ${-3 + fs * 0.4} ${hy + 3.4} Z`, cel(c, -3.6, hy - 2, 3.6, hy + 3.4, L.mask), 0.25); for (const [ex] of eyes) { glow(c, ex + fs * 0.1, hy - 0.2, 1.6, L.eyes || '#ffb347', 0.8); L_line(c, ex - 0.7 + fs * 0.1, hy - 0.2, ex + 0.7 + fs * 0.1, hy - 0.2, L.eyes || '#ffb347', 0.4); } }
    }
    // beard
    if (L.beard && !back) {
      const bx = front ? 0 : fs * 0.55;
      const d = front ? `M -2.9 ${hy + 1.4} Q 0 ${hy + (L.braid ? 6 : 7.4)} 2.9 ${hy + 1.4} Q 0 ${hy + 3} -2.9 ${hy + 1.4} Z` : `M ${bx - 1.8} ${hy + 1.2} Q ${bx + 1.2} ${hy + 7} ${bx + 3.6} ${hy + 1.2} Q ${bx + 1} ${hy + 2.8} ${bx - 1.8} ${hy + 1.2} Z`;
      P(c, d, cel(c, -3, hy + 1, 3.6, hy + 7, L.beard), 0.22);
      if (L.braid) { L_line(c, bx + 0.4, hy + 4.6, bx + 0.6, hy + 8, L.beard, 0.9); E(c, bx + 0.6, hy + 8.3, 0.5, 0.45, GOLD, 0.1); }
    }
    // hair on top
    if (!L.hood && !L.helm && L.hair && L.hairStyle !== 'bald' && L.hairStyle !== 'topknot') {
      if (back) P(c, `M ${-rx - 0.3} ${hy + 0.6} Q ${-rx - 0.4} ${hy - ry - 0.6} 0 ${hy - ry - 0.5} Q ${rx + 0.4} ${hy - ry - 0.6} ${rx + 0.3} ${hy + 0.6} Q 0 ${hy + 2.6} ${-rx - 0.3} ${hy + 0.6} Z`, cel(c, -rx, hy - ry, rx, hy + 2, L.hair, 0.5), 0.25);
      else P(c, `M ${-rx - 0.3} ${hy + 0.8} Q ${-rx - 0.6} ${hy - ry - 0.8} ${fs * 0.2} ${hy - ry - 0.5} Q ${rx + 0.5} ${hy - ry - 0.3} ${rx + 0.3} ${hy - 1} Q ${fs * 0.4 + 0.5} ${hy - 2.6} ${-rx * 0.2 + fs * 0.3} ${hy - 2.2} Q ${-rx * 0.5} ${hy - 1} ${-rx * 0.65 + (side ? -0.4 : 0)} ${hy + 1.8} Z`, cel(c, -rx, hy - ry, rx, hy + 1, L.hair, 0.5), 0.25);
    }
    if (L.hairStyle === 'topknot') { P(c, `M -0.7 ${hy - ry + 0.3} Q -1 ${hy - ry - 2.6} 0.4 ${hy - ry - 3} Q 1.4 ${hy - ry - 2.2} 0.8 ${hy - ry + 0.3} Z`, cel(c, -1, hy - ry - 3, 1.4, hy - ry, L.hair), 0.2); E(c, 0.1, hy - ry - 0.2, 0.9, 0.35, GOLD, 0.1); }
    if (L.scars && !back) L_line(c, -2.6 + fs * 0.2, hy - 2.6, -0.8 + fs * 0.2, hy + 0.6, '#e8b8a0', 0.3);
    // headwear
    if (L.hood) {
      const hc = L.hood;
      P(c, `M -5.7 ${hy + 5} Q -6.3 ${hy - 5.4} ${-fs * 0.2} ${hy - 6.2} Q 6.3 ${hy - 5.4} 5.7 ${hy + 5} Q 0 ${hy + 6.4} -5.7 ${hy + 5} Z`, cel(c, -6.3, hy - 6.2, 6.3, hy + 6, hc, 0.55), 0.3);
      if (!back) {
        const ow = 3.3 * (side ? 0.6 : v === 1 ? 0.85 : 1), ox = fs * 0.55;
        // the face looks out of the hood, shadowed at the top
        c.save(); c.beginPath(); c.ellipse(ox, hy + 0.7, ow, 3.7, 0, 0, TAU); c.clip();
        P(c, faceD, cel(c, -rx, hy - ry, rx, hy + ry, skin, 0.62, 0.22), 0);
        const ec = L.eyes || '#2a1810';
        const eyes = front ? [-1.6, 1.6] : v === 1 ? [0.5, 2.8] : [2.9];
        for (const ex of eyes) { if (L.eyes) glow(c, ex, hy - 0.1, 1.4, ec, 0.8); E(c, ex, hy - 0.1, 0.48, 0.58, ec); }
        if (L.mask) P(c, `M -4 ${hy + 0.6} L 5 ${hy + 0.6} L 5 ${hy + 5} L -4 ${hy + 5} Z`, L.mask, 0);
        const sg = c.createLinearGradient(0, hy - 3, 0, hy + 1); sg.addColorStop(0, 'rgba(0,0,0,0.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = sg; c.fillRect(ox - 4, hy - 3.2, 8, 4.4);
        c.restore();
        c.strokeStyle = sh(hc, -0.35); c.lineWidth = 0.5; c.beginPath(); c.ellipse(ox, hy + 0.7, ow, 3.7, 0, 0, TAU); c.stroke();
      } else L_line(c, 0, hy - 5.6, 0, hy + 4.2, sh(hc, -0.3), 0.4);
    }
    if (L.hat) {
      const col = L.hat;
      E(c, 0.3, hy - 3.6, 7, 1.9, cel(c, -6.7, hy - 5.5, 7.3, hy - 1.7, col, 0.5), 0.28);
      P(c, `M -3.2 ${hy - 3.6} Q -3.6 ${hy - 8.6} 0.4 ${hy - 8.4} Q 3.6 ${hy - 8.2} 3.2 ${hy - 3.6} Z`, cel(c, -3.6, hy - 8.6, 3.6, hy - 3.6, sh(col, -0.05), 0.55), 0.28);
      L_line(c, -3.1, hy - 4.6, 3.1, hy - 4.6, sh(col, -0.35), 0.5);
    }
    if (L.cap) P(c, `M ${-rx - 0.2} ${hy - 0.6} Q ${-rx} ${hy - ry - 0.8} 0 ${hy - ry - 0.8} Q ${rx} ${hy - ry - 0.8} ${rx + 0.2} ${hy - 0.6} ${back ? '' : `L ${rx + 1.8 + fs * 0.3} ${hy - 0.2}`} Z`, cel(c, -rx, hy - ry - 1, rx + 2, hy, L.cap, 0.55), 0.25);
    if (L.bandana) {
      P(c, `M ${-rx - 0.2} ${hy - 1} Q 0 ${hy - 2.4} ${rx + 0.2} ${hy - 1} L ${rx + 0.1} ${hy - 2.7} Q 0 ${hy - 4.3} ${-rx - 0.1} ${hy - 2.7} Z`, cel(c, -rx, hy - 4.3, rx, hy - 1, L.bandana, 0.5), 0.22);
      if (!front) P(c, `M ${-rx + 0.2} ${hy - 2} L ${-rx - 2.6} ${hy - 0.4} L ${-rx - 2.2} ${hy + 0.8} Z`, L.bandana, 0.2);
    }
    if (L.helm) {
      const col = L.helm;
      P(c, `M ${-rx - 0.6} ${hy + 0.8} Q ${-rx - 0.8} ${hy - ry - 1.4} 0 ${hy - ry - 1.4} Q ${rx + 0.8} ${hy - ry - 1.4} ${rx + 0.6} ${hy + 0.8} Z`, cel(c, -rx, hy - ry - 1.4, rx, hy + 1, col, 0.5, 0.32), 0.3);
      L_line(c, -rx - 0.4, hy - 0.2, rx + 0.4, hy - 0.2, sh(col, -0.35), 0.5);
      if (front) P(c, `M -0.5 ${hy - 0.4} L 0.5 ${hy - 0.4} L 0.4 ${hy + 2.4} L -0.4 ${hy + 2.4} Z`, sh(col, -0.1), 0.2);
      if (!back && L.eyes) for (const ex of front ? [-1.6, 1.6] : v === 1 ? [0.5, 2.8] : [2.9]) { glow(c, ex, hy + 0.6, 1.4, L.eyes, 0.8); E(c, ex, hy + 0.6, 0.5, 0.3, L.eyes); }
      spec(c, -rx * 0.4, hy - ry * 0.7, 1.2, 0.7);
      if (L.plume) P(c, `M -0.5 ${hy - ry - 1.2} Q -4 ${hy - ry - 4} -6.5 ${hy - ry - 1.5} Q -3 ${hy - ry - 2} 0.6 ${hy - ry - 0.9} Z`, cel(c, -6.5, hy - ry - 4, 0.6, hy - ry, L.plume), 0.2);
    }
    if (L.crown) {
      let d = `M -4 ${hy - 3.6}`;
      for (let i = 0; i <= 4; i++) d += ` L ${-4 + i * 2} ${hy - (i % 2 ? 6.2 : 8.6)}`;
      d += ` L 4 ${hy - 3.6} Z`;
      if (L.ghost) glow(c, 0, hy - 6, 6, L.crown, 0.4);
      P(c, d, cel(c, -4, hy - 8.6, 4, hy - 3.6, L.crown, 0.5), 0.25);
      E(c, 0, hy - 4.7, 0.6, 0.6, '#ffffff');
    }
    if (L.circlet && !L.helm && !L.crown) { L_line(c, -rx, hy - 2.4, rx, hy - 2.4, L.circlet, 0.55); if (!back) { if (L.crownGlow) glow(c, fs * 0.4, hy - 2.6, 2, L.circlet, 0.7); E(c, fs * 0.4, hy - 2.6, 0.55, 0.55, L.crownGlow ? '#ffffff' : '#e74c3c'); } }
  }

  /* ======================= BEASTS AND MONSTERS =======================
     Drawn side-on, facing screen right (mirrored when heading left). */

  // A jointed leg from hip to paw. a: swing angle, bend: how the lower leg folds.
  function beastLeg(c, hx, hy, len, a, bend, up, w, col, paw) {
    const kx = hx + Math.sin(a) * len, ky = hy + Math.cos(a) * len - up * 0.4;
    const px = kx + Math.sin(a + bend) * len, py = Math.min(-0.2, ky + Math.cos(a + bend) * len - up);
    limb(c, [[hx, hy], [kx, ky], [px, py]], w, col);
    if (paw) E(c, px + 0.5, py + 0.3, w * 0.62, w * 0.42, sh(col, -0.25), 0.2);
  }
  const gait = (Pz, o) => (Pz.walk != null ? Math.sin(Pz.walk + o) * 0.55 : 0);
  const lift = (Pz, o) => (Pz.walk != null ? Math.max(0, Math.cos(Pz.walk + o)) * 1.4 : 0);

  function wolf(c, L, Pz) {
    const fur = L.color, light = sh(fur, 0.42), dark = sh(fur, -0.35);
    const grey = L.id === 'greymane', ember = L.id === 'ember_hound';
    const atk = Pz.atk != null ? Math.sin(Pz.atk * Math.PI) : 0;
    const bob = Pz.walk != null ? Math.abs(Math.cos(Pz.walk)) * 0.8 : 0;
    // far legs
    beastLeg(c, 6, -8, 4.2, gait(Pz, Math.PI) - atk * 0.6, -0.25, lift(Pz, Math.PI), 1.7, sh(fur, -0.45), true);
    beastLeg(c, -7, -8.4, 4.4, gait(Pz, 0), 0.5, lift(Pz, 0), 1.9, sh(fur, -0.45), true);
    c.save(); c.translate(atk * 1.6, -bob);
    // tail (wags when idle)
    const wag = Pz.walk != null ? -Math.sin(Pz.walk) * 0.8 : Math.sin((Pz.t || 0) * 4) * 0.8;
    P(c, `M -8.6 -10 Q -12 ${-10.8 + wag} -14.6 ${-7.2 + wag} Q -15.8 ${-5.4 + wag} -14.6 ${-4.4 + wag} Q -13.4 ${-6.8 + wag} -11.2 -7.2 Q -9.6 -7.4 -8.4 -8 Z`, cel(c, -15.8, -11, -8.4, -4.4, fur, 0.5));
    P(c, `M -14.6 ${-7.2 + wag} Q -15.8 ${-5.4 + wag} -14.6 ${-4.4 + wag} Q -14.2 ${-6 + wag} -13.6 ${-6.6 + wag} Z`, ember ? '#ffcf6a' : light, 0);
    if (ember) glow(c, -14.8, -5.6 + wag, 2.6, '#ff8a2a', 0.8);
    // body
    P(c, 'M -9.2 -10.4 Q -6 -13.8 1 -13.1 Q 6 -13.6 8.2 -11.2 Q 9.4 -8 7.4 -5.8 Q 2 -4.8 -3 -5.3 Q -8 -5.2 -9.8 -7.6 Z', cel(c, -9.8, -13.8, 9.4, -4.8, fur, 0.56));
    P(c, 'M -6 -6.6 Q -1 -5.2 4.4 -6 Q 2 -5 -1.4 -5 Q -4.6 -5 -6 -6.6 Z', light, 0);
    P(c, 'M -7.6 -11.2 Q -3 -13.8 3 -13.2 Q -1 -12 -6.6 -10.2 Z', dark, 0);
    LP(c, 'M -4 -11.6 l 1 1.2 M -1.4 -12.2 l 1 1.2 M 1.4 -12.4 l 0.9 1.2 M -5.6 -8.4 l 1 0.9', dark, 0.25);
    if (ember) LP(c, 'M -6 -10 l 2 1.6 l 1.4 -1 M 0 -11.4 l 1.6 1.6 l 2 -0.6 M -3 -7 l 2 0.6', '#ff9a3a', 0.35);
    // chest ruff, or Greymane's great mane
    if (grey) P(c, 'M 3.4 -14.6 L 4.6 -16.6 L 5.8 -14.8 L 7.4 -17 L 8.4 -14.6 L 10.4 -15.8 L 10.6 -13 L 12.4 -12.6 L 11 -10.6 L 12 -8.6 L 10 -8.2 L 10.4 -6 L 8 -6.4 Q 5 -8 3.4 -11 Z', cel(c, 3.4, -17, 12.4, -6, '#e4e8ec', 0.6, 0.2));
    else P(c, 'M 6.4 -12.6 L 7.4 -11.4 L 8.6 -11.8 L 8.6 -10.2 L 9.8 -9.8 L 8.8 -8.6 L 9.4 -7.4 L 8 -7.2 L 7.8 -5.8 Q 6 -7 5.6 -9.6 Z', cel(c, 5.6, -12.6, 9.8, -5.8, light, 0.6, 0.18));
    if (L.scar) LP(c, 'M -2 -12.6 L 0.6 -9.4', '#c04a3a', 0.35);
    c.restore();
    // near legs
    beastLeg(c, 6.8, -8, 4.2, gait(Pz, 0) - atk * 0.8, -0.25, lift(Pz, 0), 1.9, fur, true);
    beastLeg(c, -7.6, -8.6, 4.4, gait(Pz, Math.PI), 0.5, lift(Pz, Math.PI), 2.1, fur, true);
    // head (lowers and opens its jaw to bite)
    c.save(); c.translate(atk * 2.2, -bob + atk * 1.2); c.translate(9, -12); c.rotate(atk * 0.25); c.translate(-9, 12);
    P(c, 'M 9.8 -16.4 L 10.6 -19.2 L 11.8 -16 Z', cel(c, 9.8, -19.2, 11.8, -16, dark), 0.25);
    P(c, `M 7.4 -14.6 Q 9.4 -16.8 11.8 -15.6 L 15.8 -13.8 Q 16.6 -12.8 15.6 -12.2 L 12.4 ${-11.2 + atk * 0.4} Q 9.4 -10.2 7.6 -11.6 Z`, cel(c, 7.4, -16.8, 16.6, -10.4, fur, 0.6));
    if (atk > 0.2) { P(c, `M 10.6 -11.4 L 15.4 -12 L 14.8 ${-10.6 + atk * 1.6} L 11 ${-10.2 + atk * 0.8} Z`, '#5a1a1a', 0.2); LP(c, `M 12 -11.6 l 0.2 0.6 M 13.4 -11.8 l 0.2 0.6 M 14.6 -11.9 l 0.2 0.6`, '#f0ece0', 0.25); }
    else P(c, 'M 10.6 -11 Q 13 -11.6 15.4 -12 L 12.4 -10.8 Q 11.4 -10.5 10.6 -11 Z', light, 0);
    P(c, 'M 8.6 -16 L 8.8 -19 L 10.4 -16 Z', cel(c, 8.6, -19, 10.4, -16, fur), 0.25);
    E(c, 15.8, -13.1, 0.7, 0.55, '#141010');
    const eye = grey ? '#bfe8ff' : ember ? '#ffcf6a' : '#ffd54a';
    if (grey || ember) glow(c, 11.9, -14.5, 1.8, eye, 0.8);
    E(c, 11.9, -14.5, 0.7, 0.45, eye); E(c, 12.1, -14.5, 0.22, 0.32, '#141010');
    if (L.scar || grey) LP(c, 'M 10.6 -16 L 12.8 -13.4', '#c04a3a', 0.3);
    LP(c, 'M 9.2 -13.8 l 1.2 0.6 M 8.6 -12.6 l 1.2 0.5', dark, 0.22);
    c.restore();
  }

  function boar(c, L, Pz) {
    const fur = L.color, dark = sh(fur, -0.38), light = sh(fur, 0.3);
    const atk = Pz.atk != null ? Math.sin(Pz.atk * Math.PI) : 0;
    const bob = Pz.walk != null ? Math.abs(Math.cos(Pz.walk)) * 0.7 : 0;
    beastLeg(c, 5, -6, 3.2, gait(Pz, Math.PI), -0.15, lift(Pz, Math.PI), 1.9, sh(fur, -0.45), true);
    beastLeg(c, -6, -6.4, 3.2, gait(Pz, 0), 0.35, lift(Pz, 0), 2.1, sh(fur, -0.45), true);
    c.save(); c.translate(atk * 2, -bob);
    P(c, `M -11 -9 Q -11 -15 -2 -15.6 Q 7 -16 10 -11.6 Q 11.4 -7 8 -5 Q 0 -3.6 -7 -4.6 Q -11 -5.6 -11 -9 Z`, cel(c, -11, -16, 11.4, -3.6, fur, 0.56));
    P(c, 'M -7 -5.6 Q 0 -4.2 6 -5.4 Q 2 -4.4 -2 -4.4 Q -5 -4.4 -7 -5.6 Z', light, 0);
    // bristly ridge along the back
    let d = 'M -9 -13.4';
    for (let i = 0; i < 9; i++) d += ` L ${-8 + i * 2} ${-16.6 - (i % 2) * 1.2} L ${-7 + i * 2} -14.8`;
    d += ' L 8 -13 Q 0 -15 -9 -13.4 Z';
    P(c, d, cel(c, -9, -18, 9, -13, dark), 0.25);
    LP(c, 'M -10.6 -8 l -1.4 -1.6 M -10.4 -7 l -1.8 -0.4', dark, 0.4);
    if (L.scar) LP(c, 'M -1 -13.4 L 2 -9.6', '#d8a08a', 0.35);
    c.restore();
    beastLeg(c, 5.8, -6, 3.2, gait(Pz, 0), -0.15, lift(Pz, 0), 2.1, fur, true);
    beastLeg(c, -6.8, -6.4, 3.2, gait(Pz, Math.PI), 0.35, lift(Pz, Math.PI), 2.3, fur, true);
    // head, lowered to charge when attacking
    c.save(); c.translate(atk * 3, -bob + atk * 1.5);
    P(c, 'M 7.4 -13.4 Q 11 -14.6 13 -11.6 L 15.6 -9.6 Q 16.4 -7.8 15 -7 L 11 -6 Q 7.4 -6.4 6.8 -9 Z', cel(c, 6.8, -14.6, 16.4, -6, sh(fur, -0.05), 0.6));
    E(c, 15.6, -8.4, 1.3, 1.5, cel(c, 14.3, -10, 17, -7, '#c99a8a'), 0.22);
    E(c, 15.9, -8.6, 0.25, 0.35, '#3a1a1a'); E(c, 15.3, -8.2, 0.25, 0.35, '#3a1a1a');
    const tusk = L.scar ? 'M 13.6 -6.6 Q 15.4 -7.4 15.4 -9' : 'M 13.6 -6.6 Q 16.4 -7 16.6 -10.6';
    LP(c, tusk, OUT, 1.3); LP(c, tusk, '#efe6d2', 0.8);
    P(c, 'M 8.6 -13.2 L 8.4 -15.8 L 10.4 -13.6 Z', cel(c, 8.4, -15.8, 10.4, -13.2, dark), 0.22);
    E(c, 11.4, -11.4, 0.55, 0.55, '#1a0f08'); E(c, 11.55, -11.55, 0.15, 0.15, '#fff');
    c.restore();
  }

  function spider(c, L, Pz) {
    const col = L.color, acc = L.accent, brood = L.id === 'brood_mother', deep = L.id === 'deep_crawler';
    const t = Pz.t || 0, mv = Pz.walk != null ? 1 : 0.25, ph = Pz.walk != null ? Pz.walk * 1.6 : t * 3;
    const atk = Pz.atk != null ? Math.sin(Pz.atk * Math.PI) : 0;
    const leg = (i, near) => {
      const bx = -1.6 + i * 1.7, by = -8, o = i * 1.7 + (near ? 0 : Math.PI);
      const sw = Math.sin(ph + o) * 1.6 * mv, up = Math.max(0, Math.cos(ph + o)) * 1.2 * mv;
      const dir = i < 2 ? 1 : -1, reach = near ? 1 : 0.85;
      const spread = [-1.25, -0.55, 0.55, 1.25][i], fo = near ? 0 : 1.6;
      const kx = bx + spread * 4.6 * reach + sw + fo, ky = by - (near ? 7.6 : 8.4) - up;
      const fx = bx + spread * 8.4 * reach + sw * 1.4 + fo + (i === 3 && atk ? atk * 2 : 0), fy = (near ? -0.2 : -2.2) - up * 0.5;
      limb(c, [[bx, by], [kx, ky], [fx, fy]], near ? 1.2 : 1.0, near ? sh(col, -0.15) : sh(col, -0.45));
      if (brood && near) P(c, `M ${kx - 0.4} ${ky} L ${kx} ${ky - 1.6} L ${kx + 0.4} ${ky} Z`, '#d0d8c0', 0.1);
      return dir;
    };
    for (let i = 0; i < 4; i++) leg(i, false);
    // abdomen
    const ax = -6.5, ay = -9.5, arx = brood ? 9.5 : 7.6, ary = brood ? 7.6 : 6.2;
    E(c, ax, ay, arx, ary, cel(c, ax - arx, ay - ary, ax + arx, ay + ary, col, 0.55), 0.35);
    if (deep) for (let i = 0; i < 3; i++) LP(c, `M ${ax - 5 + i * 3} ${ay - ary + 1} Q ${ax - 4 + i * 3} ${ay} ${ax - 5 + i * 3} ${ay + ary - 1}`, sh(col, 0.25), 0.4);
    else P(c, `M ${ax} ${ay - ary + 1.2} L ${ax + 2} ${ay} L ${ax} ${ay + ary - 1.6} L ${ax - 2} ${ay} Z`, rgba(acc, 0.75), 0.2);
    if (brood) {
      // egg sacs clustered on her back, glowing faintly
      for (const [ex, ey, er] of [[-10, -15.6, 2.2], [-6.4, -16.8, 2.6], [-2.8, -15.4, 2], [-8.4, -13.2, 1.8]]) { glow(c, ex, ey, er + 1.8, acc, 0.45); E(c, ex, ey, er, er * 0.85, cel(c, ex - er, ey - er, ex + er, ey + er, '#c8d8a8', 0.6, 0.2), 0.2); }
      for (let i = 0; i < 5; i++) P(c, `M ${ax - 6 + i * 3} ${ay + ary - 2} L ${ax - 5.4 + i * 3} ${ay + ary + 0.6} L ${ax - 4.8 + i * 3} ${ay + ary - 2} Z`, '#c8d0b8', 0.12);
    }
    spec(c, ax - arx * 0.45, ay - ary * 0.45, 2, 0.4);
    // head and thorax
    E(c, 3.2, -8.6, 4.6, 3.9, cel(c, -1.4, -12.5, 7.8, -4.7, sh(col, -0.1), 0.55), 0.32);
    const fang = 1 + atk * 0.8;
    P(c, `M 6.6 -6.6 Q 8.2 ${-5 + fang * 0.6} 7 ${-3.6 + fang}`, 'rgba(0,0,0,0)', 0); LP(c, `M 6.6 -6.6 Q 8.4 -5.2 7.2 ${-3.4 + fang}`, '#e8e0d0', 0.55); LP(c, `M 5.6 -6.4 Q 6.8 -4.8 5.8 ${-3.2 + fang}`, '#d0c8b8', 0.5);
    const eyeC = deep || brood ? acc : '#ff3b3b';
    for (const [x, y, r] of [[5.6, -10.2, 0.7], [6.9, -9.8, 0.62], [5.9, -8.8, 0.5], [7.3, -8.6, 0.45]]) { glow(c, x, y, r * 2.2, eyeC, 0.5); E(c, x, y, r, r, eyeC); }
    for (let i = 0; i < 4; i++) leg(i, true);
  }

  function blob(c, L, Pz) {
    const t = Pz.t || 0, col = L.color, acc = L.accent, mother = L.id === 'bogmother';
    const atk = Pz.atk != null ? Math.sin(Pz.atk * Math.PI) : 0;
    const sq = 1 + Math.sin(t * 3) * 0.04 - atk * 0.12, st = 1 - Math.sin(t * 3) * 0.03 + atk * 0.15;
    let d = '';
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * TAU, rr = 1 + Math.sin(a * 3 + t * 3) * 0.06 + Math.sin(a * 5 - t * 2) * 0.04;
      const x = Math.cos(a) * 10 * rr * st + atk * 1.5, y = -9.4 + Math.sin(a) * 9 * rr * sq * (a > Math.PI ? 1.1 : 0.88);
      d += (i ? ' L ' : 'M ') + x.toFixed(2) + ' ' + Math.min(0, y).toFixed(2);
    }
    d += ' Z';
    const body = P(c, d, cel(c, -10, -20, 10, 0, col, 0.55, 0.3), 0.38);
    c.save(); c.clip(body);
    // things floating inside
    c.globalAlpha = 0.45;
    if (mother) { E(c, -2, -8, 2.6, 2.2, '#e8e0cc'); E(c, -2.9, -8.4, 0.6, 0.7, '#2a2a1a'); E(c, -1.1, -8.4, 0.6, 0.7, '#2a2a1a'); }
    LP(c, 'M -6 -5 l 3 -1 M 4 -4 l 2 1.5 l 1 -1', '#e8e0cc', 0.5);
    E(c, 3, -14, 1.2, 0.6, '#8aa840', 0, 0.6);
    c.globalAlpha = 1;
    // moss on top
    const mg = c.createLinearGradient(0, -19, 0, -12); mg.addColorStop(0, rgba(acc, 0.65)); mg.addColorStop(1, rgba(acc, 0)); c.fillStyle = mg; c.fillRect(-11, -20, 22, 8);
    c.restore();
    spec(c, -4, -14, 2.4, 0.45);
    // drips
    for (const [x, len] of [[-7, 2.4], [5, 3], [8, 1.8]]) { const l = len * (0.6 + 0.4 * Math.sin(t * 2 + x)); E(c, x + atk * 1.5, -0.2 + l * 0.5, 0.7, l * 0.6, sh(col, -0.15)); }
    // eyes
    const eyes = mother ? [[1.6, -12.4, 1.5], [5, -11.6, 1.3], [3.2, -15.4, 1], [7, -14.6, 0.9]] : [[3, -11.4, 1.6], [6.5, -10.8, 1.35]];
    for (const [x, y, r] of eyes) { E(c, x + atk * 1.5, y, r, r * 1.12, '#f8f3c0', 0.2); E(c, x + 0.35 + atk * 1.5, y, r * 0.45, r * 0.6, '#111'); }
    if (atk > 0.3) P(c, `M ${3 + atk * 1.5} -7 Q ${6 + atk * 1.5} ${-4.8 - atk} ${9 + atk * 1.5} -7 Z`, '#3a1a10', 0.2);
    if (mother) { for (let i = 0; i < 7; i++) { const x = -6 + i * 2.1; LP(c, `M ${x} -18 Q ${x - 0.6} -22 ${x + 0.4} ${-24 - (i % 2) * 2}`, '#7a8a3a', 0.7); } E(c, 0.6, -22.6, 1.2, 0.8, '#d6c84a', 0.15); }
  }

  function stalker(c, L, Pz) {
    const col = L.color, acc = L.accent;
    const ph = Pz.walk || 0, mv = Pz.walk != null;
    const atk = Pz.atk != null ? Math.sin(Pz.atk * Math.PI) : 0;
    const lg = mv ? Math.sin(ph) * 2.6 : 0;
    limb(c, [[-3.4, -11], [-4.6 + lg * 0.5, -5.6], [-4 + lg, -0.6]], 1.9, sh(col, -0.4));
    limb(c, [[1.6, -11], [0.6 - lg * 0.5, -5.6], [1.6 - lg, -0.6]], 2.0, sh(col, -0.15));
    c.save(); c.translate(0, -12); c.rotate(0.32 + atk * 0.12);
    P(c, 'M -5 0 Q -6.6 -10 -2 -15.6 Q 3 -17 5 -11 Q 5.8 -4 3.6 0.6 Q -1 2 -5 0 Z', cel(c, -6.6, -17, 5.8, 2, col, 0.55));
    for (let i = 0; i < 5; i++) LP(c, `M ${-4 + i * 1.8} ${-3 - (i % 2) * 2} l 0.6 -3`, sh(col, -0.3), 0.3);
    LP(c, 'M -2 -14 Q -1 -10 -3 -6 M 2 -15 Q 3 -10 1.6 -5', rgba(acc, 0.5), 0.35);
    c.restore();
    // long claw arm
    const sw = atk * 5;
    limb(c, [[6, -22], [10 + sw * 0.5, -16 + sw * 0.2], [9 + sw, -6 + sw * 0.4]], 2.0, col);
    for (const dx of [-1, 0, 1]) LP(c, `M ${9 + sw + dx * 0.6} ${-6 + sw * 0.4} l ${0.8 + dx * 0.5} 2.4`, '#e8e0d0', 0.4);
    // head with reed antlers
    P(c, 'M 4.6 -26 Q 6 -29 9.6 -27.6 Q 12.4 -26.4 11.4 -23.6 Q 9.2 -21.2 5.8 -22.6 Q 4 -23.8 4.6 -26 Z', cel(c, 4, -29, 12.4, -21.2, sh(col, -0.08), 0.6));
    LP(c, 'M 6 -28 L 4.6 -32 M 7.6 -28.4 L 8.4 -32.6 M 5.2 -30.4 L 3.4 -31', sh(col, -0.25), 0.5);
    glow(c, 9.8, -25.4, 2, acc, 0.8); E(c, 9.8, -25.4, 0.85, 0.75, acc);
  }

  function wisp(c, L, Pz) {
    const t = Pz.t || 0, col = L.color, acc = L.accent, y = -17 + Math.sin(t * 3) * 1.6;
    const atk = Pz.atk != null ? Math.sin(Pz.atk * Math.PI) : 0;
    glow(c, 0, y, 13 + atk * 3, col, 0.55);
    // a flame-like tail trailing behind and down
    P(c, `M -3.2 ${y} Q -6 ${y + 6} ${-3 + Math.sin(t * 4) * 1.6} ${y + 12} Q -0.5 ${y + 7} 0.6 ${y + 3} Q 2.2 ${y + 5} ${2.4 + Math.sin(t * 5) * 1} ${y + 9} Q 4.8 ${y + 4} 3.2 ${y} Z`, rgba(col, 0.75), 0);
    E(c, 0, y, 4.2 + atk, 4.2 + atk, cel(c, -4, y - 4, 4, y + 4, sh(col, 0.4), 0.6, 0.2));
    E(c, 0, y, 2.2, 2.2, '#ffffff');
    for (let i = 0; i < 3; i++) { const a = t * 2 + i * 2.1; E(c, Math.cos(a) * 7, y + Math.sin(a) * 3 + 2, 0.9, 0.9, rgba(acc, 0.85)); }
    E(c, 1.4, y - 0.4, 0.5, 0.75, '#1a1a2a'); E(c, -1.2, y - 0.4, 0.5, 0.75, '#1a1a2a');
  }

  function imp(c, L, Pz) {
    const col = L.color, acc = L.accent, t = Pz.t || 0;
    const ph = Pz.walk || 0, mv = Pz.walk != null, lg = mv ? Math.sin(ph) * 2 : 0;
    const atk = Pz.atk != null ? Math.sin(Pz.atk * Math.PI) : 0;
    limb(c, [[-1.8, -6.4], [-2.6 + lg * 0.5, -3.4], [-2.2 + lg, -0.6]], 1.8, sh(col, -0.3));
    limb(c, [[1.8, -6.4], [2.4 - lg * 0.5, -3.4], [2.2 - lg, -0.6]], 1.8, col);
    // charred body with glowing cracks
    P(c, 'M -5 -10 Q -5.4 -16.2 0 -16.4 Q 5.4 -16.2 5 -10 Q 4.6 -5 0 -5 Q -4.6 -5 -5 -10 Z', cel(c, -5.4, -16.4, 5.4, -5, col, 0.55, 0.35));
    LP(c, 'M -2 -14 L 0 -10.4 L -1 -6.6 M 2 -13.4 L 3 -9.4 M 0 -10.4 L 2.4 -8.6', acc, 0.55);
    glow(c, 0, -10.5, 4, acc, 0.35);
    // claws
    limb(c, [[4.4, -12.6], [6.6 + atk * 2.4, -10 - atk * 2], [7.4 + atk * 3, -7.6 - atk]], 1.4, col);
    LP(c, `M ${7.4 + atk * 3} ${-7.6 - atk} l 1 0.8 M ${7.4 + atk * 3} ${-7.6 - atk} l 0.2 1.2`, acc, 0.3);
    // head, horns and a little flame on top
    E(c, 1, -18.6, 3.8, 3.4, cel(c, -2.8, -22, 4.8, -15.2, sh(col, 0.08), 0.6), 0.3);
    P(c, 'M -1.6 -20.6 L -4 -25 L -0.2 -21.6 Z M 3 -21 L 5 -25.4 L 1.6 -21.6 Z', '#1a1210', 0.15);
    const fh = 3 + Math.sin(t * 9) * 0.8;
    P(c, `M -0.6 -21.8 Q -1.6 ${-23 - fh * 0.5} 0.8 ${-22 - fh - 1.4} Q 2.6 ${-23 - fh * 0.5} 1.8 -21.8 Z`, '#ff8a2a', 0); P(c, `M 0 -21.8 Q -0.4 ${-23 - fh * 0.3} 0.8 ${-22.4 - fh * 0.7} Q 1.6 ${-23 - fh * 0.3} 1.2 -21.8 Z`, '#ffe08a', 0);
    glow(c, 2.5, -18.8, 1.8, acc, 0.9); E(c, 2.5, -18.8, 0.85, 0.7, '#ffd08a');
  }

  function golem(c, L, Pz) {
    const col = L.color, acc = L.accent, warden = L.id === 'cinder_warden', sentinel = L.id === 'stone_sentinel';
    const ph = Pz.walk || 0, mv = Pz.walk != null, lg = mv ? Math.sin(ph) * 1.8 : 0;
    const atk = Pz.atk != null ? Pz.atk : null;
    const up = atk != null ? (atk < 0.45 ? atk / 0.45 : Math.max(0, 1 - (atk - 0.45) / 0.2)) : 0; // raise, then slam
    const slam = atk != null && atk > 0.45 ? Math.min(1, (atk - 0.45) / 0.2) : 0;
    const dk = sh(col, -0.3);
    const block = (d, x0, y0, x1, y1, base) => { P(c, d, cel(c, x0, y0, x1, y1, base, 0.52, 0.32), 0.35); };
    block(`M ${-6 + lg * 0.5} -9 L ${-1.6 + lg * 0.5} -9 L ${-1.4 + lg * 0.6} 0 L ${-6.4 + lg * 0.6} 0 Z`, -6.4, -9, -1.4, 0, dk);
    block(`M ${1.4 - lg * 0.5} -9 L ${6 - lg * 0.5} -9 L ${6.4 - lg * 0.6} 0 L ${1.4 - lg * 0.6} 0 Z`, 1.4, -9, 6.4, 0, sh(col, -0.15));
    // the far arm
    block(`M -14 ${-23 + up * 3} L -9 ${-23 + up * 3} L -9 ${-9 + up * 3} L -14.6 ${-10 + up * 3} Z`, -14.6, -23, -9, -9, dk);
    // body: stacked boulders
    block('M -9.4 -24.6 Q -10 -16 -8 -8.6 L 8 -8.6 Q 10 -16 9.4 -24.6 Q 0 -27 -9.4 -24.6 Z', -10, -27, 10, -8.6, col);
    LP(c, 'M -9 -17 Q 0 -15 9 -17.6', sh(col, -0.35), 0.4);
    // glowing cracks and core
    const hot = warden || !sentinel;
    LP(c, 'M -7 -21 L -3 -16 L -6 -11 M 6 -22 L 3 -15 L 5 -10 M -3 -16 L 0 -13', acc, warden ? 0.8 : 0.55);
    glow(c, 0, -16, warden ? 7 : 5.5, acc, hot ? 0.55 : 0.4);
    E(c, 0, -16, 1.8, 1.8, hot ? '#fff0c0' : '#e8f8ff');
    spec(c, -6, -23, 2.2, 0.35);
    // head
    block('M -4.2 -31 L 4.2 -31 L 4.6 -24.4 L -4.6 -24.4 Z', -4.6, -31, 4.6, -24.4, col);
    glow(c, 1.6, -28, 1.8, acc, 0.9); E(c, 1.6, -28, 1, 0.75, '#fff0c0');
    if (warden) { for (let i = 0; i < 5; i++) { const x = -4 + i * 2; P(c, `M ${x - 0.9} -31 L ${x} ${-35 - (i % 2) * 2.4} L ${x + 0.9} -31 Z`, acc, 0.2); } glow(c, 0, -33, 5, acc, 0.4); }
    if (sentinel) { LP(c, 'M -3 -30 L 3 -30 M -4 -26 L 4 -26', '#7fd8ff', 0.35); }
    // near arm: raised then slammed down
    c.save(); c.translate(11, -22); c.rotate(-up * 1.9 + slam * 0.4);
    block('M -2.6 0 L 2.8 0 L 3.2 13 L -2.6 14 Z', -2.6, 0, 3.2, 14, dk);
    block('M -3.2 11 L 3.8 11 L 4 17 L -3.4 17 Z', -3.4, 11, 4, 17, col);
    c.restore();
  }

  function ward(c, L, Pz) {
    const t = Pz.t || 0, acc = L.accent || '#c6f08a';
    P(c, 'M -2.6 0 L -2.2 -19 Q 0 -21 2.2 -19 L 2.6 0 Z', cel(c, -2.6, -21, 2.6, 0, '#5a3d22', 0.5), 0.3);
    LP(c, 'M -1 -15 l 2 0 M -1.2 -12 Q 0 -11 1.2 -12', '#2a1a10', 0.35);
    for (let i = 0; i < 4; i++) { const y = -3.5 - i * 4; LP(c, `M -2.4 ${y} Q -4.4 ${y - 1} -5 ${y - 2.6} M 2.4 ${y - 1} Q 4.4 ${y - 2} 5 ${y - 3.6}`, '#6a8a32', 0.6); P(c, `M -4.6 ${y - 2} l -0.8 -0.6 l 0.4 0.9 Z M 4.6 ${y - 3} l 0.8 -0.6 l -0.4 0.9 Z`, '#d8e8a8', 0.1); }
    const pulse = 0.65 + Math.sin(t * 5) * 0.25;
    glow(c, 0, -22, 6, acc, pulse);
    E(c, 0, -22, 2.2, 2.4, cel(c, -2.2, -24.4, 2.2, -19.6, '#e9ffb0', 0.6, 0.2), 0.25);
  }

  const BEASTS = { wolf, boar, spider, blob, stalker, wisp, imp, golem, ward };

  /* ======================= FRAMES AND CACHE ======================= */
  // Bounds of each kind of figure in sprite units: [x0, y0, x1, y1].
  const BOUNDS = { humanoid: [-27, -52, 27, 6], wolf: [-19, -26, 24, 3], boar: [-16, -22, 22, 3], spider: [-20, -24, 22, 3], blob: [-15, -30, 15, 6], stalker: [-12, -36, 22, 3],
    wisp: [-16, -36, 16, 3], imp: [-9, -31, 13, 3], golem: [-20, -48, 26, 3], ward: [-8, -32, 8, 3] };
  const DEATH_BOUNDS = [-46, -30, 46, 10];
  const cache = new Map();
  let cachePx = 0;
  const BUDGET = 14e6;

  function drawFigure(c, L, view, Pz) {
    if (Pz.death != null) {
      const p = Pz.death;
      if (L.kind === 'humanoid') { c.scale(1, 1 - 0.3 * p); c.rotate(-1.45 * p); }
      else if (L.kind === 'blob') c.scale(1 + 0.5 * p, 1 - 0.68 * p);
      else if (L.kind === 'golem' || L.kind === 'imp') { c.scale(1 + 0.15 * p, 1 - 0.55 * p); }
      else { c.translate(0, 0); c.scale(1, 1 - 0.42 * p); c.rotate(0.28 * p); }
      Pz = { t: 0 };
    }
    if (L.kind === 'humanoid') humanoid(c, L, view, Pz);
    else (BEASTS[L.kind] || blob)(c, L, Pz);
  }

  function renderFrame(L, view, flip, Pz, kc, deathFrame) {
    const b = deathFrame ? DEATH_BOUNDS : BOUNDS[L.kind] || BOUNDS.humanoid;
    const pad = 3;
    const W = Math.ceil((b[2] - b[0]) * kc) + pad * 2, H = Math.ceil((b[3] - b[1]) * kc) + pad * 2;
    const ax = -b[0] * kc + pad, ay = -b[1] * kc + pad;
    const f = document.createElement('canvas'); f.width = W; f.height = H;
    const x = f.getContext('2d');
    x.translate(ax, ay); x.scale(kc, kc);
    if (flip) x.scale(-1, 1);
    FLIP = flip;
    try { drawFigure(x, L, view, Pz); } catch (err) { console.error(err); }
    FLIP = false;
    // thick outer outline: the silhouette, darkened, stamped around the figure
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const o = out.getContext('2d');
    const sil = document.createElement('canvas'); sil.width = W; sil.height = H;
    const s = sil.getContext('2d');
    s.drawImage(f, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = OUT; s.fillRect(0, 0, W, H);
    const r = kc > 2.4 ? 1.5 : 1.15;
    for (let i = 0; i < 8; i++) o.drawImage(sil, Math.cos(i * Math.PI / 4) * r, Math.sin(i * Math.PI / 4) * r);
    o.drawImage(f, 0, 0);
    return { c: out, ax, ay };
  }

  function getFrame(L, view, flip, anim, fi, Pz, kc, kq) {
    const key = `${L.key}|${view}|${flip ? 1 : 0}|${anim}|${fi}|${kq}`;
    let fr = cache.get(key);
    if (fr) { cache.delete(key); cache.set(key, fr); return fr; }
    fr = renderFrame(L, view, flip, Pz, kc, anim === 'death');
    cache.set(key, fr);
    cachePx += fr.c.width * fr.c.height;
    while (cachePx > BUDGET && cache.size > 1) { const k0 = cache.keys().next().value; const f0 = cache.get(k0); cachePx -= f0.c.width * f0.c.height; cache.delete(k0); }
    return fr;
  }

  // Which cached pose a unit is in right now.
  function poseOf(e, st, time) {
    if (e.dead) { const p = Math.min(1, (e.deathT || 0) / 0.45); const fi = Math.min(3, Math.floor(p * 4)); return { anim: 'death', fi, Pz: { death: (fi + 1) / 4 } }; }
    if (st.atk > 0) { const fi = Math.min(5, Math.floor(st.atk * 6)); return { anim: 'atk', fi, Pz: { atk: (fi + 0.5) / 6, t: 0 } }; }
    if (st.cast) { const fi = Math.floor(time * 6) % 2; return { anim: 'cast', fi, Pz: { cast: true, t: fi * 0.5 } }; }
    if (e.flash > 0.04 && !st.moving) return { anim: 'hurt', fi: 0, Pz: { hurt: true, t: 0 } };
    if (st.moving) { const ph = (((st.walk || 0) % TAU) + TAU) % TAU; const fi = Math.floor((ph / TAU) * 8) % 8; return { anim: 'walk', fi, Pz: { walk: (fi / 8) * TAU, t: 0 } }; }
    const n = 6, fi = Math.floor(((time + (e.id || 0) * 0.37) / (Math.PI / n)) % n);
    return { anim: 'idle', fi, Pz: { t: fi * (Math.PI / n) } };
  }

  function lookOf(e) {
    if (e.kind === 'hero') {
      const sig = e.hs.items.map((s) => (s ? s.id : '')).join(',');
      if (e._lookSig !== sig) { e._lookSig = sig; e._look = lookFor(e); }
      return e._look;
    }
    if (!e._look) e._look = lookFor(e);
    return e._look;
  }

  /* Draw a unit at the current origin (its ground point), in the renderer's iso pixel
     space. st: {walk, moving, atk, cast, view, flip}. Returns the drawn height. */
  function drawUnit(ctx, e, st, time) {
    const L = lookOf(e);
    const d = e.def || {};
    const size = e.kind === 'hero' || e.kind === 'npc' ? 1 : d.size || 1;
    const jitter = d.boss || e.kind !== 'enemy' ? 1 : 0.96 + hash((e.id || 1) + 7) * 0.08;
    const k = 1.3 * size * SIZE;
    const z = G.render.cam.zoom * G.render.dpr;
    const kq = Math.max(0.5, Math.round(z * 8) / 8);
    const pose = poseOf(e, st, time);
    const humanoidKind = L.kind === 'humanoid';
    const view = humanoidKind ? st.view : 2, flip = !!st.flip;
    const fr = getFrame(L, view, flip, pose.anim, pose.fi, pose.Pz, k * kq, kq);
    const s = jitter / kq;
    ctx.drawImage(fr.c, -fr.ax * s, -fr.ay * s, fr.c.width * s, fr.c.height * s);
    if (e.flash > 0 && !e.dead) {
      const ga = ctx.globalAlpha;
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = ga * 0.45;
      ctx.drawImage(fr.c, -fr.ax * s, -fr.ay * s, fr.c.width * s, fr.c.height * s);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = ga;
    }
    return k * jitter;
  }

  /* ---------------- live overlays: status effects and boss glows ---------------- */
  function drawStatus(ctx, e, h, time) {
    const has = (id) => e.buffs.some((b) => b.id === id);
    const t = time + (e.id || 0) * 0.7;
    if (has('burn')) {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, -h * 0.45, 0, 0, -h * 0.45, h * 0.6); g.addColorStop(0, 'rgba(255,120,30,0.35)'); g.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -h * 0.45, h * 0.6, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 5 + Math.sin(t * 3 + i) * 1.5, y = -h * (0.25 + i * 0.22), fh = 7 + Math.sin(t * 11 + i * 2) * 2;
        ctx.fillStyle = 'rgba(255,110,30,0.85)'; ctx.beginPath(); ctx.moveTo(x - 2.4, y); ctx.quadraticCurveTo(x - 2, y - fh * 0.6, x, y - fh); ctx.quadraticCurveTo(x + 2, y - fh * 0.6, x + 2.4, y); ctx.fill();
        ctx.fillStyle = 'rgba(255,225,130,0.9)'; ctx.beginPath(); ctx.moveTo(x - 1.1, y); ctx.quadraticCurveTo(x - 0.9, y - fh * 0.4, x, y - fh * 0.6); ctx.quadraticCurveTo(x + 0.9, y - fh * 0.4, x + 1.1, y); ctx.fill();
      }
    }
    if (has('poison') || has('venom')) {
      ctx.fillStyle = 'rgba(140,220,70,0.22)'; ctx.beginPath(); ctx.ellipse(0, -2, 11, 4, 0, 0, TAU); ctx.fill();
      for (let i = 0; i < 4; i++) { const p = ((t * 0.6 + i / 4) % 1); ctx.strokeStyle = `rgba(170,240,90,${0.9 * (1 - p)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc((i - 1.5) * 4 + Math.sin(t * 2 + i) * 1.5, -h * (0.15 + p * 0.8), 1.4 + p, 0, TAU); ctx.stroke(); }
    }
    if (has('chill')) {
      ctx.fillStyle = 'rgba(160,215,255,0.22)'; ctx.beginPath(); ctx.ellipse(0, -h * 0.5, h * 0.32, h * 0.55, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(220,240,255,0.85)'; ctx.lineWidth = 0.9;
      for (let i = 0; i < 3; i++) { const x = (i - 1) * 6, y = -h * (0.3 + i * 0.18); ctx.beginPath(); for (let a = 0; a < 3; a++) { const r = 2.2, an = a * Math.PI / 3; ctx.moveTo(x - Math.cos(an) * r, y - Math.sin(an) * r); ctx.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r); } ctx.stroke(); }
      const p = (t * 0.7) % 1; ctx.fillStyle = `rgba(235,245,255,${0.5 * (1 - p)})`; ctx.beginPath(); ctx.arc(5 + p * 4, -h * 0.85 - p * 3, 1.5 + p * 2.5, 0, TAU); ctx.fill();
    }
    if (has('webbed')) { ctx.strokeStyle = 'rgba(240,240,240,0.7)'; ctx.lineWidth = 0.8; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-9, -h * (0.2 + i * 0.18)); ctx.quadraticCurveTo(0, -h * (0.12 + i * 0.18), 9, -h * (0.25 + i * 0.17)); ctx.stroke(); } }
    if (has('mired')) {
      ctx.fillStyle = 'rgba(60,52,30,0.8)'; ctx.beginPath(); ctx.ellipse(0, -1, 12, 4.4, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(150,200,70,0.55)'; ctx.lineWidth = 1; ctx.stroke();
      for (let i = 0; i < 3; i++) { const p = (t * 0.8 + i / 3) % 1; ctx.strokeStyle = `rgba(160,190,90,${0.8 * (1 - p)})`; ctx.beginPath(); ctx.arc((i - 1) * 6, -1.5 - p * 3, 1 + p * 1.6, 0, TAU); ctx.stroke(); }
    }
    if (has('rejuv')) {
      for (let i = 0; i < 4; i++) { const p = (t * 0.5 + i / 4) % 1, a = t * 2 + i * 1.6; ctx.fillStyle = `rgba(140,240,120,${0.85 * Math.sin(p * Math.PI)})`; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 9, -h * (0.1 + p * 0.9), 1.8, 1, a, 0, TAU); ctx.fill(); }
    }
    if (has('enrage')) {
      ctx.globalCompositeOperation = 'lighter';
      const pu = 0.5 + Math.sin(t * 8) * 0.5, g = ctx.createRadialGradient(0, -h * 0.5, 0, 0, -h * 0.5, h * 0.6); g.addColorStop(0, `rgba(255,40,0,${0.18 + 0.14 * pu})`); g.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -h * 0.5, h * 0.6, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (has('shaken')) { ctx.strokeStyle = 'rgba(200,185,230,0.85)'; ctx.lineWidth = 1.4; const a = t * 3; ctx.beginPath(); ctx.ellipse(0, -h - 2, 8, 2.6, 0, a, a + 4.2); ctx.stroke(); ctx.fillStyle = 'rgba(220,205,250,0.9)'; ctx.beginPath(); ctx.arc(Math.cos(a + 4.2) * 8, -h - 2 + Math.sin(a + 4.2) * 2.6, 1.4, 0, TAU); ctx.fill(); }
    // the Cinder Warden glows hotter as it is hurt; the Hollow King's soul lights circle him
    if (e.defId === 'cinder_warden' && !e.dead) {
      const heat = 1 - e.hp / e.maxHp, pulse = 0.5 + Math.sin(t * (3 + heat * 5)) * 0.5;
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, -h * 0.5, 0, 0, -h * 0.5, h * 0.55); g.addColorStop(0, `rgba(255,140,40,${0.15 + heat * 0.35 * pulse})`); g.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -h * 0.5, h * 0.55, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /* ---------------- deaths ---------------- */
  const CINDER = ['cinderling', 'ash_zealot', 'cinder_brute', 'cinder_warden'];
  function deathKind(e) {
    const d = e.def || {};
    if (e.kind === 'structure') return 'none';
    if (CINDER.includes(e.defId)) return 'cinder';
    if (d.ghost || d.shape === 'wisp') return 'ghost';
    if (d.shape === 'blob') return 'splat';
    if (d.shape === 'spider') return 'ichor';
    if (d.shape === 'golem') return 'rubble';
    if (d.shape === 'ward' || e.kind === 'summon') return 'fade';
    return 'blood';
  }
  // Called when a unit dies: a burst of particles and a mark on the ground.
  function onDeath(e) {
    const kind = deathKind(e), size = (e.def && e.def.size) || 1, x = e.x, y = e.y;
    const F = G.fx;
    if (kind === 'cinder') { F.burst(x, y, '#ff8a2a', 18 * size, 2.2, -2.2); F.burst(x, y, '#5a4a44', 10 * size, 1.6); F.mark && F.mark(x, y, 'ash', 0.6 * size); }
    else if (kind === 'ghost') F.burst(x, y, e.def.accent || '#9fd8ff', 16 * size, 1.4, -2.6);
    else if (kind === 'splat') { F.burst(x, y, e.def.color, 16 * size, 2.6); F.mark && F.mark(x, y, 'ichor', 0.7 * size, e.def.accent); }
    else if (kind === 'ichor') { F.burst(x, y, '#9be35a', 10 * size, 2); F.mark && F.mark(x, y, 'ichor', 0.55 * size, '#7ab83a'); }
    else if (kind === 'rubble') { F.burst(x, y, '#8a8078', 18 * size, 2.4); F.burst(x, y, e.def.accent, 8, 1.6, -2); F.mark && F.mark(x, y, 'rubble', 0.7 * size); }
    else if (kind === 'blood') { F.burst(x, y, '#8a1a12', 8 * size, 1.6); F.mark && F.mark(x, y, 'blood', 0.5 * size); }
  }
  // How a corpse fades: [alpha, lift in pixels]
  function corpse(e) {
    const t = e.deathT || 0, kind = deathKind(e);
    if (kind === 'ghost') return [Math.max(0, 1 - t / 1.2), t * 18];
    if (kind === 'cinder') return [Math.max(0, 1 - Math.max(0, t - 0.4) / 1.2), 0];
    if (kind === 'fade') return [Math.max(0, 1 - t / 0.6), 0];
    return [Math.max(0, 1 - Math.max(0, t - 1.4) / 1.6), 0];
  }

  // Draw a unit straight onto a canvas (no frame cache), for portraits.
  function drawDirect(c, e, k, view = 1) {
    const L = lookOf(e);
    c.save(); c.scale(k, k); FLIP = false;
    try { drawFigure(c, L, L.kind === 'humanoid' ? view : 2, { t: 0 }); } catch (err) { console.error(err); }
    c.restore();
  }

  return { SIZE, lookFor, drawUnit, drawDirect, drawStatus, onDeath, corpse, deathKind, cacheSize: () => [cache.size, cachePx], clearCache: () => { cache.clear(); cachePx = 0; }, sh, mix, rgba };
})();
