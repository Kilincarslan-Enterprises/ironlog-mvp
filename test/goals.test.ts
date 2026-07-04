import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:workers";
import { applyMigrations, seedUserAndToken, api, type SeededUser } from "./helpers";

let s: SeededUser;

function auth(extra: Record<string, string> = {}) {
  return { headers: { ...s.authHeaders, "content-type": "application/json", ...extra } };
}

describe("goals + progress entries", () => {
  let goalId: string;

  beforeAll(async () => {
    await applyMigrations(env);
    s = await seedUserAndToken(env);
  });

  it("creates a goal", async () => {
    const res = await api(env, "/api/goals", {
      method: "POST",
      ...auth(),
      body: JSON.stringify({
        title: "80 kg bis Sommer",
        category: "weight",
        direction: "down",
        targetValue: 80,
        targetUnit: "kg",
        deadline: "2026-09-30",
        status: "active",
      }),
    });
    expect(res.status).toBe(200);
    const { goal } = await res.json();
    expect(goal.title).toBe("80 kg bis Sommer");
    expect(goal.status).toBe("active");
    expect(goal.userId).toBe(s.userId);
    goalId = goal.id;
  });

  it("lists goals and filters by status", async () => {
    // add a paused goal
    await api(env, "/api/goals", {
      method: "POST",
      ...auth(),
      body: JSON.stringify({ title: "Nebenziel", category: "custom", status: "paused" }),
    });

    const all = await api(env, "/api/goals", { headers: s.authHeaders });
    expect((await all.json()).goals.length).toBe(2);

    const active = await api(env, "/api/goals?status=active", { headers: s.authHeaders });
    const activeGoals = (await active.json()).goals;
    expect(activeGoals.length).toBe(1);
    expect(activeGoals[0].id).toBe(goalId);
  });

  it("patches a goal", async () => {
    const res = await api(env, `/api/goals/${goalId}`, {
      method: "PATCH",
      ...auth(),
      body: JSON.stringify({ targetValue: 79 }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).goal.targetValue).toBe(79);
  });

  it("returns 404 when patching another user's goal", async () => {
    const res = await api(env, "/api/goals/foreign", {
      method: "PATCH",
      ...auth(),
      body: JSON.stringify({ title: "x" }),
    });
    expect(res.status).toBe(404);
  });

  it("changes status via /:id/status", async () => {
    const res = await api(env, `/api/goals/${goalId}/status`, {
      method: "POST",
      ...auth(),
      body: JSON.stringify({ status: "paused" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).goal.status).toBe("paused");
  });

  it("adds and lists progress entries", async () => {
    const add = await api(env, `/api/goals/${goalId}/progress`, {
      method: "POST",
      ...auth(),
      body: JSON.stringify({ value: 82.1, unit: "kg", recordedAt: Date.now() }),
    });
    expect(add.status).toBe(200);
    expect((await add.json()).progress.value).toBe(82.1);

    const list = await api(env, `/api/goals/${goalId}/progress`, { headers: s.authHeaders });
    expect(list.status).toBe(200);
    expect((await list.json()).progress.length).toBe(1);
  });

  it("deletes a goal", async () => {
    const del = await api(env, `/api/goals/${goalId}`, {
      method: "DELETE",
      headers: s.authHeaders,
    });
    expect(del.status).toBe(200);

    const active = await api(env, "/api/goals?status=active", { headers: s.authHeaders });
    const ids = (await active.json()).goals.map((g: any) => g.id);
    expect(ids).not.toContain(goalId);
  });
});