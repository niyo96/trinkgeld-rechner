## Rolle & Vorgehen

Du bist ein erfahrener Angular-Entwickler. Wir bauen gemeinsam eine kleine Web-App nach **Test-Driven-Development (TDD)**:
Benutze die Aktuellste Angular Version, falls diese nicht Installiert ist insterlliere sie bitte.
1. **Zuerst die automatisierten Tests schreiben** (rot), die die Fachlogik beschreiben.
2. Danach den produktiven Code implementieren, bis alle Tests grün sind.
3. Erst danach UI, Persistenz und Deployment.
   Beginne deine erste Antwort ausschließlich mit den **Unit-Tests für die Fachlogik** (Berechnung der Stunden und Trinkgeld-Verteilung). Implementiere noch keine Komponenten, bevor diese Tests existieren.

---

## Ziel der App

Ich arbeite in einem Nachtclub. Das Trinkgeld wird zentral eingesammelt und anschließend **anteilig nach gearbeiteten Stunden** auf das Personal verteilt. Die Sachbearbeiterin soll pro Veranstaltung möglichst wenig eintippen — der Rest passiert automatisch.
 
---

## Fachliche Anforderungen (Domänenlogik)

### Veranstaltung (Event)
Pro Veranstaltung werden eingegeben:
- **Startdatum** und **Enddatum** der Veranstaltung
    - Nachtveranstaltung: z. B. `23.06.2026 → 24.06.2026`
    - Tagesveranstaltung: z. B. `24.06.2026 → 24.06.2026`
- **Gesamtbetrag des eingenommenen Trinkgelds** (in Euro, Dezimal)
### Mitarbeiter (beliebig viele)
Pro Mitarbeiter gibt es eine Zeile/ein Formular mit:
- **Name**
- **Uhrzeit von** (z. B. `16:00`)
- **Uhrzeit bis** (z. B. `02:00`)
- **Checkbox „Pause"** — ist sie aktiv, erscheint ein Feld **Pausenlänge in Stunden**, das in **0,25er-Schritten** verändert werden kann (Stepper/Buttons). Die Pause wird von der Arbeitszeit abgezogen.
  Es muss möglich sein, beliebig viele Mitarbeiter hinzuzufügen und wieder zu entfernen.

### Automatische Datums-Zuordnung der Uhrzeiten
Die Sachbearbeiterin gibt **nur Uhrzeiten** ein, kein Datum pro Mitarbeiter. Die App muss anhand des Event-Zeitraums das korrekte Kalenderdatum ableiten:

- Annahme: Der Schichtbeginn liegt immer am **Startdatum** der Veranstaltung.
- **Regel:**
    - Ist `endTime > startTime` → das Schichtende liegt am **Startdatum** (kein Mitternachtswechsel).
        - Beispiel Event `23.06.2026 → 24.06.2026`, Eingabe `16:00 – 23:00` → Ende am **23.06.2026**.
    - Ist `endTime < startTime` → Mitternacht wurde überschritten → das Schichtende liegt am **Folgetag (Enddatum)**.
        - Beispiel Event `23.06.2026 → 24.06.2026`, Eingabe `16:00 – 02:00` → Ende am **24.06.2026, 02:00**.
    - Ist `endTime == startTime` → 0 Stunden (gleicher Tag), als Validierungshinweis behandeln.
- **Validierung:** Das aufgelöste Enddatum darf das Enddatum der Veranstaltung nicht überschreiten — sonst Warnung anzeigen.
### Stundenberechnung (dezimal)
- Dauer = `(EndDateTime − StartDateTime)` in **Stunden als Dezimalzahl**.
    - Beispiel: `16:00 – 20:15` → **4,25** Stunden.
    - Beispiel mit Mitternacht: `16:00 – 02:00` → **10,0** Stunden.
- **Netto-Stunden** = Dauer − Pause (Pause in Dezimalstunden, 0,25er-Schritte).
- Netto-Stunden dürfen nicht negativ werden (auf 0 begrenzen, Warnung bei Pause ≥ Arbeitszeit).
### Trinkgeld-Verteilung
- `GesamtNettostunden` = Summe aller Netto-Stunden aller Mitarbeiter.
- Anteil je Mitarbeiter = `(Netto-Stunden / GesamtNettostunden) × Gesamttrinkgeld`.
- Auf **Cent (2 Nachkommastellen)** runden.
- **Wichtig:** Die Summe der ausgezahlten Beträge muss **exakt** dem Gesamttrinkgeld entsprechen. Verwende dafür das **Largest-Remainder-Verfahren** (Rundungsdifferenz dem/den Mitarbeiter(n) mit dem größten Restbetrag zuschlagen).
- Sonderfall `GesamtNettostunden == 0` → keine Verteilung, sauberer Hinweis statt Division durch 0.
---

## Verbindliche Testfälle (mindestens diese)

Schreibe Unit-Tests, die u. a. abdecken:

**Zeit-/Datums-Auflösung**
- `16:00 – 23:00`, Event `23.06.2026→24.06.2026` → Ende `23.06.2026`, 7,0 h
- `16:00 – 02:00`, Event `23.06.2026→24.06.2026` → Ende `24.06.2026`, 10,0 h
- `16:00 – 20:15`, Event `24.06.2026→24.06.2026` → 4,25 h
- `00:00 – 00:00` → 0 h (Validierungshinweis)
  **Pause**
- 8,0 h Arbeit − 0,5 h Pause = 7,5 h netto
- Pause-Stepper akzeptiert nur 0,25er-Werte
- Pause größer als Arbeitszeit → netto = 0 + Warnung
  **Verteilung**
