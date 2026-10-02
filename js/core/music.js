/* Music and ambience.
   - Each zone has a looping theme built from the synth instruments in audio.js.
     Every theme has a combat layer (drums, bass) that fades in during fights.
   - Bosses switch to the Ashen Barrows theme with its combat layer up.
   - Themes crossfade on zone changes, and music dips while a dialogue or menu is open.
   - Each zone also has a bed of background sound (birds, crickets, frogs, drips, embers).
   - Recorded tracks: list a file in G.MUSIC_FILES and it plays instead of the synth
     theme (see the README). */

// Optional recorded music, by theme id. Example:  hollowmere: 'music/hollowmere.mp3'
// A '<id>_combat' entry, if present, crossfades in during fights.
G.MUSIC_FILES = {
  // hollowmere: 'music/hollowmere.mp3',
  // brindle: 'music/brindle.mp3',
  // whisperwood: 'music/whisperwood.mp3',
  // mirefen: 'music/mirefen.mp3',
  // barrows: 'music/barrows.mp3',
  // barrows_combat: 'music/barrows-combat.mp3',
  // underhollow: 'music/underhollow.mp3',
};

G.music = (() => {
  const A = G.audio;
  const Mu = { theme: null, amb: null };
  const MAJ = [0, 4, 7], MIN = [0, 3, 7];
  const tones = ([r, q]) => q.map((i) => r + i);
  const melodyAt = (mel, bar, s) => (mel[bar] || []).filter((n) => n[0] === s);

  /* ---------------- themes ---------------- */
  const THEMES = {
    hollowmere: {
      sd: 60 / 92 / 4, steps: 16,
      chords: [[50, MAJ], [55, MAJ], [50, MAJ], [57, MAJ], [59, MIN], [55, MAJ], [57, MAJ], [50, MAJ]],
      mel: [[[0, 74, 4], [4, 78, 4], [8, 81, 6], [14, 79, 2]], [[0, 78, 4], [4, 76, 2], [6, 74, 2], [8, 71, 8]], [[0, 74, 4], [4, 78, 4], [8, 81, 4], [12, 83, 4]], [[0, 81, 8], [8, 76, 8]],
        [[0, 78, 4], [4, 81, 4], [8, 83, 6], [14, 81, 2]], [[0, 79, 4], [4, 78, 2], [6, 76, 2], [8, 74, 8]], [[0, 76, 4], [4, 78, 4], [8, 73, 4], [12, 76, 4]], [[0, 74, 12]]],
      play(I, bar, s, t, L) {
        const [r, th, f] = tones(this.chords[bar]), bd = this.sd * this.steps;
        if (s === 0) I.pad(L.base, t, [r + 12, th + 12, f + 12], bd, 0.13, { lp: 900 });
        if (s % 2 === 0) I.pluck(L.base, t, [r, f, r + 12, th + 12, f + 12, th + 12, r + 12, f][s / 2], 0.2, { pan: -0.35 });
        for (const [, m, len] of melodyAt(this.mel, bar, s)) I.flute(L.base, t, m, len * this.sd, 0.12, { pan: 0.25 });
        if (s % 8 === 0) I.drum(L.combat, t, 70, 0.55, { pan: -0.1 });
        if (s % 8 === 6 || s === 14) I.drum(L.combat, t, 110, 0.32, { pan: 0.25 });
        if (s % 8 === 4) I.drum(L.combat, t, 160, 0.28, { pan: 0.3, len: 0.2 });
        if (s % 2 === 0) I.shaker(L.combat, t, s % 4 === 2 ? 0.16 : 0.08);
        if (s % 4 === 0) I.bass(L.combat, t, (s % 8 === 0 ? r : f) - 12, this.sd * 3, 0.32);
        if (s % 2 === 1) I.pluck(L.combat, t, [r + 12, f + 12, th + 12][s % 3], 0.1, { pan: 0.4, len: 0.6 });
      },
    },
    brindle: {
      sd: 0.2, steps: 6,
      chords: [[55, MAJ], [48, MAJ], [55, MAJ], [50, MAJ], [52, MIN], [48, MAJ], [50, MAJ], [55, MAJ]],
      mel: [[[0, 83, 3], [3, 81, 1], [4, 79, 2]], [[0, 84, 2], [2, 83, 1], [3, 81, 3]], [[0, 79, 2], [2, 81, 1], [3, 83, 3]], [[0, 81, 6]],
        [[0, 83, 3], [3, 86, 1], [4, 84, 2]], [[0, 83, 2], [2, 81, 1], [3, 79, 3]], [[0, 78, 2], [2, 79, 1], [3, 81, 3]], [[0, 79, 6]]],
      play(I, bar, s, t, L) {
        const [r, th, f] = tones(this.chords[bar]), bd = this.sd * this.steps;
        if (s === 0) I.pad(L.base, t, [r + 12, th + 12, f + 12], bd, 0.1, { lp: 1200, wave: 'triangle' });
        I.pluck(L.base, t, [r, f, r + 12, th + 12, r + 12, f][s], s === 0 ? 0.24 : 0.16, { pan: -0.3, bright: 0.7 });
        for (const [, m, len] of melodyAt(this.mel, bar, s)) I.flute(L.base, t, m, len * this.sd, 0.12, { pan: 0.2 });
        if (s === 0) I.drum(L.combat, t, 80, 0.55);
        if (s === 3) I.drum(L.combat, t, 95, 0.4, { pan: 0.15 });
        if (s === 5) I.drum(L.combat, t, 140, 0.22, { pan: 0.3, len: 0.18 });
        I.shaker(L.combat, t, s % 3 === 0 ? 0.14 : 0.07);
        if (s === 0 || s === 3) I.bass(L.combat, t, (s === 0 ? r : f) - 12, this.sd * 2.5, 0.32);
      },
    },
    whisperwood: {
      sd: 60 / 70 / 4, steps: 16,
      chords: [[57, MIN], [53, MAJ], [48, MAJ], [55, MAJ], [57, MIN], [53, MAJ], [52, MAJ], [52, MAJ]],
      mel: [[[0, 76, 6], [6, 74, 2], [8, 72, 8]], [[0, 69, 8], [8, 72, 4], [12, 74, 4]], [[0, 76, 8], [8, 79, 8]], [[0, 74, 12]],
        [[0, 76, 4], [4, 77, 4], [8, 76, 4], [12, 72, 4]], [[0, 74, 8], [8, 69, 8]], [[0, 71, 4], [4, 68, 4], [8, 71, 4], [12, 74, 4]], [[0, 76, 12]]],
      play(I, bar, s, t, L) {
        const [r, th, f] = tones(this.chords[bar]), bd = this.sd * this.steps;
        if (s === 0) I.pad(L.base, t, [r, f, th + 12], bd, 0.14, { lp: 700 });
        if (s % 2 === 0) I.pluck(L.base, t, [r, th, f, r + 12, th + 12, r + 12, f, th][s / 2] + 12, 0.14, { pan: -0.4, decay: 0.998, bright: 0.4, rev: 0.5 });
        for (const [, m, len] of melodyAt(this.mel, bar, s)) I.flute(L.base, t, m - 12, len * this.sd, 0.14, { pan: 0.2, att: 0.15 });
        if (s === 8 && bar % 2 === 1) I.bell(L.base, t, r + 36, 0.06, { pan: 0.5, len: 2 });
        if (s % 4 === 0) I.drum(L.combat, t, s % 8 === 0 ? 60 : 85, s % 8 === 0 ? 0.5 : 0.3, { len: 0.5, skin: 900 });
        if (s === 14) I.drum(L.combat, t, 85, 0.25, { len: 0.3, skin: 900, pan: 0.2 });
        if (s % 2 === 1) I.shaker(L.combat, t, 0.06, -0.3);
        if (s % 4 === 0) I.pluck(L.combat, t, (s % 8 === 0 ? r : f) - 12, 0.3, { len: 0.5, decay: 0.99, bright: 0.3, lp: 1200, rev: 0.1 });
      },
    },
    mirefen: {
      sd: 0.25, steps: 16,
      chords: [[40, MIN], [40, MIN], [41, MAJ], [40, MIN]],
      scale: [64, 65, 67, 71, 72, 76],
      play(I, bar, s, t, L) {
        const bd = this.sd * this.steps, rnd = A.rnd;
        if (s === 0) I.pad(L.base, t, bar === 2 ? [41, 48, 53] : [40, 47, 52], bd, 0.2, { lp: 520, att: 1.5, rel: 2 });
        if ((s === 4 || s === 11) && Math.random() < 0.7) I.bell(L.base, t + rnd(0, 0.1), this.scale[Math.floor(Math.random() * this.scale.length)] + (Math.random() < 0.4 ? 12 : 0), 0.05, { pan: rnd(-0.7, 0.7), len: 2.5 });
        if (s === 0 && bar % 2 === 0) I.flute(L.base, t + 0.5, [64, 65, 67, 64][bar % 4], 2.6, 0.08, { att: 0.6, rel: 0.8, pan: -0.25 });
        if (s === 0 || s === 3) I.drum(L.combat, t, 50, s === 0 ? 0.6 : 0.4, { len: 0.6, skin: 500 });
        if (s === 8) I.bass(L.combat, t, bar === 2 ? 41 : 40, this.sd * 6, 0.3);
        if (s === 12) I.bass(L.combat, t, 41, this.sd * 3, 0.24);
        if (s % 4 === 2) I.shaker(L.combat, t, 0.05, 0.4);
      },
    },
    barrows: {
      sd: 60 / 116 / 4, steps: 16,
      chords: [[48, MIN], [44, MAJ], [46, MAJ], [43, MAJ]],
      play(I, bar, s, t, L) {
        const [r, th, f] = tones(this.chords[bar]), bd = this.sd * this.steps;
        if (s === 0) I.pad(L.base, t, [r, f, th + 12], bd, 0.18, { lp: 650 });
        if (s % 2 === 0) I.pluck(L.base, t, [r, r, f, r + 12, r, f, th + 12, f][s / 2], 0.18, { pan: -0.3, decay: 0.993, bright: 0.35, lp: 2200 });
        if (s === 0 && bar === 0) I.bell(L.base, t, 72, 0.06, { pan: 0.5, len: 2.5 });
        if (s === 0 && bar === 2) I.bell(L.base, t, 70, 0.06, { pan: -0.5, len: 2.5 });
        if (s === 0 || s === 6 || s === 10) I.drum(L.combat, t, 48, s === 0 ? 0.75 : 0.55, { len: 0.7, skin: 700 });
        if (s === 4 || s === 12) I.drum(L.combat, t, 120, 0.4, { len: 0.25, pan: 0.2 });
        if (s === 14 || s === 15) I.drum(L.combat, t, 160, 0.25, { len: 0.15, pan: -0.2 });
        if (s % 2 === 0) I.bass(L.combat, t, r - 12 + (s === 14 ? 7 : 0), this.sd * 1.6, 0.3);
        if (s === 0 || (s === 10 && bar % 2 === 1)) I.stab(L.combat, t, [r + 12, th + 12, f + 12], 0.32);
      },
    },
    underhollow: {
      sd: 60 / 64 / 4, steps: 16,
      chords: [[46, MIN], [42, MAJ], [39, MIN], [41, MAJ]],
      play(I, bar, s, t, L) {
        const [r, th, f] = tones(this.chords[bar]), bd = this.sd * this.steps, rnd = A.rnd;
        if (s === 0) I.pad(L.base, t, [r - 12, r, f], bd, 0.2, { lp: 480, att: 1.2, rel: 1.8 });
        if (s === 0 || s === 6 || s === 10) I.bell(L.base, t, [r + 24, f + 24, th + 36][s === 0 ? 0 : s === 6 ? 1 : 2], 0.045, { pan: rnd(-0.6, 0.6), len: 2.2, rev: 1 });
        if (s % 4 === 2) I.pluck(L.base, t, [r + 12, th + 12, f + 12, r + 24][(s / 4 | 0) % 4], 0.08, { pan: 0.4, decay: 0.998, bright: 0.3, rev: 0.8 });
        if (s === 0 || s === 7 || s === 10) I.drum(L.combat, t, 44, s === 0 ? 0.7 : 0.5, { len: 0.8, skin: 500 });
        if (s % 4 === 0) I.bass(L.combat, t, r - 12, this.sd * 3, 0.3);
        if (s % 2 === 1) I.shaker(L.combat, t, 0.05, -0.3);
        if (s === 8 && bar % 2 === 1) I.stab(L.combat, t, [r + 12, th + 12, f + 12], 0.22);
      },
    },
  };

  /* ---------------- theme playback ---------------- */
  function startSynth(id) {
    const th = THEMES[id], ctx = A.ctx;
    const bus = ctx.createGain(); bus.gain.value = 0; bus.gain.linearRampToValueAtTime(1, ctx.currentTime + 2); bus.connect(A.buses.music);
    const base = ctx.createGain(); base.connect(bus);
    const combat = ctx.createGain(); combat.gain.value = 0; combat.connect(bus);
    const st = { id, th, bus, base, combat, step: 0, next: ctx.currentTime + 0.1, combatOn: false };
    st.timer = setInterval(() => {
      const now = ctx.currentTime;
      // after the tab was hidden, skip ahead instead of firing a burst of late notes
      if (st.next < now - 0.1) { const skip = Math.ceil((now - st.next) / th.sd); st.step += skip; st.next += skip * th.sd; }
      while (st.next < now + 0.2) {
        const bar = Math.floor(st.step / th.steps) % th.chords.length, s = st.step % th.steps;
        try { th.play(A.I, bar, s, st.next, st); } catch (e) { /* skip a bad note rather than stop */ }
        st.next += th.sd; st.step++;
      }
    }, 30);
    return st;
  }
  // A recorded track: plays through an <audio> element, volume driven each frame.
  function startFile(id) {
    const mk = (src) => { if (!src) return null; const a = new Audio(src); a.loop = true; a.volume = 0; a.play().catch(() => {}); return a; };
    const st = { id, file: true, el: mk(G.MUSIC_FILES[id]), cel: mk(G.MUSIC_FILES[id + '_combat']), fade: 0, cfade: 0, combatOn: false, out: false };
    if (st.el) st.el.addEventListener('error', () => { st.failed = true; });
    return st;
  }
  function stopTheme(st, sec = 2) {
    if (!st) return;
    if (st.file) { st.out = true; return; }
    clearInterval(st.timer);
    const t = A.ctx.currentTime, g = st.bus.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + sec);
    setTimeout(() => st.bus.disconnect(), sec * 1000 + 3000);
  }
  function setCombat(st, on) {
    if (!st || st.combatOn === on) return;
    st.combatOn = on;
    if (st.file) return;
    const t = A.ctx.currentTime, g = st.combat.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(on ? 1 : 0, t + (on ? 1.2 : 3));
  }
  const fading = [];
  function playTheme(id) {
    if (Mu.theme && Mu.theme.id === id) return;
    if (Mu.theme) { stopTheme(Mu.theme); if (Mu.theme.file) fading.push(Mu.theme); }
    Mu.theme = G.MUSIC_FILES[id] ? startFile(id) : startSynth(id);
    if (Mu.theme.file && Mu.theme.failed) Mu.theme = startSynth(id);
  }
  // Recorded tracks follow the Music and Sound sliders by hand (they bypass WebAudio).
  function fileVolumes(dt) {
    const S = G.settings, base = S.muted ? 0 : Math.pow(S.volume, 1.6) * Math.pow(S.music, 1.6) * 2.4 * Mu.duckNow; // same scaling as the synth buses
    const step = (st) => {
      if (st.failed && st === Mu.theme) { Mu.theme = startSynth(st.id); Mu.theme.combatOn = false; return; }
      st.fade = Math.max(0, Math.min(1, st.fade + (st.out ? -dt / 2 : dt / 2)));
      st.cfade = Math.max(0, Math.min(1, st.cfade + (st.combatOn && st.cel ? dt / 1.2 : -dt / 3)));
      if (st.el) st.el.volume = Math.min(1, base * st.fade * (1 - st.cfade));
      if (st.cel) st.cel.volume = Math.min(1, base * st.fade * st.cfade);
      if (st.out && st.fade <= 0) { st.el && st.el.pause(); st.cel && st.cel.pause(); st.done = true; }
    };
    if (Mu.theme && Mu.theme.file) step(Mu.theme);
    for (const f of fading) step(f);
    for (let i = fading.length - 1; i >= 0; i--) if (fading[i].done) fading.splice(i, 1);
  }

  /* ---------------- ambience ----------------
     A looping noise bed plus random one-off sounds. */
  function bed(dest, type, freq, q, vel, lfoRate, lfoDepth) {
    const ctx = A.ctx, n = ctx.createBufferSource(); n.buffer = A.noiseBuf; n.loop = true;
    const f = A.filt(type, freq, q), g = ctx.createGain(); g.gain.value = vel;
    n.connect(f); f.connect(g); g.connect(dest);
    const nodes = [n];
    if (lfoRate) {
      const l = A.osc('sine', lfoRate), lg = ctx.createGain(); lg.gain.value = lfoDepth; l.connect(lg); lg.connect(f.frequency);
      const l2 = A.osc('sine', lfoRate * 0.71), lg2 = ctx.createGain(); lg2.gain.value = vel * 0.6; l2.connect(lg2); lg2.connect(g.gain);
      l.start(); l2.start(); nodes.push(l, l2);
    }
    n.start();
    return nodes;
  }
  const E = {
    chirp(d, t) {
      const n = Math.floor(A.rnd(2, 6)), base = A.rnd(2600, 4200), pan = A.rnd(-0.9, 0.9);
      for (let i = 0; i < n; i++) {
        const t0 = t + i * A.rnd(0.07, 0.12), f0 = base * A.rnd(0.85, 1.15), x = A.osc('sine', f0);
        x.frequency.setValueAtTime(f0, t0); x.frequency.exponentialRampToValueAtTime(f0 * A.rnd(1.2, 1.6), t0 + 0.05);
        const g = A.ctx.createGain(); A.env(g, t0, 0.008, 0.035, 0.02, 0.04);
        x.connect(g); A.out(g, d, pan, 0.4); x.start(t0); x.stop(t0 + 0.12);
      }
    },
    cricket(d, t, pan) {
      const ctx = A.ctx, x = A.osc('sine', A.rnd(4300, 4700)), am = A.osc('square', A.rnd(28, 34));
      const amg = ctx.createGain(); amg.gain.value = 0.5; const vca = ctx.createGain(); vca.gain.value = 0.5; am.connect(amg); amg.connect(vca.gain);
      const g = ctx.createGain(); x.connect(vca); vca.connect(g);
      const dur = A.rnd(0.25, 0.6); A.env(g, t, 0.02, 0.018, dur, 0.05);
      A.out(g, d, pan, 0.3); x.start(t); am.start(t); x.stop(t + dur + 0.1); am.stop(t + dur + 0.1);
    },
    owl(d, t) {
      [0, 0.42, 0.62].forEach((dt, i) => {
        const f = i === 0 ? 390 : 360, x = A.osc('sine', f * 1.04);
        x.frequency.setValueAtTime(f * 1.04, t + dt); x.frequency.linearRampToValueAtTime(f, t + dt + 0.25);
        const g = A.ctx.createGain(); A.env(g, t + dt, 0.06, 0.05, i === 2 ? 0.25 : 0.1, 0.15);
        x.connect(g); A.out(g, d, 0.6, 0.8); x.start(t + dt); x.stop(t + dt + 0.6);
      });
    },
    rustle(d, t) { A.I.hiss(d, t, 'bandpass', A.rnd(2500, 5000), 0.8, 0.03, 0.1, A.rnd(0.05, 0.25), 0.2, A.rnd(-0.8, 0.8), 0.2); },
    croak(d, t) {
      const pan = A.rnd(-0.9, 0.9), f = A.rnd(90, 150), n = Math.floor(A.rnd(2, 5));
      for (let i = 0; i < n; i++) {
        const t0 = t + i * 0.11, x = A.osc('sawtooth', f * 1.1);
        x.frequency.setValueAtTime(f * 1.1, t0); x.frequency.linearRampToValueAtTime(f * 0.92, t0 + 0.08);
        const bp = A.filt('bandpass', f * 4, 4), g = A.ctx.createGain(); A.env(g, t0, 0.01, 0.09, 0.03, 0.05);
        x.connect(bp); bp.connect(g); A.out(g, d, pan, 0.3); x.start(t0); x.stop(t0 + 0.12);
      }
    },
    bloop(d, t) { A.I.sweep(d, t, 'sine', A.rnd(250, 420), A.rnd(700, 1000), 0.05, 0.005, 0.1, A.rnd(-0.6, 0.6), 0.4); },
    drip(d, t) { A.I.sweep(d, t, 'sine', A.rnd(1100, 1900), A.rnd(2000, 3000), 0.07, 0.002, 0.12, A.rnd(-0.9, 0.9), 1.4); },
    crackle(d, t) { A.I.crackle(d, t, Math.floor(A.rnd(1, 4))); },
  };
  const AMBS = {
    fields: (d, ev) => { ev(0.6, 2.6, (t) => E.chirp(d, t)); ev(1.5, 4, (t) => E.rustle(d, t)); return bed(d, 'lowpass', 500, 0.7, 0.16, 0.09, 260); },
    village: (d, ev) => { ev(1.2, 4, (t) => E.chirp(d, t)); return bed(d, 'lowpass', 450, 0.7, 0.1, 0.07, 200); },
    forest: (d, ev) => { ev(0.4, 1.4, (t) => E.cricket(d, t, -0.5)); ev(0.5, 1.7, (t) => E.cricket(d, t, 0.55)); ev(1, 3, (t) => E.rustle(d, t)); ev(8, 16, (t) => E.owl(d, t)); return bed(d, 'lowpass', 350, 0.5, 0.08, 0.06, 150); },
    swamp: (d, ev) => { ev(0.7, 2.4, (t) => E.croak(d, t)); ev(0.5, 1.8, (t) => E.bloop(d, t)); return bed(d, 'lowpass', 260, 0.8, 0.14, 0.05, 120); },
    cave: (d, ev) => { ev(0.6, 2.8, (t) => E.drip(d, t)); return bed(d, 'lowpass', 90, 0.6, 0.5, 0.04, 30); },
    embers: (d, ev) => { ev(0.05, 0.35, (t) => E.crackle(d, t)); return [...bed(d, 'lowpass', 300, 0.6, 0.16, 0.2, 120), ...bed(d, 'bandpass', 700, 3, 0.05, 0.05, 300)]; },
  };
  function startAmb(id) {
    const ctx = A.ctx, g = ctx.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(1, ctx.currentTime + 2.5); g.connect(A.buses.amb);
    const st = { id, g, timers: [], live: true };
    const ev = (min, max, fn) => {
      const go = () => { if (!st.live) return; if (A.ready()) { try { fn(ctx.currentTime + 0.05); } catch (e) { /* skip */ } } st.timers.push(setTimeout(go, A.rnd(min, max) * 1000)); };
      st.timers.push(setTimeout(go, A.rnd(0.2, max * 0.6) * 1000));
    };
    st.nodes = AMBS[id](g, ev);
    return st;
  }
  function stopAmb(st) {
    if (!st) return;
    st.live = false;
    for (const t of st.timers) clearTimeout(t);
    const t = A.ctx.currentTime; st.g.gain.cancelScheduledValues(t); st.g.gain.setValueAtTime(st.g.gain.value, t); st.g.gain.linearRampToValueAtTime(0, t + 2);
    setTimeout(() => { for (const n of st.nodes) { try { n.stop(); } catch (e) { /* already stopped */ } } st.g.disconnect(); }, 2400);
  }

  /* ---------------- what should be playing ---------------- */
  const THEME_OF = { hollowmere: 'hollowmere', brindle: 'brindle', whisperwood: 'whisperwood', mirefen: 'mirefen', barrows: 'barrows' };
  const AMB_OF = { village: 'village', meadow: 'fields', forest: 'forest', swamp: 'swamp', cave: 'embers', deep: 'cave' };
  let bossT = 0, bossOn = false;
  function bossEngaged() {
    const hs = G.world.heroes().filter((h) => !h.dead);
    return G.world.entities.some((e) => e.kind === 'enemy' && !e.dead && e.def && e.def.boss &&
      ((e.target && e.target.kind === 'hero') || hs.some((h) => G.util.dist(h, e) < 9)) && G.state.playTime - G.world.lastCombat < 6);
  }
  Mu.duckNow = 1;
  Mu.update = (dt) => {
    if (!A.ctx || A.ctx.state !== 'running') return;
    const S = G.settings;
    const running = G.game.running && G.world.zoneId;
    // theme
    let want = 'hollowmere';
    if (running) {
      bossT -= dt;
      if (bossT <= 0) { bossT = 0.5; bossOn = bossEngaged(); }
      const z = G.world.zoneId;
      want = bossOn ? 'barrows' : THEME_OF[z] || (z.startsWith('deep') ? 'underhollow' : 'hollowmere');
    }
    if (S.music > 0 && !S.muted) playTheme(want);
    else if (Mu.theme) { stopTheme(Mu.theme, 1); if (Mu.theme.file) fading.push(Mu.theme); Mu.theme = null; }
    // combat layer
    if (Mu.theme) {
      const fight = running && (bossOn || G.events.active || G.state.playTime - G.world.lastCombat < (Mu.theme.combatOn ? 7 : 3));
      setCombat(Mu.theme, !!fight);
    }
    // duck under dialogue, menus and pause
    const duck = running && (G.ui.modal() || G.game.paused) ? 0.5 : running ? 1 : 0.8;
    Mu.duckNow += (duck - Mu.duckNow) * Math.min(1, dt * 3);
    if (duck !== Mu.lastDuck) { Mu.lastDuck = duck; A.duck.gain.setTargetAtTime(duck, A.ctx.currentTime, 0.25); }
    fileVolumes(dt);
    // ambience
    const wantAmb = running && S.ambience > 0 && !S.muted ? AMB_OF[G.render.theme] || null : null;
    if ((Mu.amb && Mu.amb.id) !== wantAmb) { stopAmb(Mu.amb); Mu.amb = wantAmb ? startAmb(wantAmb) : null; }
  };
  return Mu;
})();
