# SECRET_CONCEPT — Projekt X

> Interner Arbeitsname im Chat: **Projekt X**. Hier steht alles offen.

## Titel

**STILLE WASSER** — *Hüte den Mond. Wo Wellen sich treffen, entsteht Kraft.*

(„Stille Wasser sind tief“: das Spiel sieht ruhig aus und ist es nicht.)

## Ein Satz

Ein rundenbasiertes Taktik-Roguelite auf einem nächtlichen Teich, in dem man nie direkt
angreift: Man wirft Steine ins Wasser, und **Schaden entsteht nur dort, wo sich Wellen überlagern**.

## Kernmechanik: Interferenz als Waffe

- Der Teich ist ein Hex-Raster. In der Mitte liegt das Spiegelbild des Mondes.
- Schatten-Kreaturen kriechen vom Ufer zum Mond und beißen ihm Licht ab (Licht = Lebenspunkte des Laufs).
- Pro Zug wirft man (meist) zwei Steine. Jeder Stein erzeugt eine Welle, die sich **jeden Zug um
  ein Feld ausbreitet** (Ringe auf dem Hex-Raster, Felsen werfen „Wellenschatten“, weil Wellen
  per Breitensuche um Hindernisse laufen).
- Jede Welle hat ein **Amplitudenprofil** (z. B. `[1,1,1,1,1]`). In jedem Feld wird die Summe
  aller Wellenfronten gebildet.
  - `|A| = 1`: harmlos.
  - `|A| ≥ 2`: **Woge** (positiv, gold) bzw. **Sog** (negativ, violett) – trifft alles im Feld mit `|A| − 1` Schaden.
- Positive und negative Wellen **löschen sich aus**. Manche Kreaturen senden dunkle Wellen (−1),
  die eigene Angriffe neutralisieren – oder die man mit eigenen dunklen Steinen zu einem Sog verstärkt.
- **Kettenreaktionen:** Jede besiegte Kreatur sendet eine eigene Todeswelle aus. Die trifft wieder
  auf andere Wellen → neue Wogen → neue Tode → Kette. Ketten werden gezählt und klingen musikalisch
  (pentatonisch aufsteigend).
- **Resonanz:** Zwei Wellen, die am selben Ort zur selben Zeit entstehen, laufen deckungsgleich und
  bilden einen ganzen Ring aus Wogen. Wer eine Kreatur mit einem direkt geworfenen Stein erledigt,
  lässt ihre Todeswelle mit der Steinwelle resonieren → Schockwellen-Ring. Das ist der „Aha“-Trick,
  den man selbst entdecken kann (ein später Hinweis erklärt ihn).

Alles ist deterministisch und vollständig vorhersehbar: Das Spiel zeigt, wo jetzt Wogen entstehen
(mit Schadenszahlen), wo sie im nächsten Zug entstehen, und was jede Kreatur als Nächstes tut.
Das Rätsel ist rein räumlich-zeitlich: *Wann muss welcher Stein wo landen, damit sich die Ringe genau
dort schneiden, wo der Schatten gleich sein wird?*

## Warum das neu ist

Ich kenne kein Spiel, in dem Schaden ausschließlich durch **Überlagerung sich ausbreitender Wellen**
entsteht. Taktikspiele haben Flächenschaden, Push-Effekte oder Projektile – hier ist jede Aktion
eine Investition in die Zukunft des Wasserfelds, und Gegner-Wellen sind gleichzeitig Schild und
Munition. Spielgefühl: Schach × Wellenwanne × Feuerwerk.

## Lauf-Struktur (Roguelite)

- 3 Akte (Frühlingsteich, Sommernacht, Herbstnebel), je 2 Teiche + 1 Boss-Teich = 9 Kämpfe.
- Nach jedem Teich: 1 von 3 Gaben wählen — neuer **Stein** (max. 4 im Beutel, jeder mit eigenem
  Wellenprofil und Abklingzeit), **Talisman** (passive Regelbrecher) oder **Mondlicht** (Heilung).
- Bosse: Krötenmutter, Nebelhecht, Namazu der Mondfresser.
- Licht trägt sich über den ganzen Lauf. Licht 0 = Lauf vorbei.

## Inhalte (V1)

- **Steine:** Kiesel, Flussstein (schwerer Aufschlag), Mondstein (weite Welle), Schattenstein (dunkle Welle),
  Echostein (zweite Welle zwei Züge später), Zwillingsstein (gespiegelt am Mond), Brandungsstein
  (starker kurzer Ring), Tautropfen (Gratiswurf), Strudelstein (wechselnde Vorzeichen).
- **Kreaturen:** Tintling, Wasserläufer (springt über Wellen, weil er 2 Felder zieht), Unke (sendet
  dunkle Wellen), Panzerschnecke (Panzer), Laich (brütet), Hecht (Sprint), Irrlicht (neutral; seine
  Todeswelle ist ein Geschenk) + 3 Bosse.
- **Talismane:** ~12 Regelbrecher (Todeswellen verstärken, Reichweite, Schild, Heilung bei Ketten …).

## Meta-Progression (localStorage)

- **Perlen** pro Lauf → im **Schrein** neue Steine, Talismane und Hüter freischalten.
- **Hüter** (Startfiguren mit eigenem Beutel/Passiv): Mönch, Fischerin, Kind, Schattenweberin.
- **Mondphasen** (Schwierigkeitsstufen 0–5), jeweils durch Sieg auf der vorigen freigeschaltet.
- **Chronik:** gesehene Kreaturen/Steine, Statistiken, längste Kette.
- **Täglicher Teich:** fester Seed pro Datum, eigener Bestwert.

## Look & Klang

- Nacht-Teich in Tusche-Ästhetik: tiefes Indigo, mondweiße Wellenringe mit Glühen, schwarze
  Tinten-Kreaturen mit Bernstein-Augen, zinnoberroter Stempel (静 = still) als Signet.
- Jeder Akt hat eine eigene Wasserfarbe und Partikel (Kirschblüten, Glühwürmchen, Ahornblätter).
- Juice: Steinflug mit Platscher, weich expandierende Ringe, Wogen-Lichtsäulen, Tintenexplosionen,
  Kettenzähler, Screenshake (abschaltbar), Mond-Flackern bei Bissen.
- WebAudio-Synthese: Platsch-Geräusch (gefiltertes Rauschen + Pitch-Drop), Glocken-Chimes für Wogen
  (pentatonisch, Ketten steigen auf), dumpfer Schlag bei Bissen, leises Ambient (abschaltbar).
