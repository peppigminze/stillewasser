// Balance simulation: plays thousands of runs with simple bot strategies and
// writes a Markdown report (sim/report.md). Runs in parallel worker threads.
//
//   node sim/sim.mjs [--runs=400] [--strategies=random,brute,greedy,planner]
//                    [--phase=0] [--keeper=moench] [--extra] [--out=sim/report.md]
//
// --extra adds: content study (random rewards, all content unlocked), keeper
// comparison and the moon-phase difficulty curve.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadContent } from '../tests/helpers.mjs';
import { newRun } from '../js/core/run.js';
import { autoplay } from '../js/core/ai.js';

const self = fileURLToPath(import.meta.url);

function pondKey(act, stepIdx) {
  return act * 3 + stepIdx;
}

function simulate(job) {
  const content = loadContent();
  const out = [];
  for (const i of job.indices) {
    const rec = {
      won: false, ponds: 0, endPond: -1, turnsByPond: {}, lightLostByPond: {}, killsByType: {},
      biteDmgByType: {}, throwsByStone: {}, offered: {}, picked: {}, finalStones: [], finalTalismans: [],
      chainMax: 0, lightEnd: 0, turns: 0, wisps: 0,
    };
    const pool = job.allContent ? { stones: content.stoneList.map((s) => s.id), talismans: content.talismanList.map((t) => t.id) } : {};
    const run0 = newRun({ seed: `${job.tag}-${i}`, keeper: job.keeper, phase: job.phase, ...pool }, content);
    const t0 = performance.now();
    const fin = autoplay(run0, content, {
      strategy: job.strategy, rewardPolicy: job.reward, seed: 7919 * (i + 1),
      onStep(kind, before, res, action) {
        if (kind === 'reward') {
          for (const o of before.reward.options) {
            const k = `${o.kind}:${o.id || 'heal'}`;
            rec.offered[k] = (rec.offered[k] || 0) + 1;
          }
          if (action && action.type === 'pickReward') {
            const o = before.reward.options[action.index];
            const k = `${o.kind}:${o.id || 'heal'}`;
            rec.picked[k] = (rec.picked[k] || 0) + 1;
          }
          return;
        }
        const pk = pondKey(before.act, before.step);
        rec.turnsByPond[pk] = (rec.turnsByPond[pk] || 0) + 1;
        for (const e of res.events) {
          if (e.type === 'bite' && e.dmg > 0) {
            const en = before.pond.enemies.find((x) => x.id === e.id);
            const t = en ? en.type : '?';
            rec.biteDmgByType[t] = (rec.biteDmgByType[t] || 0) + e.dmg;
            rec.lightLostByPond[pk] = (rec.lightLostByPond[pk] || 0) + e.dmg;
          }
        }
      },
    });
    rec.ms = performance.now() - t0;
    rec.won = fin.mode === 'won';
    rec.ponds = fin.stats.ponds;
    rec.endPond = rec.won ? -1 : pondKey(fin.act, fin.step);
    rec.killsByType = fin.stats.killsByType;
    rec.throwsByStone = fin.stats.byStone;
    rec.finalStones = fin.slots.map((s) => s.stone);
    rec.finalTalismans = fin.talismans.slice();
    rec.chainMax = fin.stats.chainMax;
    rec.lightEnd = fin.light;
    rec.turns = fin.stats.turns;
    rec.wisps = fin.stats.wisps;
    rec.score = fin.stats.score;
    out.push(rec);
  }
  return out;
}

