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

### `PATCH /api/food/meals/:id`
Aktualisiert eine Mahlzeit (name, note, loggedAt). Scoped to owner.
- **Request Body:** (alle Felder optional)
  ```json
  {
    "name": "Mittagessen",
    "note": "Nach dem Training",
    "loggedAt": 1719500000000
  }
  ```
- **Response:** `200 OK` (Meal inkl. verschachtelter Items)
- **Fehler:** `404 Not Found` wenn nicht vorhanden oder nicht Owner

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

### `PUT /api/training/exercises/:id`
Aktualisiert eine Übung (gleiche Felder wie POST, alle optional).

### `DELETE /api/training/exercises/:id`
Löscht eine Übung (scoped to owner).
- **Response:** `200 OK` · `404` wenn nicht vorhanden

### `GET /api/training/workout-plans`
Gibt die Trainingspläne des Benutzers zurück.

### `POST /api/training/workout-plans`
Erstellt einen neuen Trainingsplan inkl. Übungen, Sets und Reps.
- **Request Body:**
  ```json
  {
    "name": "Push Day",
    "schedule": "Mo/Mi/Fr",
    "isActive": false,
    "exercises": [
      {
        "exerciseId": "uuid",
        "dayLabel": "A",
        "orderIndex": 0,
        "sets": 3,
        "reps": "10",
        "restSeconds": 90,
        "rpe": 7.5
      }
    ]
  }
  ```
- **Validierung:** Alle `exerciseId`s müssen existieren und dem User gehören. Ungültige IDs → `400 Bad Request` mit Fehlermeldung, Plan wird zurückgerollt.
- **Response:** `200 OK` (Plan inkl. verschachtelter Exercises) · `400` bei ungültigen exerciseIds

### `PUT /api/training/workout-plans/:id`
Aktualisiert einen Plan (name, schedule) und ersetzt die Exercise-Zuweisungen, wenn `exercises` im Body enthalten ist. Gleiche FK-Validierung wie POST.
- **Response:** `200 OK` · `404` wenn nicht vorhanden · `400` bei ungültigen exerciseIds

### `DELETE /api/training/workout-plans/:id`
Löscht einen Trainingsplan (inkl. aller Exercise-Zuweisungen via Cascade). Scoped to owner.
- **Response:** `200 OK` · `404` wenn nicht vorhanden

### `POST /api/training/workout-plans/:id/activate`
Setzt einen Plan als aktiv und deaktiviert alle anderen Pläne des Users.
- **Response:** `200 OK`

### `GET /api/training/workout-sessions`
Gibt aufgezeichnete Trainingseinheiten zurück.
- **Query Parameter:** `?date=YYYY-MM-DD`

### `POST /api/training/workout-sessions`
Startet eine neue Trainingseinheit.

### `PATCH /api/training/workout-sessions/:id`
Beendet/Aktualisiert eine Trainingseinheit.

### `DELETE /api/training/workout-sessions/:id`
Löscht eine Trainingseinheit (inkl. aller Sets via Cascade). Scoped to owner.
- **Response:** `200 OK` · `404` wenn nicht vorhanden

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

### `DELETE /api/goals/:id`
Löscht ein Ziel (scoped to owner).
- **Response:** `200 OK` · `404` wenn nicht vorhanden

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

### `DELETE /api/notifications/:id`
Löscht eine Benachrichtigung (scoped to owner).
- **Response:** `200 OK` · `404` wenn nicht vorhanden

---

## 10. Trainingsplan (Schedule)

Das Schedule-System besteht aus einem wöchentlichen Template (ein Eintrag pro Wochentag) und optionalen Overrides für spezifische Daten.

### `GET /api/schedule`
Gibt das wöchentliche Template des Users zurück (7 Einträge, einer pro `dayOfWeek` 0=So..6=Sa).
- **Response:** `200 OK`
  ```json
  {
    "schedule": [
      { "id": "uuid", "dayOfWeek": 1, "planId": "uuid", "label": "Push Day", "overrideDate": null, "overrideLabel": null, "overridePlanId": null }
    ]
  }
  ```

### `PUT /api/schedule`
Ersetzt das gesamte wöchentliche Template. Alle bestehenden Einträge werden gelöscht und durch die neuen ersetzt.
- **Request Body:** Array von Einträgen
  ```json
  [
    { "dayOfWeek": 1, "planId": "uuid", "label": "Push Day" },
    { "dayOfWeek": 2, "label": "Rest Day" },
    { "dayOfWeek": 3, "planId": "uuid", "label": "Pull Day" }
  ]
  ```
