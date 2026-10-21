# PLAN.md — Milestones & Fortschrittsprotokoll

Jeder Milestone ist für sich spielbar. Nach Abschluss: abhaken, Notiz „Nächster Schritt“ ergänzen,
committen, pushen (Branch `claude/stoic-rubin-e2wjfn` und `main`).

## Milestones

- [x] **M1 — Fundament**: Projektgerüst, Hex-Raster, Wellenfeld-Logik, Canvas-Grundrenderer.
      Spielbar: Sandkasten-Teich, Steine werfen, Interferenz sehen, ein paar Gegner besiegen.
- [x] **M2 — Kernschleife**: Kompletter Einzelkampf: Gegner-Absichten, Bewegung, Bisse, Spawns,
      Sieg/Niederlage, Vorschau (jetzt/nächster Zug), Rückgängig, Abklingzeiten, Touch + Tastatur.
- [x] **M3 — Laufstruktur**: 3 Akte × 3 Teiche, Bosse, Gaben-Auswahl, Speicherstand + Fortsetzen.
- [x] **M4 — Inhalt & Simulation**: Alle V1-Steine/Kreaturen/Talismane, Simulations-Bot (Node),
      Balance-Report, Balance-Anpassungen (BALANCE.md).
- [x] **M5 — Meta**: Perlen, Schrein (Freischaltungen), Hüter, Schwierigkeitsstufen, Chronik/Statistik, Einstellungen.
- [ ] **M6 — Gefühl**: Juice-Pass: Partikel, Tweens, Screenshake, Kettenzähler, WebAudio-Synthese, Titel-Animation.
- [ ] **M7 — Einstieg**: Tutorial/Hinweise (erste 60 s), Tipp-Knopf, Täglicher Teich, Mobile-Feinschliff.
- [ ] **M8 — Abschluss**: Polish, Code-Review, Edge-Cases, Ladezeit, Speicherstand-Robustheit, README.

## Protokoll

- **M1 erledigt:** Core (rng, hex, field, content, mods, enemies, pond, run, preview) inkl. 22 Node-Tests;
  Canvas-Renderer (Tusche-Look, Ringe als geglättete Pfade, Wogen-Marker, Absichtspfeile), Titelbildschirm,
  spielbarer Teich mit Wurf/Zugende/Animationen. Smoke-Test (`tools/smoke.mjs`) mit Screenshots desktop+mobil ok.

- **M2 erledigt:** Rückgängig (Knopf + Z), Tastatur-Cursor (Pfeile/WASD, Enter, Leertaste, 1–4, Tab, I, Esc),
  Info-Panel (Kreatur, Absicht, Wurf-Vorschau, Fehler), Pause-Menü, Anleitung, Teich-geschafft- und
  Lauf-Ende-Screen, Banner pro Teich, Licht-Pips animiert, Ringe runder gezeichnet. Browser-Skript `tools/play-m2.mjs`.

- **M3 erledigt:** Gaben-Screen (Karten mit Profil-Balken), Ersetzen-Dialog bei vollem Beutel, Akt-Banner +
  Palettenwechsel, Speicherstand nach jeder Aktion (`core/save.js` validiert defensiv, `ui/storage.js` fällt auf
  Memory zurück), „Fortsetzen“ im Titel. 31 Tests (u. a. kompletter Lauf bis Sieg, Save-Roundtrip, korrupte Saves).

- **M4 erledigt:** `core/ai.js` (random/brute/greedy/planner + Gaben-Heuristik + autoplay), `sim/sim.mjs`
  (Worker-Threads, Report mit Siegquote, Schwierigkeitskurve, Inhalte-Nutzung, Hüter, Mondphasen).
  Balance in 9 Iterationen (siehe BALANCE.md): neue Regel „keine Würfe auf Schatten“, Zickzack-Bewegung,
  kürzere Wellen, Akt-III-Nebel. Endstand: brute 0 %, greedy 49 %, planner 81 %. 47 Tests.

- **M5 erledigt:** `core/meta.js` (Perlen-Formel, Freischaltungen, Mondphasen, Statistik, Tages-Bestwert, Sanitizing
  gegen kaputte Saves) + Tests; Screens: Hüter-/Phasenwahl, Schrein (Kauf), Chronik (Kreaturen mit Canvas-Porträts,
  Steine, Talismane, Statistik), Einstellungen (Klang, Ambiente, Lautstärke, weniger Bewegung, schnell, Vibration,
  Hinweise, Reset). Lernteich beim allerersten Lauf. 52 Tests.

## Nächster Schritt

M6: `ui/audio.js` (WebAudio-Synthese: Platsch, Glocken pentatonisch, Biss, Tod, UI, Ambiente), Juice-Pass (Steinflug, Ketten-Musik, Mond-Reaktion, Hit-Stop, Teich-Übergänge).
