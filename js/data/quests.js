/* NPCs, quests and dialogue for Act I: "The Ember Road". */

G.NPCS = {
  odrin: { name: 'Elder Odrin', title: 'Elder of Hollowmere', look: { shape: 'humanoid', color: '#5e4b7a', accent: '#e8e0d0', beard: true, staff: true },
    greet: 'The Vale remembers its wardens, Maren. Even the ones who left.' },
  wenna: { name: 'Wenna', title: 'Keeper of the Low Lantern', look: { shape: 'humanoid', color: '#9b4a3c', accent: '#f2d7b6', apron: true }, rest: true,
    greet: 'Warm beds, hot broth, and I patch up anything that still has a pulse.' },
  brannoc: { name: 'Brannoc', title: 'Smith', look: { shape: 'humanoid', color: '#4a4a52', accent: '#d9b48a', apron: true, big: true }, shop: 'smith',
    greet: 'Steel is honest. Mostly. Have a look.' },
  ilse: { name: 'Ilse', title: 'Arcanist', look: { shape: 'humanoid', color: '#2e4f8a', accent: '#e9e2ff', hood: true, staff: true }, shop: 'arcanist',
    greet: 'Tomes, trinkets, and the occasional regret. The tomes are the good part.' },
  marta: { name: 'Marta', title: 'Provisioner', look: { shape: 'humanoid', color: '#6d7a3a', accent: '#f0d9b0', apron: true }, shop: 'provisioner',
    greet: 'Draughts, tonics, and scrolls that will drag you home by the collar.' },
  bryn: { name: 'Bryn', title: 'Tanner', look: { shape: 'humanoid', color: '#7a5a3a', accent: '#e6c9a0' },
    greet: 'Mind the smell. The smell is how you know the leather is good.' },
  ossa: { name: 'Ossa', title: 'Huntmaster', look: { shape: 'humanoid', color: '#3f5a3a', accent: '#d8c6a0', hood: true, bow: true },
    greet: 'Quiet steps, sharp eyes. That is all hunting is.' },
  hesk: { name: 'Farmer Hesk', title: 'Brindle farmer', look: { shape: 'humanoid', color: '#8a6a3a', accent: '#f0d7a8', hat: true },
    greet: 'Good soil, bad luck. That is Brindle for you.' },
  ovan: { name: 'Ovan', title: 'Miller', look: { shape: 'humanoid', color: '#7a7a6a', accent: '#f2ead8', hat: true, apron: true },
    greet: 'The mill grinds whether or not anyone is watching. I would prefer someone was.' },
  pell: { name: 'Pell', title: 'Wandering peddler', look: { shape: 'humanoid', color: '#8a5a8a', accent: '#f5e0c0', hat: true, pack: true }, shop: 'pell',
    greet: 'Still picking spider spit out of my hair. Buy something, it helps me cope.' },
  ysolde_npc: { name: 'Ysolde Vane', title: 'Ember Hunter', look: { hero: 'ysolde' } },
};

