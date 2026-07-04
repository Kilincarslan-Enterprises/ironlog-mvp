import { Hono } from "hono";
import { and, eq, gte, desc } from "drizzle-orm";
import { getDb } from "../db";
import { weightEntries } from "../../../db/schema";
import { AppEnv, getCtxUser } from "../auth";

const weight = new Hono<AppEnv>();

/** Resolve the earliest Date for a range keyword (7d/30d/90d). null = all time. */
function rangeStart(range: string | undefined): Date | null {
  if (!range || range === "all") return null;
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** GET /api/weight?range=7d|30d|90d|all — list weight entries (newest first). */
weight.get("/", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const range = c.req.query("range") || "30d";
  const start = rangeStart(range);

  const entries = await db.query.weightEntries.findMany({
    where: start
      ? and(eq(weightEntries.userId, user.id), gte(weightEntries.measuredAt, start))
      : eq(weightEntries.userId, user.id),
    orderBy: desc(weightEntries.measuredAt),
  });
  return c.json({ entries });
});

/** POST /api/weight — create a weight entry. Body: { weight, unit?, measuredAt?, bodyFatPercentage?, note? }. */
weight.post("/", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const body = await c.req.json();
  const [created] = await db
    .insert(weightEntries)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      weight: Number(body.weight),
      unit: body.unit || "kg",
      measuredAt: new Date(body.measuredAt || Date.now()),
      bodyFatPercentage: body.bodyFatPercentage ?? null,
      note: body.note || null,
      source: body.source || "manual",
    })
    .returning();
  return c.json({ entry: created });
});

/** PATCH /api/weight/:id — update a weight entry. */
weight.patch("/:id", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const existing = await db.query.weightEntries.findFirst({
    where: and(eq(weightEntries.id, id), eq(weightEntries.userId, user.id)),
  });
  if (!existing) return c.json({ error: "Not found" }, 404);

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of ["weight", "unit", "measuredAt", "bodyFatPercentage", "note"]) {
    if (body[key] !== undefined) {
      updates[key] = key === "measuredAt" ? new Date(body[key] as string) : body[key];
    }
  }

  const [updated] = await db
    .update(weightEntries)
    .set(updates)
    .where(and(eq(weightEntries.id, id), eq(weightEntries.userId, user.id)))
    .returning();
  return c.json({ entry: updated });
});

/** DELETE /api/weight/:id — delete a weight entry. */
weight.delete("/:id", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");
  await db
    .delete(weightEntries)
    .where(and(eq(weightEntries.id, id), eq(weightEntries.userId, user.id)));
  return c.json({ success: true });
});

export default weight;