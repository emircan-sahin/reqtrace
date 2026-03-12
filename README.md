# reqtrace

Self-hosted HTTP request monitoring for Node.js. Drop in an Axios or Fetch adapter, see every outbound request in a realtime dashboard — including proxy usage, blocked proxies, and failed targets.

![reqtrace dashboard](client-v1.png)

## Features

- **Realtime feed** — WebSocket-powered live log stream
- **Request inspection** — Expandable rows with headers, body, and JSON tree-view
- **Proxy tracking** — Monitor proxy health, detect blocked proxies, and identify which sites fail through which proxy
- **Project filtering** — Tag requests by project, filter in the dashboard
- **Charts & analytics** — Request timeline, success/error rates, latency breakdown per project
- **Resend requests** — Replay any request from the dashboard
- **Virtual scrolling** — Smooth performance with thousands of entries
- **Auth** — Single admin account with JWT + API key for SDK
- **Fully self-hosted** — No cloud, no third-party services, you own your data

## Quick Start

```bash
# Clone and install
git clone https://github.com/emircan-sahin/reqtrace.git
cd reqtrace
pnpm install

# Set up PostgreSQL
createdb reqtrace
cp packages/server/.env.example packages/server/.env
# Edit .env: set JWT_SECRET and API_KEY to random strings

# Start server + dashboard
pnpm dev

# Run demo (sends requests every 50ms)
pnpm demo
```

Open [http://localhost:5173](http://localhost:5173) — create your admin account on first visit.

## SDK Usage

Install the SDK in your project:

```bash
pnpm add reqtrace
```

### With Axios

```ts
import axios from 'axios'
import { ReqtraceCore, AxiosAdapter } from 'reqtrace'

const core = new ReqtraceCore({
  serverUrl: 'http://localhost:3100',
  apiKey: 'your-api-key',  // must match API_KEY in server .env
  projectName: 'my-api',
  captureBody: true,
})

const adapter = new AxiosAdapter(axios, core)
adapter.install()

// All axios requests are now logged to your dashboard
```

> See full example: [`examples/axios-demo.ts`](examples/axios-demo.ts)

### With Fetch

```ts
import { ReqtraceCore, FetchAdapter } from 'reqtrace'

const core = new ReqtraceCore({
  serverUrl: 'http://localhost:3100',
  apiKey: 'your-api-key',
  projectName: 'my-api',
})

const adapter = new FetchAdapter(core)
adapter.install()

// All fetch() calls are now logged to your dashboard
const res = await fetch('https://api.example.com/users')
```

> See full example: [`examples/fetch-demo.ts`](examples/fetch-demo.ts)

### Config Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `serverUrl` | `string` | — | Server URL (required for logging) |
| `apiKey` | `string` | — | API key for server authentication |
| `projectName` | `string` | `'default'` | Project name for filtering |
| `captureBody` | `boolean` | `false` | Log request/response bodies |
| `maxBodySize` | `number` | `51200` | Max body size in bytes |
| `enabled` | `boolean` | `true` | Enable/disable logging |
| `filter` | `function` | `() => true` | Skip specific requests |

## Architecture

```
Your App (axios/fetch + reqtrace SDK)
        │
        │ WebSocket (?apiKey=...)
        ▼
  reqtrace server (:3100)     ← PostgreSQL, JWT auth, REST API
        │
        │ WebSocket (?token=...)
        ▼
  reqtrace client (:5173)     ← React dashboard
```

## Auth

- **Dashboard**: Single admin account. First visitor registers, subsequent visitors log in.
- **SDK**: Authenticates with API key set in server `.env` (`API_KEY`).
- **JWT tokens** are stored in the database — logging in from another device invalidates the previous session.
- **API key** is never exposed in the dashboard. Set it in `.env` only.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3100` | Server port |
| `HOST` | `127.0.0.1` | Bind address |
| `DATABASE_URL` | `postgresql://localhost:5432/reqtrace` | PostgreSQL connection |
| `JWT_SECRET` | dev default | JWT signing secret (change in production) |
| `API_KEY` | dev default | SDK authentication key (change in production) |

## Monorepo Structure

```
packages/sdk      → npm package (Axios/Fetch adapters + WebSocket transport)
packages/server   → Fastify backend (WebSocket + REST API + auth)
packages/client   → React dashboard (Tailwind + @tanstack/react-virtual)
examples/         → Demo scripts (Axios, Fetch)
```

## Development

```bash
pnpm dev            # Start server + client
pnpm dev:server     # Start server only
pnpm dev:client     # Start client only
pnpm demo           # Run Axios demo
pnpm demo:fetch     # Run Fetch demo
pnpm build          # Build all packages
pnpm test           # Run all tests
```

## Server API

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /api/auth/status` | Check if admin exists |
| `POST /api/auth/register` | Create admin account |
| `POST /api/auth/login` | Login (rate-limited) |
| `POST /api/auth/logout` | Logout |
| `GET /api/logs` | List logs (filterable, paginated) |
| `POST /api/logs` | Ingest a log entry |
| `DELETE /api/logs` | Clear all logs |
| `GET /api/projects` | List project names |
| `GET /api/stats` | Aggregated statistics |
| `POST /api/resend` | Replay a request |
| `WS /ws` | Realtime log stream |

## Tech Stack

| Package | Stack |
|---------|-------|
| SDK | TypeScript, axios (peer dep), fetch (native), ws |
| Server | Fastify, @fastify/websocket, @fastify/jwt, @fastify/rate-limit, PostgreSQL, Zod, bcryptjs |
| Client | React, Tailwind CSS, Zustand, @tanstack/react-virtual |

## License

MIT
