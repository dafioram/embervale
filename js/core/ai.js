/* Unit behaviour: orders for player units, creep AI for enemies, movement,
   attacking and casting. */
G.ai = (() => {
  const U = G.util;

  const valid = (t) => t && !t.dead && !t.removed && G.combat.targetable(t);
  const effAtkCd = (e) => e.atkCd / Math.max(0.2, 1 + ((e.mods && e.mods.atkSpeed) || 0));
  const effSpeed = (e) => e.speed * Math.max(0.2, 1 + ((e.mods && e.mods.moveMul) || 0));
  const edgeDist = (a, b) => U.dist(a, b) - a.r - b.r;
  const inRange = (e, t, extra = 0) => edgeDist(e, t) <= e.range + 0.15 + extra;

  // Sight check: walls and buildings block, trees don't.
  function los(x0, y0, x1, y1) {
    const g = G.world.grid;
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 0.4);
    for (let i = 1; i < n; i++) {
      const x = Math.floor(x0 + ((x1 - x0) * i) / n), y = Math.floor(y0 + ((y1 - y0) * i) / n);
      const b = g.block[y * g.w + x];
      if (b === G.B.BUILDING || b === G.B.FENCE || b === G.B.CAVEWALL || b === G.B.GATE) return false;
    }
    return true;
  }

  function acquire(e, r, opts = {}) {
    let best = null, bd = 1e9;
    for (const t of G.world.entities) {
      if (!G.combat.targetable(t) || t.team === e.team || t.team === 'neutral') continue;
      if (t.kind === 'structure' && !opts.structures) continue;
      if (t.returning) continue;
      const d = edgeDist(e, t);
      if (d > r || d >= bd) continue;
      if (!los(e.x, e.y, t.x, t.y)) continue;
      bd = d; best = t;
    }
    return best;
  }

  /* ---------- movement ---------- */
  function tryMove(e, nx, ny) {
    const g = G.world.grid;
    const ok = (x, y) => g.walk(Math.floor(x), Math.floor(y));
    if (ok(nx, ny)) { e.x = nx; e.y = ny; return true; }
    if (ok(nx, e.y)) { e.x = nx; return true; }
    if (ok(e.x, ny)) { e.y = ny; return true; }
    return false;
  }

  // Move toward a goal using direct steering when the line is clear, A* otherwise.
  // Returns true once within `stop` of the goal.
  function steer(e, gx, gy, dt, stop = 0.2) {
    const d = U.dist2(e.x, e.y, gx, gy);
    if (d <= stop) { e.path = null; return true; }
    if (effSpeed(e) <= 0) return false;
    let wx = gx, wy = gy;
    const direct = G.path.clearLine(G.world.grid, e.x, e.y, gx, gy);
    if (!direct) {
      e.repath = (e.repath || 0) - dt;
      if (!e.path || e.repath <= 0 || !e.pathGoal || U.dist2(e.pathGoal.x, e.pathGoal.y, gx, gy) > 1.2) {
        e.path = G.path.find(G.world.grid, e.x, e.y, gx, gy) || [];
        e.pathGoal = { x: gx, y: gy };
        e.repath = 1.0 + Math.random() * 0.4;
      }
      while (e.path.length && U.dist2(e.x, e.y, e.path[0].x, e.path[0].y) < 0.25) e.path.shift();
      if (e.path.length) { wx = e.path[0].x; wy = e.path[0].y; }
      else { e.order && e.order.type === 'move' && (e.order = null); return true; }
    } else e.path = null;
    const dd = U.dist2(e.x, e.y, wx, wy) || 1;
    const step = Math.min(dd, effSpeed(e) * dt);
    const ox = e.x, oy = e.y;
    tryMove(e, e.x + ((wx - e.x) / dd) * step, e.y + ((wy - e.y) / dd) * step);
    const moved = U.dist2(ox, oy, e.x, e.y);
    e.facing = Math.atan2(wy - oy, wx - ox);
    e.moving = moved > 0.001;
    // stuck detection
    if (moved < step * 0.2) { e.stuck = (e.stuck || 0) + dt; if (e.stuck > 0.5) { e.repath = 0; e.path = null; e.stuck = 0; if (direct) { e.path = G.path.find(G.world.grid, e.x, e.y, gx, gy) || []; e.pathGoal = { x: gx, y: gy }; } } }
    else e.stuck = 0;
    return false;
  }

  /* ---------- attacking ---------- */
  function face(e, t) { e.facing = Math.atan2(t.y - e.y, t.x - e.x); }

  function attack(e, t, dt, allowMove = true) {
    if (!valid(t)) return false;
    if (inRange(e, t)) {
      face(e, t);
      if (e.atkTimer <= 0) {
        e.swing = e.def.projectile || (e.kind === 'hero' && !e.def.melee) ? 0.22 : 0.3;
        e.swingDur = e.swing;
        e.swingTarget = t;
        e.atkTimer = effAtkCd(e);
      }
      return true;
    }
    if (allowMove) steer(e, t.x, t.y, dt, e.range + e.r + t.r);
    return true;
  }

  function resolveSwing(e) {
    const t = e.swingTarget;
    e.swingTarget = null;
    if (!valid(t) || !inRange(e, t, 1.2)) return;
    const dmg = e.dmg * (0.9 + Math.random() * 0.2);
    const spell = !!e.def.spell;
    const onHit = (tt) => {
      G.combat.dealDamage(e, tt, dmg, { spell });
      if (e.def.poison) G.combat.buff(tt, { id: 'poison', name: 'Poisoned', t: e.def.poison.t, dot: e.def.poison.dps, src: e, color: '#9be35a' });
      if (e.def.burn) G.combat.buff(tt, { id: 'burn', name: 'Burning', t: e.def.burn.t, dot: e.def.burn.dps * (e.level || 1), src: e, color: '#ff8a3d' });
      if (e.def.chill) G.combat.buff(tt, { id: 'chill', name: 'Chilled', t: 2, mods: { moveMul: -0.25 }, color: '#9fd8ff' });
    };
    const proj = e.def.projectile;
    if (proj) {
      G.fx.projectile({ from: e, to: t, ...proj, onHit });
      G.audio.play(proj.arrow ? 'bow' : 'cast', 0.5);
    } else {
      onHit(t);
      G.audio.play('hit', 0.45);
    }
  }

  /* ---------- casting ---------- */
  function doCast(e, o, dt) {
    const ab = G.ABILITIES[o.ability];
    const rank = e.hs.ranks[o.ability];
    const t = o.target;
    if (!(rank > 0) || ab.passive) { e.order = null; return; }
    if (ab.target === 'enemy' || ab.target === 'ally') {
      if (!t || t.dead || t.removed) { e.order = null; return; }
      if (U.dist(e, t) - t.r > ab.range) { steer(e, t.x, t.y, dt, ab.range * 0.9); return; }
    } else if (ab.target === 'point') {
      if (U.dist(e, t) > ab.range) { steer(e, t.x, t.y, dt, ab.range * 0.95); return; }
    }
    const mana = G.abilityValue(ab.mana, rank), cd = G.abilityValue(ab.cd, rank);
    if (e.mp < mana || (e.cd[o.ability] || 0) > 0) { e.order = null; return; }
    e.mp -= mana;
    e.cd[o.ability] = cd;
    e.cdMax = e.cdMax || {}; e.cdMax[o.ability] = cd;
    if (t && t !== e) face(e, t);
    e.castAnim = 0.35;
    // resume an attack or attack-move that the cast interrupted; otherwise stay here
    const after = o.after && (o.after.type !== 'attack' || valid(o.after.target)) ? o.after : null;
    e.order = after;
    e.guard = { x: e.x, y: e.y };
    if (!after && ab.target === 'enemy' && valid(t)) e.target = t;
    e.path = null;
    if (ab.channel) {
      e.channel = { t: ab.channel, dur: ab.channel, fn: () => ab.cast(e, t, rank, ab), name: ab.name };
      G.fx.ring(e.x, e.y, 0.8, ab.color, ab.channel);
    } else ab.cast(e, t, rank, ab);
  }

  /* ---------- per-unit update ---------- */
  function update(e, dt) {
    if (e.dead) return;
    e.anim += dt;
    e.moving = false;
    if (e.flash > 0) e.flash -= dt;
    if (e.castAnim > 0) e.castAnim -= dt;
    if (e.kind === 'hero') {
      // out of combat for a few seconds: recover faster so solo play doesn't stall
      const rest = G.state.playTime - G.world.lastCombat > 6 ? 0.018 : 0;
      e.hp = Math.min(e.maxHp, e.hp + (e.hpRegen + e.maxHp * rest) * dt);
      e.mp = Math.min(e.maxMp, e.mp + (e.mpRegen + e.maxMp * rest) * dt);
    }
    for (const k in e.cd) if (e.cd[k] > 0) e.cd[k] -= dt;
    e.atkTimer -= dt;
    if (e.spinning > 0) e.spinning -= dt;
    if (e.stunned) return;
    if (e.dash) return doDash(e, dt);
    if (e.channel) {
      e.channel.t -= dt;
      if (e.channel.t <= 0) { const fn = e.channel.fn; e.channel = null; fn(); }
      return;
    }
    if (e.swing > 0) { e.swing -= dt; if (e.swing <= 0) resolveSwing(e); return; }
    if (e.busy > 0) { e.busy -= dt; return; }
    if (e.kind === 'structure') return;
    if (e.team === 'enemy') enemyAI(e, dt);
    else playerAI(e, dt);
  }

  function doDash(e, dt) {
    const d = e.dash;
    d.t += dt;
    const t = d.target;
    if (!valid(t) || d.t > 1.2) { e.dash = null; return; }
    const dist = U.dist(e, t);
    face(e, t);
    if (dist <= e.r + t.r + 0.35) { e.dash = null; d.onArrive(); return; }
    const step = Math.min(dist, d.speed * dt);
    if (!tryMove(e, e.x + ((t.x - e.x) / dist) * step, e.y + ((t.y - e.y) / dist) * step)) { e.dash = null; d.onArrive(); return; }
    if (Math.random() < 0.6) G.fx.burst(e.x, e.y, '#e8c08a', 1, 0.5);
    e.moving = true;
  }

  function playerAI(e, dt) {
    const o = e.order;
    if (e.def.immobile) { // wards
      if (!valid(e.target) || !inRange(e, e.target)) e.target = acquire(e, e.range);
      if (e.target) attack(e, e.target, dt, false);
      return;
    }
    if (!o) {
      if (e.kind === 'summon' && e.owner) return summonAI(e, dt);
      // don't chase a creep that has given up and is running home
      if (valid(e.target) && e.target.returning) e.target = null;
      if (!valid(e.target)) {
        e.target = acquire(e, 5);
        // remember where this fight started, only to stop endless chases
        if (e.target) e.guard = { x: e.x, y: e.y };
      }
      if (e.target) {
        if (e.guard && U.dist(e.guard, e.target) > 9) { e.target = null; }
        else { attack(e, e.target, dt); return; }
      }
      // idle heroes stay where the fight ended instead of walking back
      e.guard = { x: e.x, y: e.y };
      return;
    }
    switch (o.type) {
      case 'move':
        if (steer(e, o.x, o.y, dt, 0.25)) { e.order = null; e.guard = { x: e.x, y: e.y }; e.target = null; }
        break;
      case 'amove': {
        if (!valid(e.target)) e.target = acquire(e, 5);
        if (e.target) attack(e, e.target, dt);
        else if (steer(e, o.x, o.y, dt, 0.4)) { e.order = null; e.guard = { x: e.x, y: e.y }; }
        break;
      }
      case 'attack':
        if (!valid(o.target)) { e.order = null; e.guard = { x: e.x, y: e.y }; break; }
        e.target = o.target;
        attack(e, o.target, dt);
        break;
      case 'hold':
        if (!valid(e.target) || !inRange(e, e.target)) e.target = acquire(e, e.range + 0.2);
        if (e.target) attack(e, e.target, dt, false);
        break;
      case 'cast':
        doCast(e, o, dt);
        break;
      case 'interact': {
        const t = o.target;
        if (!t || t.removed) { e.order = null; break; }
        const reach = t.kind === 'npc' ? 1.9 : t.kind === 'loot' ? 0.6 : 1.6;
        if (steer(e, t.x, t.y, dt, reach + (t.r || 0))) { e.order = null; e.guard = { x: e.x, y: e.y }; G.world.interact(e, t); }
        break;
      }
      default: e.order = null;
    }
  }

  function summonAI(e, dt) {
    const ow = e.owner;
    if (ow.dead) { e.owner = null; return; }
    const ownerTarget = ow.target && valid(ow.target) && U.dist(ow, ow.target) < 8 ? ow.target : null;
    if (ownerTarget) e.target = ownerTarget;
    if (!valid(e.target) || U.dist(e.target, ow) > 9) e.target = null;
    if (!e.target) { const t = acquire(e, 4.5); if (t && U.dist(t, ow) < 7) e.target = t; }
    if (e.target) { attack(e, e.target, dt); return; }
    if (U.dist(e, ow) > 2.6) steer(e, ow.x + Math.cos(ow.facing + 2.4) * 1.2, ow.y + Math.sin(ow.facing + 2.4) * 1.2, dt, 0.5);
  }

  function enemyAI(e, dt) {
    const d = e.def;
    if (e.returning) {
      e.target = null;
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.25 * dt);
      if (steer(e, e.home.x, e.home.y, dt, 0.4)) { e.returning = false; e.hp = e.maxHp; e.buffs = e.buffs.filter((b) => b.id !== 'enrage'); }
      return;
    }
    if (e.taunt) e.target = e.taunt;
    if (!valid(e.target)) {
      e.target = acquire(e, e.raid ? 4 : d.boss ? 5 : 5.2);
      if (e.target) alertCamp(e, e.target);
    } else {
      e.retarget = (e.retarget || 0) - dt;
      if (e.retarget <= 0 && !e.taunt) {
        e.retarget = 2.5;
        const n = acquire(e, 5);
        if (n && n !== e.target && edgeDist(e, n) + 2.5 < edgeDist(e, e.target)) e.target = n;
      }
    }
    if (e.raid && !e.target) {
      const mill = G.world.entities.find((x) => x.kind === 'structure' && !x.dead && !x.invuln);
      if (mill) { attack(e, mill, dt); return; }
    }
    if (e.target) {
      const leash = e.leash || 13;
      if (!e.raid && U.dist(e, e.home) > leash) { e.returning = true; e.target = null; e.path = null; return; }
      if (d.skills) runSkills(e, dt);
      if (e.busy > 0 || e.swing > 0) return;
      attack(e, e.target, dt);
      return;
    }
    // idle: occasional wander near home
    e.wander = (e.wander || Math.random() * 6) - dt;
    if (!e.raid && e.wander <= 0) {
      e.wander = 4 + Math.random() * 5;
      if (!d.boss) { const a = Math.random() * Math.PI * 2; e.wanderTo = { x: e.home.x + Math.cos(a) * 1.2, y: e.home.y + Math.sin(a) * 1.2 }; }
    }
    if (e.wanderTo) { const sp = e.speed; e.speed = sp * 0.4; if (steer(e, e.wanderTo.x, e.wanderTo.y, dt, 0.2)) e.wanderTo = null; e.speed = sp; }
    if (!e.raid && U.dist(e, e.home) > 3 && !e.wanderTo) steer(e, e.home.x, e.home.y, dt, 0.3);
    if (e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.05 * dt);
  }

  function runSkills(e, dt) {
    const skills = e.def.skills;
    e.skillCd = e.skillCd || skills.map((s) => s.first || s.cd || 0);
    e.triggered = e.triggered || {};
    for (let i = 0; i < skills.length; i++) {
      const s = skills[i];
      if (s.at) {
        if (!e.triggered[i] && e.hp / e.maxHp <= s.at) { e.triggered[i] = true; G.ENEMY_SKILLS[s.id](e, s); }
        continue;
      }
      e.skillCd[i] -= dt;
      if (e.skillCd[i] <= 0 && !(e.busy > 0)) {
        if (G.ENEMY_SKILLS[s.id](e, s)) { e.skillCd[i] = s.cd; return; }
        e.skillCd[i] = 1;
      }
    }
  }

  function alertCamp(e, src) {
    for (const o of G.world.entities) {
      if (o.dead || o.team !== 'enemy' || o === e || o.returning || valid(o.target)) continue;
      if ((e.campId && o.campId === e.campId) || U.dist(o, e) < 4) { o.target = src; }
    }
  }

  function onAttacked(tgt, src) {
    if (!G.combat.targetable(src)) return;
    if (tgt.team === 'enemy') {
      if (tgt.returning) return;
      if (!valid(tgt.target)) { tgt.target = src; alertCamp(tgt, src); }
    } else if ((tgt.kind === 'hero' || tgt.kind === 'summon') && !tgt.order && !valid(tgt.target) && src.team !== tgt.team) {
      tgt.target = src;
      tgt.guard = { x: tgt.x, y: tgt.y };
    }
  }

  return { update, steer, onAttacked, acquire, valid, inRange, effSpeed };
})();
