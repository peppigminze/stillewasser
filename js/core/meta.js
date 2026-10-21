// Meta progression (persists across runs): pearls, unlocks, moon phases,
// statistics, codex, settings. Pure functions; storage lives in ui/storage.js.

export const META_VERSION = 1;

export const DEFAULT_SETTINGS = {
  sfx: true, ambient: true, volume: 0.7, reduced: false, fast: false, vibrate: true, tips: true,
};

export function defaultMeta() {
  return {
    v: META_VERSION,
    pearls: 0,
    unlocked: { stones: [], talismans: [], keepers: [] },
    maxPhase: 0,
    stats: { runs: 0, wins: 0, kills: 0, ponds: 0, wisps: 0, bestChain: 0, bestScore: 0, pearlsTotal: 0, winsByKeeper: {}, bestPhaseWon: -1 },
    seen: { enemies: [], stones: [], talismans: [], hints: [] },
    settings: { ...DEFAULT_SETTINGS },
    daily: { date: '', best: 0, played: 0 },
    tutorialDone: false,
    lastKeeper: 'moench',
    lastPhase: 0,
  };
}

const num = (x, d = 0, min = 0, max = 1e9) => (Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : d);
const strList = (x, valid) => (Array.isArray(x) ? [...new Set(x.filter((v) => typeof v === 'string' && valid(v)))] : []);

// Accepts anything (parsed JSON, null, garbage) and returns a valid meta object.
export function sanitizeMeta(raw, content) {
  const m = defaultMeta();
  if (!raw || typeof raw !== 'object' || raw.__corrupt) return m;
  const stoneOk = (id) => !!content.stones[id];
  const talOk = (id) => !!content.talismans[id];
  const keeperOk = (id) => !!content.keepers[id];
  const enemyOk = (id) => !!content.enemies[id];
  m.pearls = Math.floor(num(raw.pearls));
  const u = raw.unlocked || {};
  m.unlocked = { stones: strList(u.stones, stoneOk), talismans: strList(u.talismans, talOk), keepers: strList(u.keepers, keeperOk) };
  m.maxPhase = Math.floor(num(raw.maxPhase, 0, 0, content.phases.length - 1));
  const s = raw.stats || {};
  for (const k of Object.keys(m.stats)) {
    if (k === 'winsByKeeper') {
      const w = s.winsByKeeper && typeof s.winsByKeeper === 'object' ? s.winsByKeeper : {};
      for (const id of Object.keys(w)) if (keeperOk(id)) m.stats.winsByKeeper[id] = Math.floor(num(w[id]));
    } else if (k === 'bestPhaseWon') {
      m.stats.bestPhaseWon = Math.floor(num(s.bestPhaseWon, -1, -1, content.phases.length - 1));
    } else {
      m.stats[k] = Math.floor(num(s[k]));
    }
  }
  const seen = raw.seen || {};
  m.seen = {
    enemies: strList(seen.enemies, enemyOk),
    stones: strList(seen.stones, stoneOk),
    talismans: strList(seen.talismans, talOk),
    hints: strList(seen.hints, (h) => !!content.hints[h]),
  };
  const st = raw.settings || {};
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    const d = DEFAULT_SETTINGS[k];
    if (typeof d === 'boolean') m.settings[k] = typeof st[k] === 'boolean' ? st[k] : d;
    else m.settings[k] = num(st[k], d, 0, 1);
  }
  const dl = raw.daily || {};
  m.daily = { date: typeof dl.date === 'string' ? dl.date.slice(0, 10) : '', best: Math.floor(num(dl.best)), played: Math.floor(num(dl.played)) };
  m.tutorialDone = raw.tutorialDone === true;
  m.lastKeeper = keeperOk(raw.lastKeeper) ? raw.lastKeeper : 'moench';
  m.lastPhase = Math.floor(num(raw.lastPhase, 0, 0, m.maxPhase));
  return m;
}

export function isUnlocked(meta, kind, id, content) {
  const list = { stone: content.stones, talisman: content.talismans, keeper: content.keepers }[kind];
  const item = list && list[id];
  if (!item) return false;
  if (!item.unlock) return true;
  return meta.unlocked[`${kind}s`].includes(id);
}

