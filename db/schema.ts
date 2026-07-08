import { relations, sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
};

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    clerkId: text("clerk_id").unique(),
    displayName: text("display_name").notNull(),
    timezone: text("timezone").notNull().default("Europe/Berlin"),
    unitSystem: text("unit_system", { enum: ["metric", "imperial"] })
      .notNull()
      .default("metric"),
    dailyCalorieTarget: integer("daily_calorie_target"),
    dailyProteinTarget: integer("daily_protein_target"),
    dailyCarbsTarget: integer("daily_carbs_target"),
    dailyFatTarget: integer("daily_fat_target"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email), uniqueIndex("users_clerk_id_idx").on(t.clerkId)]
);

export const usersRelations = relations(users, ({ many }) => ({
  goals: many(goals),
  meals: many(meals),
  foodPresets: many(foodPresets),
  exercises: many(exercises),
  workoutPlans: many(workoutPlans),
  workoutSessions: many(workoutSessions),
  supplements: many(supplements),
  supplementLogs: many(supplementLogs),
  weightEntries: many(weightEntries),
  agentTokens: many(agentApiTokens),
  notifications: many(notifications),
}));

// ---------------------------------------------------------------------------
// goals
// ---------------------------------------------------------------------------

export const goals = sqliteTable(
  "goals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    category: text("category", {
      enum: ["weight", "nutrition", "strength", "cardio", "habit", "custom"],
    }).notNull(),
    direction: text("direction", { enum: ["lose", "maintain", "gain"] }),
    targetValue: real("target_value"),
    targetUnit: text("target_unit"),
    deadline: integer("deadline", { mode: "timestamp_ms" }),
    status: text("status", { enum: ["active", "paused", "achieved", "abandoned"] })
      .notNull()
      .default("active"),
    ...timestamps,
  },
  (t) => [index("goals_user_id_idx").on(t.userId)]
);

export const goalsRelations = relations(goals, ({ one, many }) => ({
  user: one(users, { fields: [goals.userId], references: [users.id] }),
  progressEntries: many(goalProgressEntries),
}));

export const goalProgressEntries = sqliteTable(
  "goal_progress_entries",
  {
    id: text("id").primaryKey(),
    goalId: text("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
    value: real("value").notNull(),
    unit: text("unit"),
    note: text("note"),
    ...timestamps,
  },
  (t) => [
    index("goal_progress_goal_id_idx").on(t.goalId),
    index("goal_progress_recorded_at_idx").on(t.recordedAt),
  ]
);

export const goalProgressEntriesRelations = relations(goalProgressEntries, ({ one }) => ({
  goal: one(goals, { fields: [goalProgressEntries.goalId], references: [goals.id] }),
}));

// ---------------------------------------------------------------------------
// food presets
// ---------------------------------------------------------------------------

export const foodPresets = sqliteTable(
  "food_presets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    brand: text("brand"),
    servingSize: real("serving_size").notNull().default(100),
    servingUnit: text("serving_unit").notNull().default("g"),
    calories: real("calories").notNull().default(0),
    protein: real("protein").notNull().default(0),
    carbs: real("carbs").notNull().default(0),
    fat: real("fat").notNull().default(0),
    fiber: real("fiber").default(0),
    sodium: real("sodium").default(0),
    barcode: text("barcode"),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index("food_presets_user_id_idx").on(t.userId),
    index("food_presets_barcode_idx").on(t.barcode),
  ]
);

export const foodPresetsRelations = relations(foodPresets, ({ one, many }) => ({
  user: one(users, { fields: [foodPresets.userId], references: [users.id] }),
  mealItems: many(mealItems),
}));

// ---------------------------------------------------------------------------
// meals
// ---------------------------------------------------------------------------

export const meals = sqliteTable(
  "meals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    loggedAt: integer("logged_at", { mode: "timestamp_ms" }).notNull(),
    note: text("note"),
    ...timestamps,
  },
  (t) => [index("meals_user_id_idx").on(t.userId), index("meals_logged_at_idx").on(t.loggedAt)]
);

export const mealsRelations = relations(meals, ({ one, many }) => ({
  user: one(users, { fields: [meals.userId], references: [users.id] }),
  items: many(mealItems),
}));

