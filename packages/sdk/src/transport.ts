import WebSocket from 'ws';
import type { RequestLog, RequestStart } from './types.js';

const MAX_BUFFER = 100;
const MAX_RECONNECT_DELAY = 30_000;
/** Server closes with this code when the API key or token is rejected. */
const WS_AUTH_FAILURE = 4001;
/**
 * A socket can stay OPEN while the peer stops reading (half-open TCP, stalled
 * consumer); ws then queues every frame in this process's heap. Past this much
 * queued data, drop instead of growing without bound.
 */
const MAX_BUFFERED_BYTES = 4 * 1024 * 1024;

export interface WsTransport {
  sendStart(start: RequestStart): void;
  sendEnd(log: RequestLog): void;
  close(): void;
  /** Messages dropped because the socket was backed up or the buffer was full. */
  readonly droppedCount: number;
}

export function createWsTransport(serverUrl: string, apiKey?: string): WsTransport {
  let wsUrl = serverUrl.replace(/^http/, 'ws').replace(/\/+$/, '') + '/ws';
  if (apiKey) wsUrl += `?apiKey=${encodeURIComponent(apiKey)}`;

  let ws: WebSocket | null = null;
  let reconnectDelay = 1000;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  let dropped = 0;
  const buffer: string[] = [];

  function connect(): void {
    if (closed) return;

    try {
      ws = new WebSocket(wsUrl, { perMessageDeflate: false });

      ws.on('open', () => {
        reconnectDelay = 1000;
        flush();
      });

      ws.on('close', (code: number) => {
        ws = null;
        if (code === WS_AUTH_FAILURE) {
          // Retrying cannot help — the credentials are wrong. Reconnecting
          // forever would hammer the server from every SDK instance.
          closed = true;
          console.error('[reqtrace] websocket rejected: invalid API key, monitoring disabled');
          return;
        }
        scheduleReconnect();
      });

      ws.on('error', () => {
        // close event follows, reconnect happens there
      });

      // Never keep the host process alive just because monitoring is connected.
      const socket = (ws as unknown as { _socket?: { unref?: () => void } })._socket;
      socket?.unref?.();
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
    reconnectTimer.unref?.();
  }

  function flush(): void {
    while (buffer.length > 0 && ws?.readyState === WebSocket.OPEN) {
      if (ws.bufferedAmount > MAX_BUFFERED_BYTES) break;
      ws.send(buffer.shift()!);
    }
  }

  function send(data: string): void {
    if (ws?.readyState === WebSocket.OPEN) {
      if (ws.bufferedAmount > MAX_BUFFERED_BYTES) {
        dropped++;
        return;
      }
      ws.send(data);
    } else {
      if (buffer.length >= MAX_BUFFER) {
        buffer.shift();
        dropped++;
      }
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
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      buffer.length = 0;
      if (ws) ws.close();
      ws = null;
    },
    get droppedCount(): number {
      return dropped;
    },
  };
}
