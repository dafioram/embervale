/* Mouse + keyboard controls (classic RTS-RPG scheme). */
G.input = (() => {
  const U = G.util;
  const I = {
    selIds: ['maren'], activeId: 'maren', selected: [], hover: null,
    mouse: { x: 0, y: 0, inside: false }, mouseWorld: { x: 0, y: 0 },
    targeting: null, aMove: false, drag: null, marker: null, keys: {}, previewAbility: null, attackTarget: null,
    lastF: { id: null, t: 0 },
  };
  let canvas;

  const heroEnt = (id) => G.world.entities.find((e) => e.kind === 'hero' && e.heroId === id);
  I.activeHero = () => heroEnt(I.activeId) || G.world.entities.find((e) => e.kind === 'hero');
  const liveSelected = () => I.selected.filter((e) => !e.dead);

  function refreshSelection() {
    const party = G.state ? G.state.party.map((h) => h.id) : [];
    I.selIds = I.selIds.filter((id) => party.includes(id));
    if (!I.selIds.length && party.length) I.selIds = [party[0]];
    if (!I.selIds.includes(I.activeId)) I.activeId = I.selIds[0];
    I.selected = I.selIds.map(heroEnt).filter(Boolean);
  }
  I.onZoneLoaded = () => { I.targeting = null; I.aMove = false; I.hover = null; refreshSelection(); };
  I.select = (ids, active) => { I.selIds = ids.slice(); I.activeId = active || ids[0]; refreshSelection(); G.ui.refreshAll(); G.audio.play('click', 0.3); };
  I.selectAll = () => I.select(G.state.party.map((h) => h.id), I.activeId);
  I.cycleActive = () => {
    if (I.selIds.length < 2) { const ids = G.state.party.map((h) => h.id); const i = ids.indexOf(I.activeId); I.select([ids[(i + 1) % ids.length]]); return; }
    const i = I.selIds.indexOf(I.activeId);
    I.activeId = I.selIds[(i + 1) % I.selIds.length];
    refreshSelection(); G.ui.refreshAll();
  };

  /* ---------- orders ---------- */
  const formation = [[0, 0], [-0.9, 0.8], [0.8, -0.9], [-1.4, -0.4]];
  function moveOrder(units, x, y, attack) {
    units.forEach((e, i) => {
      let [ox, oy] = units.length > 1 ? formation[i % formation.length] : [0, 0];
      let tx = x + ox, ty = y + oy;
      if (!G.world.grid.walk(Math.floor(tx), Math.floor(ty))) { tx = x; ty = y; }
      e.order = { type: attack ? 'amove' : 'move', x: tx, y: ty };
      e.target = null; e.path = null; e.wanderTo = null;
    });
    I.marker = { x, y, t: 0.6, attack };
  }
  function attackOrder(units, t) {
    for (const e of units) { e.order = { type: 'attack', target: t }; e.path = null; }
    I.attackTarget = t; setTimeout(() => { if (I.attackTarget === t) I.attackTarget = null; }, 500);
    I.marker = { x: t.x, y: t.y, t: 0.6, attack: true };
  }
  function interactOrder(hero, t) {
    hero.order = { type: 'interact', target: t };
    hero.path = null;
    const others = liveSelected().filter((e) => e !== hero);
    if (others.length && t.kind !== 'loot') moveOrder(others, t.x + 1.2, t.y + 1.2);
  }
  I.stop = () => { for (const e of liveSelected()) { e.order = null; e.target = null; e.path = null; e.guard = { x: e.x, y: e.y }; } };
  I.hold = () => { for (const e of liveSelected()) { e.order = { type: 'hold' }; e.target = null; e.path = null; } };

  function smartOrder(sx, sy) {
    const units = liveSelected();
    if (!units.length) return;
    const t = G.render.pick(sx, sy);
    const w = G.render.toWorld(sx, sy);
    if (t && t.team === 'enemy' && !t.dead) { attackOrder(units, t); G.audio.play('click', 0.3); return; }
    if (t && (t.kind === 'npc' || t.kind === 'object' || t.kind === 'loot')) {
      const h = I.activeHero();
      if (h && !h.dead) interactOrder(h, t);
      return;
    }
    moveOrder(units, w.x, w.y, false);
  }

  /* ---------- abilities ---------- */
  // An attack or attack-move the hero should pick back up once a spell is cast.
  function resumable(h) {
    const o = h.order;
    if (!o) return null;
    if (o.type === 'cast') return o.after || null;
    return o.type === 'attack' || o.type === 'amove' ? o : null;
  }
  function tryAbility(slot, learn) {
    const h = I.activeHero();
    if (!h) return;
    const abId = G.HEROES[h.heroId].abilities[slot];
    if (learn) { G.game.learn(h.hs, abId); return; }
    if (h.dead) { G.ui.toast('That hero has fallen.', 'bad'); return; }
    const ab = G.ABILITIES[abId], rank = h.hs.ranks[abId];
    if (ab.passive) { G.ui.toast(`${ab.name} is passive${rank ? '' : ` (Shift+${G.KEYS[slot]} to learn)`}.`); return; }
    if (!rank) {
      G.ui.toast(G.canLearn(h.hs, abId) ? `${ab.name} isn’t learned yet. Shift+${G.KEYS[slot]} or the + button learns it.` : `${ab.name} isn’t learned yet.`, 'bad');
      G.audio.play('error'); return;
    }
    if ((h.cd[abId] || 0) > 0) { G.ui.toast(`${ab.name} isn’t ready.`, 'bad'); G.audio.play('error'); return; }
    if (h.mp < G.abilityValue(ab.mana, rank)) { G.ui.toast('Not enough mana.', 'bad'); G.audio.play('error'); return; }
    if (ab.target === 'none') { h.order = { type: 'cast', ability: abId, target: h, after: resumable(h) }; return; }
    I.targeting = { hero: h, ability: abId };
    I.aMove = false;
    if (G.settings.quickCast && I.mouse.inside) confirmTarget(I.mouse.x, I.mouse.y);
  }
  I.tryAbility = tryAbility;

  function confirmTarget(sx, sy) {
    const tg = I.targeting;
    if (!tg) return;
    const ab = G.ABILITIES[tg.ability], h = tg.hero;
    const w = G.render.toWorld(sx, sy);
    let target = null;
    if (ab.target === 'point') target = { x: w.x, y: w.y };
    else {
      const p = G.render.pick(sx, sy);
      const want = (e) => e && !e.dead && G.combat.targetable(e) && (ab.target === 'enemy' ? e.team === 'enemy' : e.team === 'player' && e.kind !== 'structure');
      if (want(p)) target = p;
      else {
        // forgiving: nearest valid unit to the cursor
        let bd = 1.4;
        for (const e of G.world.entities) if (want(e)) { const d = U.dist2(e.x, e.y, w.x, w.y); if (d < bd) { bd = d; target = e; } }
      }
      if (!target) { G.ui.toast(ab.target === 'enemy' ? 'Choose an enemy.' : 'Choose an ally.', 'bad'); G.audio.play('error'); return; }
    }
    h.order = { type: 'cast', ability: tg.ability, target, after: resumable(h) };
    h.path = null;
    I.targeting = null;
  }

  /* ---------- mouse ---------- */
  function onMouseDown(ev) {
    if (!G.game.running || G.ui.modal()) return;
    const { x, y } = pos(ev);
    if (ev.button === 0) {
      if (I.targeting) { confirmTarget(x, y); return; }
      if (I.aMove) {
        I.aMove = false;
        const t = G.render.pick(x, y);
        if (t && t.team === 'enemy') attackOrder(liveSelected(), t);
        else { const w = G.render.toWorld(x, y); moveOrder(liveSelected(), w.x, w.y, true); }
        return;
      }
      I.drag = { x0: x, y0: y, x1: x, y1: y, active: false, shift: ev.shiftKey };
    } else if (ev.button === 2) {
      if (I.targeting || I.aMove) { I.targeting = null; I.aMove = false; return; }
      smartOrder(x, y);
    } else if (ev.button === 1) {
      I.pan = { x, y, cx: G.render.cam.x, cy: G.render.cam.y };
      ev.preventDefault();
    }
  }
  function onMouseMove(ev) {
    const { x, y } = pos(ev);
    I.mouse.x = x; I.mouse.y = y; I.mouse.inside = true;
    if (I.drag) { I.drag.x1 = x; I.drag.y1 = y; if (Math.abs(x - I.drag.x0) + Math.abs(y - I.drag.y0) > 8) I.drag.active = true; }
    if (I.pan) {
      const a = G.render.toWorld(I.pan.x, I.pan.y), b = G.render.toWorld(x, y);
      G.render.cam.x += a.x - b.x; G.render.cam.y += a.y - b.y; I.pan.x = x; I.pan.y = y;
      G.render.cam.follow = false;
    }
  }
  function onMouseUp(ev) {
    if (ev.button === 1) { I.pan = null; return; }
    if (ev.button !== 0 || !I.drag) return;
    const d = I.drag; I.drag = null;
    if (d.active) {
      const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
      const ids = [];
      for (const e of G.world.entities) if (e.kind === 'hero') {
        const s = G.render.toScreen(e.x, e.y);
        if (s.x >= x0 && s.x <= x1 && s.y - 16 >= y0 - 16 && s.y - 16 <= y1 + 8) ids.push(e.heroId);
      }
      if (ids.length) I.select(ids, ids.includes(I.activeId) ? I.activeId : ids[0]);
      return;
    }
    const t = G.render.pick(d.x0, d.y0);
    if (t && t.kind === 'hero') {
      if (d.shift) {
        const ids = I.selIds.includes(t.heroId) ? I.selIds.filter((i) => i !== t.heroId) : [...I.selIds, t.heroId];
        if (ids.length) I.select(ids, t.heroId);
      } else I.select([t.heroId]);
      return;
    }
    if (t && (t.kind === 'npc' || t.kind === 'object' || t.kind === 'loot')) {
      const h = I.activeHero(); if (h && !h.dead) interactOrder(h, t);
    }
  }
  function onWheel(ev) {
    if (!G.game.running || G.ui.modal()) return;
    ev.preventDefault();
    const cam = G.render.cam;
    cam.zoom = U.clamp(cam.zoom * (ev.deltaY > 0 ? 0.9 : 1.1), 0.6, 2.0);
  }
  const pos = (ev) => { const r = canvas.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; };

  /* ---------- keyboard ---------- */
  function onKey(ev) {
    if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) return;
    const k = ev.key;
    I.keys[k.toLowerCase()] = true;
    if (!G.game.running) return;
    if (k === 'Escape') {
      if (I.targeting || I.aMove) { I.targeting = null; I.aMove = false; return; }
      if (G.ui.closeTop()) return;
      G.ui.openMenu(); return;
    }
    if (G.ui.modal()) {
      if (k === 'Enter' || k === ' ') { if (G.ui.dialogPrimary()) ev.preventDefault(); }
      if (k.toLowerCase() === 'i' || k.toLowerCase() === 'c' || k.toLowerCase() === 'l') { G.ui.closeTop(); }
      return;
    }
    const lk = k.toLowerCase();
    if (['q', 'w', 'e', 'r', 't'].includes(lk) && !ev.ctrlKey && !ev.metaKey) { tryAbility('qwert'.indexOf(lk), ev.shiftKey); ev.preventDefault(); return; }
    if (k >= '1' && k <= '6') { const h = I.activeHero(); if (h) G.game.useItem(h, +k - 1); return; }
    if (k === 'F1' || k === 'F2' || k === 'F3') {
      ev.preventDefault();
      const hs = G.state.party[+k[1] - 1];
      if (!hs) return;
      const now = performance.now();
      if (I.lastF.id === hs.id && now - I.lastF.t < 350) G.render.centerOn(heroEnt(hs.id), false);
      I.lastF = { id: hs.id, t: now };
      I.select([hs.id]);
      return;
    }
    switch (lk) {
      case 'a': if (ev.ctrlKey || ev.metaKey) { ev.preventDefault(); I.selectAll(); } else { I.aMove = true; I.targeting = null; } break;
      case '`': case '~': I.selectAll(); break;
      case 's': if (!ev.ctrlKey && !ev.metaKey) I.stop(); else { ev.preventDefault(); } break;
      case 'h': I.hold(); break;
      case 'tab': ev.preventDefault(); I.cycleActive(); break;
      case ' ': ev.preventDefault(); G.render.centerOn(I.activeHero(), false); break;
      case 'i': G.ui.openPack(); break;
      case 'c': G.ui.openHero(); break;
      case 'l': case 'j': G.ui.openLog(); break;
      case 'p': G.game.togglePause(); break;
    }
  }
  function onKeyUp(ev) { I.keys[ev.key.toLowerCase()] = false; }

  /* ---------- per-frame ---------- */
  I.update = (dt) => {
    if (!G.game.running) return;
    refreshSelection();
    if (I.marker) I.marker.t -= dt;
    if (I.mouse.inside) {
      I.mouseWorld = G.render.toWorld(I.mouse.x, I.mouse.y);
      I.hover = G.ui.modal() ? null : G.render.pick(I.mouse.x, I.mouse.y);
    }
    if (I.targeting && (I.targeting.hero.dead || I.targeting.hero.removed)) I.targeting = null;
    // keyboard + edge panning
    const cam = G.render.cam, sp = 14 * dt / cam.zoom;
    let px = 0, py = 0;
    if (I.keys.arrowleft) px -= 1; if (I.keys.arrowright) px += 1;
    if (I.keys.arrowup) py -= 1; if (I.keys.arrowdown) py += 1;
    if (G.settings.edgePan && I.mouse.inside && !G.ui.modal()) {
      if (I.mouse.x < 6) px -= 1; if (I.mouse.x > G.render.W - 6) px += 1;
      if (I.mouse.y < 6) py -= 1; if (I.mouse.y > G.render.H - 6) py += 1;
    }
    if (px || py) {
      // screen-space pan converted to world
      cam.x += (px + py * 2) * sp * 0.5; cam.y += (py * 2 - px) * sp * 0.5;
      cam.follow = false;
    }
    canvas.style.cursor = I.targeting || I.aMove ? 'crosshair' : I.hover && I.hover.team === 'enemy' ? 'pointer' : 'default';
  };

  I.init = (c) => {
    canvas = c;
    c.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    c.addEventListener('wheel', onWheel, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('mouseleave', () => { I.mouse.inside = false; I.hover = null; });
    c.addEventListener('mouseenter', () => { I.mouse.inside = true; });
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', () => { I.keys = {}; });
  };

  Object.assign(I, { resumable, moveOrder, attackOrder, interactOrder, liveSelected, heroEnt, refreshSelection, confirmTarget });
  return I;
})();
