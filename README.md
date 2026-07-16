# IronLog — AI Fitness Tracker

IronLog is an AI-gesteuerter Fitness- und Ernährungs-Tracker. Logge Mahlzeiten,
Training, Supplements, Gewicht und Ziele. Built as a PWA on Cloudflare Pages +
D1, with a Hono API and a React + Vite frontend. Auth supports both Clerk JWT
(browser) and agent API tokens (automation / agents).

- **Frontend:** React 19 + Vite 8 + Tailwind CSS 4, installable PWA (manifest +
  icons + service worker).
- **API:** Hono on Cloudflare Pages Functions (`functions/api/`).
- **DB:** Cloudflare D1 (SQLite) via Drizzle ORM.
- **Auth:** Clerk JWT (browser sessions) **and** agent API tokens (sha256-hashed
  secrets in D1).

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Create the D1 database (one-time)
npx wrangler d1 create ironlog-mvp-db
#   ^ copy the returned database_id into wrangler.toml's [[d1_databases]]

# 3. Apply migrations locally
npm run db:migrate:local

# 3b. Apply migrations to the remote (production) D1
npx wrangler d1 migrations apply ironlog-mvp-db --remote

# 4. Copy env template and fill in your Clerk keys
cp .env.example .env            # build-time VITE_* vars for the frontend
cp .dev.vars.example .dev.vars  # runtime secret vars for Pages Functions

# 5. Run the app + API together. `pages:dev` builds the frontend, then serves
#    `dist/` + the Pages Functions on http://localhost:8788, with the local D1
#    binding from wrangler.toml (the same D1 that `db:migrate:local` writes to).
npm run pages:dev
```

The app is served at `http://localhost:8788` and the API at `/api/*`.
For frontend HMR while iterating on UI, run `npm run dev` (Vite-only) in a
separate terminal — the API won't be available there, so use `pages:dev` for
full-stack work.

### Other useful scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Vite-only frontend dev with HMR (no API / no D1 binding) |
| `npm run pages:dev` | Build frontend, then serve `dist` + Functions + local D1 on :8788 (no HMR) |
| `npm run build` | Type-check (`tsc -b`) + Vite production build → `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | Oxlint |
| `npm run db:migrate:local` | Apply D1 migrations to the local SQLite file |
| `npm run db:migrate:remote` | Apply D1 migrations to the production D1 |
| `npm run db:generate` | Generate a new migration from `db/schema.ts` (drizzle-kit) |
| `npm run token:create` | Provision an agent API token (see [Agent API tokens](#agent-api-tokens)) |

---

## Environment variables

Two categories — **build-time** vars (read by Vite at build, must be present
when you run `npm run build`) and **runtime** vars (Pages Functions env
bindings, read by the API at request time).

### Build-time (frontend) — set as shell env or in `.env`

| Variable | Purpose |
| --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key; injected into the browser bundle |

### Runtime (API) — set as Pages env vars / secrets

| Variable | Purpose |
| --- | --- |
| `CLERK_PUBLISHABLE_KEY` | Used by `@hono/clerk-auth` to verify JWTs |
| `CLERK_SECRET_KEY` | Used by `@hono/clerk-auth` backend |

Set runtime secrets on Cloudflare (do **not** commit them):

```bash
# Production (Cloudflare Pages dashboard → Settings → Environment variables,
# or via wrangler):
npx wrangler pages secret put CLERK_SECRET_KEY --project-name=ironlog
npx wrangler pages secret put CLERK_PUBLISHABLE_KEY --project-name=ironlog
```

For local dev, put them in `.dev.vars` (gitignored) at the repo root:

```
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

> `.env`, `.dev.vars`, and `.wrangler/` are gitignored — never commit secrets.

---

## Deployment

**Live URL:** https://ironlog-mvp.pages.dev/

This project deploys to **Cloudflare Pages**. Two supported paths:

