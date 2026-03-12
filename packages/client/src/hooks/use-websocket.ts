import { useEffect } from 'react';
import { WebSocketService } from '@/services/websocket';
import { get } from '@/services/http';
import { useLogStore } from '@/stores/use-log-store';
import { useFilterStore } from '@/stores/use-filter-store';
import { useConnectionStore } from '@/stores/use-connection-store';
import type { LogSummary, RequestStart, WsMessage } from '@/types';

const FLUSH_INTERVAL = 500;
const MAX_BUFFER = 200;

export function useWebSocket() {
  useEffect(() => {
    let pendingAdds: RequestStart[] = [];
    let pendingRemoveIds: string[] = [];
    let pendingLogs: LogSummary[] = [];
    let pendingProjects = new Set<string>();
    let timer: ReturnType<typeof setInterval> | null = null;

    function flush() {
      const { hoverPaused, manualPaused } = useConnectionStore.getState();
      if (hoverPaused || manualPaused) return;
      if (
        pendingAdds.length === 0 &&
        pendingRemoveIds.length === 0 &&
        pendingLogs.length === 0 &&
        pendingProjects.size === 0
      ) return;

      const adds = pendingAdds;
      const removeIds = pendingRemoveIds;
      const logs = pendingLogs;
      const projects = pendingProjects;

      pendingAdds = [];
      pendingRemoveIds = [];
      pendingLogs = [];
      pendingProjects = new Set();

      const logStore = useLogStore.getState();
      const filterStore = useFilterStore.getState();

      // Single batched store update
      useLogStore.setState((s) => {
        const nextPending = new Map(s.pending);
        for (const entry of adds) {
          nextPending.set(entry.id, entry);
        }
        for (const id of removeIds) {
          nextPending.delete(id);
        }
        let nextLogs = s.logs;
        if (logs.length > 0) {
          nextLogs = [...s.logs, ...logs];
          if (nextLogs.length > 200) {
            nextLogs = nextLogs.slice(-200);
          }
        }
        return { logs: nextLogs, pending: nextPending };
      });

      if (projects.size > 0) {
        for (const p of projects) {
          filterStore.addProject(p);
        }
      }
    }

    const service = new WebSocketService(
      (data) => {
        try {
          const msg: WsMessage = JSON.parse(data);

          if (msg.type === 'request_start') {
            pendingAdds.push(msg);
            if (pendingAdds.length > MAX_BUFFER) pendingAdds = pendingAdds.slice(-MAX_BUFFER);
            pendingProjects.add(msg.project);
          } else if (msg.type === 'request_end') {
            pendingRemoveIds.push(msg.id);
            const { type: _, ...log } = msg;
            pendingLogs.push(log);
            if (pendingLogs.length > MAX_BUFFER) pendingLogs = pendingLogs.slice(-MAX_BUFFER);
            pendingProjects.add(msg.project);
          }
        } catch {
          // ignore malformed messages
        }
      },
      (connected) => {
        useConnectionStore.getState().setConnected(connected);
      },
    );

    timer = setInterval(flush, FLUSH_INTERVAL);
    service.connect();

    let hiddenAt = 0;
    const STALE_THRESHOLD = 30_000; // 30 seconds

    function refreshLogs() {
      const { selectedProject, search } = useFilterStore.getState();
      const params: Record<string, string | number> = { limit: 200 };
      if (selectedProject) params.project = selectedProject;
      if (search) params.search = search;

      get<{ logs: LogSummary[] }>('/api/logs', params)
        .then((data) => {
          const store = useLogStore.getState();
          store.setLogs([...data.logs].reverse());
          store.setHasMore(data.logs.length >= 200);
          useLogStore.setState({ pending: new Map() });
          useConnectionStore.getState().setStale(false);
        })
        .catch(() => {});
    }

    function handleVisibility() {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      if (document.visibilityState !== 'visible') return;

      const elapsed = hiddenAt ? Date.now() - hiddenAt : 0;
      hiddenAt = 0;

      // Only reconnect WS if actually dead
      if (!service.isConnected()) service.reconnect();

      if (elapsed < STALE_THRESHOLD) return;

      const { manualPaused, hoverPaused } = useConnectionStore.getState();
      if (manualPaused || hoverPaused) {
        // Mark as stale, refresh will happen on resume
        useConnectionStore.getState().setStale(true);
        return;
      }

      refreshLogs();
    }

    // Refresh stale data when unpaused
    const unsubPause = useConnectionStore.subscribe((state, prev) => {
      const wasPaused = prev.manualPaused || prev.hoverPaused;
      const isPaused = state.manualPaused || state.hoverPaused;
      if (wasPaused && !isPaused && state.stale) {
        refreshLogs();
      }
    });

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      unsubPause();
      if (timer) clearInterval(timer);
      flush();
      service.dispose();
    };
  }, []);
}