if (!isMainThread) {
  parentPort.postMessage(simulate(workerData));
} else {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? true : v];
  }));
  const RUNS = Number(args.runs || 400);
  const strategies = String(args.strategies || 'random,brute,greedy,planner').split(',');
  const phase = Number(args.phase || 0);
  const keeper = String(args.keeper || 'moench');
  const outFile = String(args.out || 'sim/report.md');
  const threads = Math.max(1, Math.min(availableParallelism(), 8));
  const content = loadContent();

  async function batch(job, runs) {
    const per = Math.ceil(runs / threads);
    const parts = [];
    for (let t = 0; t < threads; t++) {
      const indices = [];
      for (let i = t * per; i < Math.min(runs, (t + 1) * per); i++) indices.push(i);
      if (!indices.length) continue;
      parts.push(new Promise((resolve, reject) => {
        const w = new Worker(self, { workerData: { ...job, indices } });
        w.on('message', resolve);
        w.on('error', reject);
      }));
    }
    return (await Promise.all(parts)).flat();
  }

  const pondNames = [];
  content.acts.forEach((a, ai) => a.ponds.forEach((p, pi) => { pondNames[pondKey(ai, pi)] = `${a.sub.replace('Akt ', 'A')}-${p.kind === 'boss' ? 'Boss' : pi + 1}`; }));
  const pct = (x) => `${(100 * x).toFixed(1)} %`;
  const avg = (arr, f) => (arr.length ? arr.reduce((s, r) => s + f(r), 0) / arr.length : 0);
  const lines = [];
  const say = (s = '') => { lines.push(s); };

  const t0 = Date.now();
  const results = {};
  for (const strategy of strategies) {
    results[strategy] = await batch({ tag: `s-${strategy}`, strategy, reward: 'value', phase, keeper }, RUNS);
    const r = results[strategy];
    console.log(`${strategy.padEnd(8)} win ${pct(avg(r, (x) => x.won))}  ponds ${avg(r, (x) => x.ponds).toFixed(2)}  ${avg(r, (x) => x.ms).toFixed(0)} ms/run`);
  }

  say(`# Balance-Report`);
  say();
  say(`Erzeugt von \`sim/sim.mjs\` · ${RUNS} Läufe je Strategie · Hüter \`${keeper}\` · Mondphase ${phase} · Gaben-Wahl: Wertheuristik`);
  say();
  say('Strategien: **random** = zufällige Würfe · **brute** = „Zange“ um das nächste Feld des dringendsten Schattens · '
    + '**greedy** = bester Einzelwurf mit 1 Zug Vorschau · **planner** = Wurfpaare mit 3 Zügen Vorschau (stärkster Bot).');
  say();
  say('| Strategie | Siegquote | Ø Teiche | Ø Licht am Ende (Siege) | Ø Züge | Ø Kills | Ø längste Kette | Ø Irrlichter | ms/Lauf |');
  say('|---|---|---|---|---|---|---|---|---|');
  for (const s of strategies) {
    const r = results[s];
    const wins = r.filter((x) => x.won);
    say(`| ${s} | ${pct(avg(r, (x) => x.won))} | ${avg(r, (x) => x.ponds).toFixed(2)} | ${wins.length ? avg(wins, (x) => x.lightEnd).toFixed(1) : '–'} | ${avg(r, (x) => x.turns).toFixed(0)} | ${avg(r, (x) => Object.values(x.killsByType).reduce((a, b) => a + b, 0)).toFixed(1)} | ${avg(r, (x) => x.chainMax).toFixed(2)} | ${avg(r, (x) => x.wisps).toFixed(2)} | ${avg(r, (x) => x.ms).toFixed(0)} |`);
  }
  say();
  say('## Schwierigkeitskurve');
  say();
  say('Pro Teich: erreicht = Anteil der Läufe, die den Teich betreten · Tod hier = Anteil der Ankömmlinge, die hier sterben · Licht −/Teich = Ø verlorenes Licht · Züge = Ø Züge im Teich.');
  say();
  say(`| Teich | ${strategies.map((s) => `${s}: erreicht / Tod hier / Licht − / Züge`).join(' | ')} |`);
  say(`|---|${strategies.map(() => '---').join('|')}|`);
  for (let k = 0; k < pondNames.length; k++) {
    const cells = strategies.map((s) => {
      const r = results[s];
      const reached = r.filter((x) => x.won || x.endPond >= k || x.ponds > k);
      const died = r.filter((x) => x.endPond === k);
      const lost = avg(reached, (x) => x.lightLostByPond[k] || 0);
      const turns = avg(reached, (x) => x.turnsByPond[k] || 0);
      return `${pct(reached.length / r.length)} / ${reached.length ? pct(died.length / reached.length) : '–'} / ${lost.toFixed(2)} / ${turns.toFixed(1)}`;
    });
    say(`| ${pondNames[k]} | ${cells.join(' | ')} |`);
  }

  const study = async (title, runs) => {
    say();
    say(`## ${title}`);
    say();
    return runs;
  };

  // content usage with the planner (value rewards) + random rewards (unbiased holding stats)
  const pl = results.planner || results[strategies[strategies.length - 1]];
  let contentRuns = pl;
  if (args.extra) contentRuns = await batch({ tag: 's-content', strategy: 'planner', reward: 'random', phase, keeper, allContent: true }, RUNS);
  await study(`Nutzung der Inhalte (planner, ${args.extra ? 'zufällige Gaben-Wahl, alle Inhalte freigeschaltet' : 'heuristische Gaben-Wahl'})`);
  const allThrows = {};
  for (const r of contentRuns) for (const [k, v] of Object.entries(r.throwsByStone)) allThrows[k] = (allThrows[k] || 0) + v;
  const totalThrows = Object.values(allThrows).reduce((a, b) => a + b, 0) || 1;
  say('| Stein | Anteil Würfe | gewählt wenn angeboten | Siegquote mit Stein im Beutel | ohne |');
  say('|---|---|---|---|---|');
  for (const st of content.stoneList) {
    const k = `stone:${st.id}`;
    const off = contentRuns.reduce((s, r) => s + (r.offered[k] || 0), 0);
    const pick = contentRuns.reduce((s, r) => s + (r.picked[k] || 0), 0);
    const withS = contentRuns.filter((r) => r.finalStones.includes(st.id));
    const without = contentRuns.filter((r) => !r.finalStones.includes(st.id));
    say(`| ${st.name} | ${pct((allThrows[st.id] || 0) / totalThrows)} | ${off ? pct(pick / off) : '–'} | ${withS.length ? `${pct(avg(withS, (x) => x.won))} (n=${withS.length})` : '–'} | ${without.length ? pct(avg(without, (x) => x.won)) : '–'} |`);
  }
  say();
  say('| Talisman | gewählt wenn angeboten | Siegquote mit | ohne |');
  say('|---|---|---|---|');
  for (const t of content.talismanList) {
    const k = `talisman:${t.id}`;
    const off = contentRuns.reduce((s, r) => s + (r.offered[k] || 0), 0);
    const pick = contentRuns.reduce((s, r) => s + (r.picked[k] || 0), 0);
    const withT = contentRuns.filter((r) => r.finalTalismans.includes(t.id));
    const without = contentRuns.filter((r) => !r.finalTalismans.includes(t.id));
    say(`| ${t.name} | ${off ? pct(pick / off) : '–'} | ${withT.length ? `${pct(avg(withT, (x) => x.won))} (n=${withT.length})` : '–'} | ${without.length ? pct(avg(without, (x) => x.won)) : '–'} |`);
  }
  say();
  say('| Kreatur | Ø besiegt / Lauf | Ø Licht-Schaden / Lauf |');
  say('|---|---|---|');
  for (const e of content.enemyList) {
    say(`| ${e.name} | ${avg(pl, (x) => x.killsByType[e.id] || 0).toFixed(2)} | ${avg(pl, (x) => x.biteDmgByType[e.id] || 0).toFixed(2)} |`);
  }

  if (args.extra) {
    await study('Hüter (planner)');
    say('| Hüter | Siegquote | Ø Teiche |');
    say('|---|---|---|');
    for (const k of content.keeperList) {
      const r = await batch({ tag: `k-${k.id}`, strategy: 'planner', reward: 'value', phase, keeper: k.id }, Math.ceil(RUNS / 2));
      say(`| ${k.name} | ${pct(avg(r, (x) => x.won))} | ${avg(r, (x) => x.ponds).toFixed(2)} |`);
    }
    await study('Mondphasen (planner / greedy)');
    say('| Phase | planner Siegquote | greedy Siegquote |');
    say('|---|---|---|');
    for (const ph of content.phases) {
      const rp = await batch({ tag: `p-${ph.id}`, strategy: 'planner', reward: 'value', phase: ph.id, keeper }, Math.ceil(RUNS / 2));
      const rg = await batch({ tag: `pg-${ph.id}`, strategy: 'greedy', reward: 'value', phase: ph.id, keeper }, Math.ceil(RUNS / 2));
      say(`| ${ph.id} ${ph.name} | ${pct(avg(rp, (x) => x.won))} | ${pct(avg(rg, (x) => x.won))} |`);
    }
  }
  say();
  say(`_Laufzeit: ${((Date.now() - t0) / 1000).toFixed(1)} s auf ${threads} Threads._`);
  writeFileSync(outFile, lines.join('\n') + '\n');
  console.log(`Report: ${outFile} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
