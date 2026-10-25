import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

// Immutable, self-contained fixture artifacts. No application/auth hydration,
// directory serving, API handlers or outbound requests.
const candidate = readFileSync(new URL('./preview.html', import.meta.url));
const previousHero = readFileSync(new URL('../hero-share-checkpoint-01/preview.html', import.meta.url));
const comparison = readFileSync(new URL('../portrait-treatments-01/comparison.html', import.meta.url));
const functional = readFileSync(new URL('../../player-cards-2026-10-24/slice-03-r1/preview.html', import.meta.url));
const editorial = readFileSync(new URL('../../player-cards-2026-10-24/visual-checkpoint-01/preview.html', import.meta.url));
const routes = new Map([
  ['/', candidate], ['/player-cards', candidate], ['/social-share/player-cards', candidate],
  ['/player-cards/portraits', comparison], ['/player-cards/hero', previousHero], ['/player-cards/functional', functional], ['/player-cards/editorial', editorial],
]);
const server = createServer((request, response) => {
  let body;
  try { body = routes.get(new URL(request.url, 'http://127.0.0.1').pathname); } catch { /* Return 404. */ }
  if (request.method !== 'GET' || !body) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(body);
});
server.listen(3125, '127.0.0.1', () => console.log(JSON.stringify({ pid: process.pid, host: '127.0.0.1', port: 3125, syntheticStatisticsOnly: true, candidate: '/player-cards', priorFunctional: '/player-cards/functional', priorEditorial: '/player-cards/editorial' })));
