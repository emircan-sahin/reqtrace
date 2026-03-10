import { useEffect, useRef, useState, useCallback } from 'react';
import type { RequestLog, RequestStart, WsMessage } from '../types';

const PAGE_SIZE = 200;
const RECONNECT_BASE = 1000;
const RECONNECT_MAX = 30000;

export function useSocket(serverUrl: string, project: string | null) {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [pending, setPending] = useState<Map<string, RequestStart>>(new Map());
  const [connected, setConnected] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [ready, setReady] = useState(false);
  const loadingRef = useRef(false);
  const baseUrl = serverUrl.replace(/\/+$/, '');

  // Reset and re-fetch when project changes
  useEffect(() => {
    setLogs([]);
    setPending(new Map());
    setHasMore(true);
    setReady(false);
    loadingRef.current = false;

    const projectParam = project ? `&project=${encodeURIComponent(project)}` : '';

    fetch(`${baseUrl}/api/logs?limit=${PAGE_SIZE}${projectParam}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          setLogs([...data.logs].reverse());
          setHasMore(data.logs.length >= PAGE_SIZE);
          setReady(true);
        }
      })
      .catch(() => {});
  }, [baseUrl, project]);

  // WebSocket connection (independent of project filter)
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
            setLogs((prev) => [...prev, log]);
          }
        } catch {
          // ignore malformed messages
        }
      };
    }

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [serverUrl]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore || !ready) return;
    loadingRef.current = true;

    try {
      const projectParam = project ? `&project=${encodeURIComponent(project)}` : '';
      const currentCount = logs.length;
      const res = await fetch(`${baseUrl}/api/logs?limit=${PAGE_SIZE}&offset=${currentCount}${projectParam}`);
      if (!res.ok) return;
      const data = await res.json();
      const older: RequestLog[] = [...data.logs].reverse();

      if (older.length === 0) {
        setHasMore(false);
        return;
      }

      setLogs((prev) => [...older, ...prev]);
      if (older.length < PAGE_SIZE) setHasMore(false);
    } catch {
      // ignore
    } finally {
      loadingRef.current = false;
    }
  }, [baseUrl, project, hasMore, ready, logs.length]);

  const clear = useCallback(() => {
    setLogs([]);
    setPending(new Map());
    setHasMore(false);
  }, []);

  return { logs, pending, connected, hasMore, loadMore, clear };
}
