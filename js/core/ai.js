// Bot strategies. Used by the balance simulation (sim/) and the in-game "Tipp".
// The planner scores throws by how much surge damage their rings add at the
// predicted enemy positions over the next ticks (forecasts run the real rules).

import { waterFor, surgeDamage } from './field.js';
import { buildGrid, mirrorCell, cellDist } from './hex.js';
import { getMods, stoneProfile } from './mods.js';
import { forecast } from './preview.js';
import { step } from './run.js';
import { throwError } from './pond.js';
import { rand, randInt } from './rng.js';

const WEIGHTS = [1, 0.8, 0.6, 0.4];
const LETHAL = 1.6;

export const STRATEGIES = ['random', 'brute', 'greedy', 'planner'];

function usableSlots(run, content) {
  const seen = new Set();
  const out = [];
  run.slots.forEach((s, i) => {
    if (s.cd > 0 || seen.has(s.stone)) return;
    const st = content.stones[s.stone];
    if (!st.free && run.pond.throwsLeft <= 0) return;
    seen.add(s.stone);
    out.push(i);
  });
  return out;
}

function buildContext(run, content, depth) {
  const pond = run.pond;
  const water = waterFor(pond.radius, pond.rocks);
  const mods = getMods(run, content);
  const th = content.rules.surgeThreshold;
  const frames = [];
  const enemyView = (enemies) => enemies.map((e) => {
    const def = content.enemies[e.type];
    const md = Math.max(1, water.moonDist[e.cell]);
    const hostile = def.hostile !== false;
    const urg = hostile ? (1 + Math.max(0, 5 - md) * 0.45) * (def.boss ? 1.4 : 1) * (1 + def.bite * 0.15) : 0.5;
    return { id: e.id, cell: e.cell, hp: e.hp, armor: def.armor || 0, urg };
  });
  let fc = forecast(run, content);
  if (!fc) return null;
  frames.push({ amp: fc.now.amp, enemies: enemyView(pond.enemies) });
  for (let k = 1; k < depth && fc && fc.next; k++) {
    frames.push({ amp: fc.next.amp, enemies: enemyView(fc.next.enemies) });
    fc = k + 1 < depth && fc.result.mode === 'pond' ? forecast(fc.result, content) : null;
  }
  const dmg = (a, armor) => surgeDamage(a, armor, mods, th);
  return { run, content, water, mods, frames, dmg, grid: buildGrid(pond.radius) };
}

function contribsFor(ctx, slot, cell) {
  const { run, content, mods, grid } = ctx;
  const stone = content.stones[run.slots[slot].stone];
  const profile = stoneProfile(stone, mods);
  const list = [{ origin: cell, off: 0, profile }];
  if (stone.mirror) {
    const m = mirrorCell(grid, cell);
    if (m >= 0 && m !== cell && !run.pond.rocks.includes(m)) list.push({ origin: m, off: 0, profile });
  }
  if (stone.echo) list.push({ origin: cell, off: stone.echo, profile });
  return list;
}

function gainOf(ctx, contribs) {
  let total = 0;
  for (let k = 0; k < ctx.frames.length; k++) {
    const fr = ctx.frames[k];
    for (const e of fr.enemies) {
      let add = 0;
      for (const c of contribs) {
        const r = k - c.off;
        if (r < 0 || r >= c.profile.length || !c.profile[r]) continue;
        if (ctx.water.distFrom(c.origin)[e.cell] === r) add += c.profile[r];
      }
      if (!add) continue;
      const base = fr.amp[e.cell];
      const before = Math.min(e.hp, ctx.dmg(base, e.armor));
      const after = Math.min(e.hp, ctx.dmg(base + add, e.armor));
      if (after === before) continue;
      const lethal = (after >= e.hp ? LETHAL : 0) - (before >= e.hp ? LETHAL : 0);
      total += WEIGHTS[k] * e.urg * (after - before + lethal);
    }
  }
  return total;
}

