import pg from 'pg';

export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({ connectionString });
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

    CREATE INDEX IF NOT EXISTS idx_request_logs_project ON request_logs(project);
    CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_request_logs_method ON request_logs(method);
    CREATE INDEX IF NOT EXISTS idx_request_logs_success ON request_logs(success);

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS token TEXT;
  `);
}
