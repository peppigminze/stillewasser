// Pond (single fight) state machine. Functions here operate on a draft `d`
// (the whole run object, already cloned by run.js) and push events to `ev`.

import { buildGrid, mirrorCell } from './hex.js';
import { waterFor, fieldAt, surgesOf, surgeDamage, rippleAlive } from './field.js';
import { randInt, shuffle, weightedPick } from './rng.js';
import { getMods, stoneProfile, stoneCooldown, deathProfile, throwsForTurn } from './mods.js';
import { planAction, occupiedCells, makeEnemy, pickWanderTarget, isHostile } from './enemies.js';

const range = (d, [lo, hi]) => lo + randInt(d, hi - lo + 1);

// ---------------------------------------------------------------- creation

function placeRocks(d, grid, count, minRing) {
  const candidates = grid.cells
    .map((c, i) => i)
    .filter((i) => grid.cells[i].ring >= minRing && grid.cells[i].ring < grid.radius);
  for (let attempt = 0; attempt < 30; attempt++) {
    const n = Math.max(0, count - Math.floor(attempt / 10));
    const rocks = shuffle(d, candidates).slice(0, n);
    const w = waterFor(grid.radius, rocks);
    const ok = grid.cells.every((_, i) => w.blocked[i] || w.moonDist[i] >= 0);
    if (ok) return rocks;
  }
  return [];
}

function freeRimCells(pond, w) {
  const occ = occupiedCells(pond);
  for (const t of pond.telegraphs) occ.add(t.cell);
  return w.grid.rim.filter((i) => !w.blocked[i] && !occ.has(i) && w.moonDist[i] > 0);
}

function pickSpawnCell(d, pond, w, preferred) {
  const free = freeRimCells(pond, w);
  if (preferred !== undefined && free.includes(preferred)) return preferred;
  if (!free.length) return -1;
  if (preferred !== undefined && preferred >= 0) {
    // nearest free rim cell to the preferred one
    const pc = w.grid.cells[preferred];
    let best = free[0];
    let bestD = Infinity;
    for (const i of free) {
      const c = w.grid.cells[i];
      const dd = Math.abs(c.q - pc.q) + Math.abs(c.r - pc.r) + Math.abs(c.q + c.r - pc.q - pc.r);
      if (dd < bestD) { bestD = dd; best = i; }
    }
    return best;
  }
  return free[randInt(d, free.length)];
}

function buildSchedule(d, tmpl, content, mods) {
  const budget0 = Math.round(tmpl.budget * (1 + (mods.budgetMul || 0)));
  const pool = Object.entries(tmpl.pool || {});
  const list = [];
  let budget = budget0;
  while (budget > 0) {
    const opts = pool.filter(([t]) => content.enemies[t].cost <= budget && content.enemies[t].cost > 0);
    if (!opts.length) break;
    const [type] = weightedPick(d, opts, ([, wgt]) => wgt);
    list.push(type);
    budget -= content.enemies[type].cost;
  }
  // gentle start: cheaper creatures first, then mixed
  const ordered = shuffle(d, list).sort((a, b) => content.enemies[a].cost - content.enemies[b].cost);
  const head = ordered.slice(0, Math.ceil(ordered.length / 3));
  const tail = shuffle(d, ordered.slice(head.length));
  return head.concat(tail);
}

