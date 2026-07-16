import { Hono } from "hono";
import { and, eq, desc, ne, gte, lte, inArray } from "drizzle-orm";
import { getDb } from "../db";
import {
  exercises,
  workoutPlans,
  workoutPlanExercises,
  workoutSessions,
  workoutSessionSets,
} from "../../../db/schema";
import { AppEnv, getCtxUser } from "../auth";

const training = new Hono<AppEnv>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the [start, end] range for "today" (no date) or a given YYYY-MM-DD,
 * interpreted in the user's timezone. Returns epoch-ms Dates that match the
 * `timestamp_ms` columns used by the schema.
 */
function dayRange(dateStr: string | undefined, timezone: string): { start: Date; end: Date } {
  const tz = timezone || "Europe/Berlin";
  const now = new Date();

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
    } else {
      throw new Error("Invalid date format; expected YYYY-MM-DD");
    }
  }

  const start = new Date(y, m, d, 0, 0, 0, 0);
  const end = new Date(y, m, d, 23, 59, 59, 999);
  const diff = now.getTime() - localNow.getTime();
  return {
    start: new Date(start.getTime() + diff),
    end: new Date(end.getTime() + diff),
  };
}

/** Next 1-based set number for an exercise within a session. */
async function nextSetNumber(
  db: ReturnType<typeof getDb>,
  sessionId: string,
  exerciseId: string,
): Promise<number> {
  const rows = await db.query.workoutSessionSets.findMany({
    where: and(
      eq(workoutSessionSets.sessionId, sessionId),
      eq(workoutSessionSets.exerciseId, exerciseId),
    ),
  });
  return rows.length + 1;
}

// ---------------------------------------------------------------------------
// Exercises
// ---------------------------------------------------------------------------

/** GET /api/training/exercises — the user's own exercises plus public ones from others. */
training.get("/exercises", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const own = await db.query.exercises.findMany({
    where: eq(exercises.userId, user.id),
  });
  const publicList = await db.query.exercises.findMany({
    where: and(eq(exercises.isPublic, true), ne(exercises.userId, user.id)),
  });
  return c.json({ exercises: [...own, ...publicList] });
});

/** POST /api/training/exercises — create a new exercise. */
training.post("/exercises", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const body = await c.req.json();
  const [created] = await db
    .insert(exercises)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      name: body.name,
      category: body.category || "strength",
      muscleGroup: body.muscleGroup || null,
      equipment: body.equipment || null,
      instructions: body.instructions || null,
      isPublic: !!body.isPublic,
    })
    .returning();
  return c.json({ exercise: created });
});

/** PUT /api/training/exercises/:id — edit an exercise (scoped to owner). */
training.put("/exercises/:id", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const existing = await db.query.exercises.findFirst({
    where: and(eq(exercises.id, id), eq(exercises.userId, user.id)),
  });
  if (!existing) return c.json({ error: "Not found" }, 404);

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.name === "string") updates.name = body.name;
  if (body.category !== undefined) updates.category = body.category;
  if (body.muscleGroup !== undefined) updates.muscleGroup = body.muscleGroup || null;
  if (body.equipment !== undefined) updates.equipment = body.equipment || null;
  if (body.instructions !== undefined) updates.instructions = body.instructions || null;
  if (body.isPublic !== undefined) updates.isPublic = !!body.isPublic;

  const [updated] = await db
    .update(exercises)
    .set(updates)
    .where(and(eq(exercises.id, id), eq(exercises.userId, user.id)))
    .returning();

  return c.json({ exercise: updated });
});

/** DELETE /api/training/exercises/:id — delete an exercise (scoped to owner). */
training.delete("/exercises/:id", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const deleted = await db
    .delete(exercises)
    .where(and(eq(exercises.id, id), eq(exercises.userId, user.id)))
    .returning();

  if (deleted.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ success: true });
});

/**
 * GET /api/training/exercises/:id/history — sets logged for an exercise over
 * time (weight progression). Ordered oldest → newest so the UI can chart kg
 * progression.
 */
training.get("/exercises/:id/history", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const exerciseId = c.req.param("id");

  const sessions = await db.query.workoutSessions.findMany({
    where: eq(workoutSessions.userId, user.id),
    with: { sets: true },
    orderBy: desc(workoutSessions.startedAt),
  });

  const history: any[] = [];
  for (const s of sessions) {
    for (const set of s.sets) {
      if (set.exerciseId === exerciseId) {
        history.push({
          ...set,
          sessionId: s.id,
          sessionStartedAt: s.startedAt,
          sessionName: s.name,
        });
      }
    }
  }
  return c.json({ history });
});

