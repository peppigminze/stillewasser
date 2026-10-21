// localStorage wrapper: never throws, falls back to memory (private mode, quota, disabled storage).

const memory = new Map();
let available = null;

function hasStorage() {
  if (available !== null) return available;
  try {
    const k = '__sw_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    available = true;
  } catch {
    available = false;
  }
  return available;
}

export const KEYS = {
  meta: 'stillewasser.meta.v1',
  run: 'stillewasser.run.v1',
};

export function loadJSON(key) {
  let text = null;
  try {
    text = hasStorage() ? window.localStorage.getItem(key) : memory.get(key) ?? null;
  } catch {
    text = memory.get(key) ?? null;
  }
  if (text == null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { __corrupt: true };
  }
}

export function saveJSON(key, value) {
  const text = JSON.stringify(value);
  memory.set(key, text);
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(key, text);
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  memory.delete(key);
  try {
    if (hasStorage()) window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function persistent() {
  return hasStorage();
}
