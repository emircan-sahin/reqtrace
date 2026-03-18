import initCycleTLS from 'cycletls';
import { ReqtraceCore, CycleTlsAdapter } from 'reqtrace';

const core = new ReqtraceCore({
  serverUrl: 'http://localhost:3100',
  apiKey: process.env.API_KEY ?? 'reqtrace-dev-api-key-change-in-production',
  projectName: 'cycletls-demo',
  captureBody: true,
});

const cycleTLS = await initCycleTLS();
const adapter = new CycleTlsAdapter(cycleTLS, core);
adapter.install();

const urls = [
  'https://jsonplaceholder.typicode.com/todos/1',
  'https://jsonplaceholder.typicode.com/posts/1',
  'https://jsonplaceholder.typicode.com/users/1',
  'https://jsonplaceholder.typicode.com/comments/1',
  'https://jsonplaceholder.typicode.com/albums/1',
];

let i = 0;

const interval = setInterval(async () => {
  const url = urls[i % urls.length];
  const isPost = Math.random() > 0.8; // 20% POST

  try {
    if (isPost) {
      await cycleTLS.post(url, {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'test', body: `request #${i}` }),
      });
    } else {
      await cycleTLS.get(url, { headers: {} });
    }
  } catch {
    // errors are logged by reqtrace
  }

  i++;
}, 50);

process.on('SIGINT', async () => {
  clearInterval(interval);
  adapter.eject();
  core.destroy();
  await cycleTLS.exit();
  console.log(`\nStopped after ${i} requests.`);
  process.exit(0);
});

console.log('Sending CycleTLS requests every 50ms... Press Ctrl+C to stop.');
