// Plays a whole run through the UI with the planner (tip) and reports the outcome.
export default async function (page, { outDir, tag }) {
  await page.evaluate(() => localStorage.setItem('stillewasser.meta.v1', JSON.stringify({ v: 1, tutorialDone: true, stats: { runs: 1 }, settings: { tips: false, fast: true } })));
  await page.reload();
  await page.waitForFunction(() => window.__stille);
  await page.click('[data-act="newRun"]');
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__stille.setSpeed(6));
  let turns = 0;
  let rewards = 0;
  let shots = 0;
  for (let guard = 0; guard < 600; guard++) {
    const st = await page.evaluate(() => ({ stack: window.__stille.stack, mode: window.__stille.run && window.__stille.run.mode, act: window.__stille.run && window.__stille.run.act }));
    const top = st.stack[st.stack.length - 1];
    if (top === 'runEnd') break;
    if (top === 'reward') {
      rewards++;
      await page.click('[data-act="pick"][data-arg="0"]');
      await page.waitForTimeout(150);
      const s2 = await page.evaluate(() => window.__stille.stack);
      if (s2.includes('replace')) await page.click('[data-act="replace"][data-arg="0"]');
      await page.evaluate(() => window.__stille.setSpeed(6));
      await page.waitForTimeout(300);
      continue;
    }
    const played = await page.evaluate(() => window.__stille.debugPlanTurn());
    if (played) {
      turns++;
      if (turns % 25 === 0 && shots < 4) await page.screenshot({ path: `${outDir}/${tag}-full-${shots++}.png` });
    }
    await page.waitForTimeout(played ? 420 : 200);
  }
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${outDir}/${tag}-full-end.png` });
  const res = await page.evaluate(() => ({ mode: window.__stille.run.mode, ponds: window.__stille.run.stats.ponds, light: window.__stille.run.light, meta: JSON.parse(localStorage.getItem('stillewasser.meta.v1')) }));
  console.log('turns', turns, 'rewards', rewards, 'result', res.mode, 'ponds', res.ponds, 'light', res.light, 'pearls', res.meta.pearls, 'maxPhase', res.meta.maxPhase);
}
