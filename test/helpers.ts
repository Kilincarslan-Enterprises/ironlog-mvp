import migrationSql from "../migrations/0000_acoustic_mindworm.sql?raw";
import { hashSecret } from "../functions/api/auth";
import type { Env } from "../functions/api/env";
import { app } from "../functions/api/app";

export { app };

/**
 * The raw plaintext secret used for the seeded agent API token. Tests send it
 * in the `x-api-token` header; the auth guard hashes it (SHA-256) and looks up
 * the matching `agent_api_tokens` row — the same path real agents use.
 */
export const TEST_SECRET = "test-agent-secret-abcdef0123456789";

/** Apply the Drizzle migration SQL to the test D1 database. */
export async function applyMigrations(env: Env): Promise<void> {
  // Drizzle migrations separate statements with `--> statement-breakpoint`
  // (a `--` line comment) and end each statement with `;`. D1's `exec()` does
  // not reliably split multi-statement scripts here, so strip comment lines and
  // run each statement individually via `prepare().run()`.
  const cleaned = (migrationSql as string)
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

  const statements = cleaned
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await env.DB.prepare(stmt).run();
  }
}

export interface SeededUser {
  userId: string;
  tokenId: string;
  /** Headers carrying the agent API token, ready to spread into a request. */
  authHeaders: Record<string, string>;
}

/**
 * Seed a test user + a non-revoked agent API token directly into D1, bypassing
 * the Clerk-authenticated token CRUD endpoints. Returns the user/token ids and
 * a ready-to-use `x-api-token` header.
 *
 * `secret` defaults to `TEST_SECRET`; pass a unique value when you need to
 * isolate a token (e.g. revoke/expire tests) so no other seeded token shares the
 * same hashed secret and matches the auth lookup instead.
 */
export async function seedUserAndToken(
  env: Env,
  secret: string = TEST_SECRET
): Promise<SeededUser> {
  const userId = crypto.randomUUID();
  const email = `test-${userId}@example.com`;

  await env.DB.prepare(
    "INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)"
  )
    .bind(userId, email, "Test Athlet")
    .run();

  const hashedSecret = await hashSecret(secret);
  const tokenId = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO agent_api_tokens (id, user_id, label, hashed_secret) VALUES (?, ?, ?, ?)"
  )
    .bind(tokenId, userId, "test-token", hashedSecret)
    .run();

  return { userId, tokenId, authHeaders: { "x-api-token": secret } };
}

/** Issue a request against the API app as the seeded agent. */
export async function api(
  env: Env,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  return app.request(path, init, env);
}