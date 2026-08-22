import type pg from 'pg';
import type { RequestLog, LogFilter, AggregateFilter, StatsResult, ChartBucket, ProxyBucket, HostBucket, LogStore, LogSummary } from '../types.js';

/** Target host from a URL, computed in SQL so no schema migration is needed. */
const HOST_EXPR = `COALESCE(substring(url from '^[a-zA-Z][a-zA-Z0-9+.-]*://([^/?#]+)'), url)`;

const SEARCH_COLUMNS = ['url', 'method', 'CAST(status AS TEXT)', 'error_message', 'proxy_host'];

/**
 * The single source of truth for filter predicates. The log list and every
 * aggregate share it, so the counters can never describe a different row set
 * than the feed below them.
 */
function buildConditions(filter: LogFilter | AggregateFilter | undefined, params: unknown[]): string[] {
  const conditions: string[] = [];
  if (!filter) return conditions;

  const bind = (value: unknown): number => params.push(value);

  if (filter.project) conditions.push(`project = $${bind(filter.project)}`);
  if (filter.method) conditions.push(`method = $${bind(filter.method.toUpperCase())}`);
  if (filter.status !== undefined) conditions.push(`status = $${bind(filter.status)}`);
  if (filter.statusRange !== undefined) {
    const low = bind(filter.statusRange);
    const high = bind(filter.statusRange + 100);
    conditions.push(`(status >= $${low} AND status < $${high})`);
  }
  if (filter.success !== undefined) conditions.push(`success = $${bind(filter.success)}`);
  if (filter.proxy) {
    const separator = filter.proxy.lastIndexOf(':');
    const host = separator > 0 ? filter.proxy.slice(0, separator) : filter.proxy;
    const port = separator > 0 ? Number(filter.proxy.slice(separator + 1)) : NaN;
    conditions.push(`proxy_host = $${bind(host)}`);
    if (Number.isFinite(port)) conditions.push(`proxy_port = $${bind(port)}`);
  }
  if (filter.host) conditions.push(`${HOST_EXPR} = $${bind(filter.host)}`);
  if (filter.url) conditions.push(`url ILIKE $${bind(`%${filter.url}%`)}`);
  if (filter.search) {
    const idx = bind(`%${filter.search}%`);
    conditions.push(`(${SEARCH_COLUMNS.map((c) => `${c} ILIKE $${idx}`).join(' OR ')})`);
  }
  if (filter.from) conditions.push(`timestamp >= $${bind(filter.from)}`);
  if (filter.to) conditions.push(`timestamp <= $${bind(filter.to)}`);

  return conditions;
}

function cacheKey(filter: unknown): string {
  return JSON.stringify(filter ?? {});
}

const SUMMARY_COLUMNS = `id, project, url, method, status, duration_ms, proxy_host, proxy_port, response_size_bytes, error_message, success, timestamp`;

function rowToLog(row: Record<string, unknown>): RequestLog {
  return {
    id: row.id as string,
    project: row.project as string,
    url: row.url as string,
    method: row.method as string,
    status: row.status as number | null,
    duration_ms: row.duration_ms as number,
    proxy_host: row.proxy_host as string | null,
    proxy_port: row.proxy_port as number | null,
    response_size_bytes: row.response_size_bytes as number | null,
    request_headers: row.request_headers as Record<string, string>,
    response_headers: row.response_headers as Record<string, string>,
    request_body: row.request_body as string | undefined,
    response_body: row.response_body as string | undefined,
    error_message: row.error_message as string | null,
    success: row.success as boolean,
    timestamp: row.timestamp instanceof Date
      ? row.timestamp.toISOString()
      : (row.timestamp as string),
  };
}

function rowToSummary(row: Record<string, unknown>): LogSummary {
  return {
    id: row.id as string,
    project: row.project as string,
    url: row.url as string,
    method: row.method as string,
    status: row.status as number | null,
    duration_ms: row.duration_ms as number,
    proxy_host: row.proxy_host as string | null,
    proxy_port: row.proxy_port as number | null,
    response_size_bytes: row.response_size_bytes as number | null,
    error_message: row.error_message as string | null,
    success: row.success as boolean,
    timestamp: row.timestamp instanceof Date
      ? row.timestamp.toISOString()
      : (row.timestamp as string),
  };
}

