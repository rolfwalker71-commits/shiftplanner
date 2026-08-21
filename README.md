# Schichtklar

Persönliche Schichtplanung als selbst gehostete PWA: eigene Schichtcodes (z. B. F2, S1, N), Arbeitszeiten inkl. Pause, Drag-and-Drop auf den Kalender, optionaler Google-Kalender-Sync und KI-generierte Clay-3D-Icons.

Die Illustrationen zeigen **dieselbe Person in der Gästebetreuung / im Restaurantbetrieb eines Spitals** — Service, Tabletts, Speisesaal. Keine Pflege, keine medizinische Kleidung.

## Lokal starten

Voraussetzungen: Node.js 20+.

```bash
cp .env.example .env
# SESSION_SECRET setzen
npm install
npm run db:push
npm run db:seed   # legt Demo-Schichtarten mit Platzhalterbildern an
npm run dev
```

- App: [http://localhost:5173](http://localhost:5173)
- API: [http://localhost:3001](http://localhost:3001)

Mit `DEMO_MODE=true` (Standard) reicht **Lokal starten** ohne Google.

## Schichtbilder (KI)

Der Generierungs-Prompt ist fest verdrahtet in `backend/src/lib/imagePrompt.ts`:

1. Claymorphism / 3D-Clay, matt, Pastell, App-Icon, nicht fotorealistisch  
2. Immer **dieselbe Clay-Person** wie in `backend/assets/valentyna-clay-ref.png` (Vorlage: `mockups/schichtarten-service/clay3d-S1-service.png`)  
3. Job: Gästebetreuung im Spital-Restaurant (Kantonspital Uri) — Schürze, Bluse, Tablett, Speisesaal. **Keine Scrubs, kein Stethoskop**. Namensschild zweizeilig: **Kantonspital Uri** / **Valentyna** (nur bei Dienst-Schichten)  
4. Mimik und Setting aus Startzeit (Frühstück / Mittag / Abend / Schliessen) plus deiner Bildbeschreibung  
5. Schichtcode im Hintergrund nur wenn der Schalter an ist   
4. Mimik und Setting aus Startzeit (Frühstück / Mittag / Abend / Schliessen) plus deiner Bildbeschreibung  
5. Schichtcode im Hintergrund nur wenn der Schalter an ist  

Ohne `OPENAI_API_KEY` kopiert die App passende Platzhalter aus `backend/assets/`. Mit Key wird `OPENAI_IMAGE_MODEL` genutzt (`gpt-image-1` oder `dall-e-3`).

## Google Workspace

1. Google Cloud Console → OAuth-Client (Web)  
2. Redirect: `http://localhost:3001/api/auth/google/callback` (lokal) bzw. `https://dein-host/api/auth/google/callback`  
3. APIs: Calendar API, Drive (nur Dateien der App) + OAuth-Scopes `openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive.file`  
4. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` in `.env`  
5. `DEMO_MODE=false` wenn nur Google-Login gewünscht  
6. `ALLOWED_EMAILS` mit Komma getrennten Adressen (z. B. `valentyna@valentoys.ch`) — nur diese Konten dürfen sich anmelden  
7. In der App unter Einstellungen den Zielkalender wählen. Nach dem Drive-Scope ggf. „Google-Rechte aktualisieren“.

Beim Ablegen, Verschieben oder Löschen einer Schicht wird das Event sofort im gewählten Kalender angelegt, verschoben oder entfernt. Das Clay-Bild wird als Drive-Anhang ans Event gehängt (sichtbar in den Event-Details, nicht als Kachel im Google-Raster). Nachtdienste über Mitternacht (Ende vor Start) liegen auf zwei Kalendertagen.

## Docker

```bash
docker compose up --build
```

Daten liegen in Volumes (`backend/data` SQLite, `backend/uploads` Bilder). Image für GHCR: Push auf `main` baut `linux/amd64` und `linux/arm64` via `.github/workflows/docker-publish.yml`.