G.QUESTS = {
  /* ---------------- Main story ---------------- */
  ashes_road: {
    markers: [{ zone: 'brindle', x: 21, y: 39 }],
    name: 'Ashes on the Road', main: true, giver: 'odrin', turnIn: 'odrin',
    summary: 'Boars in Brindle Fields have gone wild, ash caked in their bristles. Thin them out.',
    objectives: [{ type: 'kill', unit: 'boar', count: 6, text: 'Brindle boars slain' }],
    offer: [
      'Maren Ashvow. Twelve years, and you walk back in like you only stepped out for bread.',
      'I won’t pretend we don’t need you. The boars in Brindle Fields have gone mad. Ash in their bristles, charging the carts. Six fewer of them should send the rest running.',
      'Brindle Fields is north-east of the village. Follow the road out past the inn.',
    ],
    progress: 'The fields won’t wait, warden.',
    complete: 'Ash in their bristles. The mountain is stirring again, isn’t it. I was afraid of that.',
    rewards: { xp: 220, gold: 90, items: [['healing_draught', 2]] },
  },
  missing_shaman: {
    markers: [{ zone: 'whisperwood', x: 35.5, y: 28.5 }],
    name: 'The Missing Shaman', main: true, giver: 'odrin', req: { quests: ['ashes_road'] }, autoComplete: true,
    summary: 'Tobin Reedwhistle went into Whisperwood four days ago and never came back. Bandits have been seen in the trees.',
    objectives: [{ type: 'interact', id: 'cage_tobin', count: 1, text: 'Find and free Tobin Reedwhistle' }],
    offer: [
      'There is worse news. Tobin Reedwhistle, our hedge-shaman, went into Whisperwood to gather rain-moss. Four days ago.',
      'Woodcutters say there are bandits in the trees now, armed and organized. Tobin knows the old binding songs. I don’t like who might want those.',
      'Whisperwood lies north-west of the village. Bring him home.',
    ],
    progress: 'Whisperwood is north-west. Please, Maren.',
    rewards: { xp: 300, gold: 60 },
    onComplete: () => {
      G.game.recruit('tobin');
      G.ui.dialogSeq([
        { who: 'tobin', text: 'Oh, thank the rain. They kept asking me to sing the binding songs backwards. You don’t sing those backwards.' },
        { who: 'tobin', text: 'Their chief is Grell Thornjaw. He’s paid in ember-glass by robed folk who smell like a forge. He holds the old stockade at the north end of the wood.' },
        { who: 'tobin', text: 'I would very much like to watch you knock him over. I can help. I’m better with lightning than I look.' },
      ], () => G.quests.accept('thornjaw'));
    },
  },
  thornjaw: {
    markers: [{ zone: 'whisperwood', x: 12, y: 9 }],
    name: 'Thornjaw’s Stockade', main: true, giver: null, turnIn: 'odrin',
    summary: 'Grell Thornjaw’s bandits answer to someone paying in ember-glass. Break the gang at the stockade in northern Whisperwood.',
    objectives: [{ type: 'kill', unit: 'grell', count: 1, text: 'Defeat Grell Thornjaw' }],
    progress: 'Grell still breathes? Then the roads aren’t safe.',
    complete: 'Grell Thornjaw, dead. And paid in ember-glass, you say. Then someone up the mountain wants our shaman’s songs. Ovan sent word from the mill in Brindle. He has seen torches on the barrow road at night. Go to him.',
    rewards: { xp: 520, gold: 220, items: [['greater_healing', 2]] },
  },
  hold_mill: {
    markers: [{ zone: 'brindle', x: 40, y: 27 }],
    name: 'Hold the Mill', main: true, giver: 'ovan', req: { quests: ['thornjaw'] }, autoComplete: true,
    summary: 'Ember cultists are coming down the barrow road. Defend Ovan’s mill through three waves.',
    objectives: [{ type: 'flag', flag: 'millSaved', count: 1, text: 'Defend the mill (3 waves)' }],
    offer: [
      'Torches, every night, coming down from the barrow gate. Last night they tried the mill door.',
      'They’ll come in force tonight, I can feel it. I can’t hold this place alone. Will you stand with me?',
    ],
    acceptLabel: 'We’re ready. Let them come.',
    progress: 'Here they come!',
    rewards: { xp: 600, gold: 250 },
    onAccept: () => G.events.startMill(),
    onComplete: () => {
      G.state.flags.ysoldeWaiting = true;
      G.world.refreshNpcs();
      G.ui.toast('A hunter steps out of the smoke near the mill.');
    },
  },
  barrows: {
    markers: [{ zone: 'barrows', x: 28, y: 9, flag: 'sealsBroken' }, { zone: 'barrows', x: 7.5, y: 29.5, obj: 'seal_a' }, { zone: 'barrows', x: 45, y: 29.5, obj: 'seal_b' }, { zone: 'barrows', x: 11.5, y: 13, obj: 'seal_c' }],
    name: 'The Cinder Warden', main: true, giver: null, turnIn: 'odrin',
    summary: 'The Ember Cult is waking an ancient guardian in the Ashen Barrows. Break the three ember seals, then destroy the Warden.',
    objectives: [
      { type: 'interact', kind: 'seal', count: 3, text: 'Ember seals shattered' },
      { type: 'kill', unit: 'cinder_warden', count: 1, text: 'Destroy the Cinder Warden' },
    ],
    progress: 'Is it done? Is the mountain quiet?',
    complete: 'So the Warden is ash, and their Kindler fled up the mountain. Then this isn’t over. But tonight, Hollowmere sleeps easy for the first time in a month. Rest, all of you. You’ve earned it.',
    rewards: { xp: 800, gold: 400 },
    onComplete: () => G.game.actComplete(),
  },

  /* ---------------- Side quests ---------------- */
  grain: {
    markers: [{ zone: 'brindle', x: 39, y: 43 }],
    name: 'Spilled Grain', giver: 'hesk', turnIn: 'hesk',
    summary: 'Wolves scattered Farmer Hesk’s grain sacks across the east field.',
    objectives: [{ type: 'collect', item: 'grain', count: 5, text: 'Grain sacks gathered' }],
    offer: ['Wolves hit my wagon at the edge of the field and the sacks went everywhere. If you can grab five of them, I’ll make it worth your while.'],
    progress: 'Five sacks. The wolves won’t mind. Well, they will.',
    complete: 'Bless you. That’s bread for the winter. Here, take these, and this bit of coin.',
    rewards: { xp: 160, gold: 80, items: [['healing_draught', 2]] },
  },
  wolf_pelts: {
    name: 'Good Hides', giver: 'bryn', turnIn: 'bryn',
    summary: 'Bryn the tanner wants six pelts from the field wolves of Brindle.',
    objectives: [{ type: 'collect', item: 'pelt', count: 6, text: 'Wolf pelts' }],
    offer: ['Those field wolves have the best pelts this side of the river. Bring me six and I’ll stitch you a cloak that’ll turn a bite.'],
    progress: 'Six pelts. Clean cuts if you can manage it.',
    complete: 'Fine hides. Here, as promised. Wear it in good health.',
    rewards: { xp: 200, gold: 40, items: [['wolfhide_cloak', 1]] },
  },
  greymane: {
    markers: [{ zone: 'brindle', x: 9, y: 9 }],
    name: 'The Old Alpha', giver: 'ossa', turnIn: 'ossa', req: { level: 4 },
    summary: 'A huge grey wolf haunts the northern tip of Brindle Fields. Ossa wants it dead.',
    objectives: [{ type: 'kill', unit: 'greymane', count: 1, text: 'Slay Greymane' }],
    offer: ['There’s an old alpha in the north-west of Brindle, grey as frost. He’s killed two of my hounds and he’s getting bolder. Bring him down. Go carefully: he doesn’t hunt alone.'],
    progress: 'Greymane still runs. I can hear him at night.',
    complete: 'Greymane. Gods, look at the size of him. You’ve done the Vale a kindness. Take this, I’ve no use for it at my age.',
    rewards: { xp: 320, gold: 140, items: [['tome_grace', 1]] },
  },
  glowcaps: {
    markers: [{ zone: 'whisperwood', x: 40, y: 36 }],
    name: 'Light in the Woods', giver: 'wenna', turnIn: 'wenna', req: { quests: ['ashes_road'] },
    summary: 'Wenna needs six glowcap mushrooms from Whisperwood for her remedies.',
    objectives: [{ type: 'collect', item: 'glowcap', count: 6, text: 'Glowcaps picked' }],
    offer: ['Glowcaps grow in Whisperwood wherever the light gets in. Bring me six and I’ll brew something worth carrying.'],
    progress: 'Six glowcaps. They glow, so they’re hard to miss.',
    complete: 'Lovely. These will keep half the village on its feet. Here, three herbs for the road, freshly steeped.',
    rewards: { xp: 260, gold: 60, items: [['rejuvenation_herb', 3]] },
  },
  webbed_peddler: {
    name: 'A Peddler in Silk', giver: null, autoComplete: true,
    summary: 'Someone is stuck in a spider cocoon in the spider hollow, east Whisperwood.',
    objectives: [{ type: 'interact', id: 'cocoon_pell', count: 1, text: 'Cut open the cocoon' }],
    rewards: { xp: 160, gold: 0 },
    onComplete: () => {
      G.state.flags.pellFreed = true;
      G.world.refreshNpcs();
      G.ui.dialogSeq([{ who: 'pell', text: 'Ugh! Spider spit! You’ve earned a discount. Not a big one. I’ll set up shop right here. Business is business.' }]);
    },
  },
  bogmother: {
    markers: [{ zone: 'mirefen', x: 11, y: 42 }],
    name: 'Mother of the Fen', giver: 'ossa', turnIn: 'ossa', req: { level: 5 },
    summary: 'Something huge is drowning cattle in the Mirefen, south-west of Whisperwood.',
    objectives: [{ type: 'kill', unit: 'bogmother', count: 1, text: 'Slay the Bogmother' }],
    offer: ['Past the south-west edge of Whisperwood lies the Mirefen. Something big has been dragging cattle into the water. The marsh folk call her the Bogmother. She spawns little ones, so don’t dawdle.'],
    progress: 'The Bogmother lives on the western shore of the fen. Bring rope and courage.',
    complete: 'You actually did it. The marsh folk will sing about this, badly. Take this purse and a tome I’ve been saving.',
    rewards: { xp: 620, gold: 260, items: [['tome_vigor', 1]] },
  },
};

