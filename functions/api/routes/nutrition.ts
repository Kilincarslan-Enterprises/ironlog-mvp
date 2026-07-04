import { Hono } from "hono";
import { and, eq, gte, lte } from "drizzle-orm";
import { getDb } from "../db";
import { meals } from "../../../db/schema";
import { AppEnv, getCtxUser } from "../auth";

const nutrition = new Hono<AppEnv>();

/**
 * Compute the [start, end] timestamp range (ms) for the given YYYY-MM-DD date
 * interpreted in the user's timezone, returned as Date objects suitable for
 * comparison against the UTC-stored `loggedAt` column.
 */
function dayRange(dateStr: string | undefined, timezone: string): { start: Date; end: Date } {
  const tz = timezone || "Europe/Berlin";
  const now = new Date();

  // Resolve "today" in the user's tz, then optionally override the date parts.
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

  // Map local wall-clock back to absolute UTC timestamps (mirrors dashboard logic).
  const diff = now.getTime() - localNow.getTime();
  return {
    start: new Date(start.getTime() + diff),
    end: new Date(end.getTime() + diff),
  };
}

/**
 * GET /api/nutrition/daily?date=YYYY-MM-DD — daily nutrition summary aggregated
 * from all meal items logged that day, scoped to the authenticated user.
 * Defaults to today (in the user's timezone) when no date is supplied.
 */
nutrition.get("/daily", async (c) => {
  const ctxUser = getCtxUser(c);
  const db = getDb(c.env.DB);

  const date = c.req.query("date");
  let range: { start: Date; end: Date };
  try {
    range = dayRange(date, ctxUser.timezone);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }

  const dayMeals = await db.query.meals.findMany({
    where: and(
      eq(meals.userId, ctxUser.id),
      gte(meals.loggedAt, range.start),
      lte(meals.loggedAt, range.end),
    ),
    with: { items: true },
  });

  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let fiber = 0;
  let sodium = 0;

  for (const meal of dayMeals) {
    for (const item of meal.items) {
      calories += Number(item.calories) || 0;
      protein += Number(item.protein) || 0;
      carbs += Number(item.carbs) || 0;
      fat += Number(item.fat) || 0;
      fiber += Number(item.fiber) || 0;
      sodium += Number(item.sodium) || 0;
    }
  }

  return c.json({
    date: date ?? null,
    totals: {
      calories: Math.round(calories),
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fat: Math.round(fat),
      fiber: Math.round(fiber),
      sodium: Math.round(sodium),
    },
    meals: dayMeals,
  });
});

export default nutrition;