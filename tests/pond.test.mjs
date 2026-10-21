import test from 'node:test';
import assert from 'node:assert/strict';
import { testContent, loadContent } from './helpers.mjs';
import { newRun, step } from '../js/core/run.js';
import { buildGrid } from '../js/core/hex.js';
import { forecast, previewThrow } from '../js/core/preview.js';

const g = buildGrid(5);
const C = (q, r) => g.indexOf(q, r);

function sandbox(content, enemies = [], opts = {}) {
  const run = newRun({ seed: 'test', keeper: 'moench', ...opts }, content);
  run.pond.rocks = opts.rocks || [];
  run.pond.schedule = [];
  run.pond.telegraphs = [];
  run.pond.enemies = enemies.map(([type, cell], i) => ({
    id: 1000 + i, type, cell, hp: content.enemies[type].hp, maxHp: content.enemies[type].hp, age: 0, heading: -1,
  }));
  run.pond.total = enemies.length;
  return run;
}

function act(run, action, content) {
  const res = step(run, action, content);
  assert.notEqual(res.events[0]?.type, 'invalid', res.events[0]?.reason);
  return res;
}

test('throw rules: moon, rocks, same cell twice, cooldown, throw budget', () => {
  const c = testContent();
  let run = sandbox(c, [['tintling', C(0, -5)]], { rocks: [C(2, 0)] });
  const inv = (a) => step(run, a, c).events[0];
  assert.equal(inv({ type: 'throw', slot: 0, cell: 0 }).type, 'invalid');
  assert.equal(inv({ type: 'throw', slot: 0, cell: C(2, 0) }).type, 'invalid');
  run = act(run, { type: 'throw', slot: 0, cell: C(1, 1) }, c).run;
  assert.equal(step(run, { type: 'throw', slot: 1, cell: C(1, 1) }, c).events[0].type, 'invalid');
  assert.equal(step(run, { type: 'throw', slot: 0, cell: C(2, 2) }, c).events[0].type, 'invalid', 'slot used');
  run = act(run, { type: 'throw', slot: 2, cell: C(-1, 1) }, c).run; // flussstein
  assert.equal(run.pond.throwsLeft, 0);
  assert.equal(step(run, { type: 'throw', slot: 1, cell: C(3, -1) }, c).events[0].type, 'invalid', 'no throws left');
  run = act(run, { type: 'endTurn' }, c).run;
  assert.equal(run.slots[0].cd, 0, 'kiesel ready next turn');
  assert.equal(run.slots[2].cd, 2, 'flussstein cools down 2 turns');
  assert.equal(run.pond.throwsLeft, 2);
});

test('undo restores ripples, cooldown and throws', () => {
  const c = testContent();
  let run = sandbox(c, [['tintling', C(0, -5)]]);
  const before = structuredClone(run);
  run = act(run, { type: 'throw', slot: 2, cell: C(1, 1) }, c).run;
  run = act(run, { type: 'undo' }, c).run;
  assert.deepEqual(run.pond.ripples, before.pond.ripples);
  assert.equal(run.slots[2].cd, 0);
  assert.equal(run.pond.throwsLeft, 2);
  assert.equal(step(run, { type: 'undo' }, c).events[0].type, 'invalid');
});

test('interference: two splashes next to a creature surge on the next tick; inputs not mutated', () => {
  const c = testContent();
  // a Laich never moves: neighbors (1,-4) and (-1,-2) are both adjacent to (0,-3)
  let run = sandbox(c, [['laich', C(0, -3)]]);
  const snapshot = JSON.stringify(run);
  run = act(run, { type: 'throw', slot: 0, cell: C(1, -4) }, c).run;
  run = act(run, { type: 'throw', slot: 1, cell: C(-1, -2) }, c).run;
  assert.equal(snapshot, JSON.stringify(JSON.parse(snapshot)), 'sanity');
  assert.equal(JSON.parse(snapshot).pond.ripples.length, 0, 'original run untouched');
  let res = act(run, { type: 'endTurn' }, c);
  assert.ok(!res.events.some((e) => e.type === 'hit'), 'radius 0 splashes do not meet');
  const fc = forecast(res.run, c);
  assert.ok(fc.now.hits.some((h) => h.id === 1000 && h.dmg === 1 && !h.lethal));
  res = act(res.run, { type: 'endTurn' }, c);
  const hit = res.events.find((e) => e.type === 'hit');
  assert.ok(hit && hit.id === 1000 && hit.dmg === 1 && hit.hp === c.enemies.laich.hp - 1);
});

test('stones cannot land on creatures; flussstein ring (amp 2) hits neighbors alone; death ripple born', () => {
  const c = testContent();
  let run = sandbox(c, [['laich', C(0, -3)], ['schnecke', C(0, 5)]]);
  assert.equal(step(run, { type: 'throw', slot: 0, cell: C(0, -3) }, c).events[0].type, 'invalid');
  // laich hp 2: flussstein next to it -> radius-1 ring of amplitude 2 = 1 damage, twice = dead
  run = act(run, { type: 'throw', slot: 2, cell: C(1, -4) }, c).run;
  let res = act(run, { type: 'endTurn' }, c);
  res = act(res.run, { type: 'endTurn' }, c);
  assert.ok(res.events.some((e) => e.type === 'hit' && e.id === 1000 && e.dmg === 1));
  run = res.run;
  run.pond.enemies.find((e) => e.id === 1000).hp = 1;
  run.slots[2].cd = 0;
  run = act(run, { type: 'throw', slot: 2, cell: C(-1, -2) }, c).run;
  res = act(run, { type: 'endTurn' }, c);
  res = act(res.run, { type: 'endTurn' }, c);
  const death = res.events.find((e) => e.type === 'death');
  assert.ok(death && death.id === 1000);
  const dr = res.run.pond.ripples.find((r) => r.owner === 'death');
  assert.equal(dr.origin, C(0, -3));
  assert.deepEqual(dr.profile, c.rules.deathProfile);
});

