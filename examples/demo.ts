import axios from 'axios';
import { ReqtraceCore, AxiosAdapter } from 'reqtrace';

const core = new ReqtraceCore({
  serverUrl: 'http://localhost:3100',
  projectName: 'demo',
  captureBody: true,
});

const adapter = new AxiosAdapter(axios, core);
adapter.install();

const urls = [
  'https://jsonplaceholder.typicode.com/todos/1',
  'https://jsonplaceholder.typicode.com/posts/1',
  'https://jsonplaceholder.typicode.com/users/1',
  'https://jsonplaceholder.typicode.com/comments/1',
  'https://jsonplaceholder.typicode.com/todos/99999999',
];

const methods = ['get', 'get', 'get', 'get', 'post'] as const;

let i = 0;

const interval = setInterval(async () => {
  const idx = i % urls.length;
  const method = methods[idx];
  const url = urls[idx];

  try {
    if (method === 'post') {
      await axios.post(url, { title: 'test', body: `request #${i}` });
    } else {
      await axios.get(url);
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
