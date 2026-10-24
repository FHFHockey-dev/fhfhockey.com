import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

// Two immutable fixture artifacts only. No Next/auth, source execution,
// outbound requests, directory serving or production data.
const checkpoint = readFileSync(new URL('./preview.html', import.meta.url));
const accepted = readFileSync(new URL('../slice-03-r1/preview.html', import.meta.url));
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  if (request.method !== 'GET' || !['/', '/player-cards', '/player-cards/functional'].includes(pathname)) {
    response.writeHead(404).end(); return;
  }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(pathname === '/player-cards/functional' ? accepted : checkpoint);
});
server.listen(3125, '127.0.0.1', () => console.log(JSON.stringify({ pid: process.pid, host: '127.0.0.1', port: 3125, syntheticOnly: true, checkpoint: '/player-cards', acceptedFunctional: '/player-cards/functional' })));
