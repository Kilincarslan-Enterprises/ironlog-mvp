import { Hono } from "hono";
import { eq, or, and, gte, lte } from "drizzle-orm";
import { getDb } from "../db";
import { foodPresets, meals, mealItems } from "../../../db/schema";
import { AppEnv, getCtxUser } from "../auth";

const food = new Hono<AppEnv>();

// ---------------------------------------------------------------------------
// Food presets
// ---------------------------------------------------------------------------

// Get user food presets + public presets
food.get("/presets", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);

  const presets = await db.query.foodPresets.findMany({
    where: or(
      eq(foodPresets.userId, user.id),
      eq(foodPresets.isPublic, true)
    )
  });

  return c.json({ presets });
});

// Create new food preset
food.post("/presets", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);

  const body = await c.req.json();
  const [preset] = await db.insert(foodPresets).values({
    id: crypto.randomUUID(),
    userId: user.id,
    name: body.name,
    brand: body.brand || null,
    servingSize: Number(body.servingSize || 100),
    servingUnit: body.servingUnit || "g",
    calories: Number(body.calories || 0),
    protein: Number(body.protein || 0),
    carbs: Number(body.carbs || 0),
    fat: Number(body.fat || 0),
    fiber: Number(body.fiber || 0),
    sodium: Number(body.sodium || 0),
    barcode: body.barcode || null,
    isPublic: !!body.isPublic,
  }).returning();

  return c.json({ preset });
});