/* ---------------- Quest engine ---------------- */
G.quests = (() => {
  const st = () => G.state.quests;
  const def = (id) => G.QUESTS[id];

  const status = (id) => {
    const q = st()[id];
    if (q) return q.s; // 'active' | 'ready' | 'done'
    const d = def(id);
    if (!d.giver) return 'locked';
    const req = d.req || {};
    if (req.quests && !req.quests.every((r) => st()[r] && st()[r].s === 'done')) return 'locked';
    if (req.level && G.partyLevel() < req.level) return 'locked';
    return 'available';
  };
  const isDone = (id) => status(id) === 'done';
  const isActive = (id) => ['active', 'ready'].includes(status(id));

  function accept(id) {
    if (st()[id]) return;
    const d = def(id);
    st()[id] = { s: 'active', p: d.objectives.map(() => 0) };
    G.ui.toast(`New quest: ${d.name}`, 'quest');
    G.audio.play('quest');
    // collect objectives may already be satisfied by earlier pickups
    d.objectives.forEach((o, i) => {
      if (o.type === 'flag' && G.state.flags[o.flag]) st()[id].p[i] = 1;
      // a unique foe slain before the quest was taken still counts
      if (o.type === 'kill' && G.state.uniques[o.unit]) st()[id].p[i] = o.count;
    });
    if (d.onAccept) d.onAccept();
    check(id);
    G.ui.refreshQuests();
  }

  function check(id) {
    const q = st()[id];
    if (!q || q.s !== 'active') return;
    const d = def(id);
    const done = d.objectives.every((o, i) => q.p[i] >= o.count);
    if (done) {
      if (d.autoComplete) complete(id);
      else { q.s = 'ready'; G.ui.toast(`${d.name}: return to ${G.NPCS[d.turnIn].name}`, 'quest'); G.audio.play('quest'); }
    }
    G.ui.refreshQuests();
  }

  function complete(id) {
    const q = st()[id];
    const d = def(id);
    q.s = 'done';
    const rw = d.rewards || {};
    if (rw.xp) G.game.partyXp(rw.xp, true);
    if (rw.gold) G.game.addGold(rw.gold);
    for (const [it, n] of rw.items || []) G.game.giveItem(it, n);
    G.ui.toast(`Quest complete: ${d.name}`, 'done');
    G.audio.play('complete');
    if (d.onComplete) d.onComplete();
    G.ui.refreshQuests();
    G.save.auto();
  }

  function bump(match) {
    for (const id in st()) {
      const q = st()[id];
      if (q.s !== 'active') continue;
      const d = def(id);
      d.objectives.forEach((o, i) => {
        if (q.p[i] >= o.count) return;
        if (match(o)) { q.p[i]++; if (o.type !== 'kill' || o.count > 1) G.ui.toast(`${o.text}: ${q.p[i]}/${o.count}`, 'progress'); }
      });
      check(id);
    }
  }

  const onKill = (unitId) => bump((o) => o.type === 'kill' && o.unit === unitId);
  const onCollect = (item) => bump((o) => o.type === 'collect' && o.item === item);
  const onInteract = (obj) => bump((o) => o.type === 'interact' && (o.id === obj.id || (o.kind && o.kind === obj.kind)));
  const onFlag = (flag) => bump((o) => o.type === 'flag' && o.flag === flag);
  // Is a quest pickup/drop currently useful?
  const wants = (item) => Object.keys(st()).some((id) => {
    const q = st()[id];
    if (q.s !== 'active') return false;
    return def(id).objectives.some((o, i) => o.type === 'collect' && o.item === item && q.p[i] < o.count);
  });

  function marker(npcId) {
    if (npcId === 'ysolde_npc') return 'available';
    let m = null;
    for (const id in G.QUESTS) {
      const d = def(id), s = status(id);
      if (d.turnIn === npcId && s === 'ready') return 'ready';
      if (d.giver === npcId && s === 'available') m = 'available';
      if (!m && d.turnIn === npcId && s === 'active') m = 'active';
    }
    return m;
  }

  function reset(id) { delete st()[id]; G.ui.refreshQuests(); }

  /* --- talking to an NPC --- */
  function talk(npcId) {
    const n = G.NPCS[npcId];
    if (npcId === 'ysolde_npc') return talkYsolde();
    // Ready quests first
    for (const id in G.QUESTS) {
      const d = def(id);
      if (d.turnIn === npcId && status(id) === 'ready') {
        G.ui.dialog({ npc: npcId, text: d.complete, buttons: [{ label: `Complete: ${d.name}`, primary: true, onClick: () => { complete(id); G.ui.closeDialog(); if (id !== 'barrows') talk(npcId); } }] });
        return;
      }
    }
    const buttons = [];
    for (const id in G.QUESTS) {
      const d = def(id);
      if (d.giver === npcId && status(id) === 'available') buttons.push({ label: `❗ ${d.name}`, primary: true, onClick: () => offer(npcId, id) });
    }
    let text = n.greet;
    for (const id in G.QUESTS) {
      const d = def(id);
      if ((d.turnIn === npcId || d.giver === npcId) && status(id) === 'active' && d.progress) { text = d.progress; break; }
    }
    if (n.shop) buttons.push({ label: 'Trade', onClick: () => { G.ui.closeDialog(); G.ui.openShop(n.shop, npcId); } });
    if (n.rest) buttons.push({ label: 'Rest (heal and revive the party)', onClick: () => { G.game.restParty(); G.ui.closeDialog(); G.ui.toast('The party rests and recovers.'); } });
    buttons.push({ label: 'Farewell', onClick: () => G.ui.closeDialog() });
    G.ui.dialog({ npc: npcId, text, buttons });
  }

  function offer(npcId, id) {
    const d = def(id);
    const pages = d.offer.slice();
    const show = (i) => {
      const last = i === pages.length - 1;
      G.ui.dialog({ npc: npcId, title: d.name, text: pages[i], buttons: last
        ? [{ label: d.acceptLabel || 'Accept', primary: true, onClick: () => { G.ui.closeDialog(); accept(id); } }, { label: 'Not yet', onClick: () => G.ui.closeDialog() }]
        : [{ label: 'Continue', primary: true, onClick: () => show(i + 1) }] });
    };
    show(0);
  }

  function talkYsolde() {
    G.ui.dialogSeq([
      { who: 'ysolde', text: 'Nicely held. I’ve been tracking those zealots from the coast. They call themselves the Ember Cult.' },
      { who: 'ysolde', text: 'One of the ones you dropped carried this: a key of ember-glass. It fits the barrow door at the north-east end of these fields.' },
      { who: 'ysolde', text: 'Their leader, the Kindler, is waking something down there. I’d rather not go in alone, and you’re better company than the last three hunters I hired.' },
      { who: 'maren', text: 'Then we go together. Hollowmere has buried enough people because of that mountain.' },
    ], () => {
      G.state.flags.ysoldeWaiting = false;
      G.state.flags.barrowsOpen = true;
      G.world.grid.setGate('barrowsOpen', true);
      G.world.refreshNpcs();
      G.game.recruit('ysolde');
      accept('barrows');
    });
  }

  return { status, isDone, isActive, accept, complete, onKill, onCollect, onInteract, onFlag, wants, marker, talk, reset };
})();

/* Where should the minimap point? Active quest markers in this zone, or the exit
   that leads toward the zone they are in. */
G.questTargets = () => {
  const out = [];
  const here = G.world.zoneId;
  const route = (to) => {
    // breadth-first search over zone exits
    const prev = { [here]: null }; const q = [here];
    while (q.length) { const z = q.shift(); if (z === to) break; for (const ex of G.ZONES[z].exits) if (!(ex.to in prev)) { prev[ex.to] = { z, ex }; q.push(ex.to); } }
    if (!(to in prev)) return null;
    let cur = to, step = null;
    while (prev[cur]) { step = prev[cur]; cur = step.z; }
    return step ? step.ex : null;
  };
  for (const id in G.state.quests) {
    const q = G.state.quests[id], d = G.QUESTS[id];
    if (q.s !== 'active' || !d.markers) continue;
    for (const m of d.markers) {
      if (m.obj && G.state.objects[m.zone] && G.state.objects[m.zone][m.obj] != null) continue;
      if (m.flag && !G.state.flags[m.flag]) continue;
      if (m.zone === here) out.push(m);
      else { const ex = route(m.zone); if (ex && !out.includes(ex)) out.push(ex); }
    }
  }
  return out;
};
