import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { LogStore, RequestLog, LogFilter } from '../types.js';
import type { BroadcastManager } from '../ws/index.js';

interface ResendBody {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

export function logsRoutes(store: LogStore, broadcast: BroadcastManager) {
  return async function (app: FastifyInstance): Promise<void> {
    app.post<{ Body: RequestLog }>('/logs', async (request, reply) => {
      const log = request.body;
      await store.add(log);
      broadcast.broadcast({ type: 'request_end', ...log });
      return reply.code(201).send({ ok: true });
    });

    app.get<{ Querystring: LogFilter }>('/logs', async (request) => {
      const q = request.query;

      const filter: LogFilter = {
        project: q.project,
        method: q.method,
        status: q.status !== undefined ? Number(q.status) : undefined,
        success: q.success !== undefined ? q.success === true || q.success === ('true' as unknown) : undefined,
        url: q.url,
        search: q.search,
        from: q.from,
        to: q.to,
        limit: q.limit !== undefined ? Number(q.limit) : undefined,
        offset: q.offset !== undefined ? Number(q.offset) : undefined,
      };

      return await store.list(filter);
    });

    app.delete('/logs', async () => {
      await store.clear();
      return { ok: true };
    });

    app.get('/projects', async () => {
      return { projects: await store.projects() };
    });

    app.post<{ Body: ResendBody }>('/resend', async (request, reply) => {
      const { url, method, headers, body } = request.body;
      const id = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      const project = 'resend';

      broadcast.broadcast({ type: 'request_start', id, project, url, method, timestamp });

      const start = performance.now();
      let log: RequestLog;

      try {
        const res = await fetch(url, {
          method,
          headers,
          body: body ?? undefined,
        });

        const responseBody = await res.text();
        const responseHeaders: Record<string, string> = {};
        res.headers.forEach((v, k) => { responseHeaders[k] = v; });

        log = {
          id,
          project,
          url,
          method,
          status: res.status,
          duration_ms: Math.round(performance.now() - start),
          proxy_host: null,
          proxy_port: null,
          response_size_bytes: new TextEncoder().encode(responseBody).length,
          request_headers: headers,
          response_headers: responseHeaders,
          request_body: body,
          response_body: responseBody,
          error_message: null,
          success: res.ok,
          timestamp,
        };
      } catch (err) {
        log = {
          id,
          project,
          url,
          method,
          status: null,
          duration_ms: Math.round(performance.now() - start),
          proxy_host: null,
          proxy_port: null,
          response_size_bytes: null,
          request_headers: headers,
          response_headers: {},
          request_body: body,
          error_message: err instanceof Error ? err.message : String(err),
          success: false,
          timestamp,
        };
      }

      await store.add(log);
      broadcast.broadcast({ type: 'request_end', ...log });
      return reply.code(200).send(log);
    });
  };
}
