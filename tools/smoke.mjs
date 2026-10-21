// Headless smoke test: serves the repo, loads the game in Chromium, plays a few
// actions via the debug handle and stores screenshots in tools/screens/.
// Usage: node tools/smoke.mjs [--mobile] [--steps=N]
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  const globalRoot = execSync('npm root -g').toString().trim();
  ({ chromium } = require(join(globalRoot, 'playwright')));
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = join(root, url === '/' ? 'index.html' : url);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const args = process.argv.slice(2);
const mobile = args.includes('--mobile');
const steps = Number((args.find((a) => a.startsWith('--steps=')) || '--steps=3').split('=')[1]);
const script = (args.find((a) => a.startsWith('--script=')) || '').split('=')[1];

const outDir = join(root, 'tools', 'screens');
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const vp = (args.find((a) => a.startsWith('--viewport=')) || '').split('=')[1];
const [vw, vh] = vp ? vp.split('x').map(Number) : mobile ? [390, 844] : [1280, 800];
const page = await browser.newPage(mobile || vp ? { viewport: { width: vw, height: vh }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: vw, height: vh } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
const t0 = Date.now();
await page.goto(`http://localhost:${port}/`);
await page.waitForFunction(() => window.__stille, null, { timeout: 10000 }).catch(async () => { console.log('LOAD FAILED', errors); await browser.close(); server.close(); process.exit(1); });
const loadMs = Date.now() - t0;
await page.waitForTimeout(900);
const tag = vp ? `v${vw}x${vh}` : mobile ? 'm' : 'd';
await page.screenshot({ path: join(outDir, `${tag}-0-title.png`) });

if (script) {
  const mod = await import(join(root, script));
  await mod.default(page, { outDir, tag, port });
} else {
  await page.evaluate(() => window.__stille.startRun());
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(outDir, `${tag}-1-pond.png`) });
  for (let s = 0; s < steps; s++) {
    await page.evaluate(() => window.__stille.debugAutoTurn && window.__stille.debugAutoTurn());
    await page.waitForTimeout(2200);
    await page.screenshot({ path: join(outDir, `${tag}-${2 + s}-turn.png`) });
  }
}
console.log(JSON.stringify({ loadMs, errors }, null, 2));
await browser.close();
server.close();
process.exit(errors.some((e) => e.startsWith('pageerror')) ? 1 : 0);
