// Offline audit evidence. Exact frozen modules, denied network/application imports.
const fs = require('fs'), cp = require('child_process'), vm = require('vm');
const assert = require('assert/strict'), crypto = require('crypto'), path = require('path');
const ts = require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const pin = '89da739cb', sources = [], cache = new Map(), queries = [];
let dbRows = [];
const client = { from(table) {
  assert.equal(table, 'team_power_ratings_daily');
  const q = {table, filters: [], orders: []}; queries.push(q);
  const b = {select() {return b;}, eq(k,v) {q.filters.push(['eq',k,v]);return b;},
    lte(k,v) {q.filters.push(['lte',k,v]);return b;}, order(k,v) {q.orders.push([k,v]);return b;},
    limit(n) {q.limit=n;return b;}, then(resolve,reject) {
      let rows=dbRows.filter(r=>q.filters.every(([op,k,v])=>op==='eq'?r[k]===v:r[k]<=v));
      for(const [k,v] of [...q.orders].reverse()) rows.sort((a,b)=>(a[k]<b[k]?-1:a[k]>b[k]?1:0)*(v.ascending?1:-1));
      if(q.limit!=null)rows=rows.slice(0,q.limit);
      return Promise.resolve({data:rows,error:null}).then(resolve,reject);
    }};
  return b;
}};
const allowed = new Set([
  'teamRatingVersion','teamRatingsService','trends/playerTrendCalculator',
  'trends/ctpi','trends/recentTeamFormV2','trends/ctpiVersions',
  'trends/recentTeamFormV2Materialization','trends/strengthOfSchedule',
  'trends/strengthOfScheduleContract','trends/teamSosSnapshot','trends/utils',
  'trends/trendsSurface','supabase/Upserts/rollingMetricScaleContract'
].map(x=>'web/lib/'+x+'.ts'));
function source(p) {
  const s=cp.execFileSync('git',['show',pin+':'+p],{encoding:'utf8'});
  sources.push({path:p,sha256:crypto.createHash('sha256').update(s).digest('hex')});return s;
}
function evaluate(s,p) {
  const m={exports:{}};
  vm.runInNewContext(ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,
    {exports:m.exports,module:m,process:{env:{}},require(k) {
      if(p.endsWith('/teamRatingsService.ts')&&k==='./supabase/server') return {default:client};
      const dest=k.startsWith('lib/')?'web/'+k+'.ts':k.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(p),k))+'.ts':null;
      assert(dest&&allowed.has(dest),'Denied dependency '+k+' from '+p);return load(dest);
    }},{filename:p,timeout:1000});return m.exports;
}
function load(p) {assert(allowed.has(p));if(!cache.has(p))cache.set(p,evaluate(source(p),p));return cache.get(p);}
function extract(p,names) {
  const s=source(p),sf=ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true),selected=[];
  for(const n of sf.statements) {
    if(ts.isFunctionDeclaration(n)&&names.includes(n.name?.text)) selected.push(n.getText(sf));
    if(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>names.includes(d.name.getText(sf)))) selected.push(n.getText(sf));
  }
  assert.equal(selected.length,names.length);return evaluate(selected.join('\n'),p);
}
const near=(a,b)=>assert(Math.abs(a-b)<1e-10,`${a} != ${b}`);
(async()=>{
  const ratings=load('web/lib/teamRatingsService.ts'), version=load('web/lib/teamRatingVersion.ts');
  dbRows=[{team_abbreviation:'TOR',date:'2026-11-13',off_rating:110,def_rating:90,pace_rating:100,trend10:0,pp_tier:null,pk_tier:2}];
  const fallback=await ratings.fetchTeamRatings('2026-10-10');
  const asOf=await ratings.fetchTeamRatingsAsOf('2026-10-10');
  assert.equal(fallback[0].date,'2026-11-13');assert.equal(asOf.ratings.length,0);assert.equal(fallback[0].ppTier,null);
  assert.equal(version.describeGoaltendingBasis({calculationVersion:version.TEAM_POWER_V4_VERSION}).is5v5,true);
  assert.equal(version.describeGoaltendingBasis({calculationVersion:'legacy_unversioned'}).is5v5,false);
  const form=extract('web/lib/teamRatingsTrend.ts',['computeTeamFormContextFromHistory']);
  const absentPdo=form.computeTeamFormContextFromHistory(new Map([['TOR',[{date:'2026-10-10',offRating:100,defRating:100,paceRating:100,powerScore:100,pdo:null,pdoZ:0,teamAbbr:'TOR'}]]])).get('TOR');
  assert.equal(absentPdo.currentPdo,null);assert.equal(absentPdo.varianceSeries[0].value,100);
  const player=load('web/lib/trends/playerTrendCalculator.ts');
  const row=(day,extra={})=>({player_id:1,season_id:20262027,position_code:'C',date:'2026-10-'+String(day).padStart(2,'0'),...extra});
  const pick=(rows,key)=>player.buildPlayerTrendRecords(rows).filter(r=>r.metric_key===key);
  const rates=pick([row(1,{shots:1,toi_per_game:600}),row(2,{shots:1,toi_per_game:1800})],'shots_per_60');
  near(rates[1].average_value,4);near(2*3600/2400,3);
  const sparse=pick([row(1,{shots:10,toi_per_game:1200}),row(2,{shots:1,toi_per_game:1200}),row(3,{shots:1,toi_per_game:1200}),row(4,{shots:null,toi_per_game:1200}),row(5,{shots:1,toi_per_game:1200})],'shots_per_60');
  assert.equal(sparse[3].raw_value,null);assert.equal(sparse[3].rolling_avg_3,12);assert.equal(sparse[4].rolling_avg_3,3);
  const primary=pick([row(1,{goals:0,nst_first_assists:null,points:1})],'primary_points_pct')[0];assert.equal(primary.raw_value,0);
  const measuredZero=pick([row(1,{goals:0,nst_first_assists:0,points:1})],'primary_points_pct')[0];assert.equal(measuredZero.raw_value,0);
  const missingToi=pick([row(1,{shots:1,toi_per_game:null})],'shots_per_60')[0];assert.equal(missingToi.raw_value,null);
  const ctpi=load('web/lib/trends/recentTeamFormV2.ts'), gates=load('web/lib/trends/ctpiVersions.ts');
  const teamRows=[{team:'A',date:'2026-10-01',gp:1,xga:3,goals_against:2,toi_all_seconds:3600,pp_xgf:1,powerPlayToi:60},{team:'A',date:'2026-10-02',gp:1,xga:2,goals_against:3,toi_all_seconds:3900,pp_xgf:.2,powerPlayToi:600}];
  const metrics=ctpi.computeRecentTeamFormCandidateMetrics(teamRows);
  const pairedRecentGsax=(.9*(3-2)+(2-3))*3600/(.9*3600+3900);
  near(metrics.values.gsax_per_60_last10,(.9-3600/3900)/1.9);assert(Math.abs(metrics.values.gsax_per_60_last10-pairedRecentGsax)>.03);
  near(metrics.values.pp_xgf_per_60,(.9*1+.2)*3600/(.9*60+600));
  const candidate={ctpiVersion:2,publicationStatus:'candidate_unapproved',formulaVersion:ctpi.RECENT_TEAM_FORM_V2_CANDIDATE_FORMULA_VERSION,inputVersion:ctpi.RECENT_TEAM_FORM_V2_CANDIDATE_INPUT_VERSION,sourceGameCount:5,status:'partial'};
  assert.equal(gates.isDescriptiveBetaCtpiPayload(candidate),true);assert.equal(gates.isTrustedCtpiPayload(candidate,2),false);
  const sos=load('web/lib/trends/strengthOfScheduleContract.ts'), adapter=load('web/lib/trends/teamSosSnapshot.ts'), sosRead=load('web/lib/trends/strengthOfSchedule.ts');
  assert.equal(sos.recordPercentage(1,0,1,'points-pct'),.75);assert.equal(sos.recordPercentage(0,0,0,'points-pct'),null);
  const game=(id,home,away,day,result)=>({id,season:20262027,gameType:2,startTimeUTC:`2026-10-${String(day).padStart(2,'0')}T00:00:00Z`,gameState:result?'OFF':'FUT',gameScheduleState:'OK',homeTeam:{abbrev:home,score:result?.[0]},awayTeam:{abbrev:away,score:result?.[1]},...(result?{gameOutcome:{lastPeriodType:result[2]}}:{})});
  const games=[game(1,'B','D',2,[3,1,'REG']),game(2,'E','B',3,[3,2,'OT']),game(3,'A','B',6,[2,1,'REG']),game(4,'A','B',20),game(5,'A','D',7)];
  const teams=['A','B','D','E'].map((abbrev,i)=>({abbrev,id:i+1}));
  const adapted=adapter.adaptClubSchedules({seasonId:20262027,schedules:teams.map(({abbrev})=>({team:abbrev,observedAt:'2026-10-10T08:00:00Z',games:games.filter(g=>g.homeTeam.abbrev===abbrev||g.awayTeam.abbrev===abbrev)}))});
  const sosRows=adapter.buildTeamSosSnapshotRows({seasonId:20262027,snapshotDate:'2026-10-10',cutoff:adapter.snapshotCutoff(adapted,Date.parse('2026-10-10T09:00:00Z')),teams,adapted,schedulesFetched:4});
  const focal=sosRows.find(r=>r.team_abbrev==='A');assert.equal(focal.past_fixtures,1);assert.equal(focal.pending_fixtures,1);assert.equal(focal.future_fixtures,1);assert.equal(focal.past_direct_points_pct,.75);
  const score=sosRead.computeSosRatingsV2(sosRows).find(r=>r.team==='A');assert.equal(score.sosScore,75);
  const emptyAdapted=adapter.adaptClubSchedules({seasonId:20262027,schedules:teams.map(({abbrev})=>({team:abbrev,observedAt:'2026-10-10T08:00:00Z',games:[]}))});
  const emptyScheduleRows=adapter.buildTeamSosSnapshotRows({seasonId:20262027,snapshotDate:'2026-10-10',cutoff:adapter.snapshotCutoff(emptyAdapted,Date.parse('2026-10-10T09:00:00Z')),teams,adapted:emptyAdapted,schedulesFetched:4});
  assert.equal(emptyScheduleRows.length,4);assert(emptyScheduleRows.every(r=>r.past_fixtures+r.pending_fixtures+r.future_fixtures===0));
  const u=load('web/lib/trends/utils.ts'), surface=load('web/lib/trends/trendsSurface.ts');
  const constant=u.summarizePairedCorrelation([{x:0,y:2},{x:0,y:4},{x:0,y:6}]);assert.equal(constant.r,0);assert.equal(constant.r2,0);
  assert(Number.isNaN(u.percentile([4],4)));assert.equal(u.percentile([4,4,4],4),0);
  const mids=u.computeMidRankPercentiles([{key:'a',value:4},{key:'b',value:4},{key:'c',value:4}]);for(const v of mids.values())assert.equal(v,50);
  assert.equal(surface.formatRollingMetricValue('primary_points_pct',.167),'16.7%');assert.equal(surface.formatRollingMetricValue('pdo',1.093),'1.093');assert.equal(surface.formatGoalieTrendValue('savePct',.921).value,'.921');
  const output={pin,status:'passed',ratingFallback:{requested:'2026-10-10',actual:fallback[0].date,asOfRows:asOf.ratings.length},absentPdo,playerRates:{actualAverage:rates[1].average_value,pairedRate:3},missingWindow:sparse.map(r=>({date:r.game_date,raw:r.raw_value,rolling3:r.rolling_avg_3,count:r.sample_size})),missingPrimaryAssist:{raw:primary.raw_value,knownZeroControl:measuredZero.raw_value},ctpi:{recentGsax:metrics.values.gsax_per_60_last10,pairedRecentGsax,seasonGsax:metrics.values.gsax_per_60_season,pooledPp:metrics.values.pp_xgf_per_60,candidatePredictionGated:true},sos:{past:focal.past_fixtures,pending:focal.pending_fixtures,future:focal.future_fixtures,pointsPct:focal.past_direct_points_pct,score:score.sosScore,emptySchedulesAcceptedRows:emptyScheduleRows.length},constantCorrelation:constant,legacyPercentile:{single:'NaN',allTied:u.percentile([4,4,4],4),midRankControl:50},sources,limits:'Exact frozen modules and one AST-isolated history function; in-memory table/query double and empty env. Synthetic inputs only. Supplied suites, production, app routes, browser, provider and live writer not run.'};
  fs.writeFileSync(__dirname+'/teamtrend1-probe-output.json',JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify({...output,sources:sources.length}));
})().catch(e=>{console.error(e);process.exitCode=1;});