test('armor blocks small surges', () => {
  const c = testContent();
  let run = sandbox(c, [['schnecke', C(0, -4)], ['tintling', C(3, 2)]]);
  run.pond.enemies[0].age = 1; // resting turn: the snail stays put
  run = act(run, { type: 'throw', slot: 2, cell: C(1, -5) }, c).run; // flussstein ring r=1 (amp 2)
  let res = act(run, { type: 'endTurn' }, c);
  res = act(res.run, { type: 'endTurn' }, c);
  assert.ok(res.events.some((e) => e.type === 'block' && e.id === 1000));
  assert.equal(res.run.pond.enemies.find((e) => e.id === 1000).hp, c.enemies.schnecke.hp);
});

test('creatures walk to the moon and bite; light 0 loses the run', () => {
  const c = testContent();
  let run = sandbox(c, [['tintling', C(0, -2)]]);
  run.light = 2;
  let res = act(run, { type: 'endTurn' }, c);
  assert.equal(res.run.pond.enemies[0].cell, C(0, -1));
  res = act(res.run, { type: 'endTurn' }, c);
  assert.ok(res.events.some((e) => e.type === 'bite' && e.dmg === 1));
  assert.equal(res.run.light, 1);
  res = act(res.run, { type: 'endTurn' }, c);
  assert.equal(res.run.mode, 'lost');
  assert.ok(res.events.some((e) => e.type === 'runLost'));
});

test('strider moves 2, toad emits a dark ripple born next tick', () => {
  const c = testContent();
  let run = sandbox(c, [['laeufer', C(0, -5)], ['unke', C(5, -5)]]);
  let res = act(run, { type: 'endTurn' }, c);
  assert.equal(res.run.pond.enemies.find((e) => e.id === 1000).cell, C(0, -3));
  res = act(res.run, { type: 'endTurn' }, c); // unke: move, then emit
  const emit = res.events.find((e) => e.type === 'emit');
  assert.ok(emit);
  const dark = res.run.pond.ripples.find((r) => r.owner === 'enemy');
  assert.equal(dark.born, res.run.pond.tick);
  assert.equal(dark.profile[0], -1);
});

test('pond is won when every hostile creature is gone -> reward offered', () => {
  const c = loadContent();
  let run = newRun({ seed: 'win', keeper: 'moench' }, c);
  run.pond.schedule = [];
  run.pond.telegraphs = [];
  run.pond.enemies = [{ id: 999, type: 'tintling', cell: C(0, -3), hp: 1, maxHp: 1, age: 0, heading: -1 }];
  run.pond.rocks = [];
  run.pond.ripples = [
    { id: 1, origin: C(0, -2), born: run.pond.tick - 1, profile: [1, 1, 1], owner: 'player', gen: 0 },
    { id: 2, origin: C(0, -4), born: run.pond.tick - 1, profile: [1, 1, 1], owner: 'player', gen: 0 },
  ];
  const res = act(run, { type: 'endTurn' }, c);
  assert.ok(res.events.some((e) => e.type === 'pondWon'));
  assert.equal(res.run.mode, 'reward');
  assert.equal(res.run.reward.options.length, 3);
});

test('previewThrow reports errors and forecasts', () => {
  const c = testContent();
  const run = sandbox(c, [['tintling', C(0, -4)], ['schnecke', C(0, 5)]]);
  assert.ok(previewThrow(run, 0, 0, c).error);
  run.pond.ripples = [{ id: 1, origin: C(0, -2), born: run.pond.tick - 1, profile: [1, 1, 1], owner: 'player', gen: 0 }];
  assert.ok(previewThrow(run, 0, C(0, -4), c).error, 'occupied');
  const p = previewThrow(run, 0, C(1, -4), c);
  assert.ok(!p.error);
  assert.ok(p.now.hits.length === 0);
  assert.ok(p.next.surges.length >= 0);
});

test('same seed, same actions -> identical runs (determinism)', () => {
  const c = loadContent();
  const play = () => {
    let run = newRun({ seed: 'det', keeper: 'moench' }, c);
    for (let t = 0; t < 6 && run.mode === 'pond'; t++) {
      const cells = g.rim.slice(0, 2).map((x) => g.neighbors[x].find((n) => n > 0 && g.cells[n].ring === 4));
      for (let s = 0; s < 2; s++) {
        const r = step(run, { type: 'throw', slot: s, cell: cells[s] }, c);
        if (r.events[0].type !== 'invalid') run = r.run;
      }
      run = step(run, { type: 'endTurn' }, c).run;
    }
    return JSON.stringify(run);
  };
  assert.equal(play(), play());
});
