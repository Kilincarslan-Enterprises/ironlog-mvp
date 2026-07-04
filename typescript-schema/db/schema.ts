import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  timezone: text('timezone').default('UTC').notNull(),
  unitSystem: text('unit_system', { enum: ['metric', 'imperial'] }).default('metric').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [index('users_email_idx').on(table.email)]);

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['calories', 'protein', 'carbs', 'fat', 'weight', 'bodyFat', 'water', 'custom'] }).notNull(),
  targetValue: real('target_value').notNull(),
  unit: text('unit'),
  period: text('period', { enum: ['daily', 'weekly', 'monthly'] }).default('daily').notNull(),
  startDate: integer('start_date', { mode: 'timestamp_ms' }),
  endDate: integer('end_date', { mode: 'timestamp_ms' }),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [index('goals_user_id_idx').on(table.userId)]);

export const foods = sqliteTable('foods', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  brand: text('brand'),
  barcode: text('barcode'),
  servingSize: real('serving_size').default(100).notNull(),
  servingUnit: text('serving_unit').default('g').notNull(),
  caloriesPerServing: real('calories_per_serving').notNull(),
  proteinPerServing: real('protein_per_serving').default(0).notNull(),
  carbsPerServing: real('carbs_per_serving').default(0).notNull(),
  fatPerServing: real('fat_per_serving').default(0).notNull(),
  fiberPerServing: real('fiber_per_serving').default(0).notNull(),
  sugarPerServing: real('sugar_per_serving').default(0).notNull(),
  sodiumPerServing: real('sodium_per_serving').default(0).notNull(),
  isVerified: integer('is_verified', { mode: 'boolean' }).default(false).notNull(),
  source: text('source'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  index('foods_owner_id_idx').on(table.ownerId),
  index('foods_name_idx').on(table.name),
  index('foods_barcode_idx').on(table.barcode),
]);

export const mealPresets = sqliteTable('meal_presets', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  items: text('items', { mode: 'json' }).notNull(), // [{foodId, quantity, quantityUnit}]
  isPublic: integer('is_public', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [index('meal_presets_owner_id_idx').on(table.ownerId)]);

export const meals = sqliteTable('meals', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: integer('date', { mode: 'timestamp_ms' }).notNull(),
  mealType: text('meal_type', { enum: ['breakfast', 'lunch', 'dinner', 'snack', 'preworkout', 'postworkout'] }).notNull(),
  foodId: text('food_id').references(() => foods.id, { onDelete: 'set null' }),
  presetId: text('preset_id').references(() => mealPresets.id, { onDelete: 'set null' }),
  quantity: real('quantity').default(1).notNull(),
  quantityUnit: text('quantity_unit').default('serving').notNull(),
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  index('meals_user_id_date_idx').on(table.userId, table.date),
  index('meals_food_id_idx').on(table.foodId),
  index('meals_preset_id_idx').on(table.presetId),
]);

export const exercises = sqliteTable('exercises', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: text('category', { enum: ['strength', 'cardio', 'hybrid', 'mobility', 'sports'] }).notNull(),
  muscleGroup: text('muscle_group'),
  equipment: text('equipment'),
  instructions: text('instructions'),
  videoUrl: text('video_url'),
  isVerified: integer('is_verified', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  index('exercises_owner_id_idx').on(table.ownerId),
  index('exercises_name_idx').on(table.name),
]);

export const workoutPlans = sqliteTable('workout_plans', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  frequencyDays: integer('frequency_days'),
  difficulty: text('difficulty', { enum: ['beginner', 'intermediate', 'advanced'] }),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [index('workout_plans_owner_id_idx').on(table.ownerId)]);

