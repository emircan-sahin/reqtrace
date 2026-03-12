import axios from 'axios';
import { ReqtraceCore, AxiosAdapter } from 'reqtrace';

const core = new ReqtraceCore({
  serverUrl: 'http://localhost:3100',
  apiKey: process.env.API_KEY ?? 'reqtrace-dev-api-key-change-in-production',
  projectName: 'demo',
  captureBody: true,
});

const adapter = new AxiosAdapter(axios, core);
adapter.install();

function randomProxy() {
  const port = 8080 + Math.floor(Math.random() * 11); // 8080–8090
  return { host: '127.0.0.1', port };
}

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
  const useProxy = Math.random() > 0.3; // 70% proxy
  const isPost = Math.random() > 0.8;   // 20% POST

  try {
    if (isPost) {
      await axios.post(url, { title: 'test', body: `request #${i}` },
        useProxy ? { proxy: randomProxy() } : undefined);
    } else {
      await axios.get(url, useProxy ? { proxy: randomProxy() } : undefined);
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
