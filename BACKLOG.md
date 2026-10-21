# BACKLOG.md — Nicht in V1

Bewusst nicht umgesetzt (kein Over-Engineering), grob nach Wert sortiert.

## Spielinhalt
- **Reflexion am Ufer:** Wellen prallen vom Teichrand zurück (neue Geometrie-Ebene, aber deutlich schwerer lesbar).
- **Vierter Akt „Wintereis“:** Eisfelder verlangsamen Wellen (2 Züge pro Ring) – neue Timing-Rätsel.
- **Neue Kreaturen:** Libelle (zerschneidet Ringe), Reiher-Boss (sticht von oben, ignoriert Wasser),
  Seerosen (blockieren Wellen, lassen sich versenken).
- **Stein-Verbesserungen** als Gabe (Reichweite +1, Abklingzeit −1 für einen einzelnen Stein).
- **Verzweigte Route** zwischen den Teichen (Ereignisse, Rast, Händler mit Perlen im Lauf).
- **Errungenschaften** und Lore-Texte in der Chronik.
- Weitere Hüter mit Spezialregeln (z. B. drei Würfe, aber nur Tautropfen).

## Balance
- „Weiter Wurf“ ist laut Simulation der stärkste Talisman (hebt den Akt-III-Nebel auf) – beobachten.
- Mensch-ähnlicherer Simulations-Bot (mit Fehlern/Rauschen), um die Kurve für Einsteiger feiner zu kalibrieren.
- Automatisches Tuning (Parameter-Suche) gegen Zielkorridore.

## Komfort & Technik
- **PWA/Offline** (Service Worker, installierbar).
- **Seed-Eingabe & Teilen** von Läufen; Export/Import des Spielstands.
- **Bestenliste** für den Täglichen Teich (bräuchte ein Backend).
- „Warum?“-Erklärung zum Tipp-Knopf (welche Wogen der Vorschlag erzeugt).
- Ganzen Zug zurückspulen (Zeitreise nach dem Zugende).
- WebGL-Wasser mit echter Wellen-Verzerrung.

## Zugänglichkeit & Sprache
- Farbenblind-Paletten für Woge/Sog (Form-Unterschied ist da, Farbe könnte stärker variieren).
- Screenreader-Beschreibung des Spielfelds, vollständige Tastatur-Fokusführung in allen Menüs.
- Schriftgrößen-Option.
- Englische Übersetzung (Texte liegen schon größtenteils in `data/`).
