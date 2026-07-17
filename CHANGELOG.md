# Changelog

All notable changes to **IronLog** are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/), versioning follows [Semantic Versioning](https://semver.org/).

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