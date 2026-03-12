import type pg from 'pg';
import type { RequestLog, LogFilter, StatsResult, ChartBucket, ProxyBucket, LogStore, LogSummary } from '../types.js';

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

const MAX_PER_PROJECT = 5_000;
const CLEANUP_INTERVAL = 100;

export class PostgresStore implements LogStore {
  private insertCounts = new Map<string, number>();

  constructor(private pool: pg.Pool) {}

  async add(log: RequestLog): Promise<void> {
    await this.pool.query(
      `INSERT INTO request_logs (
        id, project, url, method, status, duration_ms,
        proxy_host, proxy_port, response_size_bytes,
        request_headers, response_headers,
        request_body, response_body,
        error_message, success, timestamp
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      ON CONFLICT (id) DO NOTHING`,
      [
        log.id, log.project, log.url, log.method, log.status, log.duration_ms,
        log.proxy_host, log.proxy_port, log.response_size_bytes,
        JSON.stringify(log.request_headers), JSON.stringify(log.response_headers),
        log.request_body ?? null, log.response_body ?? null,
        log.error_message, log.success, log.timestamp,
      ],
    );

    const count = (this.insertCounts.get(log.project) ?? 0) + 1;
    this.insertCounts.set(log.project, count);

    if (count % CLEANUP_INTERVAL === 0) {
      await this.pool.query(
        `DELETE FROM request_logs WHERE id IN (
          SELECT id FROM request_logs
          WHERE project = $1
          ORDER BY timestamp DESC
          OFFSET $2
        )`,
        [log.project, MAX_PER_PROJECT],
      );
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

  async list(filter: LogFilter): Promise<{ logs: LogSummary[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filter.project) {
      conditions.push(`project = $${idx++}`);
      params.push(filter.project);
    }
    if (filter.method) {
      conditions.push(`method = $${idx++}`);
      params.push(filter.method.toUpperCase());
    }
    if (filter.status !== undefined) {
      conditions.push(`status = $${idx++}`);
      params.push(filter.status);
    }
    if (filter.success !== undefined) {
      conditions.push(`success = $${idx++}`);
      params.push(filter.success);
    }
    if (filter.url) {
      conditions.push(`url ILIKE $${idx++}`);
      params.push(`%${filter.url}%`);
    }
    if (filter.search) {
      const q = `%${filter.search}%`;
      conditions.push(`(
        url ILIKE $${idx} OR
        method ILIKE $${idx} OR
        CAST(status AS TEXT) LIKE $${idx} OR
        error_message ILIKE $${idx} OR
        proxy_host ILIKE $${idx}
      )`);
      params.push(q);
      idx++;
    }
    if (filter.from) {
      conditions.push(`timestamp >= $${idx++}`);
      params.push(filter.from);
    }
    if (filter.to) {
      conditions.push(`timestamp <= $${idx++}`);
      params.push(filter.to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.pool.query(
      `SELECT COUNT(*)::int AS total FROM request_logs ${where}`,
      params,
    );
    const total = countResult.rows[0].total;

    const limit = filter.limit ?? 100;
    const offset = filter.offset ?? 0;

    const dataResult = await this.pool.query(
      `SELECT ${SUMMARY_COLUMNS} FROM request_logs ${where} ORDER BY timestamp DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset],
    );

    return { logs: dataResult.rows.map(rowToSummary), total };
  }

  async stats(filter?: { project?: string; search?: string }): Promise<StatsResult> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filter?.project) {
      conditions.push(`project = $${idx++}`);
      params.push(filter.project);
    }
    if (filter?.search) {
      const q = `%${filter.search}%`;
      conditions.push(`(
        url ILIKE $${idx} OR
        method ILIKE $${idx} OR
        CAST(status AS TEXT) LIKE $${idx} OR
        error_message ILIKE $${idx} OR
        proxy_host ILIKE $${idx}
      )`);
      params.push(q);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const andStatus = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')} AND status IS NOT NULL`
      : 'WHERE status IS NOT NULL';

    const result = await this.pool.query(
      `WITH agg AS (
        SELECT
          COUNT(*)::int AS total_requests,
          COUNT(*) FILTER (WHERE success = true)::int AS success_count,
          COUNT(*) FILTER (WHERE success = false)::int AS error_count,
          COALESCE(ROUND(AVG(duration_ms))::int, 0) AS avg_duration_ms,
          COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '1 minute')::int AS requests_per_minute
        FROM request_logs ${where}
      ),
      methods AS (
        SELECT COALESCE(json_object_agg(method, cnt), '{}') AS methods
        FROM (SELECT method, COUNT(*)::int AS cnt FROM request_logs ${where} GROUP BY method) t
      ),
      status_codes AS (
        SELECT COALESCE(json_object_agg(status::text, cnt), '{}') AS status_codes
        FROM (SELECT status, COUNT(*)::int AS cnt FROM request_logs ${andStatus} GROUP BY status) t
      )
      SELECT agg.*, methods.methods, status_codes.status_codes
      FROM agg, methods, status_codes`,
      params,
    );

    const row = result.rows[0];
    return {
      total_requests: row.total_requests,
      success_count: row.success_count,
      error_count: row.error_count,
      avg_duration_ms: row.avg_duration_ms,
      methods: typeof row.methods === 'string' ? JSON.parse(row.methods) : row.methods,
      status_codes: typeof row.status_codes === 'string' ? JSON.parse(row.status_codes) : row.status_codes,
      requests_per_minute: row.requests_per_minute,
    };
  }

  async chartStats(filter?: { project?: string; search?: string; interval?: number }): Promise<ChartBucket[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    const interval = filter?.interval ?? 60;

    if (filter?.project) {
      conditions.push(`project = $${idx++}`);
      params.push(filter.project);
    }
    if (filter?.search) {
      const q = `%${filter.search}%`;
      conditions.push(`(
        url ILIKE $${idx} OR
        method ILIKE $${idx} OR
        CAST(status AS TEXT) LIKE $${idx} OR
        error_message ILIKE $${idx} OR
        proxy_host ILIKE $${idx}
      )`);
      params.push(q);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.pool.query(
      `SELECT
        to_timestamp(floor(extract(epoch FROM timestamp) / ${interval}) * ${interval}) AS time,
        project,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE success = true)::int AS success,
        COUNT(*) FILTER (WHERE success = false)::int AS errors,
        COALESCE(ROUND(AVG(duration_ms))::int, 0) AS avg_duration
      FROM request_logs ${where}
      GROUP BY time, project
      ORDER BY time ASC`,
      params,
    );

    return result.rows.map((row) => ({
      time: row.time instanceof Date ? row.time.toISOString() : row.time as string,
      project: row.project as string,
      total: row.total as number,
      success: row.success as number,
      errors: row.errors as number,
      avg_duration: row.avg_duration as number,
    }));
  }

  async proxyStats(filter?: { project?: string; search?: string }): Promise<ProxyBucket[]> {
    const conditions: string[] = ['proxy_host IS NOT NULL'];
    const params: unknown[] = [];
    let idx = 1;

    if (filter?.project) {
      conditions.push(`project = $${idx++}`);
      params.push(filter.project);
    }
    if (filter?.search) {
      const q = `%${filter.search}%`;
      conditions.push(`(
        url ILIKE $${idx} OR
        method ILIKE $${idx} OR
        CAST(status AS TEXT) LIKE $${idx} OR
        error_message ILIKE $${idx} OR
        proxy_host ILIKE $${idx}
      )`);
      params.push(q);
      idx++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const result = await this.pool.query(
      `SELECT
        proxy_host || ':' || proxy_port AS proxy,
        project,
        COUNT(*)::int AS count,
        COUNT(*) FILTER (WHERE success = true)::int AS success,
        COUNT(*) FILTER (WHERE success = false)::int AS errors,
        COALESCE(SUM(response_size_bytes)::bigint, 0) AS total_size
      FROM request_logs ${where}
      GROUP BY proxy_host, proxy_port, project
      ORDER BY count DESC`,
      params,
    );

    return result.rows.map((row) => ({
      proxy: row.proxy as string,
      project: row.project as string,
      count: row.count as number,
      success: row.success as number,
      errors: row.errors as number,
      total_size: Number(row.total_size),
    }));
  }

  async projects(): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT DISTINCT project FROM request_logs ORDER BY project`,
    );
    return result.rows.map((r) => r.project);
  }

  async count(): Promise<number> {
    const result = await this.pool.query(`SELECT COUNT(*)::int AS cnt FROM request_logs`);
    return result.rows[0].cnt;
  }

  async clear(): Promise<void> {
    await this.pool.query(`DELETE FROM request_logs`);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