/**
 * GET /api/training/exercises/:id/prs — personal records for one exercise:
 * max weight, max reps, and max volume (weight × reps), each with the session
 * and date where it was achieved.
 */
training.get("/exercises/:id/prs", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const exerciseId = c.req.param("id");

  const sessions = await db.query.workoutSessions.findMany({
    where: eq(workoutSessions.userId, user.id),
    with: { sets: true },
  });

  type Rec = { value: number; reps: number; weight: number; sessionId: string; date: Date | string };
  let best: {
    maxWeight: Rec | null;
    maxReps: Rec | null;
    maxVolume: Rec | null;
  } = { maxWeight: null, maxReps: null, maxVolume: null };

  for (const s of sessions) {
    for (const set of s.sets) {
      if (set.exerciseId !== exerciseId) continue;
      const w = Number(set.weight) || 0;
      const reps = Number(set.reps) || 0;
      const volume = w * reps;
      const ctx: Rec = { value: 0, reps, weight: w, sessionId: s.id, date: s.startedAt };

      if (!best.maxWeight || w > best.maxWeight.value) {
        best = { ...best, maxWeight: { ...ctx, value: w } };
      }
      if (!best.maxReps || reps > best.maxReps.value) {
        best = { ...best, maxReps: { ...ctx, value: reps } };
      }
      if (!best.maxVolume || volume > best.maxVolume.value) {
        best = { ...best, maxVolume: { ...ctx, value: volume } };
      }
    }
  }

  const exercise = await db.query.exercises.findFirst({
    where: and(eq(exercises.id, exerciseId), eq(exercises.userId, user.id)),
  });

  return c.json({
    exerciseId,
    exercise: exercise || null,
    maxWeight: best.maxWeight,
    maxReps: best.maxReps,
    maxVolume: best.maxVolume,
  });
});

// ---------------------------------------------------------------------------
// Workout plans
// ---------------------------------------------------------------------------

/** GET /api/training/workout-plans — list the user's plans with their exercises. */
training.get("/workout-plans", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const plans = await db.query.workoutPlans.findMany({
    where: eq(workoutPlans.userId, user.id),
    with: { exercises: true },
  });
  return c.json({ plans });
});

/** POST /api/training/workout-plans — create a plan with optional exercise entries. */
training.post("/workout-plans", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const body = await c.req.json();

  const planId = crypto.randomUUID();
  await db
    .insert(workoutPlans)
    .values({
      id: planId,
      userId: user.id,
      name: body.name,
      schedule: body.schedule || null,
      // first plan for the user is active by default; otherwise inactive until activated
      isActive: !!body.isActive,
    });

  const entries = Array.isArray(body.exercises) ? body.exercises : [];
  if (entries.length > 0) {
    // Validate all exerciseIds exist and belong to the user before inserting.
    const exerciseIds = [...new Set(entries.map((e: any) => e.exerciseId))];
    const validExercises = await db.query.exercises.findMany({
      where: and(eq(exercises.userId, user.id), inArray(exercises.id, exerciseIds)),
    });
    const validIds = new Set(validExercises.map((e) => e.id));
    const invalid = exerciseIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      await db.delete(workoutPlans).where(eq(workoutPlans.id, planId));
      return c.json({ error: `Exercise not found: ${invalid.join(", ")}` }, 400);
    }

    await db.insert(workoutPlanExercises).values(
      entries.map((e: any, i: number) => ({
        id: crypto.randomUUID(),
        planId,
        exerciseId: e.exerciseId,
        dayLabel: e.dayLabel || "A",
        orderIndex: e.orderIndex ?? i,
        sets: e.sets ?? null,
        reps: e.reps ?? null,
        restSeconds: e.restSeconds ?? null,
        rpe: e.rpe ?? null,
      })),
    );
  }

  const complete = await db.query.workoutPlans.findFirst({
    where: eq(workoutPlans.id, planId),
    with: { exercises: true },
  });
  return c.json({ plan: complete });
});

/**
 * PUT /api/training/workout-plans/:id — edit a plan's name/schedule and replace
 * its exercise assignments (scoped to owner).
 */
