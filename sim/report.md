# Balance-Report

Erzeugt von `sim/sim.mjs` · 500 Läufe je Strategie · Hüter `moench` · Mondphase 0 · Gaben-Wahl: Wertheuristik

Strategien: **random** = zufällige Würfe · **brute** = „Zange“ um das nächste Feld des dringendsten Schattens · **greedy** = bester Einzelwurf mit 1 Zug Vorschau · **planner** = Wurfpaare mit 3 Zügen Vorschau (stärkster Bot).

| Strategie | Siegquote | Ø Teiche | Ø Licht am Ende (Siege) | Ø Züge | Ø Kills | Ø längste Kette | Ø Irrlichter | ms/Lauf |
|---|---|---|---|---|---|---|---|---|
| random | 0.0 % | 0.01 | – | 8 | 2.3 | 1.32 | 0.00 | 2 |
| brute | 0.0 % | 1.65 | – | 36 | 26.9 | 3.59 | 0.43 | 13 |
| greedy | 48.8 % | 7.56 | 9.4 | 90 | 133.2 | 6.18 | 6.93 | 55 |
| planner | 81.0 % | 8.56 | 10.2 | 89 | 149.7 | 6.42 | 8.39 | 89 |

## Schwierigkeitskurve

Pro Teich: erreicht = Anteil der Läufe, die den Teich betreten · Tod hier = Anteil der Ankömmlinge, die hier sterben · Licht −/Teich = Ø verlorenes Licht · Züge = Ø Züge im Teich.

| Teich | random: erreicht / Tod hier / Licht − / Züge | brute: erreicht / Tod hier / Licht − / Züge | greedy: erreicht / Tod hier / Licht − / Züge | planner: erreicht / Tod hier / Licht − / Züge |
|---|---|---|---|---|
| AI-1 | 100.0 % / 99.0 % / 8.81 / 8.5 | 100.0 % / 17.0 % / 3.31 / 14.3 | 100.0 % / 0.0 % / 0.32 / 11.1 | 100.0 % / 0.0 % / 0.13 / 9.6 |
| AI-2 | 1.0 % / 100.0 % / 5.40 / 6.6 | 83.0 % / 51.1 % / 4.60 / 15.2 | 100.0 % / 0.0 % / 0.48 / 12.3 | 100.0 % / 0.0 % / 0.15 / 10.8 |
| AI-Boss | 0.0 % / – / 0.00 / 0.0 | 40.6 % / 35.0 % / 3.49 / 15.4 | 100.0 % / 0.2 % / 0.92 / 11.0 | 100.0 % / 0.0 % / 0.45 / 9.3 |
| AII-1 | 0.0 % / – / 0.00 / 0.0 | 26.4 % / 59.8 % / 4.48 / 14.9 | 99.8 % / 0.4 % / 0.92 / 12.9 | 100.0 % / 0.0 % / 0.39 / 11.6 |
| AII-2 | 0.0 % / – / 0.00 / 0.0 | 10.6 % / 67.9 % / 5.08 / 13.2 | 99.4 % / 2.4 % / 1.54 / 12.6 | 100.0 % / 0.4 % / 0.62 / 11.4 |
| AII-Boss | 0.0 % / – / 0.00 / 0.0 | 3.4 % / 76.5 % / 5.24 / 9.3 | 97.0 % / 13.6 % / 2.92 / 12.4 | 99.6 % / 0.6 % / 1.13 / 10.6 |
| AIII-1 | 0.0 % / – / 0.00 / 0.0 | 0.8 % / 100.0 % / 5.50 / 6.5 | 83.8 % / 15.8 % / 3.03 / 12.0 | 99.0 % / 7.1 % / 2.31 / 12.1 |
| AIII-2 | 0.0 % / – / 0.00 / 0.0 | 0.0 % / – / 0.00 / 0.0 | 70.6 % / 19.5 % / 3.79 / 11.8 | 92.0 % / 7.8 % / 2.43 / 12.0 |
| AIII-Boss | 0.0 % / – / 0.00 / 0.0 | 0.0 % / – / 0.00 / 0.0 | 56.8 % / 14.1 % / 3.06 / 13.9 | 84.8 % / 4.5 % / 1.73 / 13.6 |

