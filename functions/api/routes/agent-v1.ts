import { Hono } from "hono";
import { getDb } from "../db";
import { notifications } from "../../../db/schema";
import { AppEnv, getCtxUser } from "../auth";

/**
 * Dedicated REST API surface for external agents — `/api/agent/v1/...`.
 *
 * The resource endpoints (dashboard, food, training, supplements, weight,
 * goals, user, nutrition) are the SAME route modules the UI uses, re-mounted
 * under `/agent/v1` in `app.ts`. They are already gated by the global auth
 * guard, which resolves an agent API token (`x-api-token` / `Bearer`) to the
 * owning user — so an agent authenticated with its token gets full read+write
 * parity with the UI, scoped to that user.
 *
 * This module hosts the two pieces that are unique to the agent surface and
 * don't already exist as UI routes:
 *
 *   - `GET  /api/agent/v1/`            — index describing the v1 resources.
 *   - `POST /api/agent/v1/suggestions` — send a suggestion/message visible to
 *                                        the user (written as a `suggestion`
 *                                        notification row).
 *
 * The proposal/pending/confirmed flow for big changes (goal/plan) is tracked
 * separately under KILA-124 Step 3 — it needs a `proposals` table + D1
 * migration and is deliberately NOT included here.
 */
const agentV1 = new Hono<AppEnv>();

/**
 * GET /api/agent/v1 — surface index. Lists the v1 resources an agent can use.
 * Read+write parity with the UI; all routes require a valid agent API token.
 *
 * Also served at the trailing-slash form `/api/agent/v1/` via an explicit
 * registration in `app.ts` (Hono mounts a sub-app's `/` route at the exact
 * prefix without a trailing slash, so the bare-slash variant is added by hand).
 */
const indexHandler = (c: any) =>
  c.json({
    name: "IronLog Agent API",
    version: "v1",
    auth: "Agent API token via x-api-token header or Authorization: Bearer <token>",
    resources: {
      dashboard: {
        description: "User dashboard summary (today's intake, goals, recent activity)",
        methods: ["GET /dashboard"],
      },
      user: {
        description: "User profile + daily targets (read/update)",
        methods: ["GET /user", "PATCH /user"],
      },
      food: {
        description: "Food presets + meals + meal items (full CRUD)",
        methods: ["GET|POST /food/presets", "GET|POST /food/meals", "..."],
      },
      nutrition: {
        description: "Nutrition history / aggregated intake",
        methods: ["GET /nutrition/..."],
      },
      training: {
        description: "Exercises, workout plans, sessions, sets (full CRUD)",
        methods: ["GET|POST /training/..."],
      },
      supplements: {
        description: "Supplements + supplement logs (full CRUD)",
        methods: ["GET|POST /supplements/..."],
      },
      weight: {
        description: "Weight entries / weight logs (full CRUD)",
        methods: ["GET|POST /weight/..."],
      },
      goals: {
        description: "Goals + goal progress entries (full CRUD)",
        methods: ["GET|POST /goals/..."],
      },
      suggestions: {
        description: "Send a suggestion/message visible to the user",
        methods: ["POST /suggestions"],
      },
    },
    // NOTE: proposal/confirmation flow for big changes is planned (KILA-124
    // Step 3) and pending a D1 migration; not yet available on this surface.
  });

agentV1.get("/", indexHandler);

export { indexHandler };

/**
 * POST /api/agent/v1/suggestions — send a suggestion/message visible to the user.
 *
 * Body: { title, body, actionUrl?, data? }
 *
 * Persists a `notifications` row with `kind = "suggestion"`, owned by the
 * authenticated user. The user reads it through the existing
 * `GET /api/notifications` surface — suggestions are first-class notifications,
 * not a separate inbox. Returns the created notification.
 */
agentV1.post("/suggestions", async (c) => {
  const user = getCtxUser(c);
  const db = getDb(c.env.DB);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : null;
  const message =
    typeof body.body === "string" && body.body.trim() ? body.body.trim() : null;

  if (!title || !message) {
    return c.json({ error: "title and body are required" }, 400);
  }

  const actionUrl =
    typeof body.actionUrl === "string" ? body.actionUrl : null;
  const data =
    body.data !== undefined && body.data !== null
      ? JSON.stringify(body.data)
      : null;

  const [created] = await db
    .insert(notifications)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      kind: "suggestion",
      title,
      body: message,
      data,
      actionUrl,
    })
    .returning();

  return c.json({ suggestion: created });
});

export default agentV1;