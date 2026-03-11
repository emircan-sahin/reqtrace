import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryStore } from '../src/store/index';
import type { RequestLog } from '../src/types';

let logCounter = 0;
function mockLog(overrides?: Partial<RequestLog>): RequestLog {
  return {
    id: `test-${++logCounter}`,
    project: 'test',
    url: 'https://api.example.com/data',
    method: 'GET',
    status: 200,
    duration_ms: 100,
    proxy_host: null,
    proxy_port: null,
    response_size_bytes: 512,
    request_headers: {},
    response_headers: {},
    error_message: null,
    success: true,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('InMemoryStore', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  describe('add / count', () => {
    it('starts empty', async () => {
      expect(await store.count()).toBe(0);
    });

    it('adds logs', async () => {
      await store.add(mockLog());
      await store.add(mockLog());
      expect(await store.count()).toBe(2);
    });
  });

  describe('list', () => {
    it('returns all logs newest first', async () => {
      await store.add(mockLog({ url: '/first', timestamp: '2026-01-01T00:00:00Z' }));
      await store.add(mockLog({ url: '/second', timestamp: '2026-01-01T00:01:00Z' }));

      const { logs, total } = await store.list({});
      expect(total).toBe(2);
      expect(logs[0].url).toBe('/second');
      expect(logs[1].url).toBe('/first');
    });

    it('filters by method', async () => {
      await store.add(mockLog({ method: 'GET' }));
      await store.add(mockLog({ method: 'POST' }));

      const { logs } = await store.list({ method: 'post' });
      expect(logs).toHaveLength(1);
      expect(logs[0].method).toBe('POST');
    });

    it('filters by status', async () => {
      await store.add(mockLog({ status: 200 }));
      await store.add(mockLog({ status: 404 }));

      const { logs } = await store.list({ status: 404 });
      expect(logs).toHaveLength(1);
    });

    it('filters by success', async () => {
      await store.add(mockLog({ success: true }));
      await store.add(mockLog({ success: false }));

      const { logs } = await store.list({ success: false });
      expect(logs).toHaveLength(1);
      expect(logs[0].success).toBe(false);
    });

    it('filters by url substring', async () => {
      await store.add(mockLog({ url: 'https://api.example.com/users' }));
      await store.add(mockLog({ url: 'https://api.example.com/posts' }));

      const { logs } = await store.list({ url: 'users' });
      expect(logs).toHaveLength(1);
    });

    it('paginates with limit and offset', async () => {
      for (let i = 0; i < 10; i++) {
        await store.add(mockLog({ url: `/item/${i}` }));
      }

      const { logs } = await store.list({ limit: 3, offset: 2 });
      expect(logs).toHaveLength(3);
    });
  });

  describe('stats', () => {
    it('returns zeros for empty store', async () => {
      const s = await store.stats();
      expect(s.total_requests).toBe(0);
      expect(s.avg_duration_ms).toBe(0);
    });

    it('computes correct stats', async () => {
      await store.add(mockLog({ method: 'GET', status: 200, duration_ms: 100, success: true }));
      await store.add(mockLog({ method: 'GET', status: 200, duration_ms: 200, success: true }));
      await store.add(mockLog({ method: 'POST', status: 500, duration_ms: 300, success: false }));

      const s = await store.stats();
      expect(s.total_requests).toBe(3);
      expect(s.success_count).toBe(2);
      expect(s.error_count).toBe(1);
      expect(s.avg_duration_ms).toBe(200);
      expect(s.methods['GET']).toBe(2);
      expect(s.methods['POST']).toBe(1);
      expect(s.status_codes['200']).toBe(2);
      expect(s.status_codes['500']).toBe(1);
    });
  });

  describe('clear', () => {
    it('removes all logs', async () => {
      await store.add(mockLog());
      await store.add(mockLog());
      await store.clear();
      expect(await store.count()).toBe(0);
    });
  });
});
