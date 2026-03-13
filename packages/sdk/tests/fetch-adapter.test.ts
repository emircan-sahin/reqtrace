import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FetchAdapter } from '../src/adapters/fetch';
import { ReqtraceCore } from '../src/core';
import type { RequestLog } from '../src/types';

const originalFetch = globalThis.fetch;

function mockFetchSuccess(data: unknown = { ok: true }, status = 200) {
  globalThis.fetch = vi.fn(async () => {
    return new Response(JSON.stringify(data), {
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      headers: { 'content-type': 'application/json', 'content-length': '10' },
    });
  });
}

function mockFetchError(message = 'fetch failed') {
  globalThis.fetch = vi.fn(async () => {
    throw new TypeError(message);
  });
}

// Wait for setImmediate callbacks (deferred log dispatch) to flush
const tick = () => new Promise(resolve => setImmediate(resolve));

describe('FetchAdapter', () => {
  let handler: ReturnType<typeof vi.fn>;
  let core: ReqtraceCore;
  let adapter: FetchAdapter;
  let logs: RequestLog[];

  beforeEach(() => {
    logs = [];
    handler = vi.fn((log: RequestLog) => logs.push(log));
    core = new ReqtraceCore({}, handler);
    adapter = new FetchAdapter(core);
  });

  afterEach(() => {
    adapter.eject();
    globalThis.fetch = originalFetch;
  });

  describe('successful requests', () => {
    it('logs a successful GET request', async () => {
      mockFetchSuccess();
      adapter.install();

      await fetch('https://api.example.com/data');
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
      mockFetchSuccess({ created: true }, 201);
      adapter.install();

      await fetch('https://api.example.com/items', {
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
      });
      await tick();

      const log = logs[0];
      expect(log.method).toBe('POST');
      expect(log.status).toBe(201);
      expect(log.success).toBe(true);
    });

    it('captures response size from content-length', async () => {
      mockFetchSuccess();
      adapter.install();

      await fetch('https://api.example.com/data');
      await tick();

      expect(logs[0].response_size_bytes).toBe(10);
    });

    it('captures request and response headers', async () => {
      mockFetchSuccess();
      adapter.install();

      await fetch('https://api.example.com/data', {
        headers: { 'X-Custom': 'test-value' },
      });
      await tick();

      const log = logs[0];
      expect(log.request_headers['X-Custom']).toBe('test-value');
      expect(log.response_headers['content-type']).toBe('application/json');
    });

    it('handles URL object input', async () => {
      mockFetchSuccess();
      adapter.install();

      await fetch(new URL('https://api.example.com/data'));
      await tick();

      expect(logs[0].url).toBe('https://api.example.com/data');
    });
  });

  describe('error handling', () => {
    it('logs network errors with success=false', async () => {
      mockFetchError('Failed to fetch');
      adapter.install();

      await expect(fetch('https://api.example.com/data')).rejects.toThrow();
      await tick();

      expect(handler).toHaveBeenCalledOnce();
      const log = logs[0];
      expect(log.success).toBe(false);
      expect(log.status).toBeNull();
      expect(log.error_message).toBe('Failed to fetch');
    });

    it('logs HTTP 4xx/5xx as success=false', async () => {
      mockFetchSuccess({ error: 'not found' }, 404);
      adapter.install();

      await fetch('https://api.example.com/nope');
      await tick();

      const log = logs[0];
      expect(log.success).toBe(false);
      expect(log.status).toBe(404);
    });

    it('does not swallow errors', async () => {
      mockFetchError('Network Error');
      adapter.install();

      await expect(fetch('https://example.com')).rejects.toThrow('Network Error');
    });
  });

  describe('eject', () => {
    it('stops logging after eject', async () => {
      mockFetchSuccess();
      adapter.install();

      await fetch('https://example.com/1');
      await tick();
      expect(handler).toHaveBeenCalledTimes(1);

      adapter.eject();

      await fetch('https://example.com/2');
      await tick();
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('proxy info', () => {
    it('always sets proxy to null (fetch has no proxy config)', async () => {
      mockFetchSuccess();
      adapter.install();

      await fetch('https://example.com');
      await tick();

      const log = logs[0];
      expect(log.proxy_host).toBeNull();
      expect(log.proxy_port).toBeNull();
    });
  });

  describe('body capture', () => {
    it('does not capture bodies when captureBody is false', async () => {
      core = new ReqtraceCore({ captureBody: false }, handler);
      adapter = new FetchAdapter(core);
      mockFetchSuccess({ secret: 'data' });
      adapter.install();

      await fetch('https://example.com', {
        method: 'POST',
        body: JSON.stringify({ payload: 'test' }),
      });
      await tick();

      const log = logs[0];
      expect(log.request_body).toBeUndefined();
      expect(log.response_body).toBeUndefined();
    });

    it('captures bodies by default', async () => {
      mockFetchSuccess({ secret: 'data' });
      adapter.install();

      await fetch('https://example.com', {
        method: 'POST',
        body: JSON.stringify({ payload: 'test' }),
      });
      await tick();

      const log = logs[0];
      expect(log.request_body).toBeDefined();
      expect(log.response_body).toBeDefined();
    });

    it('captures bodies when captureBody is true', async () => {
      core = new ReqtraceCore({ captureBody: true }, handler);
      adapter = new FetchAdapter(core);
      mockFetchSuccess({ result: 'ok' });
      adapter.install();

      await fetch('https://example.com', {
        method: 'POST',
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
      adapter = new FetchAdapter(core);
      const largeData = { data: 'x'.repeat(200) };
      mockFetchSuccess(largeData);
      adapter.install();

      await fetch('https://example.com', {
        method: 'POST',
        body: JSON.stringify(largeData),
      });
      await tick();

      const log = logs[0];
      expect(log.request_body!.length).toBeLessThanOrEqual(54);
      expect(log.response_body!.length).toBeLessThanOrEqual(54);
    });
  });

  describe('filter', () => {
    it('skips logging when filter returns false', async () => {
      core = new ReqtraceCore(
        { filter: (url) => !url.includes('/health') },
        handler,
      );
      adapter = new FetchAdapter(core);
      mockFetchSuccess();
      adapter.install();

      await fetch('https://example.com/health');
      await tick();

      expect(handler).not.toHaveBeenCalled();
    });

    it('logs when filter returns true', async () => {
      core = new ReqtraceCore(
        { filter: (url) => !url.includes('/health') },
        handler,
      );
      adapter = new FetchAdapter(core);
      mockFetchSuccess();
      adapter.install();

      await fetch('https://example.com/api/data');
      await tick();

      expect(handler).toHaveBeenCalledOnce();
    });
  });
});
