import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContent, testContent } from './helpers.mjs';
import { validateContent } from '../js/core/content.js';
import { newRun, step } from '../js/core/run.js';
import { buildGrid } from '../js/core/hex.js';
import { extendProfile, deathProfile, getMods } from '../js/core/mods.js';

const g = buildGrid(5);
const C = (q, r) => g.indexOf(q, r);

function sandbox(content, enemies = [], slots = null) {
  const run = newRun({ seed: 'ct', keeper: 'moench' }, content);
  run.pond.rocks = [];
  run.pond.schedule = [];
  run.pond.telegraphs = [];
  run.pond.enemies = enemies.map(([type, cell], i) => ({
    id: 1000 + i, type, cell, hp: content.enemies[type].hp, maxHp: content.enemies[type].hp, age: 0, heading: -1,
    ...(content.enemies[type].life ? { life: content.enemies[type].life, wanderTo: g.neighbors[cell].find((n) => n > 0) } : {}),
  }));
  run.pond.total = enemies.length;
  if (slots) run.slots = slots.map((s) => ({ stone: s, cd: 0 }));
  return run;
}
const ok = (res) => {
  assert.notEqual(res.events[0]?.type, 'invalid', res.events[0]?.reason);
  return res.run;
};

test('shipped content validates', () => {
  assert.deepEqual(validateContent(loadContent()), []);
});

test('validator catches broken references', () => {
  const c = loadContent();
  c.keeperList[0].stones = ['nope'];
  c.enemyList.push({ id: 'x', hp: 1, pattern: ['fly'], look: { shape: 'blob' } });
  const errs = validateContent(c);
  assert.ok(errs.some((e) => e.includes('nope')));
  assert.ok(errs.some((e) => e.includes('fly')));
});

test('profile helpers: range extension keeps alternation, death boosts', () => {
  assert.deepEqual(extendProfile([1, 1], 2), [1, 1, 1, 1]);
  assert.deepEqual(extendProfile([1, -1, 1], 2), [1, -1, 1, -1, 1]);
  const c = loadContent();
  const mods = { deathBoost: 1, deathRange: 2 };
  const base = c.rules.deathProfile;
  const expected = [base[0], base[1] + 1, ...base.slice(2)];
  while (expected.length < base.length + 2) expected.push(expected[expected.length - 1]);
  assert.deepEqual(deathProfile(c.enemies.tintling, c.rules, mods), expected);
  assert.deepEqual(extendProfile([1, 1, 1, 1], -1), [1, 1, 1]);
  assert.deepEqual(extendProfile([1, 1], -3), [1, 1], 'never shorter than 2');
});

test('mirror stone lands twice, point-mirrored through the moon', () => {
  const c = testContent();
  const run = sandbox(c, [['laich', C(0, 5)]], ['zwilling']);
  const res = step(run, { type: 'throw', slot: 0, cell: C(2, -1) }, c);
  const ev = ok(res) && res.events[0];
  assert.equal(ev.mirror, C(-2, 1));
  assert.equal(res.run.pond.ripples.length, 2);
});

test('echo stone schedules a second ripple two ticks later', () => {
  const c = testContent();
  const run = sandbox(c, [['laich', C(0, 5)]], ['echostein']);
  const r = ok(step(run, { type: 'throw', slot: 0, cell: C(2, -1) }, c));
  const borns = r.pond.ripples.map((x) => x.born).sort();
  assert.deepEqual(borns, [r.pond.tick, r.pond.tick + 2]);
});

test('free stone does not consume a throw; once per turn', () => {
  const c = testContent();
  let run = sandbox(c, [['laich', C(0, 5)]], ['tautropfen', 'kiesel']);
  run = ok(step(run, { type: 'throw', slot: 0, cell: C(2, -1) }, c));
  assert.equal(run.pond.throwsLeft, 2);
  assert.equal(step(run, { type: 'throw', slot: 0, cell: C(3, -1) }, c).events[0].type, 'invalid');
});

