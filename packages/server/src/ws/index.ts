import type { WebSocket } from 'ws';

export const WS_AUTH_FAILURE = 4001;

export class BroadcastManager {
  private clients: Set<WebSocket> = new Set();
  private authClients: Map<WebSocket, string> = new Map();

  addClient(socket: WebSocket, token?: string): void {
    this.clients.add(socket);
    if (token) this.authClients.set(socket, token);
    socket.on('close', () => {
      this.clients.delete(socket);
      this.authClients.delete(socket);
    });
    socket.on('error', () => {
      this.clients.delete(socket);
      this.authClients.delete(socket);
    });
  }

  getAuthClients(): Map<WebSocket, string> {
    return this.authClients;
  }

  broadcast(data: unknown): void {
    const msg = typeof data === 'string' ? data : JSON.stringify(data);
    for (const client of this.clients) {
      try {
        client.send(msg);
      } catch {
        this.clients.delete(client);
        this.authClients.delete(client);
      }
    }
  }

  get size(): number {
    return this.clients.size;
  }
}
