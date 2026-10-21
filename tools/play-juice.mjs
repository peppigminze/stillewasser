// Captures frames during a turn resolution to inspect juice (pillars, ink, rings).
export default async function (page, { outDir, tag }) {
  await page.evaluate(() => localStorage.setItem('stillewasser.meta.v1', JSON.stringify({ v: 1, tutorialDone: true, stats: { runs: 1 } })));
  await page.reload();
  await page.waitForFunction(() => window.__stille);
  await page.click('[data-act="newRun"]');
  await page.waitForTimeout(2400);
  for (let t = 0; t < 4; t++) {
    await page.evaluate(() => window.__stille.debugAutoTurn());
    await page.waitForTimeout(t === 3 ? 230 : 1900);
  }
  await page.screenshot({ path: `${outDir}/${tag}-juice-1.png` });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${outDir}/${tag}-juice-2.png` });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${outDir}/${tag}-juice-3.png` });
}
