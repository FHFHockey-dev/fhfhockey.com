/* Execute from repository root. Pure actual-source fixtures; no service imports. */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../../..'), web = path.join(root, 'web');
const esbuild = require(path.join(web, 'node_modules/esbuild'));
const ts = require(path.join(web, 'node_modules/typescript'));
const fail = () => { throw Error('NETWORK_FORBIDDEN'); };
global.fetch = fail;
for (const name of ['http', 'https']) { const h = require(name); h.request = h.get = fail; }
require('net').connect = require('net').createConnection = fail;
require('tls').connect = fail;
function selected(file, names) {
  const source = fs.readFileSync(path.join(web, file), 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const funcs = tree.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text));
  assert.equal(funcs.length, names.length);
  return funcs.map(n => n.getText(tree)).join('\n');
}
const entry = `import * as contracts from './lib/fantasy-projections/contracts';
import {reconcileProjectionValues,reconcileProjectionQuantiles,FANTASY_PROJECTION_V5_CONTRACT_VERSION} from './lib/fantasy-projections/contracts';
export * from './lib/fantasy-projections/contracts';
export * from './lib/fantasy-projections/evaluator';
export * from './lib/fantasy-projections/settlement';
${selected('lib/fantasy-projections/seasonJobs.ts', ['round','quantile','runtimeNewcomerDeployment','buildRuntimeNewcomerPrior','teamDeployment','addActuals'])}
${selected('lib/fantasy-projections/admin.ts', ['record','numericRecord','populationForPosition','setNested','effectivePlayer'])}
${selected('lib/fantasy-projections/queries.ts', ['numberRecord','summaryNumber','mapPlayerSummary'])}
export {teamDeployment,addActuals,effectivePlayer,numberRecord,mapPlayerSummary};`;
const bundle = esbuild.buildSync({stdin:{contents:entry,resolveDir:web,loader:'ts'},bundle:true,platform:'node',format:'cjs',write:false,logLevel:'error'});
const moduleFixture = {exports:{}};
new Function('module','exports','require',bundle.outputFiles[0].text)(moduleFixture,moduleFixture.exports,require);
const f = moduleFixture.exports, results = {};
const game = {gameId:1,teamId:10,opponentTeamId:20,isHome:true,scheduledStartAt:'2026-11-12T23:00:00Z'};
function artifact(population,rates,variances={},version=4) {
  const targets=Object.keys(rates);
  return {schemaVersion:'player-forecast-season-artifact-v1',seasonId:20262027,
    contractVersion:f[`FANTASY_PROJECTION_V${version}_CONTRACT_VERSION`],contractChecksum:f[`FANTASY_PROJECTION_V${version}_CONTRACT_CHECKSUM`],
    artifactVersion:'synthetic',featureSchemaVersion:'synthetic',codeVersion:'synthetic',trainingCutoffAt:'2026-04-16T23:59:59Z',
    players:{'1':{fhfhPlayerId:1,population,position:population==='goalie'?'G':'C',teamId:10,playProbability:1,startProbability:1,baselineStartProbability:1,baselinePlayProbability:1,conditionalRates:rates,baselineConditionalRates:{...rates},conditionalVariances:variances,primitiveTargets:targets,ratings:{},deployment:{},fallbackFlags:[]}},
    teams:Object.fromEntries([10,20].map(id=>[String(id),{teamId:id,offenseMultiplier:1,defenseMultiplier:1,paceMultiplier:1,ratings:{}}]))};
}
function evaluate(a,g=game){return f.evaluatePortableSeasonGame(a,1,g);}
const goalieRates={GAMES_PLAYED:1,GAMES_STARTED:1,TOTAL_TOI:3600,SHOTS_AGAINST_GOALIE:30,GOALS_AGAINST_GOALIE:3,WINS_GOALIE:.5,LOSSES_GOALIE:.3,OTL_GOALIE:.2,SHUTOUTS_GOALIE:.05,QUALITY_STARTS_GOALIE:.6};
const a=artifact('goalie',goalieRates,Object.fromEntries(Object.entries(goalieRates).map(([k,v])=>[k,k.includes('GAMES_')?0:v])));
const fast=structuredClone(a);for(const t of Object.values(fast.teams))t.paceMultiplier=1.2;
const neutral=evaluate(a),paced=evaluate(fast);
assert.equal(paced.unconditionalMeans.WINS_GOALIE,.6);
assert.equal(paced.unconditionalMeans.SHUTOUTS_GOALIE,.06);
const opposite=structuredClone(fast);opposite.players['1'].teamId=20;
const away=evaluate(opposite,{...game,teamId:20,opponentTeamId:10,isHome:false});
results.pace={neutral:neutral.unconditionalMeans,paced:paced.unconditionalMeans,gameWinMass:paced.unconditionalMeans.WINS_GOALIE+away.unconditionalMeans.WINS_GOALIE};
assert.equal(results.pace.gameWinMass,1.2);
const py=JSON.parse(execFileSync('python3',[path.join(__dirname,'w3-season-part45-peer-fixtures.py')],{input:JSON.stringify([{artifact:a,game},{artifact:fast,game}]),encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}));
for(const [i,ev] of [neutral,paced].entries()) for(const field of ['conditionalMeans','unconditionalMeans','baselineUnconditionalMeans','variances','quantiles'])assert.deepEqual(ev[field],py[i][field]);
results.pythonParity={cases:2,fields:['conditionalMeans','unconditionalMeans','baselineUnconditionalMeans','variances','quantiles'],equal:true};
const missing=artifact('forward',{GAMES_PLAYED:1,GOALS:1});missing.players['1'].primitiveTargets.push('SH_GOALS');
const mv=evaluate(missing);
const adv={schemaVersion:'player-forecast-season-advanced-artifact-v1',seasonId:20262027,contractVersion:f.FANTASY_PROJECTION_V5_CONTRACT_VERSION,contractChecksum:f.FANTASY_PROJECTION_V5_CONTRACT_CHECKSUM,artifactVersion:'synthetic',featureSchemaVersion:'synthetic',codeVersion:'synthetic',trainingCutoffAt:'2026-04-16T23:59:59Z',players:{'1':{fhfhPlayerId:1,population:'forward',rates:{}}},teams:{},targetPolicies:{}};
const merged=f.mergeAdvancedSeasonArtifact(missing,adv);
results.missing={declaredButAbsent:mv.unconditionalMeans.SH_GOALS,fantasyTotal:f.fantasyProjectionTotal({GOALS:1},{GOALS:3,FACEOFFS_WON:.1}),advancedRate:merged.players['1'].conditionalRates.EXPECTED_GOALS,fallbackFlags:merged.players['1'].fallbackFlags};
assert.equal(results.missing.declaredButAbsent,0);assert.equal(results.missing.fantasyTotal,3);assert.equal(results.missing.advancedRate,0);assert.deepEqual(results.missing.fallbackFlags,[]);
const double=artifact('forward',{GAMES_PLAYED:1,GOALS:1},{GAMES_PLAYED:0});for(const t of Object.values(double.teams))t.paceMultiplier=1.2;
const dv=evaluate(double);const doubleMissing=structuredClone(double);double.players['1'].conditionalVariances.GOALS=1;const explicit=evaluate(double);
results.varianceFallback={mean:dv.unconditionalMeans.GOALS,missingVariance:dv.variances.GOALS,explicitPoissonVariance:explicit.variances.GOALS};assert.equal(dv.variances.GOALS,1.44);assert.equal(explicit.variances.GOALS,1.2);
const pyMissing=JSON.parse(execFileSync('python3',[path.join(__dirname,'w3-season-part45-peer-fixtures.py')],{input:JSON.stringify([{artifact:doubleMissing,game}]),encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}))[0];
assert.equal(pyMissing.variances.GOALS,1.44);results.varianceFallback.pythonMissingVariance=pyMissing.variances.GOALS;
const sumRates={GAMES_PLAYED:1,GOALS:100,PRIMARY_ASSISTS:100,SECONDARY_ASSISTS:100};
const sumVars={GAMES_PLAYED:0,GOALS:1,PRIMARY_ASSISTS:1,SECONDARY_ASSISTS:1};
const basic=evaluate(artifact('forward',sumRates,sumVars));
const advanced=evaluate(artifact('forward',{...sumRates,EXPECTED_GOALS:0},{...sumVars,EXPECTED_GOALS:0},5));
const aggregate=f.aggregateSeasonGames([advanced]);
const incremental=f.reconcileProjectionQuantiles(aggregate.quantiles,'forward');
function row(agg,population='forward'){return {fhfh_player_id:1,team_id:10,player_name:'Synthetic',position:population==='goalie'?'G':'C',population,pool_status:'verified_active',roster_confidence:1,expected_games:1,expected_toi:{},ratings:{},deployment:{},model_means:agg.means,p10:agg.quantiles.p10,p50:agg.quantiles.p50,p90:agg.quantiles.p90};}
const published=f.effectivePlayer(row(aggregate),[]);
const bands=q=>[q.p10.POINTS,q.p50.POINTS,q.p90.POINTS];
results.sumBands={perGame:bands(basic.quantiles),v5Aggregate:bands(aggregate.quantiles),incremental:bands(incremental),publishedNoOverrides:bands(published),adjusted:published.adjusted,unclampedAnalyticWidthRatioIndependent:Math.sqrt(3),unclampedAnalyticWidthRatioLoading065:3/Math.sqrt(3+6*.65**2)};
assert.deepEqual(bands(incremental),bands(published));assert.notDeepEqual(bands(aggregate.quantiles),bands(published));assert.equal(published.adjusted,false);
const sr={GAMES_PLAYED:1,GAMES_STARTED:1,SHOTS_AGAINST_GOALIE:100,GOALS_AGAINST_GOALIE:10,TOTAL_TOI:3600};
const sv={GAMES_PLAYED:0,GAMES_STARTED:0,SHOTS_AGAINST_GOALIE:1,GOALS_AGAINST_GOALIE:1,TOTAL_TOI:0};
const se=evaluate(artifact('goalie',sr,sv));results.saveBands={saves:[se.quantiles.p10.SAVES_GOALIE,se.quantiles.p90.SAVES_GOALIE],width:se.quantiles.p90.SAVES_GOALIE-se.quantiles.p10.SAVES_GOALIE};
let poisson={zero:{score:0,mae:0,mse:0},mean:{score:0,mae:0,mse:0}},mass=Math.exp(-.2);
for(let y=0;y<20;y++){if(y)mass*=.2/y;for(const [k,p]of [['zero',0],['mean',.2]]){const s=f.scoreSeasonPrimitive({actual:y,forecast:p,baselineForecast:.19});poisson[k].score+=mass*s.skillIndex;poisson[k].mae+=mass*s.absoluteError;poisson[k].mse+=mass*s.squaredError;}}
const nullInterval=f.scoreSeasonPrimitive({actual:0,forecast:0,baselineForecast:0,p10:null,p90:null});
const omittedInterval=f.scoreSeasonPrimitive({actual:0,forecast:0,baselineForecast:0});
const invalidProbability=f.scoreSeasonPrimitive({actual:1,forecast:1.2,baselineForecast:.9,probability:true});
results.settlement={poisson,nullInterval,omittedInterval,invalidProbability,zeroBase82GamesDelta1:Array.from({length:82},()=>f.allocateSeasonTotalAdjustment({modelGameForecast:0,modelRemainingTotal:0,adjustmentDelta:1,remainingGames:60})).reduce((a,b)=>a+b,0),currentView:{actualToDate:10,remainingModel:10,publishedDelta:4,allocatedDelta:10*(f.allocateSeasonTotalAdjustment({modelGameForecast:1,modelRemainingTotal:20,adjustmentDelta:4,remainingGames:10})-1)}};
assert(poisson.zero.score>poisson.mean.score);assert(poisson.zero.mse>poisson.mean.mse);assert.equal(nullInterval.interval80Covered,true);assert(!('interval80Covered'in omittedInterval));assert(invalidProbability.logLoss<1e-10);assert(Math.abs(results.settlement.currentView.allocatedDelta-2)<1e-9);
const strength={GOALS:14,PRIMARY_ASSISTS:0,SECONDARY_ASSISTS:0,EV_GOALS:10,PP_GOALS:3,SH_GOALS:1,EMPTY_NET_GOALS:1,EV_PRIMARY_ASSISTS:0,PP_PRIMARY_ASSISTS:0,SH_PRIMARY_ASSISTS:0,EN_PRIMARY_ASSISTS:0,EV_SECONDARY_ASSISTS:0,PP_SECONDARY_ASSISTS:0,SH_SECONDARY_ASSISTS:0,EN_SECONDARY_ASSISTS:0};
const full=f.reconcileProjectionValues(strength,'forward');const reduced={...strength};delete reduced.EN_SECONDARY_ASSISTS;
const reducedEv=f.reconcileProjectionValues(reduced,'forward');
const evArtifact=artifact('forward',strength,{EV_GOALS:25});const eve=evaluate(evArtifact);
results.ev={completeEV:full.EV_GOALS,reducedSchemaEV:reducedEv.EV_GOALS,storedEVVariance:eve.variances.EV_GOALS,servedEVBand:[eve.quantiles.p10.EV_GOALS,eve.quantiles.p90.EV_GOALS]};assert.equal(full.EV_GOALS,9);assert.equal(reducedEv.EV_GOALS,10);
const cohort=artifact('forward',{GAMES_PLAYED:1,SH_GOALS:0,TOTAL_TOI:900},{GAMES_PLAYED:0,SH_GOALS:.01,TOTAL_TOI:0});cohort.players=Object.fromEntries([0,0,0,.02,.04].map((v,i)=>[i+1,{...structuredClone(cohort.players['1']),fhfhPlayerId:i+1,conditionalRates:{GAMES_PLAYED:1,SH_GOALS:v,TOTAL_TOI:900},primitiveTargets:['GAMES_PLAYED','SH_GOALS','TOTAL_TOI','UNAVAILABLE'],playProbability:.8}]));
const newcomer=f.buildRuntimeNewcomerPrior({artifact:cohort,fhfhPlayerId:6,playerName:'Newcomer',position:'C',teamId:10,poolStatus:'active_prospect',rosterStatus:'unknown',rosterConfidence:0});
results.newcomer={sh: newcomer.conditionalRates.SH_GOALS,cohortMean:.012,missing: newcomer.conditionalRates.UNAVAILABLE,role:newcomer.deployment,flags:newcomer.fallbackFlags};assert.equal(results.newcomer.sh,0);assert.equal(results.newcomer.missing,0);
const players=[{...cohort.players['1'],fhfhPlayerId:1,playProbability:0,conditionalRates:{TOTAL_TOI:1300,PP_TOI:0,PK_TOI:0}},{...cohort.players['2'],fhfhPlayerId:2,conditionalRates:{TOTAL_TOI:1000,PP_TOI:0,PK_TOI:0}},{...cohort.players['3'],fhfhPlayerId:3,population:'defense',position:'D',conditionalRates:{TOTAL_TOI:1500,PP_TOI:0,PK_TOI:0}}];
results.deployment=f.teamDeployment(players);assert.deepEqual(results.deployment.powerPlayUnits[0],[1,2,3]);
const assistBase=artifact('forward',{GAMES_PLAYED:1,PRIMARY_ASSISTS:.4,SECONDARY_ASSISTS:.3},{GAMES_PLAYED:0,PRIMARY_ASSISTS:.4,SECONDARY_ASSISTS:.3});
assistBase.players['1'].playProbability=.8;assistBase.players['1'].baselinePlayProbability=.8;
const assistOutput=evaluate(assistBase);
const assistMerged=evaluate(f.mergeAdvancedSeasonArtifact(assistBase,adv));
const pythonAdvanced=JSON.parse(execFileSync('python3',[path.join(__dirname,'w3-season-part45-peer-fixtures.py')],{input:JSON.stringify({mode:'advanced',baseOutput:assistOutput,advanced:adv}),encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}));
results.advancedAssistParity={baseMean:assistOutput.unconditionalMeans.PRIMARY_ASSISTS,baseVariance:assistOutput.variances.PRIMARY_ASSISTS,baseBand:[assistOutput.quantiles.p10.PRIMARY_ASSISTS,assistOutput.quantiles.p90.PRIMARY_ASSISTS],typescriptVariance:assistMerged.variances.EXPECTED_PRIMARY_ASSISTS,pythonVariance:pythonAdvanced.variances.EXPECTED_PRIMARY_ASSISTS,typescriptBand:[assistMerged.quantiles.p10.EXPECTED_PRIMARY_ASSISTS,assistMerged.quantiles.p90.EXPECTED_PRIMARY_ASSISTS],pythonBand:[pythonAdvanced.quantiles.p10.EXPECTED_PRIMARY_ASSISTS,pythonAdvanced.quantiles.p90.EXPECTED_PRIMARY_ASSISTS]};
assert.equal(assistMerged.variances.EXPECTED_PRIMARY_ASSISTS,assistOutput.variances.PRIMARY_ASSISTS);
assert(pythonAdvanced.variances.EXPECTED_PRIMARY_ASSISTS<assistOutput.variances.PRIMARY_ASSISTS);
const missingRow={...row(aggregate),published_values:{GOALS:1,TAKEAWAYS:null}};
const summary=f.mapPlayerSummary(missingRow,new Map(),['GOALS','TAKEAWAYS','FACEOFFS_WON']);
const expanded=f.expandFantasyProjectionSummary({success:true,encoding:f.FANTASY_PROJECTION_SUMMARY_ENCODING,betaLabel:'synthetic',release:{id:'synthetic'},metricKeys:['GOALS','TAKEAWAYS','FACEOFFS_WON'],players:[summary]});
results.missingTransport={explicitNull:f.numberRecord({GOALS:1,TAKEAWAYS:null}),summaryRoundTrip:expanded.players[0].publishedValues,v3IncludesFaceoffs:f.SKATER_PRIMITIVE_TARGETS.includes('FACEOFFS_WON'),v3IncludesTakeaways:f.SKATER_PRIMITIVE_TARGETS.includes('TAKEAWAYS')};
assert.deepEqual(expanded.players[0].publishedValues,{GOALS:1,TAKEAWAYS:0,FACEOFFS_WON:0});
const sources=['web/lib/fantasy-projections/evaluator.ts','web/lib/fantasy-projections/contracts.ts','web/lib/fantasy-projections/settlement.ts','web/lib/fantasy-projections/seasonJobs.ts','web/lib/fantasy-projections/admin.ts','web/lib/fantasy-projections/queries.ts','web/scripts/import-player-forecast-season-settlement.ts','modeling/player_forecasts/season.py','modeling/player_forecasts/advanced.py'];
results.sourceHashes=Object.fromEntries(sources.map(p=>[p,require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')]));
results.verification={date:'2026-11-11',syntheticOnly:true,productionRequests:0,serviceImports:0,assertions:'passed'};
console.log(JSON.stringify(results,null,2));
