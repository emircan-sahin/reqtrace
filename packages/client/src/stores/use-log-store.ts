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

const MAX_CLIENT_LOGS = 200;

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
  prependLogs: (older) => set((s) => ({ logs: [...older, ...s.logs] })),
  addPending: (entry) => set((s) => {
    const next = new Map(s.pending);
    next.set(entry.id, entry);
    return { pending: next };
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
