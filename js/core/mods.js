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
  const act = content.acts[run.act];
  if (act && !(run.tutorial && run.act === 0 && run.step === 0)) add(act.mods);
  return m;
}

// Extend a profile by n rings (continuing an alternating sign pattern), or
// trim it for negative n (never below 2 entries).
export function extendProfile(profile, n) {
  if (n < 0) return profile.slice(0, Math.max(2, profile.length + n));
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
  return extendProfile(stone.profile, mods.stoneRange || 0);
}

export function stoneCooldown(stone, mods) {
  return Math.max(0, stone.cooldown + (mods.cooldown || 0));
}

export function deathProfile(def, rules, mods) {
  const prof = (def.deathProfile || rules.deathProfile).slice();
  if (mods.deathBoost && prof.length > 1) prof[1] += mods.deathBoost;
  return extendProfile(prof, mods.deathRange || 0);
}

export function throwsForTurn(run, content, mods, turn) {
  const base = content.rules.throwsPerTurn + (mods.throws || 0);
  return Math.max(1, base + (turn < 3 ? mods.earlyThrows || 0 : 0));
}
