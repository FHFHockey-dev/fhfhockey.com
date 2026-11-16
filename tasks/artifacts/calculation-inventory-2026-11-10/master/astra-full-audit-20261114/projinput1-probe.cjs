const cp=require('child_process'),vm=require('vm'),crypto=require('crypto'),assert=require('assert'),ts=require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const pin='89da739cb45d7d572ed59bfa0b209c79c5d99299',hashes={};
function src(p){const s=cp.execFileSync('git',['show',pin+':'+p]).toString();hashes[p]=crypto.createHash('sha256').update(s).digest('hex');return ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true);}
function load(p,globals={},names=null,extra=''){const sf=src(p),nodes=sf.statements.filter(n=>!ts.isImportDeclaration(n)&&(!names||names.includes(n.name?.text)));const m={exports:{}};vm.runInNewContext(ts.transpileModule(nodes.map(n=>n.getText(sf)).join('\n')+'\n'+extra,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports,...globals},{timeout:1000});return m.exports;}
const dir='web/lib/projections/derived/',shift=load('web/lib/projections/shiftChartCompleteness.ts'),pbp=load('web/lib/projections/pbpCompletenessServer.ts',{},['isPositiveSafeInteger','isValidIsoDate','isNonNegativeSafeInteger','isCompleteStoredPbpEvidence']),sit=load(dir+'situation.ts'),split=load(dir+'penaltyShotSplit.ts'),canonical=load('web/lib/supabase/Upserts/nhlStrengthState.ts');
const game={id:2026020001,date:'2026-10-07',homeTeamId:1,awayTeamId:2};
const shifts=Array.from({length:10},(_,i)=>{const home=i<5;return {id:i+1,game_id:game.id,player_id:10+i,team_id:home?1:2,opponent_team_id:home?2:1,season_id:20262027,game_date:game.date,game_type:'2',home_or_away:home?'home':'away',team_abbreviation:home?'AAA':'BBB',opponent_team_abbreviation:home?'BBB':'AAA',total_es_toi:'10:00',total_pp_toi:home?'1:00':'0:00',total_pk_toi:home?'0:00':'1:00'};});
const pbpGame={id:game.id,date:game.date,hometeamid:1,awayteamid:2,type:2,season:'20262027',hometeamabbrev:'AAA',awayteamabbrev:'BBB',hometeamscore:1,awayteamscore:0};
const base={gameid:game.id,periodnumber:1,periodtype:'REG',situationcode:'1551',eventownerteamid:1,shootingplayerid:10,scoringplayerid:null,assist1playerid:null,assist2playerid:null,goalieinnetid:15};
let plays=[{...base,id:1,typedesckey:'shot-on-goal',situationcode:'1560'},{...base,id:2,typedesckey:'goal',scoringplayerid:10,situationcode:'1010'},{...base,id:3,typedesckey:'missed-shot',situationcode:'1010'},{...base,id:4,typedesckey:'goal',scoringplayerid:10,situationcode:'0101',periodnumber:5,periodtype:'SO'},{...base,id:5,typedesckey:'game-end',situationcode:null}];
let fakeReads=0;
const supabase={from(table){const q={select(){return q},eq(){return q},or(){return q},order(){return q},range(){fakeReads++;return Promise.resolve({data:table==='shift_charts'?shifts:plays,error:null})},maybeSingle(){fakeReads++;return Promise.resolve({data:pbpGame,error:null})}};return q;}};
const builder=load(dir+'buildStrengthTablesV2.ts',{...shift,...pbp,...sit,...split,classifyEventStrengthBucket:canonical.classifyEventStrengthBucket,supabase,fetchAllSupabasePages:async fn=>(await fn({from:0,to:999})).data,fetchNhlApiShiftPlayerManifest:async()=>new Map([[game.id,shifts.map(x=>x.player_id)]]),PBP_COMPLETENESS_SELECT:'fake-only',SHIFT_CHART_STRENGTH_OWNERSHIP_FILTER:'fake-only'});
const writes=[];
const legacy=load('web/lib/supabase/Upserts/fetchPbP.ts',{supabase:{from(table){return {async upsert(rows){writes.push({table,count:rows.length});for(const r of rows){const i=plays.findIndex(p=>p.id===r.id);if(i>=0)plays[i]={...plays[i],...r};else plays.push(r);}return {error:null};}}}}},['upsertPlayByPlayData'],'export { upsertPlayByPlayData };');
(async()=>{
 plays=[{...base,id:1,typedesckey:'goal',scoringplayerid:10},{...base,id:2,typedesckey:'game-end',situationcode:null}];
 const before=await builder.preparePlayerGameStrengthV2({game});
 const manifest={input_status:'complete',input_fingerprint:'a'.repeat(64),input_version:1};
 const retainedManifest=JSON.stringify(manifest);
 await legacy.upsertPlayByPlayData(game.id,{gameDate:game.date,plays:[{eventId:1,periodDescriptor:{number:1,periodType:'REG'},situationCode:'1551',typeDescKey:'goal',details:{eventOwnerTeamId:1,scoringPlayerId:11,goalieInNetId:15}},{eventId:2,periodDescriptor:{number:3,periodType:'REG'},typeDescKey:'game-end'}]});
 const after=await builder.preparePlayerGameStrengthV2({game});
 assert.equal(before.rows.find(r=>r.player_id===10).goals_es,1);
 assert.equal(after.rows.find(r=>r.player_id===10).goals_es,0);
 assert.equal(after.rows.find(r=>r.player_id===11).goals_es,1);
 assert.equal(writes.length,1);assert.equal(writes[0].table,'pbp_plays');assert.equal(JSON.stringify(manifest),retainedManifest);
 console.log(JSON.stringify({pin,hashes,checks:{writes,beforeScorer:10,afterScorer:11,rowCount:plays.length,manifestWriteObserved:false},boundaries:['Exact frozen legacy mapper and derived builder with fake client and fake manifest','No database transaction or trigger behavior executed','Static migration and route trace establishes missing invalidation and normalized-content comparison; live incidence unknown','No app import, SQL/RPC, provider/page, server/build, write, fix or release']},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
