import type { FastifyInstance } from 'fastify';
import type { LogStore, RequestLog, LogFilter } from '../types.js';
import type { BroadcastManager } from '../ws/index.js';

export function logsRoutes(store: LogStore, broadcast: BroadcastManager) {
  return async function (app: FastifyInstance): Promise<void> {
    app.post<{ Body: RequestLog }>('/logs', async (request, reply) => {
      const log = request.body;
      store.add(log);
      broadcast.broadcast({ type: 'request_end', ...log });
      return reply.code(201).send({ ok: true });
    });

    app.get<{ Querystring: LogFilter }>('/logs', async (request) => {
      const q = request.query;

      const filter: LogFilter = {
        method: q.method,
        status: q.status !== undefined ? Number(q.status) : undefined,
        success: q.success !== undefined ? q.success === true || q.success === ('true' as unknown) : undefined,
        url: q.url,
        from: q.from,
        to: q.to,
        limit: q.limit !== undefined ? Number(q.limit) : undefined,
        offset: q.offset !== undefined ? Number(q.offset) : undefined,
      };

      return store.list(filter);
    });
  };
}
