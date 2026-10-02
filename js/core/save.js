/* Saving: browser localStorage slots plus JSON export/import. */
G.save = (() => {
  const PREFIX = 'embervale.save.';
  const VERSION = 1;
  const SLOTS = ['auto', '1', '2', '3'];
  let lastAuto = 0;

  function canSave() {
    if (!G.state || !G.game.running) return false;
    if (G.events.active) return false;
    if (G.game.wiping) return false;
    return G.world.heroes().some((h) => !h.dead);
  }

  function snapshot() {
    G.world.syncHeroes();
    const lead = G.input.activeHero();
    G.state.pos = lead ? [Math.round(lead.x * 10) / 10, Math.round(lead.y * 10) / 10] : G.state.pos;
    return {
      game: 'embervale', version: VERSION, savedAt: new Date().toISOString(),
      meta: { zone: G.ZONES[G.state.zone].name, level: G.partyLevel(), party: G.state.party.map((h) => h.id), playTime: Math.round(G.state.playTime) },
      state: JSON.parse(JSON.stringify(G.state)),
    };
  }

  function store(slot, obj) {
    try { localStorage.setItem(PREFIX + slot, JSON.stringify(obj)); return true; }
    catch (e) { G.ui.toast('Could not save: browser storage is unavailable or full. Try Export instead.', 'bad'); return false; }
  }
  function read(slot) {
    try { const s = localStorage.getItem(PREFIX + slot); return s ? JSON.parse(s) : null; }
    catch (e) { return null; }
  }
  function remove(slot) { try { localStorage.removeItem(PREFIX + slot); } catch (e) { /* ignore */ } }

  function write(slot) {
    if (!canSave()) { G.ui.toast('You can’t save during a fight for the mill or while the party is down.', 'bad'); return false; }
    const ok = store(slot, snapshot());
    if (ok && slot !== 'auto') G.ui.toast(`Saved to slot ${slot}.`);
    return ok;
  }
  function auto() {
    if (!canSave()) return;
    const now = performance.now();
    if (now - lastAuto < 2000) return;
    lastAuto = now;
    store('auto', snapshot());
  }
  const list = () => SLOTS.map((s) => ({ slot: s, data: read(s) }));

  // Validate + migrate an external save object. Returns an error string or null.
  function validate(obj) {
    if (!obj || typeof obj !== 'object') return 'Not a save file.';
    if (obj.game !== 'embervale') return 'This JSON isn’t an Embervale save.';
    if (typeof obj.version !== 'number' || obj.version > VERSION) return 'This save is from a newer version of the game.';
    const s = obj.state;
    if (!s || !Array.isArray(s.party) || !s.party.length || !G.ZONES[s.zone]) return 'The save file is damaged.';
    if (!s.party.every((h) => G.HEROES[h.id])) return 'The save file lists an unknown hero.';
    return null;
  }
  function migrate(obj) {
    const s = obj.state;
    const d = G.freshState();
    for (const k in d) if (s[k] === undefined) s[k] = d[k];
    for (const hs of s.party) {
      const fresh = G.newHeroState(hs.id);
      for (const k in fresh) if (hs[k] === undefined) hs[k] = fresh[k];
      for (const a of G.HEROES[hs.id].abilities) if (hs.ranks[a] === undefined) hs.ranks[a] = 0;
      hs.items = (hs.items || []).slice(0, 6).map((it) => (it && G.ITEMS[it.id] ? it : null));
      while (hs.items.length < 6) hs.items.push(null);
    }
    s.pack = (s.pack || []).filter((it) => it && G.ITEMS[it.id]);
    return obj;
  }

  function load(obj) {
    const err = validate(obj);
    if (err) { G.ui.toast(err, 'bad'); return false; }
    G.game.loadState(migrate(obj).state);
    return true;
  }
  function loadSlot(slot) { const o = read(slot); if (!o) { G.ui.toast('That slot is empty.', 'bad'); return false; } return load(o); }

  function exportJson() {
    if (!G.state) return;
    const obj = canSave() ? snapshot() : read('auto') || snapshot();
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const d = new Date();
    a.href = URL.createObjectURL(blob);
    a.download = `embervale-save-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    G.ui.toast('Save exported as a JSON file.');
  }
  function importJson(file, done) {
    const r = new FileReader();
    r.onload = () => {
      let obj;
      try { obj = JSON.parse(r.result); } catch (e) { G.ui.toast('That file isn’t valid JSON.', 'bad'); return; }
      if (load(obj)) { G.ui.toast('Save imported.'); done && done(); }
    };
    r.readAsText(file);
  }

  return { write, auto, read, list, load, loadSlot, remove, exportJson, importJson, canSave, validate, SLOTS };
})();

/* Settings live separately so they survive new games. */
G.settings = (() => {
  const d = { volume: 0.5, music: 0.6, ambience: 0.6, effects: 0.8, muted: false, atmosphere: true, showFps: false, edgePan: false, allBars: false, quickCast: false };
  try { Object.assign(d, JSON.parse(localStorage.getItem('embervale.settings') || '{}')); } catch (e) { /* ignore */ }
  return d;
})();
G.saveSettings = () => { try { localStorage.setItem('embervale.settings', JSON.stringify(G.settings)); } catch (e) { /* ignore */ } };
