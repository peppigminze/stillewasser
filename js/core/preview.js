// Forecasts are pure: they run the real rules on a clone. The UI shows what
// will happen when the turn ends now ("now") and the field one tick later ("next").

import { waterFor, fieldAt, surgesOf, surgeDamage } from './field.js';
import { getMods } from './mods.js';
import { step } from './run.js';

function hitsFor(enemies, field, content, mods) {
  const th = content.rules.surgeThreshold;
  const hits = [];
  for (const e of enemies) {
    const a = field.amp[e.cell];
    if (Math.abs(a) < th) continue;
    const dmg = surgeDamage(a, content.enemies[e.type].armor, mods, th);
    hits.push({ id: e.id, cell: e.cell, amp: a, dmg, lethal: dmg >= e.hp });
  }
  return hits;
}

export function forecast(run, content) {
  const pond = run.pond;
  if (!pond || run.mode !== 'pond' || pond.status !== 'playing') return null;
  const mods = getMods(run, content);
  const th = content.rules.surgeThreshold;
  const w = waterFor(pond.radius, pond.rocks);
  const nowField = fieldAt(w, pond.ripples, pond.tick);
  const now = {
    amp: nowField.amp,
    surges: surgesOf(nowField, th),
    hits: hitsFor(pond.enemies, nowField, content, mods),
  };

  const res = step(run, { type: 'endTurn' }, content);
  const intents = {};
  const dying = new Set();
  let lightLoss = 0;
  for (const ev of res.events) {
    if (ev.type === 'death') dying.add(ev.id);
    else if (ev.type === 'move') intents[ev.id] = { kind: ev.kind, path: ev.path, from: ev.from };
    else if (ev.type === 'bite') {
      intents[ev.id] = { kind: 'bite', dmg: ev.dmg, blocked: ev.blocked };
      lightLoss += ev.dmg;
    } else if (ev.type === 'emit') intents[ev.id] = { kind: 'emit' };
    else if (ev.type === 'hatch') intents[ev.id] = { kind: 'hatch', cell: ev.cell };
    else if (ev.type === 'vanish') intents[ev.id] = { kind: 'vanish' };
  }
  for (const e of pond.enemies) if (!intents[e.id] && !dying.has(e.id)) intents[e.id] = { kind: 'rest' };

  let next = null;
  const after = res.run.pond;
  if (after && after.status === 'playing' && res.run.mode === 'pond') {
    const w2 = waterFor(after.radius, after.rocks);
    const nf = fieldAt(w2, after.ripples, after.tick);
    next = { amp: nf.amp, surges: surgesOf(nf, th), hits: hitsFor(after.enemies, nf, content, mods), enemies: after.enemies };
  }
  return { now, next, intents, dying, lightLoss, events: res.events, result: res.run };
}

export function previewThrow(run, slot, cell, content) {
  const res = step(run, { type: 'throw', slot, cell }, content);
  if (res.events[0] && res.events[0].type === 'invalid') return { error: res.events[0].reason };
  const fc = forecast(res.run, content);
  return { ...fc, run: res.run, throwEvent: res.events[0] };
}
