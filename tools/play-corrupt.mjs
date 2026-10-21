// Boot with corrupt storage: game must start, offer no "continue", and keep working.
export default async function (page, { outDir, tag }) {
  await page.evaluate(() => {
    localStorage.setItem('stillewasser.meta.v1', '{"pearls": "viele", "unlocked": 7, "settings": null');
    localStorage.setItem('stillewasser.run.v1', '{"v":1,"run":{"mode":"pond","pond":{"enemies":"x"}}}');
  });
  await page.reload();
  await page.waitForFunction(() => window.__stille);
  await page.waitForTimeout(400);
  const hasContinue = await page.$('[data-act="continue"]');
  console.log('continue offered:', !!hasContinue);
  await page.click('[data-act="newRun"]');
  await page.waitForTimeout(600);
  const ok = await page.evaluate(() => window.__stille.run && window.__stille.run.mode);
  console.log('run started:', ok);
  await page.screenshot({ path: `${outDir}/${tag}-corrupt.png` });
}
