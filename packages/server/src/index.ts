import { existsSync } from 'node:fs';
import dotenv from 'dotenv';

dotenv.config({ path: existsSync('.env') ? '.env' : '.env.example' });

import { createApp } from './app.js';
import { createPool, initDb } from './db/index.js';
import { PostgresStore } from './store/pg.js';
import type { LogStore } from './types.js';

const PORT = parseInt(process.env.PORT ?? '3100', 10);
const HOST = process.env.HOST ?? '127.0.0.1';
const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  let store: LogStore | undefined;

  if (DATABASE_URL) {
    const pool = createPool(DATABASE_URL);
    await initDb(pool);
    store = new PostgresStore(pool);
    console.log('[reqtrace] using PostgreSQL store');
  } else {
    console.log('[reqtrace] using in-memory store (set DATABASE_URL for PostgreSQL)');
  }

  const app = await createApp({ store });

  await app.listen({ port: PORT, host: HOST });
  console.log(`[reqtrace] server listening on http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
