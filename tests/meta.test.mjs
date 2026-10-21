import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContent } from './helpers.mjs';
import { newRun, step } from '../js/core/run.js';
import {
  defaultMeta, sanitizeMeta, poolFor, buy, applyRunEnd, pearlsForRun, markSeen, isUnlocked, affordable, defaultPool,
} from '../js/core/meta.js';

const content = loadContent();

test('sanitizeMeta survives garbage and keeps valid data', () => {
  for (const junk of [null, undefined, 42, 'x', [], { __corrupt: true }, { pearls: 'lots', unlocked: 5 }]) {
    const m = sanitizeMeta(junk, content);
    assert.deepEqual(m, defaultMeta());
  }
  const m = sanitizeMeta({
    pearls: 33.7, maxPhase: 99, unlocked: { stones: ['echostein', 'nope', 'echostein'], talismans: [1, 'geduld'] },
    settings: { sfx: 'yes', volume: 5, reduced: true }, stats: { runs: -4, wins: 2, winsByKeeper: { moench: 2, ghost: 9 } },
    seen: { enemies: ['tintling', 'dragon'] }, lastKeeper: 'ghost',
  }, content);
  assert.equal(m.pearls, 33);
  assert.equal(m.maxPhase, content.phases.length - 1);
  assert.deepEqual(m.unlocked.stones, ['echostein']);
  assert.deepEqual(m.unlocked.talismans, ['geduld']);
  assert.equal(m.settings.sfx, true);
  assert.equal(m.settings.volume, 1);
  assert.equal(m.settings.reduced, true);
  assert.equal(m.stats.runs, 0);
  assert.deepEqual(m.stats.winsByKeeper, { moench: 2 });
  assert.deepEqual(m.seen.enemies, ['tintling']);
  assert.equal(m.lastKeeper, 'moench');
});

test('pool contains free content plus unlocks; buying costs pearls', () => {
  let meta = defaultMeta();
  assert.deepEqual(poolFor(meta, content), defaultPool(content));
  assert.ok(!poolFor(meta, content).stones.includes('echostein'));
  assert.equal(buy(meta, 'stone', 'echostein', content).error, 'Nicht genug Perlen.');
  meta.pearls = 100;
  const res = buy(meta, 'stone', 'echostein', content);
  assert.equal(res.error, null);
  assert.equal(res.meta.pearls, 100 - content.stones.echostein.unlock);
  assert.ok(poolFor(res.meta, content).stones.includes('echostein'));
  assert.equal(buy(res.meta, 'stone', 'echostein', content).error, 'Schon freigeschaltet.');
  assert.ok(isUnlocked(meta, 'keeper', 'moench', content));
  assert.ok(!isUnlocked(meta, 'keeper', 'fischerin', content));
  assert.ok(affordable(meta, content).length > 0);
});

test('run end books pearls, stats and unlocks the next moon phase on a win', () => {
  let run = newRun({ seed: 'meta', keeper: 'moench' }, content);
  run = step(run, { type: 'abandon' }, content).run;
  let { meta, pearls, newPhase } = applyRunEnd(defaultMeta(), run, content);
  assert.equal(meta.stats.runs, 1);
  assert.equal(pearls, 0);
  assert.equal(newPhase, null);
  const won = structuredClone(run);
  won.mode = 'won';
  won.stats.ponds = 9;
  won.stats.bosses = 3;
  won.stats.kills = 80;
  const p = content.rules.pearls;
  assert.equal(pearlsForRun(won, content), 9 * p.perPond + 3 * p.perBoss + Math.floor(80 / p.killsPerPearl) + p.win);
  ({ meta, newPhase } = applyRunEnd(meta, won, content));
  assert.equal(meta.maxPhase, 1);
  assert.equal(newPhase.id, 1);
  assert.equal(meta.stats.wins, 1);
  assert.equal(meta.stats.winsByKeeper.moench, 1);
});

test('daily runs track the best score per date and do not unlock phases', () => {
  let run = newRun({ seed: 'daily-2026-10-21', keeper: 'moench', daily: true }, content);
  run.mode = 'won';
  run.stats.score = 500;
  let { meta, dailyBest } = applyRunEnd(defaultMeta(), run, content);
  assert.equal(meta.daily.date, '2026-10-21');
  assert.equal(meta.daily.best, 500);
  assert.ok(dailyBest);
  assert.equal(meta.maxPhase, 0);
  run.stats.score = 300;
  ({ meta, dailyBest } = applyRunEnd(meta, run, content));
  assert.equal(meta.daily.best, 500);
  assert.equal(meta.daily.played, 2);
  assert.ok(!dailyBest);
});

test('markSeen is idempotent', () => {
  const m1 = markSeen(defaultMeta(), 'enemies', ['tintling', 'unke']);
  const m2 = markSeen(m1, 'enemies', ['tintling']);
  assert.equal(m2, m1);
  assert.deepEqual(m2.seen.enemies, ['tintling', 'unke']);
});
