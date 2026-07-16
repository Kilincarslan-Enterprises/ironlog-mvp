# IronLog CLI — Agent Operations Guide

> **For AI agents (Gideon, Claude Code, Codex, etc.) using the IronLog CLI.**
> Companion to `cli/SKILL.md`. This file covers operational patterns,
> multi-step workflows, and agent-specific conventions.

## Quick Start (Agent)

```bash
# 1. Set token (no interactive login needed — use env var)
export IRONLOG_TOKEN="<your-token>"

# 2. Verify connection
node cli/ironlog.mjs health --json
node cli/ironlog.mjs whoami --json

# 3. Get today's state
node cli/ironlog.mjs dashboard --json
```

Alternatively, if you want persistent config:
```bash
node cli/ironlog.mjs login "<token>"
# Stored in ~/.ironlog/config.json — survives across sessions
```

## AGENTS.md / CLAUDE.md Integration

Add this to your project's `AGENTS.md` or `CLAUDE.md` so agents know the CLI exists:

```markdown
## IronLog CLI

The IronLog CLI is at `cli/ironlog.mjs` in the ironlog-mvp repo.
Run commands with `node cli/ironlog.mjs <command> [--json]`.
Always use `--json` for parseable output.
Token: set `IRONLOG_TOKEN` env var or run `node cli/ironlog.mjs login <token>`.
See `cli/SKILL.md` for full command reference.
```

## Common Agent Workflows

### 1. Daily Check-In
```bash
# Get full daily state in one call
node cli/ironlog.mjs dashboard --json
```
Response includes: today's calories/protein/carbs/fat, training status,
weight status, supplement progress, streaks.

### 2. Log Weight After Weigh-In
```bash
node cli/ironlog.mjs weight create '{"weight":82.3,"unit":"kg"}' --json
```
Optional fields: `measuredAt` (Unix ms), `bodyFatPercentage`, `note`.

### 3. Log a Meal
```bash
node cli/ironlog.mjs food meals create '{
  "name": "Frühstück",
  "items": [
    {"name": "Haferflocken", "quantity": 80, "quantityUnit": "g", "calories": 296, "protein": 10, "carbs": 48, "fat": 6}
  ]
}' --json
```

### 4. Start + Complete a Workout
```bash
# Create session
SESSION=$(node cli/ironlog.mjs training sessions create '{"name":"Push Day"}' --json)
SESSION_ID=$(echo "$SESSION" | python3 -c 'import sys,json; print(json.load(sys.stdin)["session"]["id"])')

# Add sets
node cli/ironlog.mjs training sessions add-set "$SESSION_ID" '{"exerciseId":"...","reps":10,"weight":80,"weightUnit":"kg"}' --json

# End session
node cli/ironlog.mjs training sessions update "$SESSION_ID" '{"endedAt":'$(date +%s)'000}' --json

# Delete session (if needed)
node cli/ironlog.mjs training sessions delete "$SESSION_ID" --json

# Delete an exercise (if needed)
node cli/ironlog.mjs training exercises delete <exerciseId> --json
```

### 5. Check & Log Supplements
```bash
# List supplements
node cli/ironlog.mjs supplements --json

# Log intake
node cli/ironlog.mjs supplements logs create '{"supplementId":"...","dose":1,"doseUnit":"pill"}' --json
```

### 6. Manage Goals
```bash
# Create a weight goal
node cli/ironlog.mjs goals create '{"title":"80kg erreichen","category":"weight","direction":"lose","targetValue":80,"targetUnit":"kg"}' --json

# Add progress
node cli/ironlog.mjs goals progress add <goalId> '{"value":81.5}' --json

# Mark achieved
node cli/ironlog.mjs goals status <goalId> achieved
```

### 7. Check Today's Schedule
```bash
# What's scheduled today
node cli/ironlog.mjs schedule today --json

# This week's overview
node cli/ironlog.mjs schedule week --json

# Override today (e.g. rest day)
node cli/ironlog.mjs schedule override '{"date":"2026-07-15","label":"Rest Day"}' --json

# Remove override (revert to template)
node cli/ironlog.mjs schedule override delete 2026-07-15 --json
```

### 8. Log Machine Weight
```bash
# List machines
node cli/ironlog.mjs machines --json

# Log weight for a machine
node cli/ironlog.mjs machines log <machineId> '{"weight":60,"reps":10,"sets":3}' --json

# Check progression
node cli/ironlog.mjs machines progress <machineId> --json

# View log history
node cli/ironlog.mjs machines logs <machineId> --json
```

## Error Handling

- HTTP 401: Token invalid/expired → re-login or check `IRONLOG_TOKEN`
- HTTP 400: Bad request → check JSON body syntax
- Network error: Check internet / base URL
- All errors print to stderr and exit with code 1

## API Token Management

```bash
# List all tokens (including revoked)
node cli/ironlog.mjs tokens list --all --json

# Create a new token with expiry
node cli/ironlog.mjs tokens create --label "Cron Job" --expires 2024-12-31T23:59:59Z --json

# Revoke a token
node cli/ironlog.mjs tokens revoke <tokenId>
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `IRONLOG_TOKEN` | API token (alternative to login) | — |
| — | Base URL (set via `login --base-url`) | `https://ironlog-mvp.pages.dev/api` |