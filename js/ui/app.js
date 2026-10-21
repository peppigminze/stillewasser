// UI controller: owns the current run, turns input into core actions and
// plays the resulting events as animations.

import { newRun, step } from '../core/run.js';
import { forecast, previewThrow } from '../core/preview.js';
import { getMods, stoneProfile } from '../core/mods.js';
import { createRenderer } from './render.js';
import { createFx } from './fx.js';
import { createAudio } from './audio.js';
import { bindInput } from './input.js';
import * as screens from './screens.js';
import { serializeRun, deserializeRun } from '../core/save.js';
import { KEYS, loadJSON, saveJSON, remove, persistent } from './storage.js';
import { sanitizeMeta, poolFor, defaultPool, isUnlocked, buy, applyRunEnd, markSeen, affordable, defaultMeta } from '../core/meta.js';
import { drawCreature } from './render.js';
import { suggestThrow } from '../core/ai.js';

const esc = screens.esc;
// features that are switched on milestone by milestone
const FEATURES = { daily: true, shrine: true, codex: true, settings: true, tip: true };
// screens that cannot be closed with Esc
const MODAL = new Set(['title', 'runEnd', 'reward']);

export function createApp(content) {
  const $ = (id) => document.getElementById(id);
  const canvas = $('pond');
  const renderer = createRenderer(canvas, content);
  const fx = createFx();
  const audio = createAudio();
  const scene = {
    pond: null, visTick: 0, actors: new Map(), forecast: null, preview: null, ghost: null,
    focus: -1, cursor: -1, tip: -1, moonLight: 1, moonHurt: 0, palette: 'title',
    showIntents: true, showNext: true, expiring: [], titleRipples: [], hidden: new Set(),
  };
  const ui = {
    run: null, slot: 0, busy: false, speed: 1, baseSpeed: 1, lastType: 'mouse', anchorY: null, prevLight: null, stack: [],
    meta: sanitizeMeta(loadJSON(KEYS.meta), content), selKeeper: 'moench', selPhase: 0, shrineTab: 'stone', codexTab: 'creatures',
    summary: null, epoch: 0,
  };
  // Every run switch (title, new run, continue) bumps the epoch; async work
  // (animations, delayed screens) checks it so it never touches a stale run.
  const later = (ms, fn) => {
    const epoch = ui.epoch;
    setTimeout(() => { if (epoch === ui.epoch) fn(); }, ms);
  };
  ui.selKeeper = ui.meta.lastKeeper;
  ui.selPhase = ui.meta.lastPhase;

  function saveMeta() {
    saveJSON(KEYS.meta, ui.meta);
  }

  function seen(kind, ids) {
    const next = markSeen(ui.meta, kind, ids);
    if (next !== ui.meta) {
      ui.meta = next;
      saveMeta();
    }
  }

  function applySettings() {
    const st = ui.meta.settings;
    fx.reduced = st.reduced;
    audio.set({ sfx: st.sfx, ambient: st.ambient, volume: st.volume });
    $('app').classList.toggle('reduced', st.reduced);
    ui.baseSpeed = st.fast ? 1.8 : 1;
    ui.speed = ui.baseSpeed;
    $('btn-tip').hidden = !FEATURES.tip || !st.tips || !!(ui.run && ui.run.daily);
  }
  const tweens = [];

  // ------------------------------------------------------------ timing
  function tween(ms, fn, ease = (k) => k) {
    return new Promise((resolve) => tweens.push({ t: 0, ms: Math.max(1, ms), fn, ease, resolve }));
  }
  const wait = (ms) => tween(ms, () => {});

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      tw.t += dt * 1000 * ui.speed;
      const k = Math.min(1, tw.t / tw.ms);
      tw.fn(tw.ease(k));
      if (k >= 1) {
        tweens.splice(i, 1);
        tw.resolve();
      }
    }
    for (const a of scene.actors.values()) if (a.flash > 0) a.flash = Math.max(0, a.flash - dt * 3);
    scene.moonHurt = Math.max(0, scene.moonHurt - dt * 1.5);
    if (!scene.pond) titleAmbience(now / 1000);
    fx.update(dt);
    renderer.draw(scene, now / 1000, dt, fx);
    requestAnimationFrame(frame);
  }

  // -------------------------------------------------------------- layout
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const inGame = !$('hud').hidden;
    const side = inGame && getComputedStyle($('bar')).flexDirection === 'column';
    const top = inGame ? $('hud').offsetHeight + 2 : 16;
    const bottom = inGame && !side ? $('bar').offsetHeight + 4 : 12;
    const right = side ? $('bar').offsetWidth + 4 : 0;
    renderer.resize(w, h, Math.min(2, window.devicePixelRatio || 1), { top, bottom, right });
  }
  window.addEventListener('resize', resize);

  function setInGame(on) {
    $('hud').hidden = !on;
    $('bar').hidden = !on;
    if (!on) $('info').hidden = true;
    resize();
  }

  // ------------------------------------------------------------- scene
  function syncActors(pond) {
    const ids = new Set();
    for (const e of pond.enemies) {
      ids.add(e.id);
      let a = scene.actors.get(e.id);
      if (!a) {
        a = { id: e.id, alpha: 1, scale: 1, flash: 0 };
        scene.actors.set(e.id, a);
      }
      Object.assign(a, { type: e.type, cell: e.cell, hp: e.hp, maxHp: e.maxHp, heading: e.heading, path: null, u: 1, dying: false, alpha: 1, scale: 1 });
    }
    for (const id of [...scene.actors.keys()]) if (!ids.has(id)) scene.actors.delete(id);
  }

  function paletteFor(run) {
    if (!run) return 'title';
    if (run.tutorial && run.act === 0 && run.step === 0) return 'spring';
    return content.acts[Math.min(run.act, content.acts.length - 1)].palette;
  }

  function syncScene() {
    const run = ui.run;
    if (!run || !run.pond) {
      scene.pond = null;
      scene.actors.clear();
      scene.palette = 'title';
      scene.forecast = null;
      return;
    }
    scene.pond = run.pond;
    scene.visTick = run.pond.tick;
    scene.palette = paletteFor(run);
    scene.moonLight = run.light / Math.max(1, run.maxLight);
    syncActors(run.pond);
    seen('enemies', [...new Set(run.pond.enemies.map((e) => e.type))]);
    if (!ui.busy) tutorialTip();
    if (run.pond.enemies.some((e) => e.type === 'laeufer')) hint('strider');
    seen('stones', run.slots.map((s) => s.stone));
    seen('talismans', run.talismans);
    refreshForecast();
    renderHud();
  }

  function playable() {
    return !!(ui.run && ui.run.mode === 'pond' && ui.run.pond.status === 'playing' && !ui.busy && !ui.stack.length);
  }

  function refreshForecast() {
    const run = ui.run;
    scene.preview = null;
    scene.ghost = null;
    if (!run || run.mode !== 'pond' || run.pond.status !== 'playing' || ui.busy) {
      scene.forecast = null;
      updateInfo();
      return;
    }
    scene.pond = run.pond;
    if (scene.focus >= 0) {
      const p = previewThrow(run, ui.slot, scene.focus, content);
      scene.preview = p;
      if (!p.error) {
        scene.forecast = p;
        scene.pond = p.run.pond;
        const stone = content.stones[run.slots[ui.slot].stone];
        scene.ghost = { origin: scene.focus, profile: stoneProfile(stone, getMods(run, content)) };
        updateInfo();
        return;
      }
    }
    scene.forecast = forecast(run, content);
    updateInfo();
    const fc = scene.forecast;
    if (fc && (fc.now.hits.some((h) => h.dmg > 0) || (fc.next && fc.next.hits.some((h) => h.dmg > 0)))) hint('surgeMarkers');
  }

  function setFocus(cell) {
    if (scene.focus === cell) return;
    scene.focus = cell;
    if (cell >= 0) ui.anchorY = renderer.pos(cell).y;
    refreshForecast();
  }

  // ---------------------------------------------------------------- HUD
  function renderHud() {
    const run = ui.run;
    if (!run || !run.pond) return;
    const pond = run.pond;
    const lost = ui.prevLight !== null && run.light < ui.prevLight;
    const gained = ui.prevLight !== null && run.light > ui.prevLight;
    const pips = [];
    for (let i = 0; i < run.maxLight; i++) {
      const off = i >= run.light;
      const justLost = lost && off && i < ui.prevLight;
      const justGained = gained && !off && i >= ui.prevLight;
      pips.push(`<i class="pip${off ? ' off' : ''}${justLost ? ' lost' : ''}${justGained ? ' gain' : ''}"></i>`);
    }
    ui.prevLight = run.light;
    $('light').innerHTML = pips.join('') + `<span class="num">${run.light}</span>`;
    const act = content.acts[run.act];
    const tut = run.tutorial && run.act === 0 && run.step === 0;
    const pondLabel = tut ? 'Lernteich' : pond.kind === 'boss' ? 'Boss' : `Teich ${run.step + 1}/${act.ponds.length}`;
    $('where').innerHTML = `<small>${act.sub} · ${pondLabel}${run.daily ? ' · Täglich' : ''}</small>${esc(act.name)}`;
    const boss = pond.enemies.find((e) => content.enemies[e.type].boss);
    const left = Math.max(0, pond.total - pond.kills);
    $('progress').innerHTML = `Zug ${pond.turn + 1} · Schatten übrig: ${left}`
      + (boss ? `<span class="boss-hp"><i style="width:${(100 * boss.hp) / boss.maxHp}%"></i></span>` : '');

    $('slots').innerHTML = run.slots.map((s, i) => {
      const st = content.stones[s.stone];
      const popped = ui.prevCds && ui.prevCds[i] > 0 && s.cd === 0 && !pond.turnThrows.length;
      const cls = ['slot', i === ui.slot ? 'sel' : '', s.cd > 0 ? 'cd' : '', st.free ? 'free' : '', popped ? 'ready-pop' : ''].join(' ');
      return `<button class="${cls}" data-slot="${i}" title="${esc(st.name)}: ${esc(st.desc)}">
        <span class="key">${i + 1}</span><span class="g">${st.glyph}</span>
        <span class="prof">${screens.profileBars(st.profile)}</span><span class="n">${esc(st.name)}</span>
        ${s.cd > 0 ? `<span class="cdv">${s.cd}</span>` : ''}</button>`;
    }).join('');
    ui.prevCds = run.slots.map((s) => s.cd);
    $('talismans').innerHTML = run.talismans
      .map((t) => `<span class="tal" title="${esc(content.talismans[t].name)}: ${esc(content.talismans[t].desc)}">${content.talismans[t].glyph}</span>`)
      .join('');
    const total = pond.throwsLeft + pond.turnThrows.filter((t) => !t.free).length;
    $('throws').innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i < pond.throwsLeft ? '' : 'used'}"></i>`).join('');
    $('btn-end').disabled = !playable();
    $('btn-end').classList.toggle('ready', playable() && pond.throwsLeft === 0);
    $('btn-undo').disabled = !playable() || !pond.turnThrows.length;
  }

  const INTENT_TEXT = {
    move: (it) => `zieht ${it.path.length} Feld${it.path.length > 1 ? 'er' : ''} Richtung Mond`,
    dash: (it) => `<span class="red">sprintet ${it.path.length} Felder</span>`,
    wander: () => 'schwebt weiter',
    bite: (it) => (it.blocked ? '<span class="gold">beißt – wird abgewehrt</span>' : `<span class="red">beißt den Mond (−${it.dmg} Licht)</span>`),
    emit: () => '<span class="vio">ruft eine dunkle Welle</span>',
    hatch: () => 'lässt etwas schlüpfen',
    rest: () => 'lauert',
    wait: () => 'wartet',
    vanish: () => 'verblasst',
  };

  function updateInfo() {
    const el = $('info');
    const run = ui.run;
    if (!run || run.mode !== 'pond' || ui.busy || scene.focus < 0) {
      el.hidden = true;
      return;
    }
    const pond = run.pond;
    const cell = scene.focus;
    const parts = [];
    const enemy = pond.enemies.find((e) => e.cell === cell);
    if (enemy) {
      const def = content.enemies[enemy.type];
      const fc = scene.forecast;
      let next = '';
      if (fc && fc.dying && fc.dying.has(enemy.id)) next = '<span class="gold">wird beim Zugende vergehen</span>';
      else if (fc && fc.intents[enemy.id]) next = (INTENT_TEXT[fc.intents[enemy.id].kind] || INTENT_TEXT.rest)(fc.intents[enemy.id]);
      parts.push(`<b>${esc(def.name)}</b><span class="tag">♥ ${enemy.hp}/${enemy.maxHp}</span>${def.armor ? `<span class="tag">Panzer ${def.armor}</span>` : ''}<br>${esc(def.desc)}${next ? `<br>Als Nächstes: ${next}` : ''}`);
    }
    const tg = pond.telegraphs.find((t) => t.cell === cell);
    if (tg) parts.push(`Hier taucht nach diesem Zug auf: <b>${esc(content.enemies[tg.type].name)}</b>`);
    if (pond.rocks.includes(cell)) parts.push('<b>Fels</b> – blockiert Wellen und Schatten.');
    else if (cell === 0) parts.push('<b>Der Mond</b> – sein Licht ist dein Leben. Kein Ziel für Steine.');
    else if (scene.preview && scene.preview.error) parts.push(`<span class="red">${esc(scene.preview.error)}</span>`);
    else if (scene.preview) {
      const st = content.stones[run.slots[ui.slot].stone];
      const now = scene.preview.now;
      const kills = now.hits.filter((h) => h.lethal).length;
      const dmg = now.hits.reduce((s, h) => s + h.dmg, 0);
      const nextHits = scene.preview.next ? scene.preview.next.hits.filter((h) => h.dmg > 0).length : 0;
      const bits = [`Wurf: <b>${esc(st.name)}</b>`];
      if (dmg) bits.push(`<span class="gold">jetzt ${dmg} Schaden${kills ? `, ${kills} besiegt` : ''}</span>`);
      if (nextHits) bits.push(`nächster Zug: ${nextHits} Treffer`);
      if (!dmg && !nextHits) bits.push('legt eine Welle für später');
      parts.push(bits.join(' · ') + (ui.lastType !== 'mouse' && ui.lastType !== 'key' ? '<br><span class="gold">Nochmal tippen zum Werfen</span>' : ''));
    }
    if (!parts.length) {
      el.hidden = true;
      return;
    }
    el.innerHTML = parts.join('<br>');
    el.hidden = false;
  }

  function selectSlot(i) {
    const run = ui.run;
    if (!run || !run.slots[i] || ui.stack.length) return;
    ui.slot = i;
    renderHud();
    refreshForecast();
  }

  function autoSelectSlot() {
    const run = ui.run;
    if (!run) return;
    if (run.slots[ui.slot] && run.slots[ui.slot].cd === 0) return;
    const i = run.slots.findIndex((s) => s.cd === 0);
    if (i >= 0) ui.slot = i;
    else if (!run.slots[ui.slot]) ui.slot = 0;
  }

  let toastTimer = 0;
  function toast(msg, soft = false) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.toggle('soft', soft);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1900);
  }

  function banner(b1, b2, b3 = '', boss = false) {
    const el = document.createElement('div');
    el.className = `banner${boss ? ' boss' : ''}`;
    el.innerHTML = `<div class="b1">${esc(b1)}</div><div class="b2">${esc(b2)}</div>${b3 ? `<div class="b3">${esc(b3)}</div>` : ''}`;
    $('app').appendChild(el);
    setTimeout(() => el.remove(), 2300);
  }

  function pondBanner() {
    const run = ui.run;
    if (!run || !run.pond || run.mode !== 'pond') return;
    const act = content.acts[run.act];
    const pond = run.pond;
    if (pond.kind === 'tutorial') banner('Lernteich', act.name, 'Hüte den Mond');
    else if (pond.kind === 'boss') banner(act.sub, content.enemies[pond.boss].name, 'Boss', true);
    else banner(act.sub, act.name, `Teich ${run.step + 1}`);
    later(1500, () => {
      if (ui.run !== run) return;
      if (pond.kind === 'tutorial') hint('start');
      if (pond.kind === 'boss') hint('boss');
      if (content.acts[run.act].rule && run.step === 0) hint('fog');
      if (!run.tutorial || run.act > 0 || run.step > 0) hint('tip');
    });
  }

  // ------------------------------------------------------------- hints
  const hintQueue = [];
  function hint(id) {
    if (!ui.meta.settings.tips || !content.hints[id] || ui.meta.seen.hints.includes(id) || hintQueue.includes(id)) return;
    if (ui.run && ui.run.daily) return;
    if (hintQueue.length) return; // one at a time; triggers fire again later
    hintQueue.push(id);
    showHint();
  }

  function showHint() {
    const el = $('coach');
    if (!hintQueue.length) {
      el.hidden = true;
      return;
    }
    const h = content.hints[hintQueue[0]];
    el.classList.toggle('top', ui.stack.length > 0);
    el.innerHTML = `<h4>${esc(h.title)}</h4><p>${esc(h.text)}</p>
      <div class="coach-foot"><span></span>
      <span><button data-coach="off">Hinweise aus</button> <button data-coach="ok">Verstanden</button></span></div>`;
    el.hidden = false;
  }

  $('coach').addEventListener('click', (e) => {
    const b = e.target.closest('[data-coach]');
    if (!b) return;
    if (b.dataset.coach === 'off') {
      ui.meta = { ...ui.meta, settings: { ...ui.meta.settings, tips: false } };
      saveMeta();
      applySettings();
      hintQueue.length = 0;
      showHint();
      toast('Hinweise ausgeschaltet (Einstellungen).', true);
      return;
    }
    const id = hintQueue.shift();
    seen('hints', [id]);
    showHint();
  });

  // In the learning pond the first throws are suggested on the water.
  function tutorialTip() {
    const run = ui.run;
    scene.tip = -1;
    if (!run || run.mode !== 'pond' || run.pond.kind !== 'tutorial' || run.pond.turn > 2 || !ui.meta.settings.tips) return;
    const s = suggestThrow(run, content);
    if (s) {
      scene.tip = s.cell;
      if (run.slots[s.slot] && run.slots[s.slot].cd === 0) ui.slot = s.slot;
    }
  }

  function useTip() {
    if (!playable() || ui.run.daily) return;
    const s = suggestThrow(ui.run, content);
    if (!s) {
      toast('Kein sinnvoller Wurf – beende den Zug.', true);
      return;
    }
    ui.slot = s.slot;
    scene.tip = s.cell;
    scene.focus = -1;
    setFocus(s.cell);
    renderHud();
    toast(`Tipp: ${content.stones[ui.run.slots[s.slot].stone].name} auf das markierte Feld`, true);
  }

  // ------------------------------------------------------------ actions
  function tryThrow(cell) {
    if (!playable()) return;
    const res = step(ui.run, { type: 'throw', slot: ui.slot, cell }, content);
    const ev = res.events[0];
    if (ev.type === 'invalid') {
      toast(ev.reason);
      fx.addShake(2);
      audio.sfx.deny();
      if (ui.run.pond.enemies.some((e) => e.cell === cell)) hint('occupied');
      return;
    }
    ui.run = res.run;
    const S = renderer.size;
    const w = window.innerWidth;
    const btn = $('slots').children[ev.slot];
    const r = btn ? btn.getBoundingClientRect() : { left: w / 2, width: 0, top: window.innerHeight - 60, height: 0 };
    const from = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const land = (target, ids) => {
      const p = renderer.pos(target);
      for (const id of ids) scene.hidden.add(id);
      fx.throwStone(from.x, from.y, p.x, p.y, S, () => {
        for (const id of ids) scene.hidden.delete(id);
        fx.splash(p.x, p.y, S, 1.1);
        audio.sfx.splash((p.x - w / 2) / (w / 2), 1);
      });
    };
    land(cell, ev.ripples.filter((id, i) => i === 0 || ev.mirror < 0 || i > 1));
    if (ev.mirror >= 0) land(ev.mirror, [ev.ripples[1]]);
    scene.tip = -1;
    hint('afterFirstThrow');
    if (ui.run.slots[ev.slot].cd > 1) hint('cooldown');
    autoSelectSlot();
    scene.focus = ui.lastType === 'key' ? cell : -1;
    syncScene();
    onStateChange();
  }

  function undo() {
    if (!playable()) return;
    const res = step(ui.run, { type: 'undo' }, content);
    if (res.events[0].type === 'invalid') return;
    ui.run = res.run;
    ui.slot = res.events[0].slot;
    syncScene();
    onStateChange();
  }

  async function endTurn() {
    if (!playable()) return;
    const old = ui.run;
    const res = step(old, { type: 'endTurn' }, content);
    if (res.events[0] && res.events[0].type === 'invalid') return;
    ui.busy = true;
    const keepFocus = scene.focus;
    scene.focus = -1;
    scene.forecast = null;
    scene.preview = null;
    scene.ghost = null;
    updateInfo();
    renderHud();
    const epoch = ui.epoch;
    await animateTurn(old, res);
    if (epoch !== ui.epoch) return;
    ui.run = res.run;
    ui.busy = false;
    ui.speed = ui.baseSpeed;
    autoSelectSlot();
    if (ui.lastType === 'key') scene.focus = keepFocus;
    syncScene();
    onStateChange();
    afterTurn(res);
  }

  async function animateTurn(old, res) {
    const evs = res.events;
    const S = renderer.size;
    const oldPond = old.pond;
    scene.pond = oldPond;
    scene.visTick = oldPond.tick;

    // A) surges hit
    const resolve = evs.find((e) => e.type === 'resolve');
    if (resolve && resolve.surges.length) {
      // play surges as a rising arpeggio: hostile-hitting ones first, then the rest
      const occupied = new Set(oldPond.enemies.map((e) => e.cell));
      const order = resolve.surges.slice().sort((a, b) => (occupied.has(b.cell) - occupied.has(a.cell)) || a.gen - b.gen);
      const n = order.length;
      const gap = Math.max(14, Math.min(40, 360 / n));
      order.forEach((s, i) => {
        later((i * gap) / ui.speed, () => {
          const p = renderer.pos(s.cell);
          fx.surge(p.x, p.y, S, s.amp, s.gen);
          if (i < 10) audio.sfx.surge(s.amp, i, s.gen);
        });
      });
      fx.addShake(1 + Math.min(6, n * 0.6));
      await wait(Math.min(420, 120 + n * gap));
    }
    let impact = false;
    for (const e of evs) {
      if (e.type === 'hit') {
        const a = scene.actors.get(e.id);
        if (a) { a.flash = 1; a.hp = e.hp; }
        const p = renderer.pos(e.cell);
        fx.text(p.x, p.y - S * 0.6, `−${e.dmg}`, e.amp < 0 ? '#c9a6ff' : '#ffd27a', S * 0.75);
        audio.sfx.hit();
        impact = true;
      } else if (e.type === 'block') {
        const p = renderer.pos(e.cell);
        fx.text(p.x, p.y - S * 0.6, 'Panzer', '#cfd6e6', S * 0.5);
        impact = true;
      } else if (e.type === 'death') {
        const a = scene.actors.get(e.id);
        const def = content.enemies[e.enemy];
        const p = renderer.pos(e.cell);
        fx.ink(p.x, p.y, S, def.look.rim, !!def.boss);
        fx.addShake(def.boss ? 12 : 3);
        audio.sfx.death(!!def.boss);
        if (a) {
          a.dying = true;
          tween(380, (k) => { a.alpha = 1 - k; a.scale = 1 + k * 0.5; });
        }
        if (e.chain >= 2) chainPop(p.x, p.y - S, e.chain);
        if (!e.hostile) fx.text(p.x, p.y - S * 1.2, '+1 ◈', '#7fe3d0', S * 0.6);
        impact = true;
      } else if (e.type === 'heal') {
        audio.sfx.heal();
        const m = renderer.pos(0);
        fx.text(m.x, m.y - S * 1.3, `+${e.amount} Licht`, '#7fe3d0', S * 0.6);
      }
    }
    if (impact) await wait(380);
    for (const [id, a] of scene.actors) if (a.dying) scene.actors.delete(id);

    // B) creatures act
    const movers = [];
    let acted = false;
    for (const e of evs) {
      if (e.type === 'move') {
        const a = scene.actors.get(e.id);
        if (!a) continue;
        a.from = e.from;
        a.path = e.path;
        a.cell = e.path[e.path.length - 1];
        a.u = 0;
        movers.push(a);
      } else if (e.type === 'bite') {
        acted = true;
        const p = renderer.pos(e.cell);
        const m = renderer.pos(0);
        if (e.blocked) {
          fx.text(m.x, m.y - S, 'abgewehrt', '#7fe3d0', S * 0.55);
        } else {
          scene.moonHurt = 1;
          fx.addShake(7);
          audio.sfx.bite();
          if (ui.meta.settings.vibrate && navigator.vibrate) navigator.vibrate(40);
          fx.addFlash('#ff3b2a', 0.18);
          fx.text(m.x, m.y - S * 1.1, `−${e.dmg} Licht`, '#ff6a4a', S * 0.7);
          scene.moonLight = e.light / Math.max(1, old.maxLight);
        }
        fx.splash((p.x + m.x) / 2, (p.y + m.y) / 2, S, 0.6, '#ff8a6a');
      } else if (e.type === 'emit') {
        acted = true;
        const p = renderer.pos(e.cell);
        fx.splash(p.x, p.y, S, 1, '#a77bff');
        audio.sfx.emit();
      } else if (e.type === 'spawn' || e.type === 'hatch') {
        acted = true;
        const id = e.type === 'spawn' ? e.id : e.newId;
        const def = content.enemies[e.enemy];
        const a = { id, type: e.enemy, cell: e.cell, alpha: 1, scale: 0, flash: 0, u: 1, heading: -1, hp: def.hp, maxHp: def.hp };
        scene.actors.set(id, a);
        const p = renderer.pos(e.cell);
        fx.splash(p.x, p.y, S, 0.8, def.look.rim);
        audio.sfx.spawn();
        tween(300, (k) => { a.scale = k; }, (k) => 1 - Math.pow(1 - k, 3));
      } else if (e.type === 'vanish') {
        const a = scene.actors.get(e.id);
        if (a) tween(300, (k) => { a.alpha = 1 - k; });
      }
    }
    if (movers.length) await tween(300, (k) => { for (const a of movers) a.u = k; }, (k) => k * (2 - k));
    else if (acted) await wait(250);
    if (evs.some((e) => e.type === 'death' && e.hostile)) hint('firstKill');
    if (evs.some((e) => e.type === 'bite' && !e.blocked)) hint('firstBite');
    if (evs.some((e) => e.type === 'emit')) hint('darkRipple');
    if (res.run.pond && res.run.pond.enemies.some((e) => e.type === 'laeufer')) hint('strider');

    // C) time advances: rings expand
    const newPond = res.run.pond;
    if (newPond && newPond.tick > oldPond.tick && res.run.mode === 'pond') {
      const alive = new Set(newPond.ripples.map((r) => r.id));
      scene.expiring = oldPond.ripples.filter((r) => !alive.has(r.id) && r.born <= oldPond.tick);
      scene.pond = newPond;
      scene.visTick = oldPond.tick;
      for (const e of newPond.enemies) {
        const a = scene.actors.get(e.id);
        if (a) { a.hp = e.hp; a.heading = e.heading; }
      }
      await tween(430, (k) => { scene.visTick = oldPond.tick + k; }, (k) => 1 - Math.pow(1 - k, 2));
      scene.expiring = [];
    }
  }

  function wipe() {
    if (ui.meta.settings.reduced) return;
    const el = document.createElement('div');
    el.className = 'wipe';
    $('app').appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  function chainPop(x, y, chain) {
    const el = document.createElement('div');
    el.className = 'chain-pop';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.fontSize = `${Math.min(56, 22 + chain * 6)}px`;
    el.textContent = `Kette ×${chain}`;
    $('app').appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  function afterTurn(res) {
    const run = res.run;
    if (res.events.some((e) => e.type === 'pondWon')) {
      const m = renderer.pos(0);
      fx.bloom(m.x, m.y, renderer.size);
      scene.moonLight = 1;
      audio.sfx.pondWon();
    }
    if (run.mode === 'lost' || run.mode === 'won') {
      bookRunEnd();
      if (run.mode === 'won') audio.sfx.runWon();
      else audio.sfx.runLost();
      later(run.mode === 'won' ? 1400 : 650, () => openScreen('runEnd'));
    } else if (run.mode === 'reward') {
      ui.clearHeal = res.events.filter((e) => e.type === 'heal' && e.reason === 'pond').reduce((s, e) => s + e.amount, 0);
      seen('stones', run.reward.options.filter((o) => o.kind === 'stone').map((o) => o.id));
      seen('talismans', run.reward.options.filter((o) => o.kind === 'talisman').map((o) => o.id));
      later(1200, () => {
        if (ui.run === run && run.mode === 'reward' && !ui.stack.includes('reward')) openScreen('reward');
        hint('firstReward');
      });
    }
  }

  function bookRunEnd() {
    const run = ui.run;
    if (!run || ui.summary) return;
    const res = applyRunEnd(ui.meta, run, content);
    ui.meta = res.meta;
    ui.summary = res;
    saveMeta();
    remove(KEYS.run);
  }

  function savedRun() {
    return deserializeRun(loadJSON(KEYS.run), content);
  }

  function onStateChange() {
    const run = ui.run;
    if (!run) return;
    if (run.mode === 'pond' || run.mode === 'reward') saveJSON(KEYS.run, serializeRun(run));
    else remove(KEYS.run);
  }

  // ------------------------------------------------------------- screens
  function renderScreen(name) {
    const run = ui.run;
    switch (name) {
      case 'title': {
        const saved = savedRun();
        const label = saved ? `${content.acts[saved.act].sub} · ${saved.pond && saved.pond.kind === 'boss' ? 'Boss' : `Teich ${saved.step + 1}`} · ${saved.light} Licht${saved.daily ? ' · Täglich' : ''}` : '';
        return screens.titleScreen({ canContinue: !!saved, continueLabel: label, pearls: ui.meta.pearls, dailyDone: ui.meta.daily.date === todayKey(), features: FEATURES, shrineBadge: affordable(ui.meta, content).length > 0 });
      }
      case 'keeper':
        return screens.keeperScreen({ content, meta: ui.meta, isUnlocked, selKeeper: ui.selKeeper, selPhase: ui.selPhase });
      case 'shrine':
        return screens.shrineScreen({ content, meta: ui.meta, tab: ui.shrineTab, isUnlocked });
      case 'codex':
        return screens.codexScreen({ content, meta: ui.meta, tab: ui.codexTab });
      case 'settings':
        return screens.settingsScreen({ settings: ui.meta.settings, persistent: persistent() });
      case 'confirmNew':
        return screens.confirmScreen('Dein gespeicherter Lauf wird dabei aufgegeben. Trotzdem neu beginnen?', 'confirmNew');
      case 'confirmReset':
        return screens.confirmScreen('Wirklich allen Fortschritt löschen? Perlen, Freischaltungen und Statistik sind dann weg.', 'doReset');
      case 'reward': {
        const pond = run.pond;
        return screens.rewardScreen({
          run, content,
          title: pond.kind === 'boss' ? `${content.enemies[pond.boss].name} ist besiegt` : 'Der Teich ist still',
          sub: pond.kind === 'tutorial' ? 'Lernteich' : `${content.acts[run.act].sub} · ${content.acts[run.act].name}`,
          healText: ui.clearHeal ? `Der Mond schöpft Kraft: +${ui.clearHeal} Licht` : '',
        });
      }
      case 'replace':
        return screens.replaceScreen({ run, content, stoneId: run.reward.options[ui.pendingPick].id });
      case 'pause':
        return screens.pauseScreen({ daily: run && run.daily, features: FEATURES });
      case 'howto':
        return screens.howtoScreen();
      case 'confirmAbandon':
        return screens.confirmScreen('Lauf wirklich aufgeben?', 'doAbandon');
      case 'runEnd': {
        const won = run.mode === 'won';
        const reason = won ? 'Alle drei Teiche sind befreit. Der Mond leuchtet.'
          : run.result && run.result.reason === 'abandon' ? 'Du hast den Lauf aufgegeben.'
            : run.result && run.result.reason === 'dawn' ? 'Der Morgen graute, doch der Teich blieb dunkel.'
              : 'Das letzte Licht wurde verschlungen.';
        const sm = ui.summary || {};
        const can = affordable(ui.meta, content);
        return screens.runEndScreen({
          won, stats: run.stats, pearls: sm.pearls || 0, newPhase: sm.newPhase ? sm.newPhase.name : '', score: run.stats.score,
          best: ui.meta.daily.best, daily: run.daily, reasonText: reason,
          unlockedText: can.length ? `Im Schrein wartet: ${can.slice(0, 3).map((c) => c.name).join(', ')}` : '',
        });
      }
      default:
        return '';
    }
  }

  function showTop() {
    const el = $('screen');
    const name = ui.stack[ui.stack.length - 1];
    if (!name) {
      el.hidden = true;
      el.innerHTML = '';
      renderHud();
      return;
    }
    el.innerHTML = renderScreen(name);
    el.hidden = false;
    el.scrollTop = 0;
    for (const c of el.querySelectorAll('canvas[data-creature]')) {
      const def = content.enemies[c.dataset.creature];
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = 120 * dpr;
      c.height = 76 * dpr;
      const cx = c.getContext('2d');
      cx.scale(dpr, dpr);
      drawCreature(cx, def, 60, 40, 46, 1.3, { id: 3, hp: def.hp, maxHp: def.hp, heading: 0 });
    }
    const first = el.querySelector('.btn.primary, .btn');
    if (first && ui.lastType === 'key') first.focus();
  }

  function openScreen(name) {
    $('coach').classList.add('top');
    ui.stack.push(name);
    scene.focus = -1;
    updateInfo();
    showTop();
  }

  function replaceScreens(name) {
    ui.stack = name ? [name] : [];
    $('coach').classList.toggle('top', ui.stack.length > 0);
    showTop();
  }

  function back() {
    ui.stack.pop();
    $('coach').classList.toggle('top', ui.stack.length > 0);
    showTop();
    if (!ui.stack.length) refreshForecast();
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function toTitle() {
    ui.epoch += 1;
    ui.busy = false;
    hintQueue.length = 0;
    showHint();
    ui.run = null;
    ui.prevLight = null;
    syncScene();
    setInGame(false);
    replaceScreens('title');
  }

  function startRun(opts = {}) {
    ui.epoch += 1;
    ui.busy = false;
    const pool = opts.daily ? defaultPool(content) : poolFor(ui.meta, content);
    const keeper = opts.keeper || ui.selKeeper;
    const phase = opts.daily ? 0 : opts.phase ?? ui.selPhase;
    const tutorial = !opts.daily && !ui.meta.tutorialDone && ui.meta.stats.runs === 0;
    ui.run = newRun({ seed: opts.seed || String(Date.now()), keeper, phase, tutorial, ...pool, ...opts }, content);
    if (!opts.daily) {
      ui.meta = { ...ui.meta, lastKeeper: keeper, lastPhase: phase };
      saveMeta();
    }
    ui.summary = null;
    ui.slot = 0;
    ui.prevLight = null;
    fx.clear();
    replaceScreens(null);
    setInGame(true);
    applySettings();
    syncScene();
    pondBanner();
    onStateChange();
  }

  function takeReward(action) {
    const res = step(ui.run, action, content);
    if (res.events[0].type === 'invalid') {
      toast(res.events[0].reason);
      return;
    }
    ui.run = res.run;
    ui.clearHeal = 0;
    replaceScreens(null);
    autoSelectSlot();
    fx.clear();
    wipe();
    syncScene();
    const actStart = res.events.find((e) => e.type === 'actStart');
    if (actStart) {
      const act = content.acts[ui.run.act];
      banner(act.sub, act.name, act.rule || 'Eine neue Nacht beginnt');
      later(2300, () => pondBanner());
    } else pondBanner();
    onStateChange();
  }

  function continueRun() {
    ui.epoch += 1;
    ui.busy = false;
    const run = savedRun();
    if (!run) {
      toast('Kein Spielstand gefunden.');
      remove(KEYS.run);
      replaceScreens('title');
      return;
    }
    ui.run = run;
    ui.summary = null;
    ui.slot = 0;
    ui.prevLight = null;
    fx.clear();
    replaceScreens(null);
    setInGame(true);
    applySettings();
    autoSelectSlot();
    syncScene();
    if (run.mode === 'reward') openScreen('reward');
    else pondBanner();
  }

  const ACTIONS = {
    daily: () => guardSaved(() => startRun({ daily: true, seed: `daily-${todayKey()}`, keeper: 'moench' })),
    confirmNew: () => {
      const old = savedRun();
      if (old) {
        ui.run = step(old, { type: 'abandon' }, content).run;
        ui.summary = null;
        bookRunEnd();
        ui.run = null;
      }
      const next = ui.pendingStart;
      ui.pendingStart = null;
      if (next) next();
    },
    newRun: () => guardSaved(() => ACTIONS.newRunNow()),
    newRunNow: () => {
      const keepers = content.keeperList.filter((k) => isUnlocked(ui.meta, 'keeper', k.id, content));
      if (keepers.length > 1 || ui.meta.maxPhase > 0) openScreen('keeper');
      else startRun({ keeper: 'moench', phase: 0 });
    },
    selKeeper: (id) => { ui.selKeeper = id; showTop(); },
    selPhase: (p) => { ui.selPhase = Number(p); showTop(); },
    startRun: () => startRun(),
    shrine: () => { if (ui.stack[ui.stack.length - 1] === 'keeper') ui.stack.pop(); openScreen('shrine'); },
    shrineTab: (t) => { ui.shrineTab = t; showTop(); },
    buy: (arg) => {
      const [kind, id] = arg.split(':');
      const res = buy(ui.meta, kind, id, content);
      if (res.error) return toast(res.error);
      ui.meta = res.meta;
      saveMeta();
      toast(`Freigeschaltet: ${({ stone: content.stones, talisman: content.talismans, keeper: content.keepers }[kind][id]).name}`, true);
      showTop();
    },
    codex: () => openScreen('codex'),
    codexTab: (t) => { ui.codexTab = t; showTop(); },
    settings: () => openScreen('settings'),
    resetAsk: () => openScreen('confirmReset'),
    doReset: () => {
      ui.meta = defaultMeta();
      saveMeta();
      remove(KEYS.run);
      applySettings();
      toast('Fortschritt gelöscht.', true);
      toTitle();
    },
    howto: () => openScreen('howto'),
    back: () => back(),
    resume: () => back(),
    toTitle: () => toTitle(),
    abandon: () => openScreen('confirmAbandon'),
    doAbandon: () => {
      const res = step(ui.run, { type: 'abandon' }, content);
      ui.run = res.run;
      bookRunEnd();
      onStateChange();
      replaceScreens('runEnd');
    },
    continue: () => continueRun(),
    pick: (arg) => {
      const i = Number(arg);
      const opt = ui.run.reward && ui.run.reward.options[i];
      if (!opt) return;
      if (opt.kind === 'stone' && ui.run.slots.length >= content.rules.maxSlots) {
        ui.pendingPick = i;
        openScreen('replace');
        return;
      }
      takeReward({ type: 'pickReward', index: i });
    },
    replace: (arg) => takeReward({ type: 'pickReward', index: ui.pendingPick, replace: Number(arg) }),
    skip: () => takeReward({ type: 'skipReward' }),
  };

  // starting something new while a run is saved abandons that run: ask first
  function guardSaved(fn) {
    const saved = savedRun();
    if (saved) {
      ui.pendingStart = fn;
      openScreen('confirmNew');
      return;
    }
    fn();
  }

  $('screen').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const fn = ACTIONS[b.dataset.act];
    if (fn) fn(b.dataset.arg);
  });

  $('screen').addEventListener('input', (e) => {
    const key = e.target.dataset && e.target.dataset.setting;
    if (!key) return;
    const value = e.target.type === 'checkbox' ? e.target.checked : Number(e.target.value);
    ui.meta = { ...ui.meta, settings: { ...ui.meta.settings, [key]: value } };
    saveMeta();
    applySettings();
  });

  // --------------------------------------------------------------- input
  $('slots').addEventListener('click', (e) => {
    const b = e.target.closest('[data-slot]');
    if (b) selectSlot(Number(b.dataset.slot));
  });
  $('btn-end').addEventListener('click', () => endTurn());
  $('btn-undo').addEventListener('click', () => undo());
  $('btn-menu').addEventListener('click', () => { if (ui.run && !ui.stack.length && !ui.busy) openScreen('pause'); });
  $('btn-tip').addEventListener('click', () => useTip());

  function moveCursor(dir) {
    const g = renderer.grid;
    let cur = scene.focus >= 0 ? scene.focus : -1;
    if (cur < 0) {
      cur = g.indexOf(0, -2);
      ui.anchorY = renderer.pos(cur).y;
      setFocus(cur);
      return;
    }
    const c = g.cells[cur];
    const cand = {
      up: [[0, -1]], down: [[0, 1]],
      left: [[-1, 0], [-1, 1]], right: [[1, -1], [1, 0]],
    }[dir].map(([dq, dr]) => g.indexOf(c.q + dq, c.r + dr)).filter((i) => i >= 0);
    if (!cand.length) return;
    let best = cand[0];
    if (cand.length > 1 && ui.anchorY !== null) {
      best = cand.reduce((a, b) => (Math.abs(renderer.pos(a).y - ui.anchorY) <= Math.abs(renderer.pos(b).y - ui.anchorY) ? a : b));
    }
    const keep = ui.anchorY;
    scene.focus = best;
    refreshForecast();
    if (dir === 'left' || dir === 'right') ui.anchorY = keep;
    else ui.anchorY = renderer.pos(best).y;
  }

  window.addEventListener('pointerdown', () => audio.unlock(), { capture: true });
  window.addEventListener('keydown', () => audio.unlock(), { capture: true });
  document.addEventListener('click', (e) => { if (e.target.closest('button')) audio.sfx.ui(); });

  bindInput(canvas, {
    anyInput() {
      if (ui.busy) ui.speed = 3;
    },
    hover(x, y) {
      ui.lastType = 'mouse';
      if (!playable()) return;
      setFocus(x < 0 ? -1 : renderer.cellAt(x, y));
    },
    tap(x, y, type) {
      ui.lastType = type;
      if (!playable()) return;
      const cell = renderer.cellAt(x, y);
      if (cell < 0) return setFocus(-1);
      if (type === 'mouse' || cell === scene.focus) tryThrow(cell);
      else setFocus(cell);
    },
    key(cmd, arg) {
      if (cmd === 'menu') {
        const top = ui.stack[ui.stack.length - 1];
        if (top && !MODAL.has(top)) back();
        else if (ui.run && !ui.stack.length && !ui.busy) openScreen('pause');
        return true;
      }
      if (ui.stack.length) return false;
      ui.lastType = 'key';
      if (cmd === 'slot') return selectSlot(arg);
      if (cmd === 'nextSlot') return selectSlot((ui.slot + 1) % (ui.run ? ui.run.slots.length : 1));
      if (!playable()) return cmd === 'end' || cmd === 'throw';
      if (cmd === 'end') return endTurn();
      if (cmd === 'undo') return undo();
      if (cmd === 'throw') return scene.focus >= 0 ? tryThrow(scene.focus) : moveCursor('up');
      if (cmd === 'tip') return useTip();
      if (cmd === 'intents') {
        scene.showIntents = !scene.showIntents;
        toast(scene.showIntents ? 'Absichten sichtbar' : 'Absichten ausgeblendet', true);
        return true;
      }
      if (['up', 'down', 'left', 'right'].includes(cmd)) return moveCursor(cmd);
      return false;
    },
  });
  window.addEventListener('pointerup', () => { if (!ui.busy) ui.speed = ui.baseSpeed; });
  window.addEventListener('keyup', () => { if (!ui.busy) ui.speed = ui.baseSpeed; });

  // title ambience: random ripples meeting on the title screen
  let nextDrop = 0;
  function titleAmbience(t) {
    scene.visTick = t * 1.2;
    if (t < nextDrop) return;
    nextDrop = t + 0.7 + Math.random() * 0.7;
    const g = renderer.grid;
    const origin = 1 + Math.floor(Math.random() * (g.size - 1));
    scene.titleRipples.push({ id: Math.random(), origin, born: t * 1.2, profile: [1, 1, 1, 1, 1, 1, 1], owner: 'player', gen: 0 });
    scene.titleRipples = scene.titleRipples.filter((r) => t * 1.2 - r.born < 8);
  }

  // debug/automation handle (used by tools/smoke.mjs)
  function debugAutoTurn() {
    if (!playable()) return;
    const g = renderer.grid;
    const e = ui.run.pond.enemies[0];
    if (e) {
      const ns = g.neighbors[e.cell].filter((n) => n > 0 && !ui.run.pond.rocks.includes(n));
      for (let i = 0; i < 2 && i < ns.length; i++) {
        selectSlot(Math.max(0, ui.run.slots.findIndex((s) => s.cd === 0)));
        tryThrow(ns[(i * 2) % ns.length]);
      }
    }
    endTurn();
  }

  // plays one turn through the real UI pipeline using the planner's suggestions
  function debugPlanTurn() {
    if (!playable()) return false;
    for (let i = 0; i < 6; i++) {
      const sg = suggestThrow(ui.run, content);
      if (!sg) break;
      ui.slot = sg.slot;
      const before = ui.run;
      tryThrow(sg.cell);
      if (ui.run === before) break;
    }
    endTurn();
    return true;
  }

  function debugWinPond() {
    if (!playable()) return;
    const r = structuredClone(ui.run);
    r.pond.enemies = [];
    r.pond.schedule = [];
    r.pond.telegraphs = [];
    ui.run = r;
    syncScene();
    endTurn();
  }

  applySettings();
  resize();
  requestAnimationFrame(frame);
  $('app').classList.remove('booting');
  toTitle();

  return {
    debugWinPond,
    debugPlanTurn,
    setSpeed: (v) => { ui.baseSpeed = v; ui.speed = v; },
    cellPos: (c) => renderer.pos(c),
    get run() { return ui.run; },
    get stack() { return ui.stack.slice(); },
    scene, startRun, debugAutoTurn, act: (name, arg) => ACTIONS[name] && ACTIONS[name](arg),
  };
}