training.put("/workout-plans/:id", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const existing = await db.query.workoutPlans.findFirst({
    where: and(eq(workoutPlans.id, id), eq(workoutPlans.userId, user.id)),
  });
  if (!existing) return c.json({ error: "Not found" }, 404);

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.name === "string") updates.name = body.name;
  if (body.schedule !== undefined) updates.schedule = body.schedule || null;

  await db
    .update(workoutPlans)
    .set(updates)
    .where(and(eq(workoutPlans.id, id), eq(workoutPlans.userId, user.id)));

  // Replace exercise assignments when provided.
  if (Array.isArray(body.exercises)) {
    await db.delete(workoutPlanExercises).where(eq(workoutPlanExercises.planId, id));
    if (body.exercises.length > 0) {
      // Validate all exerciseIds before inserting.
      const exerciseIds = [...new Set(body.exercises.map((e: any) => e.exerciseId))];
      const validExercises = await db.query.exercises.findMany({
        where: and(eq(exercises.userId, user.id), inArray(exercises.id, exerciseIds)),
      });
      const validIds = new Set(validExercises.map((e) => e.id));
      const invalid = exerciseIds.filter((id) => !validIds.has(id));
      if (invalid.length > 0) {
        return c.json({ error: `Exercise not found: ${invalid.join(", ")}` }, 400);
      }

      await db.insert(workoutPlanExercises).values(
        body.exercises.map((e: any, i: number) => ({
          id: crypto.randomUUID(),
          planId: id,
          exerciseId: e.exerciseId,
          dayLabel: e.dayLabel || "A",
          orderIndex: e.orderIndex ?? i,
          sets: e.sets ?? null,
          reps: e.reps ?? null,
          restSeconds: e.restSeconds ?? null,
          rpe: e.rpe ?? null,
        })),
      );
    }
  }

  const complete = await db.query.workoutPlans.findFirst({
    where: eq(workoutPlans.id, id),
    with: { exercises: true },
  });
  return c.json({ plan: complete });
});

/** DELETE /api/training/workout-plans/:id — delete a plan (scoped to owner). */
training.delete("/workout-plans/:id", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const deleted = await db
    .delete(workoutPlans)
    .where(and(eq(workoutPlans.id, id), eq(workoutPlans.userId, user.id)))
    .returning();

  if (deleted.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ success: true });
});

/**
 * POST /api/training/workout-plans/:id/activate — set a plan as active and
 * deactivate all of the user's other plans (exclusive activation).
 */
training.post("/workout-plans/:id/activate", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const existing = await db.query.workoutPlans.findFirst({
    where: and(eq(workoutPlans.id, id), eq(workoutPlans.userId, user.id)),
  });
  if (!existing) return c.json({ error: "Not found" }, 404);

  // Deactivate all the user's plans, then activate the chosen one.
  await db
    .update(workoutPlans)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(workoutPlans.userId, user.id));
  const [updated] = await db
    .update(workoutPlans)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(workoutPlans.id, id))
    .returning();

  return c.json({ plan: updated });
});

// ---------------------------------------------------------------------------
// Workout sessions
// ---------------------------------------------------------------------------

/**
 * GET /api/training/workout-sessions?date=YYYY-MM-DD — sessions for a given
 * day (defaults to today in the user's timezone), with their sets.
 */
training.get("/workout-sessions", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const date = c.req.query("date");

  let range: { start: Date; end: Date };
  try {
    range = dayRange(date, user.timezone);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }

  const sessions = await db.query.workoutSessions.findMany({
    where: and(
      eq(workoutSessions.userId, user.id),
      gte(workoutSessions.startedAt, range.start),
      lte(workoutSessions.startedAt, range.end),
    ),
    with: { sets: true },
    orderBy: desc(workoutSessions.startedAt),
  });
  return c.json({ sessions });
});

/** POST /api/training/workout-sessions — start a new workout session. */
training.post("/workout-sessions", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const body = await c.req.json().catch(() => ({}));

  const [session] = await db
    .insert(workoutSessions)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      planId: body.planId || null,
      name: body.name || "Workout",
      startedAt: new Date(body.startedAt || Date.now()),
    })
    .returning();

  return c.json({ session });
});

/**
 * PATCH /api/training/workout-sessions/:id — finish/update a session.
 * Accepts endedAt, durationSeconds, notes. When endedAt is omitted it defaults
 * to now; durationSeconds is computed from startedAt when omitted.
 */
training.patch("/workout-sessions/:id", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const existing = await db.query.workoutSessions.findFirst({
    where: and(eq(workoutSessions.id, id), eq(workoutSessions.userId, user.id)),
  });
  if (!existing) return c.json({ error: "Not found" }, 404);

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  const endedAt =
    body.endedAt !== undefined ? new Date(body.endedAt as string | number) : new Date();
  updates.endedAt = endedAt;
  if (body.durationSeconds !== undefined) {
    updates.durationSeconds = Number(body.durationSeconds);
  } else {
    updates.durationSeconds = Math.round(
      (endedAt.getTime() - new Date(existing.startedAt).getTime()) / 1000,
    );
  }
  if (body.notes !== undefined) updates.notes = body.notes || null;
  if (typeof body.name === "string") updates.name = body.name;

  const [updated] = await db
    .update(workoutSessions)
    .set(updates)
    .where(and(eq(workoutSessions.id, id), eq(workoutSessions.userId, user.id)))
    .returning();

  return c.json({ session: updated });
});

