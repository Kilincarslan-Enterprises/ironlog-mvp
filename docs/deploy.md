# Deployment & D1 migrations (native CF Pages, no GitHub Actions)

IronLog deploys via the **native Cloudflare Pages GitHub integration**: the repo
is connected in the Pages dashboard, and Cloudflare builds the frontend + Pages
Functions and deploys on every push to `main`. **No GitHub Actions are used.**

That integration does **not** run D1 migrations, so the remote database schema is
applied separately — either from the Cloudflare dashboard (no CLI) or with
wrangler locally.

## 1. Clerk env vars — set in the Pages project (dashboard)

Set these in the Cloudflare Pages project → **Settings → Environment
variables** (Production):

| Variable | Value | Used by |
|---|---|---|
| `CLERK_SECRET_KEY` | Clerk secret key (`sk_*`) | API runtime — `@hono/clerk-auth` verifies JWTs |
| `CLERK_PUBLISHABLE_KEY` | Clerk prod publishable key (`pk_live_*`) | API runtime — `@hono/clerk-auth` |
| `VITE_CLERK_PUBLISHABLE_KEY` | same `pk_live_*` | Vite build — baked into the browser bundle |

> Without `CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY`, `clerkMiddleware()`
> throws → 500 on every API endpoint. Without the `pk_live_*` build key, the
> frontend shows "Clerk has been loaded with development keys".

These live in the **Pages project** env, not in GitHub. (`CLOUDFLARE_API_TOKEN` /
`CLOUDFLARE_ACCOUNT_ID` are **not** needed here — the Functions runtime uses the
`DB` D1 binding, not the API token.)

## 2. D1 migrations — apply the schema to the remote database

The native integration never runs `wrangler d1 migrations apply`, so the remote
`ironlog-mvp-db` starts empty and every DB-backed endpoint 500s. Apply the
initial schema once, by either method below.

### Method A — Cloudflare dashboard (no CLI, recommended for a Pages-only setup)

1. In the Cloudflare dashboard open **Workers & Pages → D1 → `ironlog-mvp-db`**.
2. Go to the **Console** tab (the in-browser SQL runner).
3. Open [`migrations/0000_acoustic_mindworm.sql`](../migrations/0000_acoustic_mindworm.sql),
   copy the **entire file**, paste it into the Console, and **Run**.
   - The `--> statement-breakpoint` lines are SQLite line-comments (`--` …) and
     are ignored — the file runs as-is (verified).
4. After running, the Console should show the 16 tables. Verify with:
   `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;`

### Method B — wrangler CLI (if you have the repo locally)

```bash
npx wrangler login
npm run db:migrate:remote   # = wrangler d1 migrations apply ironlog-mvp-db --remote
```

## Verifying the fix (Definition of Done)

- The D1 Console lists the 16 tables (above).
- Authenticated API calls return 200, not 500:
  `GET /api/dashboard`, `/api/training/exercises`, `/api/supplements`,
  `/api/nutrition/daily`, `/api/training/workout-plans`,
  `/api/training/personal-records`, `/api/training/workout-sessions`
- No "Clerk has been loaded with development keys" warning
- UI shows empty states (not error states) when there's no data; data can be
  created through the UI