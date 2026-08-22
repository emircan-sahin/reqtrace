import type { RequestLog, LogFilter, AggregateFilter, StatsResult, ChartBucket, ProxyBucket, HostBucket, LogStore, LogSummary } from '../types.js';

/** Mirror of the SQL predicates in store/pg.ts, so both stores filter alike. */
function urlHost(url: string): string {
  const match = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^/?#]+)/.exec(url);
  return match ? match[1] : url;
}

function matchesFilter(log: RequestLog, filter?: LogFilter | AggregateFilter): boolean {
  if (!filter) return true;

  if (filter.project && log.project !== filter.project) return false;
  if (filter.method && log.method !== filter.method.toUpperCase()) return false;
  if (filter.status !== undefined && log.status !== filter.status) return false;
  if (filter.statusRange !== undefined) {
    if (log.status === null) return false;
    if (log.status < filter.statusRange || log.status >= filter.statusRange + 100) return false;
  }
  if (filter.success !== undefined && log.success !== filter.success) return false;
  if (filter.proxy) {
    const separator = filter.proxy.lastIndexOf(':');
    const host = separator > 0 ? filter.proxy.slice(0, separator) : filter.proxy;
    const port = separator > 0 ? Number(filter.proxy.slice(separator + 1)) : NaN;
    if (log.proxy_host !== host) return false;
    if (Number.isFinite(port) && log.proxy_port !== port) return false;
  }
  if (filter.host && urlHost(log.url) !== filter.host) return false;
  if (filter.url && !log.url.toLowerCase().includes(filter.url.toLowerCase())) return false;
  if (filter.search) {
    const q = filter.search.toLowerCase();
    const hit =
      log.url.toLowerCase().includes(q) ||
      log.method.toLowerCase().includes(q) ||
      (log.status !== null && String(log.status).includes(q)) ||
      (!!log.error_message && log.error_message.toLowerCase().includes(q)) ||
      (!!log.proxy_host && log.proxy_host.toLowerCase().includes(q));
    if (!hit) return false;
  }
  if (filter.from && log.timestamp < filter.from) return false;
  if (filter.to && log.timestamp > filter.to) return false;

  return true;
}

function toSummary(log: RequestLog): LogSummary {
  const { request_headers, response_headers, request_body, response_body, ...summary } = log;
  return summary;
}

const MAX_ENTRIES = 10_000;

export class InMemoryStore implements LogStore {
  private logs: RequestLog[] = [];

  async add(log: RequestLog): Promise<void> {
    this.logs.push(log);
    if (this.logs.length > MAX_ENTRIES) {
      this.logs.shift();
    }
  }

  async getById(id: string): Promise<RequestLog | null> {
    return this.logs.find((l) => l.id === id) ?? null;
  }

  async list(filter: LogFilter): Promise<{ logs: LogSummary[]; total: number }> {
    let result = this.logs.filter((l) => matchesFilter(l, filter));

    const total = result.length;

    // newest first
    result = [...result].reverse();

    if (filter.cursor) {
      try {
        const decoded = Buffer.from(filter.cursor, 'base64').toString('utf8');
        const sep = decoded.indexOf('|');
        if (sep > 0) {
          const cursorTs = decoded.slice(0, sep);
          const cursorId = decoded.slice(sep + 1);
          result = result.filter(
            (l) => l.timestamp < cursorTs || (l.timestamp === cursorTs && l.id < cursorId),
          );
        }
      } catch {
        // ignore invalid cursor
      }
    }

    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 100;
    result = result.slice(offset, offset + limit);

    return { logs: result.map(toSummary), total };
  }

  async stats(filter?: AggregateFilter): Promise<StatsResult> {
    const logs = this.logs.filter((l) => matchesFilter(l, filter));

    const total = logs.length;

    if (total === 0) {
      return {
        total_requests: 0,
        success_count: 0,
        error_count: 0,
        avg_duration_ms: 0,
        methods: {},
        status_codes: {},
        requests_per_minute: 0,
      };
    }

    let successCount = 0;
    let totalDuration = 0;
    const methods: Record<string, number> = {};
    const statusCodes: Record<string, number> = {};

    for (const log of logs) {
      if (log.success) successCount++;
      totalDuration += log.duration_ms;
      methods[log.method] = (methods[log.method] ?? 0) + 1;
      if (log.status !== null) {
        const key = String(log.status);
        statusCodes[key] = (statusCodes[key] ?? 0) + 1;
      }
    }

    const now = Date.now();
    const oneMinuteAgo = now - 60_000;
    const recentCount = logs.filter(
      (l) => new Date(l.timestamp).getTime() >= oneMinuteAgo,
    ).length;

    return {
      total_requests: total,
      success_count: successCount,
      error_count: total - successCount,
      avg_duration_ms: Math.round(totalDuration / total),
      methods,
      status_codes: statusCodes,
      requests_per_minute: recentCount,
    };
  }