/** DELETE /api/training/workout-sessions/:id — delete a session (scoped to owner). */
training.delete("/workout-sessions/:id", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const deleted = await db
    .delete(workoutSessions)
    .where(and(eq(workoutSessions.id, id), eq(workoutSessions.userId, user.id)))
    .returning();

  if (deleted.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// Sets within a session
// ---------------------------------------------------------------------------

/** POST /api/training/workout-sessions/:id/sets — add a set to a session. */
training.post("/workout-sessions/:id/sets", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const sessionId = c.req.param("id");

  const session = await db.query.workoutSessions.findFirst({
    where: and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, user.id)),
  });
  if (!session) return c.json({ error: "Not found" }, 404);

  const body = await c.req.json();
  const setNumber =
    body.setNumber !== undefined
      ? Number(body.setNumber)
      : await nextSetNumber(db, sessionId, body.exerciseId);

  const [created] = await db
    .insert(workoutSessionSets)
    .values({
      id: crypto.randomUUID(),
      sessionId,
      exerciseId: body.exerciseId,
      setNumber,
      reps: body.reps ?? null,
      weight: body.weight ?? null,
      weightUnit: body.weightUnit || "kg",
      durationSeconds: body.durationSeconds ?? null,
      distance: body.distance ?? null,
      distanceUnit: body.distanceUnit || "m",
      rpe: body.rpe ?? null,
      isWarmup: !!body.isWarmup,
      isDropset: !!body.isDropset,
    })
    .returning();

  return c.json({ set: created });
});

/** PATCH /api/training/workout-sessions/:id/sets/:setId — update a set. */
training.patch("/workout-sessions/:id/sets/:setId", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const sessionId = c.req.param("id");
  const setId = c.req.param("setId");

  const session = await db.query.workoutSessions.findFirst({
    where: and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, user.id)),
  });
  if (!session) return c.json({ error: "Not found" }, 404);

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of [
    "setNumber", "reps", "weight", "weightUnit", "durationSeconds", "distance",
    "distanceUnit", "rpe", "isWarmup", "isDropset",
  ]) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  const [updated] = await db
    .update(workoutSessionSets)
    .set(updates)
    .where(and(eq(workoutSessionSets.id, setId), eq(workoutSessionSets.sessionId, sessionId)))
    .returning();

  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json({ set: updated });
});

/** DELETE /api/training/workout-sessions/:id/sets/:setId — delete a set. */
training.delete("/workout-sessions/:id/sets/:setId", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const sessionId = c.req.param("id");
  const setId = c.req.param("setId");

  const session = await db.query.workoutSessions.findFirst({
    where: and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, user.id)),
  });
  if (!session) return c.json({ error: "Not found" }, 404);

  await db
    .delete(workoutSessionSets)
    .where(and(eq(workoutSessionSets.id, setId), eq(workoutSessionSets.sessionId, sessionId)));

  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// Aggregate personal records (kept for the dashboard; per-exercise PRs live at
// /exercises/:id/prs)
// ---------------------------------------------------------------------------

/** GET /api/training/personal-records — best (max weight) per exercise. */
training.get("/personal-records", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);

  const sessions = await db.query.workoutSessions.findMany({
    where: eq(workoutSessions.userId, user.id),
    with: { sets: true },
  });

  const bestToExercise = new Map<
    string,
    { weight: number; reps: number; sessionId: string; date: Date | string }
  >();
  for (const s of sessions) {
    for (const set of s.sets) {
      const w = Number(set.weight) || 0;
      const current = bestToExercise.get(set.exerciseId);
      if (!current || w > current.weight) {
        bestToExercise.set(set.exerciseId, {
          weight: w,
          reps: Number(set.reps) || 0,
          sessionId: s.id,
          date: s.startedAt,
        });
      }
    }
  }

  const allExercises = await db.query.exercises.findMany({
    where: eq(exercises.userId, user.id),
  });
  const exMap = new Map(allExercises.map((e) => [e.id, e]));

  const records = [...bestToExercise.entries()].map(([exerciseId, rec]) => ({
    exercise: exMap.get(exerciseId) || { id: exerciseId, name: "Unknown" },
    ...rec,
  }));

  return c.json({ records });
});

export default training;