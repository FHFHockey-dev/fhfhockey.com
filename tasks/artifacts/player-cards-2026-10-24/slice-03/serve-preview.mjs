import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

// No source execution, credentials, upstream access, directory serving or app auth.
const html = readFileSync(new URL('./preview.html', import.meta.url));
const server = createServer((request, response) => {
  if (request.method !== 'GET' || !['/', '/player-cards'].includes(new URL(request.url, 'http://127.0.0.1').pathname)) {
    response.writeHead(404).end(); return;
  }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(html);
});
server.listen(3125, '127.0.0.1', () => console.log(JSON.stringify({ pid: process.pid, host: '127.0.0.1', port: 3125, syntheticOnly: true })));
