import axios from 'axios';
import { ReqtraceCore, AxiosAdapter } from 'reqtrace';

const core = new ReqtraceCore({
  serverUrl: 'http://localhost:3100',
  projectName: 'demo',
  captureBody: true,
});

const adapter = new AxiosAdapter(axios, core);
adapter.install();

const requests = [
  { url: 'https://jsonplaceholder.typicode.com/todos/1', method: 'get' as const },
  { url: 'https://jsonplaceholder.typicode.com/posts/1', method: 'get' as const },
  { url: 'https://jsonplaceholder.typicode.com/users/1', method: 'get' as const,
    proxy: { host: '127.0.0.1', port: 8080 } },
  { url: 'https://jsonplaceholder.typicode.com/comments/1', method: 'get' as const,
    proxy: { host: 'proxy.example.com', port: 3128 } },
  { url: 'https://jsonplaceholder.typicode.com/todos/99999999', method: 'post' as const },
];

let i = 0;

const interval = setInterval(async () => {
  const { url, method, proxy } = requests[i % requests.length];

  try {
    if (method === 'post') {
      await axios.post(url, { title: 'test', body: `request #${i}` }, { proxy });
    } else {
      await axios.get(url, { proxy });
    }
  } catch {
    // errors are logged by reqtrace
  }

  i++;
}, 50);

process.on('SIGINT', () => {
  clearInterval(interval);
  adapter.eject();
  core.destroy();
  console.log(`\nStopped after ${i} requests.`);
  process.exit(0);
});

console.log('Sending requests every 50ms... Press Ctrl+C to stop.');