  async chartStats(filter?: AggregateFilter & { range?: number }): Promise<ChartBucket[]> {
    const range = filter?.range ?? 1800;
    const bucketMs = Math.max(1, Math.floor(range / 30)) * 1000;
    const cutoff = Date.now() - range * 1000;
    const logs = this.logs.filter(
      (l) => new Date(l.timestamp).getTime() >= cutoff && matchesFilter(l, filter),
    );

    const map = new Map<string, ChartBucket>();

    for (const log of logs) {
      const epoch = new Date(log.timestamp).getTime();
      const time = new Date(Math.floor(epoch / bucketMs) * bucketMs).toISOString();
      const key = `${time}|${log.project}`;

      const existing = map.get(key);
      if (existing) {
        const oldTotal = existing.total;
        existing.total++;
        if (log.success) existing.success++;
        else existing.errors++;
        existing.avg_duration = Math.round(
          (existing.avg_duration * oldTotal + log.duration_ms) / existing.total,
        );
      } else {
        map.set(key, {
          time,
          project: log.project,
          total: 1,
          success: log.success ? 1 : 0,
          errors: log.success ? 0 : 1,
          avg_duration: Math.round(log.duration_ms),
        });
      }
    }

    return [...map.values()].sort((a, b) => a.time.localeCompare(b.time));
  }

  async proxyStats(filter?: AggregateFilter): Promise<ProxyBucket[]> {
    const logs = this.logs.filter((l) => l.proxy_host !== null && matchesFilter(l, filter));

    const map = new Map<string, ProxyBucket>();

    for (const log of logs) {
      const proxy = log.proxy_port === null ? `${log.proxy_host}` : `${log.proxy_host}:${log.proxy_port}`;
      const key = `${proxy}|${log.project}`;
      const existing = map.get(key);
      const size = log.response_size_bytes ?? 0;

      if (existing) {
        existing.count++;
        if (log.success) existing.success++;
        else existing.errors++;
        existing.total_size += size;
      } else {
        map.set(key, {
          proxy,
          project: log.project,
          count: 1,
          success: log.success ? 1 : 0,
          errors: log.success ? 0 : 1,
          total_size: size,
        });
      }
    }

    return [...map.values()].sort((a, b) => b.count - a.count);
  }

  async listFull(filter: LogFilter): Promise<RequestLog[]> {
    const page = await this.list(filter);
    const byId = new Map(this.logs.map((l) => [l.id, l]));
    return page.logs.map((s) => byId.get(s.id)!).filter(Boolean);
  }

  async hostStats(filter?: AggregateFilter & { range?: number }): Promise<HostBucket[]> {
    const cutoff = filter?.range !== undefined ? Date.now() - filter.range * 1000 : null;
    const logs = this.logs.filter(
      (l) =>
        matchesFilter(l, filter) &&
        (cutoff === null || new Date(l.timestamp).getTime() >= cutoff),
    );

    const map = new Map<string, HostBucket & { durationSum: number }>();
    for (const log of logs) {
      const host = urlHost(log.url);
      const existing = map.get(host);
      if (existing) {
        existing.count++;
        if (log.success) existing.success++;
        else existing.errors++;
        existing.durationSum += log.duration_ms;
        existing.total_size += log.response_size_bytes ?? 0;
      } else {
        map.set(host, {
          host,
          count: 1,
          success: log.success ? 1 : 0,
          errors: log.success ? 0 : 1,
          avg_duration: 0,
          durationSum: log.duration_ms,
          total_size: log.response_size_bytes ?? 0,
        });
      }
    }

    return [...map.values()]
      .map(({ durationSum, ...bucket }) => ({
        ...bucket,
        avg_duration: bucket.count > 0 ? Math.round(durationSum / bucket.count) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);
  }

  async projects(): Promise<string[]> {
    return [...new Set(this.logs.map((l) => l.project))];
  }

  async count(): Promise<number> {
    return this.logs.length;
  }

  async clear(filter?: { project?: string; before?: string }): Promise<number> {
    const before = this.logs.length;
    if (filter?.project || filter?.before) {
      this.logs = this.logs.filter(
        (l) =>
          !((!filter.project || l.project === filter.project) &&
            (!filter.before || l.timestamp < filter.before)),
      );
      return before - this.logs.length;
    }
    this.logs = [];
    return before;
  }

  async close(): Promise<void> {
    // no-op for in-memory store
  }
}