- 2 Mitarbeiter (4 h und 4 h), 100,00 € → je 50,00 €
- 3 Mitarbeiter (4 h, 4 h, 4 h), 100,00 € → 33,34 / 33,33 / 33,33 (Summe exakt 100,00 €)
- 1 Mitarbeiter → bekommt 100 %
- Gesamtstunden = 0 → keine Division durch 0
  Lege die Fachlogik in **reine, framework-unabhängige Services/Funktionen** (gut testbar, keine UI-Abhängigkeit).

---

## Persistenz

- **Jeder eingegebene Wert** (Event-Daten, Trinkgeldbetrag, alle Mitarbeiterzeilen, Pausen) wird bei **jeder Änderung automatisch lokal gespeichert** und beim erneuten Öffnen wiederhergestellt.
- **Empfehlung & Standard:** Nutze `localStorage`, **nicht** `sessionStorage`/Session-Cookies. Begründung: `sessionStorage` wird beim Schließen des Tabs gelöscht — die Anforderung „jeder Wert soll immer gespeichert bleiben" ist nur mit `localStorage` dauerhaft erfüllbar. (Falls bewusst nur für die aktuelle Sitzung gespeichert werden soll, mache die Storage-Strategie über eine einzige Konstante/Provider umschaltbar.)
- Kapsele die Persistenz in einem **StorageService**, sodass die Speicher-Technologie zentral austauschbar ist.
- Auto-Save reaktiv umsetzen (z. B. Angular Signals + `effect`, oder `valueChanges` der Reactive Forms → StorageService).
---

## Tech-Stack & Architektur

- **Angular** (aktuelle Version, **Standalone Components**, **Signals**, **Reactive Forms**).
- **TypeScript strict mode** aktiviert.
- Tests mit dem Standard-Setup (Karma/Jasmine oder Jest — wähle eins und richte es vollständig ein). Mindestens Unit-Tests für die Fachlogik; gerne zusätzlich Component-Tests.
- **Modernes, aufgeräumtes Design**: klare Typografie, gute Abstände, responsives Layout (Desktop & Mobile), dezente Akzentfarben, dunkler/heller Modus wäre ein Plus. Nutze entweder **Angular Material** oder **Tailwind CSS** (entscheide dich für eins und setze es konsistent ein).
- Saubere Trennung: `domain/` (reine Logik + Tests), `services/` (Storage), `components/` (UI), `models/` (Typen/Interfaces).
### Empfohlenes Datenmodell (anpassbar)
```ts
interface Employee {
  id: string;
  name: string;
  startTime: string;   // "HH:mm"
  endTime: string;     // "HH:mm"
  hasBreak: boolean;
  breakHours: number;  // Vielfaches von 0.25
}
 
interface TipEvent {
  id: string;
  startDate: string;   // "YYYY-MM-DD"
  endDate: string;     // "YYYY-MM-DD"
  totalTip: number;    // Euro
  employees: Employee[];
}
```

### UI-Anforderungen
- Eingabe Event (Start-/Enddatum, Trinkgeldbetrag).
- Tabelle/Liste der Mitarbeiter mit „+ Mitarbeiter hinzufügen" und Löschen-Button pro Zeile.
- Pro Mitarbeiter Live-Anzeige der berechneten **Netto-Stunden** und des **Auszahlungsbetrags**.
- Anzeige der **Gesamtstunden** und Kontroll-Summe (= Gesamttrinkgeld).
- Validierungs- und Warnhinweise gut sichtbar.
---

## Deployment

- **Multi-Stage `Dockerfile`**: Stage 1 baut die Angular-App (`ng build --configuration production`), Stage 2 serviert die statischen Dateien über **nginx** (inkl. passender SPA-Fallback-Konfiguration für das Angular-Routing).
- **`docker-compose.yml`** zum Start auf einem vServer (Port-Mapping, Restart-Policy, ggf. Umgebungsvariablen).
- **GitHub Actions CI/CD** (`.github/workflows/`):
    - **CI:** bei Push/PR → Dependencies installieren, **Tests ausführen**, Production-Build prüfen. Merge nur bei grünen Tests.
    - **CD:** bei Push auf `main` → Docker-Image bauen, in eine Registry pushen (oder per SSH auf den vServer kopieren) und dort via `docker compose up -d` deployen.
    - Secrets (SSH-Key, Server-Host, Registry-Login) über **GitHub Secrets**.
- Lege außerdem eine **`README.md`** an: lokales Starten, Tests ausführen, Docker-Build, Deployment-Schritte.
---

## Definition of Done / Akzeptanzkriterien

- [ ] Fachlogik-Tests existieren **zuerst** und sind grün.
- [ ] Alle oben genannten Testfälle bestehen.
- [ ] Datum wird korrekt aus den Uhrzeiten + Event-Zeitraum abgeleitet (Mitternachtswechsel).
- [ ] Stunden werden dezimal berechnet (`16:00–20:15 = 4,25`).
- [ ] Pause in 0,25er-Schritten, wird abgezogen.
- [ ] Beliebig viele Mitarbeiter anleg- und löschbar.
- [ ] Trinkgeld wird anteilig verteilt, Summe = Gesamtbetrag exakt.
- [ ] Alle Eingaben werden automatisch lokal gespeichert und überleben das Neuladen.
- [ ] Modernes, responsives Design.
- [ ] `Dockerfile`, `docker-compose.yml`, GitHub-Actions-Workflows und `README.md` vorhanden.
  Stelle mir Rückfragen, falls etwas unklar ist, bevor du größere Annahmen triffst. Fang jetzt mit den Tests an.
