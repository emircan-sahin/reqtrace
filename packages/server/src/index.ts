import { env } from './env.js';
import { createApp } from './app.js';
import { createPool, initDb } from './db/index.js';
import { PostgresStore } from './store/pg.js';

async function main() {
  const pool = createPool(env.DATABASE_URL);
  await initDb(pool);
  const store = new PostgresStore(pool);

  const app = await createApp({
    store,
    pool,
    jwtSecret: env.JWT_SECRET,
    apiKey: env.API_KEY,
  });

  // Time-based retention, on top of the per-project row cap. Runs hourly and
  // deletes in bounded batches, so it never blocks ingestion.
  const retentionMs = env.RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const retentionTimer = retentionMs > 0
    ? setInterval(() => {
        const before = new Date(Date.now() - retentionMs).toISOString();
        store.clear({ before })
          .then((deleted) => {
            if (deleted > 0) console.log(`[reqtrace] retention removed ${deleted} logs older than ${env.RETENTION_DAYS}d`);
          })
          .catch((err) => console.error('[reqtrace] retention failed:', err));
      }, 60 * 60 * 1000)
    : null;
  retentionTimer?.unref?.();

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[reqtrace] ${signal} received, shutting down`);
    try {
      if (retentionTimer) clearInterval(retentionTimer);
      await app.close();
      // Flushes the pending insert buffer and ends the pool.
      await store.close();
    } catch (err) {
      console.error('[reqtrace] shutdown error:', err);
    }
    process.exit(0);
  };

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => void shutdown(signal));
  }

  await app.listen({ port: env.PORT, host: env.HOST });
  console.log(`[reqtrace] server listening on http://${env.HOST}:${env.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
