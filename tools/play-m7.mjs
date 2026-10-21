// Fresh profile: tutorial pond, hints, tip highlight; then daily + guard.
export default async function (page, { outDir, tag }) {
  const shot = (n) => page.screenshot({ path: `${outDir}/${tag}-${n}.png` });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__stille);
  await page.waitForTimeout(400);
  await page.click('[data-act="newRun"]');
  await page.waitForTimeout(2600);
  await shot('m7-1-tutorial');
  const tip = await page.evaluate(() => window.__stille.scene.tip);
  console.log('tip cell', tip, 'kind', await page.evaluate(() => window.__stille.run.pond.kind));
  await page.click('[data-coach="ok"]');
  // tap the tip cell twice (touch emulation not needed: use debug position)
  const pos = await page.evaluate((c) => window.__stille.cellPos(c), tip);
  await page.mouse.click(pos.x, pos.y);
  await page.waitForTimeout(500);
  await shot('m7-2-after-throw');
  await page.click('[data-coach="ok"]').catch(() => {});
  await page.waitForTimeout(300);
  await page.keyboard.press('t');
  await page.waitForTimeout(300);
  await shot('m7-3-tip');
  await page.keyboard.press('Escape');
  await page.click('[data-act="toTitle"]');
  await page.waitForTimeout(300);
  await page.click('[data-act="daily"]');
  await page.waitForTimeout(300);
  await shot('m7-4-guard');
  await page.click('[data-act="confirmNew"]');
  await page.waitForTimeout(2600);
  await shot('m7-5-daily');
  const r = await page.evaluate(() => ({ daily: window.__stille.run.daily, seed: window.__stille.run.seed, tipHidden: document.getElementById('btn-tip').hidden }));
  console.log(JSON.stringify(r));
}
