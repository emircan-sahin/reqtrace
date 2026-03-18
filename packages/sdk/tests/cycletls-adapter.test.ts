import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CycleTLSClient, CycleTLSResponse, CycleTLSRequestOptions } from 'cycletls';
import { CycleTlsAdapter } from '../src/adapters/cycletls';
import { ReqtraceCore } from '../src/core';
import type { RequestLog } from '../src/types';

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace', 'connect'] as const;

function createMockClient(): CycleTLSClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    head: vi.fn(),
    options: vi.fn(),
    trace: vi.fn(),
    connect: vi.fn(),
    ws: vi.fn(),
    webSocket: vi.fn(),
    sse: vi.fn(),
    eventSource: vi.fn(),
    exit: vi.fn(),
  } as unknown as CycleTLSClient;
}

function createMockResponse(data: unknown = { ok: true }, status = 200): CycleTLSResponse {
  const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
  return {
    status,
    data,
    headers: { 'content-type': 'application/json', 'content-length': '10' },
    finalUrl: '',
    json: async () => data,
    text: async () => dataStr,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob([]),
  };
}

function mockSuccess(client: CycleTLSClient, data: unknown = { ok: true }, status = 200) {
  const response = createMockResponse(data, status);
  for (const method of HTTP_METHODS) {
    (client as any)[method] = vi.fn(async () => response);
  }
}

function mockError(client: CycleTLSClient, message = 'Network Error') {
  for (const method of HTTP_METHODS) {
    (client as any)[method] = vi.fn(async () => {
      throw new Error(message);
    });
  }
}

// Wait for setImmediate callbacks (deferred log dispatch) to flush
const tick = () => new Promise(resolve => setImmediate(resolve));

