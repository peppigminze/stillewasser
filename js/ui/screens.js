// DOM overlay screens as small HTML templates. Buttons carry data-act (+ data-arg).

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function profileBars(profile) {
  return profile
    .map((a) => `<i class="${a < 0 ? 'neg' : a === 0 ? 'zero' : ''}" style="height:${Math.min(20, 7 * Math.abs(a) + 3)}px"></i>`)
    .join('');
}

export function titleScreen({ canContinue, continueLabel, pearls, dailyDone, features = {}, shrineBadge = false }) {
  const f = (k) => features[k] !== false;
  return `<div class="panel title-wrap">
    <div class="stamp">静</div>
    <div class="game-title">STILLE<br>WASSER</div>
    <div class="tagline">Hüte den Mond. Wo Wellen sich treffen, entsteht Kraft.</div>
    <div class="menu">
      ${canContinue ? `<button class="btn primary" data-act="continue">Fortsetzen<span class="meta">${esc(continueLabel)}</span></button>` : ''}
      <button class="btn ${canContinue ? '' : 'primary'}" data-act="newRun">Neuer Lauf</button>
      ${f('daily') ? `<button class="btn" data-act="daily">Täglicher Teich${dailyDone ? '<span class="meta">heute schon gespielt – Bestwert verbessern?</span>' : ''}</button>` : ''}
      <div class="row">
        ${f('shrine') ? `<button class="btn small" data-act="shrine">Schrein <span class="pearls">◈ ${pearls}</span>${shrineBadge ? ' <span style="color:var(--vermilion-2)">●</span>' : ''}</button>` : ''}
        ${f('codex') ? '<button class="btn small" data-act="codex">Chronik</button>' : ''}
        <button class="btn small" data-act="howto">Anleitung</button>
        ${f('settings') ? '<button class="btn small" data-act="settings" aria-label="Einstellungen">⚙</button>' : ''}
      </div>
    </div>
    <div class="foot-note">Ein Spiel über Wellen, die sich treffen.</div>
  </div>`;
}

export function pauseScreen({ daily, features = {} }) {
  return `<div class="panel"><div class="sub">Pause</div><h2>Stille</h2><span class="brush"></span>
    <div class="menu">
      <button class="btn primary" data-act="resume">Weiter</button>
      <button class="btn" data-act="howto">Anleitung</button>
      ${features.settings === false ? '' : '<button class="btn" data-act="settings">Einstellungen</button>'}
      <button class="btn" data-act="toTitle">Zum Titel (Lauf wird gespeichert)</button>
      <button class="btn danger" data-act="abandon">${daily ? 'Täglichen Teich aufgeben' : 'Lauf aufgeben'}</button>
    </div></div>`;
}

export function confirmScreen(text, yesAct, noAct = 'back') {
  return `<div class="panel"><h2 style="font-size:22px">${esc(text)}</h2><span class="brush"></span>
    <div class="menu"><button class="btn danger" data-act="${yesAct}">Ja</button><button class="btn" data-act="${noAct}">Nein</button></div></div>`;
}

export function howtoScreen() {
  return `<div class="panel"><div class="sub">Anleitung</div><h2>Wie Wasser denkt</h2><span class="brush"></span>
    <ol class="howto">
      <li><b>Der Mond</b> liegt in der Mitte. Schatten kriechen vom Ufer heran und beißen ihm <b>Licht</b> ab. Licht 0 = Lauf vorbei.</li>
      <li>Du greifst nie direkt an. Du <b>wirfst Steine</b> (meist 2 pro Zug). Jeder Stein schlägt eine Welle, die jeden Zug um <b>einen Ring</b> wächst. Steine landen nur im freien Wasser, nie auf Schatten. Felsen werfen Wellenschatten.</li>
      <li>Eine Welle allein ist harmlos. <b>Wo sich Wellen überlagern</b>, addieren sich ihre Stärken. Ab Stärke 2 entsteht eine <b style="color:var(--gold)">Woge</b>: Schaden = Stärke − 1.</li>
      <li><b style="color:var(--violet)">Dunkle Wellen</b> (−1) löschen helle aus. Zwei dunkle zusammen: ein <b style="color:var(--violet)">Sog</b> – trifft ebenso.</li>
      <li>Jeder besiegte Schatten sendet eine <b>Todeswelle</b>. Treffen die auf andere Wellen, entstehen <b>Ketten</b>.</li>
      <li>Alles ist sichtbar: <b>volle goldene Felder</b> = Woge beim Zugende (mit Schaden), <b>gestrichelte</b> = Woge im nächsten Zug, <b>Pfeile</b> = was die Schatten tun.</li>
      <li>Nach jedem Teich: eine <b>Gabe</b> (Stein, Talisman oder Licht). 3 Akte, jeder endet mit einem Boss.</li>
    </ol>
    <h3>Steuerung</h3>
    <ul class="howto">
      <li><b>Touch:</b> Feld antippen = Vorschau, nochmal tippen = werfen.</li>
      <li><b>Maus:</b> Zeigen = Vorschau, Klick = werfen.</li>
      <li><b>Tastatur:</b> <span class="kbd">←↑→↓</span>/<span class="kbd">WASD</span> Feld, <span class="kbd">Enter</span> werfen, <span class="kbd">1–4</span> Stein, <span class="kbd">Leertaste</span> Zug beenden, <span class="kbd">Z</span> rückgängig, <span class="kbd">T</span> Tipp, <span class="kbd">I</span> Absichten an/aus, <span class="kbd">Esc</span> Menü.</li>
    </ul>
    <div class="menu" style="margin-top:16px"><button class="btn primary" data-act="back">Verstanden</button></div></div>`;
}

