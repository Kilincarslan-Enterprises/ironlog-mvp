import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:workers";
import { applyMigrations, seedUserAndToken, api, TEST_SECRET } from "./helpers";

/**
 * Auth guard (`functions/api/auth.ts`): every route resolves the DB user from
 * either a Clerk JWT or an agent API token. Tests exercise the agent-token
 * path, which is what external agents use in production.
 */
describe("auth: agent API token", () => {
  let auth: Record<string, string>;

  beforeAll(async () => {
    await applyMigrations(env);
    const seeded = await seedUserAndToken(env);
    auth = seeded.authHeaders;
  });

  it("rejects requests with no credentials (401)", async () => {
    const res = await api(env, "/api/user/me");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("rejects an invalid token (401)", async () => {
    const res = await api(env, "/api/user/me", {
      headers: { "x-api-token": "definitely-not-a-real-secret" },
    });
    expect(res.status).toBe(401);
  });

  it("accepts a valid token via x-api-token header", async () => {
    const res = await api(env, "/api/user/me", { headers: auth });
    expect(res.status).toBe(200);
  });

  it("accepts a valid token via Authorization: Bearer header", async () => {
    const res = await api(env, "/api/user/me", {
      headers: { authorization: `Bearer ${TEST_SECRET}` },
    });
    expect(res.status).toBe(200);
  });

  it("returns the seeded user's profile for an authenticated request", async () => {
    const res = await api(env, "/api/user/me", { headers: auth });
    expect(res.status).toBe(200);
    const { user } = await res.json();
    expect(user.email).toBe(`test-${user.id}@example.com`);
    expect(user.displayName).toBe("Test Athlet");
  });

  it("rejects a revoked token (401)", async () => {
    // Use a unique secret so no other seeded token shares the same hash.
    const secret = `${TEST_SECRET}-revoked-${crypto.randomUUID()}`;
    const seeded = await seedUserAndToken(env, secret);
    await env.DB.prepare("UPDATE agent_api_tokens SET is_revoked = 1 WHERE id = ?")
      .bind(seeded.tokenId)
      .run();

    const res = await api(env, "/api/user/me", {
      headers: { "x-api-token": secret },
    });
    expect(res.status).toBe(401);
  });

  it("rejects an expired token (401)", async () => {
    const secret = `${TEST_SECRET}-expired-${crypto.randomUUID()}`;
    const seeded = await seedUserAndToken(env, secret);
    // expires_at is a timestamp_ms column; set it to 1h in the past.
    const past = Date.now() - 3_600_000;
    await env.DB.prepare("UPDATE agent_api_tokens SET expires_at = ? WHERE id = ?")
      .bind(past, seeded.tokenId)
      .run();

    const res = await api(env, "/api/user/me", {
      headers: { "x-api-token": secret },
    });
    expect(res.status).toBe(401);
  });

  it("protects every API route, not just /user", async () => {
    const res = await api(env, "/api/food/presets");
    expect(res.status).toBe(401);
  });
});