import pg from 'pg';

export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: 'reqtrace',
  });
}

export async function initDb(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS request_logs (
      id TEXT PRIMARY KEY,
      project TEXT NOT NULL,
      url TEXT NOT NULL,
      method TEXT NOT NULL,
      status INTEGER,
      duration_ms INTEGER NOT NULL,
      proxy_host TEXT,
      proxy_port INTEGER,
      response_size_bytes INTEGER,
      request_headers JSONB NOT NULL DEFAULT '{}',
      response_headers JSONB NOT NULL DEFAULT '{}',
      request_body TEXT,
      response_body TEXT,
      error_message TEXT,
      success BOOLEAN NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_request_logs_project_timestamp ON request_logs(project, timestamp DESC);

    -- Dropped: every extra index is paid on each insert and on retention deletes.
    -- project/project_id are covered by (project, timestamp); a full index on
    -- method/success is too low-cardinality for the planner to ever prefer it
    -- (the partial error index above is the selective half of success).
    DROP INDEX IF EXISTS idx_request_logs_project;
    DROP INDEX IF EXISTS idx_request_logs_project_id;
    DROP INDEX IF EXISTS idx_request_logs_method;
    DROP INDEX IF EXISTS idx_request_logs_success;

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS token TEXT;
  `);

  await createFilterIndexes(pool);
}

/**
 * Built CONCURRENTLY and one statement at a time: on an existing table with
 * millions of rows a plain CREATE INDEX holds a lock that blocks ingestion for
 * as long as the build takes. CONCURRENTLY cannot run inside a transaction, so
 * these cannot join the DDL batch above.
 */
async function createFilterIndexes(pool: pg.Pool): Promise<void> {
  const indexes = [
    // Status filtering ("show me the 5xx") without this walks the timestamp
    // index until it finds enough matches: measured 675ms per million rows when
    // the matching rows are old, 2.5ms with the index.
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_request_logs_status_timestamp
       ON request_logs(status, timestamp DESC)`,
    // Partial: indexes only the failures, so it stays tiny (~600KB per million
    // rows at a 3% error rate) while making the error feed an index lookup.
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_request_logs_errors
       ON request_logs(timestamp DESC) WHERE success = false`,
  ];

  for (const sql of indexes) {
    try {
      await pool.query(sql);
    } catch (err) {
      // A failed concurrent build leaves an invalid index behind; log it rather
      // than refusing to start, since the server works without it (just slower).
      console.error('[reqtrace] index build failed, continuing:', err);
    }
  }
}
