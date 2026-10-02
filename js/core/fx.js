/* Visual effects: particles, floating text, rings, telegraphs, projectiles.
   Positions are world (tile) units; `z` is a height in screen pixels at zoom 1. */
G.fx = (() => {
  const list = [];   // rings, beams, bolts, streaks, telegraphs
  const parts = [];  // particles
  const texts = [];
  const projs = [];
  const marks = [];  // fading ground marks: blood, ichor, ash, rubble, scorch, crater
  let shakeT = 0, shakeMag = 0;

  function clear() { list.length = 0; parts.length = 0; texts.length = 0; projs.length = 0; marks.length = 0; }
  // A mark left on the ground that fades out over about 25 seconds.
  function mark(x, y, kind, r = 0.6, color) {
    if (marks.length >= 60) marks.shift();
    marks.push({ x, y, kind, r, color, t: 0, life: kind === 'scorch' || kind === 'crater' ? 18 : 25, seed: (Math.random() * 1e9) | 0, rot: Math.random() * 6.28 });
  }
  // A short flash of light where something hits.
  const flash = (x, y, color, r = 0.8, dur = 0.22, z = 14) => list.push({ type: 'flash', x, y, z, color, r, t: 0, dur });
  const pillar = (x, y, color, dur = 1.2) => list.push({ type: 'pillar', x, y, color, t: 0, dur });

  const ring = (x, y, r, color, dur = 0.5, fill = false) => list.push({ type: 'ring', x, y, r, color, t: 0, dur, fill });
  const beam = (a, b, color, dur = 0.3) => list.push({ type: 'beam', a, b, color, t: 0, dur });
  function bolt(a, b, color, dur = 0.3) {
    const pts = [];
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const j = i === 0 || i === n ? 0 : (Math.random() - 0.5) * 0.7;
      pts.push({ x: a.x + (b.x - a.x) * t + j, y: a.y + (b.y - a.y) * t - j, z: 18 + Math.random() * 6 });
    }
    // a couple of short forks off the main bolt
    const forks = [];
    for (let k = 0; k < 2; k++) {
      const i = 2 + Math.floor(Math.random() * (n - 3)), q = pts[i], f = [q];
      let x = q.x, y = q.y, z = q.z;
      const ang = Math.atan2(b.y - a.y, b.x - a.x) + (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.6);
      for (let j = 0; j < 3; j++) { x += Math.cos(ang) * 0.35 + (Math.random() - 0.5) * 0.2; y += Math.sin(ang) * 0.35 + (Math.random() - 0.5) * 0.2; z += (Math.random() - 0.3) * 6; f.push({ x, y, z }); }
      forks.push(f);
    }
    list.push({ type: 'bolt', pts, forks, color, t: 0, dur });
  }
  const streak = (x0, y0, x1, y1, color, dur = 0.3, width = 3) => list.push({ type: 'streak', x0, y0, x1, y1, color, t: 0, dur, width });
  function arrowRain(x, y, r, color) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
      list.push({ type: 'drop', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, color, t: -Math.random() * 0.15, dur: 0.25 });
    }
  }
  function telegraph(o) { list.push({ type: 'tele', x: o.x, y: o.y, r: o.r, color: o.color || '#ff4b3a', follow: o.follow, t: 0, dur: o.delay, onDone: o.onDone }); }
  function burst(x, y, color, n = 10, speed = 2, vz = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      parts.push({ x, y, z: 14 + Math.random() * 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: (vz ? vz * 30 : 40) * (0.5 + Math.random()), g: vz ? 0 : 120, life: 0.5 + Math.random() * 0.4, t: 0, color, size: 1.5 + Math.random() * 2 });
    }
  }
  function text(x, y, str, color = '#fff', size = 13, delay = 0, opts = {}) {
    texts.push({ x: x + (Math.random() - 0.5) * 0.3, y, str, color, size, t: -delay, dur: 1.0, coin: !!opts.coin });
  }
  function projectile(o) {
    projs.push({ x: o.from.x, y: o.from.y, z: 20, to: o.to, tx: o.to.x, ty: o.to.y, speed: o.speed || 10, color: o.color || '#fff', size: o.size || 3,
      arrow: o.arrow, spin: o.spin, onHit: o.onHit, ang: 0, trail: [] });
  }
  function shake(dur, mag) { shakeT = Math.max(shakeT, dur); shakeMag = Math.max(shakeMag, mag); }

  function update(dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i];
      f.t += dt;
      if (f.type === 'tele' && f.follow && !f.follow.dead) { f.x = f.follow.x; f.y = f.follow.y; }
      if (f.t >= f.dur) {
        list.splice(i, 1);
        if (f.onDone) f.onDone();
      }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= p.g * dt;
      p.vx *= 0.96; p.vy *= 0.96;
      if (p.z < 0) { p.z = 0; p.vz *= -0.3; }
      if (p.t >= p.life) parts.splice(i, 1);
    }
    for (let i = marks.length - 1; i >= 0; i--) { marks[i].t += dt; if (marks[i].t >= marks[i].life) marks.splice(i, 1); }
    for (let i = texts.length - 1; i >= 0; i--) { texts[i].t += dt; if (texts[i].t >= texts[i].dur) texts.splice(i, 1); }
    for (let i = projs.length - 1; i >= 0; i--) {
      const p = projs[i];
      if (p.to && p.to.id && !p.to.dead && !p.to.removed) { p.tx = p.to.x; p.ty = p.to.y; }
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      const step = p.speed * dt;
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 5) p.trail.shift();
      p.ang = Math.atan2(dy, dx);
      if (d <= step + 0.15) {
        projs.splice(i, 1);
        const alive = p.to && p.to.id ? !p.to.dead : true;
        if (!p.arrow && !p.spin) flash(p.tx, p.ty, p.color, 0.35 + p.size * 0.08, 0.18, p.z);
        if (p.onHit && alive) p.onHit(p.to.id ? p.to : { x: p.tx, y: p.ty });
        continue;
      }
      p.x += (dx / d) * step; p.y += (dy / d) * step;
    }
    if (shakeT > 0) { shakeT -= dt; if (shakeT <= 0) shakeMag = 0; }
  }

  const shakeOffset = () => (shakeT > 0 ? [(Math.random() - 0.5) * shakeMag * 2, (Math.random() - 0.5) * shakeMag * 2] : [0, 0]);

  return { list, parts, texts, projs, marks, mark, flash, pillar, clear, ring, beam, bolt, streak, arrowRain, telegraph, burst, text, projectile, shake, update, shakeOffset };
})();
