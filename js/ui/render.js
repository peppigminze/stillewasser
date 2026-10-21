// Canvas renderer: ink-and-moonlight look. Reads a `scene` built by app.js.

import { buildGrid, cellToPixel, pixelToCell } from '../core/hex.js';
import { waterFor, ringAt } from '../core/field.js';
import { hexA, SERIF } from './fx.js';

export const PALETTES = {
  title: { top: '#05071a', bottom: '#0b1233', water: '#0a1130', deep: '#060a1f', shore: '#03040b', reed: '#121a33', particle: 'firefly', pcolor: '#cfe2ff', glow: '#9fb4ff' },
  spring: { top: '#061019', bottom: '#0d2030', water: '#0c1c2c', deep: '#07111c', shore: '#04070a', reed: '#13241f', particle: 'petal', pcolor: '#f6b5c9', glow: '#bfe3ff' },
  summer: { top: '#050616', bottom: '#0b1036', water: '#0b1234', deep: '#060920', shore: '#030409', reed: '#121a2c', particle: 'firefly', pcolor: '#dcff7a', glow: '#b9c4ff' },
  autumn: { top: '#0f0b0a', bottom: '#1e1714', water: '#17181c', deep: '#0c0c0f', shore: '#060404', reed: '#2a1d14', particle: 'leaf', pcolor: '#e58a3a', glow: '#ffd9b0' },
};

const TAU = Math.PI * 2;
const ROUND = 0.6; // 0 = exact hex ring, 1 = perfect circle
const COL = {
  wave: '#f3ead2', waveHi: '#fff7df', death: '#ffe2a6', dark: '#a77bff', darkHi: '#c9a6ff',
  gold: '#ffd27a', violet: '#b48cff', red: '#ff5b45', teal: '#7fe3d0',
};

// deterministic pseudo random from integer
const hash = (n) => {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};

