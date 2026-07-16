import { Hono } from "hono";
import { and, eq, isNull, desc } from "drizzle-orm";
import { getDb } from "../db";
import { notifications } from "../../../db/schema";
import { AppEnv, getCtxUser } from "../auth";

const notificationsRoute = new Hono<AppEnv>();

/** GET /api/notifications?unreadOnly=true — list notifications (newest first). */
notificationsRoute.get("/", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const unreadOnly = c.req.query("unreadOnly") === "true";

  const list = await db.query.notifications.findMany({
    where: unreadOnly
      ? and(eq(notifications.userId, user.id), isNull(notifications.readAt))
      : eq(notifications.userId, user.id),
    orderBy: desc(notifications.createdAt),
  });
  return c.json({ notifications: list });
});

/** POST /api/notifications — create a notification. */
notificationsRoute.post("/", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const body = await c.req.json();
  const [created] = await db
    .insert(notifications)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      kind: body.kind || "system",
      title: body.title,
      body: body.body,
      data: body.data || null,
      actionUrl: body.actionUrl || null,
    })
    .returning();
  return c.json({ notification: created });
});

/** POST /api/notifications/:id/read — mark a notification as read. */
notificationsRoute.post("/:id/read", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const existing = await db.query.notifications.findFirst({
    where: and(eq(notifications.id, id), eq(notifications.userId, user.id)),
  });
  if (!existing) return c.json({ error: "Not found" }, 404);

  const [updated] = await db
    .update(notifications)
    .set({ readAt: new Date(), updatedAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
    .returning();
  return c.json({ notification: updated });
});

/** DELETE /api/notifications/:id — delete a notification (scoped to owner). */
notificationsRoute.delete("/:id", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const deleted = await db
    .delete(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
    .returning();

  if (deleted.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ success: true });
});

export default notificationsRoute;