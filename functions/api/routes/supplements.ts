import { Hono } from "hono";
import { and, eq, gte, lte } from "drizzle-orm";
import { getDb } from "../db";
import { supplements, supplementLogs } from "../../../db/schema";
import { AppEnv, getCtxUser } from "../auth";

const supplementsRoute = new Hono<AppEnv>();

/** Resolve [start, end] for "today" (or a given YYYY-MM-DD) in the user's tz. */
function dayRange(dateStr: string | undefined, timezone: string): { start: Date; end: Date } {
  const tz = timezone || "Europe/Berlin";
  const now = new Date();
  let localNow = now;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric", month: "numeric", day: "numeric",
      hour: "numeric", minute: "numeric", second: "numeric",
    });
    localNow = new Date(formatter.format(now));
  } catch {
    // invalid tz → fall back to UTC
  }

  let y = localNow.getFullYear();
  let m = localNow.getMonth();
  let d = localNow.getDate();

  if (dateStr) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (match) {
      y = Number(match[1]);
      m = Number(match[2]) - 1;
      d = Number(match[3]);
    }
  }

  const start = new Date(y, m, d, 0, 0, 0, 0);
  const end = new Date(y, m, d, 23, 59, 59, 999);
  const diff = now.getTime() - localNow.getTime();
  return { start: new Date(start.getTime() + diff), end: new Date(end.getTime() + diff) };
}

/** GET /api/supplements — list the user's supplements (active by default). */
supplementsRoute.get("/", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const includeInactive = c.req.query("all") === "true";
  const list = await db.query.supplements.findMany({
    where: includeInactive
      ? eq(supplements.userId, user.id)
      : and(eq(supplements.userId, user.id), eq(supplements.isActive, true)),
  });
  return c.json({ supplements: list });
});

/** POST /api/supplements — create a supplement. */
supplementsRoute.post("/", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const body = await c.req.json();
  const [created] = await db
    .insert(supplements)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      name: body.name,
      form: body.form || "pill",
      unitDose: body.unitDose ?? null,
      doseUnit: body.doseUnit || null,
      dailyFrequency: Number(body.dailyFrequency || 1),
      reminderTimes: body.reminderTimes || null,
      isActive: body.isActive !== false,
    })
    .returning();
  return c.json({ supplement: created });
});

/** PATCH /api/supplements/:id — update a supplement. */
supplementsRoute.patch("/:id", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const existing = await db.query.supplements.findFirst({
    where: and(eq(supplements.id, id), eq(supplements.userId, user.id)),
  });
  if (!existing) return c.json({ error: "Not found" }, 404);

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of ["name", "form", "unitDose", "doseUnit", "reminderTimes"]) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (body.dailyFrequency !== undefined) updates.dailyFrequency = Number(body.dailyFrequency);
  if (body.isActive !== undefined) updates.isActive = !!body.isActive;

  const [updated] = await db
    .update(supplements)
    .set(updates)
    .where(and(eq(supplements.id, id), eq(supplements.userId, user.id)))
    .returning();
  return c.json({ supplement: updated });
});

/** DELETE /api/supplements/:id — delete a supplement. */
supplementsRoute.delete("/:id", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");
  await db
    .delete(supplements)
    .where(and(eq(supplements.id, id), eq(supplements.userId, user.id)));
  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// Supplement logs (intake)
// ---------------------------------------------------------------------------

/** GET /api/supplement-logs?date=YYYY-MM-DD — logs for a day (default today). */
supplementsRoute.get("/logs", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const date = c.req.query("date");
  let range: { start: Date; end: Date };
  try {
    range = dayRange(date, user.timezone);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }

  const logs = await db.query.supplementLogs.findMany({
    where: and(
      eq(supplementLogs.userId, user.id),
      gte(supplementLogs.takenAt, range.start),
      lte(supplementLogs.takenAt, range.end),
    ),
  });
  return c.json({ logs });
});

/** POST /api/supplement-logs — log an intake. Body: { supplementId, dose?, takenAt? }. */
supplementsRoute.post("/logs", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const body = await c.req.json();

  // Look up the supplement to inherit dose / doseUnit defaults.
  const supp = await db.query.supplements.findFirst({
    where: and(eq(supplements.id, body.supplementId), eq(supplements.userId, user.id)),
  });
  if (!supp) return c.json({ error: "Supplement not found" }, 404);

  const [created] = await db
    .insert(supplementLogs)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      supplementId: body.supplementId,
      dose: Number(body.dose ?? supp.unitDose ?? 1),
      doseUnit: body.doseUnit || supp.doseUnit || "unit",
      takenAt: new Date(body.takenAt || Date.now()),
      note: body.note || null,
    })
    .returning();
  return c.json({ log: created });
});

/** DELETE /api/supplement-logs/:id — undo an intake log. */
supplementsRoute.delete("/logs/:id", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");
  await db
    .delete(supplementLogs)
    .where(and(eq(supplementLogs.id, id), eq(supplementLogs.userId, user.id)));
  return c.json({ success: true });
});

export default supplementsRoute;