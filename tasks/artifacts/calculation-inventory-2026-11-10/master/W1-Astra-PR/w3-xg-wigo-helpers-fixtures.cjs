/* Offline source-derived review fixtures. Run from repo root with node <this-file>.
 * Loads local pure modules; DB imports are inert stubs. CLI/route bodies are not run.
 * Unexported calculations are extracted verbatim via the TypeScript AST or bounded source blocks.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const crypto = require('crypto');
const root = path.resolve(__dirname, '../../../../..');
const web = path.join(root, 'web');
const ts = require(path.join(web, 'node_modules/typescript'));
const hashes = {};
const read = rel => {
  const src = fs.readFileSync(path.join(web, rel), 'utf8');
  hashes[rel] = crypto.createHash('sha256').update(src).digest('hex');
  return src;
};
const transpile = src => ts.transpileModule(src, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const deny = () => { throw Error('External operation forbidden in offline review'); };
let fakeSupabase = {from:deny};
const cache = new Map();
function load(rel) {
  if (cache.has(rel)) return cache.get(rel);
  const mod = {exports:{}}; cache.set(rel,mod.exports);
  const code = transpile(read(rel));
  const localRequire = name => {
    if (name === 'lib/supabase') return {__esModule:true,default:fakeSupabase};
    if (name === 'lib/supabase/pagination') return {fetchAllSupabasePages:deny};
    const file = name.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(rel),name)) : name;
    if (!/^(utils|components\/WiGO|styles|lib\/xg|lib\/underlying-stats)\//.test(file)) throw Error('Unapproved import '+name);
    return load(file+'.ts');
  };
  vm.runInNewContext('(function(require,module,exports){'+code+'\n})', {console,structuredClone})(localRequire,mod,mod.exports);
  cache.set(rel,mod.exports); return mod.exports;
}
function declarations(rel, names) {
  const src=read(rel), ast=ts.createSourceFile(rel,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const found=new Map();
  function visit(n) {
    if (ts.isFunctionDeclaration(n) && n.name && names.includes(n.name.text)) found.set(n.name.text,n.getText(ast));
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && names.includes(n.name.text)) found.set(n.name.text,'const '+n.getText(ast)+';');
    ts.forEachChild(n,visit);
  } visit(ast);
  return names.map(name=>{assert(found.has(name),'missing '+name); return found.get(name);}).join('\n');
}
function evaluate(src, scope={}) { return vm.runInNewContext(transpile(src), {console,structuredClone,exports:{},...scope}); }
const results={};
const rank=load('utils/projectionsRanking.ts');
const skaters=[10,null,-2,100,100].map((p,i)=>({playerId:i+1,fantasyPoints:{projected:p,actual:null}}));
const ordered=skaters.map(x=>x.playerId);
const ranked=rank.assignGlobalRanks(skaters,[]);
results.ranks=ranked.map(p=>({id:p.playerId,projected:p.fantasyPoints.projected,rank:p.projectedRank,actualRank:p.actualRank}));
assert.equal(skaters[1].projectedRank,4); assert.equal(skaters[2].projectedRank,5);
assert.deepEqual(skaters.map(x=>x.playerId),ordered); // array order unchanged, shared player objects mutated
assert.notEqual(skaters[3].projectedRank,skaters[4].projectedRank);
const tiers=load('utils/tierUtils.ts').calculateTierThresholds([5,5.4,4.1].map((v,i)=>({roundNumber:i+1,actualPerGame:v})));
results.tiers={bands:tiers,overlapsAt5_2:tiers.filter(t=>5.2>=t.minFP&&5.2<t.maxFP).map(t=>t.name),negativeCovered:tiers.some(t=>-1>=t.minFP&&-1<t.maxFP)};
assert.equal(results.tiers.overlapsAt5_2.length,2);
const ratings=load('utils/calculateWigoRatings.ts');
const weights=load('components/WiGO/ratingWeights.ts').RATING_WEIGHTS;
const rows=Array.from({length:21},(_,i)=>({player_id:i+1,season:20262027,gp:10,toi_seconds:i?3600:60,total_points_per_60:i===0?100:i}));
const r=ratings.calculatePlayerRatings(1,{as:{offense:rows,defense:[]}},undefined,undefined,10,20);
results.partialRating={offense:r.offense.as,overall:r.overall.as,validWeight:25,totalWeight:weights.as.offense.reduce((s,w)=>s+w.weight,0)};
assert(r.offense.as>97); assert.equal(r.overall.as,r.offense.as);
// Extract the component's actual percentile calculation callback, without importing React or querying.
const panelSrc=read('components/WiGO/RateStatPercentiles.tsx');
const panelAst=ts.createSourceFile('panel.tsx',panelSrc,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let callback;
function find(n){if(ts.isVariableDeclaration(n)&&ts.isObjectBindingPattern(n.name)&&n.name.elements.some(e=>e.name.getText(panelAst)==='calculatedPercentiles'))callback=n.initializer.arguments[0].getText(panelAst);ts.forEachChild(n,find);} find(panelAst); assert(callback);
results.panelAlone=evaluate('('+callback+')()', {playerId:1,minGp:10,allPlayersStats:[{player_id:1,gp:10,toi:1200,ixg_per_60:2},{player_id:2,gp:20,toi:2400,ixg_per_60:null}],ALL_STATS_TO_DISPLAY:[{key:'ixg_per_60',higherIsBetter:true}],calculateRankingResult:load('utils/calculatePercentiles.ts').calculateRankingResult});
assert.equal(results.panelAlone.calculatedRanks.ixg_per_60,1);assert.equal(results.panelAlone.calculatedPercentiles.ixg_per_60,.5);
const wigo=load('utils/fetchWigoPlayerStats.ts');
results.revivedRate=wigo.buildPlayerAggregatedStats({careerData:{player_id:1,std_gp:10,std_atoi:20,std_ixg:5,std_ixg_per_60:null},recentData:null,ratesData:null,totalsData:null}).find(r=>r.label==='ixG/60');
assert.equal(results.revivedRate.STD,1.5);
const route='pages/api/v1/db/calculate-wigo-stats.ts';
const routeSrc=read(route);
const seasonal=routeSrc.slice(routeSrc.indexOf('      const aggregatedDataBySeason:'),routeSrc.indexOf('      // --- End Seasonal Calcs ---'));
assert(seasonal.includes('writePeriod'));
results.seasonalNulls=evaluate(declarations(route,['safeDivide','calculatePer60','calculatePer60FromSeconds'])+'\n'+seasonal+'\ncareerStats',{
  playerId:1,currentSeasonId:20262027,lastSeasonId:20252026,ya3Seasons:[20232024,20242025,20252026],
  wgoTotals:[{season:'20262027',games_played:10,toi_per_game:1200,goals:null,points:null,shots:40}],
  nstIndCounts:[{season:20262027,strength:'all',gp:10,toi:200,ixg:null,icf:100}],nstOnIceCounts:[]});
assert.equal(results.seasonalNulls.std_g,0);assert.equal(results.seasonalNulls.std_ixg_per_60,0);
const nullToiCareer=evaluate(declarations(route,['safeDivide','calculatePer60','calculatePer60FromSeconds'])+'\n'+seasonal+'\ncareerStats',{
  playerId:1,currentSeasonId:20262027,lastSeasonId:20252026,ya3Seasons:[],
  wgoTotals:[{season:'20262027',games_played:10,toi_per_game:1200,goals:1,points:2,shots:40}],
  nstIndCounts:[{season:20262027,strength:'all',gp:10,toi:null,ixg:5,icf:100}],nstOnIceCounts:[]});
results.nullToiEndToEnd={publishedRate:nullToiCareer.std_ixg_per_60,publishedCount:nullToiCareer.std_ixg,served:wigo.buildWigoAggregatedStatsResult({careerData:nullToiCareer,recentData:null},null,20262027).rows.find(r=>r.label==='ixG/60')};
assert.equal(results.nullToiEndToEnd.publishedRate,null);assert.equal(results.nullToiEndToEnd.served.STD,1.5);
const drivers=load('components/WiGO/teamPerformanceDriverModel.ts');
const fiveOnFiveRows=Array.from({length:32},(_,i)=>({team_abbreviation:'T'+i,date:'2026-11-01',gp:10,xgf:20+i,xga:30,gf:30}));
const specialTeamsRows=Array.from({length:32},(_,i)=>({team_id:i+1,date:'2026-11-01',power_play_pct:i+1,penalty_kill_pct:60+(i*7%32)}));
const pct=load('utils/calculatePercentiles.ts').calculateRankingResult;
const composites=specialTeamsRows.map(r=>({player_id:r.team_id,value:50*(pct(specialTeamsRows.map(x=>({player_id:x.team_id,value:x.power_play_pct})),r.team_id,true).percentile+pct(specialTeamsRows.map(x=>({player_id:x.team_id,value:x.penalty_kill_pct})),r.team_id,true).percentile)}));
const differences=specialTeamsRows.map((r,i)=>({id:r.team_id,display:drivers.buildTeamPerformanceDrivers({teamAbbreviation:'T'+i,teamId:r.team_id,fiveOnFiveRows,specialTeamsRows}).drivers.find(d=>d.key==='specialTeams'),composite:composites[i].value,truePercentile:100*pct(composites,r.team_id,true).percentile}));
results.teamComposite=differences.sort((a,b)=>Math.abs(b.display.percentile-b.truePercentile)-Math.abs(a.display.percentile-a.truePercentile))[0];
assert(Math.abs(results.teamComposite.display.percentile-results.teamComposite.truePercentile)>10);
const cal=load('lib/xg/calibration.ts');
const gateNames=['MIN_APPROVAL_HOLDOUT_POSITIVES','MIN_APPROVAL_TEST_POSITIVES','MIN_NON_COLLAPSED_AVERAGE_PREDICTION','MAX_NON_COLLAPSED_AVERAGE_PREDICTION','buildApprovalGradeEligibility','buildValidationCalibration'];
const gates=evaluate(declarations('scripts/train-nhl-xg-baseline.ts',gateNames)+'\n({buildApprovalGradeEligibility,buildValidationCalibration})',{
 findForbiddenBaselineFeatureKeys:load('lib/xg/baselineDataset.ts').findForbiddenBaselineFeatureKeys,
 assessCalibration:cal.assessCalibration,fitProbabilityCalibrator:cal.fitProbabilityCalibrator,
 buildReboundCreationApprovalBlockingReasons:deny});
const raw=[...Array.from({length:9},(_,i)=>({rowId:'v'+i,split:'validation',label:0,prediction:.5,isReboundShot:false,isRushShot:false})),...Array.from({length:140},(_,i)=>({rowId:'t'+i,split:'test',label:i<10?1:0,prediction:.5,isReboundShot:i===0,isRushShot:i===1}))];
const splitCounts={train:1000,validation:9,test:140};
const built=gates.buildValidationCalibration({rawScoredExamples:raw,featureKeys:['isFlurryShot'],splitCounts});
const scored=built.scoredExamples;
const assessment=cal.assessCalibration(scored,{featureKeys:['isFlurryShot'],splitCounts,sliceCoverage:{reboundPositiveCount:1,rushPositiveCount:1}});
const testEvaluation=cal.evaluateProbabilityMetrics(scored.filter(x=>x.split==='test'));
const holdoutEvaluation=cal.evaluateProbabilityMetrics(scored);
const gate=gates.buildApprovalGradeEligibility({predictionType:'shot_goal',splitCounts,evaluation:{},holdoutEvaluation,testEvaluation,calibrationAssessment:assessment,selectedFeatures:{numeric:[],boolean:['isFlurryShot'],categorical:[]},featureKeys:['isFlurryShot']});
results.weakGate={gate,appliedCalibration:built.calibration,requiresPostCalibration:assessment.requiresPostCalibration,adoptableMethod:assessment.adoptableMethod,testEvaluation,baseRateBrier:10/140*(1-10/140),baseRateLogLoss:-(10/140*Math.log(10/140)+130/140*Math.log(130/140))};
assert.equal(gate.isEligible,true); assert.equal(built.calibration.applied,false); assert(testEvaluation.brierScore>results.weakGate.baseRateBrier);
const benchmark=evaluate(declarations('scripts/benchmark-nhl-xg-baselines.ts',['getApprovalGradeBlockingReasons'])+'\ngetApprovalGradeBlockingReasons');
results.benchmark=[{}, {testExampleCount:1,approvalGradeEligibility:{isEligible:false,blockingReasons:[]}}].map(x=>benchmark(x));
assert(results.benchmark.every(a=>a.length===0));
const aggregates=load('lib/xg/aggregates.ts');
const game=(n,season=20252026)=>({id:Math.floor(season/10000)*1e6+20000+n,seasonId:season,date:(season===20252026?'2025-10-':'2026-10-')+String(n).padStart(2,'0'),homeTeamId:10,awayTeamId:20});
const prediction=(g,extra={})=>({model_version:'fixture-model',prediction_type:'shot_goal',feature_version:1,game_id:g.id,event_id:1,season_id:g.seasonId,game_date:g.date,event_owner_team_id:10,shooter_player_id:91,goalie_in_net_id:31,label:false,xg:.25,model_approved:true,...extra});
const games=Array.from({length:12},(_,i)=>game(i+1));
const preds=games.filter((_,i)=>![1,4,7,10].includes(i)).map(g=>prediction(g));
const a=aggregates.buildXgAggregates([...preds,...games.map(g=>prediction(g,{event_id:2,shooter_player_id:92,goalie_in_net_id:41}))],games,{rollingWindows:[10],generatedAt:'offline'});
results.missingGames={gameLedgerSize:games.length,playerLatest:a.playerRollingRows.filter(r=>r.player_id===91).at(-1),goalieLatest:a.goalieRollingRows.filter(r=>r.goalie_player_id===31).at(-1),teamLatest:a.teamRollingRows.at(-1)};
assert.equal(results.missingGames.playerLatest.games_count,8);assert.equal(results.missingGames.goalieLatest.games_count,8);
const sameGame=game(1);
const mix=aggregates.buildXgAggregates([prediction(sameGame),prediction(sameGame,{feature_version:2,xg:.5})],[sameGame],{rollingWindows:[10],generatedAt:'offline'});
results.mixedVersions={player:mix.playerRollingRows,goalie:mix.goalieRollingRows,team:mix.teamRollingRows};
assert(mix.playerRollingRows.some(r=>r.games_count===2&&r.ixg===.75));
const two=[game(1),game(1,20262027)];
const seasons=aggregates.buildXgAggregates(two.map(g=>prediction(g)),two,{rollingWindows:[10],generatedAt:'offline'});
results.crossSeason=seasons.playerRollingRows.at(-1);assert.equal(results.crossSeason.games_count,2);
const en=aggregates.buildXgAggregates([prediction(sameGame,{goalie_in_net_id:null,label:true,xg:.9})],[sameGame],{rollingWindows:[10],generatedAt:'offline'});
results.emptyNet={team:en.teamGameRows,player:en.playerGameRows,goalie:en.goalieGameRows};
assert.equal(en.playerGameRows[0].ixg,.9);assert.equal(en.goalieGameRows.length,0);
const explorer=load('lib/underlying-stats/xgExplorer.ts');
results.explorer=explorer.buildPlayerXgExplorerRows({xgRows:[{player_id:1,team_id:10,as_of_game_id:1,as_of_game_date:'2026-01-10',games_count:5,ixg:1,goals:1,shot_attempts:20}],createdRows:[{player_id:1,as_of_game_id:2,as_of_game_date:'2026-02-10',created_xg:4}],transitionRows:[],reboundRows:[],players:[],teams:[],limit:10})[0];
assert.equal(results.explorer.createdXg,4);assert.equal(results.explorer.controlledEntries,0);
// Reader query stubs return a regular-season + playoff row; record predicates and invoke the real reader.
const traces=[];
fakeSupabase.from=table=>{const calls=[];traces.push({table,calls});const q={};for(const m of ['select','eq','order'])q[m]=(...a)=>{calls.push([m,...a]);return q;};q.then=(resolve,reject)=>Promise.resolve({data:[{date_scraped:'2026-04-01',ixg:.2},{date_scraped:'2026-05-01',ixg:.8}],error:null}).then(resolve,reject);return q;};
(async()=>{
 results.playoffReader={rows:await wigo.fetchPlayerGameLogForStat(1,20252026,'ixG'),traces};
 assert.equal(results.playoffReader.rows.length,2);assert(!traces[0].calls.some(x=>x[1]==='game_type'));
 console.log(JSON.stringify({fixtureVersion:1,mode:'offline; no env files, network or database access',sourceHashes:hashes,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
