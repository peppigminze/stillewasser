// Syntax check for every JS module + content validation + import check of the pure core.
import { readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(m?js)$/.test(f)) files.push(p);
  }
};
for (const d of ['js', 'tests', 'sim', 'tools']) {
  try { walk(join(root, d)); } catch { /* folder may not exist yet */ }
}

let failed = 0;
for (const f of files) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (e) {
    failed++;
    console.error(`✗ ${relative(root, f)}\n${e.stderr}`);
  }
}
console.log(`Syntax: ${files.length - failed}/${files.length} ok`);

// core must import cleanly in Node (no DOM access at module level)
for (const f of files.filter((p) => p.includes(join('js', 'core')))) {
  try {
    await import(pathToFileURL(f).href);
  } catch (e) {
    failed++;
    console.error(`✗ import ${relative(root, f)}: ${e.message}`);
  }
}

const { loadContent } = await import(pathToFileURL(join(root, 'tests', 'helpers.mjs')).href);
const { validateContent } = await import(pathToFileURL(join(root, 'js', 'core', 'content.js')).href);
const errors = validateContent(loadContent());
if (errors.length) {
  failed += errors.length;
  console.error('Content-Fehler:\n- ' + errors.join('\n- '));
} else {
  console.log('Content: ok');
}
process.exit(failed ? 1 : 0);
