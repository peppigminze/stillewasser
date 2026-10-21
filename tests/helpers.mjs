import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildContent, CONTENT_FILES } from '../js/core/content.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function loadRaw() {
  const raw = {};
  for (const f of CONTENT_FILES) {
    try {
      raw[f] = JSON.parse(readFileSync(join(root, 'data', f + '.json'), 'utf8'));
    } catch (e) {
      if (f === 'hints') raw[f] = {};
      else throw e;
    }
  }
  return raw;
}

export function loadContent() {
  return buildContent(loadRaw());
}

// Content with a hand-made act for focused rule tests.
export function testContent(overrides = {}) {
  const raw = loadRaw();
  raw.acts = {
    tutorial: raw.acts.tutorial,
    acts: [
      {
        id: 'test', name: 'Test', sub: 'Test', palette: 'spring',
        ponds: [{ kind: 'normal', budget: 0, pool: {}, rocks: [0, 0], initial: 0, group: [1, 1], interval: [1, 1], wisps: 0 }],
      },
    ],
  };
  Object.assign(raw, overrides);
  return buildContent(raw);
}
