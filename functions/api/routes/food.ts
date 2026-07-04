import { Hono } from "hono";
import type { Env } from "../env";
import { getAuth } from "@hono/clerk-auth";
import { getDb } from "../db";
import { eq, or, and, gte, lte } from "drizzle-orm";
import { users, foodPresets, meals, mealItems } from "../../../db/schema";

const food = new Hono<{ Bindings: Env }>();

// Helper to get or create DB user from Clerk auth
async function getDbUser(db: any, clerkId: string) {
  let user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId)
  });
  if (!user) {
    const [newUser] = await db.insert(users).values({
      id: crypto.randomUUID(),
      clerkId,
      email: `${clerkId}@placeholder.com`,
      displayName: "Athlet",
      timezone: "Europe/Berlin",
      dailyCalorieTarget: 2500,
      dailyProteinTarget: 150,
      dailyCarbsTarget: 250,
      dailyFatTarget: 80,
    }).returning();
    user = newUser;
  }
  return user;
}

// Get user food presets + public presets
food.get("/presets", async (c) => {
  const auth = getAuth(c);
  const db = getDb(c.env.DB);
  const user = await getDbUser(db, auth!.userId!);

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
  const auth = getAuth(c);
  const db = getDb(c.env.DB);
  const user = await getDbUser(db, auth!.userId!);

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

// Get meals logged today
food.get("/meals", async (c) => {
  const auth = getAuth(c);
  const db = getDb(c.env.DB);
  const user = await getDbUser(db, auth!.userId!);

  // Simple today check
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const loggedMeals = await db.query.meals.findMany({
    where: and(
      eq(meals.userId, user.id),
      gte(meals.loggedAt, start),
      lte(meals.loggedAt, end)
    ),
    with: {
      items: true
    }
  });

  return c.json({ meals: loggedMeals });
});

// Log a meal (with food items)
food.post("/meals", async (c) => {
  const auth = getAuth(c);
  const db = getDb(c.env.DB);
  const user = await getDbUser(db, auth!.userId!);

  const body = await c.req.json(); // { name: string, loggedAt: number, items: Array<{ name, quantity, calories, protein, carbs, fat, foodPresetId? }> }
  
  const mealId = crypto.randomUUID();
  const [meal] = await db.insert(meals).values({
    id: mealId,
    userId: user.id,
    name: body.name || "Mahlzeit",
    loggedAt: new Date(body.loggedAt || Date.now()),
    note: body.note || null,
  }).returning();

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

// Delete a meal log
food.delete("/meals/:id", async (c) => {
  const auth = getAuth(c);
  const db = getDb(c.env.DB);
  const user = await getDbUser(db, auth!.userId!);
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
