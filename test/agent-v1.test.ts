import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:workers";
import { applyMigrations, seedUserAndToken, api, type SeededUser } from "./helpers";

/**
 * Agent REST API surface — /api/agent/v1/... (KILA-124).
 *
 * Verifies the dedicated agent surface: the v1 index, the suggestions endpoint
 * (writes a `suggestion` notification visible to the user), and that the
 * re-mounted resource modules give an agent token full read+write parity with
 * the UI — e.g. creating a goal through /agent/v1/goals is visible through the
 * UI route /api/goals and vice-versa (same backing tables, same user scope).
 */
let s: SeededUser;

function auth(extra: Record<string, string> = {}) {
  return { headers: { ...s.authHeaders, "content-type": "application/json", ...extra } };
}

describe("agent v1 surface", () => {
  beforeAll(async () => {
    await applyMigrations(env);
    s = await seedUserAndToken(env);
  });

  it("exposes a v1 index describing resources", async () => {
    const res = await api(env, "/api/agent/v1/", { headers: s.authHeaders });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("IronLog Agent API");
    expect(body.version).toBe("v1");
    expect(body.resources).toBeTruthy();
    expect(body.resources.suggestions).toBeTruthy();
    expect(body.resources.goals).toBeTruthy();
  });

  it("rejects unauthenticated requests to the v1 surface", async () => {
    const res = await api(env, "/api/agent/v1/");
    expect(res.status).toBe(401);
  });

  it("creates a suggestion visible to the user as a notification", async () => {
    const res = await api(env, "/api/agent/v1/suggestions", {
      method: "POST",
      ...auth(),
      body: JSON.stringify({
        title: "Mehr Eiweiß zum Frühstück",
        body: "Dein Frühstück hatte heute nur 12 g Protein — wie wäre es mit Quark?",
        actionUrl: "/dashboard",
        data: { source: "coach", category: "nutrition" },
      }),
    });
    expect(res.status).toBe(200);
    const { suggestion } = await res.json();
    expect(suggestion.kind).toBe("suggestion");
    expect(suggestion.title).toBe("Mehr Eiweiß zum Frühstück");
    expect(suggestion.userId).toBe(s.userId);
    expect(suggestion.actionUrl).toBe("/dashboard");
  });

  it("requires title and body for a suggestion", async () => {
    const res = await api(env, "/api/agent/v1/suggestions", {
      method: "POST",
      ...auth(),
      body: JSON.stringify({ title: "only a title" }),
    });
    expect(res.status).toBe(400);
  });

  it("surfaces suggestions through the user notifications route", async () => {
    const res = await api(env, "/api/notifications", { headers: s.authHeaders });
    expect(res.status).toBe(200);
    const { notifications: list } = await res.json();
    const suggestions = list.filter((n: any) => n.kind === "suggestion");
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
  });

  it("gives the agent write parity: a goal created via /agent/v1 is visible via /api/goals", async () => {
    const create = await api(env, "/api/agent/v1/goals", {
      method: "POST",
      ...auth(),
      body: JSON.stringify({
        title: "Agenten-Ziel",
        category: "weight",
        direction: "down",
        targetValue: 78,
        targetUnit: "kg",
        status: "active",
      }),
    });
    expect(create.status).toBe(200);
    const { goal } = await create.json();
    expect(goal.userId).toBe(s.userId);

    // Same row is readable through the UI surface.
    const ui = await api(env, "/api/goals?status=active", { headers: s.authHeaders });
    const ids = (await ui.json()).goals.map((g: any) => g.id);
    expect(ids).toContain(goal.id);
  });

  it("gives the agent read parity: dashboard is reachable on the v1 surface", async () => {
    const res = await api(env, "/api/agent/v1/dashboard", { headers: s.authHeaders });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeTruthy();
  });
});