export function createRenderer(canvas, content) {
  const ctx = canvas.getContext('2d');
  const grid = buildGrid(content.rules.pondRadius);
  const unit = grid.cells.map((_, i) => cellToPixel(grid, i, 1));
  let W = 0, H = 0, DPR = 1, S = 20, CX = 0, CY = 0;
  let centers = [];
  let bg = null;
  let bgKey = '';
  let ambient = [];
  let stars = [];
  const segCache = new WeakMap();

  function resize(w, h, dpr, insets) {
    W = w; H = h; DPR = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const R = grid.radius;
    const unitsW = 1.5 * 2 * R + 2 + 0.6;
    const unitsH = Math.sqrt(3) * (2 * R + 1) + 0.6;
    const availW = w - 12;
    const availH = Math.max(120, h - insets.top - insets.bottom);
    S = Math.max(8, Math.min(availW / unitsW, availH / unitsH));
    CX = w / 2;
    CY = insets.top + availH / 2;
    centers = unit.map((p) => ({ x: CX + p.x * S, y: CY + p.y * S }));
    bgKey = '';
    stars = Array.from({ length: 46 }, (_, i) => ({
      x: CX + (hash(i * 3 + 1) - 0.5) * S * 19, y: CY + (hash(i * 3 + 2) - 0.5) * S * 19,
      p: hash(i * 3 + 3) * TAU, r: 0.4 + hash(i * 7) * 1.1,
    }));
    ambient = [];
  }

  const cellAt = (x, y) => pixelToCell(grid, x - CX, y - CY, S);
  const pos = (i) => centers[i];

  // ------------------------------------------------------------ background
  function buildBackground(palette, rocks) {
    const key = `${W}x${H}:${S}:${palette}:${rocks.join(',')}`;
    if (key === bgKey && bg) return;
    bgKey = key;
    const pal = PALETTES[palette] || PALETTES.title;
    bg = bg || document.createElement('canvas');
    bg.width = Math.round(W * DPR);
    bg.height = Math.round(H * DPR);
    const b = bg.getContext('2d');
    b.setTransform(DPR, 0, 0, DPR, 0, 0);
    const g = b.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, pal.top);
    g.addColorStop(1, pal.bottom);
    b.fillStyle = g;
    b.fillRect(0, 0, W, H);

    // shore ring (dark earth) with an organic water edge
    const RW = S * (grid.radius * Math.sqrt(3) + 1.25);
    b.fillStyle = pal.shore;
    b.fillRect(0, 0, W, H);
    const sky = b.createRadialGradient(CX, CY - H * 0.1, RW * 0.4, CX, CY, Math.max(W, H));
    sky.addColorStop(0, 'rgba(0,0,0,0)');
    sky.addColorStop(1, hexA(pal.top, 0.6));
    b.fillStyle = sky;
    b.fillRect(0, 0, W, H);

    b.save();
    b.beginPath();
    const steps = 90;
    for (let k = 0; k <= steps; k++) {
      const a = (k / steps) * TAU;
      const wob = 1 + (hash(k % steps) - 0.5) * 0.035 + Math.sin(a * 5) * 0.012;
      const x = CX + Math.cos(a) * RW * wob;
      const y = CY + Math.sin(a) * RW * wob;
      if (k === 0) b.moveTo(x, y);
      else b.lineTo(x, y);
    }
    b.closePath();
    const wg = b.createRadialGradient(CX, CY, S, CX, CY, RW);
    wg.addColorStop(0, pal.water);
    wg.addColorStop(0.75, pal.water);
    wg.addColorStop(1, pal.deep);
    b.fillStyle = wg;
    b.shadowColor = hexA(pal.glow, 0.18);
    b.shadowBlur = S * 1.2;
    b.fill();
    b.restore();

    // reeds & pebbles around the shore
    for (let i = 0; i < 140; i++) {
      const a = hash(i * 11) * TAU;
      const d = RW * (1.02 + hash(i * 13) * 0.22);
      const x = CX + Math.cos(a) * d;
      const y = CY + Math.sin(a) * d;
      const h = S * (0.6 + hash(i * 17) * 1.6);
      b.strokeStyle = hexA(pal.reed, 0.9);
      b.lineWidth = Math.max(1, S * 0.06);
      b.beginPath();
      b.moveTo(x, y);
      b.quadraticCurveTo(x + (hash(i) - 0.5) * S * 0.6, y - h * 0.6, x + (hash(i * 5) - 0.5) * S, y - h);
      b.stroke();
    }

    // playable cells: faint hex tiles + center dots
    for (let i = 0; i < grid.size; i++) {
      const p = centers[i];
      hexPath(b, p.x, p.y, S * 0.97);
      b.strokeStyle = 'rgba(255,255,255,0.035)';
      b.lineWidth = 1;
      b.stroke();
      b.fillStyle = 'rgba(255,255,255,0.10)';
      b.beginPath();
      b.arc(p.x, p.y, Math.max(0.8, S * 0.035), 0, TAU);
      b.fill();
    }

    // rocks
    for (const r of rocks) drawRock(b, centers[r].x, centers[r].y, r);
  }

  function drawRock(b, x, y, seed) {
    const n = 8;
    const pts = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + hash(seed * 31 + k) * 0.4;
      const rr = S * (0.58 + hash(seed * 17 + k) * 0.22);
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.86]);
    }
    b.save();
    b.fillStyle = 'rgba(0,0,0,0.45)';
    b.beginPath();
    b.ellipse(x, y + S * 0.28, S * 0.78, S * 0.32, 0, 0, TAU);
    b.fill();
    const g = b.createLinearGradient(x, y - S * 0.7, x, y + S * 0.6);
    g.addColorStop(0, '#3a3e4c');
    g.addColorStop(1, '#14161e');
    b.fillStyle = g;
    b.beginPath();
    pts.forEach(([px, py], k) => (k ? b.lineTo(px, py) : b.moveTo(px, py)));
    b.closePath();
    b.fill();
    b.strokeStyle = 'rgba(255,255,255,0.12)';
    b.lineWidth = 1.2;
    b.beginPath();
    b.arc(x - S * 0.1, y - S * 0.05, S * 0.45, Math.PI * 1.1, Math.PI * 1.6);
    b.stroke();
    b.fillStyle = 'rgba(110,150,90,0.35)';
    b.beginPath();
    b.ellipse(x + S * 0.18, y - S * 0.3, S * 0.16, S * 0.08, -0.4, 0, TAU);
    b.fill();
    b.restore();
  }

  // ------------------------------------------------------------ ambient
  function updateAmbient(pal, dt, t) {
    const want = pal.particle === 'firefly' ? 16 : 14;
    while (ambient.length < want) {
      ambient.push({
        x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.3) * S * 0.6, vy: (Math.random() - 0.2) * S * 0.4,
        r: S * (0.06 + Math.random() * 0.08), rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 1.5, p: Math.random() * TAU,
      });
    }
    for (const a of ambient) {
      if (pal.particle === 'firefly') {
        a.x += (a.vx * 0.4 + Math.sin(t * 0.7 + a.p) * S * 0.2) * dt;
        a.y += (a.vy * 0.4 + Math.cos(t * 0.5 + a.p) * S * 0.2) * dt;
      } else {
        a.x += a.vx * dt;
        a.y += (a.vy + S * 0.25) * dt;
        a.rot += a.vr * dt;
      }
      if (a.x < -20) a.x = W + 20;
      if (a.x > W + 20) a.x = -20;
      if (a.y > H + 20) a.y = -20;
      if (a.y < -20) a.y = H + 20;
    }
  }

  function drawAmbient(pal, t) {
    ctx.save();
    for (const a of ambient) {
      if (pal.particle === 'firefly') {
        const k = 0.5 + 0.5 * Math.sin(t * 2.2 + a.p * 3);
        ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, a.r * 6);
        gr.addColorStop(0, hexA(pal.pcolor, 0.55 * k));
        gr.addColorStop(1, hexA(pal.pcolor, 0));
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r * 6, 0, TAU);
        ctx.fill();
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.translate(a.x, a.y);
        ctx.rotate(a.rot);
        ctx.fillStyle = hexA(pal.pcolor, 0.55);
        ctx.beginPath();
        if (pal.particle === 'leaf') {
          ctx.moveTo(0, -a.r * 1.6);
          ctx.quadraticCurveTo(a.r * 1.3, 0, 0, a.r * 1.6);
          ctx.quadraticCurveTo(-a.r * 1.3, 0, 0, -a.r * 1.6);
        } else {
          ctx.ellipse(0, 0, a.r * 1.2, a.r * 0.7, 0, 0, TAU);
        }
        ctx.fill();
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------- moon
  function drawMoon(scene, t) {
    const p = centers[grid.center];
    const light = scene.moonLight ?? 1;
    const hurt = scene.moonHurt || 0;
    const r = S * (0.78 + 0.12 * light);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(p.x, p.y, r * 0.3, p.x, p.y, S * (2.6 + light * 1.4));
    halo.addColorStop(0, `rgba(255,244,214,${0.22 + 0.2 * light})`);
    halo.addColorStop(1, 'rgba(255,244,214,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(p.x, p.y, S * 4.2, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.save();
    const disc = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
    const dim = 0.35 + 0.65 * light;
    disc.addColorStop(0, `rgba(255,252,238,${dim})`);
    disc.addColorStop(0.7, `rgba(244,233,200,${dim * 0.92})`);
    disc.addColorStop(1, `rgba(210,195,150,${dim * 0.8})`);
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.fill();
    // craters
    ctx.fillStyle = `rgba(180,165,120,${0.18 * dim})`;
    [[-0.3, 0.1, 0.18], [0.25, -0.25, 0.12], [0.18, 0.32, 0.1]].forEach(([dx, dy, rr]) => {
      ctx.beginPath();
      ctx.arc(p.x + dx * r, p.y + dy * r, rr * r, 0, TAU);
      ctx.fill();
    });
    // water shimmer over the reflection
    ctx.globalCompositeOperation = 'source-atop';
    ctx.strokeStyle = 'rgba(10,18,40,0.28)';
    ctx.lineWidth = Math.max(1, S * 0.05);
    for (let k = -3; k <= 3; k++) {
      const yy = p.y + k * r * 0.26;
      const off = Math.sin(t * 1.6 + k * 1.3) * r * 0.15;
      ctx.beginPath();
      ctx.moveTo(p.x - r + off, yy);
      ctx.lineTo(p.x + r + off, yy + Math.sin(t + k) * 1.5);
      ctx.stroke();
    }
    if (hurt > 0) {
      ctx.fillStyle = `rgba(255,70,50,${hurt * 0.6})`;
      ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    }
    ctx.restore();
    // broken reflection streaks below
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 1; k <= 4; k++) {
      const yy = p.y + r + k * S * 0.22;
      const wd = r * (0.9 - k * 0.15) * (0.8 + 0.2 * Math.sin(t * 2 + k));
      ctx.strokeStyle = `rgba(255,244,214,${(0.16 - k * 0.03) * light})`;
      ctx.lineWidth = Math.max(1, S * 0.08);
      ctx.beginPath();
      ctx.moveTo(p.x - wd + Math.sin(t * 1.3 + k) * S * 0.2, yy);
      ctx.lineTo(p.x + wd + Math.sin(t * 1.3 + k) * S * 0.2, yy);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ----------------------------------------------------------- ripples
  function segmentsFor(water, origin, k) {
    let m = segCache.get(water);
    if (!m) { m = new Map(); segCache.set(water, m); }
    const key = origin * 64 + k;
    let segs = m.get(key);
    if (segs) return segs;
    const ring = ringAt(water, origin, k).slice();
    const o = unit[origin];
    ring.sort((a, b) => Math.atan2(unit[a].y - o.y, unit[a].x - o.x) - Math.atan2(unit[b].y - o.y, unit[b].x - o.x));
    segs = [];
    let cur = [];
    const adj = (a, b) => grid.neighbors[a].includes(b);
    for (let i = 0; i < ring.length; i++) {
      if (cur.length && !adj(cur[cur.length - 1], ring[i])) { segs.push({ cells: cur, closed: false }); cur = []; }
      cur.push(ring[i]);
    }
    if (cur.length) segs.push({ cells: cur, closed: false });
    if (segs.length > 1) {
      const first = segs[0];
      const last = segs[segs.length - 1];
      if (adj(last.cells[last.cells.length - 1], first.cells[0])) {
        segs[0] = { cells: last.cells.concat(first.cells), closed: false };
        segs.pop();
      }
    } else if (segs.length === 1 && ring.length > 2 && adj(ring[ring.length - 1], ring[0])) {
      segs[0].closed = true;
    }
    m.set(key, segs);
    return segs;
  }

  function tracePath(pts, closed) {
    if (pts.length === 1) {
      const [x, y] = pts[0];
      ctx.moveTo(x - S * 0.25, y);
      ctx.lineTo(x + S * 0.25, y);
      return;
    }
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (closed) {
      const n = pts.length;
      let m = mid(pts[n - 1], pts[0]);
      ctx.moveTo(m[0], m[1]);
      for (let i = 0; i < n; i++) {
        const nx = pts[(i + 1) % n];
        m = mid(pts[i], nx);
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
      }
      ctx.closePath();
      return;
    }
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const m = mid(pts[i], pts[i + 1]);
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
    }
    const l = pts[pts.length - 1];
    ctx.lineTo(l[0], l[1]);
  }

  function rippleColor(rp, amp) {
    if (amp < 0) return Math.abs(amp) >= 2 ? COL.darkHi : COL.dark;
    if (rp.owner === 'death') return COL.death;
    return amp >= 2 ? COL.waveHi : COL.wave;
  }

  function drawRipple(water, rp, rho, alphaMul, t) {
    if (rho < -0.001) return;
    const k = Math.max(0, Math.ceil(rho - 1e-4));
    if (k >= rp.profile.length) return;
    const amp = rp.profile[k];
    const O = centers[rp.origin];
    if (!amp) return;
    const color = rippleColor(rp, amp);
    if (k === 0) {
      // splash at the origin: pulsing stone-in-water
      const pulse = 0.5 + 0.5 * Math.sin(t * 5 + rp.id);
      ctx.strokeStyle = hexA(color, 0.55 + 0.35 * pulse);
      ctx.lineWidth = S * 0.08 * Math.abs(amp);
      ctx.beginPath();
      ctx.ellipse(O.x, O.y, S * (0.42 + pulse * 0.08), S * (0.3 + pulse * 0.05), 0, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = hexA(amp < 0 ? '#2a1846' : '#1b2238', 0.9);
      ctx.beginPath();
      ctx.arc(O.x, O.y, S * 0.14, 0, TAU);
      ctx.fill();
      return;
    }
    const f = rho / k;
    const life = 1 - (rho - 1) / Math.max(1, rp.profile.length);
    const strong = Math.abs(amp) >= 2;
    const a = alphaMul * (0.4 + 0.6 * life) * Math.min(1, f * 1.6);
    const segs = segmentsFor(water, rp.origin, k);
    // pull points toward a circle so rings read as water, not hexagons
    const ideal = k * S * 1.62;
    ctx.beginPath();
    for (const seg of segs) {
      const pts = seg.cells.map((c) => {
        const vx = centers[c].x - O.x;
        const vy = centers[c].y - O.y;
        const d = Math.hypot(vx, vy) || 1;
        const r = (d + (ideal - d) * ROUND) * f;
        return [O.x + (vx / d) * r, O.y + (vy / d) * r];
      });
      tracePath(pts, seg.closed);
    }
    ctx.strokeStyle = hexA(color, a * 0.22);
    ctx.lineWidth = S * (strong ? 0.5 : 0.34);
    ctx.stroke();
    ctx.strokeStyle = hexA(color, a);
    ctx.lineWidth = Math.max(1.2, S * (strong ? 0.11 : 0.065));
    ctx.stroke();
  }

  function drawRipples(scene, t) {
    const pond = scene.pond;
    const water = waterFor(pond.radius, pond.rocks);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'lighter';
    for (const rp of pond.ripples) drawRipple(water, rp, scene.visTick - rp.born, 1, t);
    for (const rp of scene.expiring || []) {
      const rho = scene.visTick - rp.born;
      const fade = 1 - Math.max(0, Math.min(1, rho - (rp.profile.length - 1)));
      drawRipple(water, { ...rp, profile: rp.profile.concat([rp.profile[rp.profile.length - 1]]) }, rho, fade * 0.6, t);
    }
    ctx.restore();
  }

  // ----------------------------------------------------------- markers
  function hexPath(c, x, y, r) {
    c.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (k === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
  }

  function drawSurgeMarkers(scene, t) {
    const fc = scene.forecast;
    if (!fc) return;
    ctx.save();
    if (fc.next && scene.showNext) {
      ctx.setLineDash([S * 0.12, S * 0.12]);
      for (const s of fc.next.surges) {
        const p = centers[s.cell];
        hexPath(ctx, p.x, p.y, S * 0.62);
        ctx.strokeStyle = hexA(s.amp < 0 ? COL.violet : COL.gold, 0.38);
        ctx.lineWidth = Math.max(1, S * 0.05);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    const pulse = 0.5 + 0.5 * Math.sin(t * 4.2);
    ctx.globalCompositeOperation = 'lighter';
    for (const s of fc.now.surges) {
      const p = centers[s.cell];
      const col = s.amp < 0 ? COL.violet : COL.gold;
      hexPath(ctx, p.x, p.y, S * 0.9);
      ctx.fillStyle = hexA(col, 0.1 + 0.08 * pulse + 0.05 * Math.min(3, Math.abs(s.amp)));
      ctx.fill();
      ctx.strokeStyle = hexA(col, 0.55 + 0.3 * pulse);
      ctx.lineWidth = Math.max(1.5, S * 0.07);
      ctx.stroke();
      if (Math.abs(s.amp) >= 3) {
        hexPath(ctx, p.x, p.y, S * 0.7);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawTelegraphs(scene, t) {
    const pond = scene.pond;
    ctx.save();
    for (const tg of pond.telegraphs) {
      const p = centers[tg.cell];
      const def = content.enemies[tg.type];
      const col = def.hostile === false ? COL.teal : '#9aa0ff';
      for (let k = 0; k < 3; k++) {
        const ph = (t * 0.9 + k / 3) % 1;
        ctx.strokeStyle = hexA(col, (1 - ph) * 0.6);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x + Math.sin(k * 2.1) * S * 0.18, p.y - ph * S * 0.5, S * (0.08 + ph * 0.16), 0, TAU);
        ctx.stroke();
      }
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = hexA(col, 0.4);
      ctx.beginPath();
      ctx.arc(p.x, p.y, S * 0.55, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawFocus(scene, t) {
    const drawHex = (cell, col, a, r = 0.95, w = 2) => {
      if (cell === undefined || cell < 0) return;
      const p = centers[cell];
      hexPath(ctx, p.x, p.y, S * r);
      ctx.strokeStyle = hexA(col, a);
      ctx.lineWidth = w;
      ctx.stroke();
    };
    ctx.save();
    if (scene.tip >= 0) drawHex(scene.tip, COL.teal, 0.5 + 0.4 * Math.sin(t * 6), 0.8, 3);
    if (scene.cursor >= 0 && scene.cursor !== scene.focus) drawHex(scene.cursor, '#ffffff', 0.35, 0.95, 1.5);
    if (scene.focus >= 0) {
      const ok = !scene.preview || !scene.preview.error;
      const p = centers[scene.focus];
      hexPath(ctx, p.x, p.y, S * 0.95);
      ctx.fillStyle = ok ? 'rgba(255,255,255,0.07)' : 'rgba(255,80,60,0.08)';
      ctx.fill();
      drawHex(scene.focus, ok ? '#ffffff' : COL.red, 0.75, 0.95, 2);
      if (ok && scene.ghost) {
        // future rings of the previewed stone
        const water = waterFor(scene.pond.radius, scene.pond.rocks);
        for (let r = 1; r <= 2; r++) {
          const amp = scene.ghost.profile[r];
          if (!amp) continue;
          ctx.fillStyle = hexA(amp < 0 ? COL.dark : '#ffffff', r === 1 ? 0.5 : 0.22);
          for (const c of ringAt(water, scene.ghost.origin, r)) {
            const q = centers[c];
            ctx.beginPath();
            ctx.arc(q.x, q.y, S * 0.07, 0, TAU);
            ctx.fill();
          }
        }
      }
    }
    ctx.restore();
  }

  // ----------------------------------------------------------- actors
  function actorXY(a) {
    if (!a.path || a.u >= 1) return centers[a.cell];
    const pts = [a.from, ...a.path];
    const f = a.u * (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(f));
    const k = f - i;
    const A = centers[pts[i]];
    const B = centers[pts[i + 1]];
    const hop = Math.sin(k * Math.PI) * S * 0.25;
    return { x: A.x + (B.x - A.x) * k, y: A.y + (B.y - A.y) * k - hop };
  }

  function drawIntents(scene, t) {
    const fc = scene.forecast;
    if (!fc || !scene.showIntents) return;
    ctx.save();
    ctx.lineCap = 'round';
    for (const a of scene.actors.values()) {
      if (a.dying) continue;
      const it = fc.intents[a.id];
      if (!it) continue;
      const P = centers[a.cell];
      const def = content.enemies[a.type];
      const col = def.hostile === false ? COL.teal : '#ffb35c';
      if (it.path && it.path.length) {
        const pts = [P, ...it.path.map((c) => centers[c])];
        ctx.strokeStyle = hexA(col, 0.6);
        ctx.lineWidth = Math.max(1.5, S * 0.07);
        ctx.setLineDash([S * 0.14, S * 0.12]);
        ctx.lineDashOffset = -t * S * 0.6;
        ctx.beginPath();
        ctx.moveTo(P.x, P.y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        ctx.setLineDash([]);
        const E = pts[pts.length - 1];
        const B = pts[pts.length - 2];
        const ang = Math.atan2(E.y - B.y, E.x - B.x);
        ctx.fillStyle = hexA(col, 0.85);
        ctx.beginPath();
        ctx.moveTo(E.x + Math.cos(ang) * S * 0.2, E.y + Math.sin(ang) * S * 0.2);
        ctx.lineTo(E.x + Math.cos(ang + 2.5) * S * 0.2, E.y + Math.sin(ang + 2.5) * S * 0.2);
        ctx.lineTo(E.x + Math.cos(ang - 2.5) * S * 0.2, E.y + Math.sin(ang - 2.5) * S * 0.2);
        ctx.closePath();
        ctx.fill();
      } else if (it.kind === 'bite') {
        const M = centers[grid.center];
        const mx = P.x + (M.x - P.x) * 0.5;
        const my = P.y + (M.y - P.y) * 0.5;
        const ang = Math.atan2(M.y - P.y, M.x - P.x);
        ctx.fillStyle = hexA(it.blocked ? COL.teal : COL.red, 0.75 + 0.25 * Math.sin(t * 8));
        for (const side of [-1, 1]) {
          const ox = Math.cos(ang + Math.PI / 2) * side * S * 0.12;
          const oy = Math.sin(ang + Math.PI / 2) * side * S * 0.12;
          ctx.beginPath();
          ctx.moveTo(mx + ox - Math.cos(ang) * S * 0.14, my + oy - Math.sin(ang) * S * 0.14);
          ctx.lineTo(mx + ox + Math.cos(ang) * S * 0.2, my + oy + Math.sin(ang) * S * 0.2);
          ctx.lineTo(mx + ox * 2.2 - Math.cos(ang) * S * 0.06, my + oy * 2.2 - Math.sin(ang) * S * 0.06);
          ctx.closePath();
          ctx.fill();
        }
      } else if (it.kind === 'emit') {
        ctx.strokeStyle = hexA(COL.dark, 0.55 + 0.3 * Math.sin(t * 5));
        ctx.setLineDash([S * 0.1, S * 0.1]);
        ctx.lineWidth = Math.max(1.5, S * 0.06);
        ctx.beginPath();
        ctx.arc(P.x, P.y, S * (0.7 + 0.06 * Math.sin(t * 5)), 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (it.kind === 'hatch') {
        const Q = centers[it.cell];
        ctx.strokeStyle = hexA('#7bd88f', 0.7);
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(Q.x, Q.y, S * 0.3, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = hexA('#7bd88f', 0.8);
        ctx.font = `700 ${Math.round(S * 0.42)}px ${SERIF}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', Q.x, Q.y);
      }
    }
    ctx.restore();
  }

  function drawActors(scene, t) {
    const list = [...scene.actors.values()].sort((a, b) => actorXY(a).y - actorXY(b).y);
    for (const a of list) {
      const def = content.enemies[a.type];
      const p = actorXY(a);
      drawCreature(ctx, def, p.x, p.y + Math.sin(t * 2 + a.id) * S * 0.03, S, t, a);
    }
  }

  function drawLabels(scene, t) {
    const fc = scene.forecast;
    if (!fc) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const h of fc.now.hits) {
      const a = scene.actors.get(h.id);
      if (!a || a.dying) continue;
      const p = centers[a.cell];
      const y = p.y - S * 0.95;
      if (h.dmg <= 0) {
        ctx.font = `600 ${Math.round(S * 0.42)}px ${SERIF}`;
        ctx.fillStyle = 'rgba(200,210,230,0.9)';
        ctx.fillText('Panzer', p.x, y);
        continue;
      }
      ctx.font = `700 ${Math.round(S * 0.6)}px ${SERIF}`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(4,6,14,0.85)';
      const txt = h.lethal ? '✕' : `−${h.dmg}`;
      ctx.strokeText(txt, p.x, y + Math.sin(t * 5) * 2);
      ctx.fillStyle = h.lethal ? COL.red : h.amp < 0 ? COL.violet : COL.gold;
      ctx.fillText(txt, p.x, y + Math.sin(t * 5) * 2);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------- draw
  function draw(scene, t, dt, fx) {
    const pal = PALETTES[scene.palette] || PALETTES.title;
    const rocks = scene.pond ? scene.pond.rocks : [];
    buildBackground(scene.palette, rocks);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const sh = fx ? fx.shake : 0;
    const ox = sh ? (Math.random() - 0.5) * sh : 0;
    const oy = sh ? (Math.random() - 0.5) * sh : 0;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(bg, ox, oy, W, H);
    ctx.save();
    ctx.translate(ox, oy);
    // star reflections
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of stars) {
      const k = 0.5 + 0.5 * Math.sin(t * 1.3 + s.p);
      ctx.fillStyle = `rgba(220,230,255,${0.08 + 0.18 * k})`;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.restore();
    drawMoon(scene, t);
    if (scene.pond) {
      drawTelegraphs(scene, t);
      drawSurgeMarkers(scene, t);
      drawRipples(scene, t);
      drawFocus(scene, t);
      drawIntents(scene, t);
      drawActors(scene, t);
      drawLabels(scene, t);
    } else if (scene.titleRipples) {
      const water = waterFor(grid.radius, []);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'lighter';
      for (const rp of scene.titleRipples) drawRipple(water, rp, scene.visTick - rp.born, 0.8, t);
      ctx.restore();
    }
    if (fx) fx.draw(ctx, W, H);
    ctx.restore();
    updateAmbient(pal, dt, t);
    drawAmbient(pal, t);
  }

  return {
    resize, draw, cellAt, pos, grid,
    get size() { return S; },
    get center() { return { x: CX, y: CY }; },
  };
}

// ------------------------------------------------------------ creatures
export function drawCreature(ctx, def, x, y, S, t, a = {}) {
  const look = def.look;
  const size = S * look.size * (a.scale ?? 1);
  if (size <= 0.5) return;
  const id = a.id || 1;
  ctx.save();
  ctx.globalAlpha = a.alpha ?? 1;
  // shadow on water
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.55, size * 1.05, size * 0.35, 0, 0, TAU);
  ctx.fill();

  const body = '#05060c';
  const rim = look.rim;
  const wob = (k, n) => 1 + Math.sin(t * 3 + k * 2.3 + id) * 0.06 + Math.sin(k * 5.1 + id) * 0.05 * n;

  const blob = (rx, ry, n = 10) => {
    ctx.beginPath();
    for (let k = 0; k <= n; k++) {
      const ang = (k / n) * TAU;
      const r = wob(k, 1);
      const px = x + Math.cos(ang) * rx * r;
      const py = y + Math.sin(ang) * ry * r;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };

  ctx.lineWidth = Math.max(1.2, S * 0.06);
  switch (look.shape) {
    case 'strider': {
      ctx.strokeStyle = hexA(rim, 0.85);
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * TAU + 0.5 + Math.sin(t * 6 + k) * 0.08;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + Math.cos(ang) * size * 1.2, y + Math.sin(ang) * size * 0.6 - size * 0.6, x + Math.cos(ang) * size * 2.1, y + Math.sin(ang) * size * 1.2);
        ctx.stroke();
      }
      blob(size * 0.6, size * 0.45, 8);
      break;
    }
    case 'toad':
      blob(size * 1.15, size * 0.85, 12);
      break;
    case 'snail':
      blob(size * 1.0, size * 0.7, 10);
      break;
    case 'spawn': {
      ctx.fillStyle = body;
      ctx.strokeStyle = hexA(rim, 0.75);
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * TAU + id;
        const px = x + Math.cos(ang) * size * 0.55;
        const py = y + Math.sin(ang) * size * 0.4;
        ctx.beginPath();
        ctx.arc(px, py, size * 0.38, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = hexA(look.eye, 0.5 + 0.4 * Math.sin(t * 3 + k));
        ctx.beginPath();
        ctx.arc(px, py, size * 0.1, 0, TAU);
        ctx.fill();
        ctx.fillStyle = body;
      }
      blob(size * 0.45, size * 0.35, 8);
      break;
    }
    case 'pike': {
      const ang = a.heading >= 0 ? headingAngle(a.heading) : 0;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 1.45, size * 0.55, 0, 0, TAU);
      ctx.moveTo(-size * 1.3, 0);
      ctx.lineTo(-size * 2.1, -size * 0.55 + Math.sin(t * 8) * size * 0.1);
      ctx.lineTo(-size * 2.1, size * 0.55 + Math.sin(t * 8) * size * 0.1);
      ctx.closePath();
      ctx.fillStyle = body;
      ctx.fill();
      ctx.strokeStyle = hexA(rim, 0.8);
      ctx.stroke();
      ctx.fillStyle = hexA(look.eye, 0.95);
      ctx.beginPath();
      ctx.arc(size * 0.85, -size * 0.18, size * 0.13, 0, TAU);
      ctx.fill();
      if (look.crown) crownSpikes(ctx, 0, -size * 0.5, size, rim);
      ctx.restore();
      hpPips(ctx, def, a, x, y + size * 0.95, S);
      flashOverlay(ctx, a, x, y, size * 1.4);
      ctx.restore();
      return;
    }
    case 'wisp': {
      ctx.globalCompositeOperation = 'lighter';
      const fl = 0.75 + 0.25 * Math.sin(t * 9 + id) * Math.sin(t * 3.3);
      const g = ctx.createRadialGradient(x, y, 0, x, y, size * 2.4);
      g.addColorStop(0, hexA('#ffffff', 0.9 * fl));
      g.addColorStop(0.25, hexA(rim, 0.7 * fl));
      g.addColorStop(1, hexA(rim, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y - size * 0.3, size * 2.4, 0, TAU);
      ctx.fill();
      ctx.restore();
      return;
    }
    case 'namazu': {
      blob(size * 1.25, size * 0.8, 14);
      ctx.fillStyle = body;
      ctx.fill();
      ctx.strokeStyle = hexA(rim, 0.85);
      ctx.stroke();
      ctx.strokeStyle = hexA(rim, 0.9);
      ctx.lineWidth = Math.max(1.5, S * 0.05);
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x + side * size * 0.5, y + size * 0.1);
        ctx.bezierCurveTo(x + side * size * 1.5, y + size * 0.3, x + side * size * 1.4, y - size * 0.9 + Math.sin(t * 2 + side) * size * 0.3, x + side * size * 2.2, y - size * 0.5 + Math.sin(t * 2.4 + side) * size * 0.4);
        ctx.stroke();
      }
      eyes(ctx, x, y - size * 0.15, size, look.eye, t, id, 0.42);
      crownSpikes(ctx, x, y - size * 0.75, size, rim);
      hpPips(ctx, def, a, x, y + size * 1.05, S);
      flashOverlay(ctx, a, x, y, size * 1.3);
      ctx.restore();
      return;
    }
    default:
      blob(size, size * 0.9, 10);
  }
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = hexA(rim, 0.85);
  ctx.stroke();

  if (look.shape === 'toad') {
    ctx.fillStyle = hexA(rim, 0.55);
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(x + (k - 1) * size * 0.45, y + size * 0.35, size * 0.12, 0, TAU);
      ctx.fill();
    }
  }
  if (look.shape === 'snail') {
    ctx.strokeStyle = hexA(rim, 0.9);
    ctx.lineWidth = Math.max(1.5, S * 0.07);
    ctx.beginPath();
    for (let k = 0; k < 40; k++) {
      const ang = k * 0.32;
      const r = size * 0.08 + k * size * 0.015;
      const px = x + size * 0.15 + Math.cos(ang) * r;
      const py = y - size * 0.1 + Math.sin(ang) * r;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  if (look.shape !== 'spawn') eyes(ctx, x - (look.shape === 'snail' ? size * 0.55 : 0), y - size * 0.2, size, look.eye, t, id, look.shape === 'toad' ? 0.48 : 0.36);
  if (look.crown) crownSpikes(ctx, x, y - size * 0.85, size, rim);
  hpPips(ctx, def, a, x, y + size * 1.0, S);
  flashOverlay(ctx, a, x, y, size * 1.2);
  ctx.restore();
}

function headingAngle(dir) {
  // axial direction -> screen angle (flat-top)
  const v = [[1.5, 0.866], [1.5, -0.866], [0, -1.732], [-1.5, -0.866], [-1.5, 0.866], [0, 1.732]][dir];
  return Math.atan2(v[1], v[0]);
}

function eyes(ctx, x, y, size, color, t, id, spread) {
  const blink = Math.sin(t * 0.9 + id * 1.7) > 0.985 ? 0.15 : 1;
  for (const side of [-1, 1]) {
    const ex = x + side * size * spread;
    ctx.fillStyle = hexA(color, 0.95);
    ctx.beginPath();
    ctx.ellipse(ex, y, size * 0.17, size * 0.2 * blink, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#05060c';
    ctx.beginPath();
    ctx.ellipse(ex + size * 0.03, y + size * 0.02, size * 0.07, size * 0.1 * blink, 0, 0, TAU);
    ctx.fill();
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = hexA(color, 0.12);
  ctx.beginPath();
  ctx.arc(x, y, size * 0.9, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function crownSpikes(ctx, x, y, size, rim) {
  ctx.fillStyle = hexA(rim, 0.95);
  for (let k = -2; k <= 2; k++) {
    ctx.beginPath();
    ctx.moveTo(x + k * size * 0.28 - size * 0.1, y + size * 0.1);
    ctx.lineTo(x + k * size * 0.28, y - size * (0.32 - Math.abs(k) * 0.06));
    ctx.lineTo(x + k * size * 0.28 + size * 0.1, y + size * 0.1);
    ctx.closePath();
    ctx.fill();
  }
}

function hpPips(ctx, def, a, x, y, S) {
  if (a.hp === undefined || def.hostile === false) return;
  const max = a.maxHp || def.hp;
  if (max > 6) {
    const w = S * 1.4;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, S * 0.14 + 2);
    ctx.fillStyle = '#ff6a4a';
    ctx.fillRect(x - w / 2, y, (w * Math.max(0, a.hp)) / max, S * 0.14);
    return;
  }
  const r = Math.max(1.6, S * 0.07);
  const gap = r * 2.8;
  for (let k = 0; k < max; k++) {
    ctx.fillStyle = k < a.hp ? '#ff8a5c' : 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(x + (k - (max - 1) / 2) * gap, y, r, 0, TAU);
    ctx.fill();
  }
  if (def.armor) {
    ctx.strokeStyle = 'rgba(220,225,240,0.8)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.2 + (max - 1) * gap * 0.5, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
}

function flashOverlay(ctx, a, x, y, r) {
  if (!a.flash) return;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = `rgba(255,255,255,${a.flash * 0.7})`;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}
