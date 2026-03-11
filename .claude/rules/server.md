---
paths:
  - "packages/server/**"
---

# Server Package — /packages/server

## Purpose
Backend service that receives logs from SDK instances via WebSocket,
stores them in PostgreSQL, broadcasts to dashboard clients, and serves the REST API.

## Key Files
- `src/index.ts` — Entry point (loads env, creates store, starts server)
- `src/env.ts` — Zod-validated environment config with defaults
- `src/app.ts` — Fastify app factory (cors, websocket, routes, accepts store)
- `src/db/index.ts` — PostgreSQL pool creation and schema initialization
- `src/store/pg.ts` — PostgresStore (5K logs per project, batch cleanup)
- `src/store/index.ts` — InMemoryStore (used in tests)
- `src/ws/index.ts` — BroadcastManager (fan-out to dashboard clients)
- `src/routes/health.ts` — GET /health
- `src/routes/logs.ts` — GET/POST /api/logs, GET /api/projects, POST /api/resend
- `src/routes/stats.ts` — GET /api/stats
- `src/types.ts` — Server-side type definitions (async LogStore interface)

## Environment (src/env.ts)
Validated with Zod. Defaults applied when not set.
- `PORT` — Server port (default: 3100)
- `HOST` — Bind address (default: 127.0.0.1)
- `DATABASE_URL` — PostgreSQL connection string (default: postgresql://localhost:5432/reqtrace)

`.env` loaded via Node.js `--env-file-if-exists=.env` flag in dev/start scripts.

## API Endpoints
- `GET /health` — Health check
- `GET /api/logs` — List logs (query: project, method, status, success, url, search, from, to, limit, offset)
- `POST /api/logs` — Ingest a log entry (store + broadcast)
- `GET /api/projects` — List distinct project names from store
- `GET /api/stats` — Aggregated statistics (single SQL query with CTEs)
- `POST /api/resend` — Replay a request server-side, store and broadcast result
- `WS /ws` — WebSocket endpoint for SDK log push and dashboard realtime feed

## WebSocket Flow
1. SDK connects to `/ws` and sends `request_start` / `request_end` messages
2. Server broadcasts `request_start` to all dashboard clients
3. On `request_end`, server stores the log and broadcasts to all clients
4. Dashboard clients also connect to `/ws` to receive realtime updates

## Data Storage
- PostgreSQL with auto-created table and indexes (CREATE IF NOT EXISTS)
- 5,000 logs per project max, oldest evicted via batch cleanup every 100 inserts
- LogStore interface is fully async (Promise-based) for DB compatibility
- InMemoryStore (10K max, FIFO) used in tests via createApp() without store param
- Filtering: project, method, status, success, url (ILIKE), search (multi-column ILIKE), date range
- Pagination via LIMIT/OFFSET, newest first

## Tech Stack
- Fastify 5 with @fastify/websocket and @fastify/cors
- PostgreSQL via pg (node-postgres)
- Zod for env validation
- Logger disabled by default

## Build & Test
```bash
pnpm --filter @reqtrace/server build
pnpm --filter @reqtrace/server test    # vitest (16 tests, uses InMemoryStore)
pnpm --filter @reqtrace/server dev     # tsx watch mode
```