const MAX_PER_PROJECT = 1_000_000;
const CLEANUP_INTERVAL = 1_000;
const TRIM_BATCH = 10_000;
const FLUSH_INTERVAL = 200;
const FLUSH_MAX = 50;
const STATS_CACHE_TTL_MS = 5_000;

const COLUMNS = `id, project, url, method, status, duration_ms,
  proxy_host, proxy_port, response_size_bytes,
  request_headers, response_headers,
  request_body, response_body,
  error_message, success, timestamp`;

function logParams(log: RequestLog): unknown[] {
  return [
    log.id, log.project, log.url, log.method, log.status, log.duration_ms,
    log.proxy_host, log.proxy_port, log.response_size_bytes,
    JSON.stringify(log.request_headers ?? {}), JSON.stringify(log.response_headers ?? {}),
    log.request_body ?? null, log.response_body ?? null,
    log.error_message ?? null, log.success, log.timestamp,
  ];
}

export class PostgresStore implements LogStore {
  private insertsSinceCleanup = new Map<string, number>();
  private rowCounts = new Map<string, number>();
  private trimming = new Set<string>();
  private buffer: { log: RequestLog; resolve: () => void; reject: (err: unknown) => void }[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private statsCache = new Map<string, { at: number; data: StatsResult }>();
  private chartCache = new Map<string, { at: number; data: ChartBucket[] }>();
  private proxyCache = new Map<string, { at: number; data: ProxyBucket[] }>();
  private hostCache = new Map<string, { at: number; data: HostBucket[] }>();
  private closed = false;

  constructor(private pool: pg.Pool) {}

  add(log: RequestLog): Promise<void> {
    return new Promise((resolve, reject) => {
      this.buffer.push({ log, resolve, reject });

      if (this.buffer.length >= FLUSH_MAX) {
        void this.flush();
      } else if (!this.flushTimer) {
        this.flushTimer = setTimeout(() => void this.flush(), FLUSH_INTERVAL);
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0);
    const values: string[] = [];
    const params: unknown[] = [];

    for (let i = 0; i < batch.length; i++) {
      const offset = i * 16;
      values.push(`(${Array.from({ length: 16 }, (_, j) => `$${offset + j + 1}`).join(',')})`);
      params.push(...logParams(batch[i].log));
    }

    try {
      await this.pool.query(
        `INSERT INTO request_logs (${COLUMNS}) VALUES ${values.join(',')} ON CONFLICT (id) DO NOTHING`,
        params,
      );
      for (const entry of batch) entry.resolve();
    } catch (err) {
      // One malformed row must not discard the whole batch — retry row by row.
      await this.insertOneByOne(batch);
    }

    this.trackInserts(batch.map((entry) => entry.log.project));
  }

  private async insertOneByOne(
    batch: { log: RequestLog; resolve: () => void; reject: (err: unknown) => void }[],
  ): Promise<void> {
    for (const entry of batch) {
      try {
        await this.pool.query(
          `INSERT INTO request_logs (${COLUMNS})
           VALUES (${Array.from({ length: 16 }, (_, j) => `$${j + 1}`).join(',')})
           ON CONFLICT (id) DO NOTHING`,
          logParams(entry.log),
        );
        entry.resolve();
      } catch (err) {
        entry.reject(err);
      }
    }
  }

  /** Bump per-project counters and kick off retention in the background. */
  private trackInserts(projects: string[]): void {
    if (this.closed) return;

    const added = new Map<string, number>();
    for (const project of projects) {
      added.set(project, (added.get(project) ?? 0) + 1);
    }

    for (const [project, n] of added) {
      const known = this.rowCounts.get(project);
      if (known !== undefined) this.rowCounts.set(project, known + n);

      const since = (this.insertsSinceCleanup.get(project) ?? 0) + n;
      if (since >= CLEANUP_INTERVAL) {
        this.insertsSinceCleanup.set(project, 0);
        void this.trim(project);
      } else {
        this.insertsSinceCleanup.set(project, since);
      }
    }
  }

  /**
   * Enforce MAX_PER_PROJECT. Runs outside the insert path so ingestion is never
   * blocked, and deletes in bounded batches instead of scanning past a huge OFFSET.
   */
  private async trim(project: string): Promise<void> {
    if (this.trimming.has(project) || this.closed) return;
    this.trimming.add(project);

    try {
      let count = this.rowCounts.get(project);
      if (count === undefined) {
        const result = await this.pool.query(
          `SELECT COUNT(*)::bigint AS cnt FROM request_logs WHERE project = $1`,
          [project],
        );
        count = Number(result.rows[0].cnt);
        this.rowCounts.set(project, count);
      }

      while (count > MAX_PER_PROJECT && !this.closed) {
        const limit = Math.min(count - MAX_PER_PROJECT, TRIM_BATCH);
        const result = await this.pool.query(
          `DELETE FROM request_logs WHERE ctid = ANY(ARRAY(
             SELECT ctid FROM request_logs WHERE project = $1 ORDER BY timestamp ASC LIMIT $2
           ))`,
          [project, limit],
        );
        const deleted = result.rowCount ?? 0;
        if (deleted === 0) break;
        count -= deleted;
        this.rowCounts.set(project, count);
      }
    } catch (err) {
      console.error('[reqtrace] retention trim failed:', err);
      this.rowCounts.delete(project);
    } finally {
      this.trimming.delete(project);
    }
  }

  async getById(id: string): Promise<RequestLog | null> {
    const result = await this.pool.query(
      `SELECT * FROM request_logs WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return rowToLog(result.rows[0]);
  }

  private pageQuery(filter: LogFilter, columns: string): { sql: string; params: unknown[] } {
    const params: unknown[] = [];
    const conditions = buildConditions(filter, params);

    let cursorTs: string | null = null;
    let cursorId: string | null = null;
    if (filter.cursor) {
      try {
        const decoded = Buffer.from(filter.cursor, 'base64').toString('utf8');
        const sep = decoded.indexOf('|');
        if (sep > 0) {
          cursorTs = decoded.slice(0, sep);
          cursorId = decoded.slice(sep + 1);
        }
      } catch {
        cursorTs = null;
        cursorId = null;
      }
    }

    if (cursorTs && cursorId) {
      conditions.push(`(timestamp, id) < ($${params.push(cursorTs)}, $${params.push(cursorId)})`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter.limit ?? 100;
    const offset = cursorTs && cursorId ? 0 : filter.offset ?? 0;

    return {
      sql: `SELECT ${columns} FROM request_logs ${where}
            ORDER BY timestamp DESC, id DESC
            LIMIT $${params.push(limit)} OFFSET $${params.push(offset)}`,
      params,
    };
  }

  async list(filter: LogFilter): Promise<{ logs: LogSummary[]; total: number }> {
    const { sql, params } = this.pageQuery(filter, SUMMARY_COLUMNS);
    const dataResult = await this.pool.query(sql, params);
    return { logs: dataResult.rows.map(rowToSummary), total: dataResult.rows.length };
  }

  async listFull(filter: LogFilter): Promise<RequestLog[]> {
    const { sql, params } = this.pageQuery(filter, COLUMNS);
    const result = await this.pool.query(sql, params);
    return result.rows.map(rowToLog);
  }

  async stats(filter?: AggregateFilter): Promise<StatsResult> {
    const key = cacheKey(filter);
    const cached = this.statsCache.get(key);
    if (cached && Date.now() - cached.at < STATS_CACHE_TTL_MS) {
      return cached.data;
    }

    const params: unknown[] = [];
    const conditions = buildConditions(filter, params);
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Single pass over the table: grouping by (method, status) keeps the result
    // set tiny and lets the totals be folded in JS instead of re-scanning 3x.
    const result = await this.pool.query(
      `SELECT
         method,
         status,
         COUNT(*)::bigint AS cnt,
         COUNT(*) FILTER (WHERE success = true)::bigint AS success_count,
         COALESCE(SUM(duration_ms)::bigint, 0) AS duration_sum,
         COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '1 minute')::bigint AS last_minute
       FROM request_logs ${where}
       GROUP BY method, status`,
      params,
    );

    const methods: Record<string, number> = {};
    const status_codes: Record<string, number> = {};
    let total = 0;
    let successCount = 0;
    let durationSum = 0;
    let perMinute = 0;

    for (const row of result.rows) {
      const cnt = Number(row.cnt);
      total += cnt;
      successCount += Number(row.success_count);
      durationSum += Number(row.duration_sum);
      perMinute += Number(row.last_minute);
      methods[row.method as string] = (methods[row.method as string] ?? 0) + cnt;
      if (row.status !== null) {
        const statusKey = String(row.status);
        status_codes[statusKey] = (status_codes[statusKey] ?? 0) + cnt;
      }
    }

    const data: StatsResult = {
      total_requests: total,
      success_count: successCount,
      error_count: total - successCount,
      avg_duration_ms: total > 0 ? Math.round(durationSum / total) : 0,
      methods,
      status_codes,
      requests_per_minute: perMinute,
    };
    this.statsCache.set(key, { at: Date.now(), data });
    return data;
  }

  async chartStats(filter?: AggregateFilter & { range?: number }): Promise<ChartBucket[]> {
    const key = cacheKey(filter);
    const cached = this.chartCache.get(key);
    if (cached && Date.now() - cached.at < STATS_CACHE_TTL_MS) {
      return cached.data;
    }

    const range = filter?.range ?? 1800;
    const bucketSec = Math.max(1, Math.floor(range / 30));

    const params: unknown[] = [];
    const conditions = buildConditions(filter, params);
    conditions.push(`timestamp >= NOW() - ($${params.push(range)} || ' seconds')::interval`);
    const where = `WHERE ${conditions.join(' AND ')}`;
    const bucketParam = params.push(bucketSec);

    // The limit has to be on distinct time buckets. Limiting the raw rows caps
    // (time, project) pairs instead, so 10 projects used to yield 3 buckets.
    const result = await this.pool.query(
      `WITH buckets AS (
        SELECT
          to_timestamp(floor(extract(epoch FROM timestamp) / $${bucketParam}) * $${bucketParam}) AS time,
          project,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE success = true)::int AS success,
          COUNT(*) FILTER (WHERE success = false)::int AS errors,
          COALESCE(ROUND(AVG(duration_ms))::int, 0) AS avg_duration
        FROM request_logs ${where}
        GROUP BY time, project
      ),
      recent AS (
        SELECT DISTINCT time FROM buckets ORDER BY time DESC LIMIT 30
      )
      SELECT b.* FROM buckets b JOIN recent r ON b.time = r.time ORDER BY b.time ASC`,
      params,
    );

    const data = result.rows.map((row) => ({
      time: row.time instanceof Date ? row.time.toISOString() : row.time as string,
      project: row.project as string,
      total: row.total as number,
      success: row.success as number,
      errors: row.errors as number,
      avg_duration: row.avg_duration as number,
    }));
    this.chartCache.set(key, { at: Date.now(), data });
    return data;
  }

  async proxyStats(filter?: AggregateFilter): Promise<ProxyBucket[]> {
    const key = cacheKey(filter);
    const cached = this.proxyCache.get(key);
    if (cached && Date.now() - cached.at < STATS_CACHE_TTL_MS) {
      return cached.data;
    }

    const params: unknown[] = [];
    const conditions = buildConditions(filter, params);
    conditions.unshift('proxy_host IS NOT NULL');
    const where = `WHERE ${conditions.join(' AND ')}`;

    const result = await this.pool.query(
      `SELECT
        proxy_host || COALESCE(':' || proxy_port, '') AS proxy,
        project,
        COUNT(*)::int AS count,
        COUNT(*) FILTER (WHERE success = true)::int AS success,
        COUNT(*) FILTER (WHERE success = false)::int AS errors,
        COALESCE(SUM(response_size_bytes)::bigint, 0) AS total_size
      FROM request_logs ${where}
      GROUP BY proxy_host, proxy_port, project
      ORDER BY count DESC
      LIMIT 200`,
      params,
    );

    const data = result.rows.map((row) => ({
      proxy: row.proxy as string,
      project: row.project as string,
      count: row.count as number,
      success: row.success as number,
      errors: row.errors as number,
      total_size: Number(row.total_size),
    }));
    this.proxyCache.set(key, { at: Date.now(), data });
    return data;
  }

  async hostStats(filter?: AggregateFilter & { range?: number }): Promise<HostBucket[]> {
    const key = `host|${cacheKey(filter)}`;
    const cached = this.hostCache.get(key);
    if (cached && Date.now() - cached.at < STATS_CACHE_TTL_MS) {
      return cached.data;
    }

    const params: unknown[] = [];
    const conditions = buildConditions(filter, params);
    if (filter?.range !== undefined) {
      conditions.push(`timestamp >= NOW() - ($${params.push(filter.range)} || ' seconds')::interval`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.pool.query(
      `SELECT
         ${HOST_EXPR} AS host,
         COUNT(*)::int AS count,
         COUNT(*) FILTER (WHERE success = true)::int AS success,
         COUNT(*) FILTER (WHERE success = false)::int AS errors,
         COALESCE(ROUND(AVG(duration_ms))::int, 0) AS avg_duration,
         COALESCE(SUM(response_size_bytes)::bigint, 0) AS total_size
       FROM request_logs ${where}
       GROUP BY 1
       ORDER BY count DESC
       LIMIT 50`,
      params,
    );

    const data = result.rows.map((row) => ({
      host: row.host as string,
      count: row.count as number,
      success: row.success as number,
      errors: row.errors as number,
      avg_duration: row.avg_duration as number,
      total_size: Number(row.total_size),
    }));
    this.hostCache.set(key, { at: Date.now(), data });
    return data;
  }

  async projects(): Promise<string[]> {
    // Loose index scan: jumps between distinct values on idx_request_logs_project_timestamp
    // instead of scanning every row like SELECT DISTINCT does.
    const result = await this.pool.query(
      `WITH RECURSIVE distinct_projects AS (
         (SELECT project FROM request_logs ORDER BY project LIMIT 1)
         UNION ALL
         SELECT (
           SELECT project FROM request_logs
           WHERE project > d.project
           ORDER BY project LIMIT 1
         )
         FROM distinct_projects d
         WHERE d.project IS NOT NULL
       )
       SELECT project FROM distinct_projects WHERE project IS NOT NULL ORDER BY project`,
    );
    return result.rows.map((r) => r.project);
  }

  async count(): Promise<number> {
    const result = await this.pool.query(`SELECT COUNT(*)::bigint AS cnt FROM request_logs`);
    return Number(result.rows[0].cnt);
  }

  async clear(filter?: { project?: string; before?: string }): Promise<number> {
    if (filter?.project || filter?.before) {
      // Scoped delete: batched by ctid so a huge range never runs as one long
      // transaction. The insert buffer is left alone — retention passes through
      // here too and must not drop logs that have not been written yet.
      const params: unknown[] = [];
      const conditions: string[] = [];
      if (filter.project) conditions.push(`project = $${params.push(filter.project)}`);
      if (filter.before) conditions.push(`timestamp < $${params.push(filter.before)}`);
      const where = `WHERE ${conditions.join(' AND ')}`;

      let deleted = 0;
      for (;;) {
        const result = await this.pool.query(
          `DELETE FROM request_logs WHERE ctid = ANY(ARRAY(
             SELECT ctid FROM request_logs ${where} LIMIT ${TRIM_BATCH}
           ))`,
          params,
        );
        const n = result.rowCount ?? 0;
        deleted += n;
        if (n === 0) break;
      }

      if (filter.project) this.rowCounts.delete(filter.project);
      else this.rowCounts.clear();
      this.invalidateCaches();
      return deleted;
    }

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    const dropped = this.buffer.splice(0);
    for (const entry of dropped) entry.resolve();

    // TRUNCATE drops the table files outright — constant time regardless of row
    // count. A plain DELETE has to rewrite every row and every index entry
    // (~40s per million rows) and does not even give the disk space back.
    // lock_timeout keeps a long-running read from turning this into an
    // indefinite hang; the whole implicit transaction rolls back on timeout.
    const before = await this.count();
    await this.pool.query(
      `SET lock_timeout = '10s'; TRUNCATE TABLE request_logs; SET lock_timeout = 0;`,
    );
    this.insertsSinceCleanup.clear();
    this.rowCounts.clear();
    this.invalidateCaches();
    return before;
  }

  private invalidateCaches(): void {
    this.statsCache.clear();
    this.chartCache.clear();
    this.proxyCache.clear();
    this.hostCache.clear();
  }

  async close(): Promise<void> {
    await this.flush();
    this.closed = true;
    await this.pool.end();
  }
}
