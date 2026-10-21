import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGrid, cellDist, bfs, mirrorCell, cellToPixel, pixelToCell } from '../js/core/hex.js';

test('grid of radius 5 has 91 cells, center first, rings ordered', () => {
  const g = buildGrid(5);
  assert.equal(g.size, 91);
  assert.deepEqual(g.cells[0], { q: 0, r: 0, ring: 0 });
  for (let i = 1; i < g.size; i++) assert.ok(g.cells[i].ring >= g.cells[i - 1].ring);
  assert.equal(g.rim.length, 30);
});

test('neighbors are symmetric and at distance 1', () => {
  const g = buildGrid(4);
  for (let i = 0; i < g.size; i++) {
    for (const n of g.neighbors[i]) {
      if (n < 0) continue;
      assert.equal(cellDist(g, i, n), 1);
      assert.ok(g.neighbors[n].includes(i));
    }
  }
});

test('bfs equals hex distance without walls and routes around walls', () => {
  const g = buildGrid(5);
  const d = bfs(g, 0, null);
  for (let i = 0; i < g.size; i++) assert.equal(d[i], g.cells[i].ring);
  const blocked = new Uint8Array(g.size);
  const wall = g.indexOf(1, 0);
  blocked[wall] = 1;
  const d2 = bfs(g, 0, blocked);
  assert.equal(d2[wall], -1);
  assert.equal(d2[g.indexOf(2, 0)], 3); // detour around the rock
});

test('mirror goes through the center', () => {
  const g = buildGrid(5);
  const a = g.indexOf(2, -1);
  assert.deepEqual(g.cells[mirrorCell(g, a)], { q: -2, r: 1, ring: 2 });
});

test('pixel round trip', () => {
  const g = buildGrid(5);
  for (let i = 0; i < g.size; i++) {
    const p = cellToPixel(g, i, 20);
    assert.equal(pixelToCell(g, p.x + 3, p.y - 2, 20), i);
  }
  assert.equal(pixelToCell(g, 10000, 0, 20), -1);
});
