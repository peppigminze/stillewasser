// Particles, floating text, screen shake. Pixel-space, updated per frame.

const MAX_PARTICLES = 900;
export const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';

export function createFx() {
  const parts = [];
  const texts = [];
  const pillars = [];
  const rings = [];
  let shake = 0;
  let flash = null;
  let reduced = false;

  const add = (p) => {
    if (parts.length >= MAX_PARTICLES) parts.shift();
    parts.push(p);
  };

  function splash(x, y, s, strength = 1, color = '#f3ead2') {
    const n = Math.round((reduced ? 5 : 12) * strength);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const v = s * (2.5 + Math.random() * 3.5) * strength;
      add({ kind: 'drop', x, y, vx: Math.cos(a) * v * 0.6, vy: Math.sin(a) * v, g: s * 18, life: 0, max: 0.5 + Math.random() * 0.35, size: s * (0.05 + Math.random() * 0.06), color, floor: y + s * 0.15 });
    }
    rings.push({ x, y, r0: s * 0.15, r1: s * 0.9, life: 0, max: 0.45, color, w: 2 });
  }

  function surge(x, y, s, amp, gen = 0) {
    const neg = amp < 0;
    const color = neg ? '#b48cff' : '#ffd27a';
    pillars.push({ x, y, s, life: 0, max: 0.75, color, h: s * (2.2 + Math.min(3, Math.abs(amp)) * 0.7), neg });
    rings.push({ x, y, r0: s * 0.3, r1: s * (1.3 + Math.abs(amp) * 0.25), life: 0, max: 0.55, color, w: 3 });
    const n = reduced ? 4 : 10 + Math.abs(amp) * 4 + gen * 2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = s * (1.5 + Math.random() * 3);
      add({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - s * 2, g: s * 3, life: 0, max: 0.6 + Math.random() * 0.5, size: s * (0.04 + Math.random() * 0.05), color });
    }
  }

  function ink(x, y, s, rim = '#6f6bd8', big = false) {
    const n = reduced ? 6 : big ? 34 : 18;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = s * (1 + Math.random() * (big ? 5 : 3));
      add({ kind: 'ink', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0, drag: 3.2, life: 0, max: 0.7 + Math.random() * 0.6, size: s * (0.08 + Math.random() * (big ? 0.2 : 0.12)), color: Math.random() < 0.35 ? rim : '#03040a' });
    }
    rings.push({ x, y, r0: s * 0.2, r1: s * (big ? 2.4 : 1.2), life: 0, max: 0.6, color: rim, w: 2 });
  }

  function text(x, y, str, color = '#ffd27a', size = 18, dur = 1.0) {
    texts.push({ x, y, str, color, size, life: 0, max: dur });
  }

  function addShake(a) {
    if (!reduced) shake = Math.min(18, shake + a);
  }

  function addFlash(color, a = 0.35) {
    flash = { color, a, life: 0, max: 0.4 };
  }

  function update(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      if (p.drag) { p.vx *= Math.exp(-p.drag * dt); p.vy *= Math.exp(-p.drag * dt); }
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.floor !== undefined && p.y > p.floor && p.vy > 0) { p.life = p.max; }
    }
    for (const list of [texts, pillars, rings]) {
      for (let i = list.length - 1; i >= 0; i--) {
        list[i].life += dt;
        if (list[i].life >= list[i].max) list.splice(i, 1);
      }
    }
    shake *= Math.exp(-9 * dt);
    if (shake < 0.1) shake = 0;
    if (flash) { flash.life += dt; if (flash.life >= flash.max) flash = null; }
  }

  function draw(ctx, w, h) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of pillars) {
      const k = p.life / p.max;
      const a = (1 - k) * (p.neg ? 0.55 : 0.7);
      const width = p.s * (0.9 - k * 0.4);
      const g = ctx.createLinearGradient(p.x, p.y - p.h, p.x, p.y + p.s * 0.3);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.7, hexA(p.color, a * 0.6));
      g.addColorStop(1, hexA(p.color, a));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - p.h / 2, width / 2, p.h / 2 + p.s * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const r of rings) {
      const k = r.life / r.max;
      ctx.strokeStyle = hexA(r.color, (1 - k) * 0.8);
      ctx.lineWidth = r.w * (1 - k * 0.6);
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r0 + (r.r1 - r.r0) * easeOut(k), (r.r0 + (r.r1 - r.r0) * easeOut(k)) * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of parts) {
      if (p.kind === 'ink') continue;
      const k = p.life / p.max;
      ctx.fillStyle = hexA(p.color, 1 - k);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - k * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const p of parts) {
      if (p.kind !== 'ink') continue;
      const k = p.life / p.max;
      ctx.fillStyle = hexA(p.color, (1 - k) * 0.9);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + k * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
    for (const t of texts) {
      const k = t.life / t.max;
      const a = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4);
      const y = t.y - easeOut(k) * t.size * 1.6;
      const sc = k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : 1.1 - Math.min(0.1, k);
      ctx.font = `700 ${Math.round(t.size * sc)}px ${SERIF}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = `rgba(4,6,14,${a * 0.85})`;
      ctx.strokeText(t.str, t.x, y);
      ctx.fillStyle = hexA(t.color, a);
      ctx.fillText(t.str, t.x, y);
    }
    if (flash) {
      const k = flash.life / flash.max;
      ctx.fillStyle = hexA(flash.color, flash.a * (1 - k));
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  return {
    splash, surge, ink, text, addShake, addFlash, update, draw,
    get shake() { return shake; },
    set reduced(v) { reduced = v; },
    get busy() { return parts.length + texts.length + pillars.length + rings.length > 0; },
    clear() { parts.length = 0; texts.length = 0; pillars.length = 0; rings.length = 0; shake = 0; flash = null; },
  };
}

export function easeOut(k) {
  return 1 - (1 - k) * (1 - k);
}

const colorCache = new Map();
export function hexA(hex, a) {
  let rgb = colorCache.get(hex);
  if (!rgb) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    rgb = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
    colorCache.set(hex, rgb);
  }
  return `rgba(${rgb},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}
