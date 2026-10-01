/* Tiny WebAudio synth for sound effects; no audio files needed. */
G.audio = (() => {
  let ctx = null, master = null;
  const last = {};
  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.connect(ctx.destination);
    } catch (e) { return false; }
    return true;
  }
  const vol = () => (G.settings && !G.settings.muted ? G.settings.volume : 0);

  function tone(type, f0, f1, dur, v, delay = 0) {
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  let noiseBuf = null;
  function noise(dur, v, freq = 1200, q = 1, delay = 0) {
    if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
  }

  const SFX = {
    hit: (v) => { noise(0.08, 0.5 * v, 900, 0.8); tone('square', 140, 70, 0.07, 0.12 * v); },
    thud: (v) => { noise(0.2, 0.7 * v, 300, 0.7); tone('sine', 110, 40, 0.25, 0.5 * v); },
    roar: (v) => { tone('sawtooth', 160, 90, 0.5, 0.18 * v); noise(0.5, 0.25 * v, 500, 0.6); },
    summon: (v) => { tone('triangle', 300, 700, 0.3, 0.2 * v); tone('sine', 600, 1200, 0.3, 0.1 * v, 0.08); },
    quake: (v) => { noise(0.7, 0.9 * v, 120, 0.5); tone('sine', 70, 30, 0.7, 0.6 * v); },
    heal: (v) => { tone('sine', 520, 780, 0.35, 0.2 * v); tone('sine', 780, 1040, 0.3, 0.12 * v, 0.1); },
    zap: (v) => { tone('sawtooth', 1200, 200, 0.2, 0.15 * v); noise(0.18, 0.3 * v, 3000, 2); },
    shoot: (v) => { noise(0.15, 0.5 * v, 2500, 1.5); tone('triangle', 900, 300, 0.15, 0.1 * v); },
    bow: (v) => { noise(0.08, 0.3 * v, 2200, 2); },
    cast: (v) => { tone('sine', 500, 300, 0.15, 0.1 * v); },
    whoosh: (v) => { noise(0.3, 0.4 * v, 800, 0.5); },
    volley: (v) => { for (let i = 0; i < 3; i++) noise(0.06, 0.25 * v, 2500, 2, i * 0.04); },
    bigshot: (v) => { noise(0.3, 0.7 * v, 1500, 1); tone('square', 300, 60, 0.3, 0.2 * v); },
    drink: (v) => { tone('sine', 400, 900, 0.18, 0.15 * v); tone('sine', 500, 1000, 0.15, 0.1 * v, 0.12); },
    quest: (v) => { tone('triangle', 660, 660, 0.12, 0.2 * v); tone('triangle', 880, 880, 0.2, 0.2 * v, 0.12); },
    complete: (v) => { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.25, 0.18 * v, i * 0.1)); },
    levelup: (v) => { [392, 523, 659, 784].forEach((f, i) => tone('square', f, f * 1.01, 0.18, 0.08 * v, i * 0.08)); tone('sine', 1046, 1046, 0.5, 0.15 * v, 0.32); },
    pickup: (v) => { tone('sine', 700, 1100, 0.1, 0.15 * v); },
    coin: (v) => { tone('square', 1300, 1300, 0.05, 0.05 * v); tone('square', 1700, 1700, 0.08, 0.05 * v, 0.05); },
    open: (v) => { tone('triangle', 200, 400, 0.2, 0.2 * v); noise(0.15, 0.2 * v, 600, 1); },
    shatter: (v) => { noise(0.5, 0.6 * v, 4000, 0.8); tone('sine', 1500, 400, 0.4, 0.15 * v); },
    boom: (v) => { noise(0.4, 0.7 * v, 200, 0.5); tone('sine', 120, 40, 0.4, 0.4 * v); },
    whirl: (v) => { for (let i = 0; i < 4; i++) noise(0.15, 0.3 * v, 700 + i * 200, 1, i * 0.12); },
    splash: (v) => { noise(0.35, 0.5 * v, 700, 0.6); },
    death: (v) => { tone('sawtooth', 220, 60, 0.3, 0.1 * v); },
    bossdeath: (v) => { tone('sawtooth', 200, 30, 1.2, 0.3 * v); noise(1.2, 0.5 * v, 200, 0.4); },
    herodeath: (v) => { tone('sine', 440, 110, 0.8, 0.3 * v); },
    click: (v) => { tone('square', 900, 700, 0.03, 0.05 * v); },
    error: (v) => { tone('square', 200, 160, 0.12, 0.08 * v); },
    buy: (v) => { tone('square', 1200, 1200, 0.05, 0.06 * v); tone('square', 1600, 1600, 0.1, 0.06 * v, 0.05); },
  };

  function play(name, scale = 1) {
    const v = vol();
    if (v <= 0 || !SFX[name]) return;
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    const now = performance.now();
    if (last[name] && now - last[name] < 45) return;
    last[name] = now;
    master.gain.value = v;
    try { SFX[name](scale); } catch (e) { /* audio is best-effort */ }
  }
  return { play, unlock: () => { if (ensure() && ctx.state === 'suspended') ctx.resume(); } };
})();