// how many enemy "reach rings" a cell sits on (future potential for pairs)
function potentialOf(ctx, cell) {
  let p = 0;
  const dist = ctx.water.distFrom(cell);
  for (let k = 1; k < ctx.frames.length; k++) {
    for (const e of ctx.frames[k].enemies) if (dist[e.cell] === k) p += WEIGHTS[k] * e.urg;
  }
  return p;
}

function candidateCells(ctx) {
  const { grid, run } = ctx;
  const pond = run.pond;
  const near = new Set();
  for (const fr of ctx.frames) {
    for (const e of fr.enemies) {
      for (let i = 1; i < grid.size; i++) if (cellDist(grid, i, e.cell) <= 3) near.add(i);
    }
  }
  return [...near].filter((c) => !pond.rocks.includes(c));
}

function legal(run, slot, cell, content) {
  return throwError(run, slot, cell, content) === null;
}

// --------------------------------------------------------------- planner
function planBest(run, content, depth, pairs) {
  const ctx = buildContext(run, content, depth);
  if (!ctx) return [];
  const slots = usableSlots(run, content);
  if (!slots.length) return [];
  const cells = candidateCells(ctx);
  const singles = [];
  for (const slot of slots) {
    for (const cell of cells) {
      if (!legal(run, slot, cell, content)) continue;
      const contribs = contribsFor(ctx, slot, cell);
      singles.push({ slot, cell, contribs, gain: gainOf(ctx, contribs), pot: potentialOf(ctx, cell) });
    }
  }
  if (!singles.length) return [];
  singles.sort((a, b) => b.gain + 0.25 * b.pot - (a.gain + 0.25 * a.pot));
  const best1 = singles[0];
  // never throw something that only cancels our own waves
  if (best1.gain < -0.01) return [];
  const freeLeft = (s) => content.stones[run.slots[s].stone].free;
  if (!pairs || run.pond.throwsLeft < 2) return [best1];
  const top = singles.slice(0, 26);
  let best = { gain: best1.gain + 0.25 * best1.pot, picks: [best1] };
  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      const a = top[i];
      const b = top[j];
      if (a.cell === b.cell) continue;
      if (a.slot === b.slot && !(run.slots.filter((s) => s.stone === run.slots[a.slot].stone && s.cd === 0).length > 1)) continue;
      if (!freeLeft(a.slot) && !freeLeft(b.slot) && run.pond.throwsLeft < 2) continue;
      const pairGain = gainOf(ctx, a.contribs.concat(b.contribs));
      if (pairGain < 0) continue;
      const g = pairGain + 0.12 * (a.pot + b.pot);
      if (g > best.gain) best = { gain: g, picks: [a, b] };
    }
  }
  return best.picks;
}

// map a planned pick using a stone id to an actual free slot index
function resolveSlot(run, pick, content) {
  const want = run.slots[pick.slot] && run.slots[pick.slot].stone;
  if (run.slots[pick.slot] && run.slots[pick.slot].cd === 0) return pick.slot;
  const i = run.slots.findIndex((s) => s.stone === want && s.cd === 0);
  return i >= 0 && legal(run, i, pick.cell, content) ? i : -1;
}

function randomThrow(run, content, rngObj) {
  const slots = usableSlots(run, content);
  if (!slots.length) return null;
  const grid = buildGrid(run.pond.radius);
  for (let tries = 0; tries < 30; tries++) {
    const slot = slots[randInt(rngObj, slots.length)];
    const cell = 1 + randInt(rngObj, grid.size - 1);
    if (legal(run, slot, cell, content)) return { slot, cell };
  }
  return null;
}

// "Simple pincer": surround the next cell of the most urgent creature.
function bruteThrow(run, content) {
  const slots = usableSlots(run, content);
  if (!slots.length) return null;
  const water = waterFor(run.pond.radius, run.pond.rocks);
  const fc = forecast(run, content);
  const targets = run.pond.enemies
    .filter((e) => content.enemies[e.type].hostile !== false && !(fc && fc.dying.has(e.id)))
    .sort((a, b) => water.moonDist[a.cell] - water.moonDist[b.cell]);
  const grid = buildGrid(run.pond.radius);
  for (const e of targets) {
    const it = fc && fc.intents[e.id];
    const next = it && it.path ? it.path[it.path.length - 1] : e.cell;
    for (const n of grid.neighbors[next]) {
      if (n < 0) continue;
      for (const slot of slots) if (legal(run, slot, n, content)) return { slot, cell: n };
    }
  }
  return null;
}

