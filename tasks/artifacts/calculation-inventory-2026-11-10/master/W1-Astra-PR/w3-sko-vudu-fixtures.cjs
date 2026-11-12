#!/usr/bin/env node
'use strict';
// Offline characterization, not acceptance tests for the intended repaired system.
// Pure modules are compiled verbatim. Route helpers are selected by TypeScript AST,
// retaining their original source bodies without importing routes, clients or secrets.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../../../..');
const web = path.join(root, 'web');
const ts = require(path.join(web, 'node_modules/typescript'));
const sourceFiles = new Set();
const cache = new Map();
const whitelist = new Set([
 'lib/skoElement/contract.ts', 'lib/skoElement/interpret.ts', 'lib/skoElement/fixtures.ts',
 'lib/sko/gap.ts', 'lib/trends/utils.ts', 'lib/supabase/utils/statistics.ts',
 'lib/supabase/utils/constants.ts', 'lib/buyLowSellHigh/market.ts',
 'lib/buyLowSellHigh/trade.ts', 'lib/buyLowSellHigh/productionReference.ts',
]);
function read(file) { sourceFiles.add(file); return fs.readFileSync(path.join(web, file), 'utf8'); }
function compile(source, file, localRequire) {
 const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
 const module = {exports:{}};
 // No process, fetch, timers, filesystem or network capability in the module context.
 const context = {module, exports:module.exports, require:localRequire};
 vm.runInNewContext(output, context, {filename:file, timeout:5000});
 return module.exports;
}
function load(file) {
 if (!file.endsWith('.ts')) file += '.ts';
 file = path.posix.normalize(file);
 assert(whitelist.has(file), `Undeclared runtime import: ${file}`);
 if (cache.has(file)) return cache.get(file);
 const output = compile(read(file), file, name => load(name.startsWith('.') ? path.posix.join(path.posix.dirname(file), name) : name));
 cache.set(file, output); return output;
}
function select(file, names) {
 const source = read(file), tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
 const selected = [];
 for (const statement of tree.statements) {
  const symbols = statement.name ? [statement.name.text] : ts.isVariableStatement(statement)
   ? statement.declarationList.declarations.map(d => d.name.getText(tree)) : [];
  if (symbols.some(s => names.includes(s))) selected.push(statement.getText(tree));
 }
 for (const name of names) assert(selected.some(s => new RegExp(`\\b${name}\\b`).test(s)), `Missing ${file}:${name}`);
 return selected.join('\n');
}
const legacyFile = 'pages/api/v1/ml/update-predictions-sko.ts';
const legacy = compile(select(legacyFile, ['mean','stddev','smoothstepMultiplier','buildPredictionRecord','MODEL_NAME','MODEL_VERSION']), legacyFile, () => {throw Error('No imports permitted');});
const ingestFile = 'pages/api/v1/db/update-sko-stats.ts';
const ingest = compile(select('lib/NHL/server/index.ts',['isValidNhlSeasonId']) + '\n' + select(ingestFile,['finiteNumberOrNull','buildSkoSkaterStatsRow']), ingestFile, () => {throw Error('No imports permitted');});
const expectationFile = 'lib/player-forecasts/gameExpectations.ts';
const expectation = compile(select(expectationFile,['finite','denied','orderedTime','targetView'])+'\nexports.targetView=targetView;',expectationFile,()=>{throw Error('No imports permitted');});
const {interpretPlayer, normalizeTeamGames, weightedPointsGap} = load('lib/skoElement/interpret');
const {FIXTURE_AS_OF, FIXTURE_CONFIG, FIXTURE_PLAYERS, fixtureRecords} = load('lib/skoElement/fixtures');
const {vuduSaveGap, sustainabilityGap} = load('lib/sko/gap');
const {computeCharacteristicResults, computeStatSummaries} = load('lib/supabase/utils/statistics');
const {computeLuck, combineSKO} = load('lib/trends/utils');
const {buildWatchlists} = load('lib/buyLowSellHigh/market');
const {compareTrade, forecastQualification, playerPointsTotal} = load('lib/buyLowSellHigh/trade');
const results=[];
const clone = x => JSON.parse(JSON.stringify(x));
const close = (a,b,t=1e-10) => assert(Math.abs(a-b)<=t, `${a} != ${b}`);
function test(name, run) { const result=run(); results.push({name,result}); }
function input(key='f1', horizon=10) { const p=clone(FIXTURE_PLAYERS.find(p=>p.key===key)); assert(p, key); return {evidence:p.evidence,forecast:p.forecasts[horizon],priorForecast:p.priorForecasts?.[horizon],config:clone(FIXTURE_CONFIG),asOf:FIXTURE_AS_OF,horizon,fixture:true}; }
const point = r => r.metrics.find(m=>m.target==='POINTS');
const summarize = r => ({window:r.recentWindow,points:point(r),ipp:r.ipp,opportunity:r.opportunity,freshness:r.freshness,explanations:r.explanations});
const pred = xs => legacy.buildPredictionRecord(99,'2026-11-11',5,xs,10);