### A. GitHub Actions (recommended, automated)

`.github/workflows/deploy.yml` deploys on every push to `main`. It runs
`npm run build` and `wrangler pages deploy dist`, then applies D1 migrations
to the remote database. Configure these repo secrets (GitHub → Settings →
Secrets and variables → Actions):

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Pages + D1 permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `VITE_CLERK_PUBLISHABLE_KEY` | Injected at build time for the browser bundle |

Runtime secrets (`CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`) are set on the
Cloudflare Pages project directly — the CI build does not need them.

### B. Manual (wrangler)

```bash
npm run build
npx wrangler pages deploy dist --project-name=ironlog
npm run db:migrate:remote   # apply D1 migrations
```

### wrangler.toml

```toml
name = "ironlog"
compatibility_date = "2025-06-27"
pages_build_output_dir = "dist"

[[d1_databases]]
binding = "DB"
database_name = "ironlog-mvp-db"
database_id = "<your-database-id>"
migrations_dir = "migrations"
```

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **D1 binding:** `DB` (consumed by `functions/api/db.ts`)

---

## PWA

IronLog is an installable PWA:

- `public/manifest.json` — name, icons (192/512 PNG + SVG), `display: standalone`,
  theme color `#0f172a`.
- `public/icons/` — `icon-192.png`, `icon-512.png` (maskable), `apple-touch-icon.png`,
  `favicon-32.png`, `icon.svg`.
- `index.html` — `<link rel="manifest">`, `theme-color`, `apple-mobile-web-app-capable`,
  and a `viewport` with `viewport-fit=cover` for notched devices.
- `public/sw.js` — service worker: precaches the app shell, network-first for
  navigations, stale-while-revalidate for static assets, **never** caches `/api/*`.
  Registered from `src/main.tsx` in production only.

The icon source is `public/icons/icon.svg`; regenerate the PNGs with sharp
(see the command in `scripts/` or run `node` with the sharp snippet).

---

## Authentication

Every `/api/*` route requires auth. Two methods are supported and both resolve
to the **same** D1 `users` row, stored on the Hono context (`getCtxUser(c)`):

1. **Clerk JWT** — the browser sends a Clerk session JWT. `@hono/clerk-auth`
   verifies it; the user is looked up by `clerk_id` (auto-created on first use).
2. **Agent API token** — a long-lived secret sent in the
   `Authorization: Bearer <token>` header **or** the `x-api-token: <token>`
   header. The raw token is sha256-hashed and matched against
   `agent_api_tokens.hashed_secret` where `is_revoked = false` and
   `expires_at` is null or in the future.

Resolution order (`functions/api/auth.ts#resolveUser`): Clerk JWT first, then
agent token fallback. If neither validates, the request gets `401 Unauthorized`.

### Agent API tokens

Agent tokens let automation / agents call the API without going through Clerk.
Only the **hash** is stored in D1; the raw token is shown once at creation.

**Create a token** for an existing user:

```bash
# local D1
npm run token:create -- <userId> "Cron importer" --expires-days 90
# production D1
npm run token:create -- <userId> "Cron importer" --expires-days 90 --remote
```

The script prints the raw token once — save it immediately.

**Use the token:**

```bash
curl https://your-pages-deployment/api/dashboard \
  -H "Authorization: Bearer <token>"
# or equivalently
curl https://your-pages-deployment/api/dashboard \
  -H "x-api-token: <token>"
```

The token grants the same access as the owning user's Clerk session — it can
hit every route below. To revoke, set `is_revoked = 1` on the row:

```bash
npx wrangler d1 execute ironlog-mvp-db --remote \
  --command "UPDATE agent_api_tokens SET is_revoked = 1, updated_at = (unixepoch()*1000) WHERE id = '<tokenId>';"
```

---

## API reference

Base path: `/api`. All routes require auth (Clerk JWT or agent token). Timestamps
are epoch milliseconds stored as UTC; date parameters are interpreted in the
user's `timezone`.

