// Content indexing + validation. Raw JSON comes from /data (fetch in the
// browser, fs in Node); everything else receives the indexed object.

export const CONTENT_FILES = ['rules', 'stones', 'enemies', 'talismans', 'acts', 'keepers', 'phases', 'hints'];

export const ACTIONS = ['move', 'emit', 'hatch', 'dash', 'wander', 'rest'];

export const MOD_KEYS = [
  'throws', 'earlyThrows', 'deathRange', 'deathBoost', 'shieldPerPond', 'healPerPond',
  'maxLight', 'bigSurgeBonus', 'sogBonus', 'stoneRange', 'cooldown', 'chainHeal',
  'rewardChoices', 'budgetMul', 'startLight', 'bossHpMul', 'biteBonus',
];

function byId(list) {
  const map = {};
  for (const item of list) map[item.id] = item;
  return map;
}

export function buildContent(raw) {
  return {
    rules: raw.rules,
    stones: byId(raw.stones),
    stoneList: raw.stones,
    enemies: byId(raw.enemies),
    enemyList: raw.enemies,
    talismans: byId(raw.talismans),
    talismanList: raw.talismans,
    acts: raw.acts.acts,
    tutorial: raw.acts.tutorial,
    keepers: byId(raw.keepers),
    keeperList: raw.keepers,
    phases: raw.phases,
    hints: raw.hints || {},
  };
}

const isIntArray = (a) => Array.isArray(a) && a.length > 0 && a.every((x) => Number.isInteger(x));

export function validateContent(c) {
  const errors = [];
  const err = (m) => errors.push(m);
  const uniq = (list, label) => {
    const seen = new Set();
    for (const it of list) {
      if (!it.id) err(`${label}: Eintrag ohne id`);
      if (seen.has(it.id)) err(`${label}: doppelte id ${it.id}`);
      seen.add(it.id);
    }
  };
  uniq(c.stoneList, 'stones');
  uniq(c.enemyList, 'enemies');
  uniq(c.talismanList, 'talismans');
  uniq(c.keeperList, 'keepers');

  for (const s of c.stoneList) {
    if (!isIntArray(s.profile)) err(`stone ${s.id}: profile ungültig`);
    if (!(s.cooldown >= 0)) err(`stone ${s.id}: cooldown ungültig`);
    if (!s.name || !s.desc) err(`stone ${s.id}: name/desc fehlt`);
  }
  for (const e of c.enemyList) {
    if (!(e.hp > 0)) err(`enemy ${e.id}: hp ungültig`);
    if (!Array.isArray(e.pattern) || !e.pattern.length) err(`enemy ${e.id}: pattern fehlt`);
    for (const a of e.pattern || []) if (!ACTIONS.includes(a)) err(`enemy ${e.id}: unbekannte Aktion ${a}`);
    if ((e.pattern || []).includes('emit') && !isIntArray(e.emitProfile)) err(`enemy ${e.id}: emitProfile fehlt`);
    if ((e.pattern || []).includes('hatch') && !c.enemies[e.hatch]) err(`enemy ${e.id}: hatch-Typ unbekannt`);
    if ((e.pattern || []).includes('dash') && !(e.dashLen > 0)) err(`enemy ${e.id}: dashLen fehlt`);
    if (e.deathProfile && !isIntArray(e.deathProfile)) err(`enemy ${e.id}: deathProfile ungültig`);
    if (!e.look || !e.look.shape) err(`enemy ${e.id}: look fehlt`);
  }
  for (const t of c.talismanList) {
    for (const k of Object.keys(t.effects || {})) if (!MOD_KEYS.includes(k)) err(`talisman ${t.id}: unbekannter Effekt ${k}`);
  }
  for (const k of c.keeperList) {
    for (const s of k.stones) if (!c.stones[s]) err(`keeper ${k.id}: Stein ${s} unbekannt`);
    for (const t of k.talismans) if (!c.talismans[t]) err(`keeper ${k.id}: Talisman ${t} unbekannt`);
    if (k.stones.length > c.rules.maxSlots) err(`keeper ${k.id}: zu viele Steine`);
    for (const m of Object.keys(k.mods || {})) if (!MOD_KEYS.includes(m)) err(`keeper ${k.id}: unbekannter Mod ${m}`);
  }
  if (!c.keeperList.some((k) => !k.unlock)) err('keepers: mindestens ein Hüter muss frei sein');
  if (!Array.isArray(c.acts) || !c.acts.length) err('acts: leer');
  c.acts.forEach((act, ai) => {
    if (!act.ponds || !act.ponds.length) err(`act ${ai}: keine Teiche`);
    for (const m of Object.keys(act.mods || {})) if (!MOD_KEYS.includes(m)) err(`act ${act.id}: unbekannter Mod ${m}`);
    act.ponds.forEach((p, pi) => {
      const where = `act ${act.id} pond ${pi}`;
      for (const t of Object.keys(p.pool || {})) if (!c.enemies[t]) err(`${where}: Kreatur ${t} unbekannt`);
      if (p.kind === 'boss' && !(c.enemies[p.boss] && c.enemies[p.boss].boss)) err(`${where}: Boss ungültig`);
      if (!Array.isArray(p.rocks) || p.rocks.length !== 2) err(`${where}: rocks [min,max] erwartet`);
    });
  });
  for (const f of (c.tutorial && c.tutorial.fixed) || []) if (!c.enemies[f.type]) err(`tutorial: Kreatur ${f.type} unbekannt`);
  c.phases.forEach((ph, i) => {
    if (ph.id !== i) err(`phase ${i}: id muss ${i} sein`);
    for (const m of Object.keys(ph.mods || {})) if (!MOD_KEYS.includes(m)) err(`phase ${i}: unbekannter Mod ${m}`);
  });
  return errors;
}
