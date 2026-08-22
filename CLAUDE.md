# reqtrace

Outbound HTTP request monitoring library. Axios interceptor that captures
requests and pushes them to a self-hosted dashboard via WebSocket.

## Monorepo Structure

```
/packages/sdk       → npm package (Axios/Fetch adapters + WebSocket push)
/packages/server    → WebSocket + REST API backend (Fastify)
/packages/client    → Realtime frontend (React + Tailwind)
/examples           → Demo script for testing
```

Package-specific details are in `.claude/rules/` (sdk.md, server.md, client.md).

## Deployment Model

Fully self-hosted. No cloud dependency, no vendor lock-in.
Single admin account with JWT auth + API key for SDK.

## Code Conventions

- TypeScript (strict mode) everywhere
- Package manager: pnpm workspaces
- No default exports — always use named exports
- No React StrictMode in client
- Commit messages: English, concise, imperative mood

## Security Rules (CRITICAL)

- **NEVER** commit `.env`, `.env.*`, API keys, tokens, or credentials
- **NEVER** hardcode secrets in source code — always use environment variables
- **NEVER** commit `node_modules/`, `dist/`, or `.claude/`
- Use `.env.example` files with placeholder values (no real secrets)

## Running the Project

```bash
createdb reqtrace              # Create PostgreSQL database (first time only)
cp packages/server/.env.example packages/server/.env  # Set up env (first time only)
pnpm dev          # Start server + client in parallel
pnpm demo         # Run demo script (sends requests every 50ms)
pnpm build        # Build all packages
pnpm test         # Run all tests
```

## Architecture Decisions

- SDK uses ws (not axios) for transport to avoid interceptor loops
- SDK sends via WebSocket with auto-reconnect and 100-message buffer
- SDK authenticates with API key via WS query string
- Server binds to 127.0.0.1 (not 0.0.0.0) to avoid dual-stack issues
- Server uses PostgreSQL store (1M logs per project, retention runs off the
  insert path in bounded ctid batches every 1K inserts)
- Clearing logs uses TRUNCATE, not DELETE — constant time at any row count
- Four indexes on request_logs: timestamp, project+timestamp, status+timestamp,
  and a partial one on failures. Anything less selective costs more on insert
  than it saves on read — measure before adding a fifth
- Filters live in ONE place per side: buildConditions() in store/pg.ts for SQL,
  lib/log-filter.ts on the client. The log list and every aggregate take the
  same filter set, so the stats bar can never describe a different row set than
  the feed. Adding a filter means touching both, not just the list query
- "pending" is a client-only mode (in-flight requests are not rows); it skips
  the server query instead of fetching a page it would discard
- Time-based retention via RETENTION_DAYS (0 = off), on top of the per-project cap
- GET /api/logs/export streams NDJSON or HAR 1.2 for the active filter, paged
  by cursor — never materialize the result set
- SDK redaction is opt-in (redactHeaders / beforeSend in core.handleLog); the
  default still logs every header, per the decision below
- Server env validated with Zod (src/env.ts), defaults for PORT/HOST/DATABASE_URL/JWT_SECRET/API_KEY
- Server auth: Fastify plugin (plugins/auth.ts) with JWT + DB token validation
- JWT tokens stored in DB — login invalidates previous session, logout nulls token
- REST middleware verifies JWT signature + DB token match on every request
- WS clients validated on connect + periodically every 60s against DB
- Dashboard auth: single admin account (first register becomes admin)
- API key never exposed in dashboard — only in .env
- InMemoryStore kept as fallback for tests
- Client uses @tanstack/react-virtual for 10K+ log rendering
- Client auto-logout on 401 (REST) or WS close code 4001
- All request headers (including Authorization) are logged — intentional,
  since the server is self-hosted and the developer owns the data
