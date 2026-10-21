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
