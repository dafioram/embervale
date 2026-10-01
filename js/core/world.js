/* The live zone: entities, spawning, camps, objects, loot, exits and timers. */
G.world = (() => {
  const U = G.util;
  const W = {
    zoneId: null, zone: null, grid: null, entities: [], timers: [], lastCombat: -99,
    campAlive: {}, lockedMsgT: 0, transitioning: false,
  };

  const zoneObjState = () => (G.state.objects[W.zoneId] = G.state.objects[W.zoneId] || {});
  const zoneCampState = () => (G.state.camps[W.zoneId] = G.state.camps[W.zoneId] || {});

  /* ---------- entity factories ---------- */
  function refreshHero(e) {
    const s = G.heroStats(e.hs);
    const ratioHp = e.maxHp ? e.hp / e.maxHp : 1;
    const ratioMp = e.maxMp ? e.mp / e.maxMp : 1;
    const hadMax = !!e.maxHp;
    Object.assign(e, { maxHp: s.maxHp, maxMp: s.maxMp, dmg: s.dmg, armor: s.armor, atkCd: s.atkCd, range: s.range, speed: s.speed, hpRegen: s.hpRegen, mpRegen: s.mpRegen, level: e.hs.level, stats: s });
    if (hadMax) { e.hp = Math.min(e.maxHp, ratioHp * e.maxHp); e.mp = Math.min(e.maxMp, ratioMp * e.maxMp); }
    // permanent evasion from items lives in mods via a hidden buff-like base
    e.baseEvasion = s.evasion;
  }

  function makeHero(hs, x, y) {
    const d = G.HEROES[hs.id];
    const e = { id: U.uid(), kind: 'hero', team: 'player', heroId: hs.id, hs, def: d, name: d.name, x, y, r: 0.42,
      buffs: [], cd: {}, cdMax: {}, atkTimer: 0, facing: Math.PI * 0.25, anim: Math.random() * 5, order: null, mods: {} };
    refreshHero(e);
    e.hp = hs.hp == null ? e.maxHp : U.clamp(hs.hp, 1, e.maxHp);
    e.mp = hs.mp == null ? e.maxMp : U.clamp(hs.mp, 0, e.maxMp);
    if (hs.dead) { hs.dead = false; e.hp = Math.max(e.hp, e.maxHp * 0.3); }
    if (hs.cd) { for (const k in hs.cd) e.cd[k] = hs.cd[k]; }
    return e;
  }

  function makeUnit(defId, x, y, opts = {}) {
    const d = G.UNITS[defId];
    const ov = opts.override || {};
    const e = {
      id: U.uid(), kind: d.structure ? 'structure' : d.summon ? 'summon' : 'enemy', team: opts.team || 'enemy',
      defId, def: d, name: d.name, x, y, r: d.r, level: d.level,
      maxHp: ov.hp || d.hp, dmg: ov.dmg || d.dmg, armor: d.armor, atkCd: d.atkCd, range: d.range, speed: d.speed,
      buffs: [], cd: {}, atkTimer: Math.random() * 0.5, facing: Math.random() * Math.PI * 2, anim: Math.random() * 5,
      home: { x, y }, order: null, mods: {}, owner: opts.owner || null, ttl: opts.ttl || 0,
    };
    e.hp = e.maxHp;
    if (d.summon && opts.level) e.level = opts.level;
    return e;
  }

  function add(e) { W.entities.push(e); return e; }

  function spawn(defId, x, y, opts = {}) {
    const p = G.path.nearestWalkable(W.grid, x, y, 4) || [Math.floor(x), Math.floor(y)];
    const px = W.grid.walk(Math.floor(x), Math.floor(y)) ? x : p[0] + 0.5;
    const py = W.grid.walk(Math.floor(x), Math.floor(y)) ? y : p[1] + 0.5;
    const e = add(makeUnit(defId, px, py, opts));
    if (opts.aggro) {
      const t = G.ai.acquire(e, 30);
      if (t) e.target = t;
    }
    if (opts.raid) e.raid = true;
    if (opts.noRespawn) e.noRespawn = true;
    return e;
  }
  function spawnNear(defId, x, y, rad, opts) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, d = rad * (0.5 + Math.random() * 0.5);
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      if (W.grid.walk(Math.floor(px), Math.floor(py)) && G.path.clearLine(W.grid, x, y, px, py)) return spawn(defId, px, py, opts);
    }
    return spawn(defId, x, y, opts);
  }

  function remove(e, fx) {
    e.removed = true; e.dead = true;
    if (fx) G.fx.burst(e.x, e.y, '#aaa', 10, 2);
  }

  /* ---------- zone loading ---------- */
  function syncHeroes() {
    for (const e of W.entities) if (e.kind === 'hero') {
      e.hs.hp = e.dead ? 0 : Math.round(e.hp);
      e.hs.mp = Math.round(e.mp);
      e.hs.dead = !!e.dead;
      e.hs.cd = {};
      for (const k in e.cd) if (e.cd[k] > 0) e.hs.cd[k] = Math.round(e.cd[k] * 10) / 10;
    }
  }

  function load(zoneId, entry, opts = {}) {
    if (!opts.fresh) syncHeroes();
    const Z = G.ZONES[zoneId];
    W.zoneId = zoneId; W.zone = Z;
    W.grid = G.genZone(zoneId, G.state.flags);
    W.entities = []; W.timers = []; W.campAlive = {}; W.lastCombat = -99;
    G.fx.clear();
    let pos = typeof entry === 'string' ? (Z.entries[entry] || Object.values(Z.entries)[0]) : entry;
    if (typeof entry !== 'string') {
      // a saved position must be somewhere the party can actually walk from the zone entrance
      const e0 = Object.values(Z.entries)[0];
      const seen = G.reachable(W.grid, e0[0], e0[1]);
      const c = pos && G.path.nearestWalkable(W.grid, pos[0], pos[1], 3);
      if (!c || !seen[c[1] * W.grid.w + c[0]]) pos = e0;
    }
    G.state.zone = zoneId;
    G.state.visited[zoneId] = true;

    // Heroes in a loose wedge behind the leader
    const offs = [[0, 0], [-0.9, 0.9], [0.9, -0.9]];
    G.state.party.forEach((hs, i) => {
      const [ox, oy] = offs[i] || [0, 0];
      let x = pos[0] + ox, y = pos[1] + oy;
      if (!W.grid.walk(Math.floor(x), Math.floor(y))) { const p = G.path.nearestWalkable(W.grid, x, y, 4); x = p[0] + 0.5; y = p[1] + 0.5; }
      add(makeHero(hs, x, y));
    });

    for (const s of Z.structures || []) {
      const e = add(makeUnit(s.unit, s.x, s.y, { team: 'player' }));
      e.invuln = true; e.structId = s.id; e.foot = s.foot;
    }
    refreshNpcs();
    for (const o of Z.objects) add({ id: U.uid(), kind: 'object', team: 'neutral', objId: o.id, objKind: o.kind, def: o, x: o.x, y: o.y, r: 0.45, anim: Math.random() * 5, buffs: [] });
    spawnCamps();
    G.render.buildZone(W.grid, Z);
    G.render.centerOn(heroes()[0] || { x: pos[0], y: pos[1] }, true);
    G.ui.onZoneLoaded(Z);
    G.input.onZoneLoaded();
  }

  function spawnCamps() {
    const cs = zoneCampState();
    for (const c of W.zone.camps) {
      if (c.unique && G.state.uniques[c.unique]) continue;
      if (cs[c.id] != null && G.state.playTime - cs[c.id] < G.CAMP_RESPAWN) continue;
      delete cs[c.id];
      const n = c.units.length;
      W.campAlive[c.id] = n;
      c.units.forEach((u, i) => {
        const a = (i / n) * Math.PI * 2 + 0.6;
        const rad = n === 1 ? 0 : 1.1;
        const e = spawn(u, c.x + Math.cos(a) * rad, c.y + Math.sin(a) * rad, { team: 'enemy' });
        e.campId = c.id;
        if (c.leash) e.leash = c.leash;
        if (c.unique && u === c.unique) e.unique = c.unique;
        e.facing = Math.atan2(c.y - e.y, c.x - e.x) + Math.PI;
      });
    }
  }

  function refreshNpcs() {
    W.entities = W.entities.filter((e) => e.kind !== 'npc');
    for (const n of W.zone.npcs) {
      if (n.flag && !G.state.flags[n.flag]) continue;
      const [nx, ny] = clearOfBuildings(n.x, n.y, 1.0);
      add({ id: U.uid(), kind: 'npc', team: 'neutral', npcId: n.id, def: G.NPCS[n.id], x: nx, y: ny, r: 0.42, anim: Math.random() * 5, facing: Math.PI / 4, buffs: [] });
    }
  }

  // Push a point out to at least `gap` tiles from any building footprint, so people
  // don't stand flush against (and visually inside) walls.
  function clearOfBuildings(x, y, gap) {
    for (const p of W.grid.props) {
      if (p.kind !== 'building') continue;
      const cx = U.clamp(x, p.x, p.x + p.w), cy = U.clamp(y, p.y, p.y + p.h);
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
      if (d >= gap) continue;
      if (d < 1e-6) continue;
      x = cx + (dx / d) * gap; y = cy + (dy / d) * gap;
    }
    return [x, y];
  }

  function onEnemyDeath(e) {
    if (!e.campId || W.campAlive[e.campId] == null) return;
    W.campAlive[e.campId]--;
    if (W.campAlive[e.campId] <= 0) zoneCampState()[e.campId] = G.state.playTime;
  }
  const campCleared = (id) => !(W.campAlive[id] > 0);

  /* ---------- helpers used by abilities ---------- */
  function after(t, fn) { W.timers.push({ t, fn }); }
  function dashTo(e, target, speed, onArrive) { e.dash = { target, speed, onArrive, t: 0 }; e.path = null; }
  function blinkTo(e, x, y) {
    // walk the line and stop at the last clear point, so you can't blink through walls
    const d = U.dist2(e.x, e.y, x, y), n = Math.max(1, Math.ceil(d / 0.25));
    let bx = e.x, by = e.y;
    for (let i = 1; i <= n; i++) {
      const px = e.x + ((x - e.x) * i) / n, py = e.y + ((y - e.y) * i) / n;
      if (!W.grid.walk(Math.floor(px), Math.floor(py))) break;
      bx = px; by = py;
    }
    e.x = bx; e.y = by; e.path = null; e.order = null; e.guard = { x: bx, y: by };
  }
  function reviveHero(e, frac) {
    e.dead = false; e.hs.dead = false; e.hp = e.maxHp * frac; e.deathT = 0; e.buffs = []; e.order = null; e.target = null;
  }

  /* ---------- objects, interaction, loot ---------- */
  function dropLoot(itemId, x, y) {
    const a = Math.random() * Math.PI * 2;
    let px = x + Math.cos(a) * 0.5, py = y + Math.sin(a) * 0.5;
    if (!W.grid.walk(Math.floor(px), Math.floor(py))) { px = x; py = y; }
    add({ id: U.uid(), kind: 'loot', team: 'neutral', itemId, x: px, y: py, r: 0.3, anim: 0, buffs: [] });
  }

  function objUsed(o) { const s = zoneObjState()[o.objId]; return s != null; }
  function objVisible(o) {
    const s = zoneObjState()[o.objId];
    if (o.objKind === 'grain') return s == null;
    if (o.objKind === 'glowcap') return s == null || G.state.playTime - s > (o.def.respawn || 150);
    return true;
  }

  function interact(hero, t) {
    if (t.kind === 'npc') { t.facing = Math.atan2(hero.y - t.y, hero.x - t.x); G.quests.talk(t.npcId); return; }
    if (t.kind === 'loot') { pickupLoot(hero, t); return; }
    if (t.kind !== 'object') return;
    const o = t.def, os = zoneObjState();
    switch (t.objKind) {
      case 'waystone':
        if (!G.state.waystones[o.id]) { G.state.waystones[o.id] = true; G.ui.toast(`Waystone attuned: ${G.WAYSTONES[o.id].name}`, 'quest'); G.audio.play('quest'); }
        G.ui.openWaystone(o.id);
        break;
      case 'cage': case 'cocoon': case 'seal': {
        if (os[o.id] != null) { G.ui.toast(t.objKind === 'seal' ? 'Only cold glass remains.' : 'Empty now.'); break; }
        if (o.requiresCamp && !campCleared(o.requiresCamp)) {
          G.ui.toast(t.objKind === 'cage' ? 'Deal with the guards first.' : t.objKind === 'cocoon' ? 'The spiders guarding it are still about.' : 'The seal’s guardians still stand.', 'bad');
          break;
        }
        if (t.objKind === 'seal' && !G.quests.isActive('barrows')) { G.ui.toast('The seal hums with heat. You don’t know how to break it yet.'); break; }
        os[o.id] = G.state.playTime;
        if (t.objKind === 'cage' && !G.quests.isActive('missing_shaman')) G.quests.accept('missing_shaman');
        if (t.objKind === 'cocoon' && !G.quests.isActive('webbed_peddler')) { G.state.quests.webbed_peddler = { s: 'active', p: [0] }; }
        G.fx.burst(t.x, t.y, t.objKind === 'seal' ? '#ff8a2a' : '#e9e2d0', 30, 3);
        G.audio.play(t.objKind === 'seal' ? 'shatter' : 'open');
        G.quests.onInteract({ id: o.id, kind: t.objKind });
        if (t.objKind === 'seal') {
          const broken = ['seal_a', 'seal_b', 'seal_c'].filter((s) => os[s] != null).length;
          G.ui.toast(`Ember seal shattered (${broken}/3)`, 'quest');
          if (broken >= 3) {
            G.state.flags.sealsBroken = true;
            W.grid.setGate('sealsBroken', true);
            G.fx.shake(0.6, 6);
            G.ui.toast('Somewhere deep in the barrow, a gate of ember-glass cracks apart.', 'quest');
          }
        }
        break;
      }
      case 'grain': case 'glowcap':
        if (!G.quests.wants(t.objKind)) { G.ui.toast(t.objKind === 'grain' ? 'A sack of someone’s grain.' : 'A softly glowing mushroom. Someone might want these.'); break; }
        os[o.id] = G.state.playTime;
        G.quests.onCollect(t.objKind);
        G.fx.burst(t.x, t.y, t.objKind === 'grain' ? '#e8d08a' : '#9fffd9', 12, 2);
        G.audio.play('pickup');
        break;
      case 'chest':
        if (os[o.id] != null) { G.ui.toast('Empty.'); break; }
        if (o.requiresCamp && !campCleared(o.requiresCamp)) { G.ui.toast('Something is guarding this chest.', 'bad'); break; }
        os[o.id] = G.state.playTime;
        if (o.gold) { G.game.addGold(o.gold); G.fx.text(t.x, t.y, '+' + o.gold + 'g', '#ffd54a', 15); }
        if (o.item) dropLoot(o.item, t.x + 0.6, t.y + 0.6);
        G.fx.burst(t.x, t.y, '#ffd54a', 20, 2.5);
        G.audio.play('open');
        break;
      case 'wagon': G.ui.toast('Hesk’s overturned wagon. Grain everywhere.'); break;
      case 'tent': G.ui.toast('A bandit tent. It smells of smoke and old socks.'); break;
    }
  }

  function pickupLoot(hero, l) {
    if (l.removed) return;
    const it = G.ITEMS[l.itemId];
    const where = G.game.giveItemTo(hero.hs, l.itemId, 1);
    if (!where) { G.ui.toast('Inventory and pack are full.', 'bad'); return; }
    G.ui.toast(`${G.HEROES[hero.heroId].name.split(' ')[0]} picked up ${it.name}${where === 'pack' ? ' (to pack)' : ''}`);
    G.audio.play('pickup');
    remove(l);
  }

  /* ---------- per-frame update ---------- */
  const heroes = () => W.entities.filter((e) => e.kind === 'hero');

  function update(dt) {
    for (let i = W.timers.length - 1; i >= 0; i--) {
      const t = W.timers[i];
      t.t -= dt;
      if (t.t <= 0) { W.timers.splice(i, 1); t.fn(); }
    }
    const ents = W.entities;
    for (const e of ents) {
      if (e.kind === 'npc' || e.kind === 'object' || e.kind === 'loot') { e.anim += dt; continue; }
      if (e.dead) { e.deathT = (e.deathT || 0) + dt; continue; }
      G.combat.tickBuffs(e, dt);
      if (e.baseEvasion) e.mods.evasion += e.baseEvasion;
      G.ai.update(e, dt);
      if (e.ttl > 0) { e.ttl -= dt; if (e.ttl <= 0) { e.dead = true; e.deathT = 0; G.fx.burst(e.x, e.y, e.def.accent, 12, 2); } }
    }
    separate();
    // remove old corpses
    W.entities = ents.filter((e) => !e.removed && !(e.dead && e.kind !== 'hero' && e.kind !== 'structure' && e.deathT > (e.kind === 'summon' ? 0.6 : 3)));

    // loot auto-pickup when walking over it
    for (const l of W.entities) if (l.kind === 'loot' && !l.removed) {
      for (const h of heroes()) if (!h.dead && U.dist(h, l) < 0.7) { pickupLoot(h, l); break; }
    }

    checkExits(dt);
    checkParty();
    attuneWaystones();
  }

  // Walking near a waystone attunes it, so fast travel doesn't depend on clicking every one.
  function attuneWaystones() {
    for (const o of W.entities) {
      if (o.objKind !== 'waystone' || G.state.waystones[o.objId]) continue;
      if (heroes().some((h) => !h.dead && U.dist(h, o) < 4.5)) {
        G.state.waystones[o.objId] = true;
        G.ui.toast(`Waystone attuned: ${G.WAYSTONES[o.objId].name}. Use any waystone to travel here.`, 'quest');
        G.fx.ring(o.x, o.y, 2, '#7fe3ff', 0.8, true);
        G.audio.play('quest');
      }
    }
  }

  function separate() {
    const movers = W.entities.filter((e) => !e.dead && (e.kind === 'hero' || e.kind === 'enemy' || e.kind === 'summon' || e.kind === 'npc'));
    for (let i = 0; i < movers.length; i++) for (let j = i + 1; j < movers.length; j++) {
      const a = movers[i], b = movers[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const min = (a.r + b.r) * 0.85;
      if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
      const d = Math.hypot(dx, dy) || 0.01;
      if (d >= min) continue;
      const push = (min - d) * 0.5;
      const nx = dx / d, ny = dy / d;
      const aFixed = a.kind === 'npc' || a.def.immobile || a.dash;
      const bFixed = b.kind === 'npc' || b.def.immobile || b.dash;
      if (!aFixed) nudge(a, -nx * push * (bFixed ? 2 : 1), -ny * push * (bFixed ? 2 : 1));
      if (!bFixed) nudge(b, nx * push * (aFixed ? 2 : 1), ny * push * (aFixed ? 2 : 1));
    }
  }
  function nudge(e, dx, dy) {
    const nx = e.x + dx, ny = e.y + dy;
    if (W.grid.walk(Math.floor(nx), Math.floor(ny))) { e.x = nx; e.y = ny; }
  }

  function checkExits(dt) {
    if (W.transitioning) return;
    W.lockedMsgT -= dt;
    for (const x of W.zone.exits) {
      for (const h of heroes()) {
        if (h.dead) continue;
        const d = U.dist2(h.x, h.y, x.x, x.y);
        if (x.flag && !G.state.flags[x.flag]) {
          if (d < x.r + 2.2 && W.lockedMsgT <= 0) { G.ui.toast(x.locked, 'bad'); W.lockedMsgT = 6; }
          continue;
        }
        if (d < x.r) { G.game.changeZone(x.to, x.entry); return; }
      }
    }
  }

  function checkParty() {
    const hs = heroes();
    if (!hs.length) return;
    const alive = hs.filter((h) => !h.dead);
    if (!alive.length) { G.game.wipe(); return; }
    if (alive.length < hs.length && G.state.playTime - W.lastCombat > 8) {
      for (const h of hs) if (h.dead) {
        const near = alive[0];
        const p = G.path.nearestWalkable(W.grid, near.x - 0.8, near.y + 0.8, 3);
        h.x = p ? p[0] + 0.5 : near.x; h.y = p ? p[1] + 0.5 : near.y;
        reviveHero(h, 0.3);
        G.fx.burst(h.x, h.y, '#fff3b0', 24, 2, -1.5);
        G.ui.toast(`${G.HEROES[h.heroId].name} gets back up.`);
      }
    }
  }

  Object.assign(W, { load, spawn, spawnNear, remove, after, dashTo, blinkTo, reviveHero, refreshNpcs, refreshHero, dropLoot, interact,
    update, heroes, syncHeroes, onEnemyDeath, campCleared, objUsed, objVisible, makeHero, add });
  return W;
})();

G.CAMP_RESPAWN = 90; // seconds of play before a cleared camp returns (on zone re-entry)
