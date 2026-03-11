---
paths:
  - "packages/server/**"
---

# Server Package — /packages/server

## Purpose
Backend service that receives logs from SDK instances via WebSocket,
stores them in PostgreSQL, broadcasts to dashboard clients, and serves the REST API.
Includes JWT auth with DB token validation and API key auth for SDK clients.

## Key Files
- `src/index.ts` — Entry point (loads env, creates store, starts server)
- `src/env.ts` — Zod-validated environment config with defaults
- `src/app.ts` — Fastify app factory (plugin/route registration orchestrator)
- `src/db/index.ts` — PostgreSQL pool creation and schema initialization
- `src/store/pg.ts` — PostgresStore (5K logs per project, batch cleanup)
- `src/store/index.ts` — InMemoryStore (used in tests)
- `src/plugins/auth.ts` — Auth plugin (JWT, rate-limit, onRequest hook, periodic WS token check)
- `src/ws/index.ts` — BroadcastManager (fan-out to dashboard clients, auth client tracking)
- `src/routes/ws.ts` — WS endpoint (connection auth + message handling)
- `src/routes/auth.ts` — Auth routes (register, login, logout, status)
- `src/routes/health.ts` — GET /health
- `src/routes/logs.ts` — GET/POST/DELETE /api/logs, GET /api/projects, POST /api/resend
- `src/routes/stats.ts` — GET /api/stats
- `src/types.ts` — Server-side type definitions (async LogStore interface)

## Environment (src/env.ts)
Validated with Zod. Defaults applied when not set.
- `PORT` — Server port (default: 3100)
- `HOST` — Bind address (default: 127.0.0.1)
- `DATABASE_URL` — PostgreSQL connection string (default: postgresql://localhost:5432/reqtrace)
- `JWT_SECRET` — Secret for signing JWT tokens (change in production)
- `API_KEY` — API key for SDK authentication (change in production)

`.env` loaded via Node.js `--env-file-if-exists=.env` flag in dev/start scripts.

## API Endpoints
- `GET /health` — Health check
- `GET /api/auth/status` — Check if admin account exists
- `POST /api/auth/register` — Create admin account (first user only)
- `POST /api/auth/login` — Login (rate-limited: 5/min)
- `POST /api/auth/logout` — Logout (nulls DB token, requires valid JWT)
- `GET /api/logs` — List logs (query: project, method, status, success, url, search, from, to, limit, offset)
- `POST /api/logs` — Ingest a log entry (store + broadcast)
- `DELETE /api/logs` — Clear all logs
- `GET /api/projects` — List distinct project names from store
- `GET /api/stats` — Aggregated statistics (single SQL query with CTEs)
- `POST /api/resend` — Replay a request server-side, store and broadcast result
- `WS /ws` — WebSocket endpoint (dashboard: JWT via ?token=, SDK: API key via ?apiKey=)

## Auth Flow
1. First user registers via `/api/auth/register` → becomes admin, JWT stored in DB
2. Login via `/api/auth/login` → new JWT generated, stored in DB (invalidates previous)
3. REST requests: onRequest hook verifies JWT signature + DB token match
4. WS connections: JWT/API key verified on connect, dashboard clients checked every 60s
5. Logout: POST `/api/auth/logout` nulls DB token → WS check disconnects client
6. Auth skipped for: `/health`, `/api/auth/*`, `/ws` (WS has its own auth)

## WebSocket Flow
1. SDK connects to `/ws?apiKey=...` — verified against env API_KEY, send-only (no broadcast)
2. Dashboard connects to `/ws?token=...` — JWT verified + DB check, added to broadcast
3. SDK sends `request_start` / `request_end` messages
4. Server broadcasts to all dashboard clients, stores `request_end` logs
5. Periodic check (60s) closes dashboard clients whose tokens are no longer in DB

## Data Storage
- PostgreSQL with auto-created tables and indexes (CREATE IF NOT EXISTS)
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for schema migrations
- 5,000 logs per project max, oldest evicted via batch cleanup every 100 inserts
- LogStore interface is fully async (Promise-based) for DB compatibility
- InMemoryStore (10K max, FIFO) used in tests via createApp() without pool param
- Filtering: project, method, status, success, url (ILIKE), search (multi-column ILIKE), date range
- Pagination via LIMIT/OFFSET, newest first

## Tech Stack
- Fastify 5 with @fastify/websocket, @fastify/cors, @fastify/jwt, @fastify/rate-limit
- fastify-plugin for non-encapsulated auth plugin
- PostgreSQL via pg (node-postgres)
- bcryptjs for password hashing
- Zod for env validation
- Logger disabled by default

## Build & Test
```bash
pnpm --filter @reqtrace/server build
pnpm --filter @reqtrace/server test    # vitest (16 tests, uses InMemoryStore)
pnpm --filter @reqtrace/server dev     # tsx watch mode
```
