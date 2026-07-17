import { Hono } from "hono";
import { and, eq, desc } from "drizzle-orm";
import { getDb } from "../db";
import { exercises, machineLogs } from "../../../db/schema";
import { AppEnv, getCtxUser } from "../auth";

const machinesRoute = new Hono<AppEnv>();

// ---------------------------------------------------------------------------
// Machine CRUD — backed by exercises WHERE type='machine' (backward compatible).
// The old `machines` table is kept for machine_logs FK integrity; machine IDs
// were copied into exercises with the same IDs during migration 0002.
// ---------------------------------------------------------------------------

/** GET /api/machines — list the user's machine-type exercises. Optional ?muscleGroup=chest filter. */
machinesRoute.get("/", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const muscleGroup = c.req.query("muscleGroup");

  const list = await db.query.exercises.findMany({
    where: muscleGroup
      ? and(
          eq(exercises.userId, user.id),
          eq(exercises.type, "machine"),
          eq(exercises.muscleGroup, muscleGroup),
        )
      : and(eq(exercises.userId, user.id), eq(exercises.type, "machine")),
  });
  return c.json({ machines: list });
});

/** POST /api/machines — create a machine (stored as an exercise with type='machine'). */
machinesRoute.post("/", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const body = await c.req.json();

  const [created] = await db
    .insert(exercises)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      name: body.name,
      category: "strength",
      muscleGroup: body.muscleGroup || null,
      equipment: null,
      instructions: null,
      isPublic: false,
      type: "machine",
      imageUrl: body.imageUrl || null,
      notes: body.notes || null,
    })
    .returning();
  return c.json({ machine: created });
});

/** PUT /api/machines/:id — update a machine (exercise with type='machine', scoped to owner). */
machinesRoute.put("/:id", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const existing = await db.query.exercises.findFirst({
    where: and(
      eq(exercises.id, id),
      eq(exercises.userId, user.id),
      eq(exercises.type, "machine"),
    ),
  });
  if (!existing) return c.json({ error: "Not found" }, 404);

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.name === "string") updates.name = body.name;
  if (body.muscleGroup !== undefined) updates.muscleGroup = body.muscleGroup || null;
  if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl || null;
  if (body.notes !== undefined) updates.notes = body.notes || null;

  const [updated] = await db
    .update(exercises)
    .set(updates)
    .where(
      and(
        eq(exercises.id, id),
        eq(exercises.userId, user.id),
        eq(exercises.type, "machine"),
      ),
    )
    .returning();

  return c.json({ machine: updated });
});

/** DELETE /api/machines/:id — delete a machine (exercise with type='machine'). */
machinesRoute.delete("/:id", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const deleted = await db
    .delete(exercises)
    .where(
      and(
        eq(exercises.id, id),
        eq(exercises.userId, user.id),
        eq(exercises.type, "machine"),
      ),
    )
    .returning();

  if (deleted.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// Machine logs — keep referencing the old machines table for FK integrity.
// Since migrated machines share the same ID in exercises, machineId === exerciseId.
// ---------------------------------------------------------------------------

/** GET /api/machines/:id/logs — machine log history for one machine. */
machinesRoute.get("/:id/logs", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const machineId = c.req.param("id");
  const limit = Number(c.req.query("limit") || 30);

  // Validate the machine (exercise with type='machine') belongs to user.
  const machine = await db.query.exercises.findFirst({
    where: and(
      eq(exercises.id, machineId),
      eq(exercises.userId, user.id),
      eq(exercises.type, "machine"),
    ),
  });
  if (!machine) return c.json({ error: "Not found" }, 404);

  const logs = await db.query.machineLogs.findMany({
    where: and(eq(machineLogs.machineId, machineId), eq(machineLogs.userId, user.id)),
    orderBy: desc(machineLogs.loggedAt),
    limit,
  });

  return c.json({ logs });
});

/** POST /api/machines/:id/logs — log a weight entry for a machine. */
machinesRoute.post("/:id/logs", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const machineId = c.req.param("id");
  const body = await c.req.json();

  // Validate the machine (exercise with type='machine') belongs to user.
  const machine = await db.query.exercises.findFirst({
    where: and(
      eq(exercises.id, machineId),
      eq(exercises.userId, user.id),
      eq(exercises.type, "machine"),
    ),
  });
  if (!machine) return c.json({ error: "Not found" }, 404);

  const [created] = await db
    .insert(machineLogs)
    .values({
      id: crypto.randomUUID(),
      machineId,
      userId: user.id,
      weight: Number(body.weight),
      weightUnit: body.weightUnit || "kg",
      reps: body.reps ?? null,
      sets: body.sets ?? 1,
      loggedAt: new Date(body.loggedAt || Date.now()),
      note: body.note || null,
    })
    .returning();

  return c.json({ log: created });
});

/** DELETE /api/machines/:id/logs/:logId — delete a log entry. */
machinesRoute.delete("/:id/logs/:logId", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const machineId = c.req.param("id");
  const logId = c.req.param("logId");

  // Validate the machine (exercise with type='machine') belongs to user.
  const machine = await db.query.exercises.findFirst({
    where: and(
      eq(exercises.id, machineId),
      eq(exercises.userId, user.id),
      eq(exercises.type, "machine"),
    ),
  });
  if (!machine) return c.json({ error: "Not found" }, 404);

  await db
    .delete(machineLogs)
    .where(
      and(
        eq(machineLogs.id, logId),
        eq(machineLogs.machineId, machineId),
        eq(machineLogs.userId, user.id),
      ),
    );

  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// Progress summary
// ---------------------------------------------------------------------------

/** GET /api/machines/:id/progress — progression summary for a machine. */
machinesRoute.get("/:id/progress", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const machineId = c.req.param("id");

  // Validate the machine (exercise with type='machine') belongs to user.
  const machine = await db.query.exercises.findFirst({
    where: and(
      eq(exercises.id, machineId),
      eq(exercises.userId, user.id),
      eq(exercises.type, "machine"),
    ),
  });
  if (!machine) return c.json({ error: "Not found" }, 404);

  // Get all logs for this machine, ordered oldest → newest.
  const allLogs = await db.query.machineLogs.findMany({
    where: and(eq(machineLogs.machineId, machineId), eq(machineLogs.userId, user.id)),
    orderBy: machineLogs.loggedAt,
  });

  if (allLogs.length === 0) {
    return c.json({
      machine,
      firstLog: null,
      latestLog: null,
      delta: 0,
      maxWeight: null,
      recentLogs: [],
    });
  }

  const firstLog = allLogs[0];
  const latestLog = allLogs[allLogs.length - 1];
  const delta = Number(latestLog.weight) - Number(firstLog.weight);

  // All-time max weight.
  let maxWeight = allLogs[0];
  for (const log of allLogs) {
    if (Number(log.weight) > Number(maxWeight.weight)) maxWeight = log;
  }

  // Last 10 logs for charting (newest first).
  const recentLogs = [...allLogs].reverse().slice(0, 10);

  return c.json({
    machine,
    firstLog,
    latestLog,
    delta,
    maxWeight,
    recentLogs,
  });
});

export default machinesRoute;