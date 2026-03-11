import { BASE_URL } from './http';

const RECONNECT_BASE = 1000;
const RECONNECT_MAX = 30000;

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

    const wsUrl = BASE_URL.replace(/^http/, 'ws') + '/ws';
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      if (this.disposed) { this.ws?.close(); return; }
      this.onStatusChange(true);
      this.reconnectDelay = RECONNECT_BASE;
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (this.disposed) return;
      this.onStatusChange(false);
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

  dispose() {
    this.disposed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}
