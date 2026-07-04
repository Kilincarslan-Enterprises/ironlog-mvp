import { getAuth } from "@hono/clerk-auth";
import type { Context } from "hono";
import { and, eq } from "drizzle-orm";
import { getDb } from "./db";
import type { Env } from "./env";
import { users, agentApiTokens } from "../../db/schema";

/**
 * Context key under which the resolved DB user row is stored on the Hono
 * context for downstream route handlers.
 */
export const AUTH_USER_KEY = "authUser";

/** Hono environment extended with the resolved authenticated user. */
export type AppEnv = {
  Bindings: Env;
  Variables: { [AUTH_USER_KEY]: any };
};

const DEFAULT_USER_DISPLAY_NAME = "Athlet";
const DEFAULT_TIMEZONE = "Europe/Berlin";

/** SHA-256 hex hash used to look up agent API token secrets. */
export async function hashSecret(secret: string): Promise<string> {
  const data = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Create the default DB user row for a freshly-authenticated Clerk user. */
function defaultNewUser(clerkId: string) {
  return {
    id: crypto.randomUUID(),
    clerkId,
    email: `${clerkId}@placeholder.com`,
    displayName: DEFAULT_USER_DISPLAY_NAME,
    timezone: DEFAULT_TIMEZONE,
    dailyCalorieTarget: 2500,
    dailyProteinTarget: 150,
    dailyCarbsTarget: 250,
    dailyFatTarget: 80,
  };
}

/**
 * Resolve the authenticated DB user from either a Clerk JWT (via
 * `@hono/clerk-auth`) or an agent API token supplied through the
 * `x-api-token` header or `Authorization: Bearer <token>` header.
 *
 * Returns the user row, or null when no valid credentials are present.
 */
export async function resolveUser(env: Env, auth: ReturnType<typeof getAuth>, headers: Headers): Promise<any | null> {
  const db = getDb(env.DB);

  // 1. Clerk JWT
  if (auth?.userId) {
    let user = await db.query.users.findFirst({
      where: eq(users.clerkId, auth.userId),
    });
    if (!user) {
      const [created] = await db.insert(users).values(defaultNewUser(auth.userId)).returning();
      user = created;
    }
    return user ?? null;
  }

  // 2. Agent API token
  const rawToken =
    headers.get("x-api-token") ||
    (headers.get("authorization")?.startsWith("Bearer ")
      ? headers.get("authorization")!.slice("Bearer ".length).trim()
      : null);

  if (!rawToken) return null;

  const hashed = await hashSecret(rawToken);
  const token = await db.query.agentApiTokens.findFirst({
    where: and(
      eq(agentApiTokens.hashedSecret, hashed),
      eq(agentApiTokens.isRevoked, false),
    ),
  });

  if (!token) return null;
  if (token.expiresAt && new Date(token.expiresAt).getTime() < Date.now()) return null;

  // Best-effort update of last-used timestamp; do not block the request on failure.
  try {
    await db
      .update(agentApiTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(agentApiTokens.id, token.id));
  } catch {
    // ignore
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, token.userId),
  });
  return user ?? null;
}

/** Read the resolved authenticated user from the Hono context. */
export function getCtxUser(c: Context): any {
  return c.get(AUTH_USER_KEY as any);
}

