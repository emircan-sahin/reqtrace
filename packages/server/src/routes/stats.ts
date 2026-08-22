import type { FastifyInstance } from 'fastify';
import type { LogStore, AggregateFilter } from '../types.js';

interface StatsQuery {
  project?: string;
  search?: string;
  method?: string;
  status?: string;
  statusRange?: string;
  success?: string;
  proxy?: string;
  host?: string;
  from?: string;
  to?: string;
  range?: string;
}

function toNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Aggregates take the same filter set as GET /logs. Without this the stats bar
 * and charts describe the whole table while the feed below shows a filtered
 * subset — the numbers look wrong because they answer a different question.
 */
function toFilter(q: StatsQuery): AggregateFilter | undefined {
  const filter: AggregateFilter = {
    project: q.project || undefined,
    search: q.search || undefined,
    method: q.method || undefined,
    status: toNumber(q.status),
    statusRange: toNumber(q.statusRange),
    success: q.success !== undefined ? String(q.success) === 'true' : undefined,
    proxy: q.proxy || undefined,
    host: q.host || undefined,
    from: q.from || undefined,
    to: q.to || undefined,
  };

  const hasAny = Object.values(filter).some((v) => v !== undefined);
  return hasAny ? filter : undefined;
}

export function statsRoutes(store: LogStore) {
  return async function (app: FastifyInstance): Promise<void> {
    app.get<{ Querystring: StatsQuery }>('/stats', async (request) => {
      return await store.stats(toFilter(request.query));
    });

    app.get<{ Querystring: StatsQuery }>('/stats/charts', async (request) => {
      const range = toNumber(request.query.range);
      const filter = toFilter(request.query);
      const withRange = range !== undefined ? { ...(filter ?? {}), range } : filter;
      return { buckets: await store.chartStats(withRange) };
    });

    app.get<{ Querystring: StatsQuery }>('/stats/proxy', async (request) => {
      return { buckets: await store.proxyStats(toFilter(request.query)) };
    });

    app.get<{ Querystring: StatsQuery }>('/stats/hosts', async (request) => {
      const range = toNumber(request.query.range);
      const filter = toFilter(request.query);
      const withRange = range !== undefined ? { ...(filter ?? {}), range } : filter;
      return { buckets: await store.hostStats(withRange) };
    });
  };
}
