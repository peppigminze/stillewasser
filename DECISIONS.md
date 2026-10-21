# DECISIONS.md — Entscheidungsprotokoll

Format: Datum · Entscheidung · Begründung. Neueste unten.

## Setup

- **2026-10-21 · Konzept „Projekt X“ gewählt** (Details in `SECRET_CONCEPT.md`).
  Begründung: rundenbasiert ⇒ voll deterministisch ⇒ ideal für Node-Tests und Simulations-Bot;
  Mechanik (Schaden nur durch Wellen-Interferenz) ist neu und visuell stark.
- **Branches:** Entwicklung auf `claude/stoic-rubin-e2wjfn` (Vorgabe der Umgebung), jeder Stand wird
  zusätzlich nach `main` gepusht (ausdrücklicher Wunsch: GitHub Pages von `main`/Root).
- **GitHub Pages per API:** Die Umgebung (Agent-Proxy) blockiert den API-Pfad
  `/repos/{owner}/{repo}/pages` mit „Access to this GitHub API path is not permitted through this proxy“
  und `*.github.io` ist ebenfalls nicht erreichbar. Laut Proxy-Regeln wird das nicht umgangen.
  ⇒ Pages muss einmalig manuell aktiviert werden (Settings → Pages → Deploy from branch → `main` / `/ (root)`).
  `.nojekyll` liegt bereit, damit Pages die Dateien unverändert ausliefert.
- **Default-Branch:** Da das leere Repo zuerst den Arbeits-Branch erhielt, hat GitHub `claude/stoic-rubin-e2wjfn`
  zum Default gemacht. Zurückstellen per API scheitert ebenfalls am Proxy („Repository settings writes are not
  permitted“). Beide Branches sind inhaltsgleich; optional in Settings → General → Default branch auf `main` stellen.
- **Token:** wird ausschließlich über `$GH_TOKEN` aus der Umgebung gelesen, nie ausgegeben/gespeichert.
- **Kein Build-Step, keine Dependencies:** `package.json` nur für `"type":"module"` + npm-Skripte.
  Tests mit `node:test` (Node 22 vorhanden). Smoke-Test nutzt das global installierte Playwright, falls vorhanden.
- **Sprache:** UI komplett Deutsch, Code-Bezeichner Englisch.
- **Hex-Raster (flat-top, Radius 5 = 91 Felder):** Ringe sehen auf Hex natürlicher aus als auf
  Quadraten (6 Nachbarn, gleichmäßige Ausbreitung). Flat-top ist höher als breit und passt hochkant aufs Handy.
- **Wellen laufen per BFS um Felsen** statt per Luftlinie: einfache Regel, erzeugt „Wellenschatten“
  und macht Felsen taktisch relevant.
- **Keine externen Fonts:** System-Serif-Stack statt Google Fonts ⇒ null externe Requests, schneller Start.

## M4 — Simulation & Balance

- **Steine dürfen nicht auf Kreaturen landen.** Ohne diese Regel „reitet“ eine Kreatur auf dem Ring eines Steins,
  der auf ihr gelandet ist (Ring und Kreatur bewegen sich gleich schnell) → triviale Dauertreffer, selbst ein
  dummer Bot gewann 75 %. Damit entfällt die frühere „Resonanz“-Idee (Stein + Todeswelle am selben Ort).
- **Kreaturen schlängeln sich** (wechseln bei zwei gleich kurzen Wegen die Richtung). Natürlicher Look und
  weniger „Mitreiten“ hinter geraden Läufern.
- **Akt-Regeln statt nur mehr Gegner:** Mehr Kreaturen machten das Spiel kaum schwerer (mehr Todeswellen = mehr
  Ketten). Akt III bekommt deshalb eine sichtbare Umweltregel (Nebel). Generisch über `act.mods` in `acts.json`.
- **Bot-Strategien liegen in `js/core/ai.js`**, damit der Tipp-Knopf im Spiel dieselbe Logik nutzt.
- Details und Zahlen: `BALANCE.md`.

## M5–M8 — Meta, Gefühl, Einstieg, Abschluss

- **Perlen-Formel** (`rules.json → pearls`): Teiche ×2, Bosse ×4, Kills/8, Irrlichter ×1, Sieg +12, je Mondphase +25 %.
  Ein schwacher Lauf bringt ~5–10 Perlen, ein guter ~50 → erste Freischaltung nach 1–2 Läufen, alles nach ~8–10.
- **Freischaltungen erweitern nur den Gaben-Pool**, machen also nicht automatisch stärker, sondern vielfältiger.
- **Mondphasen** werden nur durch Siege freigeschaltet, nicht im Täglichen Teich.
- **Täglicher Teich:** Seed `daily-YYYY-MM-DD`, immer Mönch + Grund-Pool (für alle gleich), ohne Tipps/Hinweise.
- **Lernteich statt Tutorial-Level:** Der allererste Lauf beginnt in einem festen, leichten Teich. Hinweise
  erscheinen kontextuell (einmalig, abschaltbar, nie mehrere gleichzeitig); in den ersten Zügen markiert das
  Spiel einen guten Wurf (derselbe Planer wie der Tipp-Knopf).
- **Hinweise als Daten** (`data/hints.json`), damit Texte ohne Code-Änderung angepasst werden können.
- **Audio komplett synthetisch** (Glocken mit inharmonischen Obertönen, gefiltertes Rauschen für Wasser),
  Kompressor auf dem Master, Rate-Limits gegen Klangbrei bei vielen Wogen. AudioContext erst nach der ersten Geste.
- **Wogen als Arpeggio:** gleichzeitige Wogen werden optisch und akustisch leicht gestaffelt – Ketten klingen
  wie aufsteigende Melodien.
- **Querformat auf Handys:** Steine wandern in eine Spalte rechts; der Renderer bekommt seitliche Insets.
- **Epoch-Zähler im UI-Controller:** Jede verzögerte Aktion (Animation, Screen, Banner) prüft, ob noch derselbe
  Lauf aktiv ist. Behebt Abstürze beim Wechsel zum Titel während einer Animation.
- **Kein Wurf auf den Mond, kein Wurf auf Schatten**, ein Stein pro Feld und Zug.
- **Smoke-Tests mit Playwright** (global installiert) statt eigener Test-Abhängigkeiten; Skripte in `tools/`.
- **`modulepreload`** für die wichtigsten Module gegen den Import-Wasserfall; ~69 KB gzip, keine externen Requests.