export const mealItems = sqliteTable(
  "meal_items",
  {
    id: text("id").primaryKey(),
    mealId: text("meal_id")
      .notNull()
      .references(() => meals.id, { onDelete: "cascade" }),
    foodPresetId: text("food_preset_id").references(() => foodPresets.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    quantity: real("quantity").notNull().default(1),
    quantityUnit: text("quantity_unit").notNull().default("serving"),
    calories: real("calories").notNull().default(0),
    protein: real("protein").notNull().default(0),
    carbs: real("carbs").notNull().default(0),
    fat: real("fat").notNull().default(0),
    fiber: real("fiber").default(0),
    sodium: real("sodium").default(0),
    ...timestamps,
  },
  (t) => [
    index("meal_items_meal_id_idx").on(t.mealId),
    index("meal_items_food_preset_id_idx").on(t.foodPresetId),
  ]
);

export const mealItemsRelations = relations(mealItems, ({ one }) => ({
  meal: one(meals, { fields: [mealItems.mealId], references: [meals.id] }),
  foodPreset: one(foodPresets, {
    fields: [mealItems.foodPresetId],
    references: [foodPresets.id],
  }),
}));

// ---------------------------------------------------------------------------
// exercises
// ---------------------------------------------------------------------------

export const exercises = sqliteTable(
  "exercises",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category", {
      enum: ["strength", "cardio", "mobility", "sport", "custom"],
    }).notNull(),
    muscleGroup: text("muscle_group"),
    equipment: text("equipment"),
    instructions: text("instructions"),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index("exercises_user_id_idx").on(t.userId),
    index("exercises_category_idx").on(t.category),
  ]
);

export const exercisesRelations = relations(exercises, ({ one, many }) => ({
  user: one(users, { fields: [exercises.userId], references: [users.id] }),
  workoutPlanExercises: many(workoutPlanExercises),
  workoutSessionSets: many(workoutSessionSets),
}));

// ---------------------------------------------------------------------------
// workout plans / sessions
// ---------------------------------------------------------------------------

export const workoutPlans = sqliteTable(
  "workout_plans",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    schedule: text("schedule"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (t) => [index("workout_plans_user_id_idx").on(t.userId)]
);

export const workoutPlansRelations = relations(workoutPlans, ({ one, many }) => ({
  user: one(users, { fields: [workoutPlans.userId], references: [users.id] }),
  exercises: many(workoutPlanExercises),
  sessions: many(workoutSessions),
}));

export const workoutPlanExercises = sqliteTable(
  "workout_plan_exercises",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => workoutPlans.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    dayLabel: text("day_label").notNull().default("A"),
    orderIndex: integer("order_index").notNull().default(0),
    sets: integer("sets"),
    reps: text("reps"),
    restSeconds: integer("rest_seconds"),
    rpe: real("rpe"),
    ...timestamps,
  },
  (t) => [
    index("wpe_plan_id_idx").on(t.planId),
    index("wpe_exercise_id_idx").on(t.exerciseId),
  ]
);

export const workoutPlanExercisesRelations = relations(workoutPlanExercises, ({ one }) => ({
  plan: one(workoutPlans, { fields: [workoutPlanExercises.planId], references: [workoutPlans.id] }),
  exercise: one(exercises, { fields: [workoutPlanExercises.exerciseId], references: [exercises.id] }),
}));

export const workoutSessions = sqliteTable(
  "workout_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: text("plan_id").references(() => workoutPlans.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    durationSeconds: integer("duration_seconds"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    index("workout_sessions_user_id_idx").on(t.userId),
    index("workout_sessions_plan_id_idx").on(t.planId),
    index("workout_sessions_started_at_idx").on(t.startedAt),
  ]
);

export const workoutSessionsRelations = relations(workoutSessions, ({ one, many }) => ({
  user: one(users, { fields: [workoutSessions.userId], references: [users.id] }),
  plan: one(workoutPlans, { fields: [workoutSessions.planId], references: [workoutPlans.id] }),
  sets: many(workoutSessionSets),
}));

export const workoutSessionSets = sqliteTable(
  "workout_session_sets",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => workoutSessions.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    setNumber: integer("set_number").notNull(),
    reps: integer("reps"),
    weight: real("weight"),
    weightUnit: text("weight_unit").default("kg"),
    durationSeconds: integer("duration_seconds"),
    distance: real("distance"),
    distanceUnit: text("distance_unit").default("m"),
    rpe: real("rpe"),
    isWarmup: integer("is_warmup", { mode: "boolean" }).notNull().default(false),
    isDropset: integer("is_dropset", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index("wss_session_id_idx").on(t.sessionId),
    index("wss_exercise_id_idx").on(t.exerciseId),
  ]
);