test('brandung: no splash, rings 2 and 3 surge alone', () => {
  const c = testContent();
  let run = sandbox(c, [['laich', C(0, 5)]], ['brandung']);
  run = ok(step(run, { type: 'throw', slot: 0, cell: C(1, -2) }, c));
  const counts = [];
  for (let t = 0; t < 4; t++) {
    const res = step(run, { type: 'endTurn' }, c);
    counts.push(res.events.find((e) => e.type === 'resolve').surges.length);
    run = res.run;
  }
  assert.equal(counts[0], 0);
  assert.equal(counts[1], 0);
  assert.ok(counts[2] >= 8 && counts[3] >= 8, JSON.stringify(counts));
});

test('pike dashes in a straight line on its dash turn', () => {
  const c = testContent();
  let run = sandbox(c, [['hecht', C(0, -5)]]);
  let res = step(run, { type: 'endTurn' }, c); // rest
  assert.ok(!res.events.some((e) => e.type === 'move'));
  res = step(res.run, { type: 'endTurn' }, c); // dash
  const mv = res.events.find((e) => e.type === 'move');
  assert.equal(mv.kind, 'dash');
  assert.equal(mv.path.length, 3);
  assert.equal(res.run.pond.enemies[0].cell, C(0, -2));
});

test('spawn creature hatches a tintling every third turn, at most 3 times', () => {
  const c = testContent();
  let run = sandbox(c, [['laich', C(0, -4)]]);
  let hatched = 0;
  for (let t = 0; t < 14 && run.mode === 'pond'; t++) {
    const res = step(run, { type: 'endTurn' }, c);
    hatched += res.events.filter((e) => e.type === 'hatch').length;
    run = res.run;
    run.pond.enemies = run.pond.enemies.filter((e) => e.type === 'laich');
  }
  assert.equal(hatched, 3);
});

test('wisp wanders, is not hostile, vanishes after its life; killing it gives a strong ripple', () => {
  const c = testContent();
  let run = sandbox(c, [['irrlicht', C(2, -2)], ['laich', C(0, 5)]]);
  let vanished = false;
  for (let t = 0; t < 8; t++) {
    const res = step(run, { type: 'endTurn' }, c);
    if (res.events.some((e) => e.type === 'vanish')) vanished = true;
    run = res.run;
  }
  assert.ok(vanished);
  const r2 = sandbox(c, [['irrlicht', C(2, -2)], ['laich', C(0, 5)]]);
  r2.pond.ripples = [
    { id: 1, origin: C(2, -1), born: r2.pond.tick - 1, profile: [1, 1], owner: 'player', gen: 0 },
    { id: 2, origin: C(2, -3), born: r2.pond.tick - 1, profile: [1, 1], owner: 'player', gen: 0 },
  ];
  const res = step(r2, { type: 'endTurn' }, c);
  const d = res.events.find((e) => e.type === 'death');
  assert.equal(d.hostile, false);
  assert.equal(res.run.stats.wisps, 1);
  assert.deepEqual(res.run.pond.ripples.find((r) => r.owner === 'death').profile, [0, 2, 1, 1]);
});

test('shield talisman blocks the first bite per pond', () => {
  const c = testContent();
  let run = sandbox(c, [['tintling', C(0, -1)]]);
  run.talismans = ['mondhof'];
  let res = step(run, { type: 'endTurn' }, c);
  assert.ok(res.events.some((e) => e.type === 'bite' && e.blocked));
  assert.equal(res.run.light, run.light);
  res = step(res.run, { type: 'endTurn' }, c);
  assert.ok(res.events.some((e) => e.type === 'bite' && !e.blocked));
});

test('phase mods: start light and boss hp scale', () => {
  const c = loadContent();
  const r2 = newRun({ seed: 'p', keeper: 'moench', phase: 2 }, c);
  assert.equal(r2.light, c.keepers.moench.light - 2);
  const r3 = newRun({ seed: 'p', keeper: 'moench', phase: 3 }, c);
  assert.equal(getMods(r3, c).bossHpMul, 0.3);
});
