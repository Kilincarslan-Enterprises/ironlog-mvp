/**
 * IronLog API client.
 *
 * Thin fetch wrapper around the Hono `/api/*` endpoints. Automatically attaches
 * the Clerk session JWT and centralises error handling — a 401 redirects back to
 * the sign-in flow. Response shapes are typed to match the route schemas in
 * `functions/api/routes/*` and `db/schema.ts`.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  clerkId: string | null;
  displayName: string;
  timezone: string;
  unitSystem: "metric" | "imperial";
  dailyCalorieTarget: number | null;
  dailyProteinTarget: number | null;
  dailyCarbsTarget: number | null;
  dailyFatTarget: number | null;
}

export interface FoodPreset {
  id: string;
  userId: string;
  name: string;
  brand: string | null;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sodium: number | null;
  barcode: string | null;
  isPublic: boolean;
}

export interface MealItem {
  id: string;
  mealId: string;
  foodPresetId: string | null;
  name: string;
  quantity: number;
  quantityUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sodium: number | null;
}

export interface Meal {
  id: string;
  userId: string;
  name: string;
  loggedAt: string | number; // timestamp_ms serialised as number
  note: string | null;
  items: MealItem[];
}

export interface NutritionDaily {
  date: string | null;
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sodium: number;
  };
  meals: Meal[];
}

export interface Dashboard {
  user: User;
  today: { calories: number; protein: number; carbs: number; fat: number };
  trainingCompleted: boolean;
  weightLogged: boolean;
  todayWeight: number | null;
  supplementsCompleted: number;
  supplementsTotal: number;
  streaks: { active: boolean; count: number };
}

export interface Exercise {
  id: string;
  userId: string;
  name: string;
  category: "strength" | "cardio" | "mobility" | "sport" | "custom";
  muscleGroup: string | null;
  equipment: string | null;
  instructions: string | null;
  isPublic: boolean;
}

export interface WorkoutPlanExercise {
  id: string;
  planId: string;
  exerciseId: string;
  dayLabel: string;
  orderIndex: number;
  sets: number | null;
  reps: string | null;
  restSeconds: number | null;
  rpe: number | null;
}

export interface WorkoutPlan {
  id: string;
  userId: string;
  name: string;
  schedule: string | null;
  isActive: boolean;
  exercises: WorkoutPlanExercise[];
}

export interface WorkoutSet {
  id: string;
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  reps: number | null;
  weight: number | null;
  weightUnit: string;
  durationSeconds: number | null;
  distance: number | null;
  distanceUnit: string;
  rpe: number | null;
  isWarmup: boolean;
  isDropset: boolean;
}

export interface WorkoutSession {
  id: string;
  userId: string;
  planId: string | null;
  name: string;
  startedAt: string | number;
  endedAt: string | number | null;
  durationSeconds: number | null;
  notes: string | null;
  sets: WorkoutSet[];
}

export interface Supplement {
  id: string;
  userId: string;
  name: string;
  form: "pill" | "powder" | "liquid" | "capsule" | "chewable" | "other" | null;
  unitDose: number | null;
  doseUnit: string | null;
  dailyFrequency: number;
  reminderTimes: string | null;
  isActive: boolean;
}

export interface SupplementLog {
  id: string;
  supplementId: string;
  userId: string;
  dose: number;
  doseUnit: string;
  takenAt: string | number;
  note: string | null;
}

export interface WeightEntry {
  id: string;
  userId: string;
  weight: number;
  unit: string;
  measuredAt: string | number;
  bodyFatPercentage: number | null;
  note: string | null;
  source: "manual" | "scale" | "agent" | "import";
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  category: "weight" | "nutrition" | "strength" | "cardio" | "habit" | "custom";
  direction: "lose" | "maintain" | "gain" | null;
  targetValue: number | null;
  targetUnit: string | null;
  deadline: string | number | null;
  status: "active" | "paused" | "achieved" | "abandoned";
}

export interface Notification {
  id: string;
  userId: string;
  kind: "goal" | "supplement" | "weight" | "workout" | "meal" | "system";
  title: string;
  body: string;
  data: string | null;
  readAt: string | number | null;
  actionUrl: string | null;
}

export interface AgentToken {
  id: string;
  userId: string;
  label: string;
  scopes: string;
  lastUsedAt: string | number | null;
  expiresAt: string | number | null;
  isRevoked: boolean;
  createdAt: string | number;
}

// ---------------------------------------------------------------------------
// Token plumbing
// ---------------------------------------------------------------------------

/** Function that returns the current Clerk session JWT (or null). */
type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter | null = null;