export function createPond(d, act, step, content) {
  const rules = content.rules;
  const mods = getMods(d, content);
  const tutorial = d.tutorial && act === 0 && step === 0;
  const tmpl = tutorial ? content.tutorial : content.acts[act].ponds[step];
  const grid = buildGrid(rules.pondRadius);
  const pond = {
    act, step, kind: tmpl.kind, boss: tmpl.boss || null,
    radius: grid.radius, rocks: [], tick: 0, turn: 0,
    ripples: [], enemies: [], telegraphs: [], schedule: [],
    throwsLeft: 0, turnThrows: [], shieldUsed: 0, kills: 0, chainMax: 0,
    healedTurn: -1, status: 'playing', total: 0,
  };
  d.pond = pond;

  if (tutorial) {
    pond.rocks = tmpl.rocks.map(([q, r]) => grid.indexOf(q, r)).filter((i) => i > 0);
  } else {
    pond.rocks = placeRocks(d, grid, range(d, tmpl.rocks), rules.rockRingMin);
  }
  const w = waterFor(pond.radius, pond.rocks);

  if (tutorial) {
    for (const f of tmpl.fixed) {
      const cell = grid.indexOf(f.q, f.r);
      if (f.turn === 0) pond.enemies.push(makeEnemy(d, f.type, cell, content, mods));
      else pond.schedule.push({ turn: f.turn - 1, type: f.type, cell });
    }
  } else {
    const list = buildSchedule(d, tmpl, content, mods);
    if (tmpl.kind === 'boss') {
      const cell = pickSpawnCell(d, pond, w);
      pond.enemies.push(makeEnemy(d, tmpl.boss, cell, content, mods));
    }
    const initial = Math.min(tmpl.initial || 0, list.length);
    for (let i = 0; i < initial; i++) {
      const cell = pickSpawnCell(d, pond, w);
      if (cell >= 0) pond.enemies.push(makeEnemy(d, list[i], cell, content, mods));
    }
    let t = 0;
    let i = initial;
    while (i < list.length) {
      const g = range(d, tmpl.group || [1, 1]);
      for (let k = 0; k < g && i < list.length; k++, i++) pond.schedule.push({ turn: t, type: list[i] });
      t += range(d, tmpl.interval || [1, 1]);
    }
    for (let k = 0; k < (tmpl.wisps || 0); k++) pond.schedule.push({ turn: 1 + randInt(d, 6), type: 'irrlicht' });
    pond.schedule.sort((a, b) => a.turn - b.turn);
  }
  pond.total = pond.enemies.filter((e) => isHostile(content.enemies[e.type])).length
    + pond.schedule.filter((s) => isHostile(content.enemies[s.type])).length;
  for (const s of d.slots) s.cd = 0;
  pond.throwsLeft = throwsForTurn(d, content, mods, 0);
  telegraphSpawns(d, content, 0);
  return pond;
}

// ------------------------------------------------------------------ spawns

function telegraphSpawns(d, content, forTurn) {
  const pond = d.pond;
  const w = waterFor(pond.radius, pond.rocks);
  const due = pond.schedule.filter((s) => s.turn <= forTurn);
  pond.schedule = pond.schedule.filter((s) => s.turn > forTurn);
  for (const s of due) {
    const cell = pickSpawnCell(d, pond, w, s.cell);
    if (cell < 0) {
      pond.schedule.push({ ...s, turn: forTurn + 1 });
      continue;
    }
    pond.telegraphs.push({ cell, type: s.type });
  }
  pond.schedule.sort((a, b) => a.turn - b.turn);
}

function hostileOnBoard(pond, content) {
  return pond.enemies.some((e) => isHostile(content.enemies[e.type]));
}

function hostileRemaining(pond, content) {
  return hostileOnBoard(pond, content)
    || pond.telegraphs.some((t) => isHostile(content.enemies[t.type]))
    || pond.schedule.some((s) => isHostile(content.enemies[s.type]));
}

function materializeSpawns(d, content, mods, ev) {
  const pond = d.pond;
  const w = waterFor(pond.radius, pond.rocks);
  const pending = pond.telegraphs;
  pond.telegraphs = [];
  for (const t of pending) {
    const occ = occupiedCells(pond);
    let cell = t.cell;
    if (occ.has(cell)) cell = pickSpawnCell(d, pond, w, cell);
    if (cell < 0) {
      pond.schedule.push({ turn: pond.turn + 1, type: t.type });
      continue;
    }
    const e = makeEnemy(d, t.type, cell, content, mods);
    pond.enemies.push(e);
    ev.push({ type: 'spawn', id: e.id, enemy: e.type, cell });
  }
}

// ------------------------------------------------------------------ throws

export function throwError(d, slotIdx, cell, content) {
  const pond = d.pond;
  if (d.mode !== 'pond' || !pond || pond.status !== 'playing') return 'Gerade nicht möglich.';
  const slot = d.slots[slotIdx];
  if (!slot) return 'Kein Stein in diesem Fach.';
  const stone = content.stones[slot.stone];
  if (slot.cd > 0) return `${stone.name} klingt noch ab (${slot.cd}).`;
  if (!stone.free && pond.throwsLeft <= 0) return 'Keine Würfe mehr in diesem Zug.';
  const grid = buildGrid(pond.radius);
  if (!(cell >= 0 && cell < grid.size)) return 'Außerhalb des Teichs.';
  if (cell === grid.center) return 'Der Mond ist kein Ziel.';
  if (pond.rocks.includes(cell)) return 'Dort liegt ein Fels.';
  if (pond.enemies.some((e) => e.cell === cell)) return 'Auf Schatten prallen Steine ab – wirf ins freie Wasser.';
  if (pond.ripples.some((r) => r.owner === 'player' && r.origin === cell && r.born === pond.tick)) {
    return 'Hier liegt in diesem Zug schon ein Stein.';
  }
  return null;
}

