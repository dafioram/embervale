/* Hero abilities. Each entry is data (costs, cooldowns, ranges, text) plus a cast()
   function that uses the engine helpers in G.combat / G.fx / G.world.
   target: 'none' (instant), 'enemy', 'ally', 'point'. */

(() => {
  const V = (arr, r) => (Array.isArray(arr) ? arr[Math.min(r, arr.length) - 1] : arr);

  G.ABILITIES = {
    /* ---------------- Maren ---------------- */
    shieldRush: {
      name: 'Shield Rush', icon: 'rush', color: '#d98a3d', maxRank: 3,
      target: 'enemy', range: 6.5,
      mana: [60, 70, 80], cd: [10, 9, 8], dmg: [70, 125, 185], stun: [1, 1.25, 1.5],
      desc: (r, a) => `Charge an enemy, dealing ${V(a.dmg, r)} damage and stunning it for ${V(a.stun, r)}s.`,
      cast(c, t, r, a) {
        G.world.dashTo(c, t, 22, () => {
          if (t.dead) return;
          G.combat.dealDamage(c, t, V(a.dmg, r), { spell: true });
          G.combat.stun(t, V(a.stun, r));
          G.fx.burst(t.x, t.y, '#ffcf8a', 14, 4);
          G.fx.ring(t.x, t.y, 1.2, '#ffcf8a', 0.35);
          G.audio.play('thud');
          c.target = t;
        });
      },
    },
    rallyingRoar: {
      name: 'Rallying Roar', icon: 'roar', color: '#e2b53d', maxRank: 3,
      target: 'none', radius: 5,
      mana: [75, 85, 95], cd: [16, 15, 14], armor: [3, 5, 7], haste: [0.1, 0.15, 0.2], taunt: 3,
      desc: (r, a) => `Taunt nearby enemies for ${a.taunt}s. Allies within ${a.radius} gain +${V(a.armor, r)} armor and +${Math.round(V(a.haste, r) * 100)}% attack speed for 10s.`,
      cast(c, t, r, a) {
        for (const e of G.combat.hostilesNear(c.x, c.y, a.radius, c.team)) {
          G.combat.buff(e, { id: 'taunt', name: 'Taunted', t: a.taunt, taunt: c, color: '#e2b53d' });
          e.target = c;
        }
        for (const e of G.combat.alliesNear(c.x, c.y, a.radius + 2, c.team)) {
          G.combat.buff(e, { id: 'roar', name: 'Rallied', t: 10, mods: { armor: V(a.armor, r), atkSpeed: V(a.haste, r) }, color: '#e2b53d', good: true });
        }
        G.fx.ring(c.x, c.y, a.radius, '#ffd76a', 0.5, true);
        G.fx.ring(c.x, c.y, a.radius * 0.6, '#ffd76a', 0.35, true);
        G.audio.play('roar');
      },
    },
    emberHound: {
      name: 'Ember Hound', icon: 'hound', color: '#e0662f', maxRank: 3,
      target: 'none',
      mana: [100, 110, 120], cd: [30, 30, 30], dur: 45, hp: [360, 520, 720], dmg: [16, 25, 36],
      desc: (r, a) => `Call an ember hound for ${a.dur}s (${V(a.hp, r)} HP, ${V(a.dmg, r)} damage). Its bite burns.`,
      cast(c, t, r, a) {
        if (c.hound && !c.hound.dead) G.world.remove(c.hound, true);
        const ang = c.facing + Math.PI * 0.6;
        const h = G.world.spawn('ember_hound', c.x + Math.cos(ang) * 1.2, c.y + Math.sin(ang) * 1.2, {
          team: c.team, owner: c, ttl: a.dur, level: r,
          override: { hp: V(a.hp, r), dmg: V(a.dmg, r) },
        });
        c.hound = h;
        G.fx.burst(h.x, h.y, '#ff8a3d', 20, 3);
        G.audio.play('summon');
      },
    },
    earthbreaker: {
      name: 'Earthbreaker', icon: 'quake', color: '#a15b2b', maxRank: 2, ult: true,
      target: 'none', radius: 4,
      mana: [150, 175], cd: [70, 60], dmg: [260, 400], stun: [2.25, 2.75],
      desc: (r, a) => `Slam the ground: ${V(a.dmg, r)} damage to enemies within ${a.radius} and stun them for ${V(a.stun, r)}s.`,
      cast(c, t, r, a) {
        for (const e of G.combat.hostilesNear(c.x, c.y, a.radius, c.team)) {
          G.combat.dealDamage(c, e, V(a.dmg, r), { spell: true });
          G.combat.stun(e, V(a.stun, r));
        }
        G.fx.ring(c.x, c.y, a.radius, '#ffb062', 0.6, true);
        G.fx.burst(c.x, c.y, '#c7854a', 40, 6);
        G.fx.shake(0.4, 7);
        G.audio.play('quake');
      },
    },

    /* ---------------- Tobin ---------------- */
    mendingLight: {
      name: 'Mending Light', icon: 'heal', color: '#78e08f', maxRank: 3,
      target: 'ally', range: 6.5,
      mana: [55, 65, 75], cd: [5, 5, 5], heal: [140, 225, 320],
      desc: (r, a) => `Restore ${V(a.heal, r)} health to an ally.`,
      cast(c, t, r, a) {
        G.combat.heal(t, V(a.heal, r), c);
        G.fx.beam(c, t, '#a6ffbf', 0.3);
        G.fx.burst(t.x, t.y, '#b6ffca', 16, 2, -1.5);
        G.audio.play('heal');
      },
    },
    chainSpark: {
      name: 'Chain Spark', icon: 'spark', color: '#66c8ff', maxRank: 3,
      target: 'enemy', range: 6.5,
      mana: [80, 95, 110], cd: [9, 9, 9], dmg: [80, 125, 180], jumps: [3, 4, 5],
      desc: (r, a) => `Lightning that strikes an enemy and jumps to ${V(a.jumps, r) - 1} more, starting at ${V(a.dmg, r)} damage (15% less per jump).`,
      cast(c, t, r, a) {
        const hit = new Set();
        let cur = t, prev = c, dmg = V(a.dmg, r);
        for (let i = 0; i < V(a.jumps, r) && cur; i++) {
          hit.add(cur);
          G.fx.bolt(prev, cur, '#9fe3ff', 0.3);
          G.combat.dealDamage(c, cur, Math.round(dmg), { spell: true });
          dmg *= 0.85;
          prev = cur;
          let best = null, bd = 4.2;
          for (const e of G.combat.hostilesNear(cur.x, cur.y, 4.2, c.team)) {
            if (hit.has(e)) continue;
            const d = G.util.dist(e, cur);
            if (d < bd) { bd = d; best = e; }
          }
          cur = best;
        }
        G.audio.play('zap');
      },
    },
    thornward: {
      name: 'Thornward', icon: 'ward', color: '#8bc34a', maxRank: 3,
      target: 'point', range: 6.5, radius: 4.5,
      mana: [70, 80, 90], cd: [14, 13, 12], dur: 20, dmg: [15, 24, 34],
      desc: (r, a) => `Plant a ward for ${a.dur}s that hurls thorns (${V(a.dmg, r)} damage) at enemies within ${a.radius}.`,
      cast(c, t, r, a) {
        const w = G.world.spawn('thornward', t.x, t.y, { team: c.team, owner: c, ttl: a.dur, override: { dmg: V(a.dmg, r) } });
        G.fx.burst(w.x, w.y, '#9ad26a', 16, 2.5);
        G.audio.play('summon');
      },
    },
    spiritTide: {
      name: 'Spirit Tide', icon: 'tide', color: '#4fd1c5', maxRank: 2, ult: true,
      target: 'none',
      mana: [175, 200], cd: [90, 75], heal: [300, 450],
      desc: (r, a) => `Heal every ally in the area for ${V(a.heal, r)} and raise fallen heroes at half health (they are Shaken: 20% less damage for 30s).`,
      cast(c, t, r, a) {
        for (const e of G.world.entities) {
          if (e.team !== c.team || e.kind === 'structure') continue;
          if (e.dead && e.kind === 'hero') {
            G.world.reviveHero(e, 0.5);
            G.fx.burst(e.x, e.y, '#b5fff4', 30, 3, -2);
          } else if (!e.dead && G.util.dist(e, c) < 14) {
            G.combat.heal(e, V(a.heal, r), c);
            G.fx.burst(e.x, e.y, '#b5fff4', 14, 2, -2);
          }
        }
        G.fx.ring(c.x, c.y, 6, '#7af0e0', 0.8, true);
        G.audio.play('tide');
      },
    },

    /* ---------------- Ysolde ---------------- */
    piercingShot: {
      name: 'Piercing Shot', icon: 'pierce', color: '#f2c14e', maxRank: 3,
      target: 'point', range: 9, line: 0.8,
      mana: [60, 70, 80], cd: [8, 7, 6], dmg: [90, 140, 200],
      desc: (r, a) => `Loose an arrow that passes through every enemy in a line for ${V(a.dmg, r)} damage.`,
      cast(c, t, r, a) {
        const ang = Math.atan2(t.y - c.y, t.x - c.x);
        const ex = c.x + Math.cos(ang) * a.range, ey = c.y + Math.sin(ang) * a.range;
        for (const e of G.combat.hostilesNear(c.x, c.y, a.range + 1, c.team)) {
          // distance from e to segment
          const dx = ex - c.x, dy = ey - c.y;
          const tt = G.util.clamp(((e.x - c.x) * dx + (e.y - c.y) * dy) / (dx * dx + dy * dy), 0, 1);
          const px = c.x + dx * tt, py = c.y + dy * tt;
          if (Math.hypot(e.x - px, e.y - py) <= a.line / 2 + e.r) {
            G.combat.dealDamage(c, e, V(a.dmg, r), { spell: true });
            G.fx.burst(e.x, e.y, '#ffe39a', 8, 3);
          }
        }
        G.fx.streak(c.x, c.y, ex, ey, '#ffe39a', 0.35, 4);
        G.audio.play('shoot');
      },
    },
    smokeStep: {
      name: 'Smoke Step', icon: 'smoke', color: '#9e8cc4', maxRank: 3,
      target: 'point', range: 5.5,
      mana: [50, 55, 60], cd: [12, 11, 10], evade: [0.3, 0.4, 0.5],
      desc: (r, a) => `Vanish in smoke and reappear at a point, gaining ${Math.round(V(a.evade, r) * 100)}% evasion for 4s. Enemies lose track of you.`,
      cast(c, t, r, a) {
        G.fx.burst(c.x, c.y, '#b9acd6', 22, 2, -0.5);
        G.world.blinkTo(c, t.x, t.y);
        G.fx.burst(c.x, c.y, '#b9acd6', 22, 2, -0.5);
        G.combat.buff(c, { id: 'smoke', name: 'Smoke Step', t: 4, mods: { evasion: V(a.evade, r) }, color: '#b9acd6', good: true });
        for (const e of G.world.entities) if (e.target === c && e.team !== c.team) e.target = null;
        G.audio.play('whoosh');
      },
    },
    arrowVolley: {
      name: 'Arrow Volley', icon: 'volley', color: '#e5904b', maxRank: 3,
      target: 'point', range: 7.5, radius: 2.5,
      mana: [90, 105, 120], cd: [12, 12, 12], dmg: [35, 55, 80],
      desc: (r, a) => `Rain three waves of arrows on an area, each dealing ${V(a.dmg, r)} damage to enemies within ${a.radius}.`,
      cast(c, t, r, a) {
        const x = t.x, y = t.y;
        for (let w = 0; w < 3; w++) {
          G.world.after(0.15 + w * 0.5, () => {
            for (const e of G.combat.hostilesNear(x, y, a.radius, c.team)) G.combat.dealDamage(c, e, V(a.dmg, r), { spell: true });
            G.fx.arrowRain(x, y, a.radius, '#ffd9a0');
            G.audio.play('volley');
          });
        }
        G.fx.ring(x, y, a.radius, '#ffb36b', 1.6);
      },
    },
    huntersMark: {
      name: "Hunter's Mark", icon: 'mark', color: '#ff6b6b', maxRank: 2, ult: true,
      target: 'enemy', range: 9.5,
      mana: [125, 150], cd: [60, 50], dmg: [380, 560], amp: 0.25,
      desc: (r, a) => `Take aim for a moment, then fire a shot for ${V(a.dmg, r)} damage. The target takes ${a.amp * 100}% more damage for 8s.`,
      channel: 0.8,
      cast(c, t, r, a) {
        G.fx.streak(c.x, c.y, t.x, t.y, '#ff8f8f', 0.4, 6);
        if (!t.dead) {
          G.combat.buff(t, { id: 'mark', name: 'Marked', t: 8, mods: { dmgTaken: a.amp }, color: '#ff6b6b' });
          G.combat.dealDamage(c, t, V(a.dmg, r), { spell: true });
          G.fx.burst(t.x, t.y, '#ff9a9a', 24, 4);
        }
        G.fx.shake(0.2, 4);
        G.audio.play('bigshot');
      },
    },

    /* ---------------- shared ---------------- */
    attributeTraining: {
      name: 'Attribute Training', icon: 'training', color: '#9a7ad8', maxRank: 5, passive: true,
      reqLevels: [2, 4, 6, 8, 10], per: 2,
      desc: (r, a) => `Passive. +${a.per * r} to Strength, Agility and Intelligence.`,
    },
  };

  G.abilityValue = V;
})();
