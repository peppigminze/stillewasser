# BALANCE.md — Simulation & Balance-Entscheidungen

Werkzeug: `node sim/sim.mjs --runs=500 --extra` (Worker-Threads, ~2 min). Ergebnis: `sim/report.md`.
Alle Zahlen stammen aus `data/*.json`, die Simulation nutzt exakt dieselbe Spiellogik wie das Spiel.

## Bot-Strategien (als Spielertypen gelesen)

| Bot | Verhalten | steht für |
|---|---|---|
| `random` | zufällige legale Würfe | Kontrollgruppe |
| `brute` | „Zange“: zwei Steine neben das nächste Feld des dringendsten Schattens | Anfänger, der eine Taktik kennt |
| `greedy` | bester Einzelwurf, schaut 1 Zug voraus (nutzt dieselbe Vorschau wie die UI) | guter Spieler, der die Vorschau liest |
| `planner` | Wurf*paare*, schaut 3 Züge voraus (echte Forecasts) | Experte |

**Zielkorridor (Mondphase 0, Mönch):** random 0 %, brute ≈ 0–5 % (stirbt in Akt I/II), greedy 35–50 %,
planner 75–85 %. Höhere Mondphasen sollen für greedy spürbar schwerer werden, planner bleibt bis Phase 5 > 40 %.
Die Schwierigkeit soll über die Akte steigen; Bosse sind Spitzen, aber keine Wände.

## Verlauf (wichtigste Iterationen)

| # | Änderung | brute | greedy | planner | Befund |
|---|---|---|---|---|---|
| 0 | Startwerte | 75 % | 100 % | 100 % | Viel zu leicht. |
| 1 | **Regel: Steine dürfen nicht auf Schatten landen** | 40 % | 95 % | 100 % | Ein Stein direkt auf einer Kreatur „ritt“ mit ihr mit (Ring und Kreatur wandern gleich schnell) → triviale Dauertreffer. |
| 2 | Budgets ×1,8, Boss-Leben +40 % | 46 % | 90 % | 99,5 % | Mehr Gegner = mehr Ketten-Treibstoff → kaum schwerer. |
| 3 | Kiesel 4→3 Ringe, Todeswelle 3→2 Ringe | 16 % | 85 % | 97 % | Diagnose per Trace: ~20 Wogen pro Zug („Wellen-Suppe“). |
| 4 | Kreaturen schlängeln sich (Zickzack statt Gerade) | 14 % | 84 % | 98,5 % | Verhindert „Mitreiten“ hinter Kreaturen, ändert die Quote aber kaum. |
| 5 | **Kiesel nur noch 2 Ringe weit** | 0 % | 71 % | 93 % | Suppe deutlich kleiner (17 → ~10 Wogen/Zug beim Anfänger). |
| 6 | Mehr HP (Läufer 2, Unke/Hecht/Laich 3, Schnecke 3 + Panzer) | 0 % | 62 % | 90 % | Akt III immer noch fast verlustfrei. |
| 7 | **Akt-Regeln** (Akt III: Nebel = eigene Wellen −1 Ring, Bisse +1) | 0 % | 34 % | 76 % | Erstmals echte Kurve, Akt III wird zur Prüfung. |
| 8 | Talisman Nachhall 2→1 | 0 % | 10 % | 38 % | Zusammen mit „Todeswellen −1“ in Akt II war Nachhall Pflicht → Akt-II-Regel gestrichen. |
| 9 | Hüter/Talismane/Phasen nachjustiert (s. u.) | 0 % | 49 % | 81 % | Endstand. |

## Endstand (500 Läufe je Strategie, Mönch, Phase 0)

| Strategie | Siegquote | Ø Teiche (von 9) |
|---|---|---|
| random | 0 % | 0,0 |
| brute | 0 % | 1,7 |
| greedy | 48,8 % | 7,6 |
| planner | 81,0 % | 8,6 |

