// WebAudio synthesis — no audio files. Quiet by design; everything can be
// switched off. The AudioContext starts on the first user gesture.

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26];

export function createAudio() {
  let ctx = null;
  let master = null;
  let sfxBus = null;
  let ambBus = null;
  let noiseBuf = null;
  let ambient = null;
  let settings = { sfx: true, ambient: true, volume: 0.7 };
  const lastPlayed = new Map();

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 4;
      master = ctx.createGain();
      master.connect(comp);
      comp.connect(ctx.destination);
      sfxBus = ctx.createGain();
      ambBus = ctx.createGain();
      sfxBus.connect(master);
      ambBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      apply();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function apply() {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(settings.volume * 0.9, t, 0.05);
    sfxBus.gain.setTargetAtTime(settings.sfx ? 1 : 0, t, 0.05);
    ambBus.gain.setTargetAtTime(settings.ambient ? 1 : 0, t, 0.3);
    if (settings.ambient && settings.volume > 0) startAmbient();
    else stopAmbient();
  }

  // rate limiting so 20 simultaneous surges do not become noise
  function allow(key, gapMs) {
    const now = performance.now();
    if (now - (lastPlayed.get(key) || 0) < gapMs) return false;
    lastPlayed.set(key, now);
    return true;
  }

  function ready() {
    return ctx && settings.sfx && settings.volume > 0 && ctx.state === 'running';
  }

  function env(g, t, a, peak, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + decay);
  }

  function osc(type, freq, t, dur, peak, dest, attack = 0.005) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    env(g, t, attack, peak, dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
    return o;
  }

  function noise(t, dur, peak, filterType, f0, f1, dest, q = 1) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain();
    env(g, t, 0.004, peak, dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  function panner(pan) {
    if (!ctx.createStereoPanner) return sfxBus;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(sfxBus);
    return p;
  }

  const sfx = {
    splash(pan = 0, size = 1) {
      if (!ready() || !allow('splash', 40)) return;
      const t = ctx.currentTime;
      const out = panner(pan);
      noise(t, 0.16 * size, 0.18, 'bandpass', 1400, 380, out, 1.4);
      const o = osc('sine', 340, t, 0.12, 0.22, out);
      o.frequency.exponentialRampToValueAtTime(120, t + 0.12);
    },
    surge(amp, index = 0, gen = 0) {
      if (!ready() || !allow(`surge${index % 4}`, 25)) return;
      const neg = amp < 0;
      const step = PENTA[Math.min(PENTA.length - 1, index + gen * 2 + Math.max(0, Math.abs(amp) - 2) * 2)];
      const base = neg ? 196 : 392;
      const f = base * Math.pow(2, step / 12);
      const t = ctx.currentTime + 0.005;
      const out = sfxBus;
      osc('sine', f, t, 1.3, 0.09, out, 0.004);
      osc('sine', f * 2.76, t, 0.6, 0.03, out, 0.002);
      osc('triangle', f * 5.4, t, 0.25, 0.012, out, 0.001);
      if (neg) {
        const o = osc('sine', f * 0.5, t, 0.9, 0.05, out, 0.02);
        o.detune.setValueAtTime(-14, t);
      }
    },
    hit() {
      if (!ready() || !allow('hit', 30)) return;
      const t = ctx.currentTime;
      noise(t, 0.06, 0.12, 'highpass', 2200, 1200, sfxBus);
    },
    death(big = false) {
      if (!ready() || !allow('death', 50)) return;
      const t = ctx.currentTime;
      const o = osc('sine', big ? 220 : 520, t, big ? 0.9 : 0.35, 0.16, sfxBus, 0.01);
      o.frequency.exponentialRampToValueAtTime(big ? 40 : 90, t + (big ? 0.9 : 0.35));
      noise(t, big ? 0.6 : 0.25, 0.08, 'lowpass', 900, 120, sfxBus);
      if (big) osc('sine', 98, t + 0.05, 1.6, 0.12, sfxBus, 0.05);
    },
    bite() {
      if (!ready() || !allow('bite', 80)) return;
      const t = ctx.currentTime;
      const o = osc('triangle', 90, t, 0.35, 0.3, sfxBus, 0.004);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.3);
      noise(t, 0.18, 0.15, 'lowpass', 600, 80, sfxBus);
    },
    emit() {
      if (!ready() || !allow('emit', 80)) return;
      const t = ctx.currentTime;
      const o = osc('sine', 130, t, 0.7, 0.08, sfxBus, 0.12);
      o.frequency.exponentialRampToValueAtTime(82, t + 0.7);
    },
    spawn() {
      if (!ready() || !allow('spawn', 60)) return;
      const t = ctx.currentTime;
      const o = osc('sine', 520, t, 0.09, 0.07, sfxBus);
      o.frequency.exponentialRampToValueAtTime(900, t + 0.08);
    },
    ui() {
      if (!ready() || !allow('ui', 30)) return;
      osc('sine', 1320, ctx.currentTime, 0.04, 0.035, sfxBus);
    },
    deny() {
      if (!ready() || !allow('deny', 120)) return;
      const t = ctx.currentTime;
      osc('square', 150, t, 0.08, 0.03, sfxBus);
      osc('square', 110, t + 0.07, 0.1, 0.03, sfxBus);
    },
    heal() {
      if (!ready()) return;
      const t = ctx.currentTime;
      [0, 4, 7].forEach((s, i) => osc('sine', 523 * Math.pow(2, s / 12), t + i * 0.07, 0.5, 0.05, sfxBus));
    },
    pondWon() {
      if (!ready()) return;
      const t = ctx.currentTime;
      [0, 2, 4, 7, 9, 12, 16].forEach((s, i) => osc('sine', 392 * Math.pow(2, s / 12), t + i * 0.09, 1.2, 0.06, sfxBus));
    },
    runWon() {
      if (!ready()) return;
      const t = ctx.currentTime;
      [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => {
        osc('sine', 330 * Math.pow(2, s / 12), t + i * 0.12, 2, 0.06, sfxBus);
        osc('triangle', 660 * Math.pow(2, s / 12), t + i * 0.12, 0.6, 0.015, sfxBus);
      });
    },
    runLost() {
      if (!ready()) return;
      const t = ctx.currentTime;
      [12, 10, 7, 3, 0].forEach((s, i) => osc('sine', 220 * Math.pow(2, s / 12), t + i * 0.22, 1.1, 0.06, sfxBus, 0.02));
    },
  };

  function startAmbient() {
    if (!ctx || ambient) return;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.05, t + 3);
    out.connect(ambBus);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    lp.connect(out);
    const drones = [55, 82.4, 110.2].map((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.detune.value = (i - 1) * 6;
      const g = ctx.createGain();
      g.gain.value = i === 2 ? 0.25 : 0.5;
      o.connect(g);
      g.connect(lp);
      o.start();
      return o;
    });
    // water: filtered noise with a slow LFO on the filter
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500;
    bp.Q.value = 0.7;
    const ng = ctx.createGain();
    ng.gain.value = 0.35;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain);
    lfoGain.connect(bp.frequency);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(out);
    src.start();
    lfo.start();
    // occasional soft drips
    const drip = setInterval(() => {
      if (!ctx || ctx.state !== 'running' || Math.random() < 0.4) return;
      const tt = ctx.currentTime;
      const o = osc('sine', 900 + Math.random() * 700, tt, 0.12, 0.012, out);
      o.frequency.exponentialRampToValueAtTime(300, tt + 0.1);
    }, 2300);
    ambient = { out, nodes: [...drones, src, lfo], drip };
  }

  function stopAmbient() {
    if (!ambient || !ctx) return;
    const a = ambient;
    ambient = null;
    clearInterval(a.drip);
    a.out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
    setTimeout(() => a.nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } }), 2000);
  }

  return {
    unlock() { ensure(); },
    set(s) {
      settings = { ...settings, ...s };
      apply();
    },
    sfx,
  };
}
