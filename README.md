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

In **production**, set these directly in the Cloudflare Pages project
(Settings → Environment variables) — see [`docs/deploy.md`](docs/deploy.md) for
the full setup. D1 migrations are applied separately (dashboard Console paste
or `npm run db:migrate:remote`); no GitHub Actions are used.

To set them via wrangler instead of the dashboard (one-off, do **not** commit
the values):

```bash
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

This project deploys to **Cloudflare Pages** via the **native Cloudflare Pages
GitHub integration** (the repo is connected in the Pages dashboard): on every
push to `main`, Cloudflare builds the frontend + Pages Functions and deploys
automatically. **No GitHub Actions are used.** That integration does **not**
run D1 migrations, so the remote database schema is applied separately.

### D1 migrations

The native integration never runs `wrangler d1 migrations apply`, so the remote
`ironlog-mvp-db` starts empty and every DB-backed endpoint 500s. Apply the
initial schema once:

- **From the dashboard (no CLI):** Cloudflare → Workers & Pages → D1 →
  `ironlog-mvp-db` → **Console** tab → paste the entire contents of
  [`migrations/0000_acoustic_mindworm.sql`](migrations/0000_acoustic_mindworm.sql)
  → **Run**. The `--> statement-breakpoint` lines are SQLite line-comments and
  are ignored.
- **With wrangler locally:** `npx wrangler login && npm run db:migrate:remote`.

Clerk env vars (`CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`,
`VITE_CLERK_PUBLISHABLE_KEY`) are set in the Cloudflare **Pages project**
(Settings → Environment variables), not in GitHub. See
[`docs/deploy.md`](docs/deploy.md) for the full setup and the Definition of Done
checklist.

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
→ `{ "exercises": [] }` (stub — backing store pending; see KILA-187)

### Supplements

#### `GET /api/supplements`
→ `{ "supplements": [] }` (stub — see KILA-188)

### Weight

#### `GET /api/weight`
→ `{ "entries": [] }` (stub — see KILA-188)

### Goals

#### `GET /api/goals`
→ `{ "goals": [] }` (stub — see KILA-188)

> Stubs return empty arrays and are owned by sibling issues (KILA-187/KILA-188).
> Their routes are registered and auth-gated; the storage layer is filled in by
> those tickets.

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
├── .github/workflows/deploy.yml
├── scripts/create-agent-token.mjs
├── wrangler.toml
├── drizzle.config.ts
├── vite.config.ts
└── package.json
```