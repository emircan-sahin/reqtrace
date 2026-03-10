---
paths:
  - "packages/server/**"
---

# Server Package — /packages/server

## Purpose
Backend service that receives logs from SDK instances via WebSocket,
stores them in memory, broadcasts to dashboard clients, and serves the REST API.

## Key Files
- `src/index.ts` — Entry point (HOST: 127.0.0.1, PORT: 3100)
- `src/app.ts` — Fastify app factory (cors, websocket, routes)
- `src/store/index.ts` — InMemoryStore (max 10,000 entries, FIFO)
- `src/ws/index.ts` — BroadcastManager (fan-out to dashboard clients)
- `src/routes/health.ts` — GET /health
- `src/routes/logs.ts` — GET/POST /api/logs, GET /api/projects, POST /api/resend
- `src/routes/stats.ts` — GET /api/stats
- `src/types.ts` — Server-side type definitions

## API Endpoints
- `GET /health` — Health check
- `GET /api/logs` — List logs (query: project, method, status, success, url, from, to, limit, offset)
- `POST /api/logs` — Ingest a log entry (store + broadcast)
- `GET /api/projects` — List distinct project names from store
- `GET /api/stats` — Aggregated statistics
- `POST /api/resend` — Replay a request server-side, store and broadcast result
- `WS /ws` — WebSocket endpoint for SDK log push and dashboard realtime feed

## WebSocket Flow
1. SDK connects to `/ws` and sends `request_start` / `request_end` messages
2. Server broadcasts `request_start` to all dashboard clients
3. On `request_end`, server stores the log and broadcasts to all clients
4. Dashboard clients also connect to `/ws` to receive realtime updates

## Data Storage
- In-memory array, max 10,000 entries (oldest evicted via FIFO)
- Supports filtering by: project, method, status, success, url, date range
- Pagination via limit/offset
- PostgreSQL planned for later

## Tech Stack
- Fastify 5 with @fastify/websocket and @fastify/cors
- Logger disabled by default

## Build & Test
```bash
pnpm --filter @reqtrace/server build
pnpm --filter @reqtrace/server test    # vitest (16 tests)
pnpm --filter @reqtrace/server dev     # tsx watch mode
```