describe('CycleTlsAdapter', () => {
  let client: CycleTLSClient;
  let handler: ReturnType<typeof vi.fn>;
  let core: ReqtraceCore;
  let adapter: CycleTlsAdapter;
  let logs: RequestLog[];

  beforeEach(() => {
    client = createMockClient();
    logs = [];
    handler = vi.fn((log: RequestLog) => logs.push(log));
    core = new ReqtraceCore({}, handler);
    adapter = new CycleTlsAdapter(client, core);
  });

  describe('successful requests', () => {
    it('logs a successful GET request', async () => {
      mockSuccess(client);
      adapter.install();

      await client.get('https://api.example.com/data', { headers: {} });
      await tick();

      expect(handler).toHaveBeenCalledOnce();
      const log = logs[0];
      expect(log.url).toBe('https://api.example.com/data');
      expect(log.method).toBe('GET');
      expect(log.status).toBe(200);
      expect(log.success).toBe(true);
      expect(log.error_message).toBeNull();
      expect(log.duration_ms).toBeGreaterThanOrEqual(0);
      expect(log.timestamp).toBeDefined();
    });

    it('logs a POST request', async () => {
      mockSuccess(client, { created: true }, 201);
      adapter.install();

      await client.post('https://api.example.com/items', {
        headers: {},
        body: JSON.stringify({ name: 'test' }),
      });
      await tick();

      const log = logs[0];
      expect(log.method).toBe('POST');
      expect(log.status).toBe(201);
      expect(log.success).toBe(true);
    });

    it('captures response size from content-length', async () => {
      mockSuccess(client);
      adapter.install();

      await client.get('https://api.example.com/data', { headers: {} });
      await tick();

      expect(logs[0].response_size_bytes).toBe(10);
    });

    it('captures request and response headers', async () => {
      mockSuccess(client);
      adapter.install();

      await client.get('https://api.example.com/data', {
        headers: { 'X-Custom': 'test-value' },
      });
      await tick();

      const log = logs[0];
      expect(log.request_headers['X-Custom']).toBe('test-value');
      expect(log.response_headers['content-type']).toBe('application/json');
    });

    it('handles all HTTP methods', async () => {
      mockSuccess(client);
      adapter.install();

      for (const method of HTTP_METHODS) {
        await (client[method] as any)(`https://example.com/${method}`, { headers: {} });
      }
      await tick();

      expect(handler).toHaveBeenCalledTimes(HTTP_METHODS.length);
      const methods = logs.map(l => l.method);
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
      expect(methods).toContain('PUT');
      expect(methods).toContain('DELETE');
      expect(methods).toContain('PATCH');
      expect(methods).toContain('HEAD');
      expect(methods).toContain('OPTIONS');
      expect(methods).toContain('TRACE');
      expect(methods).toContain('CONNECT');
    });

    it('handles string data responses', async () => {
      mockSuccess(client, 'plain text response');
      adapter.install();

      await client.get('https://example.com', { headers: {} });
      await tick();

      const log = logs[0];
      expect(log.response_body).toContain('plain text response');
    });
  });

  describe('error handling', () => {
    it('logs network errors with success=false', async () => {
      mockError(client, 'ECONNREFUSED');
      adapter.install();

      await expect(client.get('https://api.example.com/data', { headers: {} })).rejects.toThrow();
      await tick();

      expect(handler).toHaveBeenCalledOnce();
      const log = logs[0];
      expect(log.success).toBe(false);
      expect(log.status).toBeNull();
      expect(log.error_message).toBe('ECONNREFUSED');
    });

    it('does not swallow errors', async () => {
      mockError(client, 'Network Error');
      adapter.install();

      await expect(
        client.get('https://example.com', { headers: {} }),
      ).rejects.toThrow('Network Error');
    });
  });

  describe('eject', () => {
    it('stops logging after eject', async () => {
      mockSuccess(client);
      adapter.install();

      await client.get('https://example.com/1', { headers: {} });
      await tick();
      expect(handler).toHaveBeenCalledTimes(1);

      adapter.eject();

      await client.get('https://example.com/2', { headers: {} });
      await tick();
      expect(handler).toHaveBeenCalledTimes(1); // no new log
    });
  });

  describe('proxy info', () => {
    it('extracts proxy host and port from options', async () => {
      mockSuccess(client);
      adapter.install();

      await client.get('https://example.com', {
        headers: {},
        proxy: 'http://127.0.0.1:8080',
      });
      await tick();

      const log = logs[0];
      expect(log.proxy_host).toBe('127.0.0.1');
      expect(log.proxy_port).toBe(8080);
    });

    it('extracts proxy with auth from options', async () => {
      mockSuccess(client);
      adapter.install();

      await client.get('https://example.com', {
        headers: {},
        proxy: 'http://user:pass@10.0.0.1:3128',
      });
      await tick();

      const log = logs[0];
      expect(log.proxy_host).toBe('10.0.0.1');
      expect(log.proxy_port).toBe(3128);
    });

    it('sets proxy to null when not used', async () => {
      mockSuccess(client);
      adapter.install();

      await client.get('https://example.com', { headers: {} });
      await tick();

      const log = logs[0];
      expect(log.proxy_host).toBeNull();
      expect(log.proxy_port).toBeNull();
    });
  });

  describe('body capture', () => {
    it('does not capture bodies when captureBody is false', async () => {
      core = new ReqtraceCore({ captureBody: false }, handler);
      adapter = new CycleTlsAdapter(client, core);
      mockSuccess(client, { secret: 'data' });
      adapter.install();

      await client.post('https://example.com', {
        headers: {},
        body: JSON.stringify({ payload: 'test' }),
      });
      await tick();

      const log = logs[0];
      expect(log.request_body).toBeUndefined();
      expect(log.response_body).toBeUndefined();
    });

    it('captures bodies by default', async () => {
      mockSuccess(client, { secret: 'data' });
      adapter.install();

      await client.post('https://example.com', {
        headers: {},
        body: JSON.stringify({ payload: 'test' }),
      });
      await tick();

      const log = logs[0];
      expect(log.request_body).toBeDefined();
      expect(log.response_body).toBeDefined();
    });

    it('captures bodies when captureBody is true', async () => {
      core = new ReqtraceCore({ captureBody: true }, handler);
      adapter = new CycleTlsAdapter(client, core);
      mockSuccess(client, { result: 'ok' });
      adapter.install();

      await client.post('https://example.com', {
        headers: {},
        body: JSON.stringify({ payload: 'test' }),
      });
      await tick();

      const log = logs[0];
      expect(log.request_body).toBeDefined();
      expect(log.response_body).toBeDefined();
      expect(log.response_body).toContain('result');
    });

    it('truncates large bodies', async () => {
      core = new ReqtraceCore({ captureBody: true, maxBodySize: 50 }, handler);
      adapter = new CycleTlsAdapter(client, core);
      const largeData = { data: 'x'.repeat(200) };
      mockSuccess(client, largeData);
      adapter.install();

      await client.post('https://example.com', {
        headers: {},
        body: JSON.stringify(largeData),
      });
      await tick();

      const log = logs[0];
      expect(log.request_body!.length).toBeLessThanOrEqual(54); // 50 + "…"(3 bytes) + tolerance
      expect(log.response_body!.length).toBeLessThanOrEqual(54);
    });
  });

  describe('filter', () => {
    it('skips logging when filter returns false', async () => {
      core = new ReqtraceCore(
        { filter: (url) => !url.includes('/health') },
        handler,
      );
      adapter = new CycleTlsAdapter(client, core);
      mockSuccess(client);
      adapter.install();

      await client.get('https://example.com/health', { headers: {} });
      await tick();

      expect(handler).not.toHaveBeenCalled();
    });

    it('logs when filter returns true', async () => {
      core = new ReqtraceCore(
        { filter: (url) => !url.includes('/health') },
        handler,
      );
      adapter = new CycleTlsAdapter(client, core);
      mockSuccess(client);
      adapter.install();

      await client.get('https://example.com/api/data', { headers: {} });
      await tick();

      expect(handler).toHaveBeenCalledOnce();
    });
  });
});
