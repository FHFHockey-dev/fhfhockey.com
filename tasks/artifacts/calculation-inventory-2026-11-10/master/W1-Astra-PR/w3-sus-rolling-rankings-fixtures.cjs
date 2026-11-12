/* Offline peer-review fixtures. From repo root: node <this-file>.
 * Actual TypeScript modules run in a VM with an explicit local import allowlist.
 * No environment secrets, database clients, application routes, writes or network APIs.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../../../..');
const web = path.join(root, 'web');
const ts = require(path.join(web, 'node_modules/typescript'));
const allowed = new Set([
  'lib/sustainability/bandCalculator.ts', 'lib/sustainability/bands.ts',
  'lib/sustainability/runtimeContract.ts', 'lib/sustainability/features.ts',
  'lib/projectionsConfig/fantasyPointsConfig.ts',
  'lib/rankings/skaterWindowAggregation.ts', 'lib/rankings/metricDefinitions.ts',
  'lib/rankings/rankingCalculator.ts', 'lib/projections/utils/trend-adjustments.ts',
  'lib/projections/constants/projection-weights.ts', 'lib/predictions/rollingWindows.ts',
  'lib/projections/utils/date-utils.ts', 'lib/projections/utils/number-utils.ts'
]);
const hashes = {}, cache = new Map();
function load(rel) {
  if (cache.has(rel)) return cache.get(rel);
  assert(allowed.has(rel), 'Unexpected import: '+rel);
  const src = fs.readFileSync(path.join(web, rel), 'utf8');
  hashes[rel] = crypto.createHash('sha256').update(src).digest('hex');
  const code = ts.transpileModule(src, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};
  cache.set(rel,mod.exports);
  const localRequire = name => load((name.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(rel), name)) : name)+'.ts');
  vm.runInNewContext('(function(require,module,exports){'+code+'\n})', {})(localRequire, mod, mod.exports);
  cache.set(rel,mod.exports); return mod.exports;
}
const calc = load('lib/sustainability/bandCalculator.ts');
const specs = load('lib/sustainability/bands.ts');
const feat = load('lib/sustainability/features.ts');
const rankings = load('lib/rankings/skaterWindowAggregation.ts');
const rankMath = load('lib/rankings/rankingCalculator.ts');
const out = {};
const snapshotDate='2026-11-11';
const makeRows = (n, vals) => Array.from({length:n},(_,i)=>({player_id:1,season_id:20262027,date:'2026-11-'+String(11-i).padStart(2,'0'),...vals}));
const band=(metric,rows,totals,window='l5')=>calc.computeTrendBandsForPlayer({playerId:1,snapshotDate,seasonId:20262027,metrics:[metric],windows:[window],rows,totals})[0];
const near=(a,b,t=1e-9)=>assert(Math.abs(a-b)<=t, `${a} != ${b}`);
// Execute the literal UI classification expression, without mounting React or loading routes.
const uiSource=fs.readFileSync(path.join(web,'pages/trendsSandbox.tsx'),'utf8');
hashes['pages/trendsSandbox.tsx']=crypto.createHash('sha256').update(uiSource).digest('hex');
const uiAst=ts.createSourceFile('ui.tsx',uiSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let statusExpression;
function findStatus(n){
  if(ts.isVariableDeclaration(n)&&n.name.getText(uiAst)==='status'&&n.initializer?.getText(uiAst).includes('row.value > row.ciUpper')) statusExpression=n.initializer.getText(uiAst);
  ts.forEachChild(n,findStatus);
}
findStatus(uiAst); assert(statusExpression);
const classifyUi=vm.runInNewContext('(row)=>('+statusExpression+')',{});
const status=b=>classifyUi({value:b.value,ciLower:b.ci_lower,ciUpper:b.ci_upper});
// Same five games: one PP point per four PP minutes, prior 7.5 PP points/60.
const pp=band('pp_points_per_60',makeRows(5,{pp_points:1,pp_toi:240}),[{season_id:20252026,pp_points:30,pp_toi:14400}]);
const weight=pp.n_eff/(pp.n_eff+180);
near(pp.ewma,15); near(pp.baseline,7.5); near(pp.value,7.5+weight*7.5);
assert.equal(status(pp),'neutral');
out.ppDouble={band:pp,dataWeight:weight,uiStatus:status(pp)};
out.ppWindowWeights=[3,5,10,20].map(n=>{const b=band('pp_points_per_60',makeRows(n,{pp_points:1,pp_toi:240}),[{season_id:20252026,pp_points:30,pp_toi:14400}],`l${n}`);return {n,nEff:b.n_eff,dataWeight:b.n_eff/(b.n_eff+180),specListsWindow:specs.METRIC_SPECS.pp_points_per_60.defaultWindows.includes(`l${n}`)};});
assert.equal(out.ppWindowWeights[3].specListsWindow,false);
// Independent exact count calculation: double baseline is not necessarily outside its usual range.
function poissonMass(k,mu){let p=Math.exp(-mu);for(let j=1;j<=k;j++)p*=mu/j;return p;}
function poissonQuantile(q,mu){let p=Math.exp(-mu),sum=p,k=0;while(sum<q&&k<1000){k++;p*=mu/k;sum+=p;}return k;}
out.ppDoublePredictiveCounterexample={observedCount:5,rawMinutes:20,baselineRate:7.5,poissonMean:2.5,exactCentral80:[poissonQuantile(.1,2.5),poissonQuantile(.9,2.5)],upperTailAt5:1-[0,1,2,3,4].reduce((s,k)=>s+poissonMass(k,2.5),0)};
assert.deepEqual(out.ppDoublePredictiveCounterexample.exactCentral80,[1,5]);
// Zero-PP games occupy appearance slots but current collector backfills older games.
const recent=makeRows(5,{pp_points:0,pp_toi:0});
const older=makeRows(5,{pp_points:1,pp_toi:240}).map((r,i)=>({...r,date:`2026-10-${31-i}`}));
const ppTotals=[{season_id:20252026,pp_points:30,pp_toi:14400}];
out.ppWindowBackfill={withoutOlder:band('pp_points_per_60',recent,ppTotals)??null,withOlder:band('pp_points_per_60',[...recent,...older],ppTotals)};
assert.equal(out.ppWindowBackfill.withoutOlder,null);near(out.ppWindowBackfill.withOlder.ewma,15);
near(out.ppWindowBackfill.withOlder.n_eff,pp.n_eff*Math.pow(2,-5/6));
// Sample has genuine 5v5 field, but current calculator ignores it and uses broader ES.
const fiveRows=makeRows(5,{points_5v5:1,toi_per_game_5v5:1000,ev_time_on_ice:1200});
const fiveTotals=[{season_id:20252026,points_5v5:50,toi_5v5_total:50000,ev_time_on_ice:60000}];
const five=band('points_per_60_5v5',fiveRows,fiveTotals);
out.fiveOnFive={band:five,matchedRate:3.6,ewmaRelativeBias:five.ewma/five.baseline-1};
near(five.ewma,3);near(five.baseline,3.6);
// Current IPP fallback: impossible prior is not rejected. Posterior beta is silently floored.
const ippRows=makeRows(5,{points:1,nst_oi_gf:2});
const ipp=band('ipp',ippRows,[{season_id:20262027,points:48,nst_oi_gf:null,es_goals_for:35}]);
out.ippInvalid={band:ipp,priorBeta:(1-ipp.baseline)*50+.5,uiStatus:status(ipp)};
near(ipp.baseline,48/35);assert(ipp.value>1);near(ipp.distribution.beta,1e-6);assert.equal(status(ipp),'hot');
const hidden=band('ipp',ippRows,[{season_id:20262027,points:5,nst_oi_gf:null,es_goals_for:10}]);
out.ippFallbackWithinDomain={baseline:hidden.baseline,value:hidden.value};near(hidden.baseline,.5);
const missing=band('ipp',ippRows,[{season_id:20262027,points:4,nst_oi_gf:null,es_goals_for:null},{season_id:20252026,points:2,nst_oi_gf:4}]);
out.ippUnpairedNullSeason={baseline:missing.baseline,matchedRemainingSeasonBaseline:.5};near(missing.baseline,2.5);
// Last-N stored aliases are rates; fallback divides that rate by seconds again.
const base={player_id:1,season:20262027,game_date:snapshotDate,strength_state:'all',games_played:5,sog_per_60_total_last5:8.4,toi_seconds_total_last5:6852,toi_seconds_avg_last5:1370.4};
const getAggregate=row=>rankings.buildSkaterWindowAggregatesFromRollingRow(row,{windows:['last5'],metricKeys:['sog_per_60']})[0];
const absent=getAggregate({...base,sog_per_60_last5:null});
const present=getAggregate({...base,sog_per_60_last5:8.4});
out.lastNFallback={absent,present,recomputedWithoutRaw:rankMath.calculateMetricRawValue({metricKey:'sog_per_60',numerator:present.numerator,denominator:present.denominator})};
near(absent.rawValue,4.41331,1e-6);near(present.rawValue,8.4);near(out.lastNFallback.recomputedWithoutRaw,absent.rawValue,1e-6);
// A general deletion of last-N count/seconds fallback would break valid count-based metrics.
out.validCountFallbacks=rankings.buildSkaterWindowAggregatesFromRollingRow({...base,points_total_last5:3,pp_points_total_last5:1,pp_toi_seconds_total_last5:120},{windows:['last5'],metricKeys:['points_per_60','pp_points_per_60']});
near(out.validCountFallbacks.find(x=>x.metricKey==='points_per_60').rawValue,3/6852*3600,1e-6);
near(out.validCountFallbacks.find(x=>x.metricKey==='pp_points_per_60').rawValue,30);
// Forecast bands: compare literal emitted interval endpoints to an exact Poisson sum.
out.poissonCoverage=[.1,.3,.7,1.5,3,6].map(mu=>{const b=feat.emitForecastBands({mean:mu,variance:mu});const cov=x=>Array.from({length:100},(_,k)=>k>=x.lower&&k<=x.upper?poissonMass(k,mu):0).reduce((a,b)=>a+b,0);return{mu,bands:b,coverage50:cov(b.band50),coverage80:cov(b.band80),exactMedian:poissonQuantile(.5,mu)};});
near(out.poissonCoverage[0].coverage50,Math.exp(-.1));
out.emptyCalibration=feat.evaluateBandCalibration({forecasts:[],actuals:[]});assert.equal(out.emptyCalibration.hitRate50,0);
out.collectorless=['hdcf_pct','sh_pct_5v5','pp_sh_pct'].map(metric=>({metric,rows:calc.computeTrendBandsForPlayer({playerId:1,snapshotDate,seasonId:20262027,metrics:[metric],windows:['l5'],rows:ippRows,totals:[]}).length}));
assert(out.collectorless.every(x=>x.rows===0));
const trend=load('lib/projections/utils/trend-adjustments.ts');
const priorities=load('lib/projections/constants/projection-weights.ts');
out.forgeReader={allowedMetrics:priorities.TREND_BAND_METRIC_PRIORITY,points5v5Adjustment:trend.computeSkaterTrendAdjustment({row:five,asOfDate:snapshotDate})};
assert(out.forgeReader.allowedMetrics.includes('fantasy_score'));
assert(!out.forgeReader.allowedMetrics.includes('hits_per_60'));
assert(!out.forgeReader.allowedMetrics.includes('blocks_per_60'));
assert(!out.forgeReader.allowedMetrics.includes('pp_points_per_60'));
assert.equal(out.forgeReader.points5v5Adjustment.effectState,'within_band_neutral');
out.discreteConvention={mu:.7,central80:[poissonQuantile(.1,.7),poissonQuantile(.9,.7)],shorter80:[0,1],shorterCoverage:poissonMass(0,.7)+poissonMass(1,.7)};
assert.deepEqual(out.discreteConvention.central80,[0,2]);
console.log(JSON.stringify({asOf:'2026-11-11',method:'Actual local pure TypeScript functions; synthetic inputs only; no network or database clients',sourceHashes:hashes,results:out},null,2));
