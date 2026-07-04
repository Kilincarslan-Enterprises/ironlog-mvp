import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { agentApiTokens } from "../../../db/schema";
import { AppEnv, getCtxUser, hashSecret } from "../auth";

const agent = new Hono<AppEnv>();

/**
 * Generate a fresh 32-byte URL-safe base64 secret for an agent API token.
 * Only the SHA-256 hash is persisted; the raw secret is returned to the
 * caller exactly once (on creation) and never retrievable afterwards.
 */
function generateSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Strip the hashedSecret column from a token row before returning it. */
function publicToken(row: any) {
  const { hashedSecret: _hashedSecret, ...rest } = row;
  return rest;
}

/** POST /api/agent/tokens — create a new agent API token.
 * Body: { label, scopes?, expiresAt? }.
 * Returns the raw secret once; subsequent reads never expose it. */
agent.post("/tokens", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;

  if (!body.label || typeof body.label !== "string") {
    return c.json({ error: "label is required" }, 400);
  }

  const secret = generateSecret();
  const hashedSecret = await hashSecret(secret);

  const expiresAt =
    body.expiresAt !== undefined && body.expiresAt !== null
      ? new Date(body.expiresAt as string)
      : null;

  const [created] = await db
    .insert(agentApiTokens)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      label: body.label,
      hashedSecret,
      scopes: (body.scopes as string) || "read",
      expiresAt,
    })
    .returning();

  // The raw secret is returned exactly once here; only the hash is persisted.
  return c.json({ token: publicToken(created), secret });
});

/** GET /api/agent/tokens — list the user's agent tokens (hashedSecret excluded). */
agent.get("/tokens", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const includeRevoked = c.req.query("all") === "true";

  const list = await db.query.agentApiTokens.findMany({
    where: includeRevoked
      ? eq(agentApiTokens.userId, user.id)
      : and(eq(agentApiTokens.userId, user.id), eq(agentApiTokens.isRevoked, false)),
  });

  return c.json({ tokens: list.map(publicToken) });
});

/** DELETE /api/agent/tokens/:id — revoke a token (sets isRevoked = true). */
agent.delete("/tokens/:id", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const existing = await db.query.agentApiTokens.findFirst({
    where: and(eq(agentApiTokens.id, id), eq(agentApiTokens.userId, user.id)),
  });
  if (!existing) return c.json({ error: "Not found" }, 404);

  const [updated] = await db
    .update(agentApiTokens)
    .set({ isRevoked: true, updatedAt: new Date() })
    .where(and(eq(agentApiTokens.id, id), eq(agentApiTokens.userId, user.id)))
    .returning();

  return c.json({ token: publicToken(updated) });
});

export default agent;