/** Called once from the React tree (inside <SignedIn>) to wire up Clerk auth. */
export function setTokenGetter(fn: TokenGetter) {
  tokenGetter = fn;
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

const API_BASE = "/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  method: string = "GET",
  body?: unknown,
  query?: Record<string, string | undefined>,
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (tokenGetter) {
    const token = await tokenGetter();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const qs = query
    ? "?" +
      Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}${qs}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError(0, "Netzwerkfehler — Anfrage konnte nicht gesendet werden.");
  }

  if (res.status === 401) {
    // JWT invalid/expired — bounce back to the sign-in flow.
    if (typeof window !== "undefined") {
      window.location.assign("/");
    }
    throw new ApiError(401, "Nicht autorisiert");
  }

  let json: any = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }

  if (!res.ok) {
    const message = (json && (json.error || json.message)) || `Fehler ${res.status}`;
    throw new ApiError(res.status, message);
  }

  return json as T;
}

// ---------------------------------------------------------------------------
// Dashboard & User
// ---------------------------------------------------------------------------

export const getDashboard = () => request<Dashboard>("/dashboard");

export const getUser = () => request<{ user: User }>("/user/me");

export const updateUser = (patch: Partial<User>) =>
  request<{ user: User }>("/user/me", "PATCH", patch);

// ---------------------------------------------------------------------------
// Food presets
// ---------------------------------------------------------------------------

export const getFoodPresets = () => request<{ presets: FoodPreset[] }>("/food/presets");

export const createFoodPreset = (data: Partial<FoodPreset> & { name: string }) =>
  request<{ preset: FoodPreset }>("/food/presets", "POST", data);

export const updateFoodPreset = (id: string, data: Partial<FoodPreset>) =>
  request<{ preset: FoodPreset }>(`/food/presets/${id}`, "PUT", data);

export const deleteFoodPreset = (id: string) =>
  request<{ success: boolean }>(`/food/presets/${id}`, "DELETE");

// ---------------------------------------------------------------------------
// Barcode lookup (Open Food Facts)
// ---------------------------------------------------------------------------

export const lookupBarcode = (barcode: string) =>
  request<{ preset: FoodPreset; cached: boolean; source?: string }>(`/food/barcode/${barcode}`);

// ---------------------------------------------------------------------------
// Meals
// ---------------------------------------------------------------------------

export const getMeals = (date?: string) =>
  request<{ meals: Meal[] }>("/food/meals", "GET", undefined, { date });

export const createMeal = (data: {
  name?: string;
  loggedAt?: number;
  note?: string;
  items: Array<Partial<MealItem> & { name: string }>;
}) => request<{ meal: Meal }>("/food/meals", "POST", data);

export const deleteMealItem = (mealId: string, itemId: string) =>
  request<{ success: boolean }>(`/food/meals/${mealId}/items/${itemId}`, "DELETE");

export const deleteMeal = (id: string) =>
  request<{ success: boolean }>(`/food/meals/${id}`, "DELETE");

// ---------------------------------------------------------------------------
// Nutrition
// ---------------------------------------------------------------------------

export const getNutritionDaily = (date?: string) =>
  request<NutritionDaily>("/nutrition/daily", "GET", undefined, { date });

