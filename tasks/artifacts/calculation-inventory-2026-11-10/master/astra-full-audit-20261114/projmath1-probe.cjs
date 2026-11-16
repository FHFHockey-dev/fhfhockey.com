const cp=require('child_process'),vm=require('vm'),crypto=require('crypto'),assert=require('assert'),ts=require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const pin='89da739cb45d7d572ed59bfa0b209c79c5d99299',hashes={};
function src(p){const s=cp.execFileSync('git',['show',pin+':'+p]).toString();hashes[p]=crypto.createHash('sha256').update(s).digest('hex');return ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true);}
function load(p,globals={},names=null,extra=''){const sf=src(p),nodes=sf.statements.filter(n=>!ts.isImportDeclaration(n)&&(!names||names.includes(n.name?.text)));const m={exports:{}};vm.runInNewContext(ts.transpileModule(nodes.map(n=>n.getText(sf)).join('\n')+'\n'+extra,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports,...globals},{timeout:1000});return m.exports;}
const root='web/lib/projections/';
const sit=load(root+'derived/situation.ts'),shift=load(root+'shiftChartCompleteness.ts');
const clock=load(root+'penaltyClock.ts',{...sit,...shift,structuredClone});
const heads=load(root+'modeledHeadTotals.ts');
const accounting=load(root+'nativeGoalAccounting.ts',{boardSkaterForecast:()=>({participationProbability:null,expected:null}),skaterParticipationFromEvidence:()=>null});
const goalie=load(root+'goalie/goalieOutcomes.ts');
const quality=load(root+'opponentGoalieQuality.ts',{posteriorSavePct:goalie.posteriorSavePct,clamp:(x,l,h)=>Math.max(l,Math.min(h,x))});
const fmt=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
function e(id,t,kind='stoppage',details={},period=1){return {eventId:id,sortOrder:id,typeDescKey:kind,periodDescriptor:{number:period,periodType:period<4?'REG':'OT'},timeInPeriod:fmt(t),timeRemaining:fmt((period<4?1200:300)-t),situationCode:'1551',details};}
const teams={homeTeamId:1,awayTeamId:2,gameType:2};
const pen=(id,t,duration=2,typeCode='MIN',period=1)=>e(id,t,'penalty',{eventOwnerTeamId:2,committedByPlayerId:id+100,duration,typeCode},period);
const span=x=>JSON.parse(JSON.stringify(clock.buildPenaltyClock(x,teams).spans));
assert.deepEqual(span([e(1,0,'period-start'),pen(2,439),e(3,564),e(4,1200,'game-end')]),[{teamId:1,start:439,end:559}]);
assert.deepEqual(span([e(1,0,'period-start'),pen(2,60,4),e(3,100,'goal',{eventOwnerTeamId:1}),e(4,400,'game-end')]),[{teamId:1,start:60,end:220}]);
assert.deepEqual(span([e(1,0,'period-start'),pen(2,60,15,'MAT'),e(3,100,'goal',{eventOwnerTeamId:1}),e(4,400,'game-end')]),[{teamId:1,start:60,end:360}]);
assert.deepEqual(span([pen(2,1140,2,'MIN',3),e(3,0,'period-start',{},4),e(4,300,'game-end',{},4)]),[{teamId:1,start:3540,end:3660}]);
const physical=[];for(let p=1;p<=3;p++){physical.push(e(p*10,0,'period-start',{},p),e(p*10+1,1200,p===3?'game-end':'period-end',{},p));}
assert.equal(clock.hasCompletePenaltyClockSource(physical,2),true);assert.equal(clock.hasCompletePenaltyClockSource(physical.filter(x=>x.periodDescriptor.number!==2),2),false);
const row={player_id:10,game_id:1,team_id:1,as_of_date:'2026-10-07',horizon_games:1,proj_goals_es:.333,proj_goals_pp:0,proj_goals_pk:null};
const team=accounting.buildNativeTeamGoalAccounting({gameId:1,teamId:1,asOfDate:row.as_of_date,horizonGames:1,currentRosterPlayerIds:[10,11],playerRows:[row,{...row,player_id:11}]});
assert.equal(team.reportedEsPpMean,.666);assert.equal(team.reportedAllStrengthMean,null);assert.equal(team.residualMean,null);assert.equal(team.fullGameEligible,false);assert.throws(()=>accounting.buildNativePlayerGoalAccounting({...row,proj_goals_es:null,proj_goals_pp:NaN}));
const all=quality.computeOpponentGoalieFinishingContext({leagueSavePct:.9,candidates:[{goalieId:1,startProbability:.4,historyShotsAgainst:0,historyGoalsAllowed:0}]});
assert.equal(all.unresolvedStartMass,.6);assert(Math.abs(all.expectedGoalsAllowedPerShot-.1)<1e-12);assert.equal(all.adjustment,'neutral_unvalidated');
console.log(JSON.stringify({pin,hashes,checks:{penaltyCases:['minor exact expiry','double-minor goal release','MAT15 retains five-minute major','regulation to OT carry'],physicalSource:'complete accepted; missing second period rejected',nativeSerializedSum:team.reportedEsPpMean,unknownAllStrength:team.reportedAllStrengthMean,context:all},boundaries:['Exact pinned extracted kernels; participation dependency explicitly stubbed unknown, not tested','No stage/reader/provider execution or model qualification','No Vitest, SQL, page, server/build, app edit or release']},null,2));