export function runEndScreen({ won, stats, pearls, newPhase, score, best, daily, reasonText, unlockedText }) {
  const rows = [
    ['Schatten besiegt', stats.kills],
    ['Teiche', stats.ponds],
    ['Längste Kette', stats.chainMax ? `×${stats.chainMax}` : '–'],
    ['Wogen', stats.surges],
    ['Würfe', stats.throws],
    ['Punkte', score],
  ];
  if (daily) rows.push(['Tagesbestwert', best]);
  return `<div class="panel"><div class="sub">${won ? 'Morgengrauen' : 'Der Mond erlischt'}</div>
    <h2>${won ? 'Der Teich ist still.' : 'Dunkelheit.'}</h2><span class="brush"></span>
    <p style="text-align:center">${esc(reasonText)}</p>
    <dl class="stats">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
    ${pearls ? `<p style="text-align:center" class="pearls">+ ◈ ${pearls} Perlen</p>` : ''}
    ${newPhase ? `<p style="text-align:center;color:var(--gold)">Neue Mondphase freigeschaltet: ${esc(newPhase)}</p>` : ''}
    ${unlockedText ? `<p style="text-align:center;color:var(--teal)">${esc(unlockedText)}</p>` : ''}
    <div class="menu"><button class="btn primary" data-act="newRun">Neuer Lauf</button>
    <button class="btn" data-act="toTitle">Zum Titel</button></div></div>`;
}

function stoneCard(st, i, extra = '') {
  const flags = [];
  if (st.cooldown) flags.push(`Abklingzeit ${st.cooldown}`);
  else flags.push('jeden Zug');
  if (st.free) flags.push('kostet keinen Wurf');
  return `<button class="card" data-act="pick" data-arg="${i}">${extra}
    <span class="kind stone">Stein</span><span class="cg">${st.glyph}</span>
    <span class="cn">${esc(st.name)}</span><span class="cd">${esc(st.desc)}</span>
    <span class="cd" style="color:var(--muted);font-size:12px">${flags.join(' · ')}</span>
    <span class="prof">${profileBars(st.profile)}</span></button>`;
}

export function rewardScreen({ run, content, title, sub, healText }) {
  const cards = run.reward.options.map((o, i) => {
    if (o.kind === 'stone') return stoneCard(content.stones[o.id], i);
    if (o.kind === 'talisman') {
      const t = content.talismans[o.id];
      return `<button class="card" data-act="pick" data-arg="${i}"><span class="kind talisman">Talisman</span>
        <span class="cg" style="color:var(--gold)">${t.glyph}</span><span class="cn">${esc(t.name)}</span><span class="cd">${esc(t.desc)}</span></button>`;
    }
    return `<button class="card" data-act="pick" data-arg="${i}"><span class="kind heal">Mondlicht</span>
      <span class="cg" style="color:var(--teal)">◐</span><span class="cn">+${o.amount} Licht</span>
      <span class="cd">Jetzt ${run.light}/${run.maxLight}. Heilt den Mond.</span></button>`;
  });
  const pouch = run.slots.map((s) => `${content.stones[s.stone].glyph} ${esc(content.stones[s.stone].name)}`).join(' · ');
  const tal = run.talismans.map((t) => `${content.talismans[t].glyph} ${esc(content.talismans[t].name)}`).join(' · ');
  return `<div class="panel"><div class="sub">${esc(sub)}</div><h2>${esc(title)}</h2><span class="brush"></span>
    ${healText ? `<p style="text-align:center;color:var(--teal);margin:0">${esc(healText)}</p>` : ''}
    <p style="text-align:center;margin:6px 0 0">Wähle eine Gabe.</p>
    <div class="cards">${cards.join('')}</div>
    <p style="font-size:13px;text-align:center;margin:4px 0">Beutel: ${pouch}${tal ? `<br>Talismane: ${tal}` : ''}<br>Licht: ${run.light}/${run.maxLight}</p>
    <div class="menu" style="margin-top:12px"><button class="btn small" data-act="skip">Keine Gabe nehmen</button></div></div>`;
}

