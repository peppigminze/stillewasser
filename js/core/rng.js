// Seeded PRNG (mulberry32). The generator state is a uint32 stored on a plain
// object as `obj.rng`, so it serializes with the game state and stays pure.

export function hashSeed(input) {
  // xmur3-style string hash -> uint32
  const str = String(input);
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

// Returns a float in [0, 1) and advances obj.rng.
export function rand(obj) {
  let t = (obj.rng = (obj.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(obj, n) {
  return Math.floor(rand(obj) * n);
}

export function pick(obj, arr) {
  return arr[randInt(obj, arr.length)];
}

export function shuffle(obj, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(obj, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// items: array, weightOf: item -> number >= 0
export function weightedPick(obj, items, weightOf) {
  let total = 0;
  for (const it of items) total += Math.max(0, weightOf(it));
  if (total <= 0) return items[randInt(obj, items.length)];
  let roll = rand(obj) * total;
  for (const it of items) {
    roll -= Math.max(0, weightOf(it));
    if (roll < 0) return it;
  }
  return items[items.length - 1];
}
