import { Hono } from "hono";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { AppEnv, AUTH_USER_KEY, resolveUser } from "./auth";

// Route imports
import dashboard from "./routes/dashboard";
import food from "./routes/food";
import training from "./routes/training";
import supplements from "./routes/supplements";
import weight from "./routes/weight";
import goals from "./routes/goals";
import user from "./routes/user";
import nutrition from "./routes/nutrition";
import notifications from "./routes/notifications";
import agent from "./routes/agent";
import agentV1 from "./routes/agent-v1";
import { indexHandler as agentV1Index } from "./routes/agent-v1";

/**
 * The shared IronLog API Hono application.
 *
 * Extracted from `[[route]].ts` so it can be exercised directly by the backend
 * test suite (vitest + @cloudflare/vitest-pool-workers) via `app.request(...)`,
 * without having to import the Pages-Functions catch-all entry with bracketed
 * filenames or pull in `hono/cloudflare-pages`'s `handle()` wrapper.
 *
 * The Pages entry (`[[route]].ts`) imports this `app` and wraps it with
 * `handle()` for production; tests import it directly.
 */
export const app = new Hono<AppEnv>().basePath('/api');

// Middleware for Clerk Auth (JWT). Reads CLERK_SECRET_KEY / CLERK_PUBLISHABLE_KEY
// from the Cloudflare env bindings. Agent API token auth is resolved as a
// fallback in the auth guard below, so requests may use either method.
app.use("*", clerkMiddleware());

// Auth Guard Middleware — Clerk JWT or agent API token.
// Resolves the DB user once and stores it on the context for downstream routes.
app.use("*", async (c, next) => {
  const auth = getAuth(c);
  const user = await resolveUser(c.env, auth, c.req.raw.headers);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set(AUTH_USER_KEY, user);
  await next();
});

// Health check (still requires auth, like every other route)
app.get("/health", (c) => c.json({ status: "ok" }));

// Register routes
app.route("/dashboard", dashboard);
app.route("/food", food);
app.route("/training", training);
app.route("/supplements", supplements);
app.route("/weight", weight);
app.route("/goals", goals);
app.route("/user", user);
app.route("/nutrition", nutrition);
app.route("/notifications", notifications);
app.route("/agent", agent);

// ---------------------------------------------------------------------------
// Agent REST API surface — /api/agent/v1/...
//
// Dedicated surface for external agents (KILA-124). The resource modules are
// the SAME Hono routers the UI uses, re-mounted under /agent/v1 — the global
// auth guard already resolves an agent API token to the owning user, so an
// agent authenticated with its token gets full read+write parity with the UI,
// scoped to that user. agentV1 adds the v1 index + suggestions endpoint.
// The proposal/confirmation flow (Step 3) is pending a D1 migration.
// ---------------------------------------------------------------------------
app.route("/agent/v1", agentV1);
// Trailing-slash form of the v1 index (Hono serves the bare prefix without
// the slash via the mount above; this covers `/api/agent/v1/` explicitly).
app.get("/agent/v1/", agentV1Index);
app.route("/agent/v1/dashboard", dashboard);
app.route("/agent/v1/food", food);
app.route("/agent/v1/training", training);
app.route("/agent/v1/supplements", supplements);
app.route("/agent/v1/weight", weight);
app.route("/agent/v1/goals", goals);
app.route("/agent/v1/user", user);
app.route("/agent/v1/nutrition", nutrition);
app.route("/agent/v1/notifications", notifications);