import type { FastifyInstance } from 'fastify';
import type { LogStore } from '../types.js';

export function statsRoutes(store: LogStore) {
  return async function (app: FastifyInstance): Promise<void> {
    app.get('/stats', async () => {
      return store.stats();
    });
  };
}