export const workoutSessionSetsRelations = relations(workoutSessionSets, ({ one }) => ({
  session: one(workoutSessions, { fields: [workoutSessionSets.sessionId], references: [workoutSessions.id] }),
  exercise: one(exercises, { fields: [workoutSessionSets.exerciseId], references: [exercises.id] }),
}));

// ---------------------------------------------------------------------------
// supplements
// ---------------------------------------------------------------------------

export const supplements = sqliteTable(
  "supplements",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    form: text("form", { enum: ["pill", "powder", "liquid", "capsule", "chewable", "other"] }),
    unitDose: real("unit_dose"),
    doseUnit: text("dose_unit"),
    dailyFrequency: integer("daily_frequency").notNull().default(1),
    reminderTimes: text("reminder_times"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (t) => [index("supplements_user_id_idx").on(t.userId)]
);

export const supplementsRelations = relations(supplements, ({ one, many }) => ({
  user: one(users, { fields: [supplements.userId], references: [users.id] }),
  logs: many(supplementLogs),
}));

export const supplementLogs = sqliteTable(
  "supplement_logs",
  {
    id: text("id").primaryKey(),
    supplementId: text("supplement_id")
      .notNull()
      .references(() => supplements.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dose: real("dose").notNull(),
    doseUnit: text("dose_unit").notNull(),
    takenAt: integer("taken_at", { mode: "timestamp_ms" }).notNull(),
    note: text("note"),
    ...timestamps,
  },
  (t) => [
    index("supplement_logs_supplement_id_idx").on(t.supplementId),
    index("supplement_logs_user_id_idx").on(t.userId),
    index("supplement_logs_taken_at_idx").on(t.takenAt),
  ]
);

export const supplementLogsRelations = relations(supplementLogs, ({ one }) => ({
  user: one(users, { fields: [supplementLogs.userId], references: [users.id] }),
  supplement: one(supplements, { fields: [supplementLogs.supplementId], references: [supplements.id] }),
}));

// ---------------------------------------------------------------------------
// weight entries
// ---------------------------------------------------------------------------

export const weightEntries = sqliteTable(
  "weight_entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weight: real("weight").notNull(),
    unit: text("unit").notNull().default("kg"),
    measuredAt: integer("measured_at", { mode: "timestamp_ms" }).notNull(),
    bodyFatPercentage: real("body_fat_percentage"),
    note: text("note"),
    source: text("source", { enum: ["manual", "scale", "agent", "import"] })
      .notNull()
      .default("manual"),
    ...timestamps,
  },
  (t) => [
    index("weight_entries_user_id_idx").on(t.userId),
    uniqueIndex("weight_entries_user_measured_at_idx").on(t.userId, t.measuredAt),
  ]
);

export const weightEntriesRelations = relations(weightEntries, ({ one }) => ({
  user: one(users, { fields: [weightEntries.userId], references: [users.id] }),
}));

// ---------------------------------------------------------------------------
// agent API tokens
// ---------------------------------------------------------------------------

export const agentApiTokens = sqliteTable(
  "agent_api_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    hashedSecret: text("hashed_secret").notNull(),
    scopes: text("scopes").notNull().default("read"),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    isRevoked: integer("is_revoked", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (t) => [index("agent_api_tokens_user_id_idx").on(t.userId)]
);

export const agentApiTokensRelations = relations(agentApiTokens, ({ one }) => ({
  user: one(users, { fields: [agentApiTokens.userId], references: [users.id] }),
}));

// ---------------------------------------------------------------------------
// notifications
// ---------------------------------------------------------------------------

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // `kind` is plain `text` in D1 (no CHECK constraint — see migrations/0000),
    // so the enum here is TypeScript-level validation only. Adding "suggestion"
    // requires no migration: the column already accepts any string.
    kind: text("kind", {
      enum: [
        "goal",
        "supplement",
        "weight",
        "workout",
        "meal",
        "system",
        "suggestion",
      ],
    }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    data: text("data"),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    actionUrl: text("action_url"),
    ...timestamps,
  },
  (t) => [
    index("notifications_user_id_idx").on(t.userId),
    index("notifications_read_at_idx").on(t.readAt),
  ]
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));
