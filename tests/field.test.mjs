import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGrid } from '../js/core/hex.js';
import { waterFor, fieldAt, surgesOf, surgeDamage, ringAt } from '../js/core/field.js';

const rp = (origin, born, profile, gen = 0) => ({ id: origin * 100 + born, origin, born, profile, owner: 'player', gen });

test('single ripple: ring of radius r carries the profile amplitude, no surge', () => {
  const w = waterFor(5, []);
  const f = fieldAt(w, [rp(0, 0, [1, 1, 1, 1])], 2);
  const ring = ringAt(w, 0, 2);
  assert.equal(ring.length, 12);
  for (const c of ring) assert.equal(f.amp[c], 1);
  assert.equal(surgesOf(f).length, 0);
});

test('two ripples meet in the middle and surge', () => {
  const g = buildGrid(5);
  const w = waterFor(5, []);
  const a = g.indexOf(-2, 0);
  const b = g.indexOf(2, 0);
  const f = fieldAt(w, [rp(a, 0, [1, 1, 1, 1]), rp(b, 0, [1, 1, 1, 1])], 2);
  const s = surgesOf(f);
  assert.ok(s.some((x) => x.cell === 0 && x.amp === 2));
});

test('opposite amplitudes cancel, two dark make a Sog', () => {
  const g = buildGrid(5);
  const w = waterFor(5, []);
  const a = g.indexOf(-2, 0);
  const b = g.indexOf(2, 0);
  const cancel = fieldAt(w, [rp(a, 0, [1, 1, 1]), rp(b, 0, [-1, -1, -1])], 2);
  assert.equal(cancel.amp[0], 0);
  const sog = fieldAt(w, [rp(a, 0, [-1, -1, -1]), rp(b, 0, [-1, -1, -1])], 2);
  assert.equal(sog.amp[0], -2);
  assert.equal(surgesOf(sog)[0].amp, -2);
});

test('rocks delay ripples (BFS shadow)', () => {
  const g = buildGrid(5);
  const rock = g.indexOf(1, 0);
  const w = waterFor(5, [rock]);
  const target = g.indexOf(2, 0);
  const f2 = fieldAt(w, [rp(0, 0, [1, 1, 1, 1])], 2);
  assert.equal(f2.amp[target], 0);
  const f3 = fieldAt(w, [rp(0, 0, [1, 1, 1, 1])], 3);
  assert.equal(f3.amp[target], 1);
});

test('ripples born in the future or expired contribute nothing', () => {
  const w = waterFor(5, []);
  const f = fieldAt(w, [rp(0, 5, [1, 1]), rp(0, 0, [1, 1])], 3);
  assert.ok(f.amp.every((x) => x === 0));
});

test('gen tracks the highest contributing generation', () => {
  const g = buildGrid(5);
  const w = waterFor(5, []);
  const a = g.indexOf(-1, 0);
  const b = g.indexOf(1, 0);
  const f = fieldAt(w, [rp(a, 0, [1, 1], 0), rp(b, 0, [1, 1], 2)], 1);
  assert.equal(f.gen[0], 2);
});

test('surge damage: |A|-1, armor, bonuses', () => {
  const none = { bigSurgeBonus: 0, sogBonus: 0 };
  assert.equal(surgeDamage(1, 0, none), 0);
  assert.equal(surgeDamage(2, 0, none), 1);
  assert.equal(surgeDamage(-3, 0, none), 2);
  assert.equal(surgeDamage(2, 1, none), 0);
  assert.equal(surgeDamage(3, 1, none), 1);
  assert.equal(surgeDamage(3, 0, { bigSurgeBonus: 1, sogBonus: 0 }), 3);
  assert.equal(surgeDamage(-2, 0, { bigSurgeBonus: 0, sogBonus: 1 }), 2);
});
