---
paths:
  - "packages/client/**"
---

# Client Package — /packages/client

## Purpose
Realtime web dashboard for viewing outbound HTTP request logs,
with live feed, filtering, detail inspection, stats, and JWT auth.

## Tech Stack
- React 19 (no StrictMode)
- Tailwind CSS v4 (@tailwindcss/vite plugin)
- shadcn/ui (Badge, Button, DropdownMenu, Input, Select, Tabs, Tooltip)
- Zustand (state management)
- @tanstack/react-virtual (virtual scrolling)
- lucide-react (icons)
- Vite

## Architecture
- **Stores** (zustand): `use-log-store`, `use-filter-store`, `use-connection-store`, `use-auth-store`
- **Services**: `http.ts` (typed fetch wrapper with auth headers), `websocket.ts` (WebSocketService class)
- **Hooks**: `use-websocket` (WS→stores), `use-log-loader` (REST→stores), `use-filtered-logs`, `use-stats`
- **Components**: Small, focused. shadcn/ui for common UI primitives.
- Path alias: `@/` maps to `src/`

## Key Files
- `src/App.tsx` — Auth gate + Dashboard orchestrator
- `src/services/http.ts` — Typed fetch wrapper with auth headers + 401 auto-logout
- `src/services/websocket.ts` — WebSocketService with reconnect + WS 4001 auto-logout
- `src/stores/use-auth-store.ts` — Token, registered state, login/logout, cross-tab sync
- `src/stores/use-log-store.ts` — Logs, pending, hasMore, ready
- `src/stores/use-filter-store.ts` — Project, search, projects list
- `src/stores/use-connection-store.ts` — Connected, autoScroll
- `src/hooks/use-websocket.ts` — WS lifecycle → store actions
- `src/hooks/use-log-loader.ts` — REST fetch on filter change + loadMore
- `src/hooks/use-filtered-logs.ts` — Client-side filtering (useMemo)
- `src/hooks/use-stats.ts` — Stats computation (useMemo)
- `src/components/auth-page.tsx` — Login/register form (auto-detects first user)
- `src/components/header.tsx` — Logo, connection status, search, filter, clear, logout
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

## Auth Flow
1. App checks `/api/auth/status` → determines if auth is enabled and if admin exists
2. Auth disabled (no pool/jwtSecret on server): show Dashboard directly
3. Auth enabled, no admin: show register form (creates first admin account)
4. Auth enabled, admin exists: show login form
5. On login/register: token stored in localStorage + zustand
6. 401 from REST → `handleUnauthorized()` → `useAuthStore.logout()` → redirect to login
7. WS close code 4001 → same logout flow
8. Cross-tab sync via `storage` event listener
9. Logout button in header: POST `/api/auth/logout` + local cleanup

## Data Flow
1. `useWebSocket()` connects WS (with token in query string), pushes messages into stores
2. `useLogLoader()` fetches initial logs + handles filter changes via REST (with auth headers)
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
