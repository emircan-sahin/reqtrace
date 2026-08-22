import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import type { LogStore, RequestLog, LogFilter } from '../types.js';
import type { BroadcastManager } from '../ws/index.js';
import { parseRequestLog } from '../schemas.js';

const MAX_PAGE_SIZE = 500;
const EXPORT_BATCH = 1_000;

function toHarHeaders(headers: Record<string, string> | undefined) {
  return Object.entries(headers ?? {}).map(([name, value]) => ({ name, value: String(value) }));
}

/** HAR 1.2 entry, so exports open in Charles, Proxyman, HTTP Toolkit or DevTools. */
function toHarEntry(log: RequestLog) {
  return {
    startedDateTime: log.timestamp,
    time: log.duration_ms,
    request: {
      method: log.method,
      url: log.url,
      httpVersion: 'HTTP/1.1',
      cookies: [],
      headers: toHarHeaders(log.request_headers),
      queryString: [],
      headersSize: -1,
      bodySize: log.request_body ? Buffer.byteLength(log.request_body) : 0,
      ...(log.request_body
        ? { postData: { mimeType: log.request_headers?.['content-type'] ?? 'text/plain', text: log.request_body } }
        : {}),
    },
    response: {
      status: log.status ?? 0,
      statusText: log.error_message ?? '',
      httpVersion: 'HTTP/1.1',
      cookies: [],
      headers: toHarHeaders(log.response_headers),
      content: {
        size: log.response_size_bytes ?? 0,
        mimeType: log.response_headers?.['content-type'] ?? 'text/plain',
        text: log.response_body ?? '',
      },
      redirectURL: '',
      headersSize: -1,
      bodySize: log.response_size_bytes ?? 0,
    },
    cache: {},
    timings: { send: 0, wait: log.duration_ms, receive: 0 },
    comment: JSON.stringify({
      project: log.project,
      proxy: log.proxy_host ? `${log.proxy_host}${log.proxy_port !== null ? `:${log.proxy_port}` : ''}` : null,
      success: log.success,
      error: log.error_message,
    }),
  };
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(Math.max(1, Math.floor(value)), MAX_PAGE_SIZE);
}

interface ResendBody {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

export function logsRoutes(store: LogStore, broadcast: BroadcastManager) {
  return async function (app: FastifyInstance): Promise<void> {
    app.post<{ Body: RequestLog }>('/logs', async (request, reply) => {
      const log = parseRequestLog(request.body);
      if (!log) return reply.code(400).send({ error: 'Invalid log payload' });
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
        statusRange: q.statusRange !== undefined ? Number(q.statusRange) : undefined,
        success: q.success !== undefined ? String(q.success) === 'true' : undefined,
        proxy: q.proxy,
        host: q.host,
        url: q.url,
        search: q.search,
        from: q.from,
        to: q.to,
        limit: q.limit !== undefined ? clampLimit(Number(q.limit)) : undefined,
        offset: q.offset !== undefined ? Math.max(0, Number(q.offset) || 0) : undefined,
        cursor: q.cursor,
      };

      return await store.list(filter);
    });

    app.get<{ Params: { id: string } }>('/logs/:id', async (request, reply) => {
      const log = await store.getById(request.params.id);
      if (!log) return reply.code(404).send({ error: 'Not found' });
      return log;
    });

    app.delete<{ Querystring: { project?: string; before?: string } }>('/logs', async (request) => {
      const { project, before } = request.query;
      const deleted = await store.clear(project || before ? { project, before } : undefined);
      broadcast.broadcast({ type: 'logs_cleared', project: project ?? null });
      return { ok: true, deleted };
    });

    /**
     * Streams every matching log, paged by cursor. Never materializes the whole
     * result set — an unfiltered export can be millions of rows.
     */
    app.get<{ Querystring: LogFilter & { format?: string } }>('/logs/export', async (request, reply) => {
      const q = request.query;
      const format = q.format === 'har' ? 'har' : 'ndjson';
      const base: LogFilter = {
        project: q.project,
        method: q.method,
        status: q.status !== undefined ? Number(q.status) : undefined,
        statusRange: q.statusRange !== undefined ? Number(q.statusRange) : undefined,
        success: q.success !== undefined ? String(q.success) === 'true' : undefined,
        proxy: q.proxy,
        host: q.host,
        url: q.url,
        search: q.search,
        from: q.from,
        to: q.to,
        limit: EXPORT_BATCH,
      };

      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const extension = format === 'har' ? 'har' : 'ndjson';

      reply
        .header('content-type', format === 'har' ? 'application/json' : 'application/x-ndjson')
        .header('content-disposition', `attachment; filename="reqtrace-${stamp}.${extension}"`);

      async function* generate(): AsyncGenerator<string> {
        if (format === 'har') {
          yield '{"log":{"version":"1.2","creator":{"name":"reqtrace","version":"0.1.0"},"entries":[';
        }

        let cursor: string | undefined;
        let first = true;

        for (;;) {
          const page = await store.listFull({ ...base, cursor });
          if (page.length === 0) break;

          for (const log of page) {
            const line = format === 'har' ? JSON.stringify(toHarEntry(log)) : JSON.stringify(log);
            if (format === 'har') {
              yield first ? line : `,${line}`;
            } else {
              yield `${line}\n`;
            }
            first = false;
          }

          const last = page[page.length - 1];
          cursor = Buffer.from(`${last.timestamp}|${last.id}`).toString('base64');
          if (page.length < EXPORT_BATCH) break;
        }

        if (format === 'har') yield ']}}';
      }

      return reply.send(Readable.from(generate()));
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
          // Must match the SDK's definition (2xx-3xx), or replaying a 302
          // flips it from success to error and skews every chart.
          success: res.status >= 200 && res.status < 400,
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
