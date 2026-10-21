// Creature behaviour. Every creature cycles through `pattern`; the action of
// the current turn is pattern[age % length]. All decisions are deterministic
// given the state (random choices are pre-rolled and stored, e.g. wanderTo).

import { waterFor } from './field.js';
import { randInt } from './rng.js';

export function currentAction(def, e) {
  return def.pattern[e.age % def.pattern.length];
}

export function isHostile(def) {
  return def.hostile !== false;
}

export function occupiedCells(pond) {
  const s = new Set();
  for (const e of pond.enemies) s.add(e.cell);
  return s;
}

function dirTurn(a, b) {
  if (a < 0 || b < 0) return 0;
  const d = Math.abs(a - b) % 6;
  return Math.min(d, 6 - d);
}

function walkable(w, n, occ) {
  return n >= 0 && !w.blocked[n] && n !== w.grid.center && !occ.has(n);
}

// One step downhill on the moon-distance map; keeps heading when possible.
export function stepToward(w, cur, heading, occ) {
  const here = w.moonDist[cur];
  let best = null;
  let bestScore = Infinity;
  w.grid.neighbors[cur].forEach((n, dir) => {
    if (!walkable(w, n, occ)) return;
    const md = w.moonDist[n];
    if (md < 0 || md >= here) return;
    const score = dirTurn(heading, dir) * 10 + dir;
    if (score < bestScore) {
      bestScore = score;
      best = { cell: n, dir };
    }
  });
  return best;
}

function dashDirection(w, e) {
  let bestDir = -1;
  let bestScore = Infinity;
  w.grid.neighbors[e.cell].forEach((n, dir) => {
    if (n < 0 || w.blocked[n]) return;
    const md = n === w.grid.center ? 0 : w.moonDist[n];
    if (md < 0) return;
    const score = md * 100 + dirTurn(e.heading, dir) * 10 + dir;
    if (score < bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  });
  return bestDir;
}

export function hatchCell(w, cell, occ) {
  let best = -1;
  let bestMd = Infinity;
  for (const n of w.grid.neighbors[cell]) {
    if (!walkable(w, n, occ)) continue;
    const md = w.moonDist[n];
    if (md >= 0 && md < bestMd) {
      bestMd = md;
      best = n;
    }
  }
  return best;
}

// Plan the action of creature `e` given cells occupied by others (`occ`).
export function planAction(pond, e, content, occ) {
  const def = content.enemies[e.type];
  const w = waterFor(pond.radius, pond.rocks);
  const act = currentAction(def, e);
  const adjacent = w.moonDist[e.cell] === 1;
  if ((act === 'move' || act === 'dash') && adjacent && def.bite > 0) return { kind: 'bite' };
  switch (act) {
    case 'move': {
      const path = [];
      let cur = e.cell;
      let heading = e.heading;
      for (let s = 0; s < def.speed; s++) {
        if (w.moonDist[cur] <= 1) break;
        const st = stepToward(w, cur, heading, occ);
        if (!st) break;
        path.push(st.cell);
        cur = st.cell;
        heading = st.dir;
      }
      return path.length ? { kind: 'move', path, heading } : { kind: 'wait' };
    }
    case 'dash': {
      const dir = dashDirection(w, e);
      const path = [];
      let cur = e.cell;
      for (let s = 0; s < (def.dashLen || 1) && dir >= 0; s++) {
        const n = w.grid.neighbors[cur][dir];
        if (!walkable(w, n, occ)) break;
        path.push(n);
        cur = n;
        if (w.moonDist[cur] <= 1) break;
      }
      return path.length ? { kind: 'dash', path, heading: dir } : { kind: 'wait' };
    }
    case 'emit':
      return { kind: 'emit' };
    case 'hatch': {
      if (def.hatchLimit && (e.hatched || 0) >= def.hatchLimit) return { kind: 'rest' };
      const cell = hatchCell(w, e.cell, occ);
      return cell >= 0 ? { kind: 'hatch', cell } : { kind: 'rest' };
    }
    case 'wander': {
      const n = e.wanderTo;
      return n !== undefined && walkable(w, n, occ) ? { kind: 'wander', path: [n] } : { kind: 'wait' };
    }
    default:
      return { kind: 'rest' };
  }
}

export function pickWanderTarget(d, pond, cell) {
  const w = waterFor(pond.radius, pond.rocks);
  const opts = w.grid.neighbors[cell].filter((n) => n >= 0 && !w.blocked[n] && n !== w.grid.center);
  return opts.length ? opts[randInt(d, opts.length)] : cell;
}

export function makeEnemy(d, type, cell, content, mods) {
  const def = content.enemies[type];
  let hp = def.hp;
  if (def.boss && mods && mods.bossHpMul) hp = Math.round(hp * (1 + mods.bossHpMul));
  const e = { id: d.uid++, type, cell, hp, maxHp: hp, age: 0, heading: -1 };
  if (def.life) e.life = def.life;
  if (def.pattern.includes('wander')) e.wanderTo = pickWanderTarget(d, d.pond, cell);
  return e;
}
