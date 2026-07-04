import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:workers";
import { applyMigrations, seedUserAndToken, api, type SeededUser } from "./helpers";

let s: SeededUser;

function auth(extra: Record<string, string> = {}) {
  return { headers: { ...s.authHeaders, "content-type": "application/json", ...extra } };
}

describe("weight entries", () => {
  beforeAll(async () => {
    await applyMigrations(env);
    s = await seedUserAndToken(env);
  });

  it("creates a weight entry", async () => {
    const res = await api(env, "/api/weight", {
      method: "POST",
      ...auth(),
      body: JSON.stringify({ weight: 82.4, unit: "kg", measuredAt: Date.now(), note: "morning" }),
    });
    expect(res.status).toBe(200);
    const { entry } = await res.json();
    expect(entry.weight).toBe(82.4);
    expect(entry.unit).toBe("kg");
    expect(entry.userId).toBe(s.userId);
  });

  it("lists entries (newest first)", async () => {
    // add a second, earlier entry
    await api(env, "/api/weight", {
      method: "POST",
      ...auth(),
      body: JSON.stringify({ weight: 83.1, measuredAt: Date.now() - 86_400_000 }),
    });

    const res = await api(env, "/api/weight?range=all", { headers: s.authHeaders });
    expect(res.status).toBe(200);
    const { entries } = await res.json();
    expect(entries.length).toBe(2);
    // newest first: 82.4 was logged after 83.1
    expect(entries[0].weight).toBe(82.4);
  });

  it("patches an entry", async () => {
    const list = await api(env, "/api/weight?range=all", { headers: s.authHeaders });
    const id = (await list.json()).entries[0].id;

    const res = await api(env, `/api/weight/${id}`, {
      method: "PATCH",
      ...auth(),
      body: JSON.stringify({ weight: 82.0, note: "updated" }),
    });
    expect(res.status).toBe(200);
    const { entry } = await res.json();
    expect(entry.weight).toBe(82.0);
    expect(entry.note).toBe("updated");
  });

  it("returns 404 when patching another user's entry", async () => {
    const res = await api(env, "/api/weight/nope", {
      method: "PATCH",
      ...auth(),
      body: JSON.stringify({ weight: 80 }),
    });
    expect(res.status).toBe(404);
  });

  it("deletes an entry", async () => {
    const list = await api(env, "/api/weight?range=all", { headers: s.authHeaders });
    const id = (await list.json()).entries[0].id;

    const del = await api(env, `/api/weight/${id}`, {
      method: "DELETE",
      headers: s.authHeaders,
    });
    expect(del.status).toBe(200);
    expect((await del.json()).success).toBe(true);

    const after = await api(env, "/api/weight?range=all", { headers: s.authHeaders });
    const ids = (await after.json()).entries.map((e: any) => e.id);
    expect(ids).not.toContain(id);
  });
});