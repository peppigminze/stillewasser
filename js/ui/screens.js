// DOM overlay screens as small HTML templates. Buttons carry data-act (+ data-arg).

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function profileBars(profile) {
  return profile
    .map((a) => `<i class="${a < 0 ? 'neg' : a === 0 ? 'zero' : ''}" style="height:${Math.min(20, 7 * Math.abs(a) + 3)}px"></i>`)
    .join('');
}

export function titleScreen({ canContinue, continueLabel, pearls, dailyDone, features = {} }) {
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
        ${f('shrine') ? `<button class="btn small" data-act="shrine">Schrein <span class="pearls">◈ ${pearls}</span></button>` : ''}
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
      <li>Du greifst nie direkt an. Du <b>wirfst Steine</b> (meist 2 pro Zug). Jeder Stein schlägt eine Welle, die jeden Zug um <b>einen Ring</b> wächst. Felsen werfen Wellenschatten.</li>
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

export function pondClearScreen({ title, sub, healText }) {
  return `<div class="panel"><div class="sub">${esc(sub)}</div><h2>${esc(title)}</h2><span class="brush"></span>
    ${healText ? `<p style="text-align:center;color:var(--teal)">${esc(healText)}</p>` : ''}
    <div class="menu"><button class="btn primary" data-act="nextPond">Weiter</button></div></div>`;
}
