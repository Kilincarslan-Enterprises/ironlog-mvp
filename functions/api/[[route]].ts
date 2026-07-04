import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import type { Env } from "./env";

// Route imports
import dashboard from "./routes/dashboard";
import food from "./routes/food";
import training from "./routes/training";
import supplements from "./routes/supplements";
import weight from "./routes/weight";
import goals from "./routes/goals";

const app = new Hono<{ Bindings: Env }>().basePath('/api');

// Middleware for Clerk Auth
app.use("*", clerkMiddleware({
  publishableKey: (c) => c.env.CLERK_PUBLISHABLE_KEY,
  secretKey: (c) => c.env.CLERK_SECRET_KEY,
}));

// Auth Guard Middleware
app.use("*", async (c, next) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Register routes
app.route("/dashboard", dashboard);
app.route("/food", food);
app.route("/training", training);
app.route("/supplements", supplements);
app.route("/weight", weight);
app.route("/goals", goals);

export const onRequest = handle(app);
