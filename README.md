# IronLog

Lightweight log service running on Cloudflare Pages + D1 + Pages Functions.

## Stack

- **Cloudflare Pages** for static hosting and edge functions
- **D1** as the SQLite edge database
- **Pages Functions** (`functions/`) for API routes
- **Plain JavaScript** (no framework)

## Project structure

```
functions/api/[[route]].js   # Pages Function entry point
migrations/                  # D1 SQL migrations
static/                      # Static site assets (served by Pages)
wrangler.toml                # Wrangler / Cloudflare project config
package.json                 # Project manifest
```

## Scripts

```bash
npm run dev                  # Local Pages dev server (needs D1 binding)
npm run deploy               # Deploy to Cloudflare Pages
```

## D1 migrations

Apply migrations to a D1 database:

```bash
wrangler d1 migrations apply ironlog-db --local   # local dev
wrangler d1 migrations apply ironlog-db --remote  # production
```

Replace the placeholder `database_id` in `wrangler.toml` with the real D1 database ID.

## Environment setup

1. Create a Cloudflare Pages project (`ironlog`).
2. Create a D1 database (`ironlog-db`) and copy its ID into `wrangler.toml`.
3. Bind the D1 database as `DB` in the Pages project settings.
4. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to your GitHub Actions secrets for CI/CD deploys.

## API

- `GET /api/health` — health check
- `GET /api/logs` — list recent logs
- `POST /api/logs` — create a log entry (`{ "message": "...", "level": "info" }`)
