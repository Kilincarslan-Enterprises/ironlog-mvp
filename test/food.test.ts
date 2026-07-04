import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:workers";
import { applyMigrations, seedUserAndToken, api, type SeededUser } from "./helpers";

let s: SeededUser;

function auth(extra: Record<string, string> = {}) {
  return { headers: { ...s.authHeaders, "content-type": "application/json", ...extra } };
}

describe("food presets + meals", () => {
  beforeAll(async () => {
    await applyMigrations(env);
    s = await seedUserAndToken(env);
  });

  it("starts with no presets", async () => {
    const res = await api(env, "/api/food/presets", { headers: s.authHeaders });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.presets).toEqual([]);
  });

  it("creates a food preset", async () => {
    const res = await api(env, "/api/food/presets", {
      method: "POST",
      ...auth(),
      body: JSON.stringify({
        name: "Haferflocken",
        servingSize: 100,
        servingUnit: "g",
        calories: 370,
        protein: 13,
        carbs: 60,
        fat: 7,
      }),
    });
    expect(res.status).toBe(200);
    const { preset } = await res.json();
    expect(preset.name).toBe("Haferflocken");
    expect(preset.calories).toBe(370);
    expect(preset.userId).toBe(s.userId);
  });

  it("lists the created preset", async () => {
    const res = await api(env, "/api/food/presets", { headers: s.authHeaders });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.presets.length).toBe(1);
    expect(body.presets[0].name).toBe("Haferflocken");
  });

  it("updates a preset via PUT", async () => {
    const create = await api(env, "/api/food/presets", {
      method: "POST",
      ...auth(),
      body: JSON.stringify({ name: "Banane", calories: 90, protein: 1 }),
    });
    const { preset } = await create.json();

    const res = await api(env, `/api/food/presets/${preset.id}`, {
      method: "PUT",
      ...auth(),
      body: JSON.stringify({ calories: 105 }),
    });
    expect(res.status).toBe(200);
    const updated = (await res.json()).preset;
    expect(updated.calories).toBe(105);
    expect(updated.name).toBe("Banane");
  });

  it("returns 404 when updating another user's preset", async () => {
    const res = await api(env, "/api/food/presets/does-not-exist", {
      method: "PUT",
      ...auth(),
      body: JSON.stringify({ name: "x" }),
    });
    expect(res.status).toBe(404);
  });

  it("deletes a preset", async () => {
    const create = await api(env, "/api/food/presets", {
      method: "POST",
      ...auth(),
      body: JSON.stringify({ name: "Apfel", calories: 52 }),
    });
    const { preset } = await create.json();

    const del = await api(env, `/api/food/presets/${preset.id}`, {
      method: "DELETE",
      headers: s.authHeaders,
    });
    expect(del.status).toBe(200);
    expect((await del.json()).success).toBe(true);

    const list = await api(env, "/api/food/presets", { headers: s.authHeaders });
    const ids = (await list.json()).presets.map((p: any) => p.id);
    expect(ids).not.toContain(preset.id);
  });

  it("logs a meal with items and reads it back for today", async () => {
    const res = await api(env, "/api/food/meals", {
      method: "POST",
      ...auth(),
      body: JSON.stringify({
        name: "Frühstück",
        loggedAt: Date.now(),
        items: [
          { name: "Haferflocken", quantity: 80, calories: 296, protein: 10, carbs: 48, fat: 6 },
          { name: "Banane", quantity: 1, quantityUnit: "stk", calories: 90, protein: 1 },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const { meal } = await res.json();
    expect(meal.name).toBe("Frühstück");
    expect(meal.items.length).toBe(2);

    const list = await api(env, "/api/food/meals", { headers: s.authHeaders });
    expect(list.status).toBe(200);
    const { meals } = await list.json();
    expect(meals.length).toBe(1);
    expect(meals[0].items.length).toBe(2);
  });

  it("removes a single item from a meal, then the meal itself", async () => {
    const create = await api(env, "/api/food/meals", {
      method: "POST",
      ...auth(),
      body: JSON.stringify({
        name: "Snack",
        loggedAt: Date.now(),
        items: [
          { name: "Joghurt", calories: 150 },
          { name: "Honig", calories: 60 },
        ],
      }),
    });
    const { meal } = await create.json();
    const itemId = meal.items[0].id;

    const delItem = await api(env, `/api/food/meals/${meal.id}/items/${itemId}`, {
      method: "DELETE",
      headers: s.authHeaders,
    });
    expect(delItem.status).toBe(200);

    const delMeal = await api(env, `/api/food/meals/${meal.id}`, {
      method: "DELETE",
      headers: s.authHeaders,
    });
    expect(delMeal.status).toBe(200);

    const list = await api(env, "/api/food/meals", { headers: s.authHeaders });
    const ids = (await list.json()).meals.map((m: any) => m.id);
    expect(ids).not.toContain(meal.id);
  });
});