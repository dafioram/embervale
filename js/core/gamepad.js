/* Basic controller support via the browser Gamepad API (standard mapping).
   Left stick moves the selected heroes, face buttons cast, A attacks/talks. */
G.gamepad = (() => {
  const P = { connected: false, prev: [], moveT: 0, lastDir: null };
  const DEAD = 0.25;

  window.addEventListener('gamepadconnected', (e) => { P.connected = true; G.ui && G.ui.toast(`Controller connected: ${e.gamepad.id.slice(0, 40)}`); });
  window.addEventListener('gamepaddisconnected', () => { P.connected = false; });

  // Screen-space stick direction to a world-space unit vector (isometric).
  function screenToWorldDir(dx, dy) {
    const x = dx + 2 * dy, y = 2 * dy - dx;
    const l = Math.hypot(x, y) || 1;
    return { x: x / l, y: y / l };
  }

  function autoTarget(h, ab) {
    const U = G.util;
    if (ab.target === 'ally') {
      let best = h, bf = h.hp / h.maxHp;
      for (const e of G.world.entities) if (e.team === 'player' && !e.dead && e.kind !== 'structure' && U.dist(e, h) < ab.range + 2) { const f = e.hp / e.maxHp; if (f < bf) { bf = f; best = e; } }
      return best;
    }
    let best = null, bd = (ab.range || 6) + 3;
    for (const e of G.world.entities) if (e.team === 'enemy' && !e.dead && G.combat.targetable(e)) { const d = U.dist(e, h); if (d < bd) { bd = d; best = e; } }
    if (ab.target === 'enemy') return best;
    if (best) return { x: best.x, y: best.y };
    const r = Math.min(ab.range || 4, 4);
    return { x: h.x + Math.cos(h.facing) * r, y: h.y + Math.sin(h.facing) * r };
  }

  function castSlot(slot, learn) {
    const h = G.input.activeHero();
    if (!h || h.dead) return;
    const abId = G.HEROES[h.heroId].abilities[slot];
    if (learn) { G.game.learn(h.hs, abId); return; }
    const ab = G.ABILITIES[abId], rank = h.hs.ranks[abId];
    if (!rank || (h.cd[abId] || 0) > 0 || h.mp < G.abilityValue(ab.mana, rank)) { G.input.tryAbility(slot); return; }
    if (ab.target === 'none') { h.order = { type: 'cast', ability: abId, target: h, after: G.input.resumable(h) }; return; }
    const t = autoTarget(h, ab);
    if (!t) { G.ui.toast('No target nearby.', 'bad'); return; }
    h.order = { type: 'cast', ability: abId, target: t, after: G.input.resumable(h) };
  }

  function primary() {
    const h = G.input.activeHero();
    if (!h || h.dead) return;
    const U = G.util;
    let enemy = null, ed = 7;
    for (const e of G.world.entities) if (e.team === 'enemy' && !e.dead && G.combat.targetable(e)) { const d = U.dist(e, h); if (d < ed) { ed = d; enemy = e; } }
    let thing = null, td = 3;
    for (const e of G.world.entities) if ((e.kind === 'npc' || e.kind === 'loot' || (e.kind === 'object' && G.world.objVisible(e)))) { const d = U.dist(e, h); if (d < td) { td = d; thing = e; } }
    if (thing && (!enemy || td < 1.8)) { G.input.interactOrder(h, thing); return; }
    if (enemy) G.input.attackOrder(G.input.liveSelected(), enemy);
  }

  function poll(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = Array.from(pads).find((p) => p && p.connected);
    if (!gp) return;
    const b = gp.buttons.map((x) => x.pressed);
    const pressed = (i) => b[i] && !P.prev[i];
    P.prev = b;
    if (!G.game.running) { if (pressed(0) || pressed(9)) G.ui.titlePrimary && G.ui.titlePrimary(); return; }

    if (G.ui.modal()) {
      if (pressed(0)) G.ui.dialogPrimary();
      if (pressed(1) || pressed(9)) G.ui.closeTop();
      return;
    }
    const lb = b[4];
    if (pressed(2)) castSlot(0, lb);
    if (pressed(3)) castSlot(1, lb);
    if (pressed(1)) castSlot(2, lb);
    if (pressed(5)) castSlot(3, lb);
    if (pressed(0)) primary();
    if (pressed(4)) G.input.cycleActive();
    if (pressed(6)) { const h = G.input.activeHero(); h && G.game.useItem(h, 0); }
    if (pressed(7)) { const h = G.input.activeHero(); h && G.game.useItem(h, 1); }
    if (pressed(12)) G.input.selectAll();
    if (pressed(13)) G.input.select([G.input.activeId]);
    if (pressed(14) || pressed(15)) G.input.cycleActive();
    if (pressed(9)) G.ui.openMenu();
    if (pressed(8)) G.ui.openLog();
    if (pressed(11)) G.render.centerOn(G.input.activeHero(), false);

    // movement
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const mag = Math.hypot(ax, ay);
    P.moveT -= dt;
    if (mag > DEAD) {
      if (P.moveT <= 0) {
        P.moveT = 0.12;
        const h = G.input.activeHero();
        if (h && !h.dead) {
          const d = screenToWorldDir(ax, ay);
          const reach = 1.6;
          G.input.liveSelected().forEach((e) => {
            const ox = e === h ? 0 : e.x - h.x, oy = e === h ? 0 : e.y - h.y;
            const ol = Math.hypot(ox, oy);
            const k = ol > 1.6 ? 1.6 / ol : 1;
            e.order = { type: 'move', x: h.x + d.x * reach + ox * k, y: h.y + d.y * reach + oy * k };
            e.target = null;
          });
          G.render.cam.follow = true;
          P.lastDir = d;
        }
      }
    } else if (P.lastDir) {
      P.lastDir = null;
      G.input.stop();
    }
    // right stick pans the camera
    const rx = gp.axes[2] || 0, ry = gp.axes[3] || 0;
    if (Math.hypot(rx, ry) > DEAD) {
      const cam = G.render.cam, sp = 12 * dt / cam.zoom;
      cam.x += (rx + ry * 2) * sp * 0.5; cam.y += (ry * 2 - rx) * sp * 0.5;
      cam.follow = false;
    }
  }

  return { poll, get connected() { return P.connected; } };
})();