// Plays the throws of one turn and returns the resulting run (turn not ended).
export function playThrows(run, content, strategy, rngObj) {
  let cur = run;
  for (let guard = 0; guard < 8; guard++) {
    if (cur.mode !== 'pond' || cur.pond.status !== 'playing') break;
    let picks = [];
    if (strategy === 'random') picks = [randomThrow(cur, content, rngObj)].filter(Boolean);
    else if (strategy === 'brute') picks = [bruteThrow(cur, content)].filter(Boolean);
    else if (strategy === 'greedy') picks = planBest(cur, content, 2, false);
    else picks = planBest(cur, content, 4, true);
    if (!picks.length) break;
    let progressed = false;
    for (const p of picks) {
      const slot = strategy === 'planner' || strategy === 'greedy' ? resolveSlot(cur, p, content) : p.slot;
      if (slot < 0) continue;
      const res = step(cur, { type: 'throw', slot, cell: p.cell }, content);
      if (res.events[0].type === 'invalid') continue;
      cur = res.run;
      progressed = true;
    }
    if (!progressed) break;
  }
  return cur;
}

export function suggestThrow(run, content) {
  if (!run || run.mode !== 'pond' || run.pond.status !== 'playing') return null;
  const picks = planBest(run, content, 4, true);
  if (!picks.length) return null;
  const slot = resolveSlot(run, picks[0], content);
  return slot < 0 ? null : { slot, cell: picks[0].cell };
}

// ---------------------------------------------------------------- rewards
function stoneValue(content, id) {
  return content.stones[id].aiValue || 1;
}

export function chooseReward(run, content, policy, rngObj) {
  const opts = run.reward.options;
  const full = run.slots.length >= content.rules.maxSlots;
  const weakest = () => {
    let w = 0;
    run.slots.forEach((s, i) => { if (stoneValue(content, s.stone) < stoneValue(content, run.slots[w].stone)) w = i; });
    return w;
  };
  if (policy === 'random') {
    const index = randInt(rngObj, opts.length);
    return { type: 'pickReward', index, replace: randInt(rngObj, run.slots.length) };
  }
  let bestI = 0;
  let bestV = -Infinity;
  opts.forEach((o, i) => {
    let v = 0;
    if (o.kind === 'talisman') v = content.talismans[o.id].aiValue || 2;
    else if (o.kind === 'stone') {
      v = stoneValue(content, o.id) + (full ? -stoneValue(content, run.slots[weakest()].stone) : 1.5);
    } else {
      const missing = run.maxLight - run.light;
      v = missing >= 4 ? 4 + missing * 0.4 : missing * 0.8;
    }
    v += rand(rngObj) * 0.5;
    if (v > bestV) { bestV = v; bestI = i; }
  });
  return { type: 'pickReward', index: bestI, replace: weakest() };
}

// Full autoplay of a run (used by the simulation and tests).
// onStep(kind, before, res) is called for every reward pick ('reward') and every turn end ('turn').
export function autoplay(run, content, { strategy = 'planner', rewardPolicy = 'value', seed = 1, onStep = null, maxTurns = 1200 } = {}) {
  const rngObj = { rng: seed >>> 0 };
  let cur = run;
  let turns = 0;
  while ((cur.mode === 'pond' || cur.mode === 'reward') && turns < maxTurns) {
    if (cur.mode === 'reward') {
      const action = chooseReward(cur, content, rewardPolicy, rngObj);
      let res = step(cur, action, content);
      if (res.events[0].type === 'invalid') res = step(cur, { type: 'skipReward' }, content);
      if (onStep) onStep('reward', cur, res, action);
      cur = res.run;
      continue;
    }
    cur = playThrows(cur, content, strategy, rngObj);
    const res = step(cur, { type: 'endTurn' }, content);
    turns++;
    if (onStep) onStep('turn', cur, res);
    cur = res.run;
  }
  return cur;
}
