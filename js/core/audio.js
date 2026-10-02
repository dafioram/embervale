/* Audio: one WebAudio graph shared by sound effects, music and ambience.
     master (Sound volume, Mute) -> compressor -> speakers
       effects bus  (Effects volume)
       music bus    (Music volume)
       ambience bus (Ambience volume)
     plus a shared room reverb that anything can send to.
   Everything is synthesized here; the game ships no audio files. js/core/music.js
   builds the zone themes and ambience from the instruments defined below. */
G.audio = (() => {
  const Au = { ctx: null, buses: {}, revIn: null, noiseBuf: null };
  let ctx = null, master = null;
  const last = {};

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
      master = ctx.createGain(); master.connect(comp); comp.connect(ctx.destination);
      Au.revIn = ctx.createConvolver(); Au.revIn.buffer = impulse(2.8, 2.6);
      const revOut = ctx.createGain(); revOut.gain.value = 0.9; Au.revIn.connect(revOut); revOut.connect(master);
      for (const k of ['sfx', 'music', 'amb']) { const g = ctx.createGain(); g.connect(master); Au.buses[k] = g; }
      // music passes through one more gain so it can dip under dialogue and menus
      Au.duck = ctx.createGain(); Au.buses.music.disconnect(); Au.buses.music.connect(Au.duck); Au.duck.connect(master);
      Au.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = Au.noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      Au.ctx = ctx;
      applyVolumes();
    } catch (e) { ctx = null; return false; }
    return true;
  }
  function impulse(sec, decay) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  // Slider values feel more even on a curve than linear.
  const curve = (v) => Math.pow(Math.max(0, Math.min(1, v)), 1.6);
  function applyVolumes() {
    if (!ctx) return;
    const S = G.settings || {}, t = ctx.currentTime;
    master.gain.setTargetAtTime(S.muted ? 0 : curve(S.volume ?? 0.5) * 1.6, t, 0.05);
    Au.buses.sfx.gain.setTargetAtTime(curve(S.effects ?? 0.8) * 1.4, t, 0.05);
    Au.buses.music.gain.setTargetAtTime(curve(S.music ?? 0.6) * 1.5, t, 0.05);
    Au.buses.amb.gain.setTargetAtTime(curve(S.ambience ?? 0.6) * 1.5, t, 0.05);
  }
  const ready = () => !!ctx && ctx.state === 'running';

  /* ---------------- building blocks ---------------- */
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const rnd = (a, b) => a + Math.random() * (b - a);
  // Route a sound into a bus with a stereo position and a reverb send.
  function out(node, dest, pan = 0, rev = 0.25) {
    const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(p); p.connect(dest);
    if (rev > 0) { const s = ctx.createGain(); s.gain.value = rev; p.connect(s); s.connect(Au.revIn); }
    return p;
  }
  function env(g, t, a, peak, hold, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
    return t + a + hold + rel + 0.05;
  }
  function noiseSrc(t, dur) { const s = ctx.createBufferSource(); s.buffer = Au.noiseBuf; s.loop = true; s.start(t, Math.random()); s.stop(t + dur); return s; }
  function filt(type, f, q = 1) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  function osc(type, f) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }

  /* ---------------- instruments (shared with the music) ---------------- */
  // Plucked string (Karplus-Strong), rendered once per pitch and cached.
  const ksCache = new Map();
  function ks(f, decay, bright) {
    const key = `${f.toFixed(1)}|${decay}|${bright}`;
    if (ksCache.has(key)) return ksCache.get(key);
    const sr = ctx.sampleRate, len = Math.floor(sr * 2.4), N = Math.max(2, Math.round(sr / f - 0.5));
    const b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
    let prev = 0;
    for (let i = 0; i < N; i++) { prev = prev * (1 - bright) + (Math.random() * 2 - 1) * bright; d[i] = prev; }
    for (let i = N; i < len; i++) d[i] = decay * 0.5 * (d[i - N] + (i - N - 1 >= 0 ? d[i - N - 1] : 0));
    let mx = 0; for (let i = 0; i < len; i++) mx = Math.max(mx, Math.abs(d[i]));
    for (let i = 0; i < len; i++) d[i] /= mx || 1;
    ksCache.set(key, b);
    return b;
  }
  const I = {
    pluck(dest, t, m, vel, o = {}) {
      const s = ctx.createBufferSource(); s.buffer = ks(mtof(m), o.decay ?? 0.996, o.bright ?? 0.55);
      const len = o.len ?? 2.2, g = ctx.createGain(); g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      const lp = filt('lowpass', o.lp ?? 5000, 0.7);
      s.connect(lp); lp.connect(g); out(g, dest, o.pan ?? 0, o.rev ?? 0.3);
      s.start(t); s.stop(t + len);
    },
    flute(dest, t, m, dur, vel, o = {}) {
      const f = mtof(m), g = ctx.createGain();
      const a = osc('sine', f), b = osc('triangle', f * 2), bg = ctx.createGain(); bg.gain.value = 0.07;
      const lfo = osc('sine', 5.2), lg = ctx.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.008, t + Math.min(0.35, dur));
      lfo.connect(lg); lg.connect(a.frequency);
      const n = noiseSrc(t, dur + 0.3), bp = filt('bandpass', f * 1.6, 3), ng = ctx.createGain(); ng.gain.value = 0.05;
      a.connect(g); b.connect(bg); bg.connect(g); n.connect(bp); bp.connect(ng); ng.connect(g);
      const end = env(g, t, o.att ?? 0.07, vel, Math.max(0, dur - 0.1), o.rel ?? 0.22);
      out(g, dest, o.pan ?? 0.15, o.rev ?? 0.45);
      for (const x of [a, b, lfo]) { x.start(t); x.stop(end); }
    },
    pad(dest, t, notes, dur, vel, o = {}) {
      const g = ctx.createGain(), lp = filt('lowpass', o.lp ?? 1000, 0.4), oscs = [];
      for (const m of notes) for (const det of [-7, 6]) { const x = osc(o.wave ?? 'sawtooth', mtof(m)); x.detune.value = det; x.connect(lp); oscs.push(x); }
      lp.connect(g);
      const end = env(g, t, o.att ?? 0.8, vel / notes.length, Math.max(0, dur - 0.8), o.rel ?? 1.4);
      out(g, dest, o.pan ?? 0, o.rev ?? 0.5);
      for (const x of oscs) { x.start(t); x.stop(end); }
    },
    bass(dest, t, m, dur, vel) {
      const g = ctx.createGain(), a = osc('triangle', mtof(m)), b = osc('sine', mtof(m - 12)), bg = ctx.createGain(); bg.gain.value = 0.6;
      a.connect(g); b.connect(bg); bg.connect(g);
      const end = env(g, t, 0.01, vel, Math.max(0, dur - 0.08), 0.12);
      out(g, dest, 0, 0.05);
      for (const x of [a, b]) { x.start(t); x.stop(end); }
    },
    bell(dest, t, m, vel, o = {}) {
      const f = mtof(m), len = o.len ?? 1;
      for (const [r, a, dec] of [[1, 1, 1.6], [2.76, 0.45, 0.9], [5.4, 0.25, 0.5], [8.93, 0.12, 0.3]]) {
        const x = osc('sine', f * r), g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * a, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dec * len);
        x.connect(g); out(g, dest, o.pan ?? 0, o.rev ?? 0.6); x.start(t); x.stop(t + dec * len + 0.05);
      }
    },
    drum(dest, t, f, vel, o = {}) {
      const len = o.len ?? 0.4, x = ctx.createOscillator(); x.type = 'sine';
      x.frequency.setValueAtTime(f * 2.4, t); x.frequency.exponentialRampToValueAtTime(f, t + 0.06);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      x.connect(g); out(g, dest, o.pan ?? 0, o.rev ?? 0.2); x.start(t); x.stop(t + len + 0.05);
      const n = noiseSrc(t, 0.08), lp = filt('lowpass', o.skin ?? 1800), ng = ctx.createGain();
      ng.gain.setValueAtTime(vel * 0.45, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      n.connect(lp); lp.connect(ng); out(ng, dest, o.pan ?? 0, 0.15);
    },
    shaker(dest, t, vel, pan = 0.35) {
      const n = noiseSrc(t, 0.1), hp = filt('highpass', 6500), g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      n.connect(hp); hp.connect(g); out(g, dest, pan, 0.1);
    },
    stab(dest, t, notes, vel) {
      const g = ctx.createGain(), lp = filt('lowpass', 400, 2);
      lp.frequency.setValueAtTime(400, t); lp.frequency.linearRampToValueAtTime(2200, t + 0.05); lp.frequency.exponentialRampToValueAtTime(500, t + 0.45);
      const oscs = notes.map((m) => { const x = osc('sawtooth', mtof(m)); x.connect(lp); return x; });
      lp.connect(g);
      const end = env(g, t, 0.02, vel / notes.length, 0.15, 0.35);
      out(g, dest, 0, 0.35);
      for (const x of oscs) { x.start(t); x.stop(end); }
    },
    // a burst of filtered noise with an envelope
    hiss(dest, t, type, f, q, vel, a, hold, rel, pan = 0, rev = 0.2) {
      const n = noiseSrc(t, a + hold + rel + 0.1), b = filt(type, f, q), g = ctx.createGain();
      env(g, t, a, vel, hold, rel); n.connect(b); b.connect(g); out(g, dest, pan, rev);
      return b;
    },
    // a single swept oscillator
    sweep(dest, t, type, f0, f1, vel, a, dur, pan = 0, rev = 0.2) {
      const x = osc(type, f0); x.frequency.setValueAtTime(f0, t); x.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + a + dur);
      const g = ctx.createGain(); const end = env(g, t, a, vel, 0, dur);
      x.connect(g); out(g, dest, pan, rev); x.start(t); x.stop(end);
    },
    crackle(dest, t, n = 3) {
      for (let i = 0; i < n; i++) {
        const t0 = t + rnd(0, 0.12), s = noiseSrc(t0, 0.03), hp = filt('highpass', rnd(1500, 4000)), g = ctx.createGain();
        g.gain.setValueAtTime(rnd(0.05, 0.18), t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + rnd(0.005, 0.02));
        s.connect(hp); hp.connect(g); out(g, dest, rnd(-0.5, 0.5), 0.1);
      }
    },
  };

  /* ---------------- sound effects ----------------
     Each takes (D, t): D is a per-play gain node already set to the effect's volume.
     Most vary their pitch a little so repeated sounds don't feel mechanical. */
  function metal(D, t, f, pan, len = 1) {
    for (const [r, a, d] of [[1, 0.5, 0.35], [2.41, 0.3, 0.22], [3.93, 0.2, 0.15], [5.2, 0.12, 0.1]]) {
      const x = osc('sine', f * r), g = ctx.createGain();
      g.gain.setValueAtTime(a * 0.22, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d * len);
      x.connect(g); out(g, D, pan, 0.3); x.start(t); x.stop(t + d * len + 0.02);
    }
  }
  const SFX = {
    hit: (D, t) => { const pan = rnd(-0.3, 0.3); metal(D, t, rnd(820, 980), pan); I.hiss(D, t, 'lowpass', 420, 0.7, 0.9, 0.002, 0, 0.1, pan, 0.05); I.hiss(D, t, 'highpass', 3000, 0.7, 0.4, 0.001, 0, 0.025, pan, 0.1); },
    thud: (D, t) => { I.sweep(D, t, 'sine', 120, 38, 0.8, 0.005, 0.35, 0, 0.2); I.hiss(D, t, 'lowpass', 500, 0.7, 0.7, 0.005, 0.02, 0.25, 0, 0.2); I.crackle(D, t + 0.03, 3); },
    roar: (D, t) => {
      const dur = 1.15, g = ctx.createGain(); env(g, t, 0.12, 0.5, 0.45, 0.55);
      const trem = osc('sine', 23), tg = ctx.createGain(); tg.gain.value = 0.35; trem.connect(tg); tg.connect(g.gain);
      const f1 = filt('bandpass', 500, 1.5); f1.frequency.setValueAtTime(500, t); f1.frequency.linearRampToValueAtTime(800, t + 0.3); f1.frequency.linearRampToValueAtTime(420, t + dur);
      const k = rnd(0.92, 1.08);
      for (const [f, d] of [[105, 0], [108, 7], [158, -5]]) { const x = osc('sawtooth', f * k); x.frequency.setValueAtTime(f * k * 1.1, t); x.frequency.linearRampToValueAtTime(f * k * 0.78, t + dur); x.detune.value = d; x.connect(f1); x.start(t); x.stop(t + dur + 0.2); }
      const n = noiseSrc(t, dur + 0.2), nb = filt('bandpass', 380, 1), ng = ctx.createGain(); ng.gain.value = 0.6; n.connect(nb); nb.connect(ng); ng.connect(g);
      f1.connect(g); out(g, D, 0, 0.6); trem.start(t); trem.stop(t + dur + 0.2);
    },
    summon: (D, t) => {
      [0, 4, 7, 12].forEach((s, i) => I.bell(D, t + i * 0.05, 74 + s, 0.06, { len: 1.2, rev: 0.8, pan: -0.3 + i * 0.2 }));
      I.sweep(D, t, 'triangle', 220, 660, 0.2, 0.15, 0.35, 0, 0.6);
      const b = I.hiss(D, t, 'bandpass', 800, 2, 0.25, 0.2, 0.1, 0.4, 0, 0.6); b.frequency.setValueAtTime(600, t); b.frequency.exponentialRampToValueAtTime(3500, t + 0.6);
    },
    quake: (D, t) => { I.sweep(D, t, 'sine', 70, 28, 0.9, 0.02, 0.9, 0, 0.3); I.hiss(D, t, 'lowpass', 180, 0.6, 0.9, 0.03, 0.2, 0.8, 0, 0.4); I.crackle(D, t + 0.05, 8); I.hiss(D, t + 0.1, 'bandpass', 900, 1, 0.25, 0.05, 0.1, 0.5, 0.3, 0.4); },
    heal: (D, t) => {
      [84, 88, 91, 96].forEach((m, i) => I.bell(D, t + i * 0.07, m + rnd(-0.3, 0.3), 0.06, { pan: -0.4 + i * 0.25, len: 1.4, rev: 1 }));
      I.pad(D, t, [72, 76, 79], 1.2, 0.18, { wave: 'triangle', att: 0.3, rel: 0.9, lp: 3000, rev: 0.8 });
      I.hiss(D, t, 'highpass', 7000, 0.7, 0.06, 0.2, 0.2, 0.5, 0.2, 0.6);
    },
    tide: (D, t) => {
      I.hiss(D, t, 'lowpass', 900, 0.8, 0.5, 0.4, 0.4, 0.9, 0, 0.7);
      [72, 76, 79, 84, 88].forEach((m, i) => I.bell(D, t + 0.2 + i * 0.09, m, 0.05, { len: 1.6, rev: 1, pan: -0.5 + i * 0.25 }));
      I.pad(D, t + 0.1, [60, 64, 67, 72], 1.6, 0.25, { wave: 'triangle', att: 0.5, rel: 1.2, lp: 2200, rev: 0.9 });
    },
    zap: (D, t) => {
      I.hiss(D, t, 'highpass', 1800, 0.7, 0.8, 0.001, 0, 0.08, 0, 0.4);
      for (let i = 0; i < 3; i++) {
        const t0 = t + i * 0.07, x = osc('sawtooth', rnd(1500, 2200)); x.frequency.setValueAtTime(x.frequency.value, t0); x.frequency.exponentialRampToValueAtTime(rnd(200, 320), t0 + 0.18);
        const rm = osc('sine', rnd(55, 80)), rg = ctx.createGain(); rg.gain.value = 0; rm.connect(rg.gain);
        const g = ctx.createGain(); env(g, t0, 0.003, 0.12, 0.03, 0.15);
        x.connect(rg); rg.connect(g); out(g, D, rnd(-0.6, 0.6), 0.35); x.start(t0); rm.start(t0); x.stop(t0 + 0.25); rm.stop(t0 + 0.25);
      }
      I.hiss(D, t + 0.05, 'lowpass', 160, 0.7, 0.5, 0.08, 0.1, 1.0, 0, 0.3);
    },
    shoot: (D, t) => { const b = I.hiss(D, t, 'bandpass', 2600, 1.5, 0.5, 0.01, 0.02, 0.18, 0, 0.3); b.frequency.setValueAtTime(3200, t); b.frequency.exponentialRampToValueAtTime(700, t + 0.2); I.sweep(D, t, 'triangle', rnd(850, 950), 300, 0.12, 0.005, 0.15, 0, 0.3); I.crackle(D, t, 2); },
    bow: (D, t) => {
      I.pluck(D, t, rnd(43, 47), 0.35, { len: 0.35, decay: 0.98, bright: 0.9, lp: 2500, rev: 0.1, pan: -0.2 });
      const n = noiseSrc(t, 0.4), bp = filt('bandpass', 3200, 2.5);
      bp.frequency.setValueAtTime(3200, t + 0.02); bp.frequency.exponentialRampToValueAtTime(700, t + 0.32);
      const g = ctx.createGain(); env(g, t + 0.02, 0.04, 0.35, 0.05, 0.2);
      const p = ctx.createStereoPanner(); p.pan.setValueAtTime(-0.4, t); p.pan.linearRampToValueAtTime(0.6, t + 0.3);
      n.connect(bp); bp.connect(g); g.connect(p); p.connect(D);
    },
    cast: (D, t) => { I.bell(D, t, rnd(78, 80), 0.04, { len: 0.6, rev: 0.6 }); const b = I.hiss(D, t, 'bandpass', 1200, 3, 0.12, 0.05, 0.05, 0.15, 0, 0.5); b.frequency.exponentialRampToValueAtTime(2400, t + 0.25); },
    whoosh: (D, t) => { const b = I.hiss(D, t, 'bandpass', 500, 1.2, 0.5, 0.08, 0.05, 0.25, 0, 0.3); b.frequency.setValueAtTime(400, t); b.frequency.exponentialRampToValueAtTime(1800, t + 0.15); b.frequency.exponentialRampToValueAtTime(600, t + 0.35); },
    volley: (D, t) => { for (let i = 0; i < 5; i++) { const t0 = t + i * rnd(0.03, 0.06); I.pluck(D, t0, rnd(45, 50), 0.2, { len: 0.25, decay: 0.98, bright: 0.9, lp: 2500, rev: 0.1, pan: rnd(-0.5, 0.5) }); const b = I.hiss(D, t0 + 0.02, 'bandpass', 3000, 2.5, 0.18, 0.03, 0.03, 0.15, rnd(-0.5, 0.5), 0.2); b.frequency.exponentialRampToValueAtTime(800, t0 + 0.25); } },
    bigshot: (D, t) => { I.pluck(D, t, 40, 0.5, { len: 0.5, decay: 0.985, bright: 0.9, lp: 2000, rev: 0.2 }); const b = I.hiss(D, t, 'bandpass', 2000, 1.2, 0.7, 0.01, 0.05, 0.3, 0, 0.4); b.frequency.exponentialRampToValueAtTime(500, t + 0.35); I.sweep(D, t + 0.05, 'sine', 160, 50, 0.5, 0.005, 0.3, 0, 0.3); },
    drink: (D, t) => { for (let i = 0; i < 3; i++) I.sweep(D, t + i * 0.09, 'sine', rnd(380, 460), rnd(800, 950), 0.12, 0.005, 0.08, 0, 0.2); I.bell(D, t + 0.3, 86, 0.04, { len: 0.8, rev: 0.6 }); },
    quest: (D, t) => { I.pluck(D, t, 69, 0.3, { bright: 0.7 }); I.pluck(D, t + 0.12, 74, 0.3, { bright: 0.7 }); I.bell(D, t + 0.12, 86, 0.05, { len: 1, rev: 0.6 }); },
    complete: (D, t) => {
      [[0, 62], [0.12, 66], [0.24, 69]].forEach(([dt, m]) => I.pluck(D, t + dt, m, 0.3, { bright: 0.7, pan: -0.2 }));
      I.flute(D, t + 0.36, 74, 0.7, 0.2, { pan: 0.2, rev: 0.6 });
      I.pad(D, t + 0.36, [50, 57, 62, 66], 1.2, 0.25, { wave: 'triangle', att: 0.15, rel: 1, lp: 1800 });
      I.drum(D, t + 0.36, 75, 0.55, { len: 0.5 }); I.shaker(D, t + 0.36, 0.15);
    },
    levelup: (D, t) => {
      [67, 69, 72, 74, 76, 79, 81, 84].forEach((m, i) => I.pluck(D, t + i * 0.045, m, 0.22, { pan: -0.6 + i * 0.16, bright: 0.75, rev: 0.6 }));
      [84, 88, 91].forEach((m, i) => I.bell(D, t + 0.4 + i * 0.02, m, 0.07, { len: 2, rev: 0.9 }));
      I.pad(D, t + 0.3, [60, 67, 72, 76], 1.6, 0.3, { wave: 'triangle', att: 0.4, rel: 1.2, lp: 2500, rev: 0.8 });
      I.drum(D, t + 0.38, 70, 0.5, { len: 0.6 });
    },
    pickup: (D, t) => { I.pluck(D, t, rnd(79, 81), 0.25, { len: 0.6, bright: 0.8 }); I.bell(D, t + 0.05, 91, 0.03, { len: 0.5, rev: 0.4 }); },
    coin: (D, t) => { const k = rnd(-1, 1); I.bell(D, t, 100 + k, 0.06, { len: 0.35, rev: 0.3, pan: 0.2 }); I.bell(D, t + 0.06, 107 + k, 0.05, { len: 0.5, rev: 0.35, pan: 0.25 }); },
    buy: (D, t) => { SFX.coin(D, t); SFX.coin(D, t + 0.09); I.hiss(D, t, 'bandpass', 2500, 2, 0.08, 0.01, 0.03, 0.08, 0, 0.1); },
    open: (D, t) => { I.sweep(D, t, 'sawtooth', 140, 210, 0.05, 0.05, 0.35, 0, 0.2); I.hiss(D, t, 'bandpass', 700, 2, 0.25, 0.05, 0.1, 0.2, 0, 0.3); I.drum(D, t + 0.32, 120, 0.4, { len: 0.2, skin: 900 }); I.bell(D, t + 0.4, 86, 0.04, { len: 1, rev: 0.7 }); },
    shatter: (D, t) => { I.hiss(D, t, 'highpass', 3500, 0.8, 0.6, 0.002, 0.05, 0.5, 0, 0.5); for (let i = 0; i < 8; i++) I.bell(D, t + rnd(0, 0.25), rnd(96, 108), 0.03, { len: 0.4, pan: rnd(-0.8, 0.8), rev: 0.6 }); I.sweep(D, t, 'sine', 90, 35, 0.5, 0.005, 0.5, 0, 0.3); },
    boom: (D, t) => {
      I.sweep(D, t, 'sine', 95, 32, 0.9, 0.005, 0.75, 0, 0.2);
      const b = I.hiss(D, t, 'lowpass', 3000, 0.7, 0.7, 0.01, 0.1, 1.1, 0, 0.45); b.frequency.setValueAtTime(3000, t); b.frequency.exponentialRampToValueAtTime(180, t + 1.1);
      for (let i = 0; i < 6; i++) I.crackle(D, t + 0.15 + i * rnd(0.06, 0.12), 2);
    },
    whirl: (D, t) => { for (let i = 0; i < 4; i++) { const b = I.hiss(D, t + i * 0.12, 'bandpass', 600, 1.5, 0.35, 0.04, 0.02, 0.1, i % 2 ? 0.5 : -0.5, 0.2); b.frequency.exponentialRampToValueAtTime(1800, t + i * 0.12 + 0.12); } metal(D, t + 0.4, rnd(700, 800), 0, 0.8); },
    splash: (D, t) => { const b = I.hiss(D, t, 'lowpass', 1800, 0.7, 0.6, 0.01, 0.05, 0.4, 0, 0.3); b.frequency.exponentialRampToValueAtTime(400, t + 0.4); for (let i = 0; i < 4; i++) I.sweep(D, t + rnd(0.05, 0.3), 'sine', rnd(300, 500), rnd(900, 1300), 0.05, 0.003, 0.06, rnd(-0.5, 0.5), 0.3); },
    death: (D, t) => { I.sweep(D, t, 'sawtooth', rnd(200, 240), 60, 0.06, 0.01, 0.35, 0, 0.3); I.hiss(D, t, 'lowpass', 600, 0.7, 0.3, 0.01, 0.05, 0.3, 0, 0.2); },
    bossdeath: (D, t) => { SFX.roar(D, t); I.sweep(D, t + 0.4, 'sine', 80, 25, 0.9, 0.02, 1.6, 0, 0.4); I.hiss(D, t + 0.4, 'lowpass', 300, 0.6, 0.8, 0.05, 0.3, 1.4, 0, 0.6); [62, 69, 74].forEach((m, i) => I.bell(D, t + 1.2 + i * 0.12, m, 0.06, { len: 3, rev: 1 })); },
    herodeath: (D, t) => { I.pad(D, t, [57, 60, 64], 1.4, 0.3, { wave: 'triangle', att: 0.05, rel: 1.2, lp: 1400, rev: 0.8 }); I.flute(D, t + 0.1, 69, 0.4, 0.12); I.flute(D, t + 0.5, 64, 0.9, 0.12); },
    click: (D, t) => { I.hiss(D, t, 'bandpass', rnd(1700, 2100), 6, 0.5, 0.001, 0, 0.035, 0, 0.05); I.sweep(D, t, 'sine', 520, 300, 0.06, 0.002, 0.04, 0, 0); },
    error: (D, t) => { I.sweep(D, t, 'square', 220, 180, 0.04, 0.005, 0.1, 0, 0.1); I.sweep(D, t + 0.11, 'square', 180, 150, 0.04, 0.005, 0.14, 0, 0.1); I.drum(D, t, 90, 0.2, { len: 0.15, skin: 600 }); },
  };
  // Volume of each effect, roughly matched so none jumps out.
  const LOUD = { hit: 1.0, bow: 0.8, zap: 0.6, boom: 0.45, heal: 0.7, roar: 0.4, levelup: 0.55, complete: 0.55, coin: 1.2, click: 1, quake: 0.5, bossdeath: 0.45, summon: 0.8, tide: 0.6, thud: 0.6, shoot: 0.7, volley: 0.8, bigshot: 0.6, shatter: 0.6, whirl: 0.7, herodeath: 0.6, buy: 1 };

  function play(name, scale = 1) {
    const S = G.settings;
    if (S && (S.muted || !S.volume || !S.effects)) return;
    if (!SFX[name] || !ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    const now = performance.now();
    if (last[name] && now - last[name] < 45) return;
    last[name] = now;
    try {
      const D = ctx.createGain(); D.gain.value = (LOUD[name] ?? 0.8) * scale; D.connect(Au.buses.sfx);
      SFX[name](D, ctx.currentTime + 0.005);
      setTimeout(() => D.disconnect(), 7000);
    } catch (e) { /* audio is best-effort */ }
  }
  function unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); }

  return Object.assign(Au, { play, unlock, ensure, ready, applyVolumes, out, env, noiseSrc, filt, osc, mtof, rnd, I, SFX });
})();