export function replaceScreen({ run, content, stoneId }) {
  const st = content.stones[stoneId];
  const btns = run.slots.map((s, i) => {
    const o = content.stones[s.stone];
    return `<button class="btn" data-act="replace" data-arg="${i}">${o.glyph} ${esc(o.name)}<span class="meta">ersetzen</span></button>`;
  });
  return `<div class="panel"><div class="sub">Beutel voll</div><h2>${st.glyph} ${esc(st.name)}</h2><span class="brush"></span>
    <p style="text-align:center">Dein Beutel fasst ${run.slots.length} Steine. Welchen gibst du dem Teich zurück?</p>
    <div class="slot-pick">${btns.join('')}</div>
    <div class="menu"><button class="btn small" data-act="back">Abbrechen</button></div></div>`;
}

export function keeperScreen({ content, meta, isUnlocked, selKeeper, selPhase }) {
  const cards = content.keeperList.map((k) => {
    const open = isUnlocked(meta, 'keeper', k.id, content);
    const wins = meta.stats.winsByKeeper[k.id] || 0;
    const stones = k.stones.map((s) => content.stones[s].glyph).join(' ');
    const tal = k.talismans.map((t) => content.talismans[t].glyph).join(' ');
    if (!open) {
      return `<button class="card locked" data-act="shrine" title="Im Schrein freischalten"><span class="kind">Verschlossen</span>
        <span class="cg">${k.glyph}</span><span class="cn">${esc(k.name)}</span><span class="cd">${esc(k.desc)}</span>
        <span class="cost">◈ ${k.unlock}</span></button>`;
    }
    return `<button class="card ${k.id === selKeeper ? 'selected' : ''}" data-act="selKeeper" data-arg="${k.id}">
      <span class="kind">Hüter${wins ? ` · ${wins}× gesiegt` : ''}</span><span class="cg">${k.glyph}</span>
      <span class="cn">${esc(k.name)}</span><span class="cd">${esc(k.desc)}</span>
      <span class="cd" style="color:var(--paper)">${stones}${tal ? ` · <span style="color:var(--gold)">${tal}</span>` : ''} · ☾ ${k.light}</span></button>`;
  });
  const phases = content.phases.slice(0, meta.maxPhase + 1).map((p) =>
    `<button class="btn small ${p.id === selPhase ? 'primary' : ''}" data-act="selPhase" data-arg="${p.id}">${esc(p.name)}</button>`).join('');
  const ph = content.phases[selPhase];
  const effects = content.phases.slice(1, selPhase + 1).map((p) => esc(p.desc)).join(' · ');
  return `<div class="panel" style="width:min(100%,720px)"><div class="sub">Neuer Lauf</div><h2>Wer hütet den Mond?</h2><span class="brush"></span>
    <div class="cards">${cards.join('')}</div>
    ${meta.maxPhase > 0 ? `<h3 style="text-align:center">Mondphase</h3><div class="row">${phases}</div>
      <p style="text-align:center;font-size:13px">${esc(ph.name)}${effects ? `: ${effects}` : ' – die Grundschwierigkeit.'}</p>` : ''}
    <div class="menu" style="margin-top:14px"><button class="btn primary" data-act="startRun">Zum Teich</button>
    <button class="btn small" data-act="back">Zurück</button></div></div>`;
}

export function shrineScreen({ content, meta, tab, isUnlocked }) {
  const lists = { stone: content.stoneList, talisman: content.talismanList, keeper: content.keeperList };
  const labels = { stone: 'Steine', talisman: 'Talismane', keeper: 'Hüter' };
  const tabs = Object.keys(lists).map((k) => `<button class="btn small ${k === tab ? 'active' : ''}" data-act="shrineTab" data-arg="${k}">${labels[k]}</button>`).join('');
  const cards = lists[tab].map((it) => {
    const open = isUnlocked(meta, tab, it.id, content);
    const can = !open && meta.pearls >= it.unlock;
    const glyph = it.glyph || '•';
    const prof = tab === 'stone' ? `<span class="prof">${profileBars(it.profile)}</span>` : '';
    return `<button class="card ${open ? 'owned' : 'locked'}" ${can ? `data-act="buy" data-arg="${tab}:${it.id}"` : 'disabled'} style="${can ? 'opacity:1' : ''}">
      <span class="kind ${tab}">${open ? (it.unlock ? 'Freigeschaltet' : 'Von Anfang an') : can ? 'Freischalten' : 'Zu teuer'}</span>
      <span class="cg">${glyph}</span><span class="cn">${esc(it.name)}</span><span class="cd">${esc(it.desc)}</span>${prof}
      <span class="cost">${open ? '✓' : `◈ ${it.unlock}`}</span></button>`;
  }).join('');
  return `<div class="panel" style="width:min(100%,720px)"><div class="sub">Schrein</div><h2>Perlen für den Teich</h2><span class="brush"></span>
    <p style="text-align:center">Du hast <span class="pearls">◈ ${meta.pearls}</span> Perlen. Freigeschaltetes erscheint in künftigen Läufen als Gabe.</p>
    <div class="tabs">${tabs}</div><div class="cards">${cards}</div>
    <div class="menu"><button class="btn small" data-act="back">Zurück</button></div></div>`;
}

