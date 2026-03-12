import { useEffect } from 'react';
import { WebSocketService } from '@/services/websocket';
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

    return () => {
      if (timer) clearInterval(timer);
      flush();
      service.dispose();
    };
  }, []);
}
