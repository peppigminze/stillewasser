// Run state machine: acts → ponds → rewards → victory/defeat.
// Public API: newRun(opts, content) and step(run, action, content) -> { run, events }.

import { hashSeed, randInt, shuffle } from './rng.js';
import { getMods } from './mods.js';
import { createPond, throwError, applyThrow, applyUndo, resolveTurn } from './pond.js';

export const RUN_VERSION = 1;

export function emptyStats() {
  return {
    kills: 0, killsByType: {}, ponds: 0, bosses: 0, turns: 0, throws: 0, byStone: {},
    chainMax: 0, surges: 0, bites: 0, lightLost: 0, wisps: 0, score: 0,
  };
}

export function newRun(opts, content) {
  const keeper = content.keepers[opts.keeper] || content.keeperList[0];
  const seed = String(opts.seed ?? 'stille');
  const d = {
    v: RUN_VERSION,
    seed,
    rng: hashSeed(seed),
    uid: 1,
    mode: 'pond',
    keeper: keeper.id,
    phase: opts.phase || 0,
    daily: !!opts.daily,
    tutorial: !!opts.tutorial,
    act: 0,
    step: 0,
    light: 0,
    maxLight: 0,
    slots: keeper.stones.map((s) => ({ stone: s, cd: 0 })),
    talismans: keeper.talismans.slice(),
    pool: {
      stones: (opts.stones || content.stoneList.filter((s) => !s.unlock).map((s) => s.id)).slice(),
      talismans: (opts.talismans || content.talismanList.filter((t) => !t.unlock).map((t) => t.id)).slice(),
    },
    pond: null,
    reward: null,
    stats: emptyStats(),
    result: null,
  };
  const mods = getMods(d, content);
  d.maxLight = Math.max(1, keeper.light + mods.maxLight);
  d.light = Math.max(1, d.maxLight + (mods.startLight || 0));
  createPond(d, 0, 0, content);
  return d;
}

export function currentPondTemplate(run, content) {
  if (run.tutorial && run.act === 0 && run.step === 0) return content.tutorial;
  return content.acts[run.act].ponds[run.step];
}

export function isLastPond(run, content) {
  return run.act === content.acts.length - 1 && run.step === content.acts[run.act].ponds.length - 1;
}

// ----------------------------------------------------------------- rewards

function rewardOptions(d, content) {
  const mods = getMods(d, content);
  const count = Math.max(1, content.rules.rewardChoices + (mods.rewardChoices || 0));
  const boss = d.pond && d.pond.kind === 'boss';
  const stones = shuffle(d, d.pool.stones.filter((id) => id !== 'kiesel'))
    .map((id) => ({ kind: 'stone', id }));
  const owned = new Set(d.talismans);
  const talis = shuffle(d, d.pool.talismans.filter((id) => !owned.has(id)))
    .map((id) => ({ kind: 'talisman', id }));
  const opts = [];
  // structure: boss → talisman-heavy; otherwise at least one of each when possible
  const wantT = boss ? Math.ceil(count * 0.67) : Math.ceil(count / 3);
  while (opts.length < wantT && talis.length) opts.push(talis.shift());
  if (stones.length && opts.length < count) opts.push(stones.shift());
  const missing = d.maxLight - d.light;
  if (!boss && missing >= 2 && opts.length < count && randInt(d, 100) < 30 + missing * 10) {
    opts.push({ kind: 'heal', amount: content.rules.healAmount });
  }
  const rest = shuffle(d, stones.concat(talis));
  while (opts.length < count && rest.length) opts.push(rest.shift());
  while (opts.length < count) opts.push({ kind: 'heal', amount: content.rules.healAmount });
  return shuffle(d, opts);
}

