# PLAN.md — Milestones & Fortschrittsprotokoll

Jeder Milestone ist für sich spielbar. Nach Abschluss: abhaken, Notiz „Nächster Schritt“ ergänzen,
committen, pushen (Branch `claude/stoic-rubin-e2wjfn` und `main`).

## Milestones

- [ ] **M1 — Fundament**: Projektgerüst, Hex-Raster, Wellenfeld-Logik, Canvas-Grundrenderer.
      Spielbar: Sandkasten-Teich, Steine werfen, Interferenz sehen, ein paar Gegner besiegen.
- [ ] **M2 — Kernschleife**: Kompletter Einzelkampf: Gegner-Absichten, Bewegung, Bisse, Spawns,
      Sieg/Niederlage, Vorschau (jetzt/nächster Zug), Rückgängig, Abklingzeiten, Touch + Tastatur.
- [ ] **M3 — Laufstruktur**: 3 Akte × 3 Teiche, Bosse, Gaben-Auswahl, Speicherstand + Fortsetzen.
- [ ] **M4 — Inhalt & Simulation**: Alle V1-Steine/Kreaturen/Talismane, Simulations-Bot (Node),
      Balance-Report, Balance-Anpassungen (BALANCE.md).
- [ ] **M5 — Meta**: Perlen, Schrein (Freischaltungen), Hüter, Schwierigkeitsstufen, Chronik/Statistik, Einstellungen.
- [ ] **M6 — Gefühl**: Juice-Pass: Partikel, Tweens, Screenshake, Kettenzähler, WebAudio-Synthese, Titel-Animation.
- [ ] **M7 — Einstieg**: Tutorial/Hinweise (erste 60 s), Tipp-Knopf, Täglicher Teich, Mobile-Feinschliff.
- [ ] **M8 — Abschluss**: Polish, Code-Review, Edge-Cases, Ladezeit, Speicherstand-Robustheit, README.

## Protokoll

- (noch leer)

## Nächster Schritt

M1 bauen: `js/core/{rng,hex,field,content}.js`, Tests, Canvas-Renderer, Sandkasten-Teich.
