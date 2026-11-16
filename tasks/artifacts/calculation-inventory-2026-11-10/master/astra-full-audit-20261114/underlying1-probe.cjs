// Run with TZ=America/New_York. All persistence below is an in-memory double.
const fs=require('fs'),cp=require('child_process'),vm=require('vm'),path=require('path');
const crypto=require('crypto'),assert=require('assert/strict');
const ts=require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const base='web/lib/underlying-stats/',sources=[],cache=new Map(),calls=[];
let rows={},built=[];
const client={from(table){
  assert(['goalie_underlying_summary_partitions','games','nhl_api_game_payloads_raw','skater_offensive_ratings_daily','skater_defensive_ratings_daily'].includes(table));
  const q={table,filters:[],orders:[]};calls.push(q);
  const b={select(){return b;},eq(k,v){q.filters.push(['eq',k,v]);return b;},lte(k,v){q.filters.push(['lte',k,v]);return b;},in(k,v){q.filters.push(['in',k,v]);return b;},like(k,v){q.filters.push(['like',k,v]);return b;},order(k,v){q.orders.push([k,v]);return b;},range(a,z){q.range=[a,z];return b;},upsert(batch,opt){assert.equal(table,'goalie_underlying_summary_partitions');q.upsert={keys:opt.onConflict,count:batch.length};for(const r of batch){const i=(rows[table]||[]).findIndex(x=>x.game_id===r.game_id&&x.strength===r.strength&&x.score_state===r.score_state);if(i>=0)rows[table][i]=r;else(rows[table]??=[]).push(r);}return Promise.resolve({error:null});},then(resolve,reject){let data=[...(rows[table]||[])].filter(r=>q.filters.every(([op,k,v])=>op==='eq'?r[k]===v:op==='lte'?r[k]<=v:op==='in'?v.includes(r[k]):r[k]?.startsWith(v.slice(0,-1))));for(const[k,v]of[...q.orders].reverse())data.sort((a,b)=>(a[k]<b[k]?-1:a[k]>b[k]?1:0)*(v.ascending?1:-1));if(q.range)data=data.slice(q.range[0],q.range[1]+1);return Promise.resolve({data,error:null}).then(resolve,reject);}};
  return b;
}};
const paginate=async fn=>{let out=[];for(let i=0;i<8;i++){const r=await fn({from:i*1000,to:(i+1)*1000-1});if(r.error)throw r.error;out.push(...r.data);if(r.data.length<1000)return out;}throw Error('fixture page bound');};
function source(p){const s=cp.execFileSync('git',['show','89da739cb:'+p],{encoding:'utf8'});sources.push({path:p,sha256:crypto.createHash('sha256').update(s).digest('hex')});return s;}
function selected(p,names){const s=source(p),sf=ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true),out=[];for(const n of sf.statements){if(ts.isFunctionDeclaration(n)&&names.includes(n.name?.text))out.push(n.getText(sf));if(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>names.includes(d.name.getText(sf))))out.push(n.getText(sf));}assert.equal(out.length,names.length);return out.join('\n');}
function evaluate(s,p,extra={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:m,exports:m.exports,URLSearchParams,process:{env:{}},...extra,require(k){
  if(k==='lib/supabase/server')return {default:client};
  if(k==='lib/supabase/pagination')return {fetchAllSupabasePages:paginate};
  if(k==='./playerStatsLandingServer')return {...landing,buildPlayerStatsLandingSummarySnapshotsForGameIds:async()=>built};
  if(k==='./playerStatsSummaryRefresh')return {...landing,warmPlayerStatsLandingSeasonAggregateCache:()=>{throw Error('Cache warm denied');}};
  if(k==='lib/NHL/server')return {getCurrentSeason:()=>{throw Error('Provider denied');}};
  if(k==='lib/games/gameFinality')return load('web/lib/games/gameFinality.ts');
  assert(k.startsWith('./'),'Denied '+k);return load(path.posix.join(base,k.slice(2))+'.ts');
}},{filename:p,timeout:1000});return m.exports;}
const allowed=new Set(['goalieStatsSummaryRefresh','goalieStatsRefreshWindow','playerStatsFilters','playerStatsFormatting','entityRatingsOverlay','playerStatsTypes'].map(x=>base+x+'.ts'));allowed.add('web/lib/games/gameFinality.ts');
function load(p){assert(allowed.has(p),'Denied module '+p);if(!cache.has(p))cache.set(p,evaluate(source(p),p));return cache.get(p);}
const landing=evaluate(selected(base+'playerStatsLandingServer.ts',['isObjectRecord','PLAYER_STATS_SUMMARY_VERSION','PLAYER_STATS_SUMMARY_FORMULA_REVISION','GOALIE_STATS_SUMMARY_TABLE','PLAYER_STATS_SUMMARY_PARTITION_SOURCE_URL_PREFIX','PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT','isCurrentPlayerStatsSummaryPayload']),base+'playerStatsLandingServer.ts');
(async()=>{
  const goalie=load(base+'goalieStatsSummaryRefresh.ts');
  const admin=evaluate(selected(base+'adminRouteHelpers.ts',['GAME_FINALITY_SELECT','fetchAllRows','fetchFinishedSeasonGameIds','selectMissingGoalieSummaryGameIds']),base+'adminRouteHelpers.ts',{serviceRoleClient:client,fetchAllSupabasePages:paginate,resolveGameFinality:load('web/lib/games/gameFinality.ts').resolveGameFinality,fetchSeasonGoalieSummaryGameIdSet:goalie.fetchSeasonGoalieSummaryGameIdSet});
  const game={id:2026020100,seasonId:20262027,type:2,date:'2026-10-10',startTime:'2026-10-10T23:00:00Z',game_state:'OFF',game_schedule_state:'OK',game_state_observed_at:'2026-10-11T02:00:00Z'};
  rows={games:[game],goalie_underlying_summary_partitions:[{game_id:game.id,season_id:20262027,strength:'fiveOnFive',score_state:'tied',payload:{version:1,formulaRevision:1}}]};
  const coverage=await goalie.fetchSeasonGoalieSummaryGameIdSet({supabase:client,seasonId:20262027});assert(coverage.has(game.id));
  const skipped=await admin.selectMissingGoalieSummaryGameIds({supabase:client,seasonId:20262027,requestedGameType:2,limit:5});assert.equal(skipped.length,0);
  rows.goalie_underlying_summary_partitions=[];const missing=await admin.selectMissingGoalieSummaryGameIds({supabase:client,seasonId:20262027,requestedGameType:2,limit:5});assert.equal(missing[0],game.id);
  const stale={game_id:game.id,season_id:20262027,strength:'powerPlay',score_state:'allScores',payload:{version:1,formulaRevision:2,marker:'obsolete split'}};
  rows.goalie_underlying_summary_partitions=[stale];
  built=[{game_id:game.id,season_id:20262027,game_date:game.date,source_url:`derived://underlying-player-summary-v2/goalies/allStrengths/allScores/${game.id}`,payload_hash:'synthetic-new',payload:{version:1,formulaRevision:2,marker:'replacement all'},fetched_at:'2026-10-11T03:00:00Z'}];
  const refreshed=await goalie.refreshGoalieUnderlyingSummarySnapshotsForGameIds({gameIds:[game.id],seasonId:20262027,preferSharedSnapshotSeed:false,shouldWarmLandingCache:false,supabase:client});
  assert.equal(refreshed.rowsUpserted,1);assert(rows.goalie_underlying_summary_partitions.includes(stale));assert(landing.isCurrentPlayerStatsSummaryPayload(stale.payload));
  const filters=load(base+'playerStatsFilters.ts'),format=load(base+'playerStatsFormatting.ts'),overlay=load(base+'entityRatingsOverlay.ts');
  const state=filters.createDefaultLandingFilterState({currentSeasonId:20262027});state.expandable.scope={kind:'dateRange',startDate:'2026-10-01',endDate:'2026-10-31'};
  const historical=await overlay.overlayEntityRatingsOnLandingResponse({response:{rows:[{playerId:1}]},variant:'skater',client,state,asOfDate:new Date('2026-11-15T15:00:00Z')});assert.equal(historical.ratingsOverlay.status,'hidden');
  const roundtrip=filters.parsePlayerStatsFilterStateFromQuery(filters.buildPlayerStatsSearchParams(state),filters.createDefaultLandingFilterState({currentSeasonId:20262027}));assert.equal(JSON.stringify(roundtrip),JSON.stringify(state));
  const formattedDate=format.formatPlayerStatsDate('2026-11-13');assert.equal(formattedDate,'Nov 12');assert.equal(format.formatPlayerStatsPercentage(null),'—');assert.equal(format.formatPlayerStatsPercentage(0),'0.0%');assert.equal(format.formatPlayerStatsToi(1474),'24:34');
  const output={pin:'89da739cb',status:'passed',coverage:{orphanOldRevisionPartitionMarksGameCovered:coverage.has(game.id),missingSelectorWithOrphan:skipped,missingSelectorWithoutAnyPartition:missing},refresh:{rowsUpserted:refreshed.rowsUpserted,storedKeys:rows.goalie_underlying_summary_partitions.map(r=>r.strength+'/'+r.score_state),obsoleteSplitStillAcceptedByRevisionGate:landing.isCurrentPlayerStatsSummaryPayload(stale.payload)},date:{zone:Intl.DateTimeFormat().resolvedOptions().timeZone,input:'2026-11-13',actual:formattedDate,expected:'Nov 13'},controls:['Historical overlay hidden','Filter URL roundtrip','Missing percentage remains em dash; known zero remains zero','1474 seconds renders 24:34'],sources,limits:'Exact frozen modules and AST-isolated admin/gate helpers; in-memory finite query/upsert double, supplied synthetic snapshot producer, no application/DB/provider invocation. Supplied test suites not executed.'};
  fs.writeFileSync(__dirname+'/underlying1-probe-output.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({...output,sources:sources.length}));
})().catch(e=>{console.error(e);process.exitCode=1;});