### `GET /api/health`
Health check (auth still required). → `{ "status": "ok" }`

### Dashboard

#### `GET /api/dashboard`
Today's snapshot in the user's timezone.
```json
{
  "user": { },
  "today": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 },
  "trainingCompleted": false,
  "weightLogged": false,
  "todayWeight": null,
  "supplementsCompleted": 0,
  "supplementsTotal": 0,
  "streaks": { "active": true, "count": 0 }
}
```

### User

#### `GET /api/user/me`
→ `{ "user": { /* users row */ } }`

#### `PATCH /api/user/me`
Update profile / targets. Body (all optional):
```json
{
  "displayName": "Athlet",
  "timezone": "Europe/Berlin",
  "unitSystem": "metric",
  "dailyCalorieTarget": 2500,
  "dailyProteinTarget": 150,
  "dailyCarbsTarget": 250,
  "dailyFatTarget": 80
}
```
Targets accept `null` to clear. → `{ "user": { /* updated row */ } }`

### Food

#### `GET /api/food/presets`
→ `{ "presets": [ /* user's presets + all public presets */ ] }`

#### `POST /api/food/presets`
```json
{
  "name": "Haferflocken", "brand": "KoRo", "servingSize": 100, "servingUnit": "g",
  "calories": 370, "protein": 13, "carbs": 60, "fat": 7, "fiber": 10, "sodium": 2,
  "barcode": "4012345678905", "isPublic": false
}
```
→ `{ "preset": { /* created row */ } }`

#### `PUT /api/food/presets/:id`
Partial update of a preset owned by the user (same body shape, all optional).
→ `{ "preset": { /* updated row */ } }` · `404` if not owned.

#### `DELETE /api/food/presets/:id`
→ `{ "success": true }` · `404` if not owned.

#### `GET /api/food/meals?date=YYYY-MM-DD`
Defaults to today. → `{ "meals": [ /* meals with nested `items` */ ] }`

#### `POST /api/food/meals`
```json
{
  "name": "Frühstück",
  "loggedAt": 1719500000000,
  "note": null,
  "items": [
    { "name": "Haferflocken", "quantity": 80, "quantityUnit": "g",
      "calories": 296, "protein": 10, "carbs": 48, "fat": 6,
      "foodPresetId": "<optional-uuid>" }
  ]
}
```
→ `{ "meal": { /* meal with `items` */ } }`

#### `PATCH /api/food/meals/:id`
Update meal metadata (name, note, loggedAt). Does not modify items. → `{ "meal": { } }` · `404` if not owned.

#### `DELETE /api/food/meals/:id/items/:itemId`
Remove one item from a meal. → `{ "success": true }` · `404` if not owned/found.

#### `DELETE /api/food/meals/:id`
Delete a meal log. → `{ "success": true }`

### Nutrition

#### `GET /api/nutrition/daily?date=YYYY-MM-DD`
Daily nutrition summary aggregated from meal items. Defaults to today.
```json
{
  "date": null,
  "totals": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "fiber": 0, "sodium": 0 },
  "meals": [ /* meals with `items` */ ]
}
```

### Training

#### `GET /api/training/exercises`
→ `{ "exercises": [ /* user's own + public exercises from others */ ] }`

#### `POST /api/training/exercises`
Create a custom exercise. Body: `{ name, category, muscleGroup?, equipment?, instructions?, isPublic? }`.
→ `{ "exercise": { /* created row */ } }`

#### `DELETE /api/training/exercises/:id`
Delete an exercise (scoped to owner). → `{ "success": true }` · `404` if not found.

#### `GET /api/training/exercises/:id/history`
Sets logged for an exercise over time (weight progression), oldest → newest.

#### `GET /api/training/exercises/:id/prs`
Personal records for one exercise: max weight, max reps, max volume.

