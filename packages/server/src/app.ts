import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { InMemoryStore } from './store/index.js';
import { BroadcastManager } from './ws/index.js';
import { authPlugin } from './plugins/auth.js';
import { healthRoutes } from './routes/health.js';
import { logsRoutes } from './routes/logs.js';
import { statsRoutes } from './routes/stats.js';
import { wsRoute } from './routes/ws.js';
import type { LogStore } from './types.js';
import type { Pool } from 'pg';

interface AppOptions {
  logger?: boolean;
  store?: LogStore;
  pool?: Pool;
  jwtSecret?: string;
  apiKey?: string;
}

export async function createApp(opts?: AppOptions) {
  const app = Fastify({ logger: opts?.logger ?? false });

  await app.register(cors, { origin: true, methods: ['GET', 'POST', 'DELETE', 'OPTIONS'] });
  await app.register(websocket);

  const store = opts?.store ?? new InMemoryStore();
  const broadcast = new BroadcastManager();
  const pool = opts?.pool;
  const apiKey = opts?.apiKey;

  if (pool && opts?.jwtSecret) {
    await app.register(authPlugin, {
      pool,
      jwtSecret: opts.jwtSecret,
      apiKey,
      broadcast,
    });
  }

  app.register(wsRoute({ store, broadcast, pool, apiKey }));
  app.register(healthRoutes);
  app.register(logsRoutes(store, broadcast), { prefix: '/api' });
  app.register(statsRoutes(store), { prefix: '/api' });

  return app;
}
