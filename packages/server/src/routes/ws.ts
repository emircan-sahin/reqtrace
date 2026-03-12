import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { LogStore } from '../types.js';
import { WS_AUTH_FAILURE, type BroadcastManager } from '../ws/index.js';

interface WsRouteOptions {
  store: LogStore;
  broadcast: BroadcastManager;
  pool?: Pool;
  apiKey?: string;
}

export function wsRoute(opts: WsRouteOptions) {
  const { store, broadcast, pool, apiKey } = opts;
  const authEnabled = !!pool;

  return async function (fastify: FastifyInstance): Promise<void> {
    fastify.get('/ws', { websocket: true }, async (socket, request) => {
      const url = new URL(request.url, `http://${request.hostname}`);

      if (authEnabled) {
        const token = url.searchParams.get('token');
        const key = url.searchParams.get('apiKey');

        if (token) {
          try {
            const decoded = fastify.jwt.verify(token) as { email: string };
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
          // SDK client — valid API key, allow sending only
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
            const { request_headers, response_headers, request_body, response_body, ...summary } = log;
            broadcast.broadcast({ type: 'request_end', ...summary });
          }
        } catch (err) {
          if (err instanceof SyntaxError) return;
          console.error('[reqtrace] ws message error:', err);
        }
      });
    });
  };
}
