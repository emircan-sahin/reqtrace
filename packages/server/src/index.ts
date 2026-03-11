import { env } from './env.js';
import { createApp } from './app.js';
import { createPool, initDb } from './db/index.js';
import { PostgresStore } from './store/pg.js';

async function main() {
  const pool = createPool(env.DATABASE_URL);
  await initDb(pool);
  const store = new PostgresStore(pool);

  const app = await createApp({ store });

  await app.listen({ port: env.PORT, host: env.HOST });
  console.log(`[reqtrace] server listening on http://${env.HOST}:${env.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
