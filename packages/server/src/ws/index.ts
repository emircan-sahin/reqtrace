import type { WebSocket } from 'ws';

export class BroadcastManager {
  private clients: Set<WebSocket> = new Set();

  addClient(socket: WebSocket): void {
    this.clients.add(socket);
    socket.on('close', () => this.clients.delete(socket));
    socket.on('error', () => this.clients.delete(socket));
  }

  broadcast(data: unknown): void {
    const msg = typeof data === 'string' ? data : JSON.stringify(data);
    for (const client of this.clients) {
      try {
        client.send(msg);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  get size(): number {
    return this.clients.size;
  }
}