// ---------------------------------------------------------------------------
// Training: exercises
// ---------------------------------------------------------------------------

export const getExercises = () =>
  request<{ exercises: Exercise[] }>("/training/exercises");

export const createExercise = (data: Partial<Exercise> & { name: string }) =>
  request<{ exercise: Exercise }>("/training/exercises", "POST", data);

export const updateExercise = (id: string, data: Partial<Exercise>) =>
  request<{ exercise: Exercise }>(`/training/exercises/${id}`, "PUT", data);

export const getExerciseHistory = (id: string) =>
  request<{ history: WorkoutSet[] }>(`/training/exercises/${id}/history`);

export const getExercisePRs = (id: string) =>
  request<{
    exerciseId: string;
    exercise: Exercise | null;
    maxWeight: { value: number; reps: number; weight: number; sessionId: string; date: string } | null;
    maxReps: { value: number; reps: number; weight: number; sessionId: string; date: string } | null;
    maxVolume: { value: number; reps: number; weight: number; sessionId: string; date: string } | null;
  }>(`/training/exercises/${id}/prs`);

// ---------------------------------------------------------------------------
// Training: plans
// ---------------------------------------------------------------------------

export const getWorkoutPlans = () =>
  request<{ plans: WorkoutPlan[] }>("/training/workout-plans");

export const createWorkoutPlan = (data: {
  name: string;
  schedule?: string;
  isActive?: boolean;
  exercises?: Array<Partial<WorkoutPlanExercise> & { exerciseId: string }>;
}) => request<{ plan: WorkoutPlan }>("/training/workout-plans", "POST", data);

export const updateWorkoutPlan = (
  id: string,
  data: {
    name?: string;
    schedule?: string;
    exercises?: Array<Partial<WorkoutPlanExercise> & { exerciseId: string }>;
  },
) => request<{ plan: WorkoutPlan }>(`/training/workout-plans/${id}`, "PUT", data);

export const activateWorkoutPlan = (id: string) =>
  request<{ plan: WorkoutPlan }>(`/training/workout-plans/${id}/activate`, "POST");

export const deleteWorkoutPlan = (id: string) =>
  request<{ success: boolean }>(`/training/workout-plans/${id}`, "DELETE");

export const deleteExercise = (id: string) =>
  request<{ success: boolean }>(`/training/exercises/${id}`, "DELETE");

// ---------------------------------------------------------------------------
// Training: sessions & sets
// ---------------------------------------------------------------------------

export const getWorkoutSessions = (date?: string) =>
  request<{ sessions: WorkoutSession[] }>("/training/workout-sessions", "GET", undefined, {
    date,
  });

export const startWorkoutSession = (data: { planId?: string; name?: string; startedAt?: number }) =>
  request<{ session: WorkoutSession }>("/training/workout-sessions", "POST", data);

export const finishWorkoutSession = (
  id: string,
  data?: { endedAt?: number; durationSeconds?: number; notes?: string; name?: string },
) => request<{ session: WorkoutSession }>(`/training/workout-sessions/${id}`, "PATCH", data);

export const addSet = (sessionId: string, data: Partial<WorkoutSet> & { exerciseId: string }) =>
  request<{ set: WorkoutSet }>(`/training/workout-sessions/${sessionId}/sets`, "POST", data);

export const updateSet = (
  sessionId: string,
  setId: string,
  data: Partial<WorkoutSet>,
) =>
  request<{ set: WorkoutSet }>(
    `/training/workout-sessions/${sessionId}/sets/${setId}`,
    "PATCH",
    data,
  );

export const deleteSet = (sessionId: string, setId: string) =>
  request<{ success: boolean }>(`/training/workout-sessions/${sessionId}/sets/${setId}`, "DELETE");

export const getPersonalRecords = () =>
  request<{ records: any[] }>("/training/personal-records");

