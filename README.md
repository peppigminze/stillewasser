# 静 STILLE WASSER

*Hüte den Mond. Wo Wellen sich treffen, entsteht Kraft.*

Ein rundenbasiertes Taktik-Roguelite für den Browser. Du greifst nie direkt an: Du wirfst Steine in einen
nächtlichen Teich, und Schaden entsteht nur dort, wo sich ihre Wellen überlagern.

**Spielen:** https://peppigminze.github.io/ueberaschungs_projekt/
(GitHub Pages muss einmalig aktiviert sein, siehe unten.)

Läuft auf Handy (hoch- und querformat) und Desktop, mit Touch, Maus oder Tastatur. Keine Installation,
keine externen Dateien, keine Anmeldung. Der Fortschritt wird im Browser gespeichert.

---

## Spielanleitung

### Ziel
In der Mitte des Teichs liegt das Spiegelbild des Mondes. Schatten kriechen vom Ufer heran und beißen ihm
**Licht** ab. Fällt das Licht auf 0, ist der Lauf vorbei. Ein Lauf besteht aus 3 Akten mit je zwei Teichen
und einem Boss.

### Wellen
- Pro Zug wirfst du (meist) **2 Steine**, nur ins freie Wasser, nie auf einen Schatten.
- Jeder Stein schlägt eine **Welle**, die jeden Zug um **einen Ring** wächst. Felsen werfen Wellenschatten.
- Eine Welle allein ist harmlos. **Wo sich Wellen überlagern, addieren sich ihre Stärken.**
  Ab Stärke 2 entsteht eine **Woge** (gold). Sie trifft alles in ihrem Feld mit *Stärke − 1* Schaden.
- **Dunkle Wellen** (violett, −1) löschen helle aus. Zwei dunkle zusammen ergeben einen **Sog**, der ebenfalls trifft.
- Jeder besiegte Schatten sendet eine **Todeswelle** aus. Trifft sie auf andere Wellen, entstehen **Ketten**.

### Lesen, was kommt
Das Spiel verrät alles:
- **Volle goldene Sechsecke**: Wogen beim Ende dieses Zugs, mit Schadenszahl über dem Schatten (✕ = besiegt).
- **Gestrichelte Sechsecke**: Wogen im nächsten Zug.
- **Pfeile**: wohin die Schatten ziehen. Rote Zähne: Biss in den Mond. Violetter Kreis: dunkle Welle.
- **Bläschen am Ufer**: Dort taucht nach diesem Zug ein neuer Schatten auf.
- Antippen bzw. Zeigen auf ein Feld zeigt eine Vorschau deines Wurfs samt Folgen.

### Gaben, Talismane, Hüter
Nach jedem Teich wählst du eine Gabe: einen neuen **Stein** (max. 4, jeder mit eigenem Wellenprofil und
Abklingzeit), einen **Talisman** (bricht eine Regel) oder **Mondlicht**. Für **Perlen** schaltest du im
**Schrein** neue Steine, Talismane und Hüter frei. Ein Sieg öffnet die nächste **Mondphase** (Schwierigkeit).
Der **Tägliche Teich** ist für alle gleich (fester Seed pro Datum).

### Steuerung
| | |
|---|---|
| Touch | Feld antippen = Vorschau · nochmal tippen = werfen · Steine unten wählen |
| Maus | Zeigen = Vorschau · Klick = werfen |
| Tastatur | `←↑→↓`/`WASD` Feld · `Enter` werfen · `1–4` Stein · `Tab` nächster Stein · `Leertaste` Zug beenden · `Z` rückgängig · `T` Tipp · `I` Absichten an/aus · `Esc` Menü |

Während der Animationen beschleunigt ein Tippen oder Tastendruck den Ablauf.

### Tipps
- Schatten bewegen sich vorhersehbar. Wirf nicht dorthin, wo sie *sind*, sondern so, dass zwei Ringe dort
  ankommen, wo sie *sein werden*.
- Wasserläufer ziehen zwei Felder und springen dabei über Ringe hinweg.
- Unken-Wellen sind Schild und Munition zugleich: Mit einem Schattenstein wird aus ihnen ein Sog.
- Der **?**-Knopf schlägt einen guten Wurf vor (im Täglichen Teich nicht verfügbar).

---

## Entwicklung

Reines HTML/CSS/Vanilla-JS (ES-Module), kein Framework, kein Build-Step, kein Backend.

```bash
npx http-server -c-1 .   # lokal spielen: http://localhost:8080 (file:// geht wegen fetch nicht)
npm test                 # 52 Node-Tests (node:test), keine Dependencies
npm run check            # Syntax-Check aller Module + Content-Validierung
npm run sim              # Balance-Simulation (Bots), schreibt sim/report.md
node sim/sim.mjs --runs=500 --extra   # ausführlicher Report (Hüter, Mondphasen, Inhalte)
node tools/smoke.mjs [--mobile|--viewport=844x390] [--script=tools/play-full.mjs]   # Headless-Browser-Test
```

- Spiellogik (`js/core/`) ist strikt von der UI (`js/ui/`) getrennt, rein und deterministisch (Seed-PRNG).
- Alle Inhalte und Balance-Zahlen stehen als JSON in `data/`.
- Architektur und Konventionen: [`CLAUDE.md`](CLAUDE.md) · Plan/Protokoll: [`PLAN.md`](PLAN.md) ·
  Entscheidungen: [`DECISIONS.md`](DECISIONS.md) · Balance: [`BALANCE.md`](BALANCE.md) ·
  Ideen für später: [`BACKLOG.md`](BACKLOG.md) · Konzept: [`SECRET_CONCEPT.md`](SECRET_CONCEPT.md)

### GitHub Pages aktivieren
Settings → Pages → *Build and deployment* → Source „Deploy from a branch“ → Branch `main`, Ordner `/ (root)` → Save.
Nach ein bis zwei Minuten ist das Spiel unter der oben genannten Adresse erreichbar.
