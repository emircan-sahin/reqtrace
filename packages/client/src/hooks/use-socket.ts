import { useEffect, useRef, useState, useCallback } from 'react';
import type { RequestLog, RequestStart, WsMessage } from '../types';

const MAX_LOGS = 200;
const RECONNECT_BASE = 1000;
const RECONNECT_MAX = 30000;

export function useSocket(serverUrl: string) {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [pending, setPending] = useState<Map<string, RequestStart>>(new Map());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = RECONNECT_BASE;
    let disposed = false;

    function connect() {
      if (disposed) return;

      const wsUrl = serverUrl.replace(/^http/, 'ws').replace(/\/+$/, '') + '/ws';
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (disposed) { ws?.close(); return; }
        setConnected(true);
        reconnectDelay = RECONNECT_BASE;
      };

      ws.onclose = () => {
        ws = null;
        if (disposed) return;
        setConnected(false);
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
          reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX);
        }, reconnectDelay);
      };

      ws.onerror = () => {
        ws?.close();
      };

      ws.onmessage = (event) => {
        if (disposed) return;
        try {
          const msg: WsMessage = JSON.parse(event.data);

          if (msg.type === 'request_start') {
            setPending((prev) => new Map(prev).set(msg.id, msg));
          } else if (msg.type === 'request_end') {
            setPending((prev) => {
              const next = new Map(prev);
              next.delete(msg.id);
              return next;
            });
            const { type: _, ...log } = msg;
            setLogs((prev) => [...prev, log].slice(-MAX_LOGS));
          }
        } catch {
          // ignore malformed messages
        }
      };
    }

    // Load existing logs
    fetch(`${serverUrl.replace(/\/+$/, '')}/api/logs?limit=${MAX_LOGS}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data && !disposed) setLogs([...data.logs].reverse()); })
      .catch(() => {});

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [serverUrl]);

  const clear = useCallback(() => {
    setLogs([]);
    setPending(new Map());
  }, []);

  return { logs, pending, connected, clear };
}
