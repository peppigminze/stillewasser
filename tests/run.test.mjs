import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContent } from './helpers.mjs';
import { newRun, step } from '../js/core/run.js';
import { serializeRun, deserializeRun, validateRun } from '../js/core/save.js';
import { getMods } from '../js/core/mods.js';

const content = loadContent();

// Force the current pond to be won on the next endTurn.
function winPond(run) {
  const r = structuredClone(run);
  r.pond.enemies = [];
  r.pond.schedule = [];
  r.pond.telegraphs = [];
  return step(r, { type: 'endTurn' }, content);
}

test('new run: keeper kit, light, first pond generated deterministically', () => {
  const a = newRun({ seed: 'abc', keeper: 'moench' }, content);
  const b = newRun({ seed: 'abc', keeper: 'moench' }, content);
  assert.deepEqual(a, b);
  assert.equal(a.slots.length, 3);
  assert.equal(a.light, 10);
  assert.equal(a.mode, 'pond');
  assert.ok(a.pond.total > 0);
  assert.ok(a.pond.enemies.length > 0);
  assert.equal(validateRun(a, content), null);
});

test('every keeper can start a run and every phase applies', () => {
  for (const k of content.keeperList) {
    for (let ph = 0; ph < content.phases.length; ph++) {
      const run = newRun({ seed: `k${k.id}${ph}`, keeper: k.id, phase: ph }, content);
      assert.equal(validateRun(run, content), null, `${k.id}/${ph}`);
      assert.ok(run.light >= 1);
    }
  }
});

test('reward flow: options offered, pick talisman, advance to next pond', () => {
  let run = newRun({ seed: 'rw', keeper: 'moench' }, content);
  let res = winPond(run);
  run = res.run;
  assert.equal(run.mode, 'reward');
  const ti = run.reward.options.findIndex((o) => o.kind === 'talisman');
  assert.ok(ti >= 0, 'at least one talisman offered');
  const id = run.reward.options[ti].id;
  res = step(run, { type: 'pickReward', index: ti }, content);
  run = res.run;
  assert.ok(run.talismans.includes(id));
  assert.equal(run.mode, 'pond');
  assert.equal(run.step, 1);
  assert.ok(res.events.some((e) => e.type === 'pondStart'));
});

test('stone reward with full pouch requires a replace slot', () => {
  let run = newRun({ seed: 'full', keeper: 'moench' }, content);
  run.slots.push({ stone: 'kiesel', cd: 0 });
  run = winPond(run).run;
  run.reward.options = [{ kind: 'stone', id: 'mondstein' }, { kind: 'heal', amount: 3 }];
  assert.equal(step(run, { type: 'pickReward', index: 0 }, content).events[0].reason, 'replace');
  const res = step(run, { type: 'pickReward', index: 0, replace: 1 }, content);
  assert.equal(res.run.slots[1].stone, 'mondstein');
  assert.equal(res.run.slots.length, 4);
});

test('maxLight talismans adjust light; heal caps at max', () => {
  let run = newRun({ seed: 'ml', keeper: 'moench' }, content);
  run = winPond(run).run;
  run.reward.options = [{ kind: 'talisman', id: 'silberschale' }];
  run = step(run, { type: 'pickReward', index: 0 }, content).run;
  assert.equal(run.maxLight, 13);
  assert.equal(run.light, 13);
  run = winPond(run).run;
  run.reward.options = [{ kind: 'talisman', id: 'kraniche' }];
  run = step(run, { type: 'pickReward', index: 0 }, content).run;
  assert.equal(run.maxLight, 10);
  assert.equal(run.light, 10);
  assert.equal(getMods(run, content).throws, 1);
  assert.equal(run.pond.throwsLeft, 3);
});

test('progress through all acts to victory', () => {
  let run = newRun({ seed: 'all', keeper: 'moench' }, content);
  let acts = 0;
  for (let guard = 0; guard < 40 && run.mode !== 'won'; guard++) {
    const res = winPond(run);
    run = res.run;
    if (run.mode === 'reward') {
      const r2 = step(run, { type: 'skipReward' }, content);
      if (r2.events.some((e) => e.type === 'actStart')) acts++;
      run = r2.run;
      if (run.pond.kind === 'boss') assert.ok(run.pond.enemies.some((e) => content.enemies[e.type].boss));
    }
  }
  assert.equal(run.mode, 'won');
  assert.equal(acts, content.acts.length - 1);
  assert.equal(run.stats.ponds, content.acts.reduce((s, a) => s + a.ponds.length, 0));
  assert.ok(run.stats.score > 0);
});

test('tutorial run starts in the fixed learning pond', () => {
  const run = newRun({ seed: 'tut', keeper: 'moench', tutorial: true }, content);
  assert.equal(run.pond.kind, 'tutorial');
  assert.equal(run.pond.enemies.length, 1);
  assert.equal(run.pond.rocks.length, content.tutorial.rocks.length);
});

test('save round trip and rejection of corrupt saves', () => {
  let run = newRun({ seed: 'save', keeper: 'moench' }, content);
  run = step(run, { type: 'throw', slot: 0, cell: 20 }, content).run;
  const data = JSON.parse(JSON.stringify(serializeRun(run)));
  assert.deepEqual(deserializeRun(data, content), run);
  assert.equal(deserializeRun(null, content), null);
  assert.equal(deserializeRun({ __corrupt: true }, content), null);
  assert.equal(deserializeRun({ v: 99, run }, content), null);
  const bad = structuredClone(data);
  bad.run.slots[0].stone = 'gibtsnicht';
  assert.equal(deserializeRun(bad, content), null);
  const bad2 = structuredClone(data);
  bad2.run.pond.enemies[0].cell = 9999;
  assert.equal(deserializeRun(bad2, content), null);
  const bad3 = structuredClone(data);
  bad3.run.light = 50;
  assert.equal(deserializeRun(bad3, content), null);
  const old = structuredClone(data);
  delete old.run.stats.wisps;
  assert.equal(deserializeRun(old, content).stats.wisps, 0, 'missing stats are filled in');
});

test('abandon ends the run', () => {
  const run = newRun({ seed: 'ab', keeper: 'moench' }, content);
  const res = step(run, { type: 'abandon' }, content);
  assert.equal(res.run.mode, 'lost');
  assert.equal(res.run.result.reason, 'abandon');
  assert.equal(step(res.run, { type: 'endTurn' }, content).events[0].type, 'invalid');
});
