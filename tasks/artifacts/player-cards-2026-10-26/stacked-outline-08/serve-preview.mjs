import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

// Immutable, self-contained local checkpoint artifacts. No application/auth hydration,
// directory serving, API handlers or outbound requests.
const comparison04=readFileSync(new URL('../composition-variants-04/comparison.html',import.meta.url));
const studio04=readFileSync(new URL('../composition-variants-04/preview.html',import.meta.url));
const comparison05=readFileSync(new URL('../composition-variants-05/comparison.html',import.meta.url));
const studio05=readFileSync(new URL('../composition-variants-05/preview.html',import.meta.url));
const comparison06=readFileSync(new URL('../outline-06/comparison.html',import.meta.url));
const studio06=readFileSync(new URL('../outline-06/preview.html',import.meta.url));
const comparison07=readFileSync(new URL('../outline-colors-07/comparison.html',import.meta.url));
const studio07=readFileSync(new URL('../outline-colors-07/preview.html',import.meta.url));
const candidate = readFileSync(new URL('./preview.html', import.meta.url));
const previousHero = readFileSync(new URL('../../player-cards-2026-10-25/hero-share-checkpoint-01/preview.html', import.meta.url));
const comparison = readFileSync(new URL('../../player-cards-2026-10-25/portrait-treatments-01/comparison.html', import.meta.url));
const functional = readFileSync(new URL('../../player-cards-2026-10-24/slice-03-r1/preview.html', import.meta.url));
const editorial = readFileSync(new URL('../../player-cards-2026-10-24/visual-checkpoint-01/preview.html', import.meta.url));
const compositions = readFileSync(new URL('./comparison.html', import.meta.url));
const priorTeamColors = readFileSync(new URL('../../player-cards-2026-10-25/team-colors-default-01/preview.html', import.meta.url));
const observedEvidence = readFileSync(new URL('../observed-view-01/preview.html', import.meta.url));
const previousComparison = readFileSync(new URL('../composition-variants-01/comparison.html', import.meta.url));
const previousComposition = readFileSync(new URL('../composition-variants-01/preview.html', import.meta.url));
const comparison02=readFileSync(new URL('../composition-variants-02/comparison.html', import.meta.url));
const studio02=readFileSync(new URL('../composition-variants-02/preview.html', import.meta.url));
const comparison03=readFileSync(new URL('../composition-variants-03/comparison.html', import.meta.url));
const studio03=readFileSync(new URL('../composition-variants-03/preview.html', import.meta.url));
const routes = new Map([
  ['/player-cards/compositions-07',comparison07], ['/player-cards/studio-07',studio07],
  ['/player-cards/compositions-06',comparison06], ['/player-cards/studio-06',studio06],
  ['/player-cards/compositions-05',comparison05], ['/player-cards/studio-05',studio05],
  ['/player-cards/compositions-04',comparison04], ['/player-cards/studio-04',studio04],
  ['/player-cards/compositions-03',comparison03], ['/player-cards/studio-03',studio03],
  ['/player-cards/compositions-02',comparison02], ['/player-cards/studio-02',studio02], ['/player-cards/studio',candidate],
  ['/player-cards/compositions-01', previousComparison], ['/player-cards/previous-composition', previousComposition],
  ['/player-cards/compositions', compositions], ['/player-cards/prior-team-colors', priorTeamColors], ['/player-cards/observed-evidence', observedEvidence],
  ['/', compositions], ['/player-cards', compositions], ['/social-share/player-cards', candidate],
  ['/player-cards/portraits', comparison], ['/player-cards/hero', previousHero], ['/player-cards/functional', functional], ['/player-cards/editorial', editorial],
]);
const server = createServer((request, response) => {
  let body;
  try { body = routes.get(new URL(request.url, 'http://127.0.0.1').pathname); } catch { /* Return 404. */ }
  if (request.method !== 'GET' || !body) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(body);
});
server.listen(3125, '127.0.0.1', () => console.log(JSON.stringify({ pid: process.pid, host: '127.0.0.1', port: 3125, liveActivation: false, premiumActivation: false, candidate: '/player-cards', priorFunctional: '/player-cards/functional', priorEditorial: '/player-cards/editorial' })));
