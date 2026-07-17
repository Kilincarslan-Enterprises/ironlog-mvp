# IronLog CLI Skill

## Description
Use the IronLog CLI to interact with the IronLog fitness tracking API from the command line. Supports all API endpoints: dashboard, food, training, supplements, weight, goals, notifications, and API token management.

## When to use
- When you need to read or write data to IronLog (weight entries, meals, workouts, supplements, goals)
- When you need to check the daily dashboard or nutrition summary
- When managing IronLog API tokens
- When an AI agent needs to log fitness data programmatically

## Prerequisites

### 1. Install
The CLI lives in the repo at `cli/ironlog.mjs`. No npm install needed — zero dependencies, Node.js 18+.

### 2. Login (once per machine)
```bash
node cli/ironlog.mjs login <YOUR_API_TOKEN>
```
Token is stored in `~/.ironlog/config.json`. Alternatively set `IRONLOG_TOKEN` env var.

Get a token from the IronLog app Settings page, or create one via CLI:
```bash
node cli/ironlog.mjs tokens create --label "Agent"
```

### 3. Verify
```bash
node cli/ironlog.mjs health
node cli/ironlog.mjs whoami
```

## Command Reference

All commands support `--json` for raw JSON output (recommended for AI agents).

### System & User
```
ironlog health                              # API health check
ironlog whoami                              # Current user profile
ironlog dashboard                           # Today's summary (calories, training, weight, supplements)
ironlog user update '{...}'                 # Update profile/nutrition targets
```

### API Tokens
```
ironlog tokens list [--all]                 # List tokens (including revoked with --all)
ironlog tokens create --label "Name"       # Create new token (secret shown once)
ironlog tokens revoke <id>                  # Revoke a token
```

### Food & Nutrition
```
ironlog food presets                       # List food presets
ironlog food presets create '{...}'        # Create food preset
ironlog food presets update <id> '{...}'   # Update food preset
ironlog food presets delete <id>           # Delete food preset
ironlog food barcode <barcode>             # Lookup product by barcode (Open Food Facts)
ironlog food meals                         # List today's meals
ironlog food meals create '{...}'          # Log a meal with items
ironlog food meals update <id> '{...}'      # Update meal (name, note, loggedAt)
ironlog food meals delete <id> [--item <itemId>]  # Delete meal or single item
ironlog nutrition daily [--date YYYY-MM-DD] # Daily nutrition summary
```

### Training
```
ironlog training exercises                       # List exercises
ironlog training exercises create '{...}'         # Create exercise
ironlog training exercises update <id> '{...}'    # Update exercise
ironlog training exercises delete <id>            # Delete exercise
ironlog training plans                      # List workout plans
ironlog training plans create '{...}'      # Create workout plan (with optional inline exercises)
ironlog training plans update <id> '{...}' # Update workout plan (replaces exercises if provided)
ironlog training plans delete <id>          # Delete a plan
ironlog training sessions [--date DATE]    # List sessions
ironlog training sessions create '{...}'   # Start a session
ironlog training sessions delete <id>       # Delete a session
ironlog training sessions update <id> '{...}'  # Update/end session
ironlog training sessions add-set <sid> '{...}'       # Add a set
ironlog training sessions update-set <sid> <setid> '{...}'  # Update a set
ironlog training sessions delete-set <sid> <setid>   # Delete a set
ironlog training prs                        # Personal records
```

### Schedule
```
ironlog schedule                            # List weekly template
ironlog schedule set '[...]'               # Set weekly template (JSON array)
ironlog schedule today                      # What's scheduled today
ironlog schedule week                       # This week's schedule
ironlog schedule override '{...}'           # Override a specific date
ironlog schedule override delete <date>      # Remove override (YYYY-MM-DD)
```
> **Pitfall:** `schedule set` erwartet `dayOfWeek` (Integer 0–6, 0=Sunday, 1=Monday), nicht `day`.
> Falscher Key (`day` statt `dayOfWeek`) führt zu HTTP 500.

### Machines
```
ironlog machines [--muscleGroup chest]      # List machines
ironlog machines create '{...}'             # Create machine
ironlog machines update <id> '{...}'        # Update machine
ironlog machines delete <id>                # Delete machine
ironlog machines logs <id> [--limit 30]     # Machine log history
ironlog machines log <id> '{...}'           # Log weight for a machine
ironlog machines log delete <id> <logId>    # Delete a machine log
ironlog machines progress <id>             # Progression summary for a machine
```

### Supplements
```
ironlog supplements [--all]                 # List supplements
ironlog supplements create '{...}'          # Create supplement
ironlog supplements update <id> '{...}'    # Update supplement
ironlog supplements delete <id>            # Delete supplement
ironlog supplements logs [--date DATE]      # List logs
ironlog supplements logs create '{...}'    # Log intake
ironlog supplements logs delete <id>        # Delete log
```

### Weight
```
ironlog weight [--range 7d|30d|90d|all]     # List weight entries
ironlog weight create '{...}'              # Log weight (weight, unit, measuredAt, bodyFatPercentage, note)
ironlog weight update <id> '{...}'         # Update entry
ironlog weight delete <id>                  # Delete entry
```

### Goals
```
ironlog goals [--status active|paused|achieved|abandoned]  # List goals
ironlog goals create '{...}'               # Create goal
ironlog goals update <id> '{...}'          # Update goal
ironlog goals status <id> <status>         # Change status
ironlog goals delete <id>                  # Delete a goal
ironlog goals progress <id>                 # View progress history
ironlog goals progress add <id> '{...}'    # Add progress entry
```

### Notifications
```
ironlog notifications [--unreadOnly]        # List notifications
ironlog notifications create '{...}'       # Create notification
ironlog notifications read <id>            # Mark as read
ironlog notifications delete <id>          # Delete a notification
```

## JSON Body Examples

### Log weight
```bash
ironlog weight create '{"weight":82.3,"unit":"kg","note":"Morning weigh-in"}'
```

### Log a meal
```bash
ironlog food meals create '{"name":"Frühstück","items":[{"name":"Haferflocken","quantity":80,"quantityUnit":"g","calories":296,"protein":10,"carbs":48,"fat":6}]}'
```

### Start a workout
```bash
ironlog training sessions create '{"name":"Push Day"}'
```

### Add a set
```bash
ironlog training sessions add-set <sessionId> '{"exerciseId":"...","reps":10,"weight":80,"weightUnit":"kg"}'
```

### Create a goal
```bash
ironlog goals create '{"title":"80kg erreichen","category":"weight","direction":"lose","targetValue":80,"targetUnit":"kg"}'
```

### Log supplement intake
```bash
ironlog supplements logs create '{"supplementId":"...","dose":1,"doseUnit":"pill"}'
```

## Tips for AI Agents
- Always use `--json` flag for parseable output
- Run `ironlog dashboard --json` first to get an overview of today's state
- Use `ironlog whoami --json` to get user context (timezone, targets)
- JSON body args must be valid JSON (single-quoted in shell)
- Token can also be passed via `IRONLOG_TOKEN` env var (no login needed)
- Base URL defaults to https://ironlog-mvp.pages.dev/api (override with `--base-url` at login)