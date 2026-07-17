#!/usr/bin/env node
/**
 * IronLog CLI — Command-line interface for the IronLog API.
 *
 * Zero dependencies, runs on Node.js 18+.
 *
 * Usage:
 *   node cli/ironlog.mjs login <token>
 *   node cli/ironlog.mjs dashboard
 *   node cli/ironlog.mjs weight list --range all --json
 *   node cli/ironlog.mjs weight create '{"weight":82.3,"unit":"kg"}'
 *
 * Auth: x-api-token header, token stored in ~/.ironlog/config.json
 * Output: human-readable by default, raw JSON with --json flag
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CONFIG_DIR = join(homedir(), ".ironlog");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const DEFAULT_BASE = "https://ironlog-mvp.pages.dev/api";

function loadConfig() {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function saveConfig(cfg) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

function getToken() {
  const cfg = loadConfig();
  return cfg.token || process.env.IRONLOG_TOKEN || "";
}

function getBaseUrl() {
  const cfg = loadConfig();
  return cfg.baseUrl || DEFAULT_BASE;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function api(path, method = "GET", body, query) {
  const token = getToken();
  if (!token) {
    console.error("Error: No API token. Run: ironlog login <token>");
    process.exit(1);
  }

  const base = getBaseUrl();
  const qs = query
    ? "?" +
      Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";

  const headers = {
    "x-api-token": token,
    "Content-Type": "application/json",
  };

  let res;
  try {
    res = await fetch(`${base}${path}${qs}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    console.error(`Network error: ${e.message}`);
    process.exit(1);
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = typeof data === "object" && data?.error ? data.error : typeof data === "string" ? data : JSON.stringify(data);
    console.error(`HTTP ${res.status}: ${msg}`);
    process.exit(1);
  }

  return data;
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

function output(data, jsonFlag) {
  if (jsonFlag) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(format(data));
  }
}

function format(data) {
  if (data === null || data === undefined) return "";
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.map((d) => format(d)).join("\n\n");
  if (typeof data === "object") {
    // Compact single-line for flat objects
    const keys = Object.keys(data);
    if (keys.length <= 3 && keys.every((k) => typeof data[k] !== "object")) {
      return keys.map((k) => `${k}: ${data[k]}`).join(" | ");
    }
    return JSON.stringify(data, null, 2);
  }
  return String(data);
}

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = [];
  const flags = {};
  let jsonFlag = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") {
      jsonFlag = true;
    } else if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      flags[key] = val;
    } else {
      args.push(a);
    }
  }

  return { args, flags, jsonFlag };
}

function parseJsonArg(str) {
  if (!str) return undefined;
  try {
    return JSON.parse(str);
  } catch {
    console.error(`Error: Invalid JSON: ${str}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const commands = {
  login: {
    desc: "Store your API token (run once)",
    usage: "ironlog login <token> [--base-url <url>]",
    run: async (args, flags, _jsonFlag) => {
      const token = args[0];
      if (!token) {
        console.error("Usage: ironlog login <token> [--base-url <url>]");
        process.exit(1);
      }
      const cfg = { token };
      if (flags["base-url"]) cfg.baseUrl = flags["base-url"];
      else cfg.baseUrl = getBaseUrl();
      saveConfig(cfg);

      // Verify
      const me = await api("/user/me");
      console.log(`Logged in as: ${me.user.displayName} (${me.user.id})`);
      console.log(`Token stored in ${CONFIG_FILE}`);
    },
  },

  whoami: {
    desc: "Show current user profile",
    run: async (args, flags, jsonFlag) => {
      const data = await api("/user/me");
      output(data, jsonFlag);
    },
  },

  health: {
    desc: "API health check",
    run: async (args, flags, jsonFlag) => {
      const data = await api("/health");
      output(data, jsonFlag);
    },
  },

  dashboard: {
    desc: "Today's dashboard summary",
    run: async (args, flags, jsonFlag) => {
      const data = await api("/dashboard");
      output(data, jsonFlag);
    },
  },

  "user update": {
    desc: "Update user profile / nutrition targets",
    usage: 'ironlog user update \'{"displayName":"Max","dailyCalorieTarget":2500}\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[0]);
      const data = await api("/user/me", "PATCH", body);
      output(data, jsonFlag);
    },
  },

  // -- Tokens --
  "tokens list": {
    desc: "List your API tokens",
    usage: "ironlog tokens list [--all]",
    run: async (args, flags, jsonFlag) => {
      const data = await api("/agent/tokens", "GET", undefined, { all: flags.all });
      output(data, jsonFlag);
    },
  },

  "tokens create": {
    desc: "Create a new API token",
    usage: 'ironlog tokens create --label "Cron Job" [--expires 2024-12-31T23:59:59Z]',
    run: async (args, flags, jsonFlag) => {
      const body = { label: flags.label || args[0] || "CLI" };
      if (flags.expires) body.expiresAt = flags.expires;
      const data = await api("/agent/tokens", "POST", body);
      output(data, jsonFlag);
    },
  },

  "tokens revoke": {
    desc: "Revoke an API token",
    usage: "ironlog tokens revoke <id>",
    run: async (args, flags, jsonFlag) => {
      const data = await api(`/agent/tokens/${args[0]}`, "DELETE");
      output(data, jsonFlag);
    },
  },

  // -- Food presets --
  "food presets": {
    desc: "List food presets",
    run: async (args, flags, jsonFlag) => {
      const data = await api("/food/presets");
      output(data, jsonFlag);
    },
  },

  "food presets create": {
    desc: "Create a food preset",
    usage: 'ironlog food presets create \'{"name":"Haferflocken","servingSize":100,"servingUnit":"g","calories":370,"protein":13,"carbs":60,"fat":7}\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[0]);
      const data = await api("/food/presets", "POST", body);
      output(data, jsonFlag);
    },
  },

  "food presets update": {
    desc: "Update a food preset",
    usage: 'ironlog food presets update <id> \'{"name":"..."}\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[1]);
      const data = await api(`/food/presets/${args[0]}`, "PUT", body);
      output(data, jsonFlag);
    },
  },

  "food presets delete": {
    desc: "Delete a food preset",
    usage: "ironlog food presets delete <id>",
    run: async (args, flags, jsonFlag) => {
      const data = await api(`/food/presets/${args[0]}`, "DELETE");
      output(data, jsonFlag);
    },
  },

  "food barcode": {
    desc: "Lookup product by barcode (Open Food Facts)",
    usage: "ironlog food barcode <barcode>",
    run: async (args, flags, jsonFlag) => {
      const data = await api(`/food/barcode/${args[0]}`);
      output(data, jsonFlag);
    },
  },

  // -- Food meals --
  "food meals": {
    desc: "List meals (today or by date)",
    usage: "ironlog food meals [--date YYYY-MM-DD]",
    run: async (args, flags, jsonFlag) => {
      const data = await api("/food/meals", "GET", undefined, { date: flags.date });
      output(data, jsonFlag);
    },
  },

  "food meals create": {
    desc: "Log a meal with items",
    usage: 'ironlog food meals create \'{"name":"Frühstück","items":[{"name":"Haferflocken","quantity":80,"quantityUnit":"g","calories":296,"protein":10,"carbs":48,"fat":6}]}\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[0]);
      const data = await api("/food/meals", "POST", body);
      output(data, jsonFlag);
    },
  },

  "food meals update": {
    desc: "Update a meal (name, note, loggedAt)",
    usage: 'ironlog food meals update <id> \'{"name":"Mittagessen"}\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[1]);
      const data = await api(`/food/meals/${args[0]}`, "PATCH", body);
      output(data, jsonFlag);
    },
  },

  "food meals delete": {
    desc: "Delete a meal (or single item)",
    usage: "ironlog food meals delete <mealId> [--item <itemId>]",
    run: async (args, flags, jsonFlag) => {
      let path = `/food/meals/${args[0]}`;
      if (flags.item) path += `/items/${flags.item}`;
      const data = await api(path, "DELETE");
      output(data, jsonFlag);
    },
  },

  // -- Nutrition --
  "nutrition daily": {
    desc: "Daily nutrition summary",
    usage: "ironlog nutrition daily [--date YYYY-MM-DD]",
    run: async (args, flags, jsonFlag) => {
      const data = await api("/nutrition/daily", "GET", undefined, { date: flags.date });
      output(data, jsonFlag);
    },
  },

  // -- Training exercises --
  "training exercises": {
    desc: "List all exercises",
    run: async (args, flags, jsonFlag) => {
      const data = await api("/training/exercises");
      output(data, jsonFlag);
    },
  },

  "training exercises create": {
    desc: "Create a custom exercise",
    usage: 'ironlog training exercises create \'{"name":"Bench Press","category":"strength","muscleGroup":"chest"}\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[0]);
      const data = await api("/training/exercises", "POST", body);
      output(data, jsonFlag);
    },
  },

  "training exercises update": {
    desc: "Update an exercise",
    usage: 'ironlog training exercises update <id> \'{"name":"New Name"}\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[1]);
      const data = await api(`/training/exercises/${args[0]}`, "PUT", body);
      output(data, jsonFlag);
    },
  },

  "training exercises delete": {
    desc: "Delete an exercise",
    usage: "ironlog training exercises delete <id>",
    run: async (args, flags, jsonFlag) => {
      const data = await api(`/training/exercises/${args[0]}`, "DELETE");
      output(data, jsonFlag);
    },
  },

  // -- Training plans --
  "training plans": {
    desc: "List workout plans",
    run: async (args, flags, jsonFlag) => {
      const data = await api("/training/workout-plans");
      output(data, jsonFlag);
    },
  },

  "training plans create": {
    desc: "Create a workout plan",
    usage: 'ironlog training plans create \'{"name":"Push Day","exercises":[...]}\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[0]);
      const data = await api("/training/workout-plans", "POST", body);
      output(data, jsonFlag);
    },
  },

  "training plans update": {
    desc: "Update a workout plan",
    usage: 'ironlog training plans update <id> \'{"name":"New Name","exercises":[...]}\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[1]);
      const data = await api(`/training/workout-plans/${args[0]}`, "PUT", body);
      output(data, jsonFlag);
    },
  },

  "training plans delete": {
    desc: "Delete a workout plan",
    usage: "ironlog training plans delete <id>",
    run: async (args, flags, jsonFlag) => {
      const data = await api(`/training/workout-plans/${args[0]}`, "DELETE");
      output(data, jsonFlag);
    },
  },

  // -- Training sessions --
  "training sessions": {
    desc: "List workout sessions",
    usage: "ironlog training sessions [--date YYYY-MM-DD]",
    run: async (args, flags, jsonFlag) => {
      const data = await api("/training/workout-sessions", "GET", undefined, { date: flags.date });
      output(data, jsonFlag);
    },
  },

  "training sessions create": {
    desc: "Start a workout session",
    usage: 'ironlog training sessions create \'{"name":"Push Day"}\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[0]);
      const data = await api("/training/workout-sessions", "POST", body);
      output(data, jsonFlag);
    },
  },

  "training sessions delete": {
    desc: "Delete a workout session",
    usage: "ironlog training sessions delete <id>",
    run: async (args, flags, jsonFlag) => {
      const data = await api(`/training/workout-sessions/${args[0]}`, "DELETE");
      output(data, jsonFlag);
    },
  },

  "training sessions update": {
    desc: "Update/end a workout session",
    usage: 'ironlog training sessions update <id> \'{"endedAt":1719500000000}\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[1]);
      const data = await api(`/training/workout-sessions/${args[0]}`, "PATCH", body);
      output(data, jsonFlag);
    },
  },

  "training sessions add-set": {
    desc: "Add a set to a session",
    usage: 'ironlog training sessions add-set <sessionId> \'{"exerciseId":"...","reps":10,"weight":80,"weightUnit":"kg"}\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[1]);
      const data = await api(`/training/workout-sessions/${args[0]}/sets`, "POST", body);
      output(data, jsonFlag);
    },
  },

  "training sessions update-set": {
    desc: "Update a set in a session",
    usage: 'ironlog training sessions update-set <sessionId> <setId> \'{"reps":12}\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[2]);
      const data = await api(`/training/workout-sessions/${args[0]}/sets/${args[1]}`, "PATCH", body);
      output(data, jsonFlag);
    },
  },

  "training sessions delete-set": {
    desc: "Delete a set from a session",
    usage: "ironlog training sessions delete-set <sessionId> <setId>",
    run: async (args, flags, jsonFlag) => {
      const data = await api(`/training/workout-sessions/${args[0]}/sets/${args[1]}`, "DELETE");
      output(data, jsonFlag);
    },
  },

  // -- Training PRs --
  "training prs": {
    desc: "List personal records",
    run: async (args, flags, jsonFlag) => {
      const data = await api("/training/personal-records");
      output(data, jsonFlag);
    },
  },

  // -- Supplements --
  "supplements": {
    desc: "List supplements",
    usage: "ironlog supplements [--all]",
    run: async (args, flags, jsonFlag) => {
      const data = await api("/supplements", "GET", undefined, { all: flags.all });
      output(data, jsonFlag);
    },
  },

  "supplements create": {
    desc: "Create a supplement",
    usage: 'ironlog supplements create \'{"name":"Vitamin D","form":"pill","dailyFrequency":1}\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[0]);
      const data = await api("/supplements", "POST", body);
      output(data, jsonFlag);
    },
  },

  "supplements update": {
    desc: "Update a supplement",
    usage: 'ironlog supplements update <id> \'{"isActive":false}\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[1]);
      const data = await api(`/supplements/${args[0]}`, "PATCH", body);
      output(data, jsonFlag);
    },
  },

  "supplements delete": {
    desc: "Delete a supplement",
    usage: "ironlog supplements delete <id>",
    run: async (args, flags, jsonFlag) => {
      const data = await api(`/supplements/${args[0]}`, "DELETE");
      output(data, jsonFlag);
    },
  },

  "supplements logs": {
    desc: "List supplement logs",
    usage: "ironlog supplements logs [--date YYYY-MM-DD]",
    run: async (args, flags, jsonFlag) => {
      const data = await api("/supplements/logs", "GET", undefined, { date: flags.date });
      output(data, jsonFlag);
    },
  },

  "supplements logs create": {
    desc: "Log a supplement intake",
    usage: 'ironlog supplements logs create \'{"supplementId":"...","dose":1,"doseUnit":"pill"}\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[0]);
      const data = await api("/supplements/logs", "POST", body);
      output(data, jsonFlag);
    },
  },

  "supplements logs delete": {
    desc: "Delete a supplement log",
    usage: "ironlog supplements logs delete <id>",
    run: async (args, flags, jsonFlag) => {
      const data = await api(`/supplements/logs/${args[0]}`, "DELETE");
      output(data, jsonFlag);
    },
  },

  // -- Weight --
  "weight": {
    desc: "List weight entries",
    usage: "ironlog weight [--range 7d|30d|90d|all]",
    run: async (args, flags, jsonFlag) => {
      const data = await api("/weight", "GET", undefined, { range: flags.range });
      output(data, jsonFlag);
    },
  },

  "weight create": {
    desc: "Log a weight entry",
    usage: 'ironlog weight create \'{"weight":82.3,"unit":"kg"}\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[0]);
      const data = await api("/weight", "POST", body);
      output(data, jsonFlag);
    },
  },

  "weight update": {
    desc: "Update a weight entry",
    usage: 'ironlog weight update <id> \'{"weight":83.0}\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[1]);
      const data = await api(`/weight/${args[0]}`, "PATCH", body);
      output(data, jsonFlag);
    },
  },

  "weight delete": {
    desc: "Delete a weight entry",
    usage: "ironlog weight delete <id>",
    run: async (args, flags, jsonFlag) => {
      const data = await api(`/weight/${args[0]}`, "DELETE");
      output(data, jsonFlag);
    },
  },

  // -- Goals --
  "goals": {
    desc: "List goals",
    usage: "ironlog goals [--status active|paused|achieved|abandoned]",
    run: async (args, flags, jsonFlag) => {
      const data = await api("/goals", "GET", undefined, { status: flags.status });
      output(data, jsonFlag);
    },
  },

  "goals create": {
    desc: "Create a goal",
    usage: 'ironlog goals create \'{"title":"80kg erreichen","category":"weight","direction":"lose","targetValue":80,"targetUnit":"kg"}\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[0]);
      const data = await api("/goals", "POST", body);
      output(data, jsonFlag);
    },
  },

  "goals update": {
    desc: "Update a goal",
    usage: 'ironlog goals update <id> \'{"title":"..."}\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[1]);
      const data = await api(`/goals/${args[0]}`, "PATCH", body);
      output(data, jsonFlag);
    },
  },

  "goals status": {
    desc: "Change goal status",
    usage: "ironlog goals status <id> <active|paused|achieved|abandoned>",
    run: async (args, flags, jsonFlag) => {
      const data = await api(`/goals/${args[0]}/status`, "POST", { status: args[1] });
      output(data, jsonFlag);
    },
  },

  "goals delete": {
    desc: "Delete a goal",
    usage: "ironlog goals delete <id>",
    run: async (args, flags, jsonFlag) => {
      const data = await api(`/goals/${args[0]}`, "DELETE");
      output(data, jsonFlag);
    },
  },

  "goals progress": {
    desc: "View goal progress history",
    usage: "ironlog goals progress <id>",
    run: async (args, flags, jsonFlag) => {
      const data = await api(`/goals/${args[0]}/progress`);
      output(data, jsonFlag);
    },
  },

  "goals progress add": {
    desc: "Add a progress entry to a goal",
    usage: 'ironlog goals progress add <id> \'{"value":81.5}\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[1]);
      const data = await api(`/goals/${args[0]}/progress`, "POST", body);
      output(data, jsonFlag);
    },
  },

  // -- Notifications --
  "notifications": {
    desc: "List notifications",
    usage: "ironlog notifications [--unreadOnly]",
    run: async (args, flags, jsonFlag) => {
      const data = await api("/notifications", "GET", undefined, { unreadOnly: flags.unreadOnly });
      output(data, jsonFlag);
    },
  },

  "notifications create": {
    desc: "Create a notification",
    usage: 'ironlog notifications create \'{"kind":"system","title":"Test","body":"Hello"}\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[0]);
      const data = await api("/notifications", "POST", body);
      output(data, jsonFlag);
    },
  },

  "notifications read": {
    desc: "Mark a notification as read",
    usage: "ironlog notifications read <id>",
    run: async (args, flags, jsonFlag) => {
      const data = await api(`/notifications/${args[0]}/read`, "POST");
      output(data, jsonFlag);
    },
  },

  "notifications delete": {
    desc: "Delete a notification",
    usage: "ironlog notifications delete <id>",
    run: async (args, flags, jsonFlag) => {
      const data = await api(`/notifications/${args[0]}`, "DELETE");
      output(data, jsonFlag);
    },
  },

  // -- Schedule --
  "schedule": {
    desc: "List weekly schedule template",
    run: async (args, flags, jsonFlag) => {
      const data = await api("/schedule");
      output(data, jsonFlag);
    },
  },

  "schedule set": {
    desc: "Replace weekly schedule template",
    usage: 'ironlog schedule set \'[{"dayOfWeek":1,"label":"Push Day","planId":"..."},{"dayOfWeek":2,"label":"Rest Day"}]\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[0]);
      const data = await api("/schedule", "PUT", body);
      output(data, jsonFlag);
    },
  },

  "schedule today": {
    desc: "Show what's scheduled for today",
    run: async (args, flags, jsonFlag) => {
      const data = await api("/schedule/today");
      output(data, jsonFlag);
    },
  },

  "schedule week": {
    desc: "Show this week's schedule with overrides",
    run: async (args, flags, jsonFlag) => {
      const data = await api("/schedule/week");
      output(data, jsonFlag);
    },
  },

  "schedule override": {
    desc: "Create or update a schedule override for a date",
    usage: 'ironlog schedule override \'{"date":"2024-07-16","label":"Rest Day"}\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[0]);
      const data = await api("/schedule/override", "POST", body);
      output(data, jsonFlag);
    },
  },

  "schedule override delete": {
    desc: "Remove a schedule override for a date",
    usage: "ironlog schedule override delete <YYYY-MM-DD>",
    run: async (args, flags, jsonFlag) => {
      const data = await api(`/schedule/override/${args[0]}`, "DELETE");
      output(data, jsonFlag);
    },
  },

  // -- Machines --
  "machines": {
    desc: "List machines",
    usage: "ironlog machines [--muscleGroup chest]",
    run: async (args, flags, jsonFlag) => {
      const data = await api("/machines", "GET", undefined, { muscleGroup: flags.muscleGroup });
      output(data, jsonFlag);
    },
  },

  "machines create": {
    desc: "Create a machine",
    usage: 'ironlog machines create \'{"name":"Leg Press","muscleGroup":"legs"}\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[0]);
      const data = await api("/machines", "POST", body);
      output(data, jsonFlag);
    },
  },

  "machines update": {
    desc: "Update a machine",
    usage: 'ironlog machines update <id> \'{"name":"..."}\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[1]);
      const data = await api(`/machines/${args[0]}`, "PUT", body);
      output(data, jsonFlag);
    },
  },

  "machines delete": {
    desc: "Delete a machine",
    usage: "ironlog machines delete <id>",
    run: async (args, flags, jsonFlag) => {
      const data = await api(`/machines/${args[0]}`, "DELETE");
      output(data, jsonFlag);
    },
  },

  "machines logs": {
    desc: "List machine log history",
    usage: "ironlog machines logs <id> [--limit 30]",
    run: async (args, flags, jsonFlag) => {
      const data = await api(`/machines/${args[0]}/logs`, "GET", undefined, { limit: flags.limit });
      output(data, jsonFlag);
    },
  },

  "machines log": {
    desc: "Log a weight entry for a machine",
    usage: 'ironlog machines log <id> \'{"weight":80,"reps":10,"sets":3}\'',
    run: async (args, flags, jsonFlag) => {
      const body = parseJsonArg(args[1]);
      const data = await api(`/machines/${args[0]}/logs`, "POST", body);
      output(data, jsonFlag);
    },
  },

  "machines log delete": {
    desc: "Delete a machine log entry",
    usage: "ironlog machines log delete <id> <logId>",
    run: async (args, flags, jsonFlag) => {
      const data = await api(`/machines/${args[0]}/logs/${args[1]}`, "DELETE");
      output(data, jsonFlag);
    },
  },

  "machines progress": {
    desc: "Show progression summary for a machine",
    usage: "ironlog machines progress <id>",
    run: async (args, flags, jsonFlag) => {
      const data = await api(`/machines/${args[0]}/progress`);
      output(data, jsonFlag);
    },
  },
};

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`IronLog CLI — Command-line interface for the IronLog API

Usage:
  ironlog <command> [subcommand] [args] [--flags] [--json]

Setup:
  ironlog login <token>          Store your API token (run once)

Commands:`);

  // Group commands by category
  const groups = {
    "System & User": ["health", "whoami", "dashboard", "user update"],
    "API Tokens": ["tokens list", "tokens create", "tokens revoke"],
    "Food & Nutrition": ["food presets", "food presets create", "food presets update", "food presets delete", "food barcode", "food meals", "food meals create", "food meals delete", "nutrition daily"],
    "Training": ["training exercises", "training exercises create", "training exercises update", "training exercises delete", "training plans", "training plans create", "training plans update", "training plans delete", "training sessions", "training sessions create", "training sessions update", "training sessions add-set", "training sessions update-set", "training sessions delete-set", "training prs"],
    "Supplements": ["supplements", "supplements create", "supplements update", "supplements delete", "supplements logs", "supplements logs create", "supplements logs delete"],
    "Weight": ["weight", "weight create", "weight update", "weight delete"],
    "Goals": ["goals", "goals create", "goals update", "goals status", "goals delete", "goals progress", "goals progress add"],
    "Notifications": ["notifications", "notifications create", "notifications read", "notifications delete"],
    "Schedule": ["schedule", "schedule set", "schedule today", "schedule week", "schedule override", "schedule override delete"],
    "Machines": ["machines", "machines create", "machines update", "machines delete", "machines logs", "machines log", "machines log delete", "machines progress"],
  };

  for (const [group, cmds] of Object.entries(groups)) {
    console.log(`\n  ${group}:`);
    for (const cmd of cmds) {
      const c = commands[cmd];
      if (c) console.log(`    ${cmd.padEnd(40)} ${c.desc}`);
    }
  }

  console.log(`
Flags:
  --json        Output raw JSON (for scripts & AI agents)
  --date        Date filter (YYYY-MM-DD)
  --range       Range filter (7d|30d|90d|all)
  --all         Include revoked/inactive items
  --label       Token label
  --expires     Token expiry (ISO date)
  --base-url    Set API base URL (login only)
  --status      Goal status filter
  --unreadOnly  Unread notifications only
  --item        Delete single meal item by ID

Config: ~/.ironlog/config.json
Base URL: ${DEFAULT_BASE}
`);
}

async function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === "help" || argv[0] === "--help" || argv[0] === "-h") {
    printHelp();
    return;
  }

  const { args, flags, jsonFlag } = parseArgs(argv);

  // Match multi-word commands (longest first: 3-word → 2-word → 1-word).
  // This ensures "training exercises create" matches the POST handler, not
  // the "training exercises" GET handler.
  if (args.length >= 3) {
    const threeWord = `${args[0]} ${args[1]} ${args[2]}`;
    if (commands[threeWord]) {
      await commands[threeWord].run(args.slice(3), flags, jsonFlag);
      return;
    }
  }

  if (args.length >= 2) {
    const twoWord = `${args[0]} ${args[1]}`;
    if (commands[twoWord]) {
      await commands[twoWord].run(args.slice(2), flags, jsonFlag);
      return;
    }
  }

  if (commands[args[0]]) {
    await commands[args[0]].run(args.slice(1), flags, jsonFlag);
    return;
  }

  console.error(`Unknown command: ${args.join(" ")}`);
  console.error("Run: ironlog help");
  process.exit(1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});