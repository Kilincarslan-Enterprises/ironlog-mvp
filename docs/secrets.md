# Deployment & migrations setup

IronLog deploys via the **native Cloudflare Pages GitHub integration** (repo
connect in the Pages dashboard): Cloudflare builds the frontend + Pages
Functions and deploys on push to `main`. That integration does **not** run D1
migrations, so the remote DB is kept in sync separately.

## 1. Clerk env vars (Pages project — set once in the dashboard)

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

These are managed directly in the Pages dashboard — they are **not** GitHub
secrets and are not touched by any workflow.

## 2. D1 migrations (GitHub Actions — 2 repo secrets)

The `Apply D1 migrations (remote)` workflow (`.github/workflows/migrate.yml`)
applies `migrations/` to the remote `ironlog-mvp-db`. It is triggered manually
(Actions tab → "Run workflow", or `gh workflow run migrate.yml`) — it does not
deploy.

Add these two GitHub repo secrets (**Settings → Secrets and variables →
Actions → Repository secrets**):

| Secret | What it is | Notes |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | CF API token with **D1:Edit** on the database's account. | **Must not be IP-restricted** — if it is, CI fails with Cloudflare error `9109 Cannot use the access token from location`. Create at Cloudflare → My Profile → API Tokens. |
| `CLOUDFLARE_ACCOUNT_ID` | CF account ID owning the D1 database. | Cloudflare dashboard → any domain/Workers page → right sidebar → "Account ID". |

After adding both, trigger the workflow. The "Verify tables exist" step prints
the remote tables so you can confirm the schema landed.

## Verifying the fix (Definition of Done)

- `gh run list` → `Apply D1 migrations (remote)` ✓
- Authenticated API calls return 200, not 500:
  `GET /api/dashboard`, `/api/training/exercises`, `/api/supplements`,
  `/api/nutrition/daily`, `/api/training/workout-plans`,
  `/api/training/personal-records`, `/api/training/workout-sessions`
- No "Clerk has been loaded with development keys" warning
- UI shows empty states (not error states) when there's no data; data can be
  created through the UI