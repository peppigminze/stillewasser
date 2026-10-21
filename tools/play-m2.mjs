// Smoke script: plays several turns via keyboard + undo, takes screenshots.
export default async function (page, { outDir, tag }) {
  const shot = (n) => page.screenshot({ path: `${outDir}/${tag}-${n}.png` });
  await page.click('[data-act="newRun"]');
  await page.waitForTimeout(2600);
  await shot('m2-1-start');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(200);
  await shot('m2-2-cursor');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await page.keyboard.press('z');
  await page.waitForTimeout(200);
  await shot('m2-3-undo');
  for (let i = 0; i < 12; i++) {
    const state = await page.evaluate(() => ({ mode: window.__stille.run && window.__stille.run.mode, stack: window.__stille.stack }));
    if (state.stack.length) break;
    await page.evaluate(() => window.__stille.debugAutoTurn());
    await page.waitForTimeout(1900);
  }
  await shot('m2-4-later');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await shot('m2-5-menu');
}
