# Required GitHub Actions secrets

The `Deploy to Cloudflare Pages` workflow (`.github/workflows/deploy.yml`)
deploys IronLog, applies D1 migrations, and pushes the Clerk runtime env
bindings — entirely from these five GitHub repo secrets. No manual
Cloudflare dashboard steps are needed once they are set.

Add them under the repo's **Settings → Secrets and variables → Actions →
Repository secrets → New repository secret**.

| Secret name | What it is | Where to get it |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | CF API token with permissions: **Workers R2 Storage** off, **Account → Workers Scripts: Edit**, **Account → D1: Edit**, **Account → Pages: Edit** (and read on the relevant resources). | Cloudflare dashboard → My Profile → API Tokens → Create Token → "Custom token". IP-restriction: leave it **unrestricted** (or allow GitHub Actions IPs), or CI will fail with error `9109 Cannot use the access token from location`. |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID. | Cloudflare dashboard → any domain/Workers page → right sidebar → "Account ID". |
| `CLERK_SECRET_KEY` | Clerk **secret** key (starts `sk_`). | Clerk dashboard → API Keys → Secret keys. Use the **production** instance key, not the test key. |
| `CLERK_PUBLISHABLE_KEY` | Clerk **publishable** key for production (starts `pk_live_`). | Clerk dashboard → API Keys → Publishable key (production instance). |
| `VITE_CLERK_PUBLISHABLE_KEY` | Same `pk_live_*` publishable key — Vite bakes it into the browser bundle at build time. | Same as above. |

> The live site currently shows "Clerk has been loaded with development keys"
> because the build used the `pk_test_*` dev key. Set
> `VITE_CLERK_PUBLISHABLE_KEY` to the `pk_live_*` value to fix it.

## After adding the secrets

1. Re-run the `Deploy to Cloudflare Pages` workflow (push to `main`, or run it
   manually from the Actions tab). It will:
   - build the frontend with the production Clerk publishable key,
   - apply the D1 migrations to the remote database,
   - push `CLERK_SECRET_KEY` + `CLERK_PUBLISHABLE_KEY` as Pages runtime secrets,
   - deploy the new build.
2. If you previously connected the **native Cloudflare Pages GitHub
   integration** (the "Connect to Git" path in the Pages dashboard), disable
   it so there is a single deploy path (GitHub Actions). Otherwise you will get
   double deployments and the native build will still use the dev Clerk key /
   miss the migrations.

## Verifying

Once green, these endpoints should return `200` (with valid auth), not `500`:

- `GET /api/dashboard`
- `GET /api/training/exercises`
- `GET /api/supplements`
- `GET /api/nutrition/daily`
- `GET /api/training/workout-plans`
- `GET /api/training/personal-records`
- `GET /api/training/workout-sessions`