test('legacy midpoint, scale/translation invariance, and constant short-series exception',()=>{
 const x=Array.from({length:20},(_,i)=>i%2), base=pred(x), shifted=pred(x.map(v=>v+5)), scaled=pred(x.map(v=>v*3));
 close(base.stability_multiplier,.9); close(shifted.stability_multiplier,.9); close(scaled.stability_multiplier,.9);
 const constant=pred(Array(10).fill(1)), one=pred([2]); close(constant.stability_multiplier,1); close(one.stability_multiplier,1); close(one.pred_points,10);
 return {base,shifted,scaled,constant,one};
});
test('legacy SD is not CV',()=>{const a=pred([0,2,0,2]),b=pred([1,3,1,3]);close(a.stability_cv,1);close(b.stability_cv,1);return {a,b,trueCV:[1,.5]};});
test('legacy contrasting level shifts both reduce multiplier',()=>{
 const up=pred([...Array(15).fill(0),...Array(5).fill(1)]),down=pred([...Array(15).fill(1),...Array(5).fill(0)]);
 close(up.stability_multiplier,down.stability_multiplier); return {up,down};
});
test('live-ingest helper preserves incomplete and impossible IPP defect',()=>{
 const base={stat:{playerId:99,skaterFullName:'Synthetic',points:2,shots:3,gamesPlayed:1},formattedDate:'2026-11-11',seasonId:20262027,timeOnIceStat:{timeOnIce:1200}};
 const incomplete=ingest.buildSkoSkaterStatsRow({...base,goalsForAgainstStat:{evenStrengthGoalsFor:2,powerPlayGoalFor:null,shortHandedGoalsFor:0}});
 const impossible=ingest.buildSkoSkaterStatsRow({...base,goalsForAgainstStat:{evenStrengthGoalsFor:1,powerPlayGoalFor:0,shortHandedGoalsFor:0}});
 close(incomplete.ipp,100);close(impossible.ipp,200);close(incomplete.sog_per_60,9);
 return {incomplete,impossible};
});
test('future forecast issuance remains admitted as current and qualified',()=>{
 const i=input(); i.fixture=false;i.forecast.readAsOf='2026-10-19T10:00:00Z';
 for(const g of i.forecast.player.games) for(const t of Object.values(g.targets)) { t.cutoffAt='2026-10-19T08:00:00Z';t.issuedAt='2026-10-19T10:00:00Z';t.expiresAt='2026-10-20T10:00:00Z'; }
 const r=interpretPlayer(i); assert.notEqual(point(r).gapPerTeamGame.value,null); assert.equal(r.freshness.forecastStatus,'current');assert.equal(forecastQualification(r).status,'qualified');
 return {asOf:i.asOf,forecastReadAsOf:r.identity.forecastReadAsOf,points:point(r),qualification:forecastQualification(r)};
});
test('one missing forecast expiry is masked by other current targets',()=>{
 const i=input();i.fixture=false;for(const g of i.forecast.player.games) g.targets.POINTS.expiresAt=null;
 const r=interpretPlayer(i);assert.equal(r.freshness.forecastStatus,'current');assert.notEqual(point(r).gapPerTeamGame.value,null);
 return {freshness:r.freshness,points:point(r),qualification:forecastQualification(r)};
});
test('all missing forecast expiry is experimental but comparison still complete',()=>{
 const records=['f1','f2'].map(key=>{const i=input(key);i.fixture=false;for(const g of i.forecast.player.games) for(const t of Object.values(g.targets))t.expiresAt=null;return interpretPlayer(i);});
 const comparison=compareTrade({give:[records[0].identity.playerId],receive:[records[1].identity.playerId],scoring:{mode:'points',scoringBasis:'points:test',weights:{POINTS:1}}},records);
 assert.equal(comparison.complete,true);assert.equal(comparison.experimental,true);
 return {statuses:records.map(r=>r.freshness.forecastStatus),comparison};
});
test('totals-only approved expectation still enters a comparison',()=>{
 const i=input();i.fixture=false;
 const t=expectation.targetView({stats:{POINTS:.75},conditionalStats:{POINTS:.75/.95},allowedUses:{assignment:false,totals:true,comparison:false,conditionalTieBreak:true},revisionId:'test-totals-only',modelVersion:'test-v1',sourceWatermark:'test',cutoffAt:'2026-10-18T08:00:00Z',issuedAt:'2026-10-18T12:00:00Z',expiresAt:'2026-10-19T12:00:00Z',limitations:[]},'POINTS');
 assert.equal(t.allowedUses.comparison,false);close(t.expected,.75);
 for(const g of i.forecast.player.games) g.targets.POINTS=clone(t);
 const r=interpretPlayer(i);assert.notEqual(point(r).gapPerTeamGame.value,null);assert.equal(forecastQualification(r).status,'qualified');
 const otherInput=input('f2');otherInput.fixture=false;const other=interpretPlayer(otherInput);
 const comparison=compareTrade({give:[r.identity.playerId],receive:[other.identity.playerId],scoring:{mode:'points',scoringBasis:'points:test',weights:{POINTS:1}}},[r,other]);assert.equal(comparison.complete,true);assert.equal(comparison.experimental,false);
 return {producerTarget:t,points:point(r),qualification:forecastQualification(r),tradeValue:playerPointsTotal(r,{mode:'points',scoringBasis:'points:test',weights:{POINTS:1}}),comparison};
});
test('coverage mismatch admitted at interpreter and trade boundary',()=>{
 const i=input();i.fixture=false;i.forecast.player.totals.POINTS.coveredGames=1;
 const r=interpretPlayer(i);assert.equal(r.horizon.complete,true);assert.notEqual(point(r).gapPerTeamGame.value,null);
 const value=playerPointsTotal(r,{mode:'points',scoringBasis:'points:test',weights:{POINTS:1}});assert.notEqual(value.value,null);
 return {inputTotal:i.forecast.player.totals.POINTS,points:point(r),value};
});
test('nonfinite expected total propagates to a NaN gap labelled level',()=>{
 const i=input();i.forecast.player.totals.POINTS.expected=NaN;const r=interpretPlayer(i);assert(Number.isNaN(point(r).gapPerTeamGame.value));assert.equal(point(r).direction,'level');
 return {gap:String(point(r).gapPerTeamGame.value),direction:point(r).direction,explanation:r.explanations[0]};
});
test('invalid recent availability time drops known game and fills from older history',()=>{
 const i=input(),original=interpretPlayer(i);const removed=i.evidence.teamGames.at(-1).gameId;i.evidence.teamGames.at(-1).availableAt='not-a-time';
 const r=interpretPlayer(i);assert.equal(r.diagnostics.invalidRows,1);assert.equal(r.recentWindow.unknownGames,0);assert.equal(r.recentWindow.teamGames,10);assert.notEqual(r.recentWindow.startDate,original.recentWindow.startDate);assert.notEqual(point(r).observedPerTeamGame.value,null);
 return {removed,before:summarize(original),after:summarize(r)};
});
test('negative-value control holds known game as unknown without backfill',()=>{
 const i=input(),original=interpretPlayer(i);i.evidence.teamGames.at(-1).stats.POINTS=-1;const r=interpretPlayer(i);
 assert.equal(r.recentWindow.startDate,original.recentWindow.startDate);assert.equal(r.recentWindow.unknownGames,1);assert.equal(point(r).observedPerTeamGame.value,null);return summarize(r);
});
test('impossible calendar date passes regex guard',()=>{
 const i=input();i.evidence.teamGames.at(-1).date='2026-99-99';const r=interpretPlayer(i);assert.equal(r.diagnostics.invalidRows,0);assert.equal(r.recentWindow.endDate,'2026-99-99');return {window:r.recentWindow,diagnostics:r.diagnostics};
});
test('unknown participation withholds production but IPP and opportunity use partial games',()=>{
 const i=input();for(const g of i.evidence.teamGames){g.toiMinutes=18;g.ppToiMinutes=2;g.stats.POINTS=1;g.onIceGoalsFor=2;}
 i.evidence.teamGames.at(-1).status='unknown';i.evidence.teamGames.at(-1).stats={};i.evidence.teamGames.at(-1).onIceGoalsFor=null;
 const r=interpretPlayer(i);assert.equal(point(r).observedPerTeamGame.value,null);close(r.ipp.observed.value,.5);assert.equal(r.opportunity.direction,'steady');return summarize(r);
});
test('null PP time yields steady label and conversion-not-role statement',()=>{
 const i=input();for(const g of i.evidence.teamGames){g.toiMinutes=18;g.ppToiMinutes=2;}i.evidence.teamGames.at(-1).ppToiMinutes=null;
 const r=interpretPlayer(i);assert.equal(r.opportunity.ppToiChangeMinutes.value,null);assert.equal(r.opportunity.direction,'steady');assert(r.explanations.some(e=>e.id==='conversion-not-role'));return summarize(r);
});
test('IPP aggregate can hide an impossible game',()=>{
 const i=input();for(const g of i.evidence.teamGames){g.stats.POINTS=0;g.onIceGoalsFor=0;}i.evidence.teamGames.at(-2).stats.POINTS=2;i.evidence.teamGames.at(-2).onIceGoalsFor=1;i.evidence.teamGames.at(-1).onIceGoalsFor=3;
 const r=interpretPlayer(i);close(r.ipp.observed.value,.5);return r.ipp;
});
test('opportunity duration is the window, not a detected change duration',()=>{
 const i=input();for(const g of i.evidence.teamGames){g.toiMinutes=18;g.ppToiMinutes=2;}i.evidence.teamGames.at(-1).toiMinutes=38;
 const r=interpretPlayer(i);assert.equal(r.opportunity.direction,'rising');assert.equal(r.opportunity.observedDuration.appearances,10);return {changedGames:1,opportunity:r.opportunity};
});
test('appearance opportunity halves while per-appearance minutes still say steady',()=>{
 const i=input();for(const g of i.evidence.teamGames){g.toiMinutes=18;g.ppToiMinutes=2;}
 for(const g of i.evidence.teamGames.slice(-5)){g.status='confirmed_absent';g.stats={};g.toiMinutes=0;g.ppToiMinutes=0;}
 const r=interpretPlayer(i);assert.equal(r.opportunity.direction,'steady');assert.equal(r.opportunity.recent.appearances,5);assert.equal(r.opportunity.prior.appearances,10);
 return {opportunity:r.opportunity,perTeamGameMinutes:{recent:9,prior:18}};
});
test('small IPP denominator has no distinct exposure warning',()=>{
 const i=input();for(const g of i.evidence.teamGames){g.stats.POINTS=0;g.onIceGoalsFor=0;}
 i.evidence.teamGames.at(-1).stats.POINTS=1;i.evidence.teamGames.at(-1).onIceGoalsFor=1;const r=interpretPlayer(i);close(r.ipp.observed.value,1);assert.equal(point(r).sparse,false);
 return {ipp:r.ipp,metricSparse:point(r).sparse,onIceGoals:1,appearances:r.recentWindow.appearances};
});
test('forecast conditional mean differs from participation-weighted exposure ratio',()=>{
 const i=input();for(const [n,g] of i.forecast.player.games.entries()){g.appearanceProbability=n<5?.1:.9;g.targets.POINTS.conditional=n<5?10:1;g.targets.POINTS.expected=g.appearanceProbability*g.targets.POINTS.conditional;}
 i.forecast.player.totals.POINTS.expected=9.5;i.forecast.player.expectedAppearances=5;
 const r=interpretPlayer(i);close(point(r).expectedPerAppearanceConditional.value,5.5);close(point(r).expectedPerTeamGame.value,.95);
 return {shownConditional:5.5,ratioOfExpectedTotalToExpectedAppearances:1.9,points:point(r)};
});
test('outlook compares different scheduled game sets and accepts malformed prior readAsOf',()=>{
 const i=input();for(const g of i.priorForecast.player.games)g.gameId='different-'+g.gameId;i.priorForecast.readAsOf='not-a-time';
 const r=interpretPlayer(i);assert.notEqual(point(r).outlookChangePerTeamGame.value,null);return {outlook:point(r).outlookChangePerTeamGame,priorReadAsOf:i.priorForecast.readAsOf,gameSetSame:false};
});
test('VuDu matched shot-population and GSAx sign controls',()=>{
 const matched=vuduSaveGap({expectedSaveProb:.9,expectedShotPopulation:'on_net_shots',recentSaves:95,recentShotsOnNet:100});close(matched,-5);
 const blocked=vuduSaveGap({expectedSaveProb:.9,expectedShotPopulation:'unblocked_attempts',recentSaves:95,recentShotsOnNet:100});assert.equal(blocked,null);
 const lower=sustainabilityGap({expected:{value:2,basis:'per_60'},recent:{value:3,basis:'per_60'},basis:'per_60',lowerIsBetter:true});close(lower.orientedGap,1);return {matched,matchedGSAx:5,blocked,lower};
});
test('VuDu pools start and relief exposure correctly',()=>{
 const i=input('g1');i.evidence.teamGames=i.evidence.teamGames.slice(-2);Object.assign(i.evidence.teamGames[0],{status:'appeared',goalie:{saves:27,shotsAgainst:30,goalsAgainst:3,minutes:60,appearanceType:'start'}});Object.assign(i.evidence.teamGames[1],{status:'appeared',goalie:{saves:2,shotsAgainst:3,goalsAgainst:1,minutes:10,appearanceType:'relief'}});
 const r=interpretPlayer(i);close(r.goalie.observed.savePercentage.value,29/33);close(r.goalie.observed.goalsAgainstAverage.value,24/7);close(r.goalie.observed.startShare.value,.5);assert.equal(r.goalie.gap.status,'pending_goalie_adapter');return r.goalie;
});
test('VuDu unknown participation suppresses pooled ratios',()=>{
 const i=input('g1');i.evidence.teamGames.at(-1).status='unknown';const r=interpretPlayer(i);assert.equal(r.goalie.observed.savePercentage.value,null);assert.equal(r.goalie.observed.starts.value,null);return r.goalie;
});
test('VuDu rejects inconsistent goalie primitives',()=>{
 const i=input('g1');const g=i.evidence.teamGames.find(g=>g.status==='appeared');g.goalie={saves:29,shotsAgainst:30,goalsAgainst:2,minutes:60,appearanceType:'start'};i.evidence.teamGames=[g];const r=interpretPlayer(i);assert.equal(r.goalie.observed.savePercentage.reason,'inconsistent_goalie_primitives');return r.goalie.observed;
});
test('VuDu expected starts accept impossible finite count',()=>{
 const i=input('g1');i.forecast.player.expectedStarts=11;const r=interpretPlayer(i);close(r.goalie.expected.expectedStarts.value,11);return {horizon:i.horizon,expected:r.goalie.expected};
});
test('legacy positive SD below one is not floored',()=>{const s=computeStatSummaries([{ipp:0},{ipp:1}]);close(s.ipp.stdDev,.5);return s.ipp;});
test('legacy identical primary-only games remain uncharacteristic',()=>{
 const games=Array.from({length:6},(_,i)=>({date:`2026-10-${String(i+1).padStart(2,'0')}`,total_primary_assists:1,total_secondary_assists:0,shooting_percentage:0,ipp:50,on_ice_shooting_pct:9,zone_start_pct:50,time_on_ice:1080,sog_per_60:6.7,pp_toi_pct_per_game:40}));
 const r=computeCharacteristicResults(games);assert(r.results.slice(1).every(x=>x.overallStatus==='Uncharacteristic'));return r;
});
test('legacy null and omitted IPP already behave identically, so proposed equality test is vacuous',()=>{
 const base=[{date:'2026-10-01',ipp:50},{date:'2026-10-02',ipp:50},{date:'2026-10-03',ipp:50}];
 const nullRows=clone(base);nullRows.at(-1).ipp=null;const omitted=clone(base);delete omitted.at(-1).ipp;
 const a=computeCharacteristicResults(nullRows),b=computeCharacteristicResults(omitted);close(a.results.at(-1).sumOfWeightedSquaredZScores,b.results.at(-1).sumOfWeightedSquaredZScores);
 return {nullScore:a.results.at(-1).sumOfWeightedSquaredZScores,omittedScore:b.results.at(-1).sumOfWeightedSquaredZScores};
});
test('legacy helper mixed luck orientation is real but not wired to combineSKO',()=>{
 const deltas=computeLuck({goals:6,xg:4,onIceSH:.12,pdo:1.05,ipp:.8,ippBaseline:.65});assert(deltas.xG_minus_G<0);assert(deltas.PDO_delta>0);
 return {deltas,exampleComposite:combineSKO({skillOffense01:.5,skillDefense01:.5,onIceImpact01:.5,luckInflation01:.5})};
});
test('SQL endpoint flags and cumulative IDs mirror inspected expressions, not PostgreSQL execution',()=>{
 const file='sql/functions/analytics.rpc_sko_player_series.sql';const sql=read(file);assert(sql.includes('lag(hot_flag, p_L_hot - 1, 0)'));assert(sql.includes('SUM(hot_start) OVER (ORDER BY rn)'));
 const flags=[1,0,1,1,1,1,0];let id=0;const series=flags.map((flag,j)=>{const start=flag===1 && (flags[j-2]??0)===1?1:0;id+=start;return {flag,start,id:id||null};});
 assert.equal(series[2].start,1);assert.equal(series.at(-1).id,3);return {L:3,series,correctRetrospectiveRun:{start:3,end:6},zeroMADAtMean:{hot:true,cold:true}};
});
test('all 13 stock fixtures, independent windows, and final watchlist coverage',()=>{
 const windows=[5,10,20].map(k=>{const r=fixtureRecords(10,k),w=buildWatchlists(r,'POINTS');assert.equal(r.length,13);return {recent:k,players:r.length,rebound:w.rebound.length,cooling:w.cooling.length,level:w.level.length,unranked:w.unranked.length};});return windows;
});
const manifest=[...sourceFiles].sort().map(file=>({file:'web/'+file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(web,file))).digest('hex')}));
const report={targetCommit:'7174249cb7eae7e711039e495c63a990112e22ea',runAt:new Date().toISOString(),node:process.version,method:'Actual pure modules and exact AST-selected route helper bodies, isolated VM with no network/client/environment capabilities. SQL case is explicitly a JS mirror, not PostgreSQL execution.',passed:results.length,results,manifest};
const output=path.join(__dirname,'w3-sko-vudu-fixtures.json');fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:results.length,output,manifestFiles:manifest.length}));
