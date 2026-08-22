import type { WebSocket } from 'ws';

export const WS_AUTH_FAILURE = 4001;

/** WebSocket.OPEN — inlined so `ws` stays a type-only import. */
const READY_STATE_OPEN = 1;

const HEARTBEAT_INTERVAL = 30_000;
/** A client this far behind is not draining; dropping it protects server memory. */
const MAX_BUFFERED_BYTES = 8 * 1024 * 1024;

interface TrackedSocket extends WebSocket {
  isAlive?: boolean;
}

export class BroadcastManager {
  private clients: Set<TrackedSocket> = new Set();
  private authClients: Map<WebSocket, string> = new Map();
  private heartbeat: ReturnType<typeof setInterval> | null = null;

  addClient(socket: WebSocket, token?: string): void {
    const tracked = socket as TrackedSocket;
    tracked.isAlive = true;
    this.clients.add(tracked);
    if (token) this.authClients.set(socket, token);

    tracked.on('pong', () => { tracked.isAlive = true; });
    socket.on('close', () => this.removeClient(tracked));
    socket.on('error', () => this.removeClient(tracked));

    if (!this.heartbeat) this.startHeartbeat();
  }

  private removeClient(socket: TrackedSocket): void {
    this.clients.delete(socket);
    this.authClients.delete(socket);
    if (this.clients.size === 0) this.stopHeartbeat();
  }

  private startHeartbeat(): void {
    this.heartbeat = setInterval(() => {
      for (const client of this.clients) {
        // No pong since the last tick — the peer is gone (closed laptop, dead
        // NAT entry); without this the socket never fires 'close' and leaks.
        if (client.isAlive === false) {
          this.removeClient(client);
          client.terminate();
          continue;
        }
        client.isAlive = false;
        try {
          client.ping();
        } catch {
          this.removeClient(client);
        }
      }
    }, HEARTBEAT_INTERVAL);
    this.heartbeat.unref?.();
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
  }

  getAuthClients(): Map<WebSocket, string> {
    return this.authClients;
  }

  broadcast(data: unknown): void {
    if (this.clients.size === 0) return;
    const msg = typeof data === 'string' ? data : JSON.stringify(data);

    for (const client of this.clients) {
      if (client.readyState !== READY_STATE_OPEN) {
        this.removeClient(client);
        continue;
      }
      if (client.bufferedAmount > MAX_BUFFERED_BYTES) {
        // Slow consumer: its outbound queue lives in this process's heap.
        this.removeClient(client);
        client.terminate();
        continue;
      }
      try {
        client.send(msg);
      } catch {
        this.removeClient(client);
      }
    }
  }

  close(): void {
    this.stopHeartbeat();
    this.clients.clear();
    this.authClients.clear();
  }

  get size(): number {
    return this.clients.size;
  }
}
