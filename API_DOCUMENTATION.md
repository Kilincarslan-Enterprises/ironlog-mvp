# IronLog API Documentation

Die IronLog API wird über Hono bereitgestellt und läuft auf Cloudflare Pages Functions. 
Alle Endpunkte befinden sich unter dem Basispfad `/api` und erfordern eine Authentifizierung.

## Authentifizierung

Jeder Request an die API **muss** authentifiziert werden. Die API unterstützt zwei Methoden, die beide auf denselben Benutzer (`User`) auflösen:

1. **Clerk JWT (Browser):**
   Das Frontend sendet standardmäßig das von Clerk generierte JWT im `Authorization: Bearer <token>` Header. 
2. **Agent API Token (Automation/Scripts):**
   In den App-Einstellungen können API Keys (Agent Tokens) generiert werden. Diese sind für externe Skripte gedacht und können wie folgt übergeben werden:
   - Header: `x-api-token: <DEIN_TOKEN>`
   - Header: `Authorization: Bearer <DEIN_TOKEN>`

Ein fehlender oder ungültiger Token wird mit dem HTTP-Statuscode `401 Unauthorized` beantwortet.

---

## 1. System

### `GET /api/health`
Gesundheitsprüfung der API. Erfordert weiterhin eine gültige Authentifizierung.
- **Request Body:** Keine
- **Response:** `200 OK`
  ```json
  { "status": "ok" }
  ```

---

## 2. Agent API Tokens

### `GET /api/agent/tokens`
Gibt alle API-Schlüssel des Benutzers zurück.
- **Query Parameter:** `?all=true` (Gibt auch widerrufene Tokens zurück)
- **Response:** `200 OK`
  ```json
  {
    "tokens": [
      {
        "id": "uuid",
        "userId": "uuid",
        "label": "Mein Skript",
        "scopes": "read",
        "lastUsedAt": 1719500000000,
        "expiresAt": 1729500000000,
        "isRevoked": false,
        "createdAt": 1719400000000
      }
    ]
  }
  ```

### `POST /api/agent/tokens`
Erstellt einen neuen API-Schlüssel. **Das `secret` wird nur in dieser Response einmalig im Klartext zurückgegeben.**
- **Request Body:**
  ```json
  {
    "label": "Cron Job",
    "expiresAt": "2024-12-31T23:59:59Z" // Optional
  }
  ```
- **Response:** `200 OK`
  ```json
  {
    "token": { /* Neues Token-Objekt ohne secret */ },
    "secret": "generiertes_klartext_secret"
  }
  ```

### `DELETE /api/agent/tokens/:id`
Widerruft (löscht) einen spezifischen API-Schlüssel.
- **Response:** `200 OK`

---

## 3. Benutzer & Dashboard

### `GET /api/dashboard`
Gibt eine Zusammenfassung des aktuellen Tages zurück, inklusive Kalorien, Makros, Training, Gewicht und Supplements. Die Berechnung basiert auf der Zeitzone des Benutzers.
- **Response:** `200 OK`
  ```json
  {
    "user": { ... },
    "today": { "calories": 2100, "protein": 140, "carbs": 200, "fat": 65 },
    "trainingCompleted": false,
    "weightLogged": true,
    "todayWeight": 80.5,
    "supplementsCompleted": 1,
    "supplementsTotal": 3,
    "streaks": { "active": true, "count": 12 }
  }
  ```

### `GET /api/user/me`
Gibt das Profil des aktuell authentifizierten Benutzers zurück.
- **Response:** `200 OK`
  ```json
  { "user": { "id": "...", "displayName": "Athlet", "timezone": "Europe/Berlin", ... } }
  ```

### `PATCH /api/user/me`
Aktualisiert das Benutzerprofil oder die Ernährungsziele.
- **Request Body:** (alle Felder optional)
  ```json
  {
    "displayName": "Max",
    "timezone": "Europe/Berlin",
    "unitSystem": "metric",
    "dailyCalorieTarget": 2500,
    "dailyProteinTarget": 160,
    "dailyCarbsTarget": 200,
    "dailyFatTarget": 80
  }
  ```
- **Response:** `200 OK`

---

## 4. Ernährung (Food)

### `GET /api/food/presets`
Gibt alle eigenen Lebensmittel-Vorlagen sowie alle öffentlichen Vorlagen zurück.
- **Response:** `200 OK`

### `POST /api/food/presets`
Erstellt eine neue Lebensmittel-Vorlage.
- **Request Body:** (name, calories, protein, carbs, fat, servingSize, servingUnit sind Pflichtfelder)
  ```json
  {
    "name": "Haferflocken",
    "brand": "KoRo",
    "servingSize": 100,
    "servingUnit": "g",
    "calories": 370,
    "protein": 13,
    "carbs": 60,
    "fat": 7,
    "barcode": "401234...",
    "isPublic": false
  }
  ```
- **Response:** `200 OK`

### `PUT /api/food/presets/:id`
Aktualisiert eine eigene Vorlage.
- **Response:** `200 OK`

### `DELETE /api/food/presets/:id`
Löscht eine eigene Vorlage.
- **Response:** `200 OK`

### `GET /api/food/meals`
Gibt die Mahlzeiten eines bestimmten Datums (oder von heute) zurück.
- **Query Parameter:** `?date=YYYY-MM-DD`
- **Response:** `200 OK` (Array von Meals inkl. verschachtelten Items)

