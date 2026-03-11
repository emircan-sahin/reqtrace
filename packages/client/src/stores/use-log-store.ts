import { create } from 'zustand';
import type { RequestLog, RequestStart } from '@/types';

interface LogState {
  logs: RequestLog[];
  pending: Map<string, RequestStart>;
  hasMore: boolean;
  ready: boolean;
  setLogs: (logs: RequestLog[]) => void;
  appendLog: (log: RequestLog) => void;
  prependLogs: (older: RequestLog[]) => void;
  addPending: (entry: RequestStart) => void;
  removePending: (id: string) => void;
  setHasMore: (v: boolean) => void;
  setReady: (v: boolean) => void;
  clear: () => void;
  reset: () => void;
}

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  pending: new Map(),
  hasMore: true,
  ready: false,

  setLogs: (logs) => set({ logs }),
  appendLog: (log) => set((s) => ({ logs: [...s.logs, log] })),
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
