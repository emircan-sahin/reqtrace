import { useEffect } from 'react';
import { WebSocketService } from '@/services/websocket';
import { useLogStore } from '@/stores/use-log-store';
import { useFilterStore } from '@/stores/use-filter-store';
import { useConnectionStore } from '@/stores/use-connection-store';
import type { WsMessage } from '@/types';

export function useWebSocket() {
  useEffect(() => {
    const service = new WebSocketService(
      (data) => {
        try {
          const msg: WsMessage = JSON.parse(data);

          if (msg.type === 'request_start') {
            useLogStore.getState().addPending(msg);
            useFilterStore.getState().addProject(msg.project);
          } else if (msg.type === 'request_end') {
            useLogStore.getState().removePending(msg.id);
            const { type: _, ...log } = msg;
            useLogStore.getState().appendLog(log);
            useFilterStore.getState().addProject(msg.project);
          }
        } catch {
          // ignore malformed messages
        }
      },
      (connected) => {
        useConnectionStore.getState().setConnected(connected);
      },
    );

    service.connect();
    return () => service.dispose();
  }, []);
}
