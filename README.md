# Trinkgeld-Rechner

Web-App zur automatischen Verteilung von Trinkgeld nach gearbeiteten Stunden — für Nachtclubs und ähnliche Veranstaltungsbetriebe.

## Features

- Veranstaltungsdaten eingeben (Start-/Enddatum, Trinkgeldbetrag)
- Beliebig viele Mitarbeiter mit Arbeitszeiten und Pause
- Automatische Datums-Zuordnung (Mitternachtswechsel wird erkannt)
- Dezimale Stundenberechnung (z. B. `16:00–20:15 = 4,25 h`)
- Largest-Remainder-Verfahren: Summe immer exakt gleich Gesamttrinkgeld
- Persistenz via `localStorage` (überlebt Tab-Schließen und Reload)
- Responsives Design mit Angular Material (Light/Dark-Modus)

---

## Lokal starten

```bash
cd app
npm install
npm start
# → http://localhost:4200
```

## Tests ausführen

```bash
cd app
npm test
# oder einmalig ohne Watch:
npx ng test --no-watch
```

## Production-Build

```bash
cd app
npm run build
# Output in app/dist/trinkgeld-rechner/browser/
```

---

## Docker

### Lokal bauen und starten

```bash
docker compose up --build
# → http://localhost:80
```

### Nur bauen

```bash
docker build -t trinkgeld-rechner .
docker run -p 80:80 trinkgeld-rechner
```

---

## Deployment (vServer)

### Voraussetzungen

- Docker und Docker Compose auf dem Server
- GitHub Secrets gesetzt:
  - `SERVER_HOST` — IP oder Domain des vServers
  - `SERVER_USER` — SSH-Benutzername
  - `SERVER_SSH_KEY` — privater SSH-Key

### Manuelles Deployment

```bash
# auf dem Server
mkdir -p /opt/trinkgeld-rechner
# docker-compose.yml mit Image-Referenz kopieren
docker pull ghcr.io/<owner>/<repo>:latest
docker compose -f /opt/trinkgeld-rechner/docker-compose.yml up -d
```

### Automatisches CI/CD (GitHub Actions)

| Workflow | Trigger | Aufgabe |
|----------|---------|---------|
| `ci.yml` | Push / PR auf `main` | Tests + Production-Build |
| `cd.yml` | Push auf `main` | Docker-Image bauen, zu ghcr.io pushen, auf Server deployen |

Merge in `main` ist nur möglich, wenn alle CI-Tests grün sind.

---

## Projektstruktur

```
app/
├── src/app/
│   ├── domain/          # Reine Fachlogik (framework-unabhängig)
│   │   ├── tip-calculator.ts
│   │   └── tip-calculator.spec.ts
│   ├── models/          # TypeScript-Interfaces
│   ├── services/        # StorageService (localStorage)
│   └── app.ts           # Hauptkomponente
├── angular.json
└── package.json
Dockerfile
docker-compose.yml
nginx.conf
.github/workflows/
├── ci.yml
└── cd.yml
```