// Edit existing food preset (scoped to user — public presets owned by others cannot be edited here)
food.put("/presets/:id", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const existing = await db.query.foodPresets.findFirst({
    where: and(eq(foodPresets.id, id), eq(foodPresets.userId, user.id))
  });
  if (!existing) {
    return c.json({ error: "Not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.name === "string") updates.name = body.name;
  if (body.brand !== undefined) updates.brand = body.brand || null;
  if (body.servingSize !== undefined) updates.servingSize = Number(body.servingSize);
  if (body.servingUnit !== undefined) updates.servingUnit = body.servingUnit;
  if (body.calories !== undefined) updates.calories = Number(body.calories);
  if (body.protein !== undefined) updates.protein = Number(body.protein);
  if (body.carbs !== undefined) updates.carbs = Number(body.carbs);
  if (body.fat !== undefined) updates.fat = Number(body.fat);
  if (body.fiber !== undefined) updates.fiber = Number(body.fiber);
  if (body.sodium !== undefined) updates.sodium = Number(body.sodium);
  if (body.barcode !== undefined) updates.barcode = body.barcode || null;
  if (body.isPublic !== undefined) updates.isPublic = !!body.isPublic;

  const [updated] = await db
    .update(foodPresets)
    .set(updates)
    .where(and(eq(foodPresets.id, id), eq(foodPresets.userId, user.id)))
    .returning();

  return c.json({ preset: updated });
});

// Delete food preset (scoped to user)
food.delete("/presets/:id", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const deleted = await db
    .delete(foodPresets)
    .where(and(eq(foodPresets.id, id), eq(foodPresets.userId, user.id)))
    .returning();

  if (deleted.length === 0) {
    return c.json({ error: "Not found" }, 404);
  }

  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// Barcode lookup (Open Food Facts)
// ---------------------------------------------------------------------------

// Lookup a product by barcode. Returns a cached food_preset if the user already
// has one with this barcode; otherwise fetches from Open Food Facts, creates a
// preset, and returns it. 404 if not found in OFF.
food.get("/barcode/:barcode", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const barcode = c.req.param("barcode");

  // 1. Check cache — does this user already have a preset with this barcode?
  const cached = await db.query.foodPresets.findFirst({
    where: and(eq(foodPresets.barcode, barcode), eq(foodPresets.userId, user.id))
  });
  if (cached) {
    return c.json({ preset: cached, cached: true });
  }

  // 2. Fetch from Open Food Facts
  const offUrl = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`;
  let offRes: Response;
  try {
    offRes = await fetch(offUrl, {
      headers: { "User-Agent": "IronLog/1.0 (https://ironlog-mvp.pages.dev)" }
    });
  } catch {
    return c.json({ error: "Failed to reach Open Food Facts" }, 502);
  }

  if (!offRes.ok) {
    return c.json({ error: "Open Food Facts request failed" }, 502);
  }

  const offData = await offRes.json() as {
    status: number;
    product?: {
      product_name?: string;
      brands?: string;
      nutriments?: Record<string, number | undefined>;
    };
  };

  // 3. OFF returns status !== 1 when the product is not found
  if (offData.status !== 1 || !offData.product) {
    return c.json({ error: "Product not found in Open Food Facts" }, 404);
  }

  const n = offData.product.nutriments || {};

  // 4. Map OFF data → food_preset fields
  const [created] = await db.insert(foodPresets).values({
    id: crypto.randomUUID(),
    userId: user.id,
    name: offData.product.product_name || "Unknown",
    brand: offData.product.brands || null,
    servingSize: 100,
    servingUnit: "g",
    calories: Number(n["energy-kcal_100g"] || 0),
    protein: Number(n["proteins_100g"] || 0),
    carbs: Number(n["carbohydrates_100g"] || 0),
    fat: Number(n["fat_100g"] || 0),
    fiber: Number(n["fiber_100g"] || 0),
    sodium: Number(n["sodium_100g"] || 0),
    barcode: barcode,
    isPublic: false,
  }).returning();

  // 5. Return the newly created preset
  return c.json({ preset: created, cached: false, source: "openfoodfacts" });
});

// ---------------------------------------------------------------------------
// Meals
// ---------------------------------------------------------------------------

// Resolve the [start, end] range for "today" (no date) or a given YYYY-MM-DD,
// interpreted in the user's timezone.
function dayRange(dateStr: string | undefined, timezone: string): { start: Date; end: Date } {
  const tz = timezone || "Europe/Berlin";
  const now = new Date();

  let localNow = now;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    localNow = new Date(formatter.format(now));
  } catch {
    // invalid tz → fall back to UTC
  }

  let y = localNow.getFullYear();
  let m = localNow.getMonth();
  let d = localNow.getDate();

  if (dateStr) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (match) {
      y = Number(match[1]);
      m = Number(match[2]) - 1;
      d = Number(match[3]);
    } else {
      throw new Error("Invalid date format; expected YYYY-MM-DD");
    }
  }

  const start = new Date(y, m, d, 0, 0, 0, 0);
  const end = new Date(y, m, d, 23, 59, 59, 999);
  const diff = now.getTime() - localNow.getTime();
  return {
    start: new Date(start.getTime() + diff),
    end: new Date(end.getTime() + diff),
  };
}

// Get meals logged for a given day (defaults to today). Supports ?date=YYYY-MM-DD.
food.get("/meals", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);

  const date = c.req.query("date");
  let range: { start: Date; end: Date };
  try {
    range = dayRange(date, user.timezone);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }

  const loggedMeals = await db.query.meals.findMany({
    where: and(
      eq(meals.userId, user.id),
      gte(meals.loggedAt, range.start),
      lte(meals.loggedAt, range.end)
    ),
    with: {
      items: true
    }
  });

  return c.json({ meals: loggedMeals });
});

// Log a meal (with food items)
food.post("/meals", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);

  const body = await c.req.json(); // { name: string, loggedAt: number, items: Array<{ name, quantity, calories, protein, carbs, fat, foodPresetId? }> }

  const mealId = crypto.randomUUID();
  await db.insert(meals).values({
    id: mealId,
    userId: user.id,
    name: body.name || "Mahlzeit",
    loggedAt: new Date(body.loggedAt || Date.now()),
    note: body.note || null,
  });

  const itemsToInsert = (body.items || []).map((item: any) => ({
    id: crypto.randomUUID(),
    mealId: mealId,
    foodPresetId: item.foodPresetId || null,
    name: item.name,
    quantity: Number(item.quantity || 1),
    quantityUnit: item.quantityUnit || "g",
    calories: Number(item.calories || 0),
    protein: Number(item.protein || 0),
    carbs: Number(item.carbs || 0),
    fat: Number(item.fat || 0),
    fiber: Number(item.fiber || 0),
    sodium: Number(item.sodium || 0),
  }));

  if (itemsToInsert.length > 0) {
    await db.insert(mealItems).values(itemsToInsert);
  }

  const completeMeal = await db.query.meals.findFirst({
    where: eq(meals.id, mealId),
    with: {
      items: true
    }
  });

  return c.json({ meal: completeMeal });
});

// Update a meal (name, note, loggedAt). Scoped to owner.
food.patch("/meals/:id", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const existing = await db.query.meals.findFirst({
    where: and(eq(meals.id, id), eq(meals.userId, user.id)),
  });
  if (!existing) return c.json({ error: "Not found" }, 404);

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.name === "string") updates.name = body.name;
  if (body.note !== undefined) updates.note = body.note || null;
  if (body.loggedAt !== undefined) updates.loggedAt = new Date(body.loggedAt as string | number);

  const [updated] = await db
    .update(meals)
    .set(updates)
    .where(and(eq(meals.id, id), eq(meals.userId, user.id)))
    .returning();

  const completeMeal = await db.query.meals.findFirst({
    where: eq(meals.id, id),
    with: { items: true },
  });

  return c.json({ meal: completeMeal });
});

// Remove a single item from a meal (scoped to user via meal ownership)
food.delete("/meals/:id/items/:itemId", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");
  const itemId = c.req.param("itemId");

  // Ensure the meal belongs to the user before deleting its item.
  const meal = await db.query.meals.findFirst({
    where: and(eq(meals.id, id), eq(meals.userId, user.id))
  });
  if (!meal) {
    return c.json({ error: "Not found" }, 404);
  }

  const deleted = await db
    .delete(mealItems)
    .where(and(eq(mealItems.id, itemId), eq(mealItems.mealId, id)))
    .returning();

  if (deleted.length === 0) {
    return c.json({ error: "Not found" }, 404);
  }

  return c.json({ success: true });
});

// Delete a meal log
food.delete("/meals/:id", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  await db.delete(meals).where(
    and(
      eq(meals.id, id),
      eq(meals.userId, user.id)
    )
  );

  return c.json({ success: true });
});

export default food;