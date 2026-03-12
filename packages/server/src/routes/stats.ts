import type { FastifyInstance } from 'fastify';
import type { LogStore } from '../types.js';

export function statsRoutes(store: LogStore) {
  return async function (app: FastifyInstance): Promise<void> {
    app.get('/stats', async (request) => {
      const { project, search } = request.query as { project?: string; search?: string };
      const filter = project || search ? { project, search } : undefined;
      return await store.stats(filter);
    });

    app.get('/stats/charts', async (request) => {
      const { project, search } = request.query as { project?: string; search?: string };
      const filter = project || search ? { project, search } : undefined;
      return { buckets: await store.chartStats(filter) };
    });

    app.get('/stats/proxy', async (request) => {
      const { project, search } = request.query as { project?: string; search?: string };
      const filter = project || search ? { project, search } : undefined;
      return { buckets: await store.proxyStats(filter) };
    });
  };
}
