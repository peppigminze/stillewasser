// Smoke script: win a pond, take a reward, reload and continue.
export default async function (page, { outDir, tag }) {
  const shot = (n) => page.screenshot({ path: `${outDir}/${tag}-${n}.png` });
  await page.click('[data-act="newRun"]');
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__stille.debugWinPond());
  await page.waitForTimeout(1600);
  await shot('m3-1-reward');
  await page.click('[data-act="pick"][data-arg="0"]');
  await page.waitForTimeout(600);
  const st = await page.evaluate(() => window.__stille.stack);
  if (st.includes('replace')) await page.click('[data-act="replace"][data-arg="0"]');
  await page.waitForTimeout(2500);
  await shot('m3-2-pond2');
  await page.evaluate(() => window.__stille.debugWinPond());
  await page.waitForTimeout(1600);
  await page.click('[data-act="skip"]');
  await page.waitForTimeout(2500);
  await shot('m3-3-boss');
  await page.reload();
  await page.waitForFunction(() => window.__stille);
  await page.waitForTimeout(600);
  await shot('m3-4-title-continue');
  await page.click('[data-act="continue"]');
  await page.waitForTimeout(800);
  const run = await page.evaluate(() => ({ act: window.__stille.run.act, step: window.__stille.run.step, kind: window.__stille.run.pond.kind }));
  console.log('continued at', JSON.stringify(run));
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => window.__stille.debugWinPond());
    await page.waitForTimeout(1600);
    await page.click('[data-act="pick"][data-arg="1"]');
    await page.waitForTimeout(400);
    const s2 = await page.evaluate(() => window.__stille.stack);
    if (s2.includes('replace')) await page.click('[data-act="replace"][data-arg="2"]');
    await page.waitForTimeout(2600);
  }
  await shot('m3-5-act2');
}
