/* Units: enemies, summons, wards and objective structures.
   hp/dmg are at the listed level; xp is what each hero in the party earns. */

G.UNITS = {
  /* --- Brindle Fields --- */
  boar: { name: 'Brindle Boar', level: 1, hp: 160, dmg: 11, armor: 0, atkCd: 1.6, range: 1.0, speed: 2.7, r: 0.45, xp: 25, gold: [3, 7],
    shape: 'boar', color: '#7a5233', accent: '#e9dcc0', dropChance: 0.05 },
  wolf: { name: 'Field Wolf', level: 2, hp: 210, dmg: 15, armor: 1, atkCd: 1.3, range: 1.0, speed: 3.5, r: 0.42, xp: 34, gold: [4, 9],
    shape: 'wolf', color: '#6b6e72', accent: '#c9ccd0', dropChance: 0.06, questDrop: { quest: 'wolf_pelts', item: 'pelt', chance: 0.55 } },
  greymane: { name: 'Greymane the Old Alpha', level: 5, hp: 1150, dmg: 32, armor: 3, atkCd: 1.15, range: 1.1, speed: 3.7, r: 0.6, xp: 220, gold: [60, 90],
    shape: 'wolf', color: '#aeb6bd', accent: '#ffffff', size: 1.45, elite: true, drops: ['greymane_mantle'], skills: [{ id: 'howl', at: 0.5 }] },

  /* --- Whisperwood --- */
  webspinner: { name: 'Webspinner', level: 3, hp: 250, dmg: 17, armor: 1, atkCd: 1.4, range: 1.0, speed: 3.1, r: 0.45, xp: 44, gold: [5, 10],
    shape: 'spider', color: '#4a3f55', accent: '#c7b8e0', dropChance: 0.06, skills: [{ id: 'web', cd: 9 }] },
  venomfang: { name: 'Venomfang', level: 4, hp: 320, dmg: 19, armor: 1, atkCd: 1.4, range: 1.0, speed: 3.2, r: 0.5, xp: 55, gold: [6, 12],
    shape: 'spider', color: '#3d5a2a', accent: '#b7f06a', size: 1.15, dropChance: 0.07, poison: { dps: 6, t: 4 } },
  cutthroat: { name: 'Bandit Cutthroat', level: 3, hp: 300, dmg: 18, armor: 2, atkCd: 1.3, range: 1.1, speed: 3.1, r: 0.42, xp: 45, gold: [8, 14],
    shape: 'humanoid', weapon: 'sword', color: '#7d3c2a', accent: '#d8b48a', hood: true, dropChance: 0.08 },
  bandit_archer: { name: 'Bandit Archer', level: 4, hp: 250, dmg: 21, armor: 1, atkCd: 1.8, range: 5.5, speed: 3.0, r: 0.42, xp: 55, gold: [8, 14],
    shape: 'humanoid', weapon: 'bow', color: '#5d4a2a', accent: '#d8b48a', hood: true, dropChance: 0.08, projectile: { color: '#d9c49a', size: 2, speed: 14, arrow: true } },
  bruiser: { name: 'Bandit Bruiser', level: 5, hp: 540, dmg: 29, armor: 3, atkCd: 1.85, range: 1.2, speed: 2.8, r: 0.55, xp: 72, gold: [12, 20],
    shape: 'humanoid', weapon: 'club', color: '#6e2c1f', accent: '#e0c59c', size: 1.25, dropChance: 0.1 },
  grell: { name: 'Grell Thornjaw', level: 7, hp: 2900, dmg: 40, armor: 4, atkCd: 1.5, range: 1.3, speed: 3.0, r: 0.75, xp: 600, gold: [180, 240],
    shape: 'humanoid', weapon: 'axe', color: '#8a2a1b', accent: '#f0c98f', size: 1.7, boss: true, drops: ['thornjaw_cleaver', 'tome_might'],
    skills: [{ id: 'whirl', cd: 11, first: 6 }, { id: 'axeThrow', cd: 8, first: 3 }, { id: 'callGang', at: 0.6 }, { id: 'callGang', at: 0.3 }] },

  /* --- Mirefen (optional zone) --- */
  bog_lurker: { name: 'Bog Lurker', level: 5, hp: 480, dmg: 26, armor: 2, atkCd: 1.6, range: 1.1, speed: 2.7, r: 0.55, xp: 70, gold: [9, 16],
    shape: 'blob', color: '#4f6b3a', accent: '#a9c46a', dropChance: 0.08 },
  bogling: { name: 'Bogling', level: 4, hp: 180, dmg: 14, armor: 0, atkCd: 1.2, range: 1.0, speed: 3.3, r: 0.35, xp: 20, gold: [0, 2],
    shape: 'blob', color: '#5c7d42', accent: '#c8e08a', size: 0.7 },
  fen_stalker: { name: 'Fen Stalker', level: 6, hp: 560, dmg: 33, armor: 3, atkCd: 1.3, range: 1.1, speed: 3.6, r: 0.5, xp: 85, gold: [10, 18],
    shape: 'stalker', color: '#2f4a3f', accent: '#9fe0b8', dropChance: 0.09 },
  wisp: { name: 'Marsh Wisp', level: 6, hp: 340, dmg: 28, armor: 0, atkCd: 1.9, range: 5.0, speed: 3.0, r: 0.38, xp: 85, gold: [10, 18],
    shape: 'wisp', color: '#7fe3d3', accent: '#ffffff', spell: true, dropChance: 0.09, projectile: { color: '#9ffff0', size: 4, speed: 8 } },
  bogmother: { name: 'The Bogmother', level: 8, hp: 4800, dmg: 52, armor: 4, atkCd: 1.7, range: 1.6, speed: 2.4, r: 0.95, xp: 900, gold: [260, 320],
    shape: 'blob', color: '#3f5a2c', accent: '#d6f07a', size: 2.3, boss: true, drops: ['bogmother_eye', 'tome_insight'],
    skills: [{ id: 'mirePool', cd: 9, first: 4 }, { id: 'spawnlings', cd: 16, first: 8 }] },

  /* --- Ashen Barrows + mill raid --- */
  cinderling: { name: 'Cinderling', level: 5, hp: 290, dmg: 21, armor: 1, atkCd: 1.2, range: 1.0, speed: 3.7, r: 0.38, xp: 52, gold: [5, 11],
    shape: 'imp', color: '#3a2a26', accent: '#ff7a2a', dropChance: 0.06 },
  ash_zealot: { name: 'Ash Zealot', level: 6, hp: 380, dmg: 31, armor: 1, atkCd: 2.0, range: 5.5, speed: 3.0, r: 0.42, xp: 80, gold: [12, 20],
    shape: 'humanoid', weapon: 'staff', color: '#4a2328', accent: '#ff9d4a', hood: true, spell: true, dropChance: 0.1,
    projectile: { color: '#ff8a3d', size: 4, speed: 9 }, skills: [{ id: 'emberBurst', cd: 10, first: 4 }] },
  cinder_brute: { name: 'Cinder Brute', level: 7, hp: 1100, dmg: 44, armor: 5, atkCd: 2.0, range: 1.3, speed: 2.5, r: 0.75, xp: 140, gold: [20, 34],
    shape: 'golem', color: '#3b3330', accent: '#ff6a1a', size: 1.35, elite: true, dropChance: 0.25, skills: [{ id: 'slam', cd: 10, first: 5 }] },
  revenant: { name: 'Barrow Revenant', level: 7, hp: 640, dmg: 37, armor: 4, atkCd: 1.5, range: 1.2, speed: 3.0, r: 0.48, xp: 100, gold: [12, 22],
    shape: 'humanoid', weapon: 'sword', color: '#4a5560', accent: '#9fd8ff', ghost: true, dropChance: 0.1, chill: true },
  cinder_warden: { name: 'The Cinder Warden', level: 10, hp: 7000, dmg: 62, armor: 5, atkCd: 1.6, range: 1.6, speed: 2.7, r: 1.05, xp: 1500, gold: [500, 600],
    shape: 'golem', color: '#2b2422', accent: '#ffb02e', size: 2.4, boss: true, drops: ['warden_heart', 'tome_mastery'],
    skills: [{ id: 'emberRing', cd: 9, first: 5 }, { id: 'flameNova', cd: 16, first: 12 }, { id: 'wardenAdds', at: 0.66 }, { id: 'wardenAdds', at: 0.33 }, { id: 'enrage', at: 0.3 }] },

  /* --- player summons --- */
  ember_hound: { name: 'Ember Hound', level: 1, hp: 360, dmg: 16, armor: 2, atkCd: 1.2, range: 1.0, speed: 3.7, r: 0.4, xp: 0,
    shape: 'wolf', color: '#5a2a18', accent: '#ff8a3d', summon: true, burn: { dps: 5, t: 3 } },
  thornward: { name: 'Thornward', level: 1, hp: 150, dmg: 15, armor: 2, atkCd: 1.0, range: 4.5, speed: 0, r: 0.35, xp: 0,
    shape: 'ward', color: '#5b8a3a', accent: '#c6f08a', summon: true, immobile: true, projectile: { color: '#b4e36a', size: 2.5, speed: 12 } },

  /* --- objective structure --- */
  mill: { name: "Ovan's Mill", level: 1, hp: 3600, dmg: 0, armor: 5, atkCd: 99, range: 0, speed: 0, r: 1.6, xp: 0, shape: 'structure', immobile: true, structure: true },
};

