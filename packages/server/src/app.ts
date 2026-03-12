import { existsSync } from 'fs';
import { join } from 'path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
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

  const publicDir = join(process.cwd(), 'public');
  if (existsSync(publicDir)) {
    await app.register(fastifyStatic, { root: publicDir });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/') || req.url.startsWith('/ws')) {
        reply.code(404).send({ error: 'Not Found' });
      } else {
        reply.sendFile('index.html');
      }
    });
  }

  return app;
}
