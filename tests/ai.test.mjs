import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContent } from './helpers.mjs';
import { newRun, step } from '../js/core/run.js';
import { autoplay, suggestThrow, STRATEGIES } from '../js/core/ai.js';
import { validateRun } from '../js/core/save.js';

const content = loadContent();

test('every strategy finishes runs without errors and leaves a valid state', () => {
  for (const strategy of STRATEGIES) {
    for (let i = 0; i < 3; i++) {
      const fin = autoplay(newRun({ seed: `ai-${strategy}-${i}`, keeper: 'moench' }, content), content, { strategy, seed: i + 1 });
      assert.ok(['won', 'lost'].includes(fin.mode), `${strategy} ended in ${fin.mode}`);
      assert.equal(validateRun(fin, content), null);
    }
  }
});

test('autoplay is deterministic for a given seed', () => {
  const a = autoplay(newRun({ seed: 'same', keeper: 'moench' }, content), content, { strategy: 'greedy', seed: 5 });
  const b = autoplay(newRun({ seed: 'same', keeper: 'moench' }, content), content, { strategy: 'greedy', seed: 5 });
  assert.deepEqual(a, b);
});

test('suggestThrow proposes a legal throw', () => {
  const run = newRun({ seed: 'tip', keeper: 'moench' }, content);
  const s = suggestThrow(run, content);
  assert.ok(s);
  const res = step(run, { type: 'throw', slot: s.slot, cell: s.cell }, content);
  assert.notEqual(res.events[0].type, 'invalid');
});

test('planner beats random play by a wide margin on the same seeds', () => {
  let plannerPonds = 0;
  let randomPonds = 0;
  for (let i = 0; i < 3; i++) {
    plannerPonds += autoplay(newRun({ seed: `cmp${i}`, keeper: 'moench' }, content), content, { strategy: 'planner', seed: 1 }).stats.ponds;
    randomPonds += autoplay(newRun({ seed: `cmp${i}`, keeper: 'moench' }, content), content, { strategy: 'random', seed: 1 }).stats.ponds;
  }
  assert.ok(plannerPonds > randomPonds + 6, `${plannerPonds} vs ${randomPonds}`);
});