export const workoutPlanExercises = sqliteTable('workout_plan_exercises', {
  id: text('id').primaryKey(),
  planId: text('plan_id').notNull().references(() => workoutPlans.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id').notNull().references(() => exercises.id, { onDelete: 'cascade' }),
  dayIndex: integer('day_index').default(1).notNull(),
  orderIndex: integer('order_index').default(0).notNull(),
  defaultSets: integer('default_sets').default(3),
  defaultReps: integer('default_reps'),
  defaultWeightKg: real('default_weight_kg'),
  defaultDurationSec: integer('default_duration_sec'),
  restSec: integer('rest_sec'),
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  index('wpe_plan_id_idx').on(table.planId),
  index('wpe_exercise_id_idx').on(table.exerciseId),
  index('wpe_plan_day_idx').on(table.planId, table.dayIndex),
]);

export const workoutSessions = sqliteTable('workout_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  planId: text('plan_id').references(() => workoutPlans.id, { onDelete: 'set null' }),
  name: text('name'),
  startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
  endedAt: integer('ended_at', { mode: 'timestamp_ms' }),
  durationSec: integer('duration_sec'),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [index('workout_sessions_user_id_idx').on(table.userId, table.startedAt)]);

export const workoutSessionExercises = sqliteTable('workout_session_exercises', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => workoutSessions.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id').notNull().references(() => exercises.id, { onDelete: 'cascade' }),
  orderIndex: integer('order_index').default(0).notNull(),
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  index('wse_session_id_idx').on(table.sessionId),
  index('wse_exercise_id_idx').on(table.exerciseId),
]);

export const workoutSets = sqliteTable('workout_sets', {
  id: text('id').primaryKey(),
  sessionExerciseId: text('session_exercise_id').notNull().references(() => workoutSessionExercises.id, { onDelete: 'cascade' }),
  setNumber: integer('set_number').notNull(),
  reps: integer('reps'),
  weightKg: real('weight_kg'),
  durationSec: integer('duration_sec'),
  distanceM: real('distance_m'),
  rpe: integer('rpe'),
  isFailure: integer('is_failure', { mode: 'boolean' }).default(false).notNull(),
  isWarmup: integer('is_warmup', { mode: 'boolean' }).default(false).notNull(),
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [index('workout_sets_session_exercise_id_idx').on(table.sessionExerciseId)]);

export const supplements = sqliteTable('supplements', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: text('category', { enum: ['vitamin', 'mineral', 'protein', 'creatine', 'preworkout', 'omega3', 'other'] }).notNull(),
  unit: text('unit').default('g').notNull(),
  defaultDose: real('default_dose'),
  frequency: text('frequency').default('daily').notNull(),
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  index('supplements_owner_id_idx').on(table.ownerId),
  index('supplements_name_idx').on(table.name),
]);

export const supplementLogs = sqliteTable('supplement_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  supplementId: text('supplement_id').notNull().references(() => supplements.id, { onDelete: 'cascade' }),
  date: integer('date', { mode: 'timestamp_ms' }).notNull(),
  dose: real('dose').notNull(),
  takenAt: integer('taken_at', { mode: 'timestamp_ms' }),
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [index('supplement_logs_user_id_date_idx').on(table.userId, table.date)]);

export const weightEntries = sqliteTable('weight_entries', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  recordedAt: integer('recorded_at', { mode: 'timestamp_ms' }).notNull(),
  weightKg: real('weight_kg').notNull(),
  bodyFatPercent: real('body_fat_percent'),
  muscleMassKg: real('muscle_mass_kg'),
  waterPercent: real('water_percent'),
  note: text('note'),
  source: text('source').default('manual').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [index('weight_entries_user_id_recorded_at_idx').on(table.userId, table.recordedAt)]);

export const agentApiTokens = sqliteTable('agent_api_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  scopes: text('scopes', { mode: 'json' }).notNull(), // ["meals:write","workouts:read",...]
  lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
  revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [index('agent_api_tokens_user_id_idx').on(table.userId)]);

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['reminder', 'achievement', 'system', 'goal'] }).notNull(),
  title: text('title').notNull(),
  body: text('body'),
  data: text('data', { mode: 'json' }),
  readAt: integer('read_at', { mode: 'timestamp_ms' }),
  sentAt: integer('sent_at', { mode: 'timestamp_ms' }),
  channel: text('channel', { enum: ['in_app', 'push', 'email'] }).default('in_app').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [index('notifications_user_id_read_at_idx').on(table.userId, table.readAt)]);
