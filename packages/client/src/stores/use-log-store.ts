import { create } from 'zustand';
import type { LogSummary, RequestStart } from '@/types';

interface LogState {
  logs: LogSummary[];
  pending: Map<string, RequestStart>;
  hasMore: boolean;
  ready: boolean;
  setLogs: (logs: LogSummary[]) => void;
  appendLog: (log: LogSummary) => void;
  prependLogs: (older: LogSummary[]) => void;
  addPending: (entry: RequestStart) => void;
  removePending: (id: string) => void;
  setHasMore: (v: boolean) => void;
  setReady: (v: boolean) => void;
  clear: () => void;
  reset: () => void;
}

/** Hard ceiling on rows kept client-side. Live tail plus a few scrollback pages. */
export const MAX_CLIENT_LOGS = 1000;
/** In-flight requests waiting for their request_end. */
export const MAX_PENDING = 500;
/** A request_start with no matching end after this long is assumed lost. */
export const PENDING_TTL_MS = 60_000;

/** Drops in-flight entries whose request_end never arrived, then caps the map. */
export function prunePending(
  pending: Map<string, RequestStart>,
  now = Date.now(),
): Map<string, RequestStart> {
  let next: Map<string, RequestStart> | null = null;

  for (const [id, entry] of pending) {
    const age = now - Date.parse(entry.timestamp);
    if (Number.isFinite(age) && age > PENDING_TTL_MS) {
      if (!next) next = new Map(pending);
      next.delete(id);
    }
  }

  const result = next ?? pending;
  if (result.size <= MAX_PENDING) return result;

  // Oldest first: Map preserves insertion order.
  const trimmed = new Map(result);
  const excess = trimmed.size - MAX_PENDING;
  let dropped = 0;
  for (const id of trimmed.keys()) {
    if (dropped++ >= excess) break;
    trimmed.delete(id);
  }
  return trimmed;
}

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  pending: new Map(),
  hasMore: true,
  ready: false,

  setLogs: (logs) => set({ logs: logs.slice(-MAX_CLIENT_LOGS) }),
  appendLog: (log) => set((s) => {
    const next = [...s.logs, log];
    return { logs: next.length > MAX_CLIENT_LOGS ? next.slice(-MAX_CLIENT_LOGS) : next };
  }),
  // Scrollback: keep the oldest end, since that is what the user is looking at.
  prependLogs: (older) => set((s) => {
    const next = [...older, ...s.logs];
    return { logs: next.length > MAX_CLIENT_LOGS ? next.slice(0, MAX_CLIENT_LOGS) : next };
  }),
  addPending: (entry) => set((s) => {
    const next = new Map(s.pending);
    next.set(entry.id, entry);
    return { pending: prunePending(next) };
  }),
  removePending: (id) => set((s) => {
    const next = new Map(s.pending);
    next.delete(id);
    return { pending: next };
  }),
  setHasMore: (v) => set({ hasMore: v }),
  setReady: (v) => set({ ready: v }),
  clear: () => set({ logs: [], pending: new Map(), hasMore: false }),
  reset: () => set({ logs: [], pending: new Map(), hasMore: true, ready: false }),
}));
