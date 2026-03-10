import WebSocket from 'ws';
import type { RequestLog, RequestStart } from './types.js';

const MAX_BUFFER = 100;
const MAX_RECONNECT_DELAY = 30_000;

export interface WsTransport {
  sendStart(start: RequestStart): void;
  sendEnd(log: RequestLog): void;
  close(): void;
}

export function createWsTransport(serverUrl: string): WsTransport {
  const wsUrl = serverUrl.replace(/^http/, 'ws').replace(/\/+$/, '') + '/ws';

  let ws: WebSocket | null = null;
  let reconnectDelay = 1000;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  const buffer: string[] = [];

  function connect(): void {
    if (closed) return;

    try {
      ws = new WebSocket(wsUrl);

      ws.on('open', () => {
        reconnectDelay = 1000;
        flush();
      });

      ws.on('close', () => {
        ws = null;
        scheduleReconnect();
      });

      ws.on('error', () => {
        // close event follows, reconnect happens there
      });
    } catch {
      scheduleReconnect();
    }
  }

  function scheduleReconnect(): void {
    if (closed || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    }, reconnectDelay);
  }

  function flush(): void {
    while (buffer.length > 0 && ws?.readyState === WebSocket.OPEN) {
      ws.send(buffer.shift()!);
    }
  }

  function send(data: string): void {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(data);
    } else {
      if (buffer.length >= MAX_BUFFER) buffer.shift();
      buffer.push(data);
    }
  }

  connect();

  return {
    sendStart(start: RequestStart): void {
      send(JSON.stringify({ type: 'request_start', ...start }));
    },
    sendEnd(log: RequestLog): void {
      send(JSON.stringify({ type: 'request_end', ...log }));
    },
    close(): void {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    },
  };
}
