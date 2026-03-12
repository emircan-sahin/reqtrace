import { BASE_URL } from './http';
import { useAuthStore } from '@/stores/use-auth-store';

const RECONNECT_BASE = 1000;
const RECONNECT_MAX = 30000;
const WS_AUTH_FAILURE = 4001;

export type WsMessageHandler = (data: string) => void;
export type WsStatusHandler = (connected: boolean) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = RECONNECT_BASE;
  private disposed = false;

  constructor(
    private onMessage: WsMessageHandler,
    private onStatusChange: WsStatusHandler,
  ) {}

  connect() {
    if (this.disposed) return;

    let wsUrl = BASE_URL.replace(/^http/, 'ws') + '/ws';
    const token = localStorage.getItem('reqtrace_token');
    if (token) wsUrl += `?token=${encodeURIComponent(token)}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      if (this.disposed) { this.ws?.close(); return; }
      this.onStatusChange(true);
      this.reconnectDelay = RECONNECT_BASE;
    };

    this.ws.onclose = (event) => {
      this.ws = null;
      if (this.disposed) return;
      this.onStatusChange(false);

      // Auth failure — logout, don't reconnect
      if (event.code === WS_AUTH_FAILURE) {
        useAuthStore.getState().logout();
        return;
      }

      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX);
      }, this.reconnectDelay);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };

    this.ws.onmessage = (event) => {
      if (this.disposed) return;
      this.onMessage(event.data);
    };
  }

  reconnect() {
    if (this.disposed) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectDelay = RECONNECT_BASE;
    // Detach old handlers before closing to prevent onclose from
    // nulling the new WS reference and scheduling a duplicate reconnect
    const old = this.ws;
    this.ws = null;
    if (old) {
      old.onclose = null;
      old.onerror = null;
      old.onmessage = null;
      old.close();
    }
    this.connect();
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  dispose() {
    this.disposed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}
