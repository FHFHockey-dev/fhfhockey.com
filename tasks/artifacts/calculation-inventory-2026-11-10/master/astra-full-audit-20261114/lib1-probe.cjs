// Offline exact-source extraction only; no application imports or real fetches.
const fs = require('fs'), vm = require('vm'), assert = require('assert'), crypto = require('crypto');
const ts = require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const root = '/Users/tim/Code/fhfhockey.com/';
const receipts = [];
function source(path) {
  const text = fs.readFileSync(root + path, 'utf8');
  receipts.push({path, sha256: crypto.createHash('sha256').update(text).digest('hex')});
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
}
function find(sf, predicate) {
  let found;
  function walk(node) { if (!found && predicate(node)) found = node; ts.forEachChild(node, walk); }
  walk(sf); assert(found, 'exact source node exists'); return found.getText(sf);
}
function run(code, globals = {}) {
  const context = vm.createContext({...globals});
  const js = ts.transpileModule(code, {compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None}}).outputText;
  vm.runInContext(js, context, {timeout: 1000}); return context;
}
const sf = source('web/lib/NHL/statsPageFetch.ts');
const named = name => find(sf, n => ts.isFunctionDeclaration(n) && n.name?.text === name).replace(/^export /, '');
const skaterMap = find(sf, n => ts.isReturnStatement(n) && n.expression?.getText(sf).startsWith('skaterData.map('));
const goalieMap = find(sf, n => ts.isVariableDeclaration(n) && n.name.getText(sf) === 'goalieStats');
const counts = run(`${named('goalieRatio')}
  const mapSkaters = () => { ${skaterMap} }; globalThis.skaters = mapSkaters();
  const ${goalieMap}; globalThis.goalies = goalieStats;
  const LEADERBOARD_SIZE=5; ${named('topWithTies')}
  globalThis.leaders = topWithTies(skaters, r => r.points, 'desc', r => ({name:r.fullName,id:r.player_id}));`, {
  skaterData: [{player_id:1, player_name:'Unknown counts', points:null, goals:null, pp_points:null, blocked_shots:2, shots:null, hits:3}],
  playersMap: new Map(), goaliePlayersMap: new Map(),
  goalieData: [{goalie_id:2, goalie_name:'Unknown wins', wins:null, games_played:3, season_id:20262027}]
});
assert.equal(counts.skaters[0].points, 0); assert.equal(counts.skaters[0].bsh, 5);
assert.equal(counts.goalies[0].wins, 0); assert.equal(counts.leaders.length, 1);
const toiSf = source('web/lib/NHL/TOI.ts');
const ppFn = find(toiSf, n => ts.isVariableDeclaration(n) && n.name.getText(toiSf) === 'fetchTotalPowerPlayTime');
const parseTime = find(toiSf, n => ts.isFunctionDeclaration(n) && n.name?.text === 'parseTime').replace(/^export /, '');
let fakeFetches = 0;
const pp = run(`${parseTime}; const BASE_URL='offline.invalid'; const ${ppFn}; globalThis.calculate = fetchTotalPowerPlayTime;`, {
  fetch: async url => {fakeFetches++; return {json: async () => url.includes('/roster')
    ? {roster:[1,2,3,4].map(id=>({person:{id}}))}
    : {stats:[{splits:[{date:'2026-11-14',stat:{powerPlayTimeOnIce:'1:00'}}]}]}};}
});
const tradeSf = source('web/lib/buyLowSellHigh/trade.ts');
const tradeCode = tradeSf.statements.filter(n => !ts.isImportDeclaration(n)).map(n=>n.getText(tradeSf).replace(/^export /,'')).join('\n');
const trade = run(`${tradeCode}; globalThis.compare = compareTrade;`, {
  LOWER_IS_BETTER:new Set(), TARGET_LABELS:{GOALS:'Goals'},
  FHFH_WEIGHTS:{goals:3,assists:2,pp_points:1,shots:.2,hits:.2,blocked_shots:.25}
});
const record = id => ({identity:{playerId:id,name:id,modelClass:'F',forecastVersion:'v',forecastManifestId:'m',forecastReadAsOf:'2026-11-14'},
  freshness:{forecastStatus:'fresh'},horizon:{complete:true,requestedGames:5,scheduledGames:5},fixture:true,
  forecastAdmission:{status:'admitted',targets:{GOALS:{status:'admitted'}}},forecastTotals:{GOALS:{expected:2,unit:'goals'}}});
const overflow = trade.compare({give:['a'],receive:['b'],scoring:{mode:'points',scoringBasis:'custom',weights:{GOALS:1e308}}},[record('a'),record('b')]);
assert.equal(overflow.complete,true); assert.equal(overflow.rows[0].give.value,Infinity); assert(Number.isNaN(overflow.rows[0].net));
(async()=>{
  const teamMinutes=await pp.calculate('1','20262027',['2026-11-14']);
  assert.equal(teamMinutes[0],.8); assert.equal(1/teamMinutes[0]*100,125);
  console.log(JSON.stringify({receipts,counts:{points:counts.skaters[0].points,partialBSH:counts.skaters[0].bsh,goalieWins:counts.goalies[0].wins,admittedLeaderboardRows:counts.leaders.length},
    pp:{actualFourOnThreeClockMinutes:1,inferredMinutes:teamMinutes[0],sharePercent:1/teamMinutes[0]*100,fakeFetches},
    overflow:{complete:overflow.complete,give:String(overflow.rows[0].give.value),net:String(overflow.rows[0].net),summary:overflow.summary},
    boundary:'Exact-source VM, synthetic records and fake fetch; no application import, real network, React or test-suite execution.'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