- **Response:** `200 OK` (Array der erstellten Einträge)

### `GET /api/schedule/today`
Gibt zurück, was heute ansteht (basierend auf `dayOfWeek` in der User-Zeitzone). Wenn ein Override für das heutige Datum existiert, wird dieser zurückgegeben.
- **Response:** `200 OK`
  ```json
  {
    "dayOfWeek": 1,
    "label": "Push Day",
    "planId": "uuid",
    "plan": { "id": "uuid", "name": "Push Day", "exercises": [...] },
    "isOverride": false,
    "overrideDate": null
  }
  ```

### `GET /api/schedule/week`
Gibt die 7 Tage der aktuellen Woche zurück (mit Overrides angewendet).
- **Response:** `200 OK`
  ```json
  {
    "days": [
      { "date": "2026-07-15", "dayOfWeek": 1, "label": "Push Day", "planId": "uuid", "plan": null, "isOverride": false }
    ]
  }
  ```

### `POST /api/schedule/override`
Erstellt oder aktualisiert einen Override für ein spezifisches Datum. Wenn bereits ein Override für dieses Datum existiert, wird er aktualisiert.
- **Request Body:**
  ```json
  {
    "date": "2026-07-15",
    "label": "Rest Day",
    "planId": null
  }
  ```
- **Response:** `200 OK` (der erstellte/aktualisierte Eintrag)

### `DELETE /api/schedule/override/:date`
Entfernt einen Override für ein spezifisches Datum (zurück zum Template).
- **Response:** `200 OK`

---

## 11. Geräte (Machines)

Geräte-Registry mit Weight-Logging und Progression-Tracking.

### `GET /api/machines`
Listet alle Geräte des Users. Optionaler Filter nach Muskelgruppe.
- **Query Parameter:** `?muscleGroup=chest`
- **Response:** `200 OK`
  ```json
  {
    "machines": [
      { "id": "uuid", "name": "Butterfly", "muscleGroup": "chest", "imageUrl": null, "notes": null }
    ]
  }
  ```

### `POST /api/machines`
Erstellt ein neues Gerät.
- **Request Body:**
  ```json
  {
    "name": "Brustpresse",
    "muscleGroup": "chest",
    "imageUrl": "https://…",
    "notes": "Sitz auf 3, Griffe eng"
  }
  ```
- **Response:** `200 OK`

### `PUT /api/machines/:id`
Aktualisiert ein Gerät (scoped to owner).
- **Response:** `200 OK` · `404` wenn nicht vorhanden

### `DELETE /api/machines/:id`
Löscht ein Gerät (inkl. aller Logs via Cascade).
- **Response:** `200 OK` · `404` wenn nicht vorhanden

### `GET /api/machines/:id/logs`
Geräte-Log-Historie (neueste zuerst).
- **Query Parameter:** `?limit=30` (Standard: 30)
- **Response:** `200 OK`
  ```json
  {
    "logs": [
      { "id": "uuid", "machineId": "uuid", "weight": 60, "weightUnit": "kg", "reps": 10, "sets": 3, "loggedAt": 1719500000000, "note": null }
    ]
  }
  ```

### `POST /api/machines/:id/logs`
Loggt ein Gewicht für ein Gerät.
- **Request Body:**
  ```json
  {
    "weight": 60,
    "weightUnit": "kg",
    "reps": 10,
    "sets": 3,
    "loggedAt": 1719500000000,
    "note": "Fühlt sich leicht an"
  }
  ```
- **Response:** `200 OK`

### `DELETE /api/machines/:id/logs/:logId`
Löscht einen Log-Eintrag.
- **Response:** `200 OK`

### `GET /api/machines/:id/progress`
Progression-Zusammenfassung für ein Gerät.
- **Response:** `200 OK`
  ```json
  {
    "machine": { "id": "uuid", "name": "Brustpresse", ... },
    "firstLog": { "weight": 55, "loggedAt": ... },
    "latestLog": { "weight": 60, "loggedAt": ... },
    "delta": 5,
    "maxWeight": 62.5,
    "recentLogs": [ ... ]
  }
  ```
