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