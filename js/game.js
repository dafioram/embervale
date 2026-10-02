/* Game state, main loop, party management and scripted events. */
G.freshState = () => ({
  version: 1, zone: 'hollowmere', pos: null,
  party: [], gold: 0, pack: [], quests: {}, flags: {}, camps: {}, objects: {}, uniques: {},
  waystones: {}, visited: {}, explored: {}, tomesBought: {}, playTime: 0, kills: 0, actDone: false,
});
G.partyLevel = () => (G.state && G.state.party.length ? Math.max(...G.state.party.map((h) => h.level)) : 1);

G.game = (() => {
  const Gm = { running: false, paused: false, wiping: false };
  let last = 0, autoT = 0;

  /* ---------- lifecycle ---------- */
  function newGame() {
    G.state = G.freshState();
    const m = G.newHeroState('maren');
    m.items[0] = { id: 'healing_draught', n: 2 };
    m.items[1] = { id: 'hearth_scroll', n: 1 };
    G.state.party.push(m);
    G.state.gold = 60;
    G.state.waystones.ws_town = true;
    start('hollowmere', 'start');
    G.input.select(['maren']);
    setTimeout(() => {
      G.ui.dialogSeq([
        { who: 'narrator', text: 'Twelve years ago the mountain above the Vale split open. Ash fell for a season. They called it the Cinderfall.' },
        { who: 'narrator', text: 'Maren Ashvow was a warden then. She failed to hold her post, and she left. Now a letter has called her home: the mountain is stirring again.' },
        { who: 'maren', text: 'Hollowmere. Smaller than I remember. Elder Odrin should be by his hall, west of the square.' },
      ], () => G.ui.showHelp(true));
    }, 400);
  }

  function loadState(s) {
    G.state = s;
    start(s.zone, s.pos || Object.values(G.ZONES[s.zone].entries)[0]);
    G.input.select(G.state.party.map((h) => h.id), G.state.party[0].id);
    G.ui.toast(`Welcome back. ${G.ZONES[s.zone].name}.`);
  }

  function start(zone, entry) {
    G.events.reset();
    Gm.running = true; Gm.paused = false; Gm.wiping = false;
    G.ui.showGame();
    G.world.load(zone, entry);
    G.ui.refreshAll();
  }

  function quitToTitle() {
    Gm.running = false;
    G.events.reset();
    G.ui.showTitle();
  }

  /* ---------- party ---------- */
  function recruit(id) {
    if (G.state.party.some((h) => h.id === id)) return;
    const hs = G.newHeroState(id, G.partyLevel());
    if (id === 'tobin') hs.items[0] = { id: 'mana_tonic', n: 2 };
    if (id === 'ysolde') hs.items[0] = { id: 'healing_draught', n: 2 };
    G.state.party.push(hs);
    const lead = G.input.activeHero();
    const p = G.path.nearestWalkable(G.world.grid, lead.x + 1, lead.y + 1, 4);
    const e = G.world.add(G.world.makeHero(hs, p[0] + 0.5, p[1] + 0.5));
    G.fx.burst(e.x, e.y, '#fff3b0', 30, 2.5, -1.5);
    G.input.select(G.state.party.map((h) => h.id), G.input.activeId);
    G.ui.toast(`${G.HEROES[id].name} joins the party! (${hs.skillPoints} skill points to spend)`, 'done');
    G.audio.play('complete');
    G.ui.refreshAll();
  }

  function onLevels(hs, n) {
    if (!n) return;
    const e = G.input.heroEnt(hs.id);
    if (e) {
      G.world.refreshHero(e);
      if (!e.dead) { e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.25); G.fx.burst(e.x, e.y, '#ffe9a0', 36, 3, -2.5); G.fx.ring(e.x, e.y, 1.6, '#ffe9a0', 0.8, true); }
    }
    G.ui.toast(`${G.HEROES[hs.id].name} reached level ${hs.level}!`, 'level');
    G.audio.play('levelup');
  }
  function partyXp(amount) {
    for (const hs of G.state.party) onLevels(hs, G.grantXp(hs, amount));
    G.ui.refreshAll();
  }
  function partyKillXp(lvl, base) {
    G.state.kills++;
    for (const hs of G.state.party) onLevels(hs, G.grantXp(hs, G.xpFromKill(hs.level, lvl, base)));
    G.ui.dirty = true;
  }

  function addGold(n, silent) {
    G.state.gold += n;
    if (!silent) G.audio.play('coin');
    G.ui.dirty = true;
  }

  // Put an item in a hero's bag, stacking consumables; overflow goes to the pack.
  function giveItemTo(hs, id, n = 1) {
    const it = G.ITEMS[id];
    const stack = it.stack || (it.kind === 'tome' ? 10 : 1);
    let left = n;
    if (stack > 1) for (const s of hs.items) if (s && s.id === id && s.n < stack) { const k = Math.min(left, stack - s.n); s.n += k; left -= k; if (!left) break; }
    while (left > 0) {
      const i = hs.items.findIndex((s) => !s);
      if (i < 0) break;
      const k = Math.min(left, stack);
      hs.items[i] = { id, n: k }; left -= k;
    }
    let where = left < n ? 'hero' : null;
    while (left > 0) {
      const ps = stack > 1 ? G.state.pack.find((s) => s.id === id && s.n < stack) : null;
      if (ps) { const k = Math.min(left, stack - ps.n); ps.n += k; left -= k; continue; }
      if (G.state.pack.length >= 24) break;
      const k = Math.min(left, stack);
      G.state.pack.push({ id, n: k }); left -= k; where = where || 'pack';
    }
    const e = G.input.heroEnt(hs.id);
    if (e) G.world.refreshHero(e);
    G.ui.dirty = true;
    return left === 0 ? where || 'hero' : left < n ? where : null;
  }
  function giveItem(id, n = 1) {
    const h = G.input.activeHero();
    const order = [h ? h.hs : null, ...G.state.party].filter(Boolean);
    const where = giveItemTo(order[0], id, n);
    if (where) G.ui.toast(`Received ${G.ITEMS[id].name}${n > 1 ? ' ×' + n : ''}${where === 'pack' ? ' (in pack)' : ''}`);
    else G.ui.toast('No room for the reward: inventory and pack are full!', 'bad');
  }

  function readTome(hs, id) {
    const t = G.ITEMS[id].tome;
    if (t.str) hs.bonus.str += t.str;
    if (t.agi) hs.bonus.agi += t.agi;
    if (t.int) hs.bonus.int += t.int;
    if (t.hp) hs.bonus.hp += t.hp;
    const e = G.input.heroEnt(hs.id);
    if (e) { G.world.refreshHero(e); G.fx.burst(e.x, e.y, G.ITEMS[id].color, 24, 2, -2); }
    G.ui.toast(`${G.HEROES[hs.id].name.split(' ')[0]} reads the ${G.ITEMS[id].name}. ${G.ITEMS[id].desc}`, 'level');
    G.audio.play('quest');
    if (t.xp) onLevels(hs, G.grantXp(hs, t.xp));
    G.ui.refreshAll();
  }

  function useItem(e, slot) {
    if (!e || e.dead) return;
    const hs = e.hs, s = hs.items[slot];
    if (!s) return;
    const it = G.ITEMS[s.id];
    if (it.kind === 'equip') { G.ui.toast(`${it.name} works while carried.`); return; }
    if ((e.itemCd || 0) > G.state.playTime) return;
    let used = false;
    if (it.kind === 'tome') { readTome(hs, s.id); used = true; }
    else if (it.use) used = !!it.use(e);
    if (!used) { if (it.use && s.id.includes('heal') && e.hp >= e.maxHp) G.ui.toast('Already at full health.'); return; }
    e.itemCd = G.state.playTime + 0.4;
    s.n--;
    if (s.n <= 0) hs.items[slot] = null;
    G.ui.dirty = true;
  }

  function learn(hs, abId) {
    if (!G.canLearn(hs, abId)) {
      const ab = G.ABILITIES[abId], r = hs.ranks[abId];
      if (hs.skillPoints <= 0) G.ui.toast('No skill points to spend.', 'bad');
      else if (r >= ab.maxRank) G.ui.toast(`${ab.name} is at max rank.`, 'bad');
      else G.ui.toast(`${ab.name} rank ${r + 1} needs level ${G.abilityReqLevel(abId, r + 1)}.`, 'bad');
      G.audio.play('error');
      return;
    }
    hs.ranks[abId]++; hs.skillPoints--;
    if (G.ABILITIES[abId].passive) { const e = G.input.heroEnt(hs.id); if (e) G.world.refreshHero(e); }
    G.audio.play('quest');
    G.ui.toast(`${G.ABILITIES[abId].name} is now rank ${hs.ranks[abId]}.`);
    G.ui.refreshAll();
  }

  function startHearth(h) {
    if (G.world.zoneId === 'hollowmere') { G.ui.toast('You’re already in Hollowmere.'); return false; }
    h.channel = { t: 3, dur: 3, name: 'Hearth Scroll', fn: () => changeZone('hollowmere', 'hearth') };
    h.order = null;
    G.ui.toast('The hearth scroll begins to glow…');
    G.fx.ring(h.x, h.y, 2, '#ffd27a', 3);
    G.audio.play('summon');
    return true;
  }

  function changeZone(to, entry) {
    if (G.world.transitioning) return;
    if (G.events.active) G.events.fail('The raiders burn the mill while you are away.');
    G.world.transitioning = true;
    G.ui.fade(true, () => {
      G.world.load(to, entry);
      G.world.transitioning = false;
      G.save.auto();
      G.ui.fade(false);
    });
  }

  function travel(wsId) {
    const ws = G.WAYSTONES[wsId];
    const o = G.ZONES[ws.zone].objects.find((x) => x.id === wsId);
    changeZone(ws.zone, [o.x + 1.2, o.y + 1.4]);
  }

  function restParty() {
    for (const e of G.world.heroes()) {
      if (e.dead) G.world.reviveHero(e, 1, false);
      e.hp = e.maxHp; e.mp = e.maxMp;
      e.buffs = e.buffs.filter((b) => b.good);
      G.fx.burst(e.x, e.y, '#b6ffca', 14, 2, -1.5);
    }
    G.audio.play('heal');
  }

  function wipe() {
    if (Gm.wiping) return;
    Gm.wiping = true;
    if (G.events.active) G.events.fail('With its defenders fallen, the mill is overrun.');
    setTimeout(() => G.ui.showWipe(() => {
      for (const hs of G.state.party) { hs.dead = false; hs.hp = null; hs.mp = null; }
      Gm.wiping = false;
      G.world.load('hollowmere', 'hearth', { fresh: true });
      G.save.auto();
    }), 1200);
  }

  function actComplete() {
    G.state.actDone = true;
    G.save.auto();
    setTimeout(() => G.ui.showActComplete(), 600);
  }

  function togglePause() { Gm.paused = !Gm.paused; G.ui.setPaused(Gm.paused); }

  /* ---------- main loop ---------- */
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    G.gamepad.poll(dt);
    try { G.music.update(dt); } catch (e) { /* music is best-effort */ }
    const live = Gm.running && !Gm.paused && !G.ui.modal() && !G.world.transitioning;
    if (live) {
      G.state.playTime += dt;
      G.world.update(dt);
      G.fx.update(dt);
      G.events.update(dt);
      autoT += dt;
      if (autoT > 60) { autoT = 0; G.save.auto(); }
    }
    if (Gm.running) {
      G.input.update(dt);
      G.render.draw(live ? dt : 0);
      G.ui.update(dt);
    }
    fpsMeter(now);
    requestAnimationFrame(frame);
  }

  /* Frame-rate readout, shown when Settings → Show FPS is ticked. Reports the
     average over half a second plus the slowest frame in that window. */
  const fpsS = { n: 0, t0: 0, prev: 0, worst: 0, el: null, on: false };
  function fpsMeter(now) {
    const on = !!G.settings.showFps && Gm.running;
    if (!fpsS.el) fpsS.el = document.getElementById('fps');
    if (on !== fpsS.on) { fpsS.on = on; fpsS.el.classList.toggle('hidden', !on); fpsS.n = 0; fpsS.t0 = now; fpsS.worst = 0; }
    if (!on) { fpsS.prev = now; return; }
    const ft = now - (fpsS.prev || now); fpsS.prev = now;
    fpsS.n++; fpsS.worst = Math.max(fpsS.worst, ft);
    if (now - fpsS.t0 >= 500) {
      const fps = (fpsS.n * 1000) / (now - fpsS.t0);
      fpsS.el.textContent = `${fps.toFixed(0)} fps  ${(1000 / fps).toFixed(1)} ms  (slowest ${fpsS.worst.toFixed(0)} ms)`;
      fpsS.n = 0; fpsS.t0 = now; fpsS.worst = 0;
    }
  }

  function boot() {
    G.render.init(document.getElementById('view'));
    G.input.init(document.getElementById('view'));
    G.ui.init();
    G.ui.showTitle();
    requestAnimationFrame((t) => { last = t; frame(t); });
  }

  return Object.assign(Gm, { boot, newGame, loadState, quitToTitle, recruit, partyXp, partyKillXp, addGold, giveItem, giveItemTo, readTome, useItem, learn,
    startHearth, changeZone, travel, restParty, wipe, actComplete, togglePause });
})();

