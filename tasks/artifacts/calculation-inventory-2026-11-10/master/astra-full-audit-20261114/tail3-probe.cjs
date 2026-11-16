const cp = require('child_process'), fs = require('fs'), vm = require('vm'), assert = require('assert'), crypto = require('crypto');
const ts = require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const pin = '89da739cb', cache = {}, hashes = {};
function source(p) { const s = cp.execFileSync('git', ['show', pin + ':' + p]).toString(); hashes[p] = crypto.createHash('sha256').update(s).digest('hex'); return s; }
function run(s, bindings = {}) { const m = {exports: {}}; vm.runInNewContext(ts.transpileModule(s, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText, {module: m, exports: m.exports, structuredClone, ...bindings}, {timeout: 4000}); return m.exports; }
const modules = {
  'utils/getPowerPlayBlocks': 'web/utils/getPowerPlayBlocks.ts',
  './ppPenaltySummaryRegistry': 'web/utils/ppPenaltySummaryRegistry.ts',
  'lib/projections/penaltyClock': 'web/lib/projections/penaltyClock.ts',
  './derived/situation': 'web/lib/projections/derived/situation.ts',
  './shiftChartCompleteness': 'web/lib/projections/shiftChartCompleteness.ts',
  'lib/supabase/Upserts/nhlStrengthState': 'web/lib/supabase/Upserts/nhlStrengthState.ts'
};
function load(name) {
  if (name === 'hooks/useGoals') return {NORMAL_PERIOD_IN_SECONDS: 1200};
  if (name === 'react') return {useState() {throw Error('hook forbidden')}, useEffect() {throw Error('hook forbidden')}};
  if (name === 'lib/cors-fetch') return () => {throw Error('network forbidden')};
  if (!modules[name]) throw Error('Unapproved module: ' + name);
  return cache[name] ??= run(source(modules[name]), {require: load});
}
assert.match(source('web/hooks/useGoals.tsx'), /NORMAL_PERIOD_IN_SECONDS\s*=\s*(?:20\s*\*\s*60|1200)/);
const clock = load('utils/getPowerPlayBlocks'), registry = load('./ppPenaltySummaryRegistry');
const test = source('web/utils/getPowerPlayBlocks.test.ts'), ast = ts.createSourceFile('test.ts', test, ts.ScriptTarget.Latest, true);
const fixtures = {}, names = ['game2026020002', 'game2026020058', 'game2026020093', 'game2026020036', 'game2026020153', 'game2025021248', 'game2025021097', 'game2025030112'];
let storedPlays;
function visit(n) {
  if (ts.isVariableDeclaration(n) && names.includes(n.name.getText(ast))) fixtures[n.name.getText(ast)] = n.getText(ast);
  if (ts.isVariableDeclaration(n) && n.name.getText(ast) === 'storedPlays' && n.getText(ast).includes('timeRemaining')) storedPlays = n.getText(ast);
  ts.forEachChild(n, visit);
}
visit(ast); assert.equal(Object.keys(fixtures).length, 8); assert(storedPlays);
const f = run(Object.values(fixtures).map(s => 'export const ' + s + ';').join('\n') + '\nexport const ' + storedPlays + ';');
function get(game, side, official = game.official[side], plays = f.storedPlays(game)) { return clock.buildTeamPpClock({gameId: game.gameId, teamId: side === 'H' ? game.homeTeamId : game.awayTeamId, homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId, gameType: game.gameType ?? 2, plays, official}); }
const summaries = [];
for (const [name, side, seconds] of [['game2026020036','A',148],['game2026020153','H',626],['game2025021248','H',840],['game2025021097','H',595],['game2025030112','A',492]]) {
  const game=f[name], r=get(game,side); assert.equal(r.qualified,true,JSON.stringify(r)); assert.equal(r.seconds,seconds); assert.equal(r.referenceSource,'nhlPenaltySummary');
  assert.equal(get({...game, gameId: 2026029999},side).qualified,false);
  assert.equal(get(game,side,null).qualified,false);
  assert.equal(get(game,side,game.official[side],f.storedPlays(game).filter(p=>p.typeDescKey!=='game-end')).qualified,false);
  assert.equal(get(game,side==='H'?'A':'H').referenceSource,'teamGameStats');
  summaries.push({game:game.gameId,team:r.teamId,seconds,officialSeconds:r.official.seconds});
}
for (const name of names.slice(0,3)) for (const side of ['H','A']) assert.equal(get(f[name],side).qualified,true);
const game=f.game2026020093;
assert.equal(get(game,'H',{powerPlayToi:'08:05',powerPlay:'1/5'}).qualified,true);
assert.equal(get(game,'H',{powerPlayToi:'08:10',powerPlay:'1/5'}).qualified,false);
assert.equal(get(game,'H',{powerPlayToi:'00:00',powerPlay:'0/1'}).official.seconds,null);
assert.equal(get(game,'H',game.official.H,null).seconds,null);
const zeroGame={...f.game2026020036, rows:[[1,1,1,'00:00','1551','period-start'],[2,2,1,'20:00','1551','period-end'],[3,3,2,'00:00','1551','period-start'],[4,4,2,'20:00','1551','period-end'],[5,5,3,'00:00','1551','period-start'],[6,6,3,'20:00','1551','game-end']]};
const zero=get(zeroGame,'A',{powerPlayToi:'00:00',powerPlay:'0/0'}); assert.equal(zero.qualified,true); assert.equal(zero.seconds,0); assert.equal(zero.referenceSource,'teamGameStats');
assert.equal(registry.PP_PENALTY_SUMMARY_REFERENCES.length,5); assert.equal(registry.penaltySummarySeconds('1-2/02:60'),null);
const config=JSON.parse(source('web/vercel.json')); assert.equal(config.crons.length,32); assert.equal(new Set(config.crons.map(c=>c.path)).size,32); assert.equal(config.crons.find(c=>c.path==='/api/v1/db/forge-served-forecast-snapshot').schedule,'40 12 * * *'); assert.equal(config.functions['pages/api/**/*.ts'].maxDuration,240);
for (const c of config.crons) {assert.equal(c.schedule.split(' ').length,5); assert(c.path.startsWith('/api/'));}
const result={pin,passed:true,hashes,summaries,controls:['six ordinary stored team-game fixtures qualify','unregistered and absent official records refused','incomplete play-by-play refused','2-second tolerance admitted; 3 refused','missing play-by-play unknown; placeholder unknown','verified zero stays not applicable','five registry identities; invalid seconds refused','32 unique cron paths; 12:40 snapshot and 240-second runtime'],boundary:'Exact frozen pure modules and retained test fixtures; hooks/network stubs throw if called. No supplied Vitest, provider, DB, browser, env, cron invocation or writes.'};
fs.writeFileSync('tasks/artifacts/calculation-inventory-2026-11-10/master/astra-full-audit-20261114/tail3-probe-output.json',JSON.stringify(result,null,2)+'\n'); console.log({passed:true,registryFixtures:summaries.length,crons:config.crons.length});
