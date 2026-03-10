import { describe, it, expect, vi } from 'vitest';
import { ReqtraceCore } from '../src/core';
import type { RequestLog } from '../src/types';

function makeMockLog(overrides?: Partial<RequestLog>): RequestLog {
  return {
    id: 'test-id-1',
    url: 'https://api.example.com/data',
    method: 'GET',
    status: 200,
    duration_ms: 150,
    proxy_host: null,
    proxy_port: null,
    response_size_bytes: 1024,
    request_headers: { 'content-type': 'application/json' },
    response_headers: { 'content-type': 'application/json' },
    error_message: null,
    success: true,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('ReqtraceCore', () => {
  describe('constructor defaults', () => {
    it('applies default config', () => {
      const core = new ReqtraceCore();
      const config = core.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.captureBody).toBe(false);
      expect(config.maxBodySize).toBe(10240);
      expect(config.filter('any', 'GET')).toBe(true);
    });

    it('merges user config with defaults', () => {
      const core = new ReqtraceCore({ captureBody: true, maxBodySize: 5000 });
      const config = core.getConfig();
      expect(config.captureBody).toBe(true);
      expect(config.maxBodySize).toBe(5000);
      expect(config.enabled).toBe(true);
    });
  });

  describe('shouldLog', () => {
    it('returns true when enabled', () => {
      const core = new ReqtraceCore();
      expect(core.shouldLog('https://example.com', 'GET')).toBe(true);
    });

    it('returns false when disabled', () => {
      const core = new ReqtraceCore({ enabled: false });
      expect(core.shouldLog('https://example.com', 'GET')).toBe(false);
    });

    it('respects custom filter', () => {
      const core = new ReqtraceCore({
        filter: (url) => !url.includes('/health'),
      });
      expect(core.shouldLog('/api/data', 'GET')).toBe(true);
      expect(core.shouldLog('/health', 'GET')).toBe(false);
    });
  });

  describe('handleLog', () => {
    it('calls logHandler with log', () => {
      const handler = vi.fn();
      const core = new ReqtraceCore({}, handler);
      const log = makeMockLog();

      core.handleLog(log);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(log);
    });

    it('does not call logHandler when disabled', () => {
      const handler = vi.fn();
      const core = new ReqtraceCore({ enabled: false }, handler);

      core.handleLog(makeMockLog());

      expect(handler).not.toHaveBeenCalled();
    });

    it('uses console.log by default', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const core = new ReqtraceCore();

      core.handleLog(makeMockLog());

      expect(spy).toHaveBeenCalledOnce();
      spy.mockRestore();
    });
  });

  describe('updateConfig', () => {
    it('updates config at runtime', () => {
      const core = new ReqtraceCore();
      expect(core.getConfig().enabled).toBe(true);

      core.updateConfig({ enabled: false });
      expect(core.getConfig().enabled).toBe(false);
    });

    it('preserves unmodified config fields', () => {
      const core = new ReqtraceCore({ captureBody: true, maxBodySize: 5000 });
      core.updateConfig({ captureBody: false });

      const config = core.getConfig();
      expect(config.captureBody).toBe(false);
      expect(config.maxBodySize).toBe(5000);
    });
  });

  describe('getConfig', () => {
    it('returns a copy (not a reference)', () => {
      const core = new ReqtraceCore();
      const config1 = core.getConfig();
      const config2 = core.getConfig();
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });
});
