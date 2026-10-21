# CLAUDE.md — Architektur & Konventionen

Browser-Game, reines HTML/CSS/Vanilla-JS (ES-Module). Kein Framework, kein Build-Step, kein Backend.
Hosting: GitHub Pages (Branch `main`, Root). Konzept: siehe `SECRET_CONCEPT.md`.

## Befehle

```bash
npm test                 # node --test tests/*.test.mjs (keine Abhängigkeiten nötig)
npm run check            # Syntax-Check aller JS-Dateien + Content-Validierung
npm run sim              # Balance-Simulation (schreibt sim/report.md)
npx http-server -c-1 .   # lokal spielen: http://localhost:8080 (file:// geht nicht wegen fetch)
node tools/smoke.mjs [--mobile|--viewport=WxH] [--script=tools/play-*.mjs]
                         # Headless-Browser-Test (globales Playwright), Screenshots in tools/screens/
```

`package.json` existiert nur für `"type": "module"` und Skripte — es gibt keine Dependencies.

## Struktur

```
index.html            Einstieg, statisches DOM-Gerüst (HUD, Screens)
css/style.css         Gesamtes Styling (CSS-Variablen für Akt-Paletten)
js/main.js            Bootstrap: Content laden, Meta laden, UI starten
js/core/              REINE SPIELLOGIK — kein DOM, kein window, kein Math.random, kein Date
  rng.js              Seed-PRNG (mulberry32), Zustand liegt als uint32 im State (`obj.rng`)
  hex.js              Axiale Hex-Koordinaten, Raster-Cache, Distanzen, BFS
  field.js            Wellen → Amplitudenfeld, Wogen/Sog, Ringe (memoisiert pro Teich-Layout)
  content.js          Content indexieren + validieren
  mods.js             Modifikatoren aus Talismanen/Hüter/Mondphase aggregieren
  enemies.js          Kreatur-Verhalten: Absichten (Intents) & Aktionen
  pond.js             Kampf-Zustandsmaschine (Wurf, Rückgängig, Zugende-Auflösung)
  run.js              Lauf-Zustandsmaschine (Akte, Teiche, Gaben, Sieg/Niederlage) — `step(run, action, content)`
  preview.js          Vorschau/Forecast (reine Funktionen auf Klonen)
  ai.js               Bot-Strategien (Simulation + „Tipp“-Knopf)
  meta.js             Meta-Progression (Perlen, Freischaltungen, Statistiken) + Sanitizing
  save.js             (De-)Serialisierung + Validierung von Spielständen
js/ui/                Alles mit DOM/Canvas/Audio
  app.js              UI-Controller (Screens, Input → Actions, Event-Animationen)
  render.js           Canvas-Renderer (Teich, Wellen, Kreaturen, Marker)
  fx.js               Partikel, Floating-Text, Screenshake, Tweens
  audio.js            WebAudio-Synthese (keine Audiodateien)
  input.js            Pointer/Touch/Tastatur → semantische Eingaben
  storage.js          localStorage-Wrapper (try/catch, In-Memory-Fallback)
  screens.js          DOM-Overlays (Titel, Gaben, Schrein, Chronik, Einstellungen …)
data/*.json           ALLE Inhalte & Balance-Zahlen (Steine, Kreaturen, Talismane, Akte, Hüter, Phasen, Hinweise, Regeln)
tests/*.test.mjs      node:test — Logik, Content, Determinismus, Speicherstand
sim/                  Simulations-Bot + Balance-Auswertung
tools/                check.mjs (Syntax/Content), smoke.mjs + play-*.mjs (Browser-Szenarien)
```

## Architektur-Regeln

1. **Core ist rein.** Alle Funktionen in `js/core` sind deterministisch und DOM-frei. Öffentliche
   Reducer klonen ihren Input (`structuredClone`) und geben `{ run, events }` zurück — der Input wird
   nie mutiert. Intern dürfen Hilfsfunktionen einen Draft mutieren (Konvention: Parameter heißt `d`).
2. **Content wird injiziert.** Core-Funktionen bekommen das indexierte `content`-Objekt als Parameter.
   Browser lädt JSON per `fetch`, Node per `fs` (`tests/helpers.mjs`).
3. **Events treiben die UI.** Die UI berechnet nie Spielregeln selbst; sie spielt die Events
   (`surge`, `hit`, `death`, `move`, `bite`, `spawn` …) als Animationen ab und rendert dann den neuen State.
4. **Zufall nur über `rng.js`.** Seed liegt im State → Speicherstände sind reproduzierbar.
5. **Kein Over-Engineering.** Was nicht V1 ist → `BACKLOG.md`.

## Zeitmodell eines Zuges (wichtig!)

`tick` = Zeitindex des Wasserfelds. Eine Welle mit `born = b` hat bei Tick `t` den Radius `t − b`.

1. Spielerphase: Würfe erzeugen Wellen mit `born = tick` (Radius 0 = Aufschlagfeld). Rückgängig erlaubt.
2. Auflösung: Feld bei `tick` berechnen → Wogen/Sog treffen Kreaturen. Tote erzeugen Todeswellen
   (`born = tick`, Profil beginnt mit 0 → erst ab Radius 1 sichtbar → Resonanz möglich).
3. Kreaturphase: jede Kreatur führt `pattern[age % len]` aus (move/bite/emit/hatch/dash/wander/rest).
   Emissionen entstehen mit `born = tick + 1`.
4. Spawns materialisieren, neue Spawns werden für den nächsten Zug angekündigt.
5. `tick++`, Abklingzeiten −1, Würfe zurücksetzen, Sieg/Niederlage prüfen.

## Konventionen

- Code-Bezeichner Englisch, Content-IDs ASCII-kleingeschrieben (deutsch), **UI-Texte Deutsch**.
- 2 Spaces, Semikolons, `const` bevorzugt, kleine Funktionen, keine Klassen in `core` (Plain Objects).
- Zellen werden als Index ins Raster (`grid.cells[i]`) gespeichert, nie als Objekt.
- localStorage-Keys: `stillewasser.meta.v1`, `stillewasser.run.v1`. Immer über `ui/storage.js`.
- Jede Balance-Zahl gehört nach `data/` (v. a. `data/rules.json`), nicht in den Code.
- Commits: `M<n>: <kurze Beschreibung>`; nach jedem Milestone `PLAN.md` abhaken.
- Doku: Entscheidungen → `DECISIONS.md`, Balance → `BALANCE.md`, später → `BACKLOG.md`.

## Debug-Handle

`window.__stille` (nur für Tests/Konsole): `startRun()`, `debugAutoTurn()`, `debugPlanTurn()`,
`debugWinPond()`, `setSpeed(n)`, `cellPos(cell)`, `run`, `stack`, `scene`.

## Tests

- `tests/hex.test.mjs`, `field.test.mjs`, `pond.test.mjs`, `run.test.mjs` (inkl. Speicherstand),
  `meta.test.mjs`, `content.test.mjs`, `ai.test.mjs`.
- Neue Regel ⇒ neuer Test. Bugfix ⇒ Regressionstest.
