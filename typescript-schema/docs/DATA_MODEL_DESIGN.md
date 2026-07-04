# IronLog D1 Data Model Design

Deliverables for KILA-39:
- `docs/ERD.md` — full entity descriptions + Mermaid relationship diagram.
- `db/schema.ts` — Drizzle ORM TypeScript schema for all tables.
- `db/migrations/0000_initial.sql` — D1-compatible initial SQL migration.
- `db/migrations/meta/_journal.json` — Drizzle migration journal.
- `drizzle.config.ts` — Drizzle Kit config for D1.

## Design Decisions
- Cloudflare D1 (SQLite) as backend.
- ULIDs/cuid2 as text primary keys (generated in app layer, no autoincrement).
- Timestamps stored as `integer` milliseconds epoch (D1-friendly, sortable).
- JSON fields stored as `text` with Drizzle `{ mode: 'json' }`.
- Soft-enums via Drizzle `text(... enum: [...])` and CHECK-equivalent dialect handling; SQL migration uses plain `text` columns — enforce allowed values at app/API layer.
- All user-owned content cascades on user deletion; shared/global presets remain because they have `owner_id = NULL`.
- Agent API tokens keep only token hashes, never raw tokens.
- Workout hierarchy: plan → plan_exercises; session → session_exercises → sets.

## Next Steps
1. Wire project package (Hono/Remix/Nuxt + D1 workers setup).
2. Add `cuid2`/`ulid` ID generator helper.
3. Generate migration snapshots with `drizzle-kit generate` once app IDs are confirmed.
4. Add row-level helpers / indexes for analytics queries (daily nutrition rollups, PR tracking).