## Nutzung der Inhalte (planner, zufällige Gaben-Wahl, alle Inhalte freigeschaltet)

| Stein | Anteil Würfe | gewählt wenn angeboten | Siegquote mit Stein im Beutel | ohne |
|---|---|---|---|---|
| Kiesel | 61.3 % | – | 53.8 % (n=452) | 54.2 % |
| Flussstein | 15.5 % | 27.8 % | 54.8 % (n=363) | 51.1 % |
| Mondstein | 2.1 % | 32.2 % | 51.7 % (n=116) | 54.4 % |
| Schattenstein | 3.3 % | 35.0 % | 37.4 % (n=115) | 58.7 % |
| Zwillingsstein | 3.3 % | 32.2 % | 58.8 % (n=102) | 52.5 % |
| Echostein | 3.1 % | 36.1 % | 64.5 % (n=110) | 50.8 % |
| Brandungsstein | 2.7 % | 37.0 % | 60.0 % (n=140) | 51.4 % |
| Tautropfen | 6.0 % | 34.0 % | 60.8 % (n=102) | 52.0 % |
| Strudelstein | 2.8 % | 33.3 % | 52.5 % (n=118) | 54.2 % |

| Talisman | gewählt wenn angeboten | Siegquote mit | ohne |
|---|---|---|---|
| Reiherfeder | 37.4 % | 49.1 % (n=222) | 57.6 % |
| Nachhall | 30.5 % | 71.8 % (n=170) | 44.5 % |
| Funkenherz | 32.9 % | 61.5 % (n=195) | 48.9 % |
| Mondhof | 34.5 % | 64.0 % (n=197) | 47.2 % |
| Morgentau | 32.5 % | 52.9 % (n=189) | 54.3 % |
| Silberschale | 32.9 % | 59.3 % (n=194) | 50.3 % |
| Gischt | 35.5 % | 59.3 % (n=199) | 50.2 % |
| Tiefensog | 29.8 % | 58.4 % (n=178) | 51.2 % |
| Weiter Wurf | 36.1 % | 70.7 % (n=198) | 42.7 % |
| Geduld | 28.9 % | 68.8 % (n=160) | 46.8 % |
| Drei Kraniche | 34.0 % | 54.8 % (n=199) | 53.2 % |
| Kettenglied | 32.4 % | 59.5 % (n=200) | 50.0 % |

| Kreatur | Ø besiegt / Lauf | Ø Licht-Schaden / Lauf |
|---|---|---|
| Tintling | 57.33 | 0.54 |
| Wasserläufer | 28.48 | 5.70 |
| Unke | 21.81 | 0.57 |
| Panzerschnecke | 12.37 | 0.80 |
| Laich | 12.09 | 0.00 |
| Hecht | 14.78 | 0.22 |
| Irrlicht | 0.00 | 0.00 |
| Die Krötenmutter | 1.00 | 0.00 |
| Der Nebelhecht | 0.99 | 0.86 |
| Namazu, der Mondfresser | 0.81 | 0.16 |

## Hüter (planner)

| Hüter | Siegquote | Ø Teiche |
|---|---|---|
| Der Mönch | 82.0 % | 8.59 |
| Die Fischerin | 76.0 % | 8.53 |
| Das Kind | 88.4 % | 8.74 |
| Die Schattenweberin | 84.8 % | 8.66 |

## Mondphasen (planner / greedy)

| Phase | planner Siegquote | greedy Siegquote |
|---|---|---|
| 0 Neumond | 80.8 % | 50.8 % |
| 1 Sichel | 77.6 % | 42.8 % |
| 2 Halbmond | 79.6 % | 34.8 % |
| 3 Zunehmend | 69.2 % | 23.6 % |
| 4 Dreiviertel | 67.2 % | 15.6 % |
| 5 Vollmond | 46.0 % | 12.4 % |

_Laufzeit: 120.1 s auf 4 Threads._
