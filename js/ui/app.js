// UI controller: owns the current run, turns input into core actions and
// plays the resulting events as animations.

import { newRun, step } from '../core/run.js';
import { forecast, previewThrow } from '../core/preview.js';
import { getMods, stoneProfile } from '../core/mods.js';
import { createRenderer } from './render.js';
import { createFx } from './fx.js';
import { bindInput } from './input.js';

export function createApp(content) {
  const $ = (id) => document.getElementById(id);
  const canvas = $('pond');
  const renderer = createRenderer(canvas, content);
  const fx = createFx();
  const scene = {
    pond: null, visTick: 0, actors: new Map(), forecast: null, preview: null, ghost: null,
    focus: -1, cursor: -1, tip: -1, moonLight: 1, moonHurt: 0, palette: 'title',
    showIntents: true, showNext: true, expiring: [], titleRipples: [],
  };
  const ui = { run: null, slot: 0, busy: false, speed: 1, lastType: 'mouse' };
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
    const hudVisible = !$('hud').hidden;
    const top = hudVisible ? $('hud').offsetHeight + 4 : 20;
    const bottom = hudVisible ? $('bar').offsetHeight + 6 : 20;
    renderer.resize(w, h, Math.min(2, window.devicePixelRatio || 1), { top, bottom });
  }
  window.addEventListener('resize', resize);

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
      Object.assign(a, { type: e.type, cell: e.cell, hp: e.hp, maxHp: e.maxHp, heading: e.heading, path: null, u: 1, dying: false, alpha: 1 });
    }
    for (const id of [...scene.actors.keys()]) if (!ids.has(id)) scene.actors.delete(id);
  }

  function syncScene() {
    const run = ui.run;
    if (!run || !run.pond) {
      scene.pond = null;
      scene.actors.clear();
      return;
    }
    scene.pond = run.pond;
    scene.visTick = run.pond.tick;
    scene.palette = run.tutorial && run.act === 0 && run.step === 0 ? 'spring' : content.acts[run.act].palette;
    scene.moonLight = run.light / Math.max(1, run.maxLight);
    syncActors(run.pond);
    refreshForecast();
    renderHud();
  }

  function playable() {
    return ui.run && ui.run.mode === 'pond' && ui.run.pond.status === 'playing' && !ui.busy;
  }

  function refreshForecast() {
    const run = ui.run;
    scene.preview = null;
    scene.ghost = null;
    if (!playable()) {
      scene.forecast = null;
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
        return;
      }
    }
    scene.forecast = forecast(run, content);
  }

  function setFocus(cell) {
    if (scene.focus === cell) return;
    scene.focus = cell;
    refreshForecast();
  }

  // ---------------------------------------------------------------- HUD
  function renderHud() {
    const run = ui.run;
    if (!run || !run.pond) return;
    const pond = run.pond;
    const pips = [];
    for (let i = 0; i < run.maxLight; i++) pips.push(`<i class="pip${i < run.light ? '' : ' off'}"></i>`);
    $('light').innerHTML = pips.join('') + `<span class="num">${run.light}</span>`;
    const act = content.acts[run.act];
    const tut = run.tutorial && run.act === 0 && run.step === 0;
    const pondLabel = tut ? 'Lernteich' : pond.kind === 'boss' ? 'Boss' : `Teich ${run.step + 1}/${act.ponds.length}`;
    $('where').innerHTML = `<small>${act.sub} · ${pondLabel}</small>${act.name}`;
    const left = pond.total - pond.kills;
    $('progress').textContent = `Zug ${pond.turn + 1} · Schatten übrig: ${Math.max(0, left)}`;

    const slots = run.slots.map((s, i) => {
      const st = content.stones[s.stone];
      const prof = st.profile
        .map((a) => `<i class="${a < 0 ? 'neg' : a === 0 ? 'zero' : ''}" style="height:${Math.min(14, 5 * Math.abs(a) + 2)}px"></i>`)
        .join('');
      const cls = ['slot', i === ui.slot ? 'sel' : '', s.cd > 0 ? 'cd' : '', st.free ? 'free' : ''].join(' ');
      return `<button class="${cls}" data-slot="${i}" title="${st.name}: ${st.desc}">
        <span class="key">${i + 1}</span><span class="g">${st.glyph}</span>
        <span class="prof">${prof}</span><span class="n">${st.name}</span>
        ${s.cd > 0 ? `<span class="cdv">${s.cd}</span>` : ''}</button>`;
    });
    $('slots').innerHTML = slots.join('');
    const total = pond.throwsLeft + pond.turnThrows.filter((t) => !t.free).length;
    $('throws').innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i < pond.throwsLeft ? '' : 'used'}"></i>`).join('');
    $('btn-end').disabled = !playable();
    $('btn-end').classList.toggle('ready', playable() && pond.throwsLeft === 0);
  }

  function selectSlot(i) {
    const run = ui.run;
    if (!run || !run.slots[i]) return;
    ui.slot = i;
    renderHud();
    refreshForecast();
  }

  function autoSelectSlot() {
    const run = ui.run;
    const ok = (i) => run.slots[i] && run.slots[i].cd === 0;
    if (ok(ui.slot)) return;
    const i = run.slots.findIndex((s) => s.cd === 0);
    if (i >= 0) ui.slot = i;
  }

  let toastTimer = 0;
  function toast(msg, soft = false) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.toggle('soft', soft);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  // ------------------------------------------------------------ actions
  function tryThrow(cell) {
    if (!playable()) return;
    const res = step(ui.run, { type: 'throw', slot: ui.slot, cell }, content);
    const ev = res.events[0];
    if (ev.type === 'invalid') {
      toast(ev.reason);
      fx.addShake(2);
      return;
    }
    ui.run = res.run;
    const p = renderer.pos(cell);
    fx.splash(p.x, p.y, renderer.size, 1.1);
    if (ev.mirror >= 0) {
      const m = renderer.pos(ev.mirror);
      fx.splash(m.x, m.y, renderer.size, 1.1);
    }
    autoSelectSlot();
    scene.focus = ui.lastType === 'mouse' ? cell : -1;
    syncScene();
  }

  async function endTurn() {
    if (!playable()) return;
    const old = ui.run;
    const res = step(old, { type: 'endTurn' }, content);
    if (res.events[0] && res.events[0].type === 'invalid') return;
    ui.busy = true;
    scene.focus = -1;
    scene.forecast = null;
    scene.preview = null;
    scene.ghost = null;
    renderHud();
    await animateTurn(old, res);
    ui.run = res.run;
    ui.busy = false;
    autoSelectSlot();
    syncScene();
    afterTurn(res.run);
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
      for (const s of resolve.surges) {
        const p = renderer.pos(s.cell);
        fx.surge(p.x, p.y, S, s.amp, s.gen);
      }
      fx.addShake(1 + Math.min(6, resolve.surges.length * 0.6));
      await wait(170);
    }
    let impact = false;
    for (const e of evs) {
      if (e.type === 'hit') {
        const a = scene.actors.get(e.id);
        if (a) { a.flash = 1; a.hp = e.hp; }
        const p = renderer.pos(e.cell);
        fx.text(p.x, p.y - S * 0.6, `−${e.dmg}`, e.amp < 0 ? '#c9a6ff' : '#ffd27a', S * 0.75);
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
        if (a) {
          a.dying = true;
          tween(380, (k) => { a.alpha = 1 - k; a.scale = 1 + k * 0.5; });
        }
        if (e.chain >= 2) chainPop(p.x, p.y - S, e.chain);
        impact = true;
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
          fx.addFlash('#ff3b2a', 0.18);
          fx.text(m.x, m.y - S * 1.1, `−${e.dmg} Licht`, '#ff6a4a', S * 0.7);
          scene.moonLight = e.light / Math.max(1, old.maxLight);
        }
        fx.splash((p.x + m.x) / 2, (p.y + m.y) / 2, S, 0.6, '#ff8a6a');
      } else if (e.type === 'emit') {
        acted = true;
        const p = renderer.pos(e.cell);
        fx.splash(p.x, p.y, S, 1, '#a77bff');
      } else if (e.type === 'spawn' || e.type === 'hatch') {
        acted = true;
        const id = e.type === 'spawn' ? e.id : e.newId;
        const a = { id, type: e.enemy, cell: e.cell, alpha: 1, scale: 0, flash: 0, u: 1, heading: -1 };
        const def = content.enemies[e.enemy];
        a.hp = def.hp;
        a.maxHp = def.hp;
        scene.actors.set(id, a);
        const p = renderer.pos(e.cell);
        fx.splash(p.x, p.y, S, 0.8, def.look.rim);
        tween(300, (k) => { a.scale = k; }, (k) => 1 - Math.pow(1 - k, 3));
      } else if (e.type === 'vanish') {
        const a = scene.actors.get(e.id);
        if (a) tween(300, (k) => { a.alpha = 1 - k; });
      }
    }
    if (movers.length) await tween(300, (k) => { for (const a of movers) a.u = k; }, (k) => k * (2 - k));
    else if (acted) await wait(250);

    // C) time advances: rings expand
    const newPond = res.run.pond;
    if (newPond && newPond.tick > oldPond.tick) {
      const alive = new Set(newPond.ripples.map((r) => r.id));
      scene.expiring = oldPond.ripples.filter((r) => !alive.has(r.id) && r.born <= oldPond.tick);
      scene.pond = newPond;
      scene.visTick = oldPond.tick;
      syncActorsSoft(newPond);
      await tween(430, (k) => { scene.visTick = oldPond.tick + k; }, (k) => 1 - Math.pow(1 - k, 2));
      scene.expiring = [];
    }
  }

  // keep animated actors, but add/remove according to the new pond
  function syncActorsSoft(pond) {
    for (const e of pond.enemies) {
      const a = scene.actors.get(e.id);
      if (a) { a.hp = e.hp; a.heading = e.heading; }
    }
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

  function afterTurn(run) {
    if (run.mode === 'lost') showEnd(false);
    else if (run.mode === 'won' || run.mode === 'reward') showEnd(true);
  }

  // --------------------------------------------------------- screens (M1)
  function showScreen(html) {
    const el = $('screen');
    el.innerHTML = html;
    el.hidden = false;
  }
  function hideScreen() {
    $('screen').hidden = true;
    $('screen').innerHTML = '';
  }

  function showTitle() {
    ui.run = null;
    syncScene();
    $('hud').hidden = true;
    $('bar').hidden = true;
    resize();
    showScreen(`<div class="panel title-wrap">
      <div class="stamp">静</div>
      <div class="game-title">STILLE WASSER</div>
      <div class="tagline">Hüte den Mond. Wo Wellen sich treffen, entsteht Kraft.</div>
      <div class="menu"><button class="btn primary" data-act="start">Spielen</button></div>
    </div>`);
  }

  function showEnd(won) {
    showScreen(`<div class="panel"><div class="sub">${won ? 'Geschafft' : 'Der Mond erlischt'}</div>
      <h2>${won ? 'Der Teich ist still.' : 'Dunkelheit.'}</h2><span class="brush"></span>
      <div class="menu"><button class="btn primary" data-act="start">Nochmal</button></div></div>`);
  }

  function startRun() {
    hideScreen();
    ui.run = newRun({ seed: String(Date.now()), keeper: 'moench' }, content);
    ui.slot = 0;
    $('hud').hidden = false;
    $('bar').hidden = false;
    syncScene();
    resize();
  }

  $('screen').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'start') startRun();
  });

  // --------------------------------------------------------------- input
  $('slots').addEventListener('click', (e) => {
    const b = e.target.closest('[data-slot]');
    if (b) selectSlot(Number(b.dataset.slot));
  });
  $('btn-end').addEventListener('click', () => endTurn());

  bindInput(canvas, {
    anyInput() {},
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
      if (cmd === 'slot') return selectSlot(arg);
      if (cmd === 'end') return endTurn();
      return false;
    },
  });

  // title ambience: random ripples meeting on the title screen
  let nextDrop = 0;
  function titleAmbience(t) {
    if (t < nextDrop) {
      scene.visTick = t * 1.2;
      return;
    }
    nextDrop = t + 0.9 + Math.random() * 0.8;
    const g = renderer.grid;
    const origin = 1 + Math.floor(Math.random() * (g.size - 1));
    scene.titleRipples.push({ id: Math.random(), origin, born: t * 1.2, profile: [1, 1, 1, 1, 1, 1], owner: 'player', gen: 0 });
    scene.titleRipples = scene.titleRipples.filter((r) => t * 1.2 - r.born < 7);
    scene.visTick = t * 1.2;
  }

  resize();
  requestAnimationFrame(frame);
  document.getElementById('app').classList.remove('booting');
  showTitle();
  // debug/automation handle (used by tools/smoke.mjs)
  function debugAutoTurn() {
    if (!playable()) return;
    const g = renderer.grid;
    const e = ui.run.pond.enemies[0];
    if (e) {
      const ns = g.neighbors[e.cell].filter((n) => n > 0 && !ui.run.pond.rocks.includes(n));
      for (let i = 0; i < 2 && i < ns.length; i++) {
        selectSlot(ui.run.slots.findIndex((s) => s.cd === 0));
        tryThrow(ns[i * 2 % ns.length]);
      }
    }
    endTurn();
  }

  return { get run() { return ui.run; }, scene, startRun, debugAutoTurn };
}
