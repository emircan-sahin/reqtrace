import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { authRoutes } from '../routes/auth.js';
import { WS_AUTH_FAILURE, type BroadcastManager } from '../ws/index.js';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

const TOKEN_CHECK_INTERVAL = 60_000;

export interface AuthPluginOptions {
  pool: Pool;
  jwtSecret: string;
  apiKey?: string;
  broadcast: BroadcastManager;
}

export const authPlugin = fp(async (app: FastifyInstance, opts: AuthPluginOptions) => {
  const { pool, jwtSecret, apiKey, broadcast } = opts;

  await app.register(fastifyJwt, {
    secret: jwtSecret,
    sign: { expiresIn: '7d' },
  });
  await app.register(rateLimit, {
    max: 50,
    timeWindow: '1 minute',
    allowList: ['/health', '/ws'],
  });

  // REST hook: verify JWT signature + check token matches DB
  app.addHook('onRequest', async (request, reply) => {
    if (
      request.url === '/health' ||
      request.url.startsWith('/api/auth/') ||
      request.url.startsWith('/ws') ||
      !request.url.startsWith('/api/')
    ) {
      return;
    }

    try {
      await request.jwtVerify();
      const { email } = request.user as { email: string };
      const authHeader = request.headers.authorization;
      const token = authHeader?.split(' ')[1];
      const result = await pool.query('SELECT token FROM users WHERE email = $1', [email]);
      if (result.rows.length === 0 || result.rows[0].token !== token) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
    } catch (err) {
      console.error('[reqtrace] auth middleware error:', err);
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  app.register(authRoutes(pool), { prefix: '/api' });

  // Periodic WS token validation: check auth clients against DB
  const interval = setInterval(async () => {
    const authClients = broadcast.getAuthClients();
    if (authClients.size === 0) return;

    try {
      const result = await pool.query('SELECT token FROM users');
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
});
