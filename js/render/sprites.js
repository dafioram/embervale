/* Procedural sprite art. Everything is drawn with canvas paths so the game ships
   with zero image assets. Units are drawn standing at (0,0) = their ground point,
   with `k` = pixels per sprite unit (zoom * size). */
G.sprites = (() => {
  const TAU = Math.PI * 2;

  function shade(hex, amt) {
    // amt -1..1 : darken / lighten
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    const n = parseInt(c, 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }
  const rgba = (hex, a) => {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    const n = parseInt(c, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  function ellipse(ctx, x, y, rx, ry, fill, stroke, lw) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  const OUT = 'rgba(20,14,10,0.85)';

  /* ---------------- humanoids ----------------
     o.view picks the pose: 0 front, 1 three-quarter front, 2 side, 3 three-quarter back,
     4 back. Unflipped poses face screen-right; o.flip mirrors them for left-facing. */
  function humanoid(ctx, k, o) {
    const v = o.view == null ? 1 : o.view;
    const back = v >= 3, side = v === 2, front = v === 0;
    const walk = o.walk || 0, sw = Math.sin(walk);
    const atk = o.atk || 0; // 0..1 swing progress
    const big = o.big ? 1.15 : 1;
    ctx.save();
    if (o.flip) ctx.scale(-1, 1);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const bob = o.moving ? Math.abs(Math.cos(walk)) * 1.2 * k : Math.sin((o.t || 0) * 2) * 0.4 * k;
    ctx.translate(0, -bob);
    const body = o.color, dark = shade(body, -0.35), light = shade(body, 0.2);
    const skin = o.ghost ? '#bcd7e6' : (o.skin || '#e8c39e');
    const wF = [1, 0.9, 0.66, 0.9, 1][v];
    const tw = 6.2 * k * big * wF, robe = o.robe;
    const fs = [0, 1.3, 2.6, 0, 0][v] * k; // how far the face is turned toward +x
    const hy = -29.5 * k;

    /* --- parts --- */
    const armRot = () => {
      let r = o.moving ? sw * 0.3 : 0;
      if (atk > 0) r = -1.6 + Math.sin(atk * Math.PI) * 2.6;
      if (o.cast) r = -2.2;
      return r;
    };
    const weaponArm = (x) => {
      ctx.save(); ctx.translate(x, -21 * k); ctx.rotate(armRot());
      ctx.strokeStyle = body; ctx.lineWidth = 3 * k * big;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1.5 * k, 8 * k); ctx.stroke();
      ellipse(ctx, 1.6 * k, 8.5 * k, 1.6 * k, 1.6 * k, skin);
      drawWeapon(ctx, k, o.weapon, o);
      ctx.restore();
    };
    const offArm = (x) => {
      const swing = o.moving ? -sw * 2.5 * k * (side ? 1 : 0.4) : 0;
      ctx.strokeStyle = dark; ctx.lineWidth = 3 * k * big;
      ctx.beginPath(); ctx.moveTo(x, -21 * k); ctx.lineTo(x + (x < 0 ? -1.2 : 1.2) * k * (side ? 0 : 1) + swing, -13 * k); ctx.stroke();
      ellipse(ctx, x + (x < 0 ? -1.2 : 1.2) * k * (side ? 0 : 1) + swing, -12.5 * k, 1.5 * k, 1.5 * k, skin);
    };
    const shieldAt = (x, sq, rearSide) => {
      if (!o.shield) return;
      ctx.save(); ctx.translate(x, -17 * k); ctx.scale(sq, 1);
      ctx.fillStyle = rearSide ? shade(o.shield, -0.3) : o.shield;
      ctx.beginPath(); ctx.moveTo(-3.5 * k, -5 * k); ctx.lineTo(3.5 * k, -5 * k); ctx.lineTo(3.5 * k, 1 * k); ctx.quadraticCurveTo(0, 7 * k, -3.5 * k, 1 * k); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rearSide ? shade(o.accent, -0.3) : o.accent; ctx.lineWidth = 1.2 * k; ctx.stroke();
      if (rearSide) { ctx.strokeStyle = '#3a2416'; ctx.lineWidth = 1 * k; ctx.beginPath(); ctx.moveTo(-2.5 * k, -3 * k); ctx.lineTo(2.5 * k, -3 * k); ctx.moveTo(-2.5 * k, 0); ctx.lineTo(2.5 * k, 0); ctx.stroke(); }
      else { ctx.fillStyle = o.accent; ctx.beginPath(); ctx.arc(0, -1 * k, 1.3 * k, 0, TAU); ctx.fill(); }
      ctx.restore();
    };
    const cloakBehind = () => {
      if (!o.cloak) return;
      ctx.fillStyle = shade(o.cloak, -0.15);
      ctx.beginPath();
      if (side) {
        ctx.moveTo(-3 * k, -24 * k); ctx.quadraticCurveTo(-9 * k, -10 * k, -7 * k - sw * k, -3 * k); ctx.lineTo(2 * k, -4 * k); ctx.lineTo(1 * k, -24 * k);
      } else {
        ctx.moveTo(-tw - 0.5 * k, -23 * k); ctx.lineTo(tw + 0.5 * k, -23 * k);
        ctx.quadraticCurveTo(tw + 3 * k, -12 * k, tw + 2.5 * k + sw * 0.5 * k, -3 * k);
        ctx.lineTo(-tw - 2.5 * k - sw * 0.5 * k, -3 * k);
        ctx.quadraticCurveTo(-tw - 3 * k, -12 * k, -tw - 0.5 * k, -23 * k);
      }
      ctx.closePath(); ctx.fill();
    };
    const cloakFront = () => {
      if (!o.cloak) return;
      const wv = o.moving ? sw * 0.8 * k : 0;
      ctx.fillStyle = o.cloak;
      ctx.beginPath();
      ctx.moveTo(-tw - 0.3 * k, -24 * k); ctx.lineTo(tw + 0.3 * k, -24 * k);
      ctx.quadraticCurveTo(tw + 2 * k, -12 * k, tw + 2 * k + wv, -4 * k);
      ctx.quadraticCurveTo(tw * 0.5, -2.5 * k, 0, -4 * k);
      ctx.quadraticCurveTo(-tw * 0.5, -2.5 * k, -tw - 2 * k + wv, -4 * k);
      ctx.quadraticCurveTo(-tw - 2 * k, -12 * k, -tw - 0.3 * k, -24 * k);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = 0.8 * k; ctx.stroke();
      ctx.strokeStyle = shade(o.cloak, -0.3); ctx.lineWidth = 0.9 * k;
      ctx.beginPath(); ctx.moveTo(-2 * k, -21 * k); ctx.lineTo(-3 * k + wv, -6 * k); ctx.moveTo(2.5 * k, -21 * k); ctx.lineTo(3 * k + wv, -6 * k); ctx.stroke();
    };
    const pack = (onBack) => {
      if (!o.pack) return;
      ctx.fillStyle = '#7a5a3a';
      if (onBack) { rrect(ctx, -4.5 * k, -23 * k, 9 * k, 11 * k, 2 * k); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 0.8 * k; ctx.stroke(); ctx.fillStyle = '#5a3d24'; rrect(ctx, -4.5 * k, -23 * k, 9 * k, 3.5 * k, 1.5 * k); ctx.fill(); }
      else if (side) { rrect(ctx, -8.5 * k, -22 * k, 5 * k, 9 * k, 1.5 * k); ctx.fill(); }
      else { rrect(ctx, -tw - 2 * k, -21 * k, 4 * k, 8 * k, 1.5 * k); ctx.fill(); }
    };
    const quiver = (onBack) => {
      if (o.weapon !== 'bow') return;
      ctx.save();
      ctx.translate(onBack ? -1 * k : side ? -4 * k : -tw * 0.55, -18 * k); ctx.rotate(onBack ? 0.45 : side ? 0.35 : 0.5);
      ctx.fillStyle = '#5a3d24'; rrect(ctx, -1.6 * k, -6 * k, 3.2 * k, 11 * k, 1 * k); ctx.fill();
      for (let i = -1; i <= 1; i++) ellipse(ctx, i * 1 * k, -7 * k, 0.8 * k, 1.6 * k, '#e8e0d0');
      ctx.restore();
    };
    const leg = (x, dx, up) => {
      ctx.beginPath(); ctx.moveTo(x, -11 * k); ctx.lineTo(x + dx, -1 * k - up); ctx.stroke();
    };

    /* --- behind the body --- */
    if (!back) cloakBehind();
    const wArmX = side ? 0.8 * k : tw - 1.7 * k;
    const oArmX = side ? -1 * k : -tw + 1.7 * k;
    if (back) {
      // facing away: what the hero holds is on the far side of the body
      weaponArm(wArmX);
      if (o.shield) shieldAt(-tw + 0.2 * k, v === 3 ? 0.8 : 0.95, true);
      else offArm(oArmX);
    } else {
      pack(false); quiver(false);
      if (!o.shield || side) offArm(oArmX);
    }

    /* --- legs --- */
    const hsF = [0, 0.55, 1, 0.55, 0][v];
    const lx = [2.2, 2, 1.1, 2, 2.2][v] * k;
    const la = o.moving ? sw * 3 * k * hsF : 0;
    const lift = (t) => (o.moving ? Math.max(0, t) * 1.8 * k * (1 - hsF * 0.7) : 0);
    ctx.strokeStyle = shade(o.trim || dark, -0.2); ctx.lineWidth = 3.4 * k * big;
    leg(-lx, la, lift(sw)); leg(lx, -la, lift(-sw));
    const bw = [1.6, 1.9, 2.2, 1.9, 1.6][v] * k, bo = [0, 0.5, 0.8, 0.3, 0][v] * k;
    ellipse(ctx, -lx + la + bo, -0.8 * k - lift(sw), bw, 1.1 * k, '#2b2118');
    ellipse(ctx, lx - la + bo, -0.8 * k - lift(-sw), bw, 1.1 * k, '#2b2118');

    /* --- torso --- */
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-tw, -23 * k);
    ctx.quadraticCurveTo(-tw - 1 * k, -16 * k, robe ? -tw - 1.5 * k : -tw + 0.6 * k, robe ? -2.5 * k : -10 * k);
    ctx.lineTo(robe ? tw + 1.5 * k : tw - 0.6 * k, robe ? -2.5 * k : -10 * k);
    ctx.quadraticCurveTo(tw + 1 * k, -16 * k, tw, -23 * k);
    ctx.quadraticCurveTo(0, -26 * k, -tw, -23 * k);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 0.9 * k; ctx.stroke();
    ctx.fillStyle = light; ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.ellipse(-tw * 0.32, -18 * k, 2 * k * wF, 4.5 * k, 0.2, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    if (!robe) { ctx.fillStyle = o.trim || dark; ctx.fillRect(-tw + 0.5 * k, -12.5 * k, tw * 2 - 1 * k, 2 * k); }
    if (!back) {
      const cx = fs * 0.5;
      if (o.apron) { ctx.fillStyle = 'rgba(240,230,210,0.85)'; const aw = side ? 2.5 * k : 3.5 * k * wF; ctx.fillRect((side ? tw - 3 * k : cx) - aw, -17 * k, aw * 2, 8 * k); }
      if (o.accentChest && !side) { ctx.fillStyle = o.accent; ctx.beginPath(); ctx.moveTo(cx, -22 * k); ctx.lineTo(cx + 2 * k * wF, -18 * k); ctx.lineTo(cx, -14 * k); ctx.lineTo(cx - 2 * k * wF, -18 * k); ctx.fill(); }
    } else {
      cloakFront(); pack(true); quiver(true);
    }

    /* --- head --- */
    ellipse(ctx, 0, hy, 4.6 * k * (side ? 0.95 : 1), 4.8 * k, skin, OUT, 0.9 * k);
    if (o.hair && !o.hood) {
      ctx.fillStyle = o.hair;
      if (back) {
        ellipse(ctx, 0, hy - 0.2 * k, 4.8 * k, 5 * k, o.hair);
        if (v === 3) ellipse(ctx, 3.7 * k, hy + 1 * k, 1.1 * k, 1.8 * k, skin); // an ear peeking out
        if (o.longHair) { rrect(ctx, -3.5 * k, hy, 7 * k, 10 * k, 2 * k); ctx.fill(); }
      } else {
        ctx.beginPath(); ctx.arc(-fs * 0.2, hy - 0.8 * k, 4.9 * k, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
        if (side) ellipse(ctx, -1.6 * k, hy, 3.2 * k, 4.6 * k, o.hair);
        else if (v === 1) ellipse(ctx, -2.4 * k, hy, 2.4 * k, 4.4 * k, o.hair);
        if (o.longHair) {
          if (front) { ctx.fillRect(-5 * k, hy - 1 * k, 1.8 * k, 8 * k); ctx.fillRect(3.2 * k, hy - 1 * k, 1.8 * k, 8 * k); }
          else ctx.fillRect(-5 * k, hy - 1 * k, 3 * k, 8 * k);
        }
      }
    }
    if (o.hood) {
      const hc = o.hoodColor || dark;
      ctx.fillStyle = hc;
      ctx.beginPath();
      ctx.moveTo(-5.8 * k, hy + 5 * k);
      ctx.quadraticCurveTo(-6.2 * k, hy - 5 * k, -fs * 0.2, hy - 6 * k);
      ctx.quadraticCurveTo(6.2 * k, hy - 5 * k, 5.8 * k, hy + 5 * k);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = 0.8 * k; ctx.stroke();
      if (!back) {
        // face opening
        ellipse(ctx, fs * 0.55, hy + 0.7 * k, 3.3 * k * (side ? 0.6 : v === 1 ? 0.85 : 1), 3.7 * k, skin);
        ctx.strokeStyle = shade(hc, -0.3); ctx.lineWidth = 0.7 * k;
        ctx.beginPath(); ctx.ellipse(fs * 0.55, hy + 0.7 * k, 3.3 * k * (side ? 0.6 : v === 1 ? 0.85 : 1), 3.7 * k, 0, 0, TAU); ctx.stroke();
      } else {
        ctx.strokeStyle = shade(hc, -0.25); ctx.lineWidth = 0.8 * k;
        ctx.beginPath(); ctx.moveTo(0, hy - 5.5 * k); ctx.lineTo(0, hy + 4 * k); ctx.stroke();
      }
    }
    if (o.hat) { ctx.fillStyle = shade(o.hat === true ? '#8a6a3a' : o.hat, -0.1); ellipse(ctx, 0, hy - 3.6 * k, 7 * k, 1.8 * k, ctx.fillStyle); rrect(ctx, -3.2 * k, hy - 8 * k, 6.4 * k, 4.6 * k, 1.2 * k); ctx.fill(); }
    if (o.helm) { ctx.fillStyle = '#9aa3ab'; ctx.beginPath(); ctx.arc(0, hy, 5.2 * k, Math.PI, TAU); ctx.fill(); ctx.fillStyle = o.accent; ctx.fillRect(-0.8 * k, hy - 7 * k, 1.6 * k, 3 * k); }
    if (o.crown) { ctx.fillStyle = '#e6b84a'; ctx.beginPath(); ctx.moveTo(-4 * k, hy - 4 * k); for (let i = 0; i <= 4; i++) ctx.lineTo(-4 * k + i * 2 * k, hy - (i % 2 ? 9 : 5) * k); ctx.lineTo(4 * k, hy - 4 * k); ctx.fill(); }
    if (!back) {
      const ec = o.ghost ? '#9fe8ff' : '#2a1a10';
      if (front) { ellipse(ctx, -1.6 * k, hy - 0.3 * k, 0.65 * k, 0.8 * k, ec); ellipse(ctx, 1.6 * k, hy - 0.3 * k, 0.65 * k, 0.8 * k, ec); }
      else if (v === 1) { ellipse(ctx, 0.5 * k, hy - 0.3 * k, 0.55 * k, 0.75 * k, ec); ellipse(ctx, 2.8 * k, hy - 0.3 * k, 0.65 * k, 0.8 * k, ec); }
      else { ellipse(ctx, 2.8 * k, hy - 0.3 * k, 0.7 * k, 0.8 * k, ec); if (!o.hood) ellipse(ctx, 4.4 * k, hy + 0.7 * k, 0.8 * k, 0.7 * k, shade(skin, -0.12)); }
      if (o.beard) {
        ctx.fillStyle = '#d9d4cc'; ctx.beginPath();
        if (front) { ctx.moveTo(-2.6 * k, hy + 1.6 * k); ctx.quadraticCurveTo(0, hy + 9 * k, 2.6 * k, hy + 1.6 * k); }
        else { ctx.moveTo(-1 * k + fs * 0.3, hy + 1.5 * k); ctx.quadraticCurveTo(3 * k + fs * 0.3, hy + 8 * k, 4.5 * k, hy + 1 * k); }
        ctx.closePath(); ctx.fill();
      }
    }

    /* --- in front of the body --- */
    if (!back) {
      if (o.shield && !side) shieldAt(front ? -5.5 * k : -tw * 0.85, front ? 1 : 0.85, false);
      if (o.shield && side) shieldAt(4.4 * k, 0.4, false);
      weaponArm(wArmX);
    }
    ctx.restore();
  }

  function drawWeapon(ctx, k, w, o) {
    ctx.lineCap = 'round';
    if (w === 'sword' || w === 'blade') {
      ctx.strokeStyle = '#d8dee4'; ctx.lineWidth = 1.8 * k;
      ctx.beginPath(); ctx.moveTo(1.6 * k, 9 * k); ctx.lineTo(1.6 * k, 22 * k); ctx.stroke();
      ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 2.4 * k; ctx.beginPath(); ctx.moveTo(-1 * k, 9.5 * k); ctx.lineTo(4.2 * k, 9.5 * k); ctx.stroke();
    } else if (w === 'axe') {
      ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 2.2 * k; ctx.beginPath(); ctx.moveTo(1.6 * k, 6 * k); ctx.lineTo(1.6 * k, 22 * k); ctx.stroke();
      ctx.fillStyle = '#b9c0c6'; ctx.beginPath(); ctx.moveTo(1.6 * k, 16 * k); ctx.quadraticCurveTo(9 * k, 17 * k, 8 * k, 23 * k); ctx.lineTo(1.6 * k, 21 * k); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = 0.7 * k; ctx.stroke();
    } else if (w === 'club') {
      ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 3.2 * k; ctx.beginPath(); ctx.moveTo(1.6 * k, 8 * k); ctx.lineTo(2 * k, 19 * k); ctx.stroke();
      ellipse(ctx, 2 * k, 19 * k, 3 * k, 3.6 * k, '#7a5432');
    } else if (w === 'staff') {
      ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 1.8 * k; ctx.beginPath(); ctx.moveTo(1.6 * k, -6 * k); ctx.lineTo(1.6 * k, 20 * k); ctx.stroke();
      const g = o.orb || o.accent || '#9fe8ff';
      ellipse(ctx, 1.6 * k, -7 * k, 2.4 * k, 2.4 * k, g);
      ctx.globalAlpha = 0.35; ellipse(ctx, 1.6 * k, -7 * k, 4.5 * k, 4.5 * k, g); ctx.globalAlpha = 1;
    } else if (w === 'bow') {
      ctx.strokeStyle = '#7a5432'; ctx.lineWidth = 1.6 * k;
      ctx.beginPath(); ctx.arc(1.6 * k, 9 * k, 9 * k, -1.1, 1.1); ctx.stroke();
      ctx.strokeStyle = 'rgba(240,230,210,0.8)'; ctx.lineWidth = 0.6 * k;
      ctx.beginPath(); ctx.moveTo(1.6 * k + Math.cos(-1.1) * 9 * k, 9 * k + Math.sin(-1.1) * 9 * k); ctx.lineTo(1.6 * k + Math.cos(1.1) * 9 * k, 9 * k + Math.sin(1.1) * 9 * k); ctx.stroke();
    } else if (w === 'dagger') {
      ctx.strokeStyle = '#d8dee4'; ctx.lineWidth = 1.5 * k; ctx.beginPath(); ctx.moveTo(1.6 * k, 9 * k); ctx.lineTo(1.6 * k, 15 * k); ctx.stroke();
    }
  }

  const HERO_LOOK = {
    warden: (d) => ({ color: d.color, accent: d.accent, trim: d.trim, weapon: 'sword', shield: '#7a4a24', hair: '#3a2416', cloak: '#6e3a1e', accentChest: true, big: true }),
    shaman: (d) => ({ color: d.color, accent: d.accent, trim: d.trim, weapon: 'staff', orb: '#9fe8ff', robe: true, hair: '#c9b38a', beard: false, hat: '#5a6e3a' }),
    hunter: (d) => ({ color: d.color, accent: d.accent, trim: d.trim, weapon: 'bow', hood: true, hoodColor: '#3d2a55', cloak: '#3d2a55', hair: '#1e1424', longHair: true }),
  };

  /* ---------------- beasts and monsters ---------------- */
  function boar(ctx, k, o) {
    const w = o.walk || 0, lg = o.moving ? Math.sin(w) * 2 * k : 0;
    ctx.strokeStyle = shade(o.color, -0.4); ctx.lineWidth = 2.4 * k; ctx.lineCap = 'round';
    for (const [x, s] of [[-6, 1], [-3, -1], [4, -1], [7, 1]]) { ctx.beginPath(); ctx.moveTo(x * k, -6 * k); ctx.lineTo(x * k + lg * s, 0); ctx.stroke(); }
    const bob = o.moving ? Math.abs(Math.cos(w)) * 1 * k : 0;
    ctx.translate(0, -bob);
    ellipse(ctx, 0, -9 * k, 11 * k, 6.5 * k, o.color, OUT, k);
    ctx.fillStyle = shade(o.color, -0.35);
    ctx.beginPath(); for (let i = 0; i < 7; i++) { const x = -8 * k + i * 2.5 * k; ctx.moveTo(x, -13.5 * k); ctx.lineTo(x + 1.2 * k, -17.5 * k); ctx.lineTo(x + 2.4 * k, -13.5 * k); } ctx.fill();
    ellipse(ctx, 10 * k, -8 * k, 5 * k, 4.2 * k, shade(o.color, -0.1), OUT, k);
    ellipse(ctx, 14 * k, -7 * k, 2 * k, 1.8 * k, '#c99a8a');
    ctx.strokeStyle = o.accent; ctx.lineWidth = 1.4 * k;
    ctx.beginPath(); ctx.moveTo(13 * k, -5 * k); ctx.quadraticCurveTo(16 * k, -6 * k, 16 * k, -10 * k); ctx.stroke();
    ellipse(ctx, 11 * k, -10 * k, 0.8 * k, 0.8 * k, '#1a0f08');
    ctx.translate(0, bob);
  }
  function wolf(ctx, k, o) {
    const w = o.walk || 0, lg = o.moving ? Math.sin(w) * 2.5 * k : 0;
    ctx.strokeStyle = shade(o.color, -0.35); ctx.lineWidth = 2 * k; ctx.lineCap = 'round';
    for (const [x, s] of [[-7, 1], [-4, -1], [5, -1], [8, 1]]) { ctx.beginPath(); ctx.moveTo(x * k, -7 * k); ctx.lineTo(x * k + lg * s, 0); ctx.stroke(); }
    const bob = o.moving ? Math.abs(Math.cos(w)) * 1.2 * k : 0;
    ctx.translate(0, -bob);
    // tail
    ctx.strokeStyle = o.color; ctx.lineWidth = 3 * k;
    ctx.beginPath(); ctx.moveTo(-10 * k, -11 * k); ctx.quadraticCurveTo(-16 * k, -12 * k + Math.sin((o.t || 0) * 5) * k, -17 * k, -7 * k); ctx.stroke();
    ellipse(ctx, 0, -10 * k, 11 * k, 5 * k, o.color, OUT, k);
    ctx.globalAlpha = 0.5; ellipse(ctx, 0, -8 * k, 8 * k, 2.4 * k, o.accent); ctx.globalAlpha = 1;
    // head
    ctx.fillStyle = o.color;
    ctx.beginPath(); ctx.moveTo(8 * k, -15 * k); ctx.lineTo(18 * k, -11 * k); ctx.lineTo(16 * k, -8.5 * k); ctx.lineTo(8 * k, -8 * k); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = k; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(9 * k, -14 * k); ctx.lineTo(10 * k, -19 * k); ctx.lineTo(12 * k, -14 * k); ctx.closePath(); ctx.fill();
    ellipse(ctx, 12.5 * k, -12.5 * k, 0.9 * k, 0.8 * k, o.eye || '#ffd54a');
    ctx.translate(0, bob);
  }
  function spider(ctx, k, o) {
    const t = o.t || 0, mv = o.moving ? 1 : 0.2;
    ctx.strokeStyle = shade(o.color, -0.3); ctx.lineWidth = 1.5 * k; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      const ph = Math.sin(t * 12 * mv + i * 1.7 + (s > 0 ? 1 : 0)) * 2 * k * mv;
      const bx = (-1 + i * 1.6) * k, by = -7 * k;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + s * 6 * k + ph, by - 5 * k); ctx.lineTo(bx + s * 11 * k + ph, 0); ctx.stroke();
    }
    ellipse(ctx, -5 * k, -9 * k, 8 * k, 6.5 * k, o.color, OUT, k);
    ctx.fillStyle = o.accent; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(-5 * k, -14 * k); ctx.lineTo(-3 * k, -9 * k); ctx.lineTo(-5 * k, -5 * k); ctx.lineTo(-7 * k, -9 * k); ctx.fill(); ctx.globalAlpha = 1;
    ellipse(ctx, 4 * k, -8 * k, 4.5 * k, 3.8 * k, shade(o.color, -0.15), OUT, k);
    for (const [x, y] of [[6, -9], [7.5, -8.5], [6.5, -7.2]]) ellipse(ctx, x * k, y * k, 0.7 * k, 0.7 * k, '#ff3b3b');
  }
  function blob(ctx, k, o) {
    const t = o.t || 0;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * TAU;
      const rr = 1 + Math.sin(a * 3 + t * 3) * 0.06 + Math.sin(a * 5 - t * 2) * 0.04;
      const x = Math.cos(a) * 10 * k * rr, y = -9 * k + Math.sin(a) * 8.5 * k * rr * (a > Math.PI ? 1.1 : 0.9);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.fillStyle = o.color; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = k; ctx.stroke();
    ctx.globalAlpha = 0.45; ellipse(ctx, -3 * k, -13 * k, 4 * k, 2.5 * k, o.accent); ctx.globalAlpha = 1;
    ellipse(ctx, 3 * k, -11 * k, 1.6 * k, 1.8 * k, '#f8f3c0'); ellipse(ctx, 6.5 * k, -10.5 * k, 1.3 * k, 1.5 * k, '#f8f3c0');
    ellipse(ctx, 3.4 * k, -11 * k, 0.7 * k, 0.9 * k, '#111'); ellipse(ctx, 6.8 * k, -10.5 * k, 0.6 * k, 0.8 * k, '#111');
    if (o.boss) { ctx.strokeStyle = '#7a8a3a'; ctx.lineWidth = 1.2 * k; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo((-6 + i * 2.4) * k, -17 * k); ctx.lineTo((-7 + i * 2.6) * k, -23 * k - (i % 2) * 2 * k); ctx.stroke(); } }
  }
  function stalker(ctx, k, o) {
    const w = o.walk || 0, lg = o.moving ? Math.sin(w) * 3 * k : 0;
    ctx.strokeStyle = shade(o.color, -0.3); ctx.lineWidth = 2 * k; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-4 * k, -10 * k); ctx.lineTo(-5 * k + lg, 0); ctx.moveTo(2 * k, -10 * k); ctx.lineTo(3 * k - lg, 0); ctx.stroke();
    ctx.save(); ctx.rotate(0.35);
    ellipse(ctx, 0, -16 * k, 6 * k, 9 * k, o.color, OUT, k);
    ctx.restore();
    ctx.strokeStyle = o.color; ctx.lineWidth = 2.2 * k;
    const atk = o.atk ? Math.sin(o.atk * Math.PI) * 6 * k : 0;
    ctx.beginPath(); ctx.moveTo(6 * k, -20 * k); ctx.quadraticCurveTo(12 * k + atk, -14 * k, 10 * k + atk, -4 * k); ctx.stroke();
    ellipse(ctx, 8 * k, -24 * k, 4 * k, 3.2 * k, shade(o.color, -0.1), OUT, k);
    ellipse(ctx, 10 * k, -24.5 * k, 0.9 * k, 0.9 * k, o.accent);
  }
  function wisp(ctx, k, o) {
    const t = o.t || 0, y = -16 * k + Math.sin(t * 3) * 2 * k;
    const g = ctx.createRadialGradient(0, y, 0, 0, y, 12 * k);
    g.addColorStop(0, rgba(o.color, 0.9)); g.addColorStop(0.4, rgba(o.color, 0.35)); g.addColorStop(1, rgba(o.color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, y, 12 * k, 0, TAU); ctx.fill();
    ellipse(ctx, 0, y, 3.5 * k, 3.5 * k, '#ffffff');
    for (let i = 0; i < 3; i++) { const a = t * 2 + i * 2.1; ellipse(ctx, Math.cos(a) * 6 * k, y + Math.sin(a) * 3 * k + 3 * k, 1.2 * k, 1.2 * k, rgba(o.accent, 0.8)); }
  }
  function imp(ctx, k, o) {
    const w = o.walk || 0, lg = o.moving ? Math.sin(w) * 2 * k : 0, t = o.t || 0;
    ctx.strokeStyle = '#1a1210'; ctx.lineWidth = 2.2 * k; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-2 * k, -6 * k); ctx.lineTo(-2.5 * k + lg, 0); ctx.moveTo(2 * k, -6 * k); ctx.lineTo(2.5 * k - lg, 0); ctx.stroke();
    ellipse(ctx, 0, -10 * k, 5.5 * k, 6 * k, o.color, OUT, k);
    ctx.strokeStyle = o.accent; ctx.lineWidth = 0.9 * k; ctx.globalAlpha = 0.6 + Math.sin(t * 8) * 0.3;
    ctx.beginPath(); ctx.moveTo(-2 * k, -14 * k); ctx.lineTo(0, -10 * k); ctx.lineTo(-1 * k, -6 * k); ctx.moveTo(2 * k, -13 * k); ctx.lineTo(3 * k, -9 * k); ctx.stroke();
    ctx.globalAlpha = 1;
    ellipse(ctx, 1 * k, -17 * k, 3.8 * k, 3.4 * k, shade(o.color, 0.1), OUT, k);
    ctx.fillStyle = '#1a1210';
    ctx.beginPath(); ctx.moveTo(-2 * k, -19 * k); ctx.lineTo(-4 * k, -24 * k); ctx.lineTo(-0.5 * k, -20 * k); ctx.moveTo(3 * k, -19.5 * k); ctx.lineTo(5 * k, -24 * k); ctx.lineTo(1.5 * k, -20 * k); ctx.fill();
    ellipse(ctx, 2.5 * k, -17.5 * k, 0.9 * k, 0.9 * k, o.accent);
  }
  function golem(ctx, k, o) {
    const w = o.walk || 0, lg = o.moving ? Math.sin(w) * 2 * k : 0, t = o.t || 0;
    const c = o.color, dk = shade(c, -0.3), lt = shade(c, 0.15);
    ctx.fillStyle = dk;
    rrect(ctx, -6 * k + lg * 0.5, -9 * k, 4.5 * k, 9 * k, k); ctx.fill();
    rrect(ctx, 1.5 * k - lg * 0.5, -9 * k, 4.5 * k, 9 * k, k); ctx.fill();
    ctx.fillStyle = c; rrect(ctx, -9 * k, -24 * k, 18 * k, 16 * k, 3 * k); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = k; ctx.stroke();
    ctx.fillStyle = lt; rrect(ctx, -8 * k, -23 * k, 7 * k, 5 * k, 2 * k); ctx.fill();
    // core
    const pulse = 0.7 + Math.sin(t * 4) * 0.3;
    const g = ctx.createRadialGradient(0, -16 * k, 0, 0, -16 * k, 6 * k);
    g.addColorStop(0, o.accent); g.addColorStop(1, rgba('#ff3a00', 0));
    ctx.globalAlpha = pulse; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -16 * k, 6 * k, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = o.accent; ctx.lineWidth = 0.9 * k; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(-7 * k, -20 * k); ctx.lineTo(-3 * k, -15 * k); ctx.lineTo(-6 * k, -10 * k); ctx.moveTo(6 * k, -21 * k); ctx.lineTo(3 * k, -14 * k); ctx.stroke(); ctx.globalAlpha = 1;
    // arms
    const atk = o.atk ? Math.sin(o.atk * Math.PI) * 5 * k : 0;
    ctx.fillStyle = dk;
    rrect(ctx, -14 * k, -23 * k + atk * 0.3, 5 * k, 14 * k, 2 * k); ctx.fill();
    rrect(ctx, 9 * k + atk * 0.4, -23 * k - atk, 5 * k, 14 * k, 2 * k); ctx.fill();
    // head
    ctx.fillStyle = c; rrect(ctx, -4 * k, -31 * k, 8 * k, 7 * k, 2 * k); ctx.fill(); ctx.stroke();
    ellipse(ctx, 1.5 * k, -28 * k, 1 * k, 0.8 * k, o.accent);
    if (o.boss) { ctx.fillStyle = o.accent; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo((-5 + i * 2.5) * k, -31 * k); ctx.lineTo((-4 + i * 2.5) * k, -36 * k - (i % 2) * 2 * k); ctx.lineTo((-3 + i * 2.5) * k, -31 * k); ctx.fill(); } }
  }
  function ward(ctx, k, o) {
    const t = o.t || 0;
    ctx.fillStyle = '#5a3d22'; rrect(ctx, -2.5 * k, -20 * k, 5 * k, 20 * k, 1.5 * k); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 0.8 * k; ctx.stroke();
    ctx.strokeStyle = '#7a9a3a'; ctx.lineWidth = 1.2 * k;
    for (let i = 0; i < 4; i++) { const y = -4 * k - i * 4 * k; ctx.beginPath(); ctx.moveTo(-2.5 * k, y); ctx.lineTo(-5 * k, y - 2 * k); ctx.moveTo(2.5 * k, y - 1 * k); ctx.lineTo(5 * k, y - 3 * k); ctx.stroke(); }
    const g = ctx.createRadialGradient(0, -22 * k, 0, 0, -22 * k, 6 * k);
    g.addColorStop(0, '#e9ffb0'); g.addColorStop(1, 'rgba(160,230,90,0)');
    ctx.globalAlpha = 0.7 + Math.sin(t * 5) * 0.3; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -22 * k, 6 * k, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }

  /* Draw any unit/NPC. state: {walk, moving, atk, cast, flip, t} */
  function unit(ctx, k, e, st) {
    if (e.kind === 'hero' || (e.def && e.def.look && e.def.look.hero)) {
      const hid = e.heroId || e.def.look.hero;
      const d = G.HEROES[hid];
      const look = HERO_LOOK[d.shape](d);
      humanoid(ctx, k, { ...look, ...st });
      return;
    }
    if (e.kind === 'npc') { humanoid(ctx, k, { orb: '#9fe8ff', ...e.def.look, weapon: e.def.look.staff ? 'staff' : e.def.look.bow ? 'bow' : null, ...st }); return; }
    const d = e.def, o = { color: d.color, accent: d.accent, boss: d.boss, ...st };
    if (d.shape !== 'humanoid') {
      // beasts are drawn side-on facing right; mirror them when heading left
      ctx.save();
      if (st && st.flip) ctx.scale(-1, 1);
      drawBeast(ctx, k, d, o);
      ctx.restore();
      return;
    }
    return humanoid(ctx, k, { ...o, weapon: d.weapon, hood: d.hood, ghost: d.ghost, trim: shade(d.color, -0.4), helm: (d.boss && !d.crown) || d.helmet, crown: !!d.crown, big: d.size > 1.2,
      skin: d.ghost ? '#bcd7e6' : '#d9b08c', hoodColor: shade(d.color, -0.3), orb: d.accent });
  }
  function drawBeast(ctx, k, d, o) {
    switch (d.shape) {
      case 'boar': return boar(ctx, k, o);
      case 'wolf': return wolf(ctx, k, { ...o, eye: d.summon ? '#ffb02e' : '#ffd54a' });
      case 'spider': return spider(ctx, k, o);
      case 'blob': return blob(ctx, k, o);
      case 'stalker': return stalker(ctx, k, o);
      case 'wisp': return wisp(ctx, k, o);
      case 'imp': return imp(ctx, k, o);
      case 'golem': return golem(ctx, k, o);
      case 'ward': return ward(ctx, k, o);
    }
  }

  /* ---------------- terrain props ---------------- */
  const sprCache = {};
  function sprite(key, w, h, draw) {
    if (sprCache[key]) return sprCache[key];
    const c = document.createElement('canvas');
    const S = 2;
    c.width = w * S; c.height = h * S;
    const x = c.getContext('2d');
    x.scale(S, S);
    draw(x, w, h);
    c.ax = w / 2; c.ay = h - 6; c.lw = w; c.lh = h;
    sprCache[key] = c;
    return c;
  }

  function treeSprite(theme, v) {
    return sprite(`tree-${theme}-${v}`, 70, 96, (x, w, h) => {
      const cx = w / 2, by = h - 6;
      x.fillStyle = 'rgba(0,0,0,0.22)'; x.beginPath(); x.ellipse(cx, by, 16, 7, 0, 0, TAU); x.fill();
      const pine = theme === 'forest' ? v < 3 : theme === 'village' || theme === 'meadow' ? v === 5 : false;
      const dead = theme === 'swamp' && v >= 4;
      const willow = theme === 'swamp' && v < 4;
      const pal = { village: ['#4f7a35', '#5f8c3c', '#6f9e48'], meadow: ['#4c7a30', '#5d8f3a', '#79aa4c'], forest: ['#2f5228', '#3a6330', '#4c7a3a'], swamp: ['#4a5a30', '#5a6a38', '#6e7a44'] }[theme] || ['#3a6330', '#4c7a3a', '#5f8c3c'];
      // trunk
      x.fillStyle = dead ? '#4a3d30' : '#5a3d24';
      x.beginPath(); x.moveTo(cx - 3.5, by); x.lineTo(cx - 2.2, by - 26); x.lineTo(cx + 2.2, by - 26); x.lineTo(cx + 3.5, by); x.closePath(); x.fill();
      if (dead) {
        x.strokeStyle = '#4a3d30'; x.lineWidth = 2.4; x.lineCap = 'round';
        x.beginPath(); x.moveTo(cx, by - 20); x.lineTo(cx - 12, by - 40); x.moveTo(cx, by - 25); x.lineTo(cx + 10, by - 46); x.moveTo(cx - 6, by - 31); x.lineTo(cx - 15, by - 33); x.moveTo(cx + 5, by - 35); x.lineTo(cx + 15, by - 38); x.stroke();
        return;
      }
      if (pine) {
        for (let i = 0; i < 4; i++) {
          const yb = by - 14 - i * 13, ww = 22 - i * 4.5;
          x.fillStyle = pal[i % 2 ? 1 : 0];
          x.beginPath(); x.moveTo(cx - ww, yb); x.lineTo(cx, yb - 22); x.lineTo(cx + ww, yb); x.closePath(); x.fill();
          x.fillStyle = 'rgba(255,255,255,0.08)'; x.beginPath(); x.moveTo(cx - ww * 0.5, yb - 4); x.lineTo(cx, yb - 22); x.lineTo(cx - ww * 0.15, yb - 2); x.fill();
        }
        return;
      }
      if (willow) {
        x.fillStyle = pal[0]; x.beginPath(); x.ellipse(cx, by - 44, 22, 16, 0, 0, TAU); x.fill();
        x.strokeStyle = pal[1]; x.lineWidth = 2;
        for (let i = 0; i < 9; i++) { const sx = cx - 18 + i * 4.5; x.beginPath(); x.moveTo(sx, by - 40); x.quadraticCurveTo(sx + 2, by - 24, sx - 1, by - 14 - (i % 3) * 4); x.stroke(); }
        x.fillStyle = pal[2]; x.beginPath(); x.ellipse(cx - 6, by - 50, 10, 6, 0, 0, TAU); x.fill();
        return;
      }
      const blobs = [[0, -50, 19], [-11, -40, 13], [11, -40, 13], [0, -38, 14], [-5, -60, 11], [7, -57, 11]];
      blobs.forEach(([ox, oy, r], i) => { x.fillStyle = pal[i < 3 ? 0 : 1]; x.beginPath(); x.arc(cx + ox + (v - 2) * 0.6, by + oy, r, 0, TAU); x.fill(); });
      x.fillStyle = pal[2];
      [[-6, -56, 7], [5, -50, 6], [-10, -44, 5]].forEach(([ox, oy, r]) => { x.beginPath(); x.arc(cx + ox, by + oy, r, 0, TAU); x.fill(); });
      if (v === 4 && theme !== 'forest') { x.fillStyle = '#e0a0b0'; for (let i = 0; i < 8; i++) { x.beginPath(); x.arc(cx - 12 + Math.sin(i * 7) * 12, by - 44 + Math.cos(i * 5) * 12, 1.6, 0, TAU); x.fill(); } }
    });
  }
  function boulderSprite(theme, v) {
    return sprite(`rock-${theme}-${v}`, 44, 40, (x, w, h) => {
      const cx = w / 2, by = h - 6;
      const base = theme === 'swamp' ? '#6a6a58' : theme === 'cave' ? '#3a3230' : theme === 'deep' ? '#343a4c' : '#8a8a84';
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.ellipse(cx, by, 15, 6, 0, 0, TAU); x.fill();
      x.fillStyle = base;
      x.beginPath(); x.moveTo(cx - 14, by); x.lineTo(cx - 12 - v, by - 12); x.lineTo(cx - 4, by - 20 + v); x.lineTo(cx + 8, by - 18); x.lineTo(cx + 14, by - 6); x.lineTo(cx + 12, by + 1); x.closePath(); x.fill();
      x.fillStyle = shade(base, 0.2); x.beginPath(); x.moveTo(cx - 12 - v, by - 12); x.lineTo(cx - 4, by - 20 + v); x.lineTo(cx + 8, by - 18); x.lineTo(cx + 2, by - 10); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 1; x.stroke();
      if (theme === 'swamp' || theme === 'forest') { x.fillStyle = 'rgba(90,130,60,0.6)'; x.beginPath(); x.ellipse(cx - 2, by - 16, 7, 3, 0, 0, TAU); x.fill(); }
    });
  }

  /* ---------------- UI icons (items + abilities), drawn once to data URLs ---------------- */
  const iconCache = {};
  function icon(kind, color, size = 48) {
    const key = kind + color + size;
    if (iconCache[key]) return iconCache[key];
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d');
    const s = size / 48;
    x.scale(s, s);
    const g = x.createLinearGradient(0, 0, 0, 48);
    g.addColorStop(0, shade(color, -0.45)); g.addColorStop(1, shade(color, -0.75));
    x.fillStyle = g; x.fillRect(0, 0, 48, 48);
    x.lineCap = 'round'; x.lineJoin = 'round';
    const L = shade(color, 0.35), M = color, D = shade(color, -0.3);
    const W = '#f6efe0';
    x.strokeStyle = W; x.fillStyle = M; x.lineWidth = 2.5;
    switch (kind) {
      case 'potion':
        x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(20, 8, 8, 9);
        x.beginPath(); x.arc(24, 30, 11, 0, TAU); x.fillStyle = M; x.fill(); x.stroke();
        x.fillStyle = L; x.beginPath(); x.arc(20, 27, 3.5, 0, TAU); x.fill();
        x.fillStyle = '#8a6a3a'; x.fillRect(20, 6, 8, 5);
        break;
      case 'feather': {
        // a curved flame-coloured feather with a quill
        x.save(); x.translate(24, 25); x.rotate(-0.6);
        const fg = x.createLinearGradient(0, -18, 0, 16); fg.addColorStop(0, '#ffe08a'); fg.addColorStop(0.5, M); fg.addColorStop(1, '#c0391b');
        x.fillStyle = fg; x.beginPath(); x.moveTo(0, -19); x.quadraticCurveTo(10, -8, 6, 10); x.quadraticCurveTo(2, 14, 0, 15); x.quadraticCurveTo(-2, 14, -6, 10); x.quadraticCurveTo(-10, -8, 0, -19); x.fill();
        x.strokeStyle = 'rgba(120,30,10,0.55)'; x.lineWidth = 1;
        for (let i = -12; i < 10; i += 4) { x.beginPath(); x.moveTo(0, i); x.lineTo(-5, i + 4); x.moveTo(0, i); x.lineTo(5, i + 4); x.stroke(); }
        x.strokeStyle = W; x.lineWidth = 1.6; x.beginPath(); x.moveTo(0, -16); x.lineTo(0, 22); x.stroke();
        x.restore();
        break;
      }
      case 'herb':
        x.strokeStyle = '#3a7a2a'; x.lineWidth = 2; x.beginPath(); x.moveTo(24, 42); x.lineTo(24, 16); x.stroke();
        for (const [a, y] of [[-1, 30], [1, 24], [-1, 18], [1, 34]]) { x.fillStyle = a > 0 ? L : M; x.beginPath(); x.ellipse(24 + a * 7, y, 7, 3.5, a * 0.5, 0, TAU); x.fill(); }
        break;
      case 'scroll':
        x.fillStyle = '#efe0b8'; x.fillRect(12, 14, 24, 20); x.fillStyle = '#c9a86a'; x.beginPath(); x.arc(12, 24, 4, 0, TAU); x.arc(36, 24, 4, 0, TAU); x.fill();
        x.strokeStyle = M; x.lineWidth = 1.5; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(16, 19 + i * 5); x.lineTo(32, 19 + i * 5); x.stroke(); }
        break;
      case 'tome':
        x.fillStyle = M; x.fillRect(12, 10, 24, 30); x.fillStyle = D; x.fillRect(12, 10, 4, 30);
        x.fillStyle = '#f2e6c4'; x.fillRect(33, 12, 3, 26);
        x.strokeStyle = '#f2d36a'; x.lineWidth = 1.5; x.strokeRect(19, 17, 12, 14);
        x.fillStyle = '#f2d36a'; x.beginPath(); x.arc(25, 24, 3, 0, TAU); x.fill();
        break;
      case 'shield':
        x.beginPath(); x.moveTo(12, 10); x.lineTo(36, 10); x.lineTo(36, 24); x.quadraticCurveTo(24, 42, 12, 24); x.closePath(); x.fill(); x.stroke();
        x.fillStyle = L; x.beginPath(); x.arc(24, 22, 4, 0, TAU); x.fill();
        break;
      case 'sword': case 'dagger':
        x.strokeStyle = '#e0e6ea'; x.lineWidth = kind === 'sword' ? 4 : 3; x.beginPath(); x.moveTo(14, 36); x.lineTo(kind === 'sword' ? 36 : 30, kind === 'sword' ? 10 : 16); x.stroke();
        x.strokeStyle = '#a07a3a'; x.lineWidth = 3; x.beginPath(); x.moveTo(11, 30); x.lineTo(19, 38); x.stroke();
        x.strokeStyle = '#5a3a1a'; x.beginPath(); x.moveTo(14, 36); x.lineTo(9, 41); x.stroke();
        break;
      case 'axe':
        x.strokeStyle = '#6b4a2a'; x.lineWidth = 3; x.beginPath(); x.moveTo(14, 40); x.lineTo(32, 10); x.stroke();
        x.fillStyle = '#c4ccd2'; x.beginPath(); x.moveTo(26, 12); x.quadraticCurveTo(40, 12, 38, 26); x.lineTo(30, 20); x.closePath(); x.fill();
        break;
      case 'boots':
        x.beginPath(); x.moveTo(14, 10); x.lineTo(24, 10); x.lineTo(24, 30); x.lineTo(36, 32); x.lineTo(36, 38); x.lineTo(14, 38); x.closePath(); x.fill(); x.stroke();
        x.strokeStyle = L; x.beginPath(); x.moveTo(30, 18); x.lineTo(38, 14); x.moveTo(30, 23); x.lineTo(40, 20); x.stroke();
        break;
      case 'gloves':
        x.beginPath(); x.moveTo(14, 38); x.lineTo(14, 18); x.lineTo(18, 12); x.lineTo(22, 18); x.lineTo(26, 11); x.lineTo(30, 18); x.lineTo(34, 14); x.lineTo(34, 38); x.closePath(); x.fill(); x.stroke();
        break;
      case 'gem':
        x.beginPath(); x.moveTo(24, 8); x.lineTo(37, 20); x.lineTo(24, 40); x.lineTo(11, 20); x.closePath(); x.fill(); x.stroke();
        x.fillStyle = L; x.beginPath(); x.moveTo(24, 8); x.lineTo(30, 20); x.lineTo(24, 26); x.lineTo(18, 20); x.closePath(); x.fill();
        break;
      case 'ring':
        x.strokeStyle = '#e8c35a'; x.lineWidth = 5; x.beginPath(); x.arc(24, 28, 10, 0, TAU); x.stroke();
        x.fillStyle = M; x.beginPath(); x.arc(24, 15, 5, 0, TAU); x.fill(); x.strokeStyle = W; x.lineWidth = 1.5; x.stroke();
        break;
      case 'amulet':
        x.strokeStyle = '#e8c35a'; x.lineWidth = 2; x.beginPath(); x.moveTo(12, 8); x.quadraticCurveTo(24, 26, 36, 8); x.stroke();
        x.beginPath(); x.arc(24, 30, 8, 0, TAU); x.fill(); x.strokeStyle = W; x.lineWidth = 2; x.stroke();
        x.fillStyle = L; x.beginPath(); x.arc(22, 28, 2.5, 0, TAU); x.fill();
        break;
      case 'crown':
        x.beginPath(); x.moveTo(10, 34); x.lineTo(12, 16); x.lineTo(18, 24); x.lineTo(24, 12); x.lineTo(30, 24); x.lineTo(36, 16); x.lineTo(38, 34); x.closePath(); x.fill(); x.stroke();
        break;
      case 'armor':
        x.beginPath(); x.moveTo(14, 10); x.lineTo(20, 14); x.lineTo(28, 14); x.lineTo(34, 10); x.lineTo(38, 18); x.lineTo(33, 22); x.lineTo(33, 40); x.lineTo(15, 40); x.lineTo(15, 22); x.lineTo(10, 18); x.closePath(); x.fill(); x.stroke();
        break;
      case 'cloak':
        x.beginPath(); x.moveTo(18, 8); x.lineTo(30, 8); x.quadraticCurveTo(40, 26, 38, 40); x.lineTo(10, 40); x.quadraticCurveTo(8, 26, 18, 8); x.closePath(); x.fill(); x.stroke();
        x.fillStyle = '#e8c35a'; x.beginPath(); x.arc(24, 12, 3, 0, TAU); x.fill();
        break;
      case 'eye':
        x.beginPath(); x.ellipse(24, 24, 15, 9, 0, 0, TAU); x.fillStyle = '#f2f0d8'; x.fill(); x.stroke();
        x.fillStyle = M; x.beginPath(); x.arc(24, 24, 6, 0, TAU); x.fill(); x.fillStyle = '#111'; x.beginPath(); x.arc(24, 24, 2.5, 0, TAU); x.fill();
        break;
      case 'pelt': case 'grain': case 'glowcap':
        x.beginPath(); x.ellipse(24, 26, 13, 11, 0, 0, TAU); x.fill(); x.stroke();
        break;
      /* abilities */
      case 'rush':
        x.beginPath(); x.moveTo(14, 12); x.lineTo(34, 12); x.lineTo(34, 26); x.quadraticCurveTo(24, 40, 14, 26); x.closePath(); x.fill(); x.stroke();
        x.strokeStyle = L; x.lineWidth = 2; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(4, 16 + i * 7); x.lineTo(11, 16 + i * 7); x.stroke(); }
        break;
      case 'roar':
        x.lineWidth = 2.5; for (let i = 0; i < 3; i++) { x.globalAlpha = 1 - i * 0.25; x.beginPath(); x.arc(16, 24, 8 + i * 8, -0.9, 0.9); x.stroke(); }
        x.globalAlpha = 1; x.fillStyle = W; x.beginPath(); x.arc(13, 24, 5, 0, TAU); x.fill();
        break;
      case 'hound':
        x.fillStyle = M; x.beginPath(); x.ellipse(22, 28, 12, 6, 0, 0, TAU); x.fill();
        x.beginPath(); x.moveTo(30, 22); x.lineTo(40, 26); x.lineTo(30, 30); x.fill();
        x.beginPath(); x.moveTo(31, 22); x.lineTo(33, 14); x.lineTo(35, 22); x.fill();
        x.fillStyle = '#ffd27a'; for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(12 + i * 4, 18 - (i % 2) * 3, 1.5, 0, TAU); x.fill(); }
        break;
      case 'quake':
        x.strokeStyle = L; x.lineWidth = 3; x.beginPath(); x.moveTo(24, 6); x.lineTo(20, 18); x.lineTo(28, 24); x.lineTo(22, 34); x.lineTo(26, 42); x.stroke();
        x.strokeStyle = W; x.lineWidth = 2; x.beginPath(); x.moveTo(8, 38); x.lineTo(16, 32); x.moveTo(40, 38); x.lineTo(32, 32); x.stroke();
        break;
      case 'heal':
        x.fillStyle = W; x.fillRect(20, 10, 8, 28); x.fillRect(10, 20, 28, 8);
        x.fillStyle = L; x.fillRect(22, 12, 4, 24); x.fillRect(12, 22, 24, 4);
        break;
      case 'spark':
        x.strokeStyle = W; x.lineWidth = 3; x.beginPath(); x.moveTo(30, 6); x.lineTo(18, 24); x.lineTo(28, 24); x.lineTo(16, 42); x.stroke();
        x.strokeStyle = L; x.lineWidth = 1.5; x.stroke();
        break;
      case 'ward':
        x.fillStyle = '#6b4a2a'; x.fillRect(21, 16, 6, 26);
        x.fillStyle = L; x.beginPath(); x.arc(24, 13, 7, 0, TAU); x.fill();
        x.strokeStyle = '#9ad26a'; x.lineWidth = 2; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(21, 22 + i * 6); x.lineTo(15, 18 + i * 6); x.moveTo(27, 22 + i * 6); x.lineTo(33, 18 + i * 6); x.stroke(); }
        break;
      case 'tide':
        x.strokeStyle = W; x.lineWidth = 3;
        for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(6, 18 + i * 9); x.quadraticCurveTo(15, 10 + i * 9, 24, 18 + i * 9); x.quadraticCurveTo(33, 26 + i * 9, 42, 18 + i * 9); x.stroke(); }
        break;
      case 'pierce':
        x.strokeStyle = W; x.lineWidth = 3; x.beginPath(); x.moveTo(6, 40); x.lineTo(40, 8); x.stroke();
        x.fillStyle = W; x.beginPath(); x.moveTo(42, 6); x.lineTo(32, 10); x.lineTo(38, 16); x.closePath(); x.fill();
        x.strokeStyle = L; x.lineWidth = 2; x.beginPath(); x.arc(24, 24, 6, 0, TAU); x.stroke();
        break;
      case 'smoke':
        x.fillStyle = 'rgba(240,235,255,0.7)'; [[16, 30, 9], [28, 26, 10], [22, 18, 8], [32, 36, 6]].forEach(([a, b, r]) => { x.beginPath(); x.arc(a, b, r, 0, TAU); x.fill(); });
        break;
      case 'volley':
        x.strokeStyle = W; x.lineWidth = 2;
        for (let i = 0; i < 5; i++) { const sx = 8 + i * 8; x.beginPath(); x.moveTo(sx, 6 + (i % 2) * 6); x.lineTo(sx + 3, 32 + (i % 2) * 6); x.stroke(); x.fillStyle = W; x.beginPath(); x.moveTo(sx + 3, 36 + (i % 2) * 6); x.lineTo(sx, 30 + (i % 2) * 6); x.lineTo(sx + 6, 31 + (i % 2) * 6); x.fill(); }
        break;
      case 'training': {
        // three rising chevrons in strength / agility / intelligence colors
        x.lineWidth = 4;
        [['#e0614a', 36], ['#6fd07a', 26], ['#6aa8ff', 16]].forEach(([c, y]) => {
          x.strokeStyle = c; x.beginPath(); x.moveTo(12, y + 6); x.lineTo(24, y - 4); x.lineTo(36, y + 6); x.stroke();
        });
        break;
      }
      case 'mark':
        x.strokeStyle = W; x.lineWidth = 2.5; x.beginPath(); x.arc(24, 24, 13, 0, TAU); x.stroke();
        x.beginPath(); x.moveTo(24, 5); x.lineTo(24, 16); x.moveTo(24, 32); x.lineTo(24, 43); x.moveTo(5, 24); x.lineTo(16, 24); x.moveTo(32, 24); x.lineTo(43, 24); x.stroke();
        x.fillStyle = L; x.beginPath(); x.arc(24, 24, 3, 0, TAU); x.fill();
        break;
      default:
        x.fillStyle = M; x.beginPath(); x.arc(24, 24, 12, 0, TAU); x.fill();
    }
    x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 2; x.strokeRect(1, 1, 46, 46);
    const url = c.toDataURL();
    iconCache[key] = url;
    return url;
  }

  // A small rendered portrait for a hero / NPC / unit.
  const portraitCache = {};
  // focus: sprite-space y (negative = up) that should sit at 42% of the frame
  // Portraits are drawn at 2-3x their logical size so they stay sharp when shown large.
  const HIRES = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
  function portrait(key, drawFn, size = 64, k = 2.6, focus = -24) {
    if (portraitCache[key]) return portraitCache[key];
    const c = document.createElement('canvas'); c.width = c.height = size * HIRES;
    const x = c.getContext('2d');
    x.scale(HIRES, HIRES);
    const g = x.createRadialGradient(size / 2, size * 0.4, 4, size / 2, size / 2, size * 0.7);
    g.addColorStop(0, '#4a3f33'); g.addColorStop(1, '#1b1612');
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    x.translate(size / 2 - 2, size * 0.42 - focus * k);
    drawFn(x, k);
    portraitCache[key] = c.toDataURL();
    return portraitCache[key];
  }
  function heroPortrait(id) {
    return portrait('hero-' + id, (x, k) => unit(x, k, { kind: 'hero', heroId: id }, { t: 0 }), 64, 2.7, -25);
  }
  function npcPortrait(id) {
    const n = G.NPCS[id];
    if (n.look.hero) return heroPortrait(n.look.hero);
    return portrait('npc-' + id, (x, k) => unit(x, k, { kind: 'npc', def: n }, { t: 0 }), 64, 2.7, -25);
  }
  function unitPortrait(defId) {
    const d = G.UNITS[defId];
    const f = { humanoid: [2.7, -25], golem: [1.9, -20], blob: [2.4, -10], wolf: [2.2, -10], boar: [2.2, -9], spider: [2.4, -8], wisp: [2.4, -16], imp: [3, -14], stalker: [2.2, -18], ward: [2.4, -14] }[d.shape] || [2.4, -12];
    return portrait('unit-' + defId, (x, k) => unit(x, k, { kind: 'enemy', def: d }, { t: 0 }), 64, f[0], f[1]);
  }

  return { shade, rgba, ellipse, rrect, unit, humanoid, treeSprite, boulderSprite, icon, heroPortrait, npcPortrait, unitPortrait };
})();
