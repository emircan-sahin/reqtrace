import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import fastifyJwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { InMemoryStore } from './store/index.js';
import { BroadcastManager } from './ws/index.js';
import { healthRoutes } from './routes/health.js';
import { logsRoutes } from './routes/logs.js';
import { statsRoutes } from './routes/stats.js';
import { authRoutes } from './routes/auth.js';
import type { LogStore } from './types.js';
import type { Pool } from 'pg';

const WS_AUTH_FAILURE = 4001;
const TOKEN_CHECK_INTERVAL = 60_000;

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
  const authEnabled = !!(opts?.pool && opts?.jwtSecret);
  const apiKey = opts?.apiKey;
  const pool = opts?.pool;

  if (authEnabled) {
    await app.register(fastifyJwt, {
      secret: opts!.jwtSecret!,
      sign: { expiresIn: '7d' },
    });
    await app.register(rateLimit, { global: false });

    // REST middleware: verify JWT signature + check token matches DB
    app.addHook('onRequest', async (request, reply) => {
      if (
        request.url === '/health' ||
        request.url.startsWith('/api/auth/') ||
        request.url.startsWith('/ws')
      ) {
        return;
      }

      try {
        await request.jwtVerify();
        const { email } = request.user as { email: string };
        const authHeader = request.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');
        const result = await pool!.query('SELECT token FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0 || result.rows[0].token !== token) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
      } catch (err) {
        console.error('[reqtrace] auth middleware error:', err);
        return reply.code(401).send({ error: 'Unauthorized' });
      }
    });

    app.register(authRoutes(pool!), { prefix: '/api' });

    // Periodic WS token validation: check auth clients against DB
    const interval = setInterval(async () => {
      const authClients = broadcast.getAuthClients();
      if (authClients.size === 0) return;

      try {
        const result = await pool!.query('SELECT token FROM users');
        const validTokens = new Set(
          result.rows.map((r: { token: string | null }) => r.token).filter(Boolean),
        );

        for (const [socket, token] of authClients) {
          if (!validTokens.has(token)) {
            socket.close(WS_AUTH_FAILURE, 'Unauthorized');
          }
        }
      } catch (err) {
        console.error('[reqtrace] ws token check error:', err);
      }
    }, TOKEN_CHECK_INTERVAL);

    app.addHook('onClose', () => clearInterval(interval));
  }

  app.register(async (fastify) => {
    fastify.get('/ws', { websocket: true }, async (socket, request) => {
      const url = new URL(request.url, `http://${request.hostname}`);

      if (authEnabled) {
        const token = url.searchParams.get('token');
        const key = url.searchParams.get('apiKey');

        if (token) {
          // Dashboard client — verify JWT + check token matches DB
          try {
            const decoded = app.jwt.verify(token) as { email: string };
            const result = await pool!.query('SELECT token FROM users WHERE email = $1', [decoded.email]);
            if (result.rows.length === 0 || result.rows[0].token !== token) {
              socket.close(WS_AUTH_FAILURE, 'Unauthorized');
              return;
            }
            broadcast.addClient(socket, token);
          } catch (err) {
            console.error('[reqtrace] ws auth error:', err);
            socket.close(WS_AUTH_FAILURE, 'Unauthorized');
            return;
          }
        } else if (key && apiKey && key === apiKey) {
          // SDK client — valid API key, allow sending only (no broadcast)
        } else {
          socket.close(WS_AUTH_FAILURE, 'Unauthorized');
          return;
        }
      } else {
        broadcast.addClient(socket);
      }

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
        } catch (err) {
          if (err instanceof SyntaxError) return; // malformed JSON, ignore
          console.error('[reqtrace] ws message error:', err);
        }
      });
    });
  });

  app.register(healthRoutes);
  app.register(logsRoutes(store, broadcast), { prefix: '/api' });
  app.register(statsRoutes(store), { prefix: '/api' });

  return app;
}