// ---------------------------------------------------------------------------
// Supplements
// ---------------------------------------------------------------------------

export const getSupplements = (all = false) =>
  request<{ supplements: Supplement[] }>("/supplements", "GET", undefined, {
    all: all ? "true" : undefined,
  });

export const createSupplement = (data: Partial<Supplement> & { name: string }) =>
  request<{ supplement: Supplement }>("/supplements", "POST", data);

export const updateSupplement = (id: string, data: Partial<Supplement>) =>
  request<{ supplement: Supplement }>(`/supplements/${id}`, "PATCH", data);

export const deleteSupplement = (id: string) =>
  request<{ success: boolean }>(`/supplements/${id}`, "DELETE");

export const getSupplementLogs = (date?: string) =>
  request<{ logs: SupplementLog[] }>("/supplements/logs", "GET", undefined, { date });

export const createSupplementLog = (data: { supplementId: string; dose?: number; doseUnit?: string; takenAt?: number }) =>
  request<{ log: SupplementLog }>("/supplements/logs", "POST", data);

export const deleteSupplementLog = (id: string) =>
  request<{ success: boolean }>(`/supplements/logs/${id}`, "DELETE");

// ---------------------------------------------------------------------------
// Weight
// ---------------------------------------------------------------------------

export const getWeightEntries = (range: "7d" | "30d" | "90d" | "all" = "30d") =>
  request<{ entries: WeightEntry[] }>("/weight", "GET", undefined, { range });

export const createWeightEntry = (data: Partial<WeightEntry> & { weight: number }) =>
  request<{ entry: WeightEntry }>("/weight", "POST", data);

export const updateWeightEntry = (id: string, data: Partial<WeightEntry>) =>
  request<{ entry: WeightEntry }>(`/weight/${id}`, "PATCH", data);

export const deleteWeightEntry = (id: string) =>
  request<{ success: boolean }>(`/weight/${id}`, "DELETE");

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export const getGoals = (status?: Goal["status"]) =>
  request<{ goals: Goal[] }>("/goals", "GET", undefined, { status });

export const createGoal = (data: Partial<Goal> & { title: string; category: Goal["category"] }) =>
  request<{ goal: Goal }>("/goals", "POST", data);

export const updateGoal = (id: string, data: Partial<Goal>) =>
  request<{ goal: Goal }>(`/goals/${id}`, "PATCH", data);

export const updateGoalStatus = (id: string, status: Goal["status"]) =>
  request<{ goal: Goal }>(`/goals/${id}/status`, "POST", { status });

export const deleteGoal = (id: string) =>
  request<{ success: boolean }>(`/goals/${id}`, "DELETE");

export interface GoalProgressEntry {
  id: string;
  goalId: string;
  recordedAt: string | number;
  value: number;
  unit: string | null;
  note: string | null;
}

export const getGoalProgress = (id: string) =>
  request<{ progress: GoalProgressEntry[] }>(`/goals/${id}/progress`);

export const addGoalProgress = (
  id: string,
  data: { value: number; unit?: string; recordedAt?: number; note?: string },
) => request<{ progress: GoalProgressEntry }>(`/goals/${id}/progress`, "POST", data);

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const getNotifications = (unreadOnly = false) =>
  request<{ notifications: Notification[] }>("/notifications", "GET", undefined, {
    unreadOnly: unreadOnly ? "true" : undefined,
  });

export const createNotification = (data: Partial<Notification> & { title: string; body: string }) =>
  request<{ notification: Notification }>("/notifications", "POST", data);

export const markNotificationRead = (id: string) =>
  request<{ notification: Notification }>(`/notifications/${id}/read`, "POST");

// ---------------------------------------------------------------------------
// Agent Tokens
// ---------------------------------------------------------------------------

export const getAgentTokens = (includeRevoked = false) =>
  request<{ tokens: AgentToken[] }>("/agent/tokens", "GET", undefined, {
    all: includeRevoked ? "true" : undefined,
  });

