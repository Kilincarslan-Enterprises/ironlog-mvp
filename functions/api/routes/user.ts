import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { users } from "../../../db/schema";
import { AppEnv, getCtxUser } from "../auth";

const user = new Hono<AppEnv>();

/**
 * GET /api/user/me — return the current user's profile + settings from D1.
 * The DB user is resolved upstream in the auth guard (Clerk JWT or agent token)
 * and stored on the context.
 */
user.get("/me", async (c) => {
  const ctxUser = getCtxUser(c);
  // Re-read to reflect the freshest row.
  const db = getDb(c.env.DB);
  const fresh = await db.query.users.findFirst({ where: eq(users.id, ctxUser.id) });
  return c.json({ user: fresh ?? ctxUser });
});

/**
 * PATCH /api/user/me — update profile fields:
 * displayName, timezone, unitSystem, dailyCalorieTarget, dailyProteinTarget,
 * dailyCarbsTarget, dailyFatTarget.
 */
user.patch("/me", async (c) => {
  const ctxUser = getCtxUser(c);
  const db = getDb(c.env.DB);

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (typeof body.displayName === "string" && body.displayName.trim().length > 0) {
    updates.displayName = body.displayName.trim();
  }
  if (typeof body.timezone === "string") {
    updates.timezone = body.timezone;
  }
  if (body.unitSystem === "metric" || body.unitSystem === "imperial") {
    updates.unitSystem = body.unitSystem;
  }
  for (const key of [
    "dailyCalorieTarget",
    "dailyProteinTarget",
    "dailyCarbsTarget",
    "dailyFatTarget",
  ] as const) {
    const v = body[key];
    if (v === null || typeof v === "number" && Number.isFinite(v)) {
      updates[key] = v === null ? null : Math.round(v);
    }
  }

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, ctxUser.id))
    .returning();

  return c.json({ user: updated });
});

export default user;