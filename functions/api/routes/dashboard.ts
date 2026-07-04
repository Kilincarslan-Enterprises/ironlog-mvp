import { Hono } from "hono";
import { getDb } from "../db";
import { and, eq, gte, lte } from "drizzle-orm";
import { meals, workoutSessions, weightEntries, supplementLogs, supplements } from "../../../db/schema";
import { AppEnv, getCtxUser } from "../auth";

const dashboard = new Hono<AppEnv>();

function getTodayRange(timezone: string) {
  // Simple timezone offset calculation
  const now = new Date();
  let localNow = now;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    localNow = new Date(formatter.format(now));
  } catch (e) {
    // Fallback if timezone invalid
  }
  
  const start = new Date(localNow);
  start.setHours(0, 0, 0, 0);
  const end = new Date(localNow);
  end.setHours(23, 59, 59, 999);
  
  // Adjust back to UTC/absolute timestamps
  const diff = now.getTime() - localNow.getTime();
  return {
    start: new Date(start.getTime() + diff),
    end: new Date(end.getTime() + diff),
  };
}

dashboard.get("/", async (c) => {
  const user = getCtxUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const db = getDb(c.env.DB);

  const { start, end } = getTodayRange(user.timezone || "Europe/Berlin");
  const startMs = start.getTime();
  const endMs = end.getTime();

  // 1. Fetch Today's Meals & calculate macros
  const todayMeals = await db.query.meals.findMany({
    where: and(
      eq(meals.userId, user.id),
      gte(meals.loggedAt, new Date(startMs)),
      lte(meals.loggedAt, new Date(endMs))
    ),
    with: {
      items: true
    }
  });

  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;

  for (const meal of todayMeals) {
    for (const item of meal.items) {
      calories += item.calories || 0;
      protein += item.protein || 0;
      carbs += item.carbs || 0;
      fat += item.fat || 0;
    }
  }

  // 2. Fetch Today's Training
  const todaySessions = await db.query.workoutSessions.findMany({
    where: and(
      eq(workoutSessions.userId, user.id),
      gte(workoutSessions.startedAt, new Date(startMs)),
      lte(workoutSessions.startedAt, new Date(endMs))
    )
  });

  // 3. Fetch Today's Weight
  const todayWeight = await db.query.weightEntries.findFirst({
    where: and(
      eq(weightEntries.userId, user.id),
      gte(weightEntries.measuredAt, new Date(startMs)),
      lte(weightEntries.measuredAt, new Date(endMs))
    )
  });

  // 4. Fetch Supplements status
  const activeSupps = await db.query.supplements.findMany({
    where: and(
      eq(supplements.userId, user.id),
      eq(supplements.isActive, true)
    )
  });

  const todaySuppLogs = await db.query.supplementLogs.findMany({
    where: and(
      eq(supplementLogs.userId, user.id),
      gte(supplementLogs.takenAt, new Date(startMs)),
      lte(supplementLogs.takenAt, new Date(endMs))
    )
  });

  // Count unique supplements taken today
  const uniqueTakenIds = new Set(todaySuppLogs.map(log => log.supplementId));
  
  return c.json({
    user,
    today: {
      calories: Math.round(calories),
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fat: Math.round(fat)
    },
    trainingCompleted: todaySessions.length > 0,
    weightLogged: !!todayWeight,
    todayWeight: todayWeight ? todayWeight.weight : null,
    supplementsCompleted: uniqueTakenIds.size,
    supplementsTotal: activeSupps.length,
    streaks: {
      active: true,
      count: 0 // In a real dashboard we would calculate active streaks, default 0 for MVP
    }
  });
});

export default dashboard;
