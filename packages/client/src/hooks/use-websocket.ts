import { useEffect } from 'react';
import { WebSocketService } from '@/services/websocket';
import { get } from '@/services/http';
import { useLogStore, prunePending, MAX_CLIENT_LOGS } from '@/stores/use-log-store';
import { matchesLog, matchesPending } from '@/lib/log-filter';
import { logPageParams } from './use-log-loader';
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
          if (nextLogs.length > MAX_CLIENT_LOGS) {
            nextLogs = nextLogs.slice(-MAX_CLIENT_LOGS);
          }
        }
        // Entries whose request_end was lost (dropped buffer, reconnect gap,
        // dead SDK) would otherwise spin in the feed forever.
        return { logs: nextLogs, pending: prunePending(nextPending) };
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
            // The project list must learn about every project, even filtered-out ones.
            pendingProjects.add(msg.project);
            // Filter at ingest: an unfiltered live row would otherwise push a
            // matching row out of the bounded window and empty a filtered feed.
            if (!matchesPending(msg, useFilterStore.getState())) return;
            pendingAdds.push(msg);
            if (pendingAdds.length > MAX_BUFFER) pendingAdds = pendingAdds.slice(-MAX_BUFFER);
          } else if (msg.type === 'logs_cleared') {
            pendingAdds = [];
            pendingRemoveIds = [];
            pendingLogs = [];
            useLogStore.getState().reset();
            useFilterStore.getState().setProjects([]);
            useConnectionStore.getState().bumpDataEpoch();
          } else if (msg.type === 'request_end') {
            pendingRemoveIds.push(msg.id);
            if (pendingRemoveIds.length > MAX_BUFFER) pendingRemoveIds = pendingRemoveIds.slice(-MAX_BUFFER);
            const { type: _, ...log } = msg;
            pendingProjects.add(msg.project);
            if (!matchesLog(log, useFilterStore.getState())) return;
            pendingLogs.push(log);
            if (pendingLogs.length > MAX_BUFFER) pendingLogs = pendingLogs.slice(-MAX_BUFFER);
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
      // Same params as the loader — this used to forget statusRange/proxy/mode
      // and repopulate a filtered feed from an unfiltered query.
      const params = logPageParams();

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
      service.dispose();
    };
  }, []);
}
