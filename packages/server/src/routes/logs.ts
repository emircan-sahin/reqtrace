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
      const { request_headers, response_headers, request_body, response_body, ...summary } = log;
      broadcast.broadcast({ type: 'request_end', ...summary });
      return reply.code(201).send({ ok: true });
    });

    app.get<{ Querystring: LogFilter }>('/logs', async (request) => {
      const q = request.query;

      const filter: LogFilter = {
        project: q.project,
        method: q.method,
        status: q.status !== undefined ? Number(q.status) : undefined,
        success: q.success !== undefined ? String(q.success) === 'true' : undefined,
        url: q.url,
        search: q.search,
        from: q.from,
        to: q.to,
        limit: q.limit !== undefined ? Number(q.limit) : undefined,
        offset: q.offset !== undefined ? Number(q.offset) : undefined,
      };

      return await store.list(filter);
    });

    app.get<{ Params: { id: string } }>('/logs/:id', async (request, reply) => {
      const log = await store.getById(request.params.id);
      if (!log) return reply.code(404).send({ error: 'Not found' });
      return log;
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
      const base = { id, project, url, method, proxy_host: null, proxy_port: null, request_headers: headers, request_body: body, timestamp };
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
          ...base,
          status: res.status,
          duration_ms: Math.round(performance.now() - start),
          response_size_bytes: new TextEncoder().encode(responseBody).length,
          response_headers: responseHeaders,
          response_body: responseBody,
          error_message: null,
          success: res.ok,
        };
      } catch (err) {
        log = {
          ...base,
          status: null,
          duration_ms: Math.round(performance.now() - start),
          response_size_bytes: null,
          response_headers: {},
          error_message: err instanceof Error ? err.message : String(err),
          success: false,
        };
      }

      await store.add(log);
      broadcast.broadcast({ type: 'request_end', ...log });
      return reply.code(200).send(log);
    });
  };
}
