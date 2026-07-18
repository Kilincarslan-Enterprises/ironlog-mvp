# IronLog CLI — Claude Code Guide

> Instructions for Claude Code (or any Cursor/Copilot-style agent) working
> with the IronLog CLI inside the ironlog-mvp repo.

## Setup

The CLI is at `cli/ironlog.mjs`. Zero dependencies, Node.js 18+.

```bash
# Option A: Login (persists to ~/.ironlog/config.json)
node cli/ironlog.mjs login <token>

# Option B: Env var (session-only)
export IRONLOG_TOKEN=<token>
```

## Rules

1. Always pass `--json` when you need to parse the output.
2. Never print the token in logs or output.
3. JSON body args must be valid JSON — use single quotes in shell.
4. After any write operation, verify by reading back with a GET.
5. See `cli/SKILL.md` for the full command reference.

## Example: Log today's weight

```bash
node cli/ironlog.mjs weight create '{"weight":82.3,"unit":"kg","note":"Morning"}' --json
node cli/ironlog.mjs weight --range all --json
```

## Piece-based food presets (v0.7.0)

Food presets support optional `pieceSize` (number|null, grams per piece) and `pieceName` (string|null, piece label). When set, users can log portions by piece count instead of grams (grams = count × pieceSize).

```bash
# Create a piece-based preset (1 Ei = 53 g)
node cli/ironlog.mjs food presets create '{"name":"Ei","servingSize":100,"servingUnit":"g","calories":155,"protein":13,"carbs":1,"fat":11,"pieceSize":53,"pieceName":"Ei"}' --json

# Remove piece logging: set both to null
node cli/ironlog.mjs food presets update <id> '{"pieceSize":null,"pieceName":null}' --json
```

The `food barcode <barcode>` endpoint auto-detects the pack weight ("Packung") from Open Food Facts' `quantity` field (e.g. `"850 g"`, `"1 kg"`): `pieceSize` = grams (kg→×1000), `pieceName = "Packung"`. If `quantity` is missing, `pieceSize` stays null (gram-only).