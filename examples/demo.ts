import axios from 'axios';
import { ReqtraceCore, AxiosAdapter } from 'reqtrace';

// Point to your self-hosted server
const core = new ReqtraceCore({
  serverUrl: 'http://localhost:3100',
  captureBody: true,
});

const adapter = new AxiosAdapter(axios, core);
adapter.install();

async function main() {
  console.log('--- Successful request ---');
  await axios.get('https://jsonplaceholder.typicode.com/todos/1');

  console.log('\n--- POST request ---');
  await axios.post('https://jsonplaceholder.typicode.com/posts', {
    title: 'test',
    body: 'reqtrace demo',
  });

  console.log('\n--- Failed request (404) ---');
  try {
    await axios.get('https://jsonplaceholder.typicode.com/todos/99999999');
  } catch {
    // error is logged
  }

  // Give WS transport time to flush
  await new Promise((r) => setTimeout(r, 500));

  // Cleanup
  adapter.eject();
  core.destroy();

  console.log('\nDone. Check http://localhost:3100/api/logs');
}

main();
