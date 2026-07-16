import { Hono } from "hono";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { scheduleTemplates, workoutPlans } from "../../../db/schema";
import { AppEnv, getCtxUser } from "../auth";

const schedule = new Hono<AppEnv>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get the current day-of-week (0=Sunday..6=Saturday) in the user's timezone. */
function currentDayOfWeek(timezone: string): number {
  const tz = timezone || "Europe/Berlin";
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
    });
    const weekday = formatter.format(new Date());
    const map: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    return map[weekday] ?? new Date().getDay();
  } catch {
    return new Date().getDay();
  }
}

/** Format a Date as YYYY-MM-DD in the user's timezone. */
function formatDate(date: Date, timezone: string): string {
  const tz = timezone || "Europe/Berlin";
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(date);
    const y = parts.find((p) => p.type === "year")?.value ?? "";
    const m = parts.find((p) => p.type === "month")?.value ?? "";
    const d = parts.find((p) => p.type === "day")?.value ?? "";
    return `${y}-${m}-${d}`;
  } catch {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}

/** Get the dates of the current week (7 entries, Sunday-Saturday) in the user's timezone. */
function currentWeekDates(timezone: string): { date: string; dayOfWeek: number }[] {
  const tz = timezone || "Europe/Berlin";
  const todayDow = currentDayOfWeek(tz);
  const now = new Date();
  // Get the local "now" in the user's timezone
  let localNow = now;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    localNow = new Date(formatter.format(now));
  } catch {
    // fall back to UTC
  }

  const days: { date: string; dayOfWeek: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const dow = i; // 0=Sunday..6=Saturday
    const offset = dow - todayDow;
    const d = new Date(localNow);
    d.setDate(d.getDate() + offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    days.push({ date: `${y}-${m}-${day}`, dayOfWeek: dow });
  }
  return days;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** GET /api/schedule — returns the user's weekly template (7 entries, one per dayOfWeek). */
schedule.get("/", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);

  const templates = await db.query.scheduleTemplates.findMany({
    where: and(
      eq(scheduleTemplates.userId, user.id),
      isNull(scheduleTemplates.overrideDate),
    ),
    orderBy: scheduleTemplates.dayOfWeek,
  });

  return c.json({ schedule: templates });
});

/** PUT /api/schedule — replaces the entire weekly template. */
schedule.put("/", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const body = await c.req.json();

  if (!Array.isArray(body)) {
    return c.json({ error: "Body must be an array of { dayOfWeek, planId?, label }" }, 400);
  }

  // Delete old template entries (non-override rows only).
  await db
    .delete(scheduleTemplates)
    .where(
      and(
        eq(scheduleTemplates.userId, user.id),
        isNull(scheduleTemplates.overrideDate),
      ),
    );

  // Insert new entries.
  if (body.length > 0) {
    await db.insert(scheduleTemplates).values(
      body.map((entry: any) => ({
        id: crypto.randomUUID(),
        userId: user.id,
        dayOfWeek: Number(entry.dayOfWeek),
        planId: entry.planId || null,
        label: entry.label,
        overrideDate: null,
        overrideLabel: null,
        overridePlanId: null,
      })),
    );
  }

  const templates = await db.query.scheduleTemplates.findMany({
    where: and(
      eq(scheduleTemplates.userId, user.id),
      isNull(scheduleTemplates.overrideDate),
    ),
    orderBy: scheduleTemplates.dayOfWeek,
  });

  return c.json({ schedule: templates });
});

/** GET /api/schedule/today — returns what's scheduled for today. */
schedule.get("/today", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);

  const todayDow = currentDayOfWeek(user.timezone);
  const todayDate = formatDate(new Date(), user.timezone);

  // Check for an override for today's date first.
  const override = await db.query.scheduleTemplates.findFirst({
    where: and(
      eq(scheduleTemplates.userId, user.id),
      eq(scheduleTemplates.overrideDate, todayDate),
    ),
  });

  if (override) {
    let plan = null;
    if (override.overridePlanId) {
      plan = await db.query.workoutPlans.findFirst({
        where: and(eq(workoutPlans.id, override.overridePlanId), eq(workoutPlans.userId, user.id)),
      });
    }
    return c.json({
      dayOfWeek: todayDow,
      label: override.overrideLabel || override.label,
      planId: override.overridePlanId || override.planId,
      plan,
      isOverride: true,
      overrideDate: override.overrideDate,
    });
  }

  // Fall back to the template entry for today's dayOfWeek.
  const template = await db.query.scheduleTemplates.findFirst({
    where: and(
      eq(scheduleTemplates.userId, user.id),
      eq(scheduleTemplates.dayOfWeek, todayDow),
      isNull(scheduleTemplates.overrideDate),
    ),
  });

  if (!template) {
    return c.json({
      dayOfWeek: todayDow,
      label: null,
      planId: null,
      plan: null,
      isOverride: false,
    });
  }

  let plan = null;
  if (template.planId) {
    plan = await db.query.workoutPlans.findFirst({
      where: and(eq(workoutPlans.id, template.planId), eq(workoutPlans.userId, user.id)),
    });
  }

  return c.json({
    dayOfWeek: todayDow,
    label: template.label,
    planId: template.planId,
    plan,
    isOverride: false,
  });
});

