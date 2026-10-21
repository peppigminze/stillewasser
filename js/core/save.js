// Run (de)serialization with defensive validation. A save that does not pass
// validation is rejected (null) instead of crashing the game later.

import { RUN_VERSION, emptyStats } from './run.js';
import { buildGrid } from './hex.js';

const isInt = Number.isInteger;
const isArr = Array.isArray;

export function serializeRun(run) {
  return { v: RUN_VERSION, savedAt: run.savedAt || 0, run };
}

function validCell(grid, c) {
  return isInt(c) && c >= 0 && c < grid.size;
}

function validProfile(p) {
  return isArr(p) && p.length > 0 && p.length < 40 && p.every(isInt);
}

export function validateRun(run, content) {
  if (!run || typeof run !== 'object') return 'kein Objekt';
  if (run.v !== RUN_VERSION) return 'Version';
  if (!['pond', 'reward', 'won', 'lost'].includes(run.mode)) return 'mode';
  if (!content.keepers[run.keeper]) return 'keeper';
  if (!isInt(run.rng) || !isInt(run.uid)) return 'rng/uid';
  if (!isInt(run.act) || run.act < 0 || run.act >= content.acts.length) return 'act';
  if (!isInt(run.step) || run.step < 0 || run.step >= content.acts[run.act].ponds.length) return 'step';
  if (!isInt(run.light) || !isInt(run.maxLight) || run.maxLight < 1 || run.light < 0 || run.light > run.maxLight) return 'light';
  if (!isArr(run.slots) || !run.slots.length || run.slots.length > content.rules.maxSlots) return 'slots';
  for (const s of run.slots) if (!s || !content.stones[s.stone] || !isInt(s.cd) || s.cd < 0) return 'slot';
  if (!isArr(run.talismans) || run.talismans.some((t) => !content.talismans[t])) return 'talismans';
  if (!run.pool || !isArr(run.pool.stones) || !isArr(run.pool.talismans)) return 'pool';
  if (!run.stats || typeof run.stats !== 'object') return 'stats';
  if (run.mode === 'reward') {
    if (!run.reward || !isArr(run.reward.options) || !run.reward.options.length) return 'reward';
    for (const o of run.reward.options) {
      if (o.kind === 'stone' && !content.stones[o.id]) return 'reward stone';
      if (o.kind === 'talisman' && !content.talismans[o.id]) return 'reward talisman';
      if (!['stone', 'talisman', 'heal'].includes(o.kind)) return 'reward kind';
    }
  }
  const p = run.pond;
  if (run.mode === 'pond' || run.mode === 'reward') {
    if (!p || typeof p !== 'object') return 'pond';
    if (p.radius !== content.rules.pondRadius) return 'radius';
    const grid = buildGrid(p.radius);
    if (!isArr(p.rocks) || p.rocks.some((c) => !validCell(grid, c) || c === 0)) return 'rocks';
    if (!isInt(p.tick) || !isInt(p.turn) || !isInt(p.throwsLeft)) return 'pond counters';
    if (!isArr(p.ripples) || p.ripples.length > 400) return 'ripples';
    for (const r of p.ripples) if (!validCell(grid, r.origin) || !isInt(r.born) || !validProfile(r.profile)) return 'ripple';
    if (!isArr(p.enemies) || p.enemies.length > 120) return 'enemies';
    const seen = new Set();
    for (const e of p.enemies) {
      if (!content.enemies[e.type] || !validCell(grid, e.cell) || !isInt(e.hp) || e.hp <= 0) return 'enemy';
      if (seen.has(e.cell) || e.cell === 0 || p.rocks.includes(e.cell)) return 'enemy cell';
      seen.add(e.cell);
    }
    if (!isArr(p.telegraphs) || p.telegraphs.some((t) => !content.enemies[t.type] || !validCell(grid, t.cell))) return 'telegraphs';
    if (!isArr(p.schedule) || p.schedule.some((t) => !content.enemies[t.type] || !isInt(t.turn))) return 'schedule';
    if (!isArr(p.turnThrows)) return 'turnThrows';
    if (!['playing', 'won', 'lost'].includes(p.status)) return 'status';
  }
  return null;
}

// Returns a run or null. Accepts the parsed JSON object from storage.
export function deserializeRun(data, content) {
  try {
    if (!data || data.__corrupt || data.v !== RUN_VERSION) return null;
    const run = structuredClone(data.run);
    if (run && run.stats) run.stats = { ...emptyStats(), ...run.stats };
    const problem = validateRun(run, content);
    return problem ? null : run;
  } catch {
    return null;
  }
}
