# reqtrace

Outbound HTTP request monitoring library, published as an npm package.

## Project Overview

reqtrace works as an Axios interceptor. It captures every outbound HTTP request
and pushes it to a self-hosted dashboard via WebSocket. Users install the npm
package, run their own server instance, integrate the SDK in a few lines, and
see a live feed in the browser. Fully self-hosted — no cloud dependency.

## Monorepo Structure

```
/packages/sdk       → npm package (Axios interceptor + WebSocket push)
/packages/server    → WebSocket + REST API backend (Fastify)
/packages/client    → Realtime frontend (React + Tailwind)
```

## Tech Stack

| Package   | Stack                                       |
|-----------|---------------------------------------------|
| SDK       | TypeScript, axios (peer dep)                |
| Server    | Fastify, ws, PostgreSQL, Redis              |
| Client    | React, Tailwind CSS                         |

## Deployment Model

Self-hosted. Each developer runs their own server + client instance.
No centralized cloud service, no vendor lock-in. Auth/access control is
optional and can be enabled via server config (planned for later).

## SDK Public API

```ts
import { reqtrace } from 'reqtrace'
reqtrace.init({ serverUrl: 'http://localhost:3100' })
// all axios requests are now automatically logged
```

## Log Record Schema

Every intercepted request produces a record with:
`url, method, status, duration_ms, proxy_host, proxy_port, response_size,
success, timestamp, error_message`

## Code Conventions

- Language: TypeScript (strict mode) everywhere
- Package manager: pnpm workspaces
- Formatting: Prettier (defaults)
- Linting: ESLint
- Commit messages: English, concise, imperative mood
- No default exports — always use named exports

## Security Rules (CRITICAL)

This project is fully open-source. Never leak secrets or credentials.

- **NEVER** commit `.env`, `.env.*`, API keys, tokens, or credentials
- **NEVER** hardcode secrets in source code — always use environment variables
- **NEVER** log sensitive data (request/response bodies that may contain PII)
- **NEVER** commit `node_modules/`, `dist/`, or build artifacts
- **NEVER** commit `.claude/` directory or any AI tool configuration
- All secret values must come from environment variables
- Use `.env.example` files with placeholder values (no real secrets)
- Review every file before committing to ensure no data leaks

## Development Workflow

1. Work on one package at a time
2. Verify code compiles before marking done (`npm run build`)
3. Run tests if they exist (`npm test`)
4. Keep changes minimal and focused

## Architecture Decisions

- Self-hosted: no cloud auth layer, no API key validation by default
- Auth/authorization is optional, configurable via server options (planned)
- SDK has zero runtime dependencies (axios is peer dep)
- SDK buffers logs and sends via WebSocket; falls back to HTTP POST
- SDK connects to user's own server instance (serverUrl)
- Client connects via WebSocket for realtime updates
- Stats (daily/hourly) are pre-aggregated in PostgreSQL
- All request headers (including Authorization) are logged — this is intentional
  since the server is self-hosted and the developer owns the data
