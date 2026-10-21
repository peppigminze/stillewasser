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
- **Hex-Raster (pointy-top, Radius 5 = 91 Felder):** Ringe sehen auf Hex natürlicher aus als auf
  Quadraten (6 Nachbarn, gleichmäßige Ausbreitung); Radius 5 passt hochkant auf ein Handy.
- **Wellen laufen per BFS um Felsen** statt per Luftlinie: einfache Regel, erzeugt „Wellenschatten“
  und macht Felsen taktisch relevant.
- **Keine externen Fonts:** System-Serif-Stack statt Google Fonts ⇒ null externe Requests, schneller Start.
