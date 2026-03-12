import type { RequestLog, LogFilter, StatsResult, ChartBucket, LogStore } from '../types.js';

const MAX_ENTRIES = 10_000;

export class InMemoryStore implements LogStore {
  private logs: RequestLog[] = [];

  async add(log: RequestLog): Promise<void> {
    this.logs.push(log);
    if (this.logs.length > MAX_ENTRIES) {
      this.logs.shift();
    }
  }

  async list(filter: LogFilter): Promise<{ logs: RequestLog[]; total: number }> {
    let result = this.logs;

    if (filter.project) {
      result = result.filter((l) => l.project === filter.project);
    }
    if (filter.method) {
      const m = filter.method.toUpperCase();
      result = result.filter((l) => l.method === m);
    }
    if (filter.status !== undefined) {
      result = result.filter((l) => l.status === filter.status);
    }
    if (filter.success !== undefined) {
      result = result.filter((l) => l.success === filter.success);
    }
    if (filter.url) {
      const sub = filter.url.toLowerCase();
      result = result.filter((l) => l.url.toLowerCase().includes(sub));
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter((l) =>
        l.url.toLowerCase().includes(q) ||
        l.method.toLowerCase().includes(q) ||
        (l.status !== null && String(l.status).includes(q)) ||
        (l.error_message && l.error_message.toLowerCase().includes(q)) ||
        (l.proxy_host && l.proxy_host.toLowerCase().includes(q)),
      );
    }
    if (filter.from) {
      result = result.filter((l) => l.timestamp >= filter.from!);
    }
    if (filter.to) {
      result = result.filter((l) => l.timestamp <= filter.to!);
    }

    const total = result.length;

    // newest first
    result = [...result].reverse();

    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 100;
    result = result.slice(offset, offset + limit);

    return { logs: result, total };
  }

  async stats(filter?: { project?: string; search?: string }): Promise<StatsResult> {
    let logs = this.logs;

    if (filter?.project) {
      logs = logs.filter((l) => l.project === filter.project);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      logs = logs.filter((l) =>
        l.url.toLowerCase().includes(q) ||
        l.method.toLowerCase().includes(q) ||
        (l.status !== null && String(l.status).includes(q)) ||
        (l.error_message && l.error_message.toLowerCase().includes(q)) ||
        (l.proxy_host && l.proxy_host.toLowerCase().includes(q)),
      );
    }

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

  async chartStats(filter?: { project?: string; search?: string }): Promise<ChartBucket[]> {
    let logs = this.logs;

    if (filter?.project) {
      logs = logs.filter((l) => l.project === filter.project);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      logs = logs.filter((l) =>
        l.url.toLowerCase().includes(q) ||
        l.method.toLowerCase().includes(q) ||
        (l.status !== null && String(l.status).includes(q)) ||
        (l.error_message && l.error_message.toLowerCase().includes(q)) ||
        (l.proxy_host && l.proxy_host.toLowerCase().includes(q)),
      );
    }

    const map = new Map<string, ChartBucket>();

    for (const log of logs) {
      const d = new Date(log.timestamp);
      d.setSeconds(0, 0);
      const time = d.toISOString();
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

  async projects(): Promise<string[]> {
    return [...new Set(this.logs.map((l) => l.project))];
  }

  async count(): Promise<number> {
    return this.logs.length;
  }

  async clear(): Promise<void> {
    this.logs = [];
  }

  async close(): Promise<void> {
    // no-op for in-memory store
  }
}