#### `GET /api/training/workout-plans`
→ `{ "plans": [ /* plans with nested `exercises` (plan assignments) */ ] }`

#### `POST /api/training/workout-plans`
Create a plan with optional inline exercise assignments. Validates all `exerciseId`s exist and belong to the user — `400` on invalid IDs (plan is rolled back).
```json
{
  "name": "Push Day", "schedule": "Mo/Mi/Fr", "isActive": false,
  "exercises": [
    { "exerciseId": "<uuid>", "dayLabel": "A", "sets": 3, "reps": "10", "restSeconds": 90, "rpe": 7.5 }
  ]
}
```
→ `{ "plan": { /* plan with `exercises` */ } }`

#### `PUT /api/training/workout-plans/:id`
Edit plan name/schedule. If `exercises` array is provided, replaces all exercise assignments (same FK validation as POST). → `{ "plan": { } }`

#### `DELETE /api/training/workout-plans/:id`
Delete a plan (cascades to exercise assignments). → `{ "success": true }` · `404` if not owned.

#### `POST /api/training/workout-plans/:id/activate`
Set a plan as the active one (deactivates all others). → `{ "plan": { } }`

#### `GET /api/training/workout-sessions?date=YYYY-MM-DD`
Sessions for a day (defaults to today in user's tz), with nested `sets`. → `{ "sessions": [ ] }`

#### `POST /api/training/workout-sessions`
Start a session. Body: `{ name?, planId?, startedAt? }`. → `{ "session": { } }`

#### `PATCH /api/training/workout-sessions/:id`
Finish/update a session. Body: `{ endedAt?, durationSeconds?, notes?, name? }`. Auto-computes `durationSeconds` from `startedAt` when omitted.

#### `DELETE /api/training/workout-sessions/:id`
Delete a session (cascades to sets). → `{ "success": true }` · `404` if not owned.

#### `POST /api/training/workout-sessions/:id/sets`
Add a set. Body: `{ exerciseId, reps?, weight?, weightUnit?, durationSeconds?, distance?, distanceUnit?, rpe?, isWarmup?, isDropset? }`.

#### `PATCH /api/training/workout-sessions/:id/sets/:setId`
Update a set (same fields, all optional).

#### `DELETE /api/training/workout-sessions/:id/sets/:setId`
Delete a set. → `{ "success": true }`

#### `GET /api/training/personal-records`
Best (max weight) per exercise across all sessions. → `{ "records": [ ] }`

### Schedule

Weekly template mapping weekday → workout plan, with per-date overrides for flexibility.

#### `GET /api/schedule`
→ `{ "schedule": [ { dayOfWeek, planId, label, ... } ] }`

#### `PUT /api/schedule`
Replace the entire weekly template. Body: array of `{ dayOfWeek, planId?, label }`.

#### `GET /api/schedule/today`
What's scheduled for today (timezone-aware). Checks overrides first. → `{ dayOfWeek, label, planId, plan?, isOverride, overrideDate? }`

#### `GET /api/schedule/week`
7 days for the current week with overrides applied. → `{ days: [ { date, dayOfWeek, label, planId, plan?, isOverride } ] }`

#### `POST /api/schedule/override`
Create/update an override for a specific date. Body: `{ date: "YYYY-MM-DD", label, planId? }`.

#### `DELETE /api/schedule/override/:date`
Remove an override (revert to template). → `{ "success": true }`

### Machines

Gym equipment registry with weight logging and progression tracking.

#### `GET /api/machines?muscleGroup=chest`
→ `{ "machines": [ { id, name, muscleGroup, imageUrl, notes } ] }`

#### `POST /api/machines`
Body: `{ name, muscleGroup?, imageUrl?, notes? }`. → `{ "machine": { } }`

#### `PUT /api/machines/:id`
Update a machine (same fields, all optional). → `{ "machine": { } }` · `404` if not owned.

#### `DELETE /api/machines/:id`
Delete a machine (cascades to logs). → `{ "success": true }`

#### `GET /api/machines/:id/logs?limit=30`
Log history for a machine (newest first). → `{ "logs": [ { weight, weightUnit, reps, sets, loggedAt, note } ] }`

#### `POST /api/machines/:id/logs`
Log a weight entry. Body: `{ weight, weightUnit?, reps?, sets?, loggedAt?, note? }`. → `{ "log": { } }`

#### `DELETE /api/machines/:id/logs/:logId`
Delete a log entry. → `{ "success": true }`

#### `GET /api/machines/:id/progress`
Progression summary: first log, latest log, delta, max weight, recent logs. → `{ machine, firstLog, latestLog, delta, maxWeight, recentLogs }`

### Supplements

#### `GET /api/supplements`
→ `{ "supplements": [ /* active supplements */ ] }` · `?all=true` includes inactive

#### `POST /api/supplements`
Create a supplement. Body: `{ name, form?, unitDose?, doseUnit?, dailyFrequency?, reminderTimes?, isActive? }`.

#### `PATCH /api/supplements/:id`
Update a supplement (same fields, all optional).

#### `DELETE /api/supplements/:id`
Delete a supplement. → `{ "success": true }`

#### `GET /api/supplements/logs?date=YYYY-MM-DD`
Supplement intake logs for a day (defaults to today). → `{ "logs": [ ] }`

#### `POST /api/supplements/logs`
Log an intake. Body: `{ supplementId, dose?, doseUnit?, takenAt?, note? }`. Inherits dose/doseUnit from the supplement when omitted.

#### `DELETE /api/supplements/logs/:id`
Delete a log entry. → `{ "success": true }`

### Weight

#### `GET /api/weight`
Weight entries. `?range=7d|30d|90d|all` (default `30d`). → `{ "entries": [ ] }`

#### `POST /api/weight`
Log a weight entry. Body: `{ weight, unit?, measuredAt?, bodyFatPercentage?, note? }`.

#### `PATCH /api/weight/:id`
Update a weight entry (same fields, all optional).

#### `DELETE /api/weight/:id`
Delete a weight entry. → `{ "success": true }`

### Goals

#### `GET /api/goals?status=active`
List goals, optionally filtered by status. → `{ "goals": [ ] }`

#### `POST /api/goals`
Create a goal. Body: `{ title, category, direction?, targetValue?, targetUnit?, deadline?, status? }`.

#### `PATCH /api/goals/:id`
Update a goal (same fields, all optional).

#### `POST /api/goals/:id/status`
Change goal status. Body: `{ status: "active"|"paused"|"achieved"|"abandoned" }`.

#### `GET /api/goals/:id/progress`
Progress entries for a goal, oldest → newest. → `{ "progress": [ ] }`

#### `POST /api/goals/:id/progress`
Add a progress entry. Body: `{ value, unit?, recordedAt?, note? }`. → `{ "progress": { } }`

---

## Data model

Schema is in `db/schema.ts`; migrations in `migrations/`. Core tables:

- `users` — profile + daily macro targets (`clerk_id`, `timezone`, `unit_system`, targets)
- `agent_api_tokens` — hashed agent API secrets (`user_id`, `hashed_secret`, `scopes`, `expires_at`, `is_revoked`)
- `food_presets`, `meals`, `meal_items` — nutrition logging
- `exercises`, `workout_plans`, `workout_plan_exercises`, `workout_sessions`, `workout_session_sets` — training
- `supplements`, `supplement_logs` — supplement tracking
- `weight_entries` — body-weight history
- `goals`, `goal_progress_entries` — goals + progress
- `notifications` — in-app notifications

Regenerate migrations after schema changes:

```bash
npm run db:generate      # writes a new file under migrations/
npm run db:migrate:local # apply locally
```

---

## Project structure

```
.
├── db/schema.ts             # Drizzle schema (source of truth for tables)
├── migrations/              # Generated D1 migrations
├── functions/api/           # Cloudflare Pages Functions (Hono API)
│   ├── [[route]].ts         # App entry: Clerk middleware + auth guard + routes
│   ├── auth.ts              # resolveUser (Clerk JWT | agent token), getCtxUser
│   ├── db.ts                # drizzle(d1) factory
│   ├── env.ts               # Env bindings type
│   └── routes/              # dashboard, food, nutrition, user, training, ...
├── public/                  # Static assets served as-is (manifest, icons, sw.js)
│   ├── manifest.json
│   ├── sw.js
│   └── icons/
├── src/                     # React frontend
├── cli/                     # IronLog CLI (zero-dep Node.js, for humans & AI agents)
│   ├── ironlog.mjs          # CLI entry point (all API endpoints)
│   ├── bin.mjs              # bin wrapper
│   ├── SKILL.md             # AI agent skill reference
│   ├── AGENTS.md            # Agent operations guide
│   └── CLAUDE.md            # Claude Code guide
├── .github/workflows/deploy.yml
├── scripts/create-agent-token.mjs
├── wrangler.toml
├── drizzle.config.ts
├── vite.config.ts
└── package.json
```

---

## CLI

IronLog ships with a zero-dependency CLI (`cli/ironlog.mjs`) that wraps every API
endpoint. Designed for both humans and AI agents (Gideon, Claude Code, Codex, etc.).

### Quick start

```bash
# 1. Login (stores token in ~/.ironlog/config.json)
node cli/ironlog.mjs login <your-api-token>

# 2. Verify
node cli/ironlog.mjs health
node cli/ironlog.mjs whoami

# 3. Use any command (--json for raw JSON output)
node cli/ironlog.mjs dashboard --json
node cli/ironlog.mjs weight create '{"weight":82.3,"unit":"kg"}' --json
```

### Token

Get an API token from the IronLog app Settings page, or create one via CLI:

```bash
node cli/ironlog.mjs tokens create --label "Agent"
```

Alternatively set the `IRONLOG_TOKEN` env var (no login needed).

### Commands

| Category | Commands |
| --- | --- |
| System | `health`, `whoami`, `dashboard`, `user update` |
| Tokens | `tokens list`, `tokens create`, `tokens revoke` |
| Food | `food presets`, `food presets create/update/delete`, `food meals`, `food meals create/update/delete`, `nutrition daily` |
| Training | `training exercises`, `training exercises create/delete`, `training plans`, `training plans create/delete`, `training sessions`, `training sessions create/delete`, `training sessions update`, `training sessions add-set/update-set/delete-set`, `training prs` |
| Schedule | `schedule`, `schedule set`, `schedule today`, `schedule week`, `schedule override`, `schedule override delete` |
| Machines | `machines`, `machines create/update/delete`, `machines logs`, `machines log`, `machines log delete`, `machines progress` |
| Supplements | `supplements`, `supplements create/update/delete`, `supplements logs`, `supplements logs create/delete` |
| Weight | `weight`, `weight create/update/delete` |
| Goals | `goals`, `goals create/update/status`, `goals progress`, `goals progress add` |
| Notifications | `notifications`, `notifications create`, `notifications read` |

Run `node cli/ironlog.mjs help` for full usage.

### AI Agent integration

The CLI ships with three agent-facing docs:

| File | Purpose |
| --- | --- |
| `cli/SKILL.md` | Full command reference for AI agents |
| `cli/AGENTS.md` | Operational patterns, workflows, error handling |
| `cli/CLAUDE.md` | Claude Code / Cursor / Copilot quick guide |

To use the IronLog CLI as a Hermes Agent skill, copy or symlink `cli/SKILL.md`
into your skills directory. The skill is self-contained and references the CLI
at `cli/ironlog.mjs` in the repo.