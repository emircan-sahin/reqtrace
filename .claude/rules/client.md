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
- @tanstack/react-virtual (virtual scrolling)
- lucide-react (icons)
- Vite

## Key Files
- `src/main.tsx` — Entry point (no StrictMode)
- `src/App.tsx` — Main layout (header, stats bar, log feed, project filter)
- `src/hooks/use-socket.ts` — WebSocket connection + REST pagination
- `src/hooks/use-stats.ts` — Client-side stats computation (useMemo from logs)
- `src/components/log-feed.tsx` — Virtual scrolled log list with infinite scroll
- `src/components/log-entry.tsx` — Log row + accordion detail panel + JSON tree-view
- `src/components/stats-bar.tsx` — Stats bar (total, success%, errors, avg, req/min)
- `src/components/project-filter.tsx` — Project dropdown filter
- `src/types.ts` — Client-side type definitions
- `src/index.css` — Tailwind import + dark scrollbar styles

## Features
- **Live feed**: WebSocket for realtime log updates
- **Virtual scrolling**: @tanstack/react-virtual, renders only visible rows
- **Infinite scroll**: Loads older pages (200 per page) on scroll up
- **Project filter**: Dropdown filters by project (server-side API + client-side WS)
- **Accordion detail**: Click row to expand Request/Response/Error tabs
- **JSON tree-view**: Recursive collapse/expand with syntax coloring
- **Auto-scroll**: Toggle button, scrolls to bottom on new logs
- **Action menu**: Resend, Copy Request, Copy as cURL, Copy Response
- **Stats bar**: Computed client-side from loaded logs (no polling)
- **Error highlighting**: Red background for 4xx/5xx/failed requests
- **Dark theme**: Custom scrollbar, brightness hover effects

## Data Flow
1. On load: fetch `GET /api/logs?limit=200` (+ project filter if set)
2. Connect WebSocket to `/ws` for realtime updates
3. New logs appended to bottom, pending entries shown with spinner
4. Scroll up triggers `loadMore()` → fetches next 200 older logs
5. Project change resets logs and re-fetches from API
6. Stats recomputed on every log change via useMemo

## Environment
- `VITE_SERVER_URL` — Server URL (default: http://localhost:3100)

## Build & Dev
```bash
pnpm --filter @reqtrace/client dev      # vite dev server
pnpm --filter @reqtrace/client build    # tsc + vite build
```
