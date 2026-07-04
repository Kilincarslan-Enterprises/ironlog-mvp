# IronLog Agent Authentication

IronLog exposes a CLI/MCP-ready API surface under `/v1`. All endpoints require a valid agent bearer token.

## Token model

| Token type | Scope | Lifetime | Issued by |
|------------|-------|----------|-----------|
| `agent_token` | Read dashboard, write logs, create presets, propose plans | 90 days | IronLog identity service |
| `user_token` | Full web/mobile access | 7 days | Same identity service |

Agent integrations MUST use `agent_token`s. User tokens are rejected by agent-only endpoints.

## Obtaining an agent token

1. Create an agent in IronLog Settings → Agents.
2. Copy the generated token.
3. Store it in the integration environment as `IRONLOG_API_KEY`.

Do not commit tokens to source control. Rotate every 90 days or on suspected leakage.

## CLI usage

```bash
export IRONLOG_BASE_URL=http://localhost:8000/v1
export IRONLOG_API_KEY=ilat_your_token_here

python cli/ironlog.py dashboard
python cli/ironlog.py log -d '{"entries":[{"name":"Push","date":"2026-06-27","sets":[{"exercise_id":1,"reps":10,"weight_kg":80}]}]}'
```

## MCP server wiring

The same endpoints can be exposed as MCP tools:

- `ironlog_read_dashboard` → `GET /v1/agent/dashboard`
- `ironlog_write_logs` → `POST /v1/agent/logs`
- `ironlog_create_preset` → `POST /v1/agent/presets`
- `ironlog_propose_plan` → `POST /v1/agent/plans/propose`

Each tool forwards a single HTTP call with the agent bearer token. No session state is kept in the MCP layer.

## Authorization header

```
Authorization: Bearer <... API returns `401 Unauthorized` when the token is missing, expired, or not an agent token.
