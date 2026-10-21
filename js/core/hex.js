// Axial hex coordinates (flat-top on screen). Cells are referenced by their index into
// grid.cells; index 0 is always the center, followed by ring 1, ring 2, ...

export const DIRS = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
];

const SQRT3 = Math.sqrt(3);
const gridCache = new Map();

export function hexDistQR(q1, r1, q2, r2) {
  const dq = q1 - q2;
  const dr = r1 - r2;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function buildGrid(radius) {
  if (gridCache.has(radius)) return gridCache.get(radius);
  const cells = [{ q: 0, r: 0, ring: 0 }];
  for (let k = 1; k <= radius; k++) {
    // walk ring k starting at direction 4 * k, then each side
    let q = DIRS[4][0] * k;
    let r = DIRS[4][1] * k;
    for (let side = 0; side < 6; side++) {
      for (let step = 0; step < k; step++) {
        cells.push({ q, r, ring: k });
        q += DIRS[side][0];
        r += DIRS[side][1];
      }
    }
  }
  const span = radius * 2 + 1;
  const lookup = new Int16Array(span * span).fill(-1);
  cells.forEach((c, i) => { lookup[(c.q + radius) * span + (c.r + radius)] = i; });
  const indexOf = (q, r) => {
    if (Math.abs(q) > radius || Math.abs(r) > radius || Math.abs(q + r) > radius) return -1;
    return lookup[(q + radius) * span + (r + radius)];
  };
  const neighbors = cells.map((c) => DIRS.map(([dq, dr]) => indexOf(c.q + dq, c.r + dr)));
  const rim = [];
  cells.forEach((c, i) => { if (c.ring === radius) rim.push(i); });
  const grid = { radius, size: cells.length, cells, neighbors, rim, center: 0, indexOf };
  gridCache.set(radius, grid);
  return grid;
}

export function cellDist(grid, a, b) {
  const A = grid.cells[a];
  const B = grid.cells[b];
  return hexDistQR(A.q, A.r, B.q, B.r);
}

// Point mirror through the center (used by the twin stone).
export function mirrorCell(grid, i) {
  const c = grid.cells[i];
  return grid.indexOf(-c.q, -c.r);
}

// Breadth-first distances from `start`, not entering blocked cells.
// Returns Int16Array, -1 = unreachable. `blocked` is a Uint8Array (1 = wall).
export function bfs(grid, start, blocked) {
  const dist = new Int16Array(grid.size).fill(-1);
  if (start < 0 || (blocked && blocked[start])) return dist;
  dist[start] = 0;
  const queue = [start];
  for (let h = 0; h < queue.length; h++) {
    const cur = queue[h];
    const nd = dist[cur] + 1;
    for (const n of grid.neighbors[cur]) {
      if (n < 0 || dist[n] !== -1 || (blocked && blocked[n])) continue;
      dist[n] = nd;
      queue.push(n);
    }
  }
  return dist;
}

// Pixel helpers (flat-top layout: the board is taller than wide, which suits
// portrait phones). Pure math, shared by renderer and input.
export function cellToPixel(grid, i, size) {
  const c = grid.cells[i];
  return { x: size * 1.5 * c.q, y: size * SQRT3 * (c.r + c.q / 2) };
}

export function pixelToCell(grid, x, y, size) {
  const qf = ((2 / 3) * x) / size;
  const rf = ((-1 / 3) * x + (SQRT3 / 3) * y) / size;
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return grid.indexOf(q, r);
}
