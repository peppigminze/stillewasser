// Aggregates numeric modifiers from keeper, talismans and moon phase.
import { MOD_KEYS } from './content.js';

export function getMods(run, content) {
  const m = {};
  for (const k of MOD_KEYS) m[k] = 0;
  const add = (src) => {
    if (!src) return;
    for (const k in src) if (k in m) m[k] += src[k];
  };
  const keeper = content.keepers[run.keeper];
  if (keeper) add(keeper.mods);
  for (const t of run.talismans) add(content.talismans[t] && content.talismans[t].effects);
  for (let i = 1; i <= (run.phase || 0); i++) add(content.phases[i] && content.phases[i].mods);
  return m;
}

// Extend a profile by n rings, continuing an alternating sign pattern if present.
export function extendProfile(profile, n) {
  const out = profile.slice();
  for (let i = 0; i < n; i++) {
    const a = out[out.length - 1];
    const b = out[out.length - 2];
    const alternating = b !== undefined && a !== 0 && Math.sign(a) === -Math.sign(b);
    out.push(alternating ? -a : a);
  }
  return out;
}

export function stoneProfile(stone, mods) {
  return extendProfile(stone.profile, Math.max(0, mods.stoneRange || 0));
}

export function stoneCooldown(stone, mods) {
  return Math.max(0, stone.cooldown + (mods.cooldown || 0));
}

export function deathProfile(def, rules, mods) {
  const prof = (def.deathProfile || rules.deathProfile).slice();
  if (mods.deathBoost && prof.length > 1) prof[1] += mods.deathBoost;
  return extendProfile(prof, Math.max(0, mods.deathRange || 0));
}

export function throwsForTurn(run, content, mods, turn) {
  const base = content.rules.throwsPerTurn + (mods.throws || 0);
  return Math.max(1, base + (turn === 0 ? mods.firstTurnThrows || 0 : 0));
}
