import { createApp } from './app.js';

const PORT = parseInt(process.env.PORT ?? '3100', 10);
const HOST = process.env.HOST ?? '127.0.0.1';

async function main() {
  const app = await createApp();

  await app.listen({ port: PORT, host: HOST });
  console.log(`[reqtrace] server listening on http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
