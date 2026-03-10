# reqtrace

Outbound HTTP request monitoring library. Axios interceptor that captures
requests and pushes them to a self-hosted dashboard via WebSocket.

## Monorepo Structure

```
/packages/sdk       → npm package (Axios interceptor + WebSocket push)
/packages/server    → WebSocket + REST API backend (Fastify)
/packages/client    → Realtime frontend (React + Tailwind)
/examples           → Demo script for testing
```

Package-specific details are in `.claude/rules/` (sdk.md, server.md, client.md).

## Deployment Model

Fully self-hosted. No cloud dependency, no vendor lock-in.
Auth/access control is optional (planned for later).

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
pnpm dev          # Start server + client in parallel
pnpm demo         # Run demo script (sends requests every 50ms)
pnpm build        # Build all packages
pnpm test         # Run all tests
```

## Architecture Decisions

- SDK uses ws (not axios) for transport to avoid interceptor loops
- SDK sends via WebSocket with auto-reconnect and 100-message buffer
- Server binds to 127.0.0.1 (not 0.0.0.0) to avoid dual-stack issues
- Server uses in-memory store (max 10,000 entries, FIFO). PostgreSQL planned
- Client uses @tanstack/react-virtual for 10K+ log rendering
- All request headers (including Authorization) are logged — intentional,
  since the server is self-hosted and the developer owns the data