function finishPond(d, content, ev) {
  const pond = d.pond;
  const mods = getMods(d, content);
  const rules = content.rules;
  d.stats.ponds += 1;
  d.stats.score += rules.score.pond;
  if (pond.kind === 'boss') {
    d.stats.bosses += 1;
    d.stats.score += rules.score.boss;
  }
  ev.push({ type: 'pondWon', act: pond.act, step: pond.step, kind: pond.kind });
  const before = d.light;
  let healAmt = mods.healPerPond || 0;
  if (pond.kind === 'boss') healAmt += rules.bossHeal;
  d.light = Math.min(d.maxLight, d.light + healAmt);
  if (d.light > before) ev.push({ type: 'heal', amount: d.light - before, light: d.light, reason: 'pond' });
  if (isLastPond(d, content)) {
    d.mode = 'won';
    d.stats.score += rules.score.win + d.light * rules.score.lightLeft;
    d.result = { won: true, act: d.act, step: d.step };
    ev.push({ type: 'runWon' });
    return;
  }
  d.mode = 'reward';
  d.reward = { options: rewardOptions(d, content) };
  ev.push({ type: 'reward', options: d.reward.options });
}

function loseRun(d, ev, reason) {
  d.mode = 'lost';
  d.result = { won: false, act: d.act, step: d.step, reason };
  ev.push({ type: 'runLost', reason });
}

function advance(d, content, ev) {
  d.reward = null;
  d.step += 1;
  if (d.step >= content.acts[d.act].ponds.length) {
    d.act += 1;
    d.step = 0;
    ev.push({ type: 'actStart', act: d.act });
  }
  d.mode = 'pond';
  createPond(d, d.act, d.step, content);
  ev.push({ type: 'pondStart', act: d.act, step: d.step, kind: d.pond.kind });
}

function applyReward(d, opt, replace, content) {
  if (opt.kind === 'heal') {
    d.light = Math.min(d.maxLight, d.light + opt.amount);
    return null;
  }
  if (opt.kind === 'talisman') {
    if (d.talismans.includes(opt.id)) return 'Talisman schon vorhanden.';
    const before = getMods(d, content);
    d.talismans.push(opt.id);
    const after = getMods(d, content);
    const deltaMax = after.maxLight - before.maxLight;
    if (deltaMax) {
      d.maxLight = Math.max(1, d.maxLight + deltaMax);
      d.light = Math.max(1, Math.min(d.maxLight, d.light + Math.max(0, deltaMax)));
    }
    return null;
  }
  if (opt.kind === 'stone') {
    if (d.slots.length < content.rules.maxSlots) {
      d.slots.push({ stone: opt.id, cd: 0 });
      return null;
    }
    if (!(replace >= 0 && replace < d.slots.length)) return 'replace';
    d.slots[replace] = { stone: opt.id, cd: 0 };
    return null;
  }
  return 'Unbekannte Gabe.';
}

// -------------------------------------------------------------------- step

export function step(run, action, content) {
  const d = structuredClone(run);
  const ev = [];
  const invalid = (reason) => ({ run, events: [{ type: 'invalid', reason }] });

  switch (action.type) {
    case 'throw': {
      const err = throwError(d, action.slot, action.cell, content);
      if (err) return invalid(err);
      applyThrow(d, action.slot, action.cell, content, ev);
      break;
    }
    case 'undo': {
      if (d.mode !== 'pond' || !d.pond || !applyUndo(d, ev)) return invalid('Nichts rückgängig zu machen.');
      break;
    }
    case 'endTurn': {
      if (d.mode !== 'pond' || d.pond.status !== 'playing') return invalid('Gerade nicht möglich.');
      resolveTurn(d, content, ev);
      if (d.pond.status === 'won') finishPond(d, content, ev);
      else if (d.pond.status === 'lost') loseRun(d, ev, d.light <= 0 ? 'light' : 'dawn');
      break;
    }
    case 'pickReward': {
      if (d.mode !== 'reward' || !d.reward) return invalid('Keine Gabe offen.');
      const opt = d.reward.options[action.index];
      if (!opt) return invalid('Ungültige Gabe.');
      const err = applyReward(d, opt, action.replace, content);
      if (err) return invalid(err);
      ev.push({ type: 'rewardTaken', option: opt, replace: action.replace });
      advance(d, content, ev);
      break;
    }
    case 'skipReward': {
      if (d.mode !== 'reward') return invalid('Keine Gabe offen.');
      ev.push({ type: 'rewardSkipped' });
      advance(d, content, ev);
      break;
    }
    case 'abandon': {
      if (d.mode !== 'pond' && d.mode !== 'reward') return invalid('Lauf ist schon vorbei.');
      loseRun(d, ev, 'abandon');
      break;
    }
    default:
      return invalid('Unbekannte Aktion.');
  }
  return { run: d, events: ev };
}