/* Boss/elite special moves. Each returns true if it fired. `e` is the caster. */
G.ENEMY_SKILLS = {
  howl(e) {
    G.fx.ring(e.x, e.y, 3, '#d6e4f0', 0.6, true);
    G.ui.toast('Greymane howls! The pack answers.');
    for (let i = 0; i < 2; i++) G.world.spawnNear('wolf', e.x, e.y, 2.5, { team: 'enemy', aggro: true, noRespawn: true, noXpScale: true });
    G.audio.play('roar');
    return true;
  },
  web(e) {
    const t = e.target;
    if (!t || t.dead || G.util.dist(e, t) > 5.5) return false;
    G.fx.projectile({ from: e, to: t, color: '#e8e8f0', size: 4, speed: 10, onHit: (tt) => G.combat.buff(tt, { id: 'webbed', name: 'Webbed', t: 3, mods: { moveMul: -0.5 }, color: '#ddd' }) });
    return true;
  },
  whirl(e) {
    const R = 2.7;
    G.fx.telegraph({ x: e.x, y: e.y, r: R, delay: 0.9, follow: e, color: '#ff4b3a' });
    e.busy = 3.0;
    G.world.after(0.9, () => {
      if (e.dead) return;
      e.spinning = 2.0;
      for (let i = 0; i < 5; i++) G.world.after(i * 0.4, () => {
        if (e.dead) return;
        for (const h of G.combat.hostilesNear(e.x, e.y, R, e.team)) G.combat.dealDamage(e, h, 26, { spell: true });
        G.fx.ring(e.x, e.y, R, '#ffb08a', 0.25);
      });
    });
    G.audio.play('whirl');
    return true;
  },
  axeThrow(e) {
    let far = null, fd = 0;
    for (const h of G.combat.hostilesNear(e.x, e.y, 9, e.team)) { const d = G.util.dist(e, h); if (d > fd && d > 2.5) { fd = d; far = h; } }
    if (!far) return false;
    G.fx.projectile({ from: e, to: far, color: '#c9c9c9', size: 6, speed: 9, spin: true, onHit: (t) => { G.combat.dealDamage(e, t, 75, { spell: true }); G.combat.stun(t, 0.5); } });
    return true;
  },
  callGang(e) {
    G.ui.toast('Grell bellows: "Lads! Get out here!"');
    G.world.spawnNear('cutthroat', e.x, e.y, 4, { team: 'enemy', aggro: true, noRespawn: true });
    G.world.spawnNear('cutthroat', e.x, e.y, 4, { team: 'enemy', aggro: true, noRespawn: true });
    G.world.spawnNear('bandit_archer', e.x, e.y, 5, { team: 'enemy', aggro: true, noRespawn: true });
    return true;
  },
  emberBurst(e) {
    const t = e.target;
    if (!t || t.dead || G.util.dist(e, t) > 7) return false;
    const x = t.x, y = t.y;
    G.fx.telegraph({ x, y, r: 1.6, delay: 1.2, color: '#ff7a2a', onDone: () => {
      for (const h of G.combat.hostilesNear(x, y, 1.6, e.team)) G.combat.dealDamage(e, h, 85, { spell: true });
      G.fx.burst(x, y, '#ffae5a', 24, 4); G.fx.flash(x, y, '#ff8a2a', 1.4, 0.3, 6); G.fx.mark(x, y, 'scorch', 1.5); G.audio.play('boom');
    } });
    return true;
  },
  slam(e) {
    if (!e.target || G.util.dist(e, e.target) > 3) return false;
    e.busy = 1.1;
    G.fx.telegraph({ x: e.x, y: e.y, r: 2.3, delay: 1.0, follow: e, color: '#ff5a1a', onDone: () => {
      if (e.dead) return;
      for (const h of G.combat.hostilesNear(e.x, e.y, 2.3, e.team)) { G.combat.dealDamage(e, h, 115, { spell: true }); G.combat.stun(h, 1); }
      G.fx.burst(e.x, e.y, '#c88a5a', 26, 5); G.fx.mark(e.x, e.y, 'crater', 2); G.fx.shake(0.25, 4); G.audio.play('quake');
    } });
    return true;
  },
  mirePool(e) {
    const hs = G.combat.hostilesNear(e.x, e.y, 12, e.team).filter((h) => h.kind === 'hero');
    if (!hs.length) return false;
    const hitOnce = new Set(); // overlapping pools only hurt each target once per cast
    for (const h of hs) {
      const x = h.x, y = h.y;
      G.fx.telegraph({ x, y, r: 1.8, delay: 1.4, color: '#7bd13a', onDone: () => {
        for (const t of G.combat.hostilesNear(x, y, 1.8, e.team)) {
          if (hitOnce.has(t)) continue;
          hitOnce.add(t);
          G.combat.dealDamage(e, t, 105, { spell: true });
          G.combat.buff(t, { id: 'mired', name: 'Mired', t: 3, mods: { moveMul: -0.45 }, color: '#7bd13a' });
        }
        G.fx.burst(x, y, '#9be35a', 20, 3); G.fx.mark(x, y, 'ichor', 1.4, '#6a8a2a'); G.audio.play('splash');
      } });
    }
    return true;
  },
  spawnlings(e) {
    for (let i = 0; i < 3; i++) G.world.spawnNear('bogling', e.x, e.y, 2.5, { team: 'enemy', aggro: true, noRespawn: true });
    G.fx.burst(e.x, e.y, '#9be35a', 30, 3);
    G.audio.play('splash');
    return true;
  },
  emberRing(e) {
    // one circle under each hero; overlapping circles only hurt each target once per cast
    const hs = G.combat.hostilesNear(e.x, e.y, 14, e.team).filter((h) => h.kind === 'hero');
    if (!hs.length) return false;
    const hitOnce = new Set();
    for (const h of hs) {
      const x = h.x, y = h.y;
      G.fx.telegraph({ x, y, r: 2.0, delay: 1.6, color: '#ff6a00', onDone: () => {
        for (const t of G.combat.hostilesNear(x, y, 2.0, e.team)) {
          if (hitOnce.has(t)) continue;
          hitOnce.add(t);
          G.combat.dealDamage(e, t, 140, { spell: true });
        }
        G.fx.burst(x, y, '#ffb04a', 28, 5); G.fx.flash(x, y, '#ff8a2a', 1.6, 0.3, 6); G.fx.mark(x, y, 'scorch', 1.8); G.audio.play('boom');
      } });
    }
    return true;
  },
  flameNova(e) {
    G.ui.toast('The Cinder Warden gathers fire. Get away from it!');
    e.busy = 2.0;
    G.fx.telegraph({ x: e.x, y: e.y, r: 5, delay: 1.9, follow: e, color: '#ff3a00', onDone: () => {
      if (e.dead) return;
      for (const t of G.combat.hostilesNear(e.x, e.y, 5, e.team)) G.combat.dealDamage(e, t, 200, { spell: true });
      G.fx.ring(e.x, e.y, 5, '#ffcf6a', 0.6, true); G.fx.burst(e.x, e.y, '#ff8a2a', 60, 7); G.fx.flash(e.x, e.y, '#ff8a2a', 4, 0.45, 8); G.fx.mark(e.x, e.y, 'scorch', 4.2); G.fx.shake(0.5, 8); G.audio.play('quake');
    } });
    return true;
  },
  wardenAdds(e) {
    G.ui.toast('Cinder spills from the Warden’s cracks!');
    G.world.spawnNear('cinderling', e.x, e.y, 4, { team: 'enemy', aggro: true, noRespawn: true });
    G.world.spawnNear('cinderling', e.x, e.y, 4, { team: 'enemy', aggro: true, noRespawn: true });
    G.world.spawnNear('ash_zealot', e.x, e.y, 5, { team: 'enemy', aggro: true, noRespawn: true });
    return true;
  },
  enrage(e) {
    G.ui.toast('The Cinder Warden burns white-hot!');
    G.combat.buff(e, { id: 'enrage', name: 'Enraged', t: 9999, mods: { atkSpeed: 0.35, moveMul: 0.15 }, color: '#ff3a00' });
    return true;
  },
};