**Schwierigkeitskurve (greedy):** Sterberate je Teich 0 % · 0 % · 0,2 % (Boss I) · 0,4 % · 2,4 % · 13,6 % (Boss II) ·
15,8 % · 19,5 % · 14,1 % (Endboss). Verlorenes Licht pro Teich steigt von 0,3 auf ~3,8.
Akt I ist bewusst sanft (Lernakt), Akt III ist die Prüfung.

**Hüter (planner):** Mönch 82 % · Fischerin 76 % · Kind 88 % · Schattenweberin 85 %.

**Mondphasen (planner / greedy):** 0: 81/51 · 1: 78/43 · 2: 80/35 · 3: 69/24 · 4: 67/16 · 5: 46/12.

## Angewandte Änderungen (Endwerte in `data/`)

- **Regeln:** keine Würfe auf besetzte Felder; Zickzack-Bewegung; Boss-Heilung 3 → 2; Kiesel `[1,1,1]`;
  Todeswelle `[0,1,1]`.
- **Akt III „Herbstnebel“:** `stoneRange −1`, `biteBonus +1` (Regeltext im Akt-Banner).
- **Budgets:** Akt I 12/15/10, Akt II 32/40/20, Akt III 46/54/26; Gruppen und Intervalle steigen pro Akt.
- **Kreaturen:** Läufer HP 2; Unke, Hecht, Laich, Schnecke HP 3; Krötenmutter 10, Nebelhecht 9 (Biss 2, Sprint 2),
  Namazu 16.
- **Steine:** Flussstein `[1,2,1,1,1]` (erster Ring Stärke 2), Brandung `[0,0,2,2]` CD 2, Mondstein CD 2,
  Echostein CD 1, Schattenstein `[-1,-1,-1,-1]`. Ein „gratis“ Schattenstein war ein versteckter dritter Wurf
  pro Zug (Schattenweberin 99 % Siegquote) → wieder normaler Wurf.
- **Talismane:** Reiherfeder = +1 Wurf in den ersten 3 Zügen; Nachhall +1 statt +2; Morgentau +2 Licht;
  Weiter Wurf kostet −3 max. Licht und 25 Perlen; Drei Kraniche −2 max. Licht; Kettenglied ab Kette 4; Geduld 25 Perlen.
- **Hüter:** Licht aller Hüter −2 (Mönch 8). Fischerin: Kiesel, Zwilling, Kiesel (7 Licht, 4 Gaben-Optionen).
  Kind: Tautropfen + Kiesel + Nachhall (6 Licht). Schattenweberin: Schatten, Strudel, Kiesel + Tiefensog (6 Licht).
- **Mondphasen:** 1 = eine Gaben-Option weniger · 2 = −2 Start-Licht · 3 = Bosse +30 % · 4 = +25 % Kreaturen,
  Bosse +20 % · 5 = −2 max. Licht.

## Inhalte-Nutzung (planner, zufällige Gaben, alles freigeschaltet)

Siegquote „mit Stein/Talisman im Beutel“ liegt für alle Steine zwischen ~55 % und ~71 % (Mittel ~60 %).
Ausreißer, bewusst belassen:

- **Weiter Wurf** (≈ +25 Prozentpunkte) — hebt den Nebel in Akt III auf. Bewusst stark, aber teuer (25 Perlen,
  −3 max. Licht). Kandidat für späteres Nachjustieren.
- **Wasserläufer** verursachen den meisten Licht-Schaden (≈ 5,6 pro Lauf) — gewollt: der schnelle Gegner, der
  über Ringe springt.
- Reiherfeder/Morgentau liegen leicht unter dem Schnitt; sie sind „Komfort“-Talismane.

## Grenzen der Simulation

- Bots rechnen perfekt; Menschen nicht. Die Vorschau im Spiel (Wogen jetzt/nächster Zug + Absichten)
  bringt Menschen aber nahe an `greedy`. Die erste Lernrunde nutzt einen festen, leichten Lernteich.
- Ketten werden vom planner nur indirekt angestrebt; geübte Menschen könnten Ketten gezielter bauen.
