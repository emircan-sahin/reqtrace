---
paths:
  - "packages/client/**"
---

# Client Package — /packages/client

## Purpose
Realtime web dashboard for viewing outbound HTTP request logs,
with live feed, filtering, detail inspection, and stats.

## Tech Stack
- React 19 (no StrictMode)
- Tailwind CSS v4 (@tailwindcss/vite plugin)
- shadcn/ui (Badge, Button, DropdownMenu, Input, Select, Tabs, Tooltip)
- Zustand (state management)
- @tanstack/react-virtual (virtual scrolling)
- lucide-react (icons)
- Vite

## Architecture
- **Stores** (zustand): `use-log-store`, `use-filter-store`, `use-connection-store`
- **Services**: `http.ts` (typed fetch wrapper), `websocket.ts` (WebSocketService class)
- **Hooks**: `use-websocket` (WS→stores), `use-log-loader` (REST→stores), `use-filtered-logs`, `use-stats`
- **Components**: Small, focused. shadcn/ui for common UI primitives.
- Path alias: `@/` maps to `src/`

## Key Files
- `src/App.tsx` — Slim orchestrator (~20 lines)
- `src/services/http.ts` — Typed fetch wrapper with base URL
- `src/services/websocket.ts` — WebSocketService class with reconnect
- `src/stores/use-log-store.ts` — Logs, pending, hasMore, ready
- `src/stores/use-filter-store.ts` — Project, search, projects list
- `src/stores/use-connection-store.ts` — Connected, autoScroll
- `src/hooks/use-websocket.ts` — WS lifecycle → store actions
- `src/hooks/use-log-loader.ts` — REST fetch on filter change + loadMore
- `src/hooks/use-filtered-logs.ts` — Client-side filtering (useMemo)
- `src/hooks/use-stats.ts` — Stats computation (useMemo)
- `src/components/header.tsx` — Logo, connection status, search, filter, clear
- `src/components/stats-bar.tsx` — Stats display + auto-scroll toggle
- `src/components/log-feed.tsx` — Virtual scroll list
- `src/components/log-entry.tsx` — CompletedEntry + PendingEntry
- `src/components/detail-panel.tsx` — Request/Response/Error tabs (shadcn Tabs)
- `src/components/action-menu.tsx` — Resend, Copy (shadcn DropdownMenu)
- `src/components/json-tree.tsx` — Recursive JSON viewer
- `src/components/status-badge.tsx` — HTTP status (shadcn Badge)
- `src/components/method-badge.tsx` — HTTP method
- `src/components/protocol-badge.tsx` — HTTP/HTTPS
- `src/components/proxy-badge.tsx` — Proxy info (shadcn Tooltip)
- `src/components/ui/*` — shadcn auto-generated components

## Data Flow
1. `useWebSocket()` connects WS, pushes messages into zustand stores
2. `useLogLoader()` fetches initial logs + handles filter changes via REST
3. `useFilteredLogs()` applies client-side filtering (project + search)
4. `useStats()` computes stats from filtered logs
5. Components read directly from stores — no prop drilling

## Environment
- `VITE_SERVER_URL` — Server URL (default: http://localhost:3100)

## Build & Dev
```bash
pnpm --filter @reqtrace/client dev      # vite dev server
pnpm --filter @reqtrace/client build    # tsc + vite build
```
