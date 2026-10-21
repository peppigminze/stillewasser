// Layout check: pond with HUD, info panel, reward screen.
export default async function (page, { outDir, tag }) {
  await page.evaluate(() => localStorage.setItem('stillewasser.meta.v1', JSON.stringify({ v: 1, tutorialDone: true, stats: { runs: 1 }, settings: { tips: false } })));
  await page.reload();
  await page.waitForFunction(() => window.__stille);
  await page.click('[data-act="newRun"]');
  await page.waitForTimeout(2500);
  const e = await page.evaluate(() => window.__stille.run.pond.enemies[0].cell);
  const pos = await page.evaluate((c) => window.__stille.cellPos(c), e);
  await page.mouse.click(pos.x, pos.y);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/${tag}-layout-1.png` });
  await page.evaluate(() => window.__stille.debugWinPond());
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${outDir}/${tag}-layout-2.png` });
}