### `POST /api/food/meals`
Erfasst eine neue Mahlzeit inklusive einzelner Einträge (Items).
- **Request Body:**
  ```json
  {
    "name": "Frühstück",
    "loggedAt": 1719500000000, // Unix Timestamp (ms)
    "note": "Nach dem Training",
    "items": [
      {
        "name": "Haferflocken",
        "quantity": 80,
        "quantityUnit": "g",
        "calories": 296,
        "protein": 10,
        "carbs": 48,
        "fat": 6,
        "foodPresetId": "uuid" // Optional
      }
    ]
  }
  ```
- **Response:** `200 OK`

### `DELETE /api/food/meals/:id/items/:itemId`
Löscht ein einzelnes Item aus einer Mahlzeit.
- **Response:** `200 OK`

### `DELETE /api/food/meals/:id`
Löscht eine gesamte Mahlzeit inkl. aller Items.
- **Response:** `200 OK`

### `GET /api/nutrition/daily`
Gibt eine Tageszusammenfassung aller Nährwerte zurück, aggregiert aus den Mahlzeiten des gewählten Tages.
- **Query Parameter:** `?date=YYYY-MM-DD`
- **Response:** `200 OK`
  ```json
  {
    "date": "2024-07-15",
    "totals": { "calories": 2100, "protein": 140, "carbs": 200, "fat": 65, "fiber": 30, "sodium": 1.2 },
    "meals": [ ... ]
  }
  ```

---

## 5. Training

### `GET /api/training/exercises`
Gibt alle verfügbaren Übungen zurück (System + Eigene).

### `POST /api/training/exercises`
Erstellt eine eigene Übung.

### `GET /api/training/workout-plans`
Gibt die Trainingspläne des Benutzers zurück.

### `POST /api/training/workout-plans`
Erstellt einen neuen Trainingsplan inkl. Übungen, Sets und Reps.

### `GET /api/training/workout-sessions`
Gibt aufgezeichnete Trainingseinheiten zurück.
- **Query Parameter:** `?date=YYYY-MM-DD`

### `POST /api/training/workout-sessions`
Startet eine neue Trainingseinheit.

### `PATCH /api/training/workout-sessions/:id`
Beendet/Aktualisiert eine Trainingseinheit.

### `POST /api/training/workout-sessions/:sessionId/sets`
Fügt einer aktiven Session ein ausgeführtes Set hinzu.

### `PATCH /api/training/workout-sessions/:sessionId/sets/:setId`
Aktualisiert ein Set (z.B. Gewicht oder Wiederholungen nachträglich ändern).

### `DELETE /api/training/workout-sessions/:sessionId/sets/:setId`
Löscht ein Set.

### `GET /api/training/personal-records`
Gibt die PRs (Personal Records) für bestimmte Übungen zurück.

---

## 6. Supplements

### `GET /api/supplements`
Gibt geplante/aktive Supplements zurück.
- **Query Parameter:** `?all=true`

### `POST /api/supplements`
Erstellt ein neues Supplement.

### `PATCH /api/supplements/:id`
Aktualisiert ein Supplement.

### `DELETE /api/supplements/:id`
Löscht ein Supplement.

### `GET /api/supplements/logs`
Gibt die Einnahme-Protokolle (Logs) eines Datums zurück.
- **Query Parameter:** `?date=YYYY-MM-DD`

### `POST /api/supplements/logs`
Protokolliert die Einnahme eines Supplements.
- **Request Body:**
  ```json
  {
    "supplementId": "uuid",
    "takenAt": 1719500000000,
    "dose": 1,
    "doseUnit": "pill"
  }
  ```

### `DELETE /api/supplements/logs/:id`
Löscht einen Log-Eintrag.

---

## 7. Gewicht (Weight)

### `GET /api/weight`
Gibt Körpergewichts-Einträge zurück.
- **Query Parameter:** `?range=30d` (Werte: 7d, 30d, 90d, all)

### `POST /api/weight`
Trägt ein neues Körpergewicht ein.
- **Request Body:**
  ```json
  {
    "weight": 80.5,
    "unit": "kg",
    "measuredAt": 1719500000000,
    "bodyFatPercentage": 15.2, // Optional
    "note": "Nach dem Aufstehen" // Optional
  }
  ```

### `PATCH /api/weight/:id`
Aktualisiert einen bestehenden Eintrag.

### `DELETE /api/weight/:id`
Löscht einen Eintrag.

---

## 8. Ziele (Goals)

### `GET /api/goals`
Gibt Ziele zurück.
- **Query Parameter:** `?status=active` (Optionaler Filter)

### `POST /api/goals`
Erstellt ein neues Ziel.

### `PATCH /api/goals/:id`
Aktualisiert ein Ziel.

### `POST /api/goals/:id/status`
Ändert den Status eines Ziels (active, paused, achieved, abandoned).

### `GET /api/goals/:id/progress`
Gibt den Fortschritts-Verlauf eines Ziels zurück.

### `POST /api/goals/:id/progress`
Erfasst einen neuen Fortschrittswert für ein Ziel.

---

## 9. Benachrichtigungen (Notifications)

### `GET /api/notifications`
Gibt Benachrichtigungen zurück.
- **Query Parameter:** `?unreadOnly=true`

### `POST /api/notifications`
Erstellt eine Benachrichtigung.

### `POST /api/notifications/:id/read`
Markiert eine Benachrichtigung als gelesen.