export function codexScreen({ content, meta, tab }) {
  const labels = { creatures: 'Kreaturen', stones: 'Steine', talismans: 'Talismane', stats: 'Statistik' };
  const tabs = Object.keys(labels).map((k) => `<button class="btn small ${k === tab ? 'active' : ''}" data-act="codexTab" data-arg="${k}">${labels[k]}</button>`).join('');
  let body = '';
  if (tab === 'creatures') {
    body = `<div class="codex">${content.enemyList.map((e) => {
      const seen = meta.seen.enemies.includes(e.id);
      if (!seen) return '<div class="entry unknown"><b>???</b>Noch nicht begegnet.</div>';
      return `<div class="entry"><canvas width="120" height="76" data-creature="${e.id}" style="width:120px;height:76px"></canvas><b>${esc(e.name)}</b>
        ${e.hostile === false ? '' : `♥ ${e.hp}${e.armor ? ` · Panzer ${e.armor}` : ''}${e.bite ? ` · Biss ${e.bite}` : ''}<br>`}${esc(e.desc)}</div>`;
    }).join('')}</div>`;
  } else if (tab === 'stones' || tab === 'talismans') {
    const list = tab === 'stones' ? content.stoneList : content.talismanList;
    body = `<div class="codex">${list.map((it) => {
      const seen = meta.seen[tab].includes(it.id);
      if (!seen) return '<div class="entry unknown"><b>???</b>Noch nicht gefunden.</div>';
      const prof = tab === 'stones' ? `<div class="card" style="min-height:0;padding:4px;border:none;background:none"><span class="prof">${profileBars(it.profile)}</span></div>` : '';
      return `<div class="entry"><b>${it.glyph} ${esc(it.name)}</b>${esc(it.desc)}${prof}</div>`;
    }).join('')}</div>`;
  } else {
    const s = meta.stats;
    const rows = [
      ['Läufe', s.runs], ['Siege', s.wins], ['Höchste besiegte Mondphase', s.bestPhaseWon >= 0 ? content.phases[s.bestPhaseWon].name : '–'],
      ['Schatten besiegt', s.kills], ['Teiche befreit', s.ponds], ['Irrlichter', s.wisps], ['Längste Kette', s.bestChain ? `×${s.bestChain}` : '–'],
      ['Bester Punktestand', s.bestScore], ['Perlen gesammelt', s.pearlsTotal], ['Täglicher Teich (heute)', meta.daily.best || '–'],
    ];
    body = `<dl class="stats">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  }
  return `<div class="panel" style="width:min(100%,720px)"><div class="sub">Chronik</div><h2>Was der Teich erzählt</h2><span class="brush"></span>
    <div class="tabs">${tabs}</div>${body}<div class="menu" style="margin-top:16px"><button class="btn small" data-act="back">Zurück</button></div></div>`;
}

export function settingsScreen({ settings, persistent }) {
  const t = (key, label) => `<label class="toggle"><span>${label}</span><input type="checkbox" data-setting="${key}" ${settings[key] ? 'checked' : ''}></label>`;
  return `<div class="panel"><div class="sub">Einstellungen</div><h2>Stille einstellen</h2><span class="brush"></span>
    <div class="settings">
      ${t('sfx', 'Klänge')}
      ${t('ambient', 'Teich-Ambiente')}
      <label class="toggle"><span>Lautstärke</span><input type="range" min="0" max="1" step="0.05" value="${settings.volume}" data-setting="volume"></label>
      ${t('reduced', 'Weniger Bewegung (kein Wackeln, weniger Partikel)')}
      ${t('fast', 'Schnelle Animationen')}
      ${t('vibrate', 'Vibration bei Bissen (Handy)')}
      ${t('tips', 'Hinweise & Tipp-Knopf')}
      <button class="btn small danger" data-act="resetAsk">Fortschritt löschen</button>
      ${persistent ? '' : '<p style="font-size:12px;color:var(--vermilion-2)">Achtung: Dein Browser erlaubt keinen Speicher. Fortschritt geht beim Schließen verloren.</p>'}
    </div>
    <div class="menu" style="margin-top:14px"><button class="btn primary" data-act="back">Fertig</button></div></div>`;
}
