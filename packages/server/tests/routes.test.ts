import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createApp({ logger: false });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

const sampleLog = {
  id: 'route-test-1',
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
};

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

describe('POST /api/logs', () => {
  it('accepts a log entry', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/logs',
      payload: sampleLog,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ ok: true });
  });
});

describe('GET /api/logs', () => {
  it('returns stored logs', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/logs' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.logs[0].url).toBe('https://api.example.com/data');
  });

  it('filters by method', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/logs',
      payload: { ...sampleLog, method: 'POST', url: '/api/posts' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/logs?method=POST',
    });
    const body = res.json();
    expect(body.logs.every((l: { method: string }) => l.method === 'POST')).toBe(true);
  });
});

describe('GET /api/stats', () => {
  it('returns stats', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/stats' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total_requests).toBeGreaterThanOrEqual(1);
    expect(body).toHaveProperty('success_count');
    expect(body).toHaveProperty('avg_duration_ms');
    expect(body).toHaveProperty('methods');
    expect(body).toHaveProperty('status_codes');
  });
});
