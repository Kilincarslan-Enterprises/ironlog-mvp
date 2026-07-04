import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { goals, goalProgressEntries } from "../../../db/schema";
import { AppEnv, getCtxUser } from "../auth";

const goalsRoute = new Hono<AppEnv>();

/** GET /api/goals?status=active — list the user's goals, optionally filtered by status. */
goalsRoute.get("/", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const status = c.req.query("status");
  const list = await db.query.goals.findMany({
    where: status
      ? and(eq(goals.userId, user.id), eq(goals.status, status as any))
      : eq(goals.userId, user.id),
  });
  return c.json({ goals: list });
});

/** POST /api/goals — create a goal. */
goalsRoute.post("/", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const body = await c.req.json();
  const [created] = await db
    .insert(goals)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      title: body.title,
      category: body.category || "custom",
      direction: body.direction || null,
      targetValue: body.targetValue ?? null,
      targetUnit: body.targetUnit || null,
      deadline: body.deadline ? new Date(body.deadline) : null,
      status: body.status || "active",
    })
    .returning();
  return c.json({ goal: created });
});

/** PATCH /api/goals/:id — update a goal's fields. */
goalsRoute.patch("/:id", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const existing = await db.query.goals.findFirst({
    where: and(eq(goals.id, id), eq(goals.userId, user.id)),
  });
  if (!existing) return c.json({ error: "Not found" }, 404);

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of ["title", "category", "direction", "targetValue", "targetUnit"]) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (body.deadline !== undefined) {
    updates.deadline = body.deadline ? new Date(body.deadline as string) : null;
  }
  if (body.status !== undefined) updates.status = body.status;

  const [updated] = await db
    .update(goals)
    .set(updates)
    .where(and(eq(goals.id, id), eq(goals.userId, user.id)))
    .returning();
  return c.json({ goal: updated });
});

/** POST /api/goals/:id/status — change a goal's status (active/paused/achieved/abandoned). */
goalsRoute.post("/:id/status", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const existing = await db.query.goals.findFirst({
    where: and(eq(goals.id, id), eq(goals.userId, user.id)),
  });
  if (!existing) return c.json({ error: "Not found" }, 404);

  const body = await c.req.json();
  const [updated] = await db
    .update(goals)
    .set({ status: body.status, updatedAt: new Date() })
    .where(and(eq(goals.id, id), eq(goals.userId, user.id)))
    .returning();
  return c.json({ goal: updated });
});

/** DELETE /api/goals/:id — delete a goal. */
goalsRoute.delete("/:id", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");
  await db
    .delete(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, user.id)));
  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// Goal progress entries
// ---------------------------------------------------------------------------

/** GET /api/goals/:id/progress — list progress entries for a goal. */
goalsRoute.get("/:id/progress", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const goal = await db.query.goals.findFirst({
    where: and(eq(goals.id, id), eq(goals.userId, user.id)),
  });
  if (!goal) return c.json({ error: "Not found" }, 404);

  const entries = await db.query.goalProgressEntries.findMany({
    where: eq(goalProgressEntries.goalId, id),
  });
  return c.json({ progress: entries });
});

/** POST /api/goals/:id/progress — add a progress entry. Body: { value, unit?, recordedAt?, note? }. */
goalsRoute.post("/:id/progress", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const goal = await db.query.goals.findFirst({
    where: and(eq(goals.id, id), eq(goals.userId, user.id)),
  });
  if (!goal) return c.json({ error: "Not found" }, 404);

  const body = await c.req.json();
  const [created] = await db
    .insert(goalProgressEntries)
    .values({
      id: crypto.randomUUID(),
      goalId: id,
      recordedAt: new Date(body.recordedAt || Date.now()),
      value: Number(body.value),
      unit: body.unit || goal.targetUnit || null,
      note: body.note || null,
    })
    .returning();
  return c.json({ progress: created });
});

export default goalsRoute;