// Offline exact-source expression probe. Never imports application modules.
const fs = require('fs');
const cp = require('child_process');
const vm = require('vm');
const crypto = require('crypto');
const ts = require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const target = '89da739cb45d7d572ed59bfa0b209c79c5d99299';
const sources = {};
function pinned(path) {
  const raw = cp.execFileSync('git', ['show', `${target}:${path}`]);
  if (!raw.equals(fs.readFileSync(path))) throw new Error(`Target mismatch: ${path}`);
  sources[path] = crypto.createHash('sha256').update(raw).digest('hex');
  return ts.createSourceFile(path, raw.toString(), ts.ScriptTarget.Latest, true);
}
function find(sf, name, declaration) {
  let result;
  function visit(n) {
    if ((declaration ? ts.isFunctionDeclaration(n) : ts.isVariableDeclaration(n)) && n.name?.getText(sf) === name) result = declaration ? n : n.initializer;
    ts.forEachChild(n, visit);
  }
  visit(sf);
  if (!result) throw new Error(name);
  return result.getText(sf);
}
function evaluate(expression, context) {
  const js = ts.transpileModule(`(${expression})`, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  return vm.runInNewContext(js, context);
}
const hook = pinned('web/components/HomePage/useHomepageGames.ts');
const route = pinned('web/pages/api/v1/games/index.js');
const task = find(hook, 'fetchGamesForDate', false);
async function runHook(payload, standings) {
  const state = {games:[{id:'old'}], error:null, loading:false, lastUpdatedAt:null};
  const requests = [];
  const context = {
    cancelled:false, currentDate:'2026-11-14', Date, console:{warn(){}},
    setGames:v=>state.games=v, setError:v=>state.error=v,
    setLoading:v=>state.loading=v, setLastUpdatedAt:v=>state.lastUpdatedAt=v,
    fetch:async url=>{requests.push({kind:'mock internal',url});return {ok:true,json:async()=>payload};},
    Fetch:async url=>{requests.push({kind:'mock provider',url});return {json:async()=>({standings})};},
  };
  await evaluate(task, context)();
  return {state,requests};
}
(async()=>{
  const malformed = await runHook({unexpected:'shape'}, []);
  if (malformed.state.games.length !== 0 || malformed.state.error !== null) throw new Error('Malformed scenario changed');
  const missingRecord = await runHook([{id:1,gameState:'FUT',homeTeam:{abbrev:'TOR'},awayTeam:{abbrev:'BOS'}}], [{teamAbbrev:{default:'TOR'},wins:null,losses:4,otLosses:1}]);
  if (missingRecord.state.games[0].homeTeam.record !== '0-4-1') throw new Error('Record scenario changed');
  let status, body;
  const handler = find(route,'handler',true).replace(/^export default /,'');
  await evaluate(handler,{
    fetch:async()=>({ok:true,json:async()=>({gameWeek:[{date:'2026-11-15',games:[{id:99,gameDate:'2026-11-15'}]}]})}),
    enrichHomepageGames:async({games})=>games, supabaseServer:{},
  })({query:{date:'2026-11-14'}},{status:v=>{status=v;return {json:v=>body=v};}});
  if (status!==200 || body[0].gameDate!=='2026-11-15') throw new Error('Date scenario changed');
  const result={target,sources,malformed,missingRecord,wrongDate:{requested:'2026-11-14',status,body},boundary:'Mock functions only; zero app imports, provider/API/database requests or writes.'};
  fs.writeFileSync('tasks/artifacts/calculation-inventory-2026-11-10/master/astra-full-audit-20261114/homepage-probe-output.json',JSON.stringify(result,null,2)+'\n');
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
})().catch(e=>{process.stderr.write(String(e)+'\n');process.exitCode=1;});
