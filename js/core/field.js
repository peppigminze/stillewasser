// The water field: ripples expand one ring per tick (BFS around rocks) and
// their amplitudes add up per cell. |A| >= threshold creates a surge.

import { buildGrid, bfs } from './hex.js';

const waterCache = new Map();
const WATER_CACHE_LIMIT = 48;

// Memoized per pond layout (radius + rocks). Distances/rings per origin are lazy.
export function waterFor(radius, rocks) {
  const key = radius + ':' + rocks.slice().sort((a, b) => a - b).join(',');
  let w = waterCache.get(key);
  if (w) return w;
  if (waterCache.size >= WATER_CACHE_LIMIT) waterCache.clear();
  const grid = buildGrid(radius);
  const blocked = new Uint8Array(grid.size);
  for (const r of rocks) blocked[r] = 1;
  const distCache = new Array(grid.size).fill(null);
  const ringCache = new Array(grid.size).fill(null);
  const distFrom = (origin) => {
    if (!distCache[origin]) distCache[origin] = bfs(grid, origin, blocked);
    return distCache[origin];
  };
  const ringsFrom = (origin) => {
    if (!ringCache[origin]) {
      const dist = distFrom(origin);
      const rings = [];
      for (let i = 0; i < grid.size; i++) {
        const d = dist[i];
        if (d < 0) continue;
        (rings[d] || (rings[d] = [])).push(i);
      }
      for (let k = 0; k < rings.length; k++) if (!rings[k]) rings[k] = [];
      ringCache[origin] = rings;
    }
    return ringCache[origin];
  };
  // Walking distance for creatures: they cannot enter rocks; the moon is the goal.
  const moonDist = bfs(grid, grid.center, blocked);
  w = { key, grid, blocked, distFrom, ringsFrom, moonDist };
  waterCache.set(key, w);
  return w;
}

export function ringAt(water, origin, r) {
  if (r < 0) return [];
  const rings = water.ringsFrom(origin);
  return rings[r] || [];
}

export function rippleRadius(ripple, tick) {
  return tick - ripple.born;
}

export function rippleAlive(ripple, tick) {
  return tick - ripple.born < ripple.profile.length;
}

// Amplitude field at a tick. Returns { amp: Int16Array, gen: Int8Array }.
// gen[c] = highest chain generation among ripples that add a nonzero amplitude at c.
export function fieldAt(water, ripples, tick) {
  const n = water.grid.size;
  const amp = new Int16Array(n);
  const gen = new Int8Array(n).fill(-1);
  for (const rp of ripples) {
    const r = tick - rp.born;
    if (r < 0 || r >= rp.profile.length) continue;
    const a = rp.profile[r];
    if (!a) continue;
    const ring = ringAt(water, rp.origin, r);
    for (const c of ring) {
      amp[c] += a;
      if (rp.gen > gen[c]) gen[c] = rp.gen;
    }
  }
  return { amp, gen };
}

export function surgesOf(field, threshold = 2) {
  const out = [];
  const { amp, gen } = field;
  for (let c = 0; c < amp.length; c++) {
    if (Math.abs(amp[c]) >= threshold) out.push({ cell: c, amp: amp[c], gen: Math.max(0, gen[c]) });
  }
  return out;
}

// Damage a surge of amplitude `a` deals to a creature with `armor`.
export function surgeDamage(a, armor, mods, threshold = 2) {
  const m = Math.abs(a);
  if (m < threshold) return 0;
  let dmg = m - 1;
  if (m >= 3 && mods.bigSurgeBonus) dmg += mods.bigSurgeBonus;
  if (a < 0 && mods.sogBonus) dmg += mods.sogBonus;
  return Math.max(0, dmg - (armor || 0));
}
