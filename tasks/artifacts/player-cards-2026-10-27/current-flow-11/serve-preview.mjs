import { createServer } from 'node:http';
import { readFileSync, appendFileSync } from 'node:fs';
import { loadCurrentNhlCard } from './provider.mjs';
import { parseCurrentNhlRequest } from './provider-contract.mjs';

// Immutable, self-contained local checkpoint artifacts. No application/auth hydration,
// directory serving, API handlers or outbound requests.
const comparison04=readFileSync(new URL("file:///Users/tim/Code/fhfhockey.com/tasks/artifacts/player-cards-2026-10-26/composition-variants-04/comparison.html"));
const studio04=readFileSync(new URL("file:///Users/tim/Code/fhfhockey.com/tasks/artifacts/player-cards-2026-10-26/composition-variants-04/preview.html"));
const comparison05=readFileSync(new URL("file:///Users/tim/Code/fhfhockey.com/tasks/artifacts/player-cards-2026-10-26/composition-variants-05/comparison.html"));
const studio05=readFileSync(new URL("file:///Users/tim/Code/fhfhockey.com/tasks/artifacts/player-cards-2026-10-26/composition-variants-05/preview.html"));
const comparison06=readFileSync(new URL("file:///Users/tim/Code/fhfhockey.com/tasks/artifacts/player-cards-2026-10-26/outline-06/comparison.html"));
const studio06=readFileSync(new URL("file:///Users/tim/Code/fhfhockey.com/tasks/artifacts/player-cards-2026-10-26/outline-06/preview.html"));
const comparison07=readFileSync(new URL("file:///Users/tim/Code/fhfhockey.com/tasks/artifacts/player-cards-2026-10-26/outline-colors-07/comparison.html"));
const studio07=readFileSync(new URL("file:///Users/tim/Code/fhfhockey.com/tasks/artifacts/player-cards-2026-10-26/outline-colors-07/preview.html"));
const candidate = readFileSync(new URL("file:///Users/tim/Code/fhfhockey.com/tasks/artifacts/player-cards-2026-10-26/outline-editor-09/preview.html"));
const previousHero = readFileSync(new URL("file:///Users/tim/Code/fhfhockey.com/tasks/artifacts/player-cards-2026-10-25/hero-share-checkpoint-01/preview.html"));
const comparison = readFileSync(new URL("file:///Users/tim/Code/fhfhockey.com/tasks/artifacts/player-cards-2026-10-25/portrait-treatments-01/comparison.html"));
const functional = readFileSync(new URL("file:///Users/tim/Code/fhfhockey.com/tasks/artifacts/player-cards-2026-10-24/slice-03-r1/preview.html"));
const editorial = readFileSync(new URL("file:///Users/tim/Code/fhfhockey.com/tasks/artifacts/player-cards-2026-10-24/visual-checkpoint-01/preview.html"));
const compositions = readFileSync(new URL("file:///Users/tim/Code/fhfhockey.com/tasks/artifacts/player-cards-2026-10-26/stacked-outline-08/comparison.html"));
const prior08 = readFileSync(new URL("file:///Users/tim/Code/fhfhockey.com/tasks/artifacts/player-cards-2026-10-26/stacked-outline-08/preview.html"));
const retained = readFileSync(new URL("file:///Users/tim/Code/fhfhockey.com/tasks/artifacts/player-cards-2026-10-26/current-data-01/approved-snapshot-02/preview.html"));
const priorTeamColors = readFileSync(new URL("file:///Users/tim/Code/fhfhockey.com/tasks/artifacts/player-cards-2026-10-25/team-colors-default-01/preview.html"));
const observedEvidence = readFileSync(new URL("file:///Users/tim/Code/fhfhockey.com/tasks/artifacts/player-cards-2026-10-26/observed-view-01/preview.html"));
const previousComparison = readFileSync(new URL("file:///Users/tim/Code/fhfhockey.com/tasks/artifacts/player-cards-2026-10-26/composition-variants-01/comparison.html"));
const previousComposition = readFileSync(new URL("file:///Users/tim/Code/fhfhockey.com/tasks/artifacts/player-cards-2026-10-26/composition-variants-01/preview.html"));
const comparison02=readFileSync(new URL("file:///Users/tim/Code/fhfhockey.com/tasks/artifacts/player-cards-2026-10-26/composition-variants-02/comparison.html"));
const studio02=readFileSync(new URL("file:///Users/tim/Code/fhfhockey.com/tasks/artifacts/player-cards-2026-10-26/composition-variants-02/preview.html"));
const comparison03=readFileSync(new URL("file:///Users/tim/Code/fhfhockey.com/tasks/artifacts/player-cards-2026-10-26/composition-variants-03/comparison.html"));
const studio03=readFileSync(new URL("file:///Users/tim/Code/fhfhockey.com/tasks/artifacts/player-cards-2026-10-26/composition-variants-03/preview.html"));
const currentFlow = readFileSync(new URL('./preview.html', import.meta.url));
const routes = new Map([
  ['/player-cards/current',currentFlow], ['/player-cards/current-11',currentFlow],
  ['/player-cards/customizer',candidate], ['/player-cards/nhl-retained',retained],
  ['/player-cards/compositions-08',compositions], ['/player-cards/studio-08',prior08],
  ['/player-cards/compositions-07',comparison07], ['/player-cards/studio-07',studio07],
  ['/player-cards/compositions-06',comparison06], ['/player-cards/studio-06',studio06],
  ['/player-cards/compositions-05',comparison05], ['/player-cards/studio-05',studio05],
  ['/player-cards/compositions-04',comparison04], ['/player-cards/studio-04',studio04],
  ['/player-cards/compositions-03',comparison03], ['/player-cards/studio-03',studio03],
  ['/player-cards/compositions-02',comparison02], ['/player-cards/studio-02',studio02], ['/player-cards/studio',candidate],
  ['/player-cards/compositions-01', previousComparison], ['/player-cards/previous-composition', previousComposition],
  ['/player-cards/compositions', candidate], ['/player-cards/prior-team-colors', priorTeamColors], ['/player-cards/observed-evidence', observedEvidence],
  ['/', currentFlow], ['/player-cards', currentFlow], ['/social-share/player-cards', candidate],
  ['/player-cards/portraits', comparison], ['/player-cards/hero', previousHero], ['/player-cards/functional', functional], ['/player-cards/editorial', editorial],
]);
const captureBase = new URL('../../player-cards-2026-10-26/current-data-01/approved-snapshot-02/',import.meta.url);
const rawInputs = Object.fromEntries(['landing','game-log','team-schedule','RECEIPT'].map(name=>[name,JSON.parse(readFileSync(new URL(name+'.json',captureBase),'utf8'))]));
globalThis.fetch = async()=>{throw new Error('Preview server denies every outbound fetch');};
const server = createServer(async (request, response) => {
  const url = new URL(request.url,'http://127.0.0.1:3125');
  if(url.pathname==='/api/v1/player-cards'){
    response.setHeader('Cache-Control','private, no-store');response.setHeader('Content-Type','application/json');
    if(request.method!=='GET'){response.writeHead(405).end(JSON.stringify({error:'GET required'}));return;}
    const paths=[];let status=200,result;
    try{
      const query=Object.fromEntries(url.searchParams);
      if([...url.searchParams.keys()].length!==Object.keys(query).length)throw new Error('Duplicate query fields');
      const selection=parseCurrentNhlRequest(query);
      result=await loadCurrentNhlCard(selection,async sourcePath=>{paths.push(sourcePath);if(sourcePath.endsWith('/landing'))return rawInputs.landing;if(sourcePath.includes('/game-log/'))return rawInputs['game-log'];if(sourcePath==='/club-schedule-season/TBL/20262027')return rawInputs['team-schedule'];throw new Error('Uncaptured source path');},()=>new Date(rawInputs.RECEIPT.finishedAt),'nhl-retained');
    }catch{status=502;result={error:'Uncaptured or unverified player. No upstream request made.'};}
    response.setHeader('X-FHFH-Fixture-Provider-Paths',JSON.stringify(paths));
    appendFileSync(new URL('./local-api-receipts.jsonl',import.meta.url),JSON.stringify({at:new Date().toISOString(),query:url.search,status,fixtureProviderPaths:paths,outboundRequests:0})+'\n');
    response.writeHead(status).end(JSON.stringify(result));return;
  }
  let body;
  try { body = routes.get(new URL(request.url, 'http://127.0.0.1').pathname); } catch { /* Return 404. */ }
  if (request.method !== 'GET' || !body) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(body);
});
server.listen(3125, '127.0.0.1', () => console.log(JSON.stringify({ pid: process.pid, host: '127.0.0.1', port: 3125, liveActivation: false, premiumActivation: false, candidate: '/player-cards/current', priorFunctional: '/player-cards/functional', priorEditorial: '/player-cards/editorial' })));
