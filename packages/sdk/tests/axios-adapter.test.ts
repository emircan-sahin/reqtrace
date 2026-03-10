import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios, { AxiosInstance } from 'axios';
import { AxiosAdapter } from '../src/adapters/axios';
import { ReqtraceCore } from '../src/core';
import type { RequestLog } from '../src/types';

// Simple mock server using axios adapter
function mockAxiosSuccess(instance: AxiosInstance, data: unknown = { ok: true }, status = 200) {
  instance.interceptors.request.use((config) => config);
  // Override the actual request
  instance.defaults.adapter = async (config) => {
    return {
      data,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      headers: { 'content-type': 'application/json', 'content-length': '10' },
      config,
    };
  };
}

function mockAxiosError(instance: AxiosInstance, message = 'Network Error') {
  instance.defaults.adapter = async (config) => {
    const error = new axios.AxiosError(message, 'ERR_NETWORK', config as never);
    throw error;
  };
}

function mockAxiosHttpError(
  instance: AxiosInstance,
  status: number,
  data: unknown = { error: 'not found' },
) {
  instance.defaults.adapter = async (config) => {
    const response = {
      data,
      status,
      statusText: 'Not Found',
      headers: { 'content-type': 'application/json' },
      config,
    };
    const error = new axios.AxiosError(
      `Request failed with status code ${status}`,
      'ERR_BAD_REQUEST',
      config,
      {},
      response as never,
    );
    throw error;
  };
}

describe('AxiosAdapter', () => {
  let instance: AxiosInstance;
  let handler: ReturnType<typeof vi.fn>;
  let core: ReqtraceCore;
  let adapter: AxiosAdapter;
  let logs: RequestLog[];

  beforeEach(() => {
    instance = axios.create();
    logs = [];
    handler = vi.fn((log: RequestLog) => logs.push(log));
    core = new ReqtraceCore({}, handler);
    adapter = new AxiosAdapter(instance, core);
  });

  describe('successful requests', () => {
    it('logs a successful GET request', async () => {
      mockAxiosSuccess(instance);
      adapter.install();

      await instance.get('https://api.example.com/data');

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
      mockAxiosSuccess(instance, { created: true }, 201);
      adapter.install();

      await instance.post('https://api.example.com/items', { name: 'test' });

      const log = logs[0];
      expect(log.method).toBe('POST');
      expect(log.status).toBe(201);
      expect(log.success).toBe(true);
    });

    it('captures response size from content-length', async () => {
      mockAxiosSuccess(instance);
      adapter.install();

      await instance.get('https://api.example.com/data');

      expect(logs[0].response_size_bytes).toBe(10);
    });

    it('captures request and response headers', async () => {
      mockAxiosSuccess(instance);
      adapter.install();

      await instance.get('https://api.example.com/data', {
        headers: { 'X-Custom': 'test-value' },
      });

      const log = logs[0];
      expect(log.request_headers['X-Custom']).toBe('test-value');
      expect(log.response_headers['content-type']).toBe('application/json');
    });
  });

  describe('error handling', () => {
    it('logs network errors with success=false', async () => {
      mockAxiosError(instance, 'ECONNREFUSED');
      adapter.install();

      await expect(instance.get('https://api.example.com/data')).rejects.toThrow();

      expect(handler).toHaveBeenCalledOnce();
      const log = logs[0];
      expect(log.success).toBe(false);
      expect(log.status).toBeNull();
      expect(log.error_message).toBe('ECONNREFUSED');
    });

    it('logs HTTP errors with status and error message', async () => {
      mockAxiosHttpError(instance, 404);
      adapter.install();

      await expect(instance.get('https://api.example.com/nope')).rejects.toThrow();

      const log = logs[0];
      expect(log.success).toBe(false);
      expect(log.status).toBe(404);
      expect(log.error_message).toContain('404');
    });

    it('does not swallow errors', async () => {
      mockAxiosError(instance);
      adapter.install();

      await expect(instance.get('https://example.com')).rejects.toThrow('Network Error');
    });
  });

  describe('eject', () => {
    it('stops logging after eject', async () => {
      mockAxiosSuccess(instance);
      adapter.install();

      await instance.get('https://example.com/1');
      expect(handler).toHaveBeenCalledTimes(1);

      adapter.eject();

      await instance.get('https://example.com/2');
      expect(handler).toHaveBeenCalledTimes(1); // no new log
    });
  });

  describe('proxy info', () => {
    it('captures proxy host and port', async () => {
      mockAxiosSuccess(instance);
      adapter.install();

      await instance.get('https://example.com', {
        proxy: { host: '127.0.0.1', port: 8080 },
      });

      const log = logs[0];
      expect(log.proxy_host).toBe('127.0.0.1');
      expect(log.proxy_port).toBe(8080);
    });

    it('sets proxy to null when not used', async () => {
      mockAxiosSuccess(instance);
      adapter.install();

      await instance.get('https://example.com');

      const log = logs[0];
      expect(log.proxy_host).toBeNull();
      expect(log.proxy_port).toBeNull();
    });
  });

  describe('body capture', () => {
    it('does not capture bodies by default', async () => {
      mockAxiosSuccess(instance, { secret: 'data' });
      adapter.install();

      await instance.post('https://example.com', { payload: 'test' });

      const log = logs[0];
      expect(log.request_body).toBeUndefined();
      expect(log.response_body).toBeUndefined();
    });

    it('captures bodies when captureBody is true', async () => {
      core = new ReqtraceCore({ captureBody: true }, handler);
      adapter = new AxiosAdapter(instance, core);
      mockAxiosSuccess(instance, { result: 'ok' });
      adapter.install();

      await instance.post('https://example.com', { payload: 'test' });

      const log = logs[0];
      expect(log.request_body).toBeDefined();
      expect(log.response_body).toBeDefined();
      expect(log.response_body).toContain('result');
    });

    it('truncates large bodies', async () => {
      core = new ReqtraceCore({ captureBody: true, maxBodySize: 50 }, handler);
      adapter = new AxiosAdapter(instance, core);
      const largeData = { data: 'x'.repeat(200) };
      mockAxiosSuccess(instance, largeData);
      adapter.install();

      await instance.post('https://example.com', largeData);

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
      adapter = new AxiosAdapter(instance, core);
      mockAxiosSuccess(instance);
      adapter.install();

      await instance.get('https://example.com/health');

      expect(handler).not.toHaveBeenCalled();
    });

    it('logs when filter returns true', async () => {
      core = new ReqtraceCore(
        { filter: (url) => !url.includes('/health') },
        handler,
      );
      adapter = new AxiosAdapter(instance, core);
      mockAxiosSuccess(instance);
      adapter.install();

      await instance.get('https://example.com/api/data');

      expect(handler).toHaveBeenCalledOnce();
    });
  });
});