export function applyThrow(d, slotIdx, cell, content, ev) {
  const pond = d.pond;
  const mods = getMods(d, content);
  const slot = d.slots[slotIdx];
  const stone = content.stones[slot.stone];
  const profile = stoneProfile(stone, mods);
  const ids = [];
  const add = (origin, born) => {
    const rp = { id: d.uid++, origin, born, profile, owner: 'player', gen: 0, src: stone.id };
    pond.ripples.push(rp);
    ids.push(rp.id);
  };
  add(cell, pond.tick);
  let mirror = -1;
  if (stone.mirror) {
    const m = mirrorCell(buildGrid(pond.radius), cell);
    const taken = pond.ripples.some((r) => r.owner === 'player' && r.origin === m && r.born === pond.tick);
    const occupied = pond.enemies.some((e) => e.cell === m);
    if (m >= 0 && m !== cell && !pond.rocks.includes(m) && !taken && !occupied) {
      add(m, pond.tick);
      mirror = m;
    }
  }
  if (stone.echo) add(cell, pond.tick + stone.echo);
  pond.turnThrows.push({ slot: slotIdx, cell, prevCd: slot.cd, free: !!stone.free, ripples: ids });
  slot.cd = stoneCooldown(stone, mods) + 1;
  if (!stone.free) pond.throwsLeft -= 1;
  d.stats.throws += 1;
  d.stats.byStone[stone.id] = (d.stats.byStone[stone.id] || 0) + 1;
  ev.push({ type: 'throw', slot: slotIdx, stone: stone.id, cell, mirror, ripples: ids });
}

export function applyUndo(d, ev) {
  const pond = d.pond;
  const last = pond.turnThrows.pop();
  if (!last) return false;
  pond.ripples = pond.ripples.filter((r) => !last.ripples.includes(r.id));
  const slot = d.slots[last.slot];
  slot.cd = last.prevCd;
  if (!last.free) pond.throwsLeft += 1;
  d.stats.throws -= 1;
  d.stats.byStone[slot.stone] = Math.max(0, (d.stats.byStone[slot.stone] || 1) - 1);
  ev.push({ type: 'undo', slot: last.slot, cell: last.cell, ripples: last.ripples });
  return true;
}

// -------------------------------------------------------------- resolution

function heal(d, amount, reason, ev) {
  const before = d.light;
  d.light = Math.min(d.maxLight, d.light + amount);
  if (d.light > before) ev.push({ type: 'heal', amount: d.light - before, light: d.light, reason });
}

function resolveTick(d, content, mods, ev) {
  const pond = d.pond;
  const rules = content.rules;
  const th = rules.surgeThreshold;
  const w = waterFor(pond.radius, pond.rocks);
  const field = fieldAt(w, pond.ripples, pond.tick);
  const surges = surgesOf(field, th);
  ev.push({ type: 'resolve', tick: pond.tick, surges });
  d.stats.surges += surges.length;
  const dead = [];
  for (const e of pond.enemies) {
    const a = field.amp[e.cell];
    if (Math.abs(a) < th) continue;
    const def = content.enemies[e.type];
    const dmg = surgeDamage(a, def.armor, mods, th);
    if (dmg <= 0) {
      ev.push({ type: 'block', id: e.id, cell: e.cell, amp: a });
      continue;
    }
    e.hp -= dmg;
    ev.push({ type: 'hit', id: e.id, cell: e.cell, dmg, hp: Math.max(0, e.hp), amp: a });
    if (e.hp <= 0) dead.push({ e, gen: Math.max(0, field.gen[e.cell]) });
  }
  for (const { e, gen } of dead) {
    const def = content.enemies[e.type];
    const chain = gen + 1;
    pond.enemies = pond.enemies.filter((x) => x !== e);
    pond.ripples.push({
      id: d.uid++, origin: e.cell, born: pond.tick, profile: deathProfile(def, rules, mods),
      owner: 'death', gen: chain, src: e.type,
    });
    const hostile = isHostile(def);
    if (hostile) {
      pond.kills += 1;
      d.stats.kills += 1;
      d.stats.killsByType[e.type] = (d.stats.killsByType[e.type] || 0) + 1;
      d.stats.score += rules.score.kill + (chain >= 2 ? rules.score.chainStep * (chain - 1) : 0);
    } else {
      d.stats.wisps += 1;
    }
    pond.chainMax = Math.max(pond.chainMax, chain);
    d.stats.chainMax = Math.max(d.stats.chainMax, chain);
    ev.push({ type: 'death', id: e.id, enemy: e.type, cell: e.cell, chain, hostile });
    if (mods.chainHeal && chain >= mods.chainHeal && pond.healedTurn !== pond.turn) {
      pond.healedTurn = pond.turn;
      heal(d, 1, 'chain', ev);
    }
  }
}

