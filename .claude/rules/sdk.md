---
paths:
  - "packages/sdk/**"
---

# SDK Package — /packages/sdk

## Purpose
npm package that users install to monitor outbound HTTP requests.
Uses an adapter pattern with ReqtraceCore + AxiosAdapter/FetchAdapter. Captures
request/response metadata and pushes logs to the server via WebSocket.

## Key Files
- `src/index.ts` — Barrel exports for public API
- `src/core.ts` — ReqtraceCore class (config, log dispatch, transport wiring)
- `src/adapters/axios.ts` — AxiosAdapter (request/response interceptors)
- `src/adapters/fetch.ts` — FetchAdapter (globalThis.fetch monkey-patch)
- `src/transport.ts` — WebSocket transport with auto-reconnect and 100-msg buffer
- `src/types.ts` — TypeScript interfaces (ReqtraceConfig, RequestLog, RequestStart)
- `src/utils.ts` — truncateBody, estimateSize, flattenHeaders

## Public API
```ts
// Axios adapter
import { ReqtraceCore, AxiosAdapter } from 'reqtrace'
const core = new ReqtraceCore({ serverUrl: 'http://localhost:3100', projectName: 'my-api' })
const adapter = new AxiosAdapter(axios, core)
adapter.install()

// Fetch adapter
import { ReqtraceCore, FetchAdapter } from 'reqtrace'
const core = new ReqtraceCore({ serverUrl: 'http://localhost:3100', projectName: 'my-api' })
const adapter = new FetchAdapter(core)
adapter.install()

// later: adapter.eject(); core.destroy()
```

## Config Options
- `enabled` — Enable/disable logging (default: true)
- `serverUrl` — Server URL for WebSocket transport
- `apiKey` — API key for authenticating with the server
- `projectName` — Project identifier for filtering (default: 'default')
- `captureBody` — Capture request/response bodies (default: false)
- `maxBodySize` — Max body size in bytes (default: 51200)
- `filter` — Function to skip specific requests

## Log Record Fields
`id, project, url, method, status, duration_ms, proxy_host, proxy_port,
response_size_bytes, request_headers, response_headers, request_body,
response_body, error_message, success, timestamp`

## WebSocket Messages
- `request_start` — Sent when request begins (id, project, url, method, timestamp)
- `request_end` — Sent when request completes (full RequestLog)

## Technical Details
- Dual CJS/ESM output (`dist/cjs/` and `dist/esm/`)
- `dist/esm/package.json` with `{"type":"module"}` for ESM resolution
- ws library for WebSocket (not axios, to avoid interceptor loops)
- Exponential backoff reconnect: 1s → 2s → 4s → ... → 30s max
- 100-message buffer during disconnect

## Build & Test
```bash
pnpm --filter reqtrace build
pnpm --filter reqtrace test    # vitest (41 tests)
```