export const createAgentToken = (data: { label: string; scopes?: string; expiresAt?: string | null }) =>
  request<{ token: AgentToken; secret: string }>("/agent/tokens", "POST", data);

export const deleteAgentToken = (id: string) =>
  request<{ token: AgentToken }>(`/agent/tokens/${id}`, "DELETE");

// ---------------------------------------------------------------------------
// Schedule (weekly template + overrides)
// ---------------------------------------------------------------------------

export interface ScheduleEntry {
  id: string;
  dayOfWeek: number;
  planId: string | null;
  label: string;
  overrideDate: string | null;
  overrideLabel: string | null;
  overridePlanId: string | null;
}

export interface ScheduleToday {
  dayOfWeek: number;
  label: string;
  planId: string | null;
  plan: WorkoutPlan | null;
  isOverride: boolean;
  overrideDate: string | null;
}

export interface ScheduleWeekDay {
  date: string;
  dayOfWeek: number;
  label: string;
  planId: string | null;
  plan: WorkoutPlan | null;
  isOverride: boolean;
}

export const getSchedule = () =>
  request<{ schedule: ScheduleEntry[] }>("/schedule");

export const setSchedule = (entries: Array<{ dayOfWeek: number; planId?: string; label: string }>) =>
  request<{ schedule: ScheduleEntry[] }>("/schedule", "PUT", entries);

export const getScheduleToday = () =>
  request<ScheduleToday>("/schedule/today");

export const getScheduleWeek = () =>
  request<{ days: ScheduleWeekDay[] }>("/schedule/week");

export const overrideSchedule = (data: { date: string; label: string; planId?: string }) =>
  request<{ entry: ScheduleEntry }>("/schedule/override", "POST", data);

export const deleteScheduleOverride = (date: string) =>
  request<{ success: boolean }>(`/schedule/override/${date}`, "DELETE");

// ---------------------------------------------------------------------------
// Machines (gym equipment registry + logs)
// ---------------------------------------------------------------------------

export interface Machine {
  id: string;
  userId: string;
  name: string;
  muscleGroup: string | null;
  imageUrl: string | null;
  notes: string | null;
}

export interface MachineLog {
  id: string;
  machineId: string;
  userId: string;
  weight: number;
  weightUnit: string;
  reps: number | null;
  sets: number;
  loggedAt: string | number;
  note: string | null;
}

export interface MachineProgress {
  machine: Machine;
  firstLog: MachineLog | null;
  latestLog: MachineLog | null;
  delta: number;
  maxWeight: number;
  recentLogs: MachineLog[];
}

export const getMachines = (muscleGroup?: string) =>
  request<{ machines: Machine[] }>("/machines", "GET", undefined, { muscleGroup });

export const createMachine = (data: Partial<Machine> & { name: string }) =>
  request<{ machine: Machine }>("/machines", "POST", data);

export const updateMachine = (id: string, data: Partial<Machine>) =>
  request<{ machine: Machine }>(`/machines/${id}`, "PUT", data);

export const deleteMachine = (id: string) =>
  request<{ success: boolean }>(`/machines/${id}`, "DELETE");

export const getMachineLogs = (id: string, limit?: number) =>
  request<{ logs: MachineLog[] }>(`/machines/${id}/logs`, "GET", undefined, { limit: limit?.toString() });

export const logMachineWeight = (id: string, data: { weight: number; weightUnit?: string; reps?: number; sets?: number; loggedAt?: number; note?: string }) =>
  request<{ log: MachineLog }>(`/machines/${id}/logs`, "POST", data);

export const deleteMachineLog = (machineId: string, logId: string) =>
  request<{ success: boolean }>(`/machines/${machineId}/logs/${logId}`, "DELETE");

export const getMachineProgress = (id: string) =>
  request<MachineProgress>(`/machines/${id}/progress`);