// Content available for a new run (reward pools).
export function poolFor(meta, content) {
  return {
    stones: content.stoneList.filter((s) => isUnlocked(meta, 'stone', s.id, content)).map((s) => s.id),
    talismans: content.talismanList.filter((t) => isUnlocked(meta, 'talisman', t.id, content)).map((t) => t.id),
  };
}

export function defaultPool(content) {
  return {
    stones: content.stoneList.filter((s) => !s.unlock).map((s) => s.id),
    talismans: content.talismanList.filter((t) => !t.unlock).map((t) => t.id),
  };
}

export function buy(meta, kind, id, content) {
  const list = { stone: content.stones, talisman: content.talismans, keeper: content.keepers }[kind];
  const item = list && list[id];
  if (!item) return { meta, error: 'Unbekannt.' };
  if (isUnlocked(meta, kind, id, content)) return { meta, error: 'Schon freigeschaltet.' };
  if (meta.pearls < item.unlock) return { meta, error: 'Nicht genug Perlen.' };
  const m = structuredClone(meta);
  m.pearls -= item.unlock;
  m.unlocked[`${kind}s`].push(id);
  return { meta: m, error: null };
}

export function pearlsForRun(run, content) {
  const p = content.rules.pearls;
  const st = run.stats;
  let base = st.ponds * p.perPond + st.bosses * p.perBoss + Math.floor(st.kills / p.killsPerPearl) + st.wisps * p.wisp;
  if (run.mode === 'won') base += p.win;
  return Math.round(base * (1 + p.phaseBonus * (run.phase || 0)));
}

// Book a finished run into the meta state. Returns new meta + summary.
export function applyRunEnd(meta, run, content) {
  const m = structuredClone(meta);
  const won = run.mode === 'won';
  const pearls = pearlsForRun(run, content);
  m.pearls += pearls;
  m.stats.pearlsTotal += pearls;
  m.stats.runs += 1;
  m.stats.kills += run.stats.kills;
  m.stats.ponds += run.stats.ponds;
  m.stats.wisps += run.stats.wisps;
  m.stats.bestChain = Math.max(m.stats.bestChain, run.stats.chainMax);
  m.stats.bestScore = Math.max(m.stats.bestScore, run.stats.score);
  if (run.tutorial) m.tutorialDone = true;
  let newPhase = null;
  if (won) {
    m.stats.wins += 1;
    m.stats.winsByKeeper[run.keeper] = (m.stats.winsByKeeper[run.keeper] || 0) + 1;
    m.stats.bestPhaseWon = Math.max(m.stats.bestPhaseWon, run.phase || 0);
    const next = (run.phase || 0) + 1;
    if (!run.daily && next < content.phases.length && next > m.maxPhase) {
      m.maxPhase = next;
      newPhase = content.phases[next];
    }
  }
  let dailyBest = false;
  if (run.daily) {
    const date = String(run.seed).replace('daily-', '');
    if (m.daily.date !== date) m.daily = { date, best: 0, played: 0 };
    m.daily.played += 1;
    if (run.stats.score > m.daily.best) {
      m.daily.best = run.stats.score;
      dailyBest = true;
    }
  }
  return { meta: m, pearls, newPhase, won, dailyBest };
}

export function markSeen(meta, kind, ids) {
  const list = meta.seen[kind];
  const add = ids.filter((id) => !list.includes(id));
  if (!add.length) return meta;
  const m = structuredClone(meta);
  m.seen[kind].push(...add);
  return m;
}

// The cheapest still-locked things the player can afford right now.
export function affordable(meta, content) {
  const out = [];
  for (const [kind, list] of [['stone', content.stoneList], ['talisman', content.talismanList], ['keeper', content.keeperList]]) {
    for (const it of list) if (it.unlock && !isUnlocked(meta, kind, it.id, content) && it.unlock <= meta.pearls) out.push({ kind, id: it.id, name: it.name, cost: it.unlock });
  }
  return out.sort((a, b) => a.cost - b.cost);
}
