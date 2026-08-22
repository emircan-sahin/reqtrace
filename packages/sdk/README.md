# reqtrace

Self-hosted HTTP request monitoring for Node.js. Drop in an Axios or Fetch adapter, see every outbound request in a realtime dashboard — including proxy usage, blocked proxies, and failed targets.

![reqtrace dashboard](https://raw.githubusercontent.com/emircan-sahin/reqtrace/main/client-v1.png)

## Features

- **Realtime feed** — WebSocket-powered live log stream
- **Request inspection** — Headers, body, and JSON tree-view
- **Proxy tracking** — Monitor proxy health, detect blocked proxies, identify which sites fail through which proxy
- **Project filtering** — Tag requests by project, filter in the dashboard
- **Charts & analytics** — Request timeline, success/error rates, latency breakdown
- **Fully self-hosted** — No cloud, no third-party services, you own your data

## Installation

```bash
npm install reqtrace
# or
pnpm add reqtrace
```

## Usage

### With Axios

```ts
import axios from 'axios'
import { ReqtraceCore, AxiosAdapter } from 'reqtrace'

const core = new ReqtraceCore({
  serverUrl: 'http://localhost:3100',
  apiKey: 'your-api-key',
  projectName: 'my-api',
  captureBody: true,
})

const adapter = new AxiosAdapter(axios, core)
adapter.install()

// All axios requests are now logged to your dashboard
```

> See full example: [`examples/axios-demo.ts`](https://github.com/emircan-sahin/reqtrace/blob/main/examples/axios-demo.ts)

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

> See full example: [`examples/fetch-demo.ts`](https://github.com/emircan-sahin/reqtrace/blob/main/examples/fetch-demo.ts)

## Config Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `serverUrl` | `string` | — | Server URL (required for logging) |
| `apiKey` | `string` | — | API key for server authentication |
| `projectName` | `string` | `'default'` | Project name for filtering |
| `captureBody` | `boolean` | `true` | Log request/response bodies |
| `maxBodySize` | `number` | `51200` | Max body size in bytes |
| `enabled` | `boolean` | `true` | Enable/disable logging |
| `filter` | `function` | `() => true` | Skip specific requests |
| `redactHeaders` | `boolean \| string[] \| { only }` | `false` | Mask header values before they leave the process |
| `beforeSend` | `function` | — | Rewrite a log, or return `null` to drop it |

### Redacting credentials

Every header is logged by default — the server is yours and so is the data. When
the process handles credentials you would rather not persist (proxy
subscriptions, exchange API keys, signing tokens), turn redaction on:

```ts
const core = new ReqtraceCore({
  serverUrl: 'http://localhost:3100',
  apiKey: process.env.API_KEY,
  redactHeaders: true,
})
```

`true` masks any header whose name contains `auth`, `token`, `key`, `secret`,
`sign`, `cookie`, `credential`, `password` or `session`. That covers the ones no
list would have predicted — `x-apikey`, `x-fptoken`, `Ok-Verify-Sign` — including
headers a service adds after you wrote your config. Ordinary headers
(`user-agent`, `content-type`, `accept`) stay readable.

Need more than the built-in detection? An array **adds** to it:

```ts
// authorization, cookie, x-apikey … are still masked; x-tenant now is too
redactHeaders: ['x-tenant']
```

Need less? `{ only }` masks exactly what you name and nothing else:

```ts
redactHeaders: { only: ['x-tenant'] }
```

`looksLikeCredential`, `CREDENTIAL_STEMS` and `DEFAULT_REDACTED_HEADERS` are
exported if you want to reuse the detection elsewhere.

`beforeSend` is the escape hatch for anything redaction cannot express:

```ts
const core = new ReqtraceCore({
  serverUrl: 'http://localhost:3100',
  beforeSend: (log) => {
    if (log.url.includes('/internal/')) return null   // never log these
    return { ...log, request_body: undefined }        // keep the row, drop the body
  },
})
```

### Response bodies that are not captured

`captureBody` skips bodies that would cost more to keep than they are worth: a
`content-length` far above `maxBodySize`, and streaming or binary content types
(`text/event-stream`, `application/octet-stream`, `video/*`, `audio/*`,
`image/*`). The request is still logged in full — only the response body is
omitted. Without this a large download, or an SSE stream that never ends, would
be buffered whole in memory just to keep the first 50KB.

## Cleanup

```ts
adapter.eject()   // remove interceptors
core.destroy()    // close WebSocket connection
```

## Server Setup

The SDK sends logs to a self-hosted reqtrace server. You need to set up the server and dashboard before using the SDK.

```bash
# Clone the repo
git clone https://github.com/emircan-sahin/reqtrace.git
cd reqtrace
pnpm install

# Set up PostgreSQL
createdb reqtrace
cp packages/server/.env.example packages/server/.env
```

Edit `packages/server/.env` and set your own values:

```env
JWT_SECRET=your-random-secret
API_KEY=your-api-key          # use this same key in your SDK config
```

```bash
# Start server + dashboard
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) and create your admin account on first visit. Then use the `API_KEY` from your `.env` as the `apiKey` in your SDK config.

For more details, see the [full documentation](https://github.com/emircan-sahin/reqtrace).

## Contact

Have questions, feedback, or want to contribute? Reach out:

- **LinkedIn**: [Emircan Sahin](https://www.linkedin.com/in/emircan-sahin/)
- **GitHub**: [@emircan-sahin](https://github.com/emircan-sahin)

## License

MIT
