# Changelog

All notable changes to **IronLog** are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/), versioning follows [Semantic Versioning](https://semver.org/).

---

## [0.7.0] — 2026-07-18

### Added
- **Stück-basierte Portionsgröße** — Lebensmittel können jetzt pro Stück geloggt werden. Beispiel: 1 Ei = 53g, 1 Packung Skyrl = 500g. Beim Anlegen "g pro Stück" und "Stück-Name" ausfüllen.
- **Gramm/Stück-Umschalter** — Beim Mahlzeit hinzufügen kann zwischen Gramm und Stück gewechselt werden. Nährwerte werden automatisch berechnet (Stück × g-pro-Stück / 100g × Nährwerte).
- **Preset bearbeiten** — Vorhandene Lebensmittel können jetzt bearbeitet werden (Edit-Button in der Preset-Liste). Alle Felder inkl. Stück-Einstellungen änderbar.
- **Preset löschen** — Löschen-Button im Edit-Modal.
- **Barcode auto-Packung** — `GET /api/food/barcode/:barcode` erkennt automatisch die Packungsgröße aus Open Food Facts (`quantity`-Feld, z.B. `"850 g"`, `"1 kg"`) und setzt am Preset `pieceSize` (Gewicht in Gramm, kg→×1000) und `pieceName = "Packung"`. Produkte können als "1 Packung" geloggt werden. Wenn `quantity` fehlt/leer ist, bleibt `pieceSize` null (gramm-only Preset).

### Changed
- `food_presets` Schema: neue Felder `piece_size` (REAL) und `piece_name` (TEXT)
- Migration 0003_food_piece_serving.sql angewendet
- `NewPresetForm` und neues `PresetEditForm` mit Stück-Optionen

---

## [0.6.0] — 2026-07-17

### Added
- **Unified exercise system** — Machines and free-weight exercises merged into one system. Every exercise has a `type` field: `machine`, `free-weight`, or `bodyweight`.
- **Migration 0002_unified_exercises** — Existing machines copied into exercises table with `type='machine'`. New columns: `type`, `image_url`, `notes` on exercises.
- **Unified "Übung hinzufügen" modal** — Choose type (Maschine/Freihantel/Körpergewicht) when creating. Machine-type shows optional image URL and notes.
- **Exercise detail modal** — Click any exercise to see progress (first/latest/delta/max), recent log history, and quick weight+reps logging.
- **Type badges** in exercise list — Color-coded labels: Maschine (accent), Freihantel (success), Körpergewicht (warning).
- **Plan creation** — All exercise types selectable in plan editor, with type badges.
- **Session "Satz hinzufügen"** — Shows plan exercises if session started from plan, otherwise all exercises.
- **Plan-Start für jeden Plan** — Jeder Plan hat einen Start-Button. Pläne können spontan gestartet werden, unabhängig vom Wochenplan.
- **"Letzter Satz" Anzeige** — Beim Satz hinzufügen wird der letzte Satz der gewählten Übung aus der laufenden Session angezeigt (z.B. "70kg × 8"). "Werte übernehmen" kopiert die Werte in die Eingabefelder.
- **Add-Set Modal mit Sektionen** — Plan-Übungen mit "IM PLAN" Badge zuerst, dann "Andere Übungen" (inkl. Maschinen) in separater Sektion.

### Changed
- Training page rebuilt: machines section removed, unified exercises list with type badges
- Machine API endpoints now query `exercises WHERE type='machine'` (backward compatible)
- `Exercise` type extended with `type`, `imageUrl`, `notes` fields
- Removed separate machines/machineLogs loading from Training page (uses exercises list)
- **Plan-Modal vereinfacht** — Keine Sets/Reps/Tag Felder mehr beim Übungen auswählen. Nur an/abwählen. Pläne sind reine Übungslisten.
- **"Aktivieren" entfernt** — Pläne sind Übungslisten, der Wochenplan (Schedule) ist separat. Keine aktiven/inaktiven Pläne mehr.
- **Plan-Übungen live** — Wenn ein Plan während einer laufenden Session bearbeitet wird, erscheinen neue Übungen sofort im Add-Set Modal unter "Im Plan".

### Fixed
- Training page crashes: `session.sets` undefined, `plan.exercises` undefined, `maxWeight` type mismatch

---

## [0.5.0] — 2026-07-16

### Added
- **Barcode scanner** — Scan product barcodes with the phone camera, nutritional data is fetched from Open Food Facts and automatically saved as a food preset
- **Manual barcode entry** — Enter a barcode manually if camera is unavailable
- **`GET /api/food/barcode/:barcode`** — Backend endpoint that caches barcode lookups in D1 and proxies to Open Food Facts
- **CLI: `food barcode <barcode>`** — Look up a product by barcode from the command line
- **CHANGELOG.md** — Release notes with semantic versioning (this file)

### Changed
- Food "Add meal" modal now has a "Barcode scannen" button at the top
- Scanned products are cached as food presets — subsequent scans of the same barcode return instantly from D1

---

## [0.4.0] — 2026-07-16

### Added
- **CLI: `training exercises update`** — Update exercise metadata
- **CLI: `training plans update`** — Update workout plans (was shadowed by GET, now fixed)
- **CLI: `goals delete`** — Delete a goal
- **CLI: `notifications delete`** — Delete a notification
- **API: `DELETE /api/notifications/:id`** — New endpoint (was missing entirely)

### Changed
- Schedule `set` command pitfall documented: expects `dayOfWeek` (integer 0–6, 0=Sunday), not `day`
- All docs updated with new commands and endpoints

---

## [0.3.0] — 2026-07-16

### Added
- **Plan CRUD in UI** — Create, edit, view, and delete workout plans directly in the Training page
- **Schedule editor in UI** — 7-day grid to assign plans or rest days to each weekday
- **Exercise delete in UI** — Delete exercises from the Training page
- **`DELETE /api/training/exercises/:id`** — New backend endpoint

### Changed
- Training page rebuilt with schedule card, weekly calendar, machine gallery, and plan management
- API client extended with `deleteWorkoutPlan`, `deleteExercise` functions

---

## [0.2.0] — 2026-07-16

### Added
- **Weekly training schedule** — Map weekday → workout plan with per-date overrides
- **Machine registry** — Gym equipment with images, muscle group, and notes
- **Machine weight logging** — Log kg/reps/sets per machine per day
- **Machine progression tracking** — First log, latest log, delta, all-time max, recent logs
- **API: `GET/PUT /api/schedule`** — List/replace weekly template
- **API: `GET /api/schedule/today`** — Today's plan (timezone-aware, override-aware)
- **API: `GET /api/schedule/week`** — 7-day week view with overrides applied
- **API: `POST /api/schedule/override`** — Create/update override for a specific date
- **API: `DELETE /api/schedule/override/:date`** — Remove override
- **API: `GET/POST/PUT/DELETE /api/machines`** — Full CRUD for gym equipment
- **API: `GET/POST /api/machines/:id/logs`** — Machine weight log history and logging
- **API: `DELETE /api/machines/:id/logs/:logId`** — Delete a log entry
- **API: `GET /api/machines/:id/progress`** — Progression summary
- **CLI: schedule commands** — `schedule`, `schedule set`, `schedule today`, `schedule week`, `schedule override`, `schedule override delete`
- **CLI: machine commands** — `machines`, `machines create/update/delete`, `machines logs`, `machines log`, `machines log delete`, `machines progress`
- **D1 migration `0001_colorful_namora.sql`** — schedule_templates, machines, machine_logs tables

### Changed
- All docs updated: API_DOCUMENTATION.md, README.md, cli/SKILL.md, cli/AGENTS.md

---

## [0.1.1] — 2026-07-16

### Fixed
- **CLI command matcher** — 3-word commands now matched before 2-word commands (e.g. `training exercises create` no longer matches `training exercises` GET handler)
- **API: FK validation** — POST/PUT `/training/workout-plans` validates exercise IDs before insert, returns 400 on invalid references
- **API: DELETE endpoints** — Added `DELETE /training/workout-plans/:id` and `DELETE /training/workout-sessions/:id` with cascade deletes
- **API: PATCH /food/meals/:id** — New endpoint for updating meal name, note, loggedAt

---

## [0.1.0] — 2026-07-15

### Added
- Initial IronLog MVP with Cloudflare Pages + D1 + Hono + Drizzle ORM
- User authentication via API tokens
- Food presets, meals, and nutrition tracking
- Training exercises, workout plans, sessions, and sets
- Supplements with daily logging
- Weight tracking with goals and progress
- Dashboard with daily summary
- Zero-dependency CLI (`cli/ironlog.mjs`)
- Agent documentation (`cli/SKILL.md`, `cli/AGENTS.md`)