function enemyPhase(d, content, mods, ev) {
  const pond = d.pond;
  const occ = occupiedCells(pond);
  const order = pond.enemies.slice().sort((a, b) => a.id - b.id);
  for (const e of order) {
    const def = content.enemies[e.type];
    occ.delete(e.cell);
    const it = planAction(pond, e, content, occ);
    switch (it.kind) {
      case 'move':
      case 'dash':
      case 'wander': {
        const from = e.cell;
        e.cell = it.path[it.path.length - 1];
        if (it.heading !== undefined) e.heading = it.heading;
        ev.push({ type: 'move', id: e.id, from, path: it.path, kind: it.kind });
        break;
      }
      case 'bite': {
        const dmg = def.bite + (mods.biteBonus || 0);
        if (pond.shieldUsed < (mods.shieldPerPond || 0)) {
          pond.shieldUsed += 1;
          ev.push({ type: 'bite', id: e.id, cell: e.cell, dmg: 0, light: d.light, blocked: true });
        } else {
          d.light = Math.max(0, d.light - dmg);
          d.stats.bites += 1;
          d.stats.lightLost += dmg;
          ev.push({ type: 'bite', id: e.id, cell: e.cell, dmg, light: d.light, blocked: false });
        }
        break;
      }
      case 'emit':
        pond.ripples.push({
          id: d.uid++, origin: e.cell, born: pond.tick + 1, profile: def.emitProfile.slice(),
          owner: 'enemy', gen: 0, src: e.type,
        });
        ev.push({ type: 'emit', id: e.id, cell: e.cell });
        break;
      case 'hatch': {
        const child = makeEnemy(d, def.hatch, it.cell, content, mods);
        pond.enemies.push(child);
        occ.add(it.cell);
        e.hatched = (e.hatched || 0) + 1;
        if (isHostile(content.enemies[child.type])) pond.total += 1;
        ev.push({ type: 'hatch', id: e.id, cell: it.cell, newId: child.id, enemy: child.type });
        break;
      }
      default:
        break;
    }
    occ.add(e.cell);
    e.age += 1;
    if (e.life !== undefined) {
      e.life -= 1;
      if (e.life <= 0) {
        pond.enemies = pond.enemies.filter((x) => x !== e);
        occ.delete(e.cell);
        ev.push({ type: 'vanish', id: e.id, cell: e.cell });
        continue;
      }
    }
    if (def.pattern.includes('wander')) e.wanderTo = pickWanderTarget(d, pond, e.cell);
  }
}

function checkCleared(d, content) {
  const pond = d.pond;
  if (hostileRemaining(pond, content)) return false;
  pond.status = 'won';
  return true;
}

// Full end-of-turn resolution. Returns nothing; mutates draft, pushes events.
export function resolveTurn(d, content, ev) {
  const pond = d.pond;
  const mods = getMods(d, content);
  resolveTick(d, content, mods, ev);
  if (checkCleared(d, content)) return;

  enemyPhase(d, content, mods, ev);
  if (d.light <= 0) {
    pond.status = 'lost';
    return;
  }
  materializeSpawns(d, content, mods, ev);

  // advance time
  pond.tick += 1;
  pond.turn += 1;
  d.stats.turns += 1;
  pond.ripples = pond.ripples.filter((r) => rippleAlive(r, pond.tick));
  pond.turnThrows = [];
  for (const s of d.slots) s.cd = Math.max(0, s.cd - 1);
  pond.throwsLeft = throwsForTurn(d, content, mods, pond.turn);

  telegraphSpawns(d, content, pond.turn);
  if (!hostileOnBoard(pond, content) && !pond.telegraphs.some((t) => isHostile(content.enemies[t.type]))) {
    // nothing to do: pull the next hostile group forward so nobody waits idle
    const next = pond.schedule.find((s) => isHostile(content.enemies[s.type]));
    if (next) {
      const shift = next.turn - pond.turn;
      for (const s of pond.schedule) s.turn = Math.max(pond.turn, s.turn - shift);
      telegraphSpawns(d, content, pond.turn);
    }
  }
  if (pond.telegraphs.length) ev.push({ type: 'telegraph', cells: pond.telegraphs.map((t) => ({ ...t })) });
  ev.push({ type: 'tick', tick: pond.tick, turn: pond.turn });

  if (pond.turn >= content.rules.maxTurnsPerPond) {
    pond.status = 'lost';
    d.light = 0;
    return;
  }
  checkCleared(d, content);
}

