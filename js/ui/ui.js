/* DOM user interface: HUD, panels, dialogs, shops, saves, tooltips. */
G.ui = (() => {
  const $ = (s) => document.querySelector(s);
  const esc = G.util.esc;
  const UI = { dirty: true };
  const COIN = '<i class="coin" title="gold"></i>';
  const stack = []; // open modal panels
  let tick = 0, lastActive = null, partyKey = '', abilKey = '', invKey = '';

  /* ---------- helpers ---------- */
  function h(tag, attrs = {}, html = '') {
    const e = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    if (html) e.innerHTML = html;
    return e;
  }
  // icons are drawn at about twice their largest on-screen size so they stay sharp
  const ICON_RES = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
  const itemIcon = (id) => { const it = G.ITEMS[id]; return G.sprites.icon(it.icon, it.color, 64 * ICON_RES); };
  const abIcon = (id) => { const a = G.ABILITIES[id]; return G.sprites.icon(a.icon, a.color, 72 * ICON_RES); };
  const heroName = (id) => G.HEROES[id].name.split(' ')[0];

  /* ---------- init ---------- */
  function init() {
    document.querySelectorAll('#topbar .tb').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.act;
      if (a === 'log') openLog(); else if (a === 'hero') openHero(); else if (a === 'pack') openPack(); else openMenu();
    }));
    document.querySelectorAll('#cmds .cmd').forEach((b) => b.addEventListener('click', () => {
      const c = b.dataset.cmd;
      if (c === 'amove') { G.input.aMove = true; G.input.targeting = null; }
      else if (c === 'stop') G.input.stop();
      else if (c === 'hold') G.input.hold();
      else if (c === 'all') G.input.selectAll();
    }));
    const mm = $('#minimap');
    const mmPos = (ev) => { const r = mm.getBoundingClientRect(); return G.render.minimapToWorld(mm, (ev.clientX - r.left) * (mm.width / r.width), (ev.clientY - r.top) * (mm.height / r.height)); };
    mm.addEventListener('mousedown', (ev) => {
      ev.preventDefault();
      const w = mmPos(ev);
      if (ev.button === 2) { G.input.moveOrder(G.input.liveSelected(), w.x, w.y, false); return; }
      G.render.cam.x = w.x; G.render.cam.y = w.y; G.render.cam.follow = false;
      const move = (e2) => { const w2 = mmPos(e2); G.render.cam.x = w2.x; G.render.cam.y = w2.y; };
      const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
      window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    });
    mm.addEventListener('contextmenu', (e) => e.preventDefault());
    // tooltips
    document.addEventListener('mouseover', (ev) => {
      const t = ev.target.closest('[data-tip]');
      if (!t) { hideTip(); G.input.previewAbility = null; return; }
      showTip(t, ev);
    });
    document.addEventListener('mousemove', (ev) => { const tip = $('#tooltip'); if (!tip.classList.contains('hidden')) placeTip(ev); });
    $('#import-file').addEventListener('change', (ev) => {
      const f = ev.target.files[0];
      ev.target.value = '';
      if (f) G.save.importJson(f, () => closeAll());
    });
    document.addEventListener('pointerdown', () => G.audio.unlock(), { once: true });
    document.addEventListener('keydown', () => G.audio.unlock(), { once: true });
  }

  /* ---------- screens ---------- */
  function showTitle() {
    $('#hud').classList.add('hidden');
    closeAll();
    const t = $('#title');
    t.classList.remove('hidden');
    const btns = $('#title-buttons');
    btns.innerHTML = '';
    const auto = G.save.read('auto');
    const mk = (label, fn, primary) => { const b = h('button', { class: 'btn' + (primary ? ' primary' : '') }, label); b.addEventListener('click', () => { G.audio.unlock(); fn(); }); btns.appendChild(b); return b; };
    if (auto && !G.save.validate(auto)) mk(`Continue <small>${esc(auto.meta.zone)} &middot; level ${auto.meta.level} &middot; ${G.util.fmtTime(auto.meta.playTime)}</small>`, () => G.save.load(auto), true);
    mk('New Game', () => {
      if (auto) confirmBox('Start a new game? Your autosave will be replaced once you play. Manual save slots are kept.', () => G.game.newGame());
      else G.game.newGame();
    }, !auto);
    mk('Load Game', () => openSaves(false));
    mk('Import Save (JSON)', () => $('#import-file').click());
    UI.titlePrimary = () => btns.querySelector('.btn').click();
  }
  function showGame() { $('#title').classList.add('hidden'); $('#hud').classList.remove('hidden'); partyKey = ''; abilKey = ''; invKey = ''; refreshAll(); }

  function fade(on, cb) {
    const f = $('#fade');
    f.style.opacity = on ? 1 : 0;
    f.style.pointerEvents = on ? 'all' : 'none';
    if (cb) setTimeout(cb, 320);
  }
  function setPaused(p) { $('#pausetag').classList.toggle('hidden', !p); }

  /* ---------- toasts ---------- */
  function toast(msg, type = '') {
    const box = $('#toasts');
    if (!box) return;
    const t = h('div', { class: 'toast ' + type }, esc(msg));
    box.appendChild(t);
    while (box.children.length > 5) box.firstChild.remove();
    setTimeout(() => t.classList.add('out'), type === 'progress' ? 2200 : 3800);
    setTimeout(() => t.remove(), type === 'progress' ? 2700 : 4400);
  }

  /* ---------- modal stack ---------- */
  function openModal(kind, build, opts = {}) {
    closeKind(kind);
    const wrap = h('div', { class: 'modal-wrap' + (opts.dim === false ? ' nodim' : '') });
    const panel = h('div', { class: 'panel ' + (opts.cls || '') });
    wrap.appendChild(panel);
    if (!opts.locked) wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) closeTop(); });
    $('#modals').appendChild(wrap);
    const m = { kind, wrap, panel, locked: opts.locked, onClose: opts.onClose, rebuild: () => { panel.innerHTML = ''; build(panel, m); } };
    stack.push(m);
    m.rebuild();
    hideTip();
    G.input.targeting = null;
    return m;
  }
  function closeKind(kind) {
    for (let i = stack.length - 1; i >= 0; i--) if (stack[i].kind === kind) { const m = stack[i]; stack.splice(i, 1); m.wrap.remove(); m.onClose && m.onClose(); }
  }
  function closeTop() {
    const m = stack[stack.length - 1];
    if (!m || m.locked) return false;
    stack.pop(); m.wrap.remove(); m.onClose && m.onClose(); hideTip();
    return true;
  }
  function closeAll() { while (stack.length) { const m = stack.pop(); m.wrap.remove(); } hideTip(); }
  const modal = () => stack.length > 0;
  const findModal = (kind) => stack.find((m) => m.kind === kind);
  function rebuildOpen() { for (const m of stack) if (['pack', 'shop', 'hero', 'log'].includes(m.kind)) m.rebuild(); }

  function header(panel, title, sub) {
    const hd = h('div', { class: 'panel-head' }, `<div><h3>${title}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`);
    const x = h('button', { class: 'xbtn', title: 'Close (Esc)' }, '&times;');
    x.addEventListener('click', closeTop);
    hd.appendChild(x);
    panel.appendChild(hd);
  }

  function confirmBox(text, yes) {
    openModal('confirm', (p) => {
      p.appendChild(h('p', {}, esc(text)));
      const row = h('div', { class: 'row end' });
      row.appendChild(h('button', { class: 'btn', onclick: () => closeTop() }, 'Cancel'));
      row.appendChild(h('button', { class: 'btn primary', onclick: () => { closeTop(); yes(); } }, 'Yes'));
      p.appendChild(row);
    }, { cls: 'small' });
  }

  /* ---------- dialog ---------- */
  function who(id) {
    if (id === 'narrator') return { name: 'The Vale', title: '', img: null };
    if (G.HEROES[id]) return { name: G.HEROES[id].name, title: G.HEROES[id].title, img: G.sprites.heroPortrait(id) };
    const n = G.NPCS[id];
    return { name: n.name, title: n.title, img: G.sprites.npcPortrait(id) };
  }
  function dialog({ npc, title, text, buttons, onClose }) {
    closeKind('dialog');
    const w = who(npc);
    const m = openModal('dialog', (p) => {
      const body = h('div', { class: 'dlg' });
      if (w.img) body.appendChild(h('img', { class: 'dlg-portrait', src: w.img, alt: '' }));
      const col = h('div', { class: 'dlg-col' });
      col.appendChild(h('div', { class: 'dlg-name' }, `${esc(w.name)}${w.title ? ` <span>${esc(w.title)}</span>` : ''}`));
      if (title) col.appendChild(h('div', { class: 'dlg-qtitle' }, esc(title)));
      col.appendChild(h('div', { class: 'dlg-text' }, esc(text)));
      const row = h('div', { class: 'dlg-buttons' });
      buttons.forEach((b) => { const bt = h('button', { class: 'btn' + (b.primary ? ' primary' : '') }, esc(b.label)); bt.addEventListener('click', () => { G.audio.play('click', 0.3); b.onClick(); }); row.appendChild(bt); });
      col.appendChild(row);
      body.appendChild(col);
      p.appendChild(body);
    }, { cls: 'dialog', dim: false, onClose });
    return m;
  }
  const closeDialog = () => closeKind('dialog');
  // A sequence of dialog pages. onDone always runs, even if the player skips with Esc,
  // because story beats (recruits, new quests) hang off it.
  function dialogSeq(pages, onDone) {
    let i = 0, finished = false, advancing = false;
    const finish = () => { if (finished) return; finished = true; onDone && onDone(); };
    const show = () => {
      const pg = pages[i];
      const last = i === pages.length - 1;
      dialog({
        npc: pg.who, text: pg.text,
        buttons: [{ label: last ? 'Continue' : 'Next', primary: true, onClick: () => { i++; advancing = true; if (i >= pages.length) { closeDialog(); finish(); } else show(); } }],
        onClose: () => { if (advancing) { advancing = false; return; } finish(); },
      });
    };
    show();
  }
  function dialogPrimary() {
    const m = stack[stack.length - 1];
    if (!m) return false;
    const b = m.panel.querySelector('.btn.primary') || m.panel.querySelector('.btn');
    if (b) { b.click(); return true; }
    return false;
  }

  /* ---------- HUD: party portraits ---------- */
  function buildParty() {
    const box = $('#party');
    box.innerHTML = '';
    G.state.party.forEach((hs, i) => {
      const c = h('div', { class: 'pcard', 'data-hero': hs.id });
      c.innerHTML = `<img src="${G.sprites.heroPortrait(hs.id)}" alt=""><div class="pc-lvl"></div><div class="pc-sp">+</div>
        <div class="pc-bars"><div class="pc-hp"><i></i></div><div class="pc-mp"><i></i></div></div><div class="pc-key">F${i + 1}</div><div class="pc-dead">&#10013;</div>`;
      c.addEventListener('mousedown', (ev) => {
        if (ev.button !== 0) return;
        if (ev.shiftKey) {
          const ids = G.input.selIds.includes(hs.id) ? G.input.selIds.filter((x) => x !== hs.id) : [...G.input.selIds, hs.id];
          if (ids.length) G.input.select(ids, hs.id);
        } else G.input.select([hs.id]);
      });
      c.addEventListener('dblclick', () => G.render.centerOn(G.input.heroEnt(hs.id), false));
      c.dataset.tip = 'hero';
      box.appendChild(c);
    });
  }
  function updateParty() {
    const key = G.state.party.map((h) => h.id).join();
    if (key !== partyKey) { partyKey = key; buildParty(); }
    for (const c of document.querySelectorAll('#party .pcard')) {
      const id = c.dataset.hero, e = G.input.heroEnt(id), hs = G.state.party.find((x) => x.id === id);
      if (!e) continue;
      c.classList.toggle('sel', G.input.selIds.includes(id));
      c.classList.toggle('active', G.input.activeId === id);
      c.classList.toggle('dead', !!e.dead);
      const spend = G.canSpend(hs);
      c.classList.toggle('hassp', spend);
      c.classList.toggle('banked', !spend && hs.skillPoints > 0);
      c.querySelector('.pc-sp').textContent = spend ? '+' : hs.skillPoints;
      c.querySelector('.pc-lvl').textContent = hs.level;
      c.querySelector('.pc-hp i').style.width = (100 * Math.max(0, e.hp) / e.maxHp) + '%';
      c.querySelector('.pc-mp i').style.width = (100 * e.mp / e.maxMp) + '%';
    }
  }

  /* ---------- HUD: unit panel, abilities, inventory ---------- */
  function updateUnit() {
    const e = G.input.activeHero();
    if (!e) return;
    const hs = e.hs, d = G.HEROES[hs.id], s = e.stats;
    if (lastActive !== hs.id) { $('#unit-portrait').src = G.sprites.heroPortrait(hs.id); lastActive = hs.id; }
    $('#unit-name').textContent = d.name;
    $('#unit-sub').textContent = `Level ${hs.level} ${d.title}`;
    const need = G.xpToNext(hs.level);
    $('#unit-xp-fill').style.width = hs.level >= G.MAX_LEVEL ? '100%' : (100 * hs.xp / need) + '%';
    $('#unit-xp-text').textContent = hs.level >= G.MAX_LEVEL ? 'Max level' : `XP ${hs.xp} / ${need}`;
    const armor = Math.round(((e.armor || 0) + ((e.mods && e.mods.armor) || 0)) * 10) / 10;
    const stats = `<span data-tip="stat" data-stat="hp">HP <b>${Math.max(0, Math.round(e.hp))}/${e.maxHp}</b></span><span data-tip="stat" data-stat="mp">MP <b>${Math.round(e.mp)}/${e.maxMp}</b></span>
      <span data-tip="stat" data-stat="dmg">Damage <b>${Math.round(e.dmg * 0.9)}–${Math.round(e.dmg * 1.1)}</b></span><span data-tip="stat" data-stat="armor">Armor <b>${armor}</b></span>
      <span data-tip="stat" data-stat="str" class="${d.primary === 'str' ? 'prim' : ''}">STR <b>${s.str}</b></span><span data-tip="stat" data-stat="agi" class="${d.primary === 'agi' ? 'prim' : ''}">AGI <b>${s.agi}</b></span><span data-tip="stat" data-stat="int" class="${d.primary === 'int' ? 'prim' : ''}">INT <b>${s.int}</b></span>`;
    const st = $('#unit-stats');
    if (st.dataset.k !== stats) { st.innerHTML = stats; st.dataset.k = stats; }
    const buffs = e.buffs.filter((b) => b.name && b.t < 9000).map((b) => `<span class="buff ${b.good ? 'good' : 'bad'}" style="border-color:${b.color || '#888'}">${esc(b.name)} ${Math.ceil(b.t)}s</span>`).join('');
    const bf = $('#unit-buffs');
    if (bf.dataset.k !== buffs) { bf.innerHTML = buffs; bf.dataset.k = buffs; }
  }

  function buildAbilities(e) {
    const box = $('#abilities');
    box.innerHTML = '';
    G.HEROES[e.heroId].abilities.forEach((id, i) => {
      const b = h('div', { class: 'abil', 'data-tip': 'ability', 'data-ab': id, 'data-slot': i });
      b.innerHTML = `<img src="${abIcon(id)}" alt=""><div class="cd"></div><div class="cdt"></div><div class="key">${G.ABILITIES[id].passive ? 'Passive' : G.KEYS[i]}</div><div class="mana"></div><div class="pips"></div><button class="learn" title="Learn (Shift+${G.KEYS[i]})">+</button>`;
      if (G.ABILITIES[id].passive) b.classList.add('passive');
      b.addEventListener('mousedown', (ev) => {
        if (ev.target.classList.contains('learn')) { ev.stopPropagation(); G.game.learn(G.input.activeHero().hs, id); return; }
        if (ev.button === 0) G.input.tryAbility(i, ev.shiftKey);
      });
      b.addEventListener('mouseenter', () => { G.input.previewAbility = { hero: G.input.activeHero(), ability: id }; });
      b.addEventListener('mouseleave', () => { G.input.previewAbility = null; });
      box.appendChild(b);
    });
  }
  function updateAbilities() {
    const e = G.input.activeHero();
    if (!e) return;
    const key = e.heroId;
    if (key !== abilKey) { abilKey = key; buildAbilities(e); }
    for (const b of document.querySelectorAll('#abilities .abil')) {
      const id = b.dataset.ab, ab = G.ABILITIES[id], r = e.hs.ranks[id];
      const cd = e.cd[id] || 0, max = (e.cdMax && e.cdMax[id]) || G.abilityValue(ab.cd, Math.max(1, r));
      const mana = ab.passive ? 0 : G.abilityValue(ab.mana, Math.max(1, r));
      b.classList.toggle('unlearned', !r);
      b.classList.toggle('nomana', !ab.passive && r > 0 && e.mp < mana);
      b.classList.toggle('targeting', !!(G.input.targeting && G.input.targeting.ability === id));
      b.classList.toggle('canlearn', G.canLearn(e.hs, id));
      const cdEl = b.querySelector('.cd');
      if (cd > 0) { const p = cd / max; cdEl.style.background = `conic-gradient(rgba(0,0,0,0.7) ${p * 360}deg, transparent 0)`; b.querySelector('.cdt').textContent = cd > 1 ? Math.ceil(cd) : cd.toFixed(1); }
      else { cdEl.style.background = 'none'; b.querySelector('.cdt').textContent = ''; }
      b.querySelector('.mana').textContent = r && !ab.passive ? mana : '';
      const pips = b.querySelector('.pips');
      const pk = r + '/' + ab.maxRank;
      if (pips.dataset.k !== pk) { pips.dataset.k = pk; pips.innerHTML = Array.from({ length: ab.maxRank }, (_, k) => `<i class="${k < r ? 'on' : ''}"></i>`).join(''); }
    }
  }

  function slotHtml(it, loc, keyLabel) {
    if (!it) return `<div class="slot empty" data-loc="${loc}">${keyLabel ? `<span class="k">${keyLabel}</span>` : ''}</div>`;
    const d = G.ITEMS[it.id];
    return `<div class="slot ${d.kind} ${d.unique ? 'unique' : ''}" draggable="true" data-loc="${loc}" data-tip="item" data-item="${it.id}"><img src="${itemIcon(it.id)}" alt="">${it.n > 1 ? `<span class="n">${it.n}</span>` : ''}${keyLabel ? `<span class="k">${keyLabel}</span>` : ''}</div>`;
  }
  function updateInv() {
    const e = G.input.activeHero();
    if (!e) return;
    const key = e.heroId + JSON.stringify(e.hs.items);
    if (key === invKey) return;
    invKey = key;
    const box = $('#inv');
    box.innerHTML = e.hs.items.map((it, i) => slotHtml(it, `h:${e.heroId}:${i}`, i + 1)).join('');
    wireSlots(box, true);
  }

  /* ---------- item moving (drag & drop) ---------- */
  function getLoc(loc) {
    const p = loc.split(':');
    if (p[0] === 'h') { const hs = G.state.party.find((x) => x.id === p[1]); return { arr: hs.items, i: +p[2], hs }; }
    if (p[0] === 'p') return { arr: G.state.pack, i: p[1] === 'new' ? G.state.pack.length : +p[1], pack: true };
    return null;
  }
  function moveItem(from, to) {
    if (from === to) return;
    const a = getLoc(from), b = getLoc(to);
    if (!a || !b) return;
    const ia = a.arr[a.i];
    if (!ia) return;
    const ib = b.arr[b.i];
    const stack = G.ITEMS[ia.id].stack || (G.ITEMS[ia.id].kind === 'tome' ? 10 : 1);
    if (ib && ib.id === ia.id && stack > 1 && ib.n < stack) {
      const k = Math.min(ia.n, stack - ib.n); ib.n += k; ia.n -= k;
      if (ia.n <= 0) { if (a.pack) a.arr.splice(a.i, 1); else a.arr[a.i] = null; }
    } else if (b.pack && !ib) {
      G.state.pack.push(ia);
      if (a.pack) a.arr.splice(a.i, 1); else a.arr[a.i] = null;
    } else {
      if (a.pack && !ib) { a.arr.splice(a.i, 1); b.arr[b.i] = ia; }
      else { a.arr[a.i] = ib || null; b.arr[b.i] = ia; }
      if (a.pack) G.state.pack = G.state.pack.filter(Boolean);
    }
    for (const hs of [a.hs, b.hs]) if (hs) { const e = G.input.heroEnt(hs.id); if (e) G.world.refreshHero(e); }
    invKey = ''; rebuildOpen(); G.audio.play('click', 0.3);
  }
  function wireSlots(root, hud) {
    root.querySelectorAll('.slot').forEach((s) => {
      s.addEventListener('dragstart', (ev) => { ev.dataTransfer.setData('text/plain', s.dataset.loc); ev.dataTransfer.effectAllowed = 'move'; hideTip(); });
      s.addEventListener('dragover', (ev) => { ev.preventDefault(); s.classList.add('over'); });
      s.addEventListener('dragleave', () => s.classList.remove('over'));
      s.addEventListener('drop', (ev) => { ev.preventDefault(); s.classList.remove('over'); moveItem(ev.dataTransfer.getData('text/plain'), s.dataset.loc); });
      s.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        if (s.classList.contains('empty')) return;
        const loc = s.dataset.loc;
        if (loc.startsWith('h:')) moveItem(loc, 'p:new');
        else { const hs = G.input.activeHero().hs; const i = hs.items.findIndex((x) => !x); if (i >= 0) moveItem(loc, `h:${hs.id}:${i}`); else toast('No free slot on that hero.', 'bad'); }
      });
      s.addEventListener('click', () => {
        if (s.classList.contains('empty')) return;
        const loc = s.dataset.loc;
        if (loc.startsWith('h:')) {
          const [, hid, i] = loc.split(':');
          G.game.useItem(G.input.heroEnt(hid), +i);
          invKey = ''; rebuildOpen();
        } else {
          const hs = G.input.activeHero().hs; const i = hs.items.findIndex((x) => !x);
          if (i >= 0) moveItem(loc, `h:${hs.id}:${i}`); else toast(`${heroName(hs.id)} has no free slot.`, 'bad');
        }
      });
    });
  }

  /* ---------- quest tracker ---------- */
  function refreshQuests() {
    const box = $('#tracker');
    if (!box || !G.state) return;
    const rows = [];
    const ids = Object.keys(G.state.quests).filter((id) => G.state.quests[id].s !== 'done');
    ids.sort((a, b) => (G.QUESTS[b].main ? 1 : 0) - (G.QUESTS[a].main ? 1 : 0));
    for (const id of ids.slice(0, 5)) {
      const q = G.state.quests[id], d = G.QUESTS[id];
      let obj;
      if (q.s === 'ready') obj = `<li class="ready">Return to ${esc(G.NPCS[d.turnIn].name)}</li>`;
      else obj = d.objectives.map((o, i) => `<li class="${q.p[i] >= o.count ? 'ok' : ''}">${esc(o.text)}${o.count > 1 ? ` ${q.p[i]}/${o.count}` : ''}</li>`).join('');
      rows.push(`<div class="tq ${d.main ? 'main' : ''}"><div class="tq-name">${esc(d.name)}</div><ul>${obj}</ul></div>`);
    }
    box.innerHTML = rows.join('');
    box.onclick = () => openLog();
  }

  /* ---------- per-frame update ---------- */
  function update(dt) {
    updateAbilities();
    tick += dt;
    if (tick < 0.1 && !UI.dirty) return;
    tick = 0;
    UI.dirty = false;
    updateParty();
    updateUnit();
    updateInv();
    $('#gold').textContent = G.state.gold;
    $('#clock').textContent = G.util.fmtTime(G.state.playTime);
    G.render.drawMinimap($('#minimap'));
    updateTarget();
  }
  function refreshAll() { if (!G.state || !G.state.party.length) return; partyKey = ''; abilKey = ''; invKey = ''; UI.dirty = true; refreshQuests(); updateParty(); updateUnit(); updateInv(); rebuildOpen(); }

  /* Target frame: the unit you left-clicked; if none, a boss that's in a fight. */
  let tgKey = '';
  function updateTarget() {
    const I = G.input;
    if (I.focus && (I.focus.dead || I.focus.removed || !G.world.entities.includes(I.focus))) I.focus = null;
    const boss = G.world.entities.find((e) => e.def && e.def.boss && !e.dead && e.team === 'enemy' && (e.target || e.hp < e.maxHp) && !e.returning);
    const e = I.focus || boss;
    const box = $('#target');
    if (!e) { box.classList.add('hidden'); layoutTop(); return; }
    box.classList.remove('hidden');
    const friendly = e.team === 'player';
    box.classList.toggle('friendly', friendly);
    box.classList.toggle('boss', !!(e.def && e.def.boss));
    const key = e.id;
    if (key !== tgKey) {
      tgKey = key;
      box.querySelector('.tg-portrait').src = e.defId ? G.sprites.unitPortrait(e.defId) : '';
      box.querySelector('.tg-name').textContent = e.name;
    }
    let lvl = '', col = '#f2e2b8';
    if (e.kind === 'structure') lvl = 'Structure';
    else if (friendly) lvl = e.ttl > 0 ? `Summoned \u00b7 ${Math.ceil(e.ttl)}s left` : 'Summoned';
    else { const d = G.dangerOf(e.level, G.partyLevel()); lvl = `Level ${e.level} \u00b7 ${d.tag}`; col = d.color; }
    const lv = box.querySelector('.tg-lvl'); lv.textContent = lvl; lv.style.color = col;
    box.querySelector('.tg-fill').style.width = (100 * Math.max(0, e.hp) / e.maxHp) + '%';
    box.querySelector('.tg-hp').textContent = `${Math.max(0, Math.ceil(e.hp))} / ${e.maxHp}${e.returning ? '  (retreating)' : ''}`;
    const buffs = (e.buffs || []).filter((b) => b.name && b.t < 9000).map((b) => `<span class="buff ${b.good ? 'good' : 'bad'}" style="border-color:${b.color || '#888'}">${esc(b.name)} ${Math.ceil(b.t)}s</span>`).join('')
      + (e.buffs || []).filter((b) => b.name && b.t >= 9000).map((b) => `<span class="buff bad" style="border-color:${b.color || '#888'}">${esc(b.name)}</span>`).join('');
    const bf = box.querySelector('.tg-buffs');
    if (bf.dataset.k !== buffs) { bf.innerHTML = buffs; bf.dataset.k = buffs; }
    layoutTop();
  }
  // Stack the target frame, the event bar and the toasts down from the top bar.
  function layoutTop() {
    let y = 48;
    for (const id of ['#target', '#eventbar']) {
      const el = $(id);
      if (!el || el.classList.contains('hidden')) continue;
      el.style.top = y + 'px';
      y += el.offsetHeight + 6;
    }
    $('#toasts').style.top = (y + 4) + 'px';
  }

  function setEvent(a) {
    const eb = $('#eventbar');
    if (!eb) return;
    if (!a) { eb.classList.add('hidden'); return; }
    eb.classList.remove('hidden');
    const m = a.mill;
    const wave = a.t > 0 ? `Wave ${a.wave + 1} of 3 arrives in ${Math.ceil(a.t)}s` : `Wave ${a.wave + 1} of 3`;
    eb.innerHTML = `<div class="eb-title">Defend Ovan’s Mill</div><div class="eb-sub">${wave}</div><div class="eb-bar"><i style="width:${100 * m.hp / m.maxHp}%"></i></div>`;
  }

  function onZoneLoaded(Z) {
    const warn = G.zoneWarn(G.world.zoneId);
    $('#zone-name').innerHTML = `<b>${esc(Z.name)}</b> <span>${esc(Z.subtitle)} &middot; ${Z.level === 'Safe' ? 'Safe' : 'Enemies level ' + Z.level}</span>` +
      (warn ? ` <span class="rec" style="color:${warn.color}">&middot; ${esc(warn.text)}</span>` : '');
    $('#mm-zone').textContent = Z.name;
    document.querySelectorAll('.zone-banner').forEach((x) => x.remove());
    const banner = h('div', { class: 'zone-banner' }, `<div>${esc(Z.name)}</div><span>${esc(Z.subtitle)}</span>` +
      (warn ? `<em style="color:${warn.color}">${esc(warn.text)}</em>${warn.note ? `<small style="color:${warn.color}">${esc(warn.note)}</small>` : ''}` : ''));
    document.getElementById('app').appendChild(banner);
    const stay = warn && warn.gap >= 1 ? 4200 : 2600;
    setTimeout(() => banner.classList.add('out'), stay);
    setTimeout(() => banner.remove(), stay + 1000);
    refreshAll();
  }

  /* ---------- tooltips ---------- */
  function showTip(t, ev) {
    const tip = $('#tooltip');
    let html = '';
    const type = t.dataset.tip;
    if (type === 'ability') html = abilityTip(t.dataset.ab);
    else if (type === 'item') html = itemTip(t.dataset.item, t.dataset.price, t.dataset.tome);
    else if (type === 'hero') { const hs = G.state.party.find((x) => x.id === t.dataset.hero); const d = G.HEROES[hs.id]; html = `<b>${esc(d.name)}</b><div class="tt-sub">Level ${hs.level} ${esc(d.title)} · ${esc(d.role)}</div>${spTip(hs)}<div class="tt-hint">Click to select, Shift-click to add, double-click to find.</div>`; }
    else if (type === 'stat') html = statTip(t.dataset.stat);
    else html = esc(t.dataset.tipText || '');
    if (!html) return hideTip();
    tip.innerHTML = html;
    tip.classList.remove('hidden');
    placeTip(ev);
  }
  function placeTip(ev) {
    const tip = $('#tooltip');
    const w = tip.offsetWidth, hh = tip.offsetHeight;
    let x = ev.clientX + 16, y = ev.clientY - hh - 12;
    if (x + w > window.innerWidth - 8) x = ev.clientX - w - 16;
    if (y < 8) y = ev.clientY + 20;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { const t = $('#tooltip'); t && t.classList.add('hidden'); }

  function spTip(hs) {
    if (!hs.skillPoints) return '';
    const n = `${hs.skillPoints} skill point${hs.skillPoints > 1 ? 's' : ''}`;
    if (G.canSpend(hs)) return `<div class="tt-good">${n} to spend</div>`;
    const nx = G.nextUnlockLevel(hs);
    return `<div class="tt-sub">${n} saved${nx ? ` \u2014 next use at level ${nx.level} (${esc(nx.name)})` : ''}</div>`;
  }
  function abilityTip(id) {
    const e = G.input.activeHero();
    const ab = G.ABILITIES[id];
    const hs = e.hs, r = hs.ranks[id];
    const slot = G.HEROES[hs.id].abilities.indexOf(id);
    let s = `<b>${esc(ab.name)}</b> <span class="tt-key">[${G.KEYS[slot]}]</span>${ab.ult ? ' <span class="tt-ult">Ultimate</span>' : ''}${ab.passive ? ' <span class="tt-ult tt-passive">Passive</span>' : ''}<div class="tt-sub">Rank ${r} / ${ab.maxRank}</div>`;
    if (r && ab.passive) s += `<p>${esc(ab.desc(r, ab))}</p>`;
    else if (r) s += `<div class="tt-cost"><span class="mana">${G.abilityValue(ab.mana, r)} mana</span> · ${G.abilityValue(ab.cd, r)}s cooldown${ab.range ? ` · range ${ab.range}` : ''}</div><p>${esc(ab.desc(r, ab))}</p>`;
    if (r < ab.maxRank) {
      const req = G.abilityReqLevel(id, r + 1);
      s += `<div class="tt-next">Next rank (needs level ${req}):</div><p class="dim">${esc(ab.desc(r + 1, ab))}</p>`;
      if (G.canLearn(hs, id)) s += `<div class="tt-good">Shift+${G.KEYS[slot]} or the + button to learn.</div>`;
    }
    return s;
  }
  function itemTip(id, price, tome) {
    const it = G.ITEMS[id];
    const kind = { consumable: 'Consumable — click or press its number to use', equip: 'Equipment — works while carried', tome: 'Tome — use to read; the bonus is permanent' }[it.kind];
    let s = `<b class="${it.unique ? 'tt-unique' : ''}">${esc(it.name)}</b><div class="tt-sub">${kind}</div><p>${esc(it.desc)}</p>`;
    if (price) s += `<div class="tt-cost">${price}${COIN}${tome ? ' \u2014 tomes cost more each time you buy one' : ''}</div>`;
    else if (findModal('shop')) s += `<div class="tt-cost">Sells for ${G.sellPrice(id)}${COIN}</div>`;
    return s;
  }
  function statTip(k) {
    const e = G.input.activeHero(), s = e.stats;
    const T = {
      hp: `Health regenerates ${s.hpRegen.toFixed(1)}/s. Each point of Strength adds 19.`,
      mp: `Mana regenerates ${s.mpRegen.toFixed(1)}/s. Each point of Intelligence adds 13.`,
      dmg: `Attack every ${s.atkCd.toFixed(2)}s, range ${s.range}. The primary attribute adds damage.`,
      armor: `Reduces attack damage by ${Math.round(G.armorReduction(e.armor + (e.mods.armor || 0)) * 100)}%. Agility adds armor.`,
      str: `Strength ${s.baseStr} (+${s.str - s.baseStr} from items). Health and regeneration.`,
      agi: `Agility ${s.baseAgi} (+${s.agi - s.baseAgi} from items). Armor and attack speed.`,
      int: `Intelligence ${s.baseInt} (+${s.int - s.baseInt} from items). Mana and mana regeneration.`,
    };
    return T[k] ? esc(T[k]) : '';
  }

  /* ---------- panels ---------- */
  function heroTabs(p, current, onPick) {
    const tabs = h('div', { class: 'tabs' });
    for (const hs of G.state.party) {
      const t = h('button', { class: 'tab' + (hs.id === current ? ' on' : '') }, `<img src="${G.sprites.heroPortrait(hs.id)}" alt="">${esc(heroName(hs.id))} <small>Lv ${hs.level}</small>${G.canSpend(hs) ? ' <em>+</em>' : ''}`);
      t.addEventListener('click', () => onPick(hs.id));
      tabs.appendChild(t);
    }
    p.appendChild(tabs);
  }

  function openHero(heroId) {
    let cur = heroId || G.input.activeId;
    openModal('hero', (p, m) => {
      const hs = G.state.party.find((x) => x.id === cur) || G.state.party[0];
      const d = G.HEROES[hs.id], e = G.input.heroEnt(hs.id), s = e ? e.stats : G.heroStats(hs);
      header(p, 'Heroes', 'Spend skill points and check attributes (C)');
      heroTabs(p, hs.id, (id) => { cur = id; m.rebuild(); });
      const top = h('div', { class: 'hero-top' });
      top.innerHTML = `<img class="big-portrait" src="${G.sprites.heroPortrait(hs.id)}" alt="">
        <div><div class="hname">${esc(d.name)}</div><div class="sub">Level ${hs.level} ${esc(d.title)} · ${esc(d.role)}</div><p class="blurb">${esc(d.blurb)}</p>
        <div class="xpline"><div class="xpbar"><i style="width:${hs.level >= G.MAX_LEVEL ? 100 : 100 * hs.xp / G.xpToNext(hs.level)}%"></i></div><span>${hs.level >= G.MAX_LEVEL ? 'Max level' : `${hs.xp} / ${G.xpToNext(hs.level)} XP`}</span></div></div>`;
      p.appendChild(top);
      const grid = h('div', { class: 'hero-grid' });
      const stat = (label, val, extra = '', cls = '') => `<div class="st ${cls}"><span>${label}</span><b>${val}</b>${extra ? `<em>${extra}</em>` : ''}</div>`;
      const plus = (base, total) => (total > base ? `+${total - base} items` : '');
      grid.innerHTML = `<div class="stats">
        ${stat('Strength', s.str, plus(s.baseStr, s.str), d.primary === 'str' ? 'prim' : '')}
        ${stat('Agility', s.agi, plus(s.baseAgi, s.agi), d.primary === 'agi' ? 'prim' : '')}
        ${stat('Intelligence', s.int, plus(s.baseInt, s.int), d.primary === 'int' ? 'prim' : '')}
        ${stat('Health', s.maxHp, `${s.hpRegen.toFixed(1)}/s`)}${stat('Mana', s.maxMp, `${s.mpRegen.toFixed(1)}/s`)}
        ${stat('Damage', `${Math.round(s.dmg * 0.9)}–${Math.round(s.dmg * 1.1)}`, `${(1 / s.atkCd).toFixed(2)} attacks/s`)}
        ${stat('Armor', s.armor, `${Math.round(G.armorReduction(s.armor) * 100)}% reduction`)}${stat('Move speed', s.speed.toFixed(2))}
        ${stat('Tomes read', `+${hs.bonus.str} STR, +${hs.bonus.agi} AGI, +${hs.bonus.int} INT, +${hs.bonus.hp} HP`)}
        ${s.training ? stat('Training', `+${s.training} to all attributes`) : ''}
        </div>`;
      const abBox = h('div', { class: 'ab-list' });
      const nx = G.nextUnlockLevel(hs);
      const spText = !hs.skillPoints ? 'No unspent skill points'
        : G.canSpend(hs) ? `<b>${hs.skillPoints}</b> skill point${hs.skillPoints > 1 ? 's' : ''} to spend`
        : `${hs.skillPoints} skill point${hs.skillPoints > 1 ? 's' : ''} saved${nx ? ` \u2014 next use at level ${nx.level} (${esc(nx.name)})` : ''}`;
      abBox.appendChild(h('div', { class: 'sp-line' }, spText));
      d.abilities.forEach((id, i) => {
        const ab = G.ABILITIES[id], r = hs.ranks[id];
        const row = h('div', { class: 'ab-row' + (r ? '' : ' unlearned') });
        const nextL = r < ab.maxRank ? G.abilityReqLevel(id, r + 1) : null;
        const next = nextL && nextL > hs.level ? nextL : null;
        row.innerHTML = `<img src="${abIcon(id)}" alt=""><div class="ab-info"><div><b>${esc(ab.name)}</b> <span class="tt-key">[${G.KEYS[i]}]</span>${ab.ult ? ' <span class="tt-ult">Ultimate</span>' : ''}${ab.passive ? ' <span class="tt-ult tt-passive">Passive</span>' : ''} <span class="pipsx">${Array.from({ length: ab.maxRank }, (_, k) => `<i class="${k < r ? 'on' : ''}"></i>`).join('')}</span></div>
          <p>${esc(ab.desc(Math.max(1, r), ab))}</p>${r && !ab.passive ? `<div class="dim">${G.abilityValue(ab.mana, r)} mana · ${G.abilityValue(ab.cd, r)}s cooldown</div>` : ''}${next ? `<div class="dim">Next rank at level ${next}</div>` : ''}</div>`;
        const b = h('button', { class: 'btn small' + (G.canLearn(hs, id) ? ' primary' : '') }, r ? 'Rank up' : 'Learn');
        b.disabled = !G.canLearn(hs, id);
        b.addEventListener('click', () => { G.game.learn(hs, id); m.rebuild(); });
        row.appendChild(b);
        abBox.appendChild(row);
      });
      grid.appendChild(abBox);
      p.appendChild(grid);
    }, { cls: 'wide' });
  }

  function openPack() {
    openModal('pack', (p) => {
      header(p, 'Inventory', 'Drag items between heroes and the shared pack. Click to use or equip, right-click to stash.');
      const wrap = h('div', { class: 'pack-wrap' });
      for (const hs of G.state.party) {
        const col = h('div', { class: 'pack-hero' });
        col.innerHTML = `<div class="ph-head"><img src="${G.sprites.heroPortrait(hs.id)}" alt="">${esc(G.HEROES[hs.id].name)}</div><div class="slots six">${hs.items.map((it, i) => slotHtml(it, `h:${hs.id}:${i}`, i + 1)).join('')}</div>`;
        wrap.appendChild(col);
      }
      p.appendChild(wrap);
      p.appendChild(h('div', { class: 'pack-title' }, `Shared pack <span>${G.state.pack.length} / 24</span>`));
      const grid = h('div', { class: 'slots pack' });
      let html = G.state.pack.map((it, i) => slotHtml(it, `p:${i}`)).join('');
      for (let i = G.state.pack.length; i < 24; i++) html += `<div class="slot empty" data-loc="p:new"></div>`;
      grid.innerHTML = html;
      p.appendChild(grid);
      wireSlots(p, false);
    }, { cls: 'wide' });
  }

  function openShop(shopId, npcId) {
    const shop = G.SHOPS[shopId];
    let buyer = G.input.activeId;
    openModal('shop', (p, m) => {
      header(p, esc(shop.name), `${esc(G.NPCS[npcId].name)} · You have <b class="gold">${G.state.gold}</b>${COIN}`);
      p.appendChild(h('div', { class: 'buy-for' }, 'Buying for:'));
      heroTabs(p, buyer, (id) => { buyer = id; m.rebuild(); });
      const hs = G.state.party.find((x) => x.id === buyer);
      const cols = h('div', { class: 'shop-cols' });
      const list = h('div', { class: 'shop-list' });
      for (const entry of shop.items) {
        const it = G.ITEMS[entry.id];
        const locked = entry.unlock && !entry.unlock(G.state);
        const price = G.itemPrice(entry.id);
        const row = h('div', { class: 'shop-item' + (locked ? ' locked' : '') + (G.state.gold < price ? ' poor' : ''), 'data-tip': 'item', 'data-item': entry.id, 'data-price': price, 'data-tome': it.kind === 'tome' ? '1' : '' });
        row.innerHTML = `<img src="${itemIcon(entry.id)}" alt=""><div class="si-info"><b>${esc(it.name)}</b><span>${locked ? esc(entry.hint || 'Not yet available') : esc(it.desc)}</span></div><div class="si-price">${price}${COIN}</div>`;
        if (!locked) row.addEventListener('click', () => { buy(entry.id, hs); m.rebuild(); });
        list.appendChild(row);
      }
      cols.appendChild(list);
      const sell = h('div', { class: 'shop-sell' });
      sell.appendChild(h('div', { class: 'pack-title' }, `Sell from ${esc(heroName(hs.id))}’s bag or the pack (half price)`));
      const sg = h('div', { class: 'slots sellgrid' });
      const items = [...hs.items.map((it, i) => ({ it, loc: `h:${hs.id}:${i}` })), ...G.state.pack.map((it, i) => ({ it, loc: `p:${i}` }))].filter((x) => x.it);
      sg.innerHTML = items.length ? items.map(({ it, loc }) => `<div class="slot ${G.ITEMS[it.id].kind}" data-loc="${loc}" data-tip="item" data-item="${it.id}"><img src="${itemIcon(it.id)}" alt="">${it.n > 1 ? `<span class="n">${it.n}</span>` : ''}<span class="sp">${G.sellPrice(it.id)}${COIN}</span></div>`).join('') : '<p class="dim">Nothing to sell.</p>';
      sg.querySelectorAll('.slot').forEach((s) => s.addEventListener('click', () => { sellItem(s.dataset.loc); m.rebuild(); }));
      sell.appendChild(sg);
      cols.appendChild(sell);
      p.appendChild(cols);
    }, { cls: 'wide' });
  }
  function buy(id, hs) {
    const price = G.itemPrice(id);
    if (G.state.gold < price) { toast('Not enough gold.', 'bad'); G.audio.play('error'); return; }
    const it = G.ITEMS[id];
    if (it.kind === 'tome') {
      G.state.gold -= price;
      G.state.tomesBought[id] = (G.state.tomesBought[id] || 0) + 1;
      G.game.readTome(hs, id);
      G.audio.play('buy');
      return;
    }
    const where = G.game.giveItemTo(hs, id, 1);
    if (!where) { toast('No room in that hero’s bag or the pack.', 'bad'); G.audio.play('error'); return; }
    G.state.gold -= price;
    toast(`Bought ${it.name}${where === 'pack' ? ' (to pack)' : ''}.`);
    G.audio.play('buy');
    UI.dirty = true;
  }
  function sellItem(loc) {
    const L = getLoc(loc);
    const it = L.arr[L.i];
    if (!it) return;
    G.state.gold += G.sellPrice(it.id);
    it.n--;
    if (it.n <= 0) { if (L.pack) L.arr.splice(L.i, 1); else L.arr[L.i] = null; }
    if (L.hs) { const e = G.input.heroEnt(L.hs.id); if (e) G.world.refreshHero(e); }
    G.audio.play('coin');
    invKey = ''; UI.dirty = true;
  }

  function openLog() {
    let sel = null;
    openModal('log', (p, m) => {
      header(p, 'Quest Log', 'Act I · The Ember Road');
      const ids = Object.keys(G.state.quests);
      const active = ids.filter((id) => G.state.quests[id].s !== 'done').sort((a, b) => (G.QUESTS[b].main ? 1 : 0) - (G.QUESTS[a].main ? 1 : 0));
      const done = ids.filter((id) => G.state.quests[id].s === 'done');
      sel = sel || active[0] || done[0];
      const cols = h('div', { class: 'log-cols' });
      const list = h('div', { class: 'log-list' });
      const item = (id) => {
        const d = G.QUESTS[id], q = G.state.quests[id];
        const b = h('div', { class: 'log-item' + (id === sel ? ' on' : '') + (q.s === 'done' ? ' done' : '') }, `${d.main ? '<i class="main-dot"></i>' : ''}${esc(d.name)}${q.s === 'ready' ? ' <em>(complete)</em>' : ''}`);
        b.addEventListener('click', () => { sel = id; m.rebuild(); });
        list.appendChild(b);
      };
      list.appendChild(h('div', { class: 'log-sec' }, `Active (${active.length})`));
      active.forEach(item);
      if (!active.length) list.appendChild(h('p', { class: 'dim' }, 'Nothing right now. Look for a gold “!” over someone’s head.'));
      list.appendChild(h('div', { class: 'log-sec' }, `Completed (${done.length})`));
      done.forEach(item);
      cols.appendChild(list);
      const det = h('div', { class: 'log-detail' });
      if (sel) {
        const d = G.QUESTS[sel], q = G.state.quests[sel];
        const rw = d.rewards || {};
        const rws = [rw.xp ? `${rw.xp} XP` : '', rw.gold ? `${rw.gold} gold` : '', ...(rw.items || []).map(([id, n]) => `${G.ITEMS[id].name}${n > 1 ? ' ×' + n : ''}`)].filter(Boolean).join(', ');
        det.innerHTML = `<h4>${esc(d.name)}${d.main ? ' <span class="tag">Main story</span>' : ' <span class="tag side">Side quest</span>'}</h4><p>${esc(d.summary)}</p>
          <ul class="objs">${d.objectives.map((o, i) => `<li class="${q.p[i] >= o.count || q.s === 'done' ? 'ok' : ''}">${esc(o.text)}${o.count > 1 ? ` (${Math.min(q.p[i], o.count)}/${o.count})` : ''}</li>`).join('')}
          ${q.s === 'ready' ? `<li class="ready">Return to ${esc(G.NPCS[d.turnIn].name)}</li>` : ''}</ul>${rws ? `<div class="rewards">Rewards: ${esc(rws)}</div>` : ''}`;
      }
      cols.appendChild(det);
      p.appendChild(cols);
    }, { cls: 'wide' });
  }

  function openWaystone(wsId) {
    openModal('waystone', (p) => {
      header(p, `Waystone: ${esc(G.WAYSTONES[wsId].name)}`, 'Touch a waystone to rest, or step through to any other you have attuned.');
      const danger = G.world.entities.some((e) => e.team === 'enemy' && !e.dead && G.util.dist(e, G.input.activeHero()) < 9);
      const rest = h('button', { class: 'btn primary' }, 'Rest (restore health and mana, revive the fallen)');
      rest.disabled = danger;
      rest.addEventListener('click', () => { G.game.restParty(); closeTop(); toast('The waystone hums. The party feels renewed.'); });
      p.appendChild(rest);
      if (danger) p.appendChild(h('p', { class: 'dim' }, 'Enemies are too close to rest or travel.'));
      p.appendChild(h('div', { class: 'pack-title' }, 'Travel'));
      const list = h('div', { class: 'ws-list' });
      for (const id in G.WAYSTONES) {
        if (id === wsId) continue;
        if (G.WAYSTONES[id].feature && !G.FEATURES[G.WAYSTONES[id].feature]) continue;
        const known = G.state.waystones[id];
        const wz = G.zoneWarn(G.WAYSTONES[id].zone);
        const b = h('button', { class: 'btn ws-btn' }, known ? `${esc(G.WAYSTONES[id].name)}${wz ? ` <span class="ws-rec" style="color:${wz.color}">${esc(wz.text)}</span>` : ' <span class="ws-rec dim">Safe</span>'}` : '<span class="dim">Not yet attuned</span>');
        b.disabled = !known || danger;
        b.addEventListener('click', () => { closeTop(); G.game.travel(id); });
        list.appendChild(b);
      }
      p.appendChild(list);
    }, { cls: 'small' });
  }

  function openMenu() {
    openModal('menu', (p) => {
      header(p, 'Menu', `Embervale · Act I · ${G.util.fmtTime(G.state.playTime)} played`);
      const col = h('div', { class: 'menu-col' });
      const b = (label, fn, cls = '') => { const x = h('button', { class: 'btn ' + cls }, label); x.addEventListener('click', fn); col.appendChild(x); return x; };
      b('Resume', () => closeTop(), 'primary');
      b('Save / Load', () => openSaves(true));
      b('Export save to JSON file', () => G.save.exportJson());
      b('Import save from JSON file', () => $('#import-file').click());
      b('Controls', () => showHelp(false));
      b('Settings', () => openSettings());
      b('Quit to title', () => confirmBox('Quit to the title screen? Anything since your last save will be lost (the game autosaves when you change zones and finish quests).', () => { closeAll(); G.game.quitToTitle(); }));
      p.appendChild(col);
    }, { cls: 'small' });
  }

  function openSaves(inGame) {
    openModal('saves', (p, m) => {
      header(p, inGame ? 'Save / Load' : 'Load Game', 'Saves are stored in this browser. Export to JSON to keep a copy elsewhere.');
      for (const { slot, data } of G.save.list()) {
        const row = h('div', { class: 'save-row' });
        const name = slot === 'auto' ? 'Autosave' : `Slot ${slot}`;
        const info = data && !G.save.validate(data) ? `${esc(data.meta.zone)} · level ${data.meta.level} · ${data.meta.party.map((x) => heroName(x)).join(', ')} · ${G.util.fmtTime(data.meta.playTime)} · ${new Date(data.savedAt).toLocaleString()}` : '<span class="dim">Empty</span>';
        row.innerHTML = `<div><b>${name}</b><div class="dim small">${info}</div></div>`;
        const btns = h('div', { class: 'row' });
        if (inGame && slot !== 'auto') { const s = h('button', { class: 'btn small primary' }, 'Save'); s.addEventListener('click', () => { if (G.save.write(slot)) m.rebuild(); }); btns.appendChild(s); }
        if (data) {
          const l = h('button', { class: 'btn small' }, 'Load');
          l.addEventListener('click', () => { const go = () => { closeAll(); G.save.load(data); }; inGame ? confirmBox('Load this save? Unsaved progress will be lost.', go) : go(); });
          btns.appendChild(l);
          if (slot !== 'auto') { const d = h('button', { class: 'btn small danger' }, 'Delete'); d.addEventListener('click', () => confirmBox(`Delete ${name}?`, () => { G.save.remove(slot); m.rebuild(); })); btns.appendChild(d); }
        }
        row.appendChild(btns);
        p.appendChild(row);
      }
    }, { cls: 'mid' });
  }

  function openSettings() {
    openModal('settings', (p) => {
      header(p, 'Settings', 'Stored in this browser');
      const S = G.settings;
      const row = (label, input) => { const r = h('label', { class: 'set-row' }, `<span>${label}</span>`); r.appendChild(input); p.appendChild(r); };
      const chk = (key) => { const i = h('input', { type: 'checkbox' }); i.checked = !!S[key]; i.addEventListener('change', () => { S[key] = i.checked; G.saveSettings(); G.audio.applyVolumes(); }); return i; };
      const slider = (key, label, test) => {
        const v = h('input', { type: 'range', min: 0, max: 1, step: 0.05 }); v.value = S[key];
        v.addEventListener('input', () => { S[key] = +v.value; G.saveSettings(); G.audio.applyVolumes(); });
        if (test) v.addEventListener('change', () => G.audio.play(test));
        row(label, v);
      };
      slider('volume', 'Overall volume', 'quest');
      slider('music', 'Music');
      slider('ambience', 'Ambience (wind, birds, crickets…)');
      slider('effects', 'Sound effects', 'hit');
      row('Mute', chk('muted'));
      row('Zone atmosphere (particles, weather, wall torches)', chk('atmosphere'));
      row('Show FPS (frame rate in the corner)', chk('showFps'));
      row('Pan the camera at screen edges', chk('edgePan'));
      row('Always show enemy health bars', chk('allBars'));
      row('Quick-cast (abilities fire at the cursor without a click)', chk('quickCast'));
    }, { cls: 'small' });
  }

  function showHelp(first) {
    openModal('help', (p) => {
      header(p, first ? 'How to play' : 'Controls', first ? 'You can reopen this from Menu → Controls.' : '');
      p.appendChild(h('div', { class: 'help' }, `
        <div><h4>Mouse</h4><ul>
          <li><b>Right-click</b> ground to move, an enemy to attack, a person or object to talk/use.</li>
          <li><b>Left-click</b> a hero or portrait to select. Drag a box to select several. Shift-click adds.</li>
          <li><b>Left-click</b> an enemy to show its health and level at the top of the screen.</li>
          <li><b>Wheel</b> zooms. <b>Middle-drag</b> or the minimap pans. Right-click the minimap to move there.</li></ul></div>
        <div><h4>Keyboard</h4><ul>
          <li><b>Q W E R</b> cast abilities. <b>Shift+Q/W/E/R</b> learns or ranks them up.</li>
          <li><b>1–6</b> use items. <b>A</b> attack-move, <b>S</b> stop, <b>H</b> hold.</li>
          <li><b>F1–F3</b> pick a hero (tap twice to find them), <b>Tab</b> cycles the active hero, <b>Ctrl+A</b> or <b>\`</b> selects everyone.</li>
          <li><b>Space</b> recenters the camera, arrows pan. <b>I</b> pack, <b>C</b> heroes, <b>L</b> quests, <b>P</b> pause, <b>Esc</b> menu.</li></ul></div>
        <div><h4>Controller</h4><ul>
          <li>Left stick moves, right stick pans. <b>A</b> attacks the nearest enemy or talks/uses what’s close.</li>
          <li><b>X Y B RB</b> cast (auto-targeted). Hold <b>LB</b> while pressing one to learn it. <b>LB</b> alone cycles heroes.</li>
          <li><b>LT / RT</b> use item slots 1 and 2. D-pad up selects all, down selects one. Start opens the menu.</li></ul></div>
        <div><h4>Tips</h4><ul>
          <li>Gold <b>!</b> means a quest to take; gold <b>?</b> means one to hand in.</li>
          <li>If the whole party falls you wake in Hollowmere with all experience kept. A fallen hero gets back up once the fight is over.</li>
          <li>Cleared camps return after a while when you re-enter a zone, so old areas are good for a little grinding.</li>
          <li>Ilse sells tomes that raise attributes permanently. They get pricier each time.</li></ul></div>`));
      const r = h('div', { class: 'row end' });
      r.appendChild(h('button', { class: 'btn primary', onclick: () => closeTop() }, first ? 'Let’s go' : 'Close'));
      p.appendChild(r);
    }, { cls: 'wide' });
  }

  function showWipe(cb) {
    openModal('wipe', (p) => {
      p.appendChild(h('h2', { class: 'wipe-title' }, 'The party has fallen'));
      p.appendChild(h('p', {}, 'Strangers carry you back to Hollowmere. Your experience and belongings are safe.'));
      const r = h('div', { class: 'row center' });
      r.appendChild(h('button', { class: 'btn primary', onclick: () => { closeKind('wipe'); cb(); } }, 'Wake in Hollowmere'));
      p.appendChild(r);
    }, { cls: 'small center', locked: true });
  }

  function showActComplete() {
    openModal('act', (p) => {
      p.appendChild(h('div', { class: 'act-title' }, 'Act I Complete'));
      p.appendChild(h('div', { class: 'act-sub' }, 'The Ember Road'));
      p.appendChild(h('p', {}, 'The Cinder Warden is ash and Hollowmere sleeps easy for a night. But the Kindler has fled up the mountain, and the Ember Cult is not finished.'));
      p.appendChild(h('div', { class: 'act-stats' }, `<div><b>${G.util.fmtTime(G.state.playTime)}</b><span>time played</span></div><div><b>${G.partyLevel()}</b><span>party level</span></div><div><b>${G.state.kills}</b><span>foes defeated</span></div><div><b>${Object.values(G.state.quests).filter((q) => q.s === 'done').length}</b><span>quests completed</span></div>`));
      p.appendChild(h('p', { class: 'dim' }, G.FEATURES.underhollow
        ? 'Act II is still being written. Until then, Elder Odrin has heard something stirring beneath Hollowmere. Talk to him when you\u2019re ready to go deeper. Your save is ready for the next act.'
        : 'Act II is still being written. You can keep exploring, finish side quests and hunt the optional bosses. Your save is ready for the next act.'));
      const r = h('div', { class: 'row center' });
      r.appendChild(h('button', { class: 'btn', onclick: () => G.save.exportJson() }, 'Export save'));
      r.appendChild(h('button', { class: 'btn primary', onclick: () => closeKind('act') }, 'Keep playing'));
      p.appendChild(r);
    }, { cls: 'mid center', locked: true });
  }

  return Object.assign(UI, {
    init, showTitle, showGame, fade, setPaused, toast, modal, closeTop, closeAll, dialog, closeDialog, dialogSeq, dialogPrimary,
    refreshQuests, refreshAll, update, setEvent, onZoneLoaded, openHero, openPack, openShop, openLog, openWaystone, openMenu, showHelp, showWipe, showActComplete,
  });
})();
