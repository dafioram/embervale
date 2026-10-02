/* Damage, healing, buffs and death. */
G.combat = (() => {
  const U = G.util;

  // Recompute buff-derived modifiers; called once per unit per frame.
  function tickBuffs(e, dt) {
    const m = { armor: 0, atkSpeed: 0, moveMul: 0, dmgTaken: 0, evasion: 0, dmgOut: 0 };
    e.stunned = false; e.taunt = null;
    for (let i = e.buffs.length - 1; i >= 0; i--) {
      const b = e.buffs[i];
      if (!b) continue; // a damage-over-time tick can kill the unit and clear its buffs mid-loop
      b.t -= dt;
      if (b.mods) for (const k in b.mods) m[k] += b.mods[k];
      if (b.stun) e.stunned = true;
      if (b.taunt && !b.taunt.dead) e.taunt = b.taunt;
      if (b.dot && !e.dead) { b.acc = (b.acc || 0) + b.dot * dt; if (b.acc >= 1) { const n = Math.floor(b.acc); b.acc -= n; dealDamage(b.src || null, e, n, { spell: true, dot: true }); } }
      if (b.hot && !e.dead) e.hp = Math.min(e.maxHp, e.hp + b.hot * dt);
      if (b.mot && !e.dead && e.maxMp) e.mp = Math.min(e.maxMp, e.mp + b.mot * dt);
      if (b.t <= 0) e.buffs.splice(i, 1);
    }
    if (e.dead) return;
    e.mods = m;
  }

  function buff(t, b) {
    if (!t || t.dead) return;
    const i = t.buffs.findIndex((x) => x.id === b.id);
    b.dur = b.t;
    if (i >= 0) t.buffs[i] = b; else t.buffs.push(b);
  }

  function stun(t, dur) {
    if (!t || t.dead || t.immobileStun === false) return;
    if (t.def && t.def.boss) dur *= 0.5;
    buff(t, { id: 'stun', name: 'Stunned', t: dur, stun: true, color: '#ffe066' });
    t.swing = 0; t.channel = null;
  }

  const targetable = (e) => !e.dead && !e.removed && (e.kind === 'hero' || e.kind === 'enemy' || e.kind === 'summon' || (e.kind === 'structure' && !e.invuln));

  function hostilesNear(x, y, r, team) {
    const out = [];
    for (const e of G.world.entities) {
      if (!targetable(e) || e.team === team || e.team === 'neutral') continue;
      if (U.dist2(x, y, e.x, e.y) <= r + e.r) out.push(e);
    }
    return out;
  }
  function alliesNear(x, y, r, team) {
    const out = [];
    for (const e of G.world.entities) {
      if (!targetable(e) || e.team !== team || e.kind === 'structure') continue;
      if (U.dist2(x, y, e.x, e.y) <= r + e.r) out.push(e);
    }
    return out;
  }

  function dealDamage(src, tgt, amount, opts = {}) {
    if (!tgt || tgt.dead || tgt.invuln || !isFinite(amount)) return 0;
    const m = tgt.mods || {};
    if (!opts.spell && m.evasion > 0 && Math.random() < Math.min(0.75, m.evasion)) {
      G.fx.text(tgt.x, tgt.y, 'miss', '#cfd8dc', 12);
      return 0;
    }
    let dmg = amount;
    if (src && src.mods && src.mods.dmgOut) dmg *= Math.max(0, 1 + src.mods.dmgOut);
    if (!opts.spell) dmg *= 1 - G.armorReduction((tgt.armor || 0) + (m.armor || 0));
    dmg *= 1 + (m.dmgTaken || 0);
    dmg = Math.max(1, Math.round(dmg));
    tgt.hp -= dmg;
    tgt.flash = 0.12;
    if (tgt.team === 'player' || (src && src.team === 'player')) G.world.lastCombat = G.state.playTime;
    if (!opts.dot || dmg >= 4) {
      const col = tgt.team === 'player' ? '#ff6b6b' : opts.spell ? '#9fd8ff' : '#ffffff';
      G.fx.text(tgt.x, tgt.y, String(dmg), col, opts.spell ? 15 : 13);
    }
    if (src && !src.dead) G.ai.onAttacked(tgt, src);
    if (tgt.hp <= 0) kill(tgt, src);
    return dmg;
  }

  function heal(t, amount, src) {
    if (!t || t.dead) return;
    const before = t.hp;
    t.hp = Math.min(t.maxHp, t.hp + amount);
    const got = Math.round(t.hp - before);
    if (got > 0) G.fx.text(t.x, t.y, '+' + got, '#7dff9a', 14);
  }

  function kill(e, src) {
    if (e.dead) return;
    e.hp = 0; e.dead = true; e.deathT = 0;
    e.buffs = []; e.order = null; e.target = null; e.path = null; e.channel = null;
    for (const o of G.world.entities) if (o.target === e) o.target = null;
    if (G.art) G.art.onDeath(e);

    if (e.kind === 'hero') {
      e.hs.dead = true;
      G.ui.toast(`${G.HEROES[e.heroId].name} has fallen!`, 'bad');
      G.audio.play('herodeath');
      return;
    }
    if (e.kind === 'structure') { G.events.structureDestroyed(e); return; }
    if (e.kind === 'summon') { G.fx.burst(e.x, e.y, e.def.accent, 14, 2); return; }
    if (e.team !== 'enemy') return;

    // Rewards
    const d = e.def;
    const lvl = e.level || d.level;
    if (d.xp && !e.noXp) G.game.partyKillXp(lvl, Math.round(d.xp * (e.xpMul || 1)));
    const gold = Math.round(U.rng(Date.now() + e.id).int(d.gold[0], d.gold[1]) * (e.goldMul || 1));
    if (gold > 0) { G.game.addGold(gold, true); G.fx.text(e.x, e.y - 0.2, '+' + gold, '#ffd54a', 13, 0.4, { coin: true }); }
    G.quests.onKill(e.defId);
    if (d.questDrop && G.quests.wants(d.questDrop.item) && Math.random() < d.questDrop.chance) {
      G.quests.onCollect(d.questDrop.item);
      G.fx.text(e.x, e.y, 'Pelt', '#e8c47a', 13, 0.7);
    }
    if (d.drops) for (const id of d.drops) G.world.dropLoot(id, e.x, e.y);
    if (d.boss && Math.random() < 0.5) G.world.dropLoot('phoenix_feather', e.x, e.y);
    else if (d.dropChance && Math.random() < d.dropChance) { const id = G.rollLoot(G.world.zoneId); if (id) G.world.dropLoot(id, e.x, e.y); }
    if (e.unique) { G.state.uniques[e.unique] = true; G.save.auto(); }
    G.world.onEnemyDeath(e);
    G.audio.play(d.boss ? 'bossdeath' : 'death');
    if (d.boss) G.fx.shake(0.5, 6);
  }

  return { tickBuffs, buff, stun, hostilesNear, alliesNear, dealDamage, heal, kill, targetable };
})();