/* ---------- Scripted events (the mill defense) ---------- */
G.events = (() => {
  const E = { active: null };
  const WAVES = [
    ['cinderling', 'cinderling', 'cinderling', 'cinderling', 'cinderling'],
    ['cinderling', 'cinderling', 'cinderling', 'ash_zealot', 'ash_zealot'],
    ['cinder_brute', 'ash_zealot', 'ash_zealot', 'cinderling', 'cinderling'],
  ];
  const SPAWN = [40, 6];

  E.reset = () => { E.active = null; G.ui && G.ui.setEvent && G.ui.setEvent(null); };

  E.startMill = () => {
    if (G.world.zoneId !== 'brindle') return;
    const mill = G.world.entities.find((e) => e.structId === 'mill');
    mill.invuln = false; mill.dead = false; mill.hp = mill.maxHp;
    E.active = { type: 'mill', wave: 0, t: 6, mill, units: [], spawning: false };
    G.ui.toast('Raiders are coming down the barrow road! The first wave arrives shortly.', 'bad');
    G.ui.setEvent(E.active);
  };

  function spawnWave(i) {
    const a = E.active;
    a.units = [];
    WAVES[i].forEach((u, k) => {
      G.world.after(k * 0.6, () => {
        if (E.active !== a) return;
        const e = G.world.spawnNear(u, SPAWN[0], SPAWN[1], 2, { team: 'enemy', raid: true, noRespawn: true });
        e.level = G.UNITS[u].level;
        a.units.push(e);
      });
    });
    a.pending = WAVES[i].length;
    G.ui.toast(`Wave ${i + 1} of ${WAVES.length}!`, 'bad');
    G.audio.play('roar');
  }

  E.update = (dt) => {
    const a = E.active;
    if (!a) return;
    if (a.t > 0) {
      a.t -= dt;
      if (a.t <= 0) { spawnWave(a.wave); a.waveLive = true; }
      G.ui.setEvent(a);
      return;
    }
    if (a.waveLive) {
      a.waveT = (a.waveT || 0) + dt;
      // stragglers that lost their way come looking for the heroes instead
      if (a.waveT > 40) for (const u of a.units) if (!u.dead && !G.ai.valid(u.target)) { const hs = G.world.heroes().filter((x) => !x.dead); if (hs.length) u.target = hs[0]; }
    }
    if (a.waveLive && a.units.length >= a.pending && a.units.every((u) => u.dead)) {
      a.waveT = 0;
      a.waveLive = false;
      a.wave++;
      if (a.wave >= WAVES.length) return succeed();
      a.t = 12;
      G.ui.toast(`Wave cleared. The next comes in a few seconds…`);
    }
    G.ui.setEvent(a);
  };

  function succeed() {
    const a = E.active;
    a.mill.invuln = true;
    E.active = null;
    G.ui.setEvent(null);
    G.state.flags.millSaved = true;
    G.quests.onFlag('millSaved');
  }

  E.fail = (msg) => {
    const a = E.active;
    if (!a) return;
    E.active = null;
    G.ui.setEvent(null);
    for (const u of a.units) if (!u.dead) G.world.remove(u);
    if (a.mill) { a.mill.dead = false; a.mill.hp = a.mill.maxHp; a.mill.invuln = true; }
    G.quests.reset('hold_mill');
    G.ui.toast(`${msg} Talk to Ovan to try again.`, 'bad');
  };

  E.structureDestroyed = (e) => {
    if (E.active && e === E.active.mill) {
      G.fx.burst(e.x, e.y, '#ff8a2a', 60, 5); G.fx.shake(0.6, 6);
      E.fail('The mill has fallen!');
    }
  };

  return E;
})();
