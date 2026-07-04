import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
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

const app = new Hono<AppEnv>().basePath('/api');

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

export const onRequest = handle(app);