/** GET /api/schedule/week — returns 7 entries for the current week with overrides applied. */
schedule.get("/week", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);

  const weekDays = currentWeekDates(user.timezone);
  const weekDates = weekDays.map((d) => d.date);

  // Get all template entries (non-override).
  const templates = await db.query.scheduleTemplates.findMany({
    where: and(
      eq(scheduleTemplates.userId, user.id),
      isNull(scheduleTemplates.overrideDate),
    ),
  });
  const templateByDow = new Map(templates.map((t) => [t.dayOfWeek, t]));

  // Get all overrides for this week's dates.
  const overrides = await db.query.scheduleTemplates.findMany({
    where: and(
      eq(scheduleTemplates.userId, user.id),
      inArray(scheduleTemplates.overrideDate, weekDates),
    ),
  });
  const overrideByDate = new Map(overrides.map((o) => [o.overrideDate, o]));

  // Preload any plans referenced by templates or overrides.
  const allPlanIds = new Set<string>();
  for (const t of templates) if (t.planId) allPlanIds.add(t.planId);
  for (const o of overrides) if (o.overridePlanId) allPlanIds.add(o.overridePlanId);
  const plans = allPlanIds.size > 0
    ? await db.query.workoutPlans.findMany({
        where: and(eq(workoutPlans.userId, user.id), inArray(workoutPlans.id, [...allPlanIds])),
      })
    : [];
  const planMap = new Map(plans.map((p) => [p.id, p]));

  const days = weekDays.map(({ date, dayOfWeek }) => {
    const override = overrideByDate.get(date);
    if (override) {
      const planId = override.overridePlanId || override.planId;
      return {
        date,
        dayOfWeek,
        label: override.overrideLabel || override.label,
        planId,
        plan: planId ? planMap.get(planId) || null : null,
        isOverride: true,
      };
    }
    const template = templateByDow.get(dayOfWeek);
    if (!template) {
      return {
        date,
        dayOfWeek,
        label: null,
        planId: null,
        plan: null,
        isOverride: false,
      };
    }
    return {
      date,
      dayOfWeek,
      label: template.label,
      planId: template.planId,
      plan: template.planId ? planMap.get(template.planId) || null : null,
      isOverride: false,
    };
  });

  return c.json({ days });
});

/** POST /api/schedule/override — creates or updates an override for a specific date. */
schedule.post("/override", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const body = await c.req.json();

  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return c.json({ error: "date (YYYY-MM-DD) is required" }, 400);
  }
  if (!body.label) {
    return c.json({ error: "label is required" }, 400);
  }

  // Check if an override already exists for this date.
  const existing = await db.query.scheduleTemplates.findFirst({
    where: and(
      eq(scheduleTemplates.userId, user.id),
      eq(scheduleTemplates.overrideDate, body.date),
    ),
  });

  if (existing) {
    // Update the existing override.
    const [updated] = await db
      .update(scheduleTemplates)
      .set({
        overrideLabel: body.label,
        overridePlanId: body.planId || null,
        updatedAt: new Date(),
      })
      .where(and(eq(scheduleTemplates.id, existing.id), eq(scheduleTemplates.userId, user.id)))
      .returning();
    return c.json({ override: updated });
  }

  // Create a new override entry.
  const [created] = await db
    .insert(scheduleTemplates)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      dayOfWeek: new Date(body.date).getDay(),
      planId: null,
      label: "Override",
      overrideDate: body.date,
      overrideLabel: body.label,
      overridePlanId: body.planId || null,
    })
    .returning();

  return c.json({ override: created });
});

/** DELETE /api/schedule/override/:date — removes an override for a specific date. */
schedule.delete("/override/:date", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const date = c.req.param("date");

  const deleted = await db
    .delete(scheduleTemplates)
    .where(
      and(
        eq(scheduleTemplates.userId, user.id),
        eq(scheduleTemplates.overrideDate, date),
      ),
    )
    .returning();

  if (deleted.length === 0) return c.json({ error: "Override not found" }, 404);
  return c.json({ success: true });
});

export default schedule;