import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { InMemoryStore } from './store/index.js';
import { BroadcastManager } from './ws/index.js';
import { healthRoutes } from './routes/health.js';
import { logsRoutes } from './routes/logs.js';
import { statsRoutes } from './routes/stats.js';
import type { LogStore } from './types.js';

export async function createApp(opts?: { logger?: boolean; store?: LogStore }) {
  const app = Fastify({ logger: opts?.logger ?? false });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  const store = opts?.store ?? new InMemoryStore();
  const broadcast = new BroadcastManager();

  app.register(async (fastify) => {
    fastify.get('/ws', { websocket: true }, (socket) => {
      broadcast.addClient(socket);

      socket.on('message', async (raw) => {
        try {
          const msg = JSON.parse(raw.toString());

          if (msg.type === 'request_start') {
            broadcast.broadcast(msg);
          } else if (msg.type === 'request_end') {
            const { type: _, ...log } = msg;
            await store.add(log);
            broadcast.broadcast(msg);
          }
        } catch {
          // ignore malformed messages
        }
      });
    });
  });

  app.register(healthRoutes);
  app.register(logsRoutes(store, broadcast), { prefix: '/api' });
  app.register(statsRoutes(store), { prefix: '/api' });

  return app;
}
