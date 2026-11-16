const fs=require('fs'),cp=require('child_process'),vm=require('vm'),assert=require('assert/strict'),ts=require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const pin='89da739cb', sources=[];
function load(path,deps={}){const source=cp.execFileSync('git',['show',pin+':'+path],{encoding:'utf8'}),module={exports:{}};sources.push(path);vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,Date,Intl,TextEncoder,require:name=>{if(!(name in deps))throw Error('Unexpected dependency '+name);return deps[name]}},{filename:path});return module.exports;}
const denied=new Proxy({}, {get:(_t,name)=>{throw Error('Unexercised dependency accessed: '+String(name));}});
const time=load('web/lib/projections/evidenceTime.ts');
const calendar=load('web/lib/player-forecasts/contributions.ts',{'../projections/evidenceTime':time});
const heads=load('web/lib/projections/modeledHeadTotals.ts'),wire=load('web/lib/rosterScheduleData/bridgeForecastWire.ts');
const bridge=load('web/lib/rosterScheduleData/forgeDailyBridge.ts',{
 'lib/player-forecasts/contributions':calendar,'lib/projections/modeledHeadTotals':heads,'./bridgeForecastWire':wire,
 ...Object.fromEntries(['lib/projections/dailyBoardEvidence','lib/projections/releasedRunFence','lib/projections/externalInputProof','lib/projections/reserveProjections','lib/projections/calculators/team-context-adjustments','lib/projections/calculators/skater-adjustments','lib/projections/goalie/goalieOutcomes','lib/projections/goalie/goalieCandidates','lib/projections/constants/projection-weights','./planningInputs'].map(k=>[k,denied]))
});
const now=new Date('2026-10-19T18:00:00Z'),season=20262027;
const players=[{id:'s1',nhlId:101,nhlTeamId:10,rosterRevision:'roster-s1',name:'Synthetic',teamAbbreviation:'TOR',eligiblePositions:['C'],eligibilityVerified:true,playerClass:'skater',availability:'free_agent',ownership:null,canDrop:true,holdValue:null,reserveEligibility:[]}];
const games=[{id:'1',scheduleRevision:'schedule-1-TOR',date:'2026-10-19',startsAt:'2026-10-19T23:00:00Z',teamAbbreviation:'TOR',opponent:'MTL',home:true,status:'scheduled'}];
const base={runs:[{run_id:'r',as_of_date:'2026-10-19',created_at:'2026-10-19T12:00:00Z',git_sha:'abc',external_input_proven:true}],skaters:[{run_id:'r',as_of_date:'2026-10-19',horizon_games:1,game_id:1,player_id:101,team_id:10,proj_goals_es:.25,proj_goals_pp:.1,proj_goals_pk:null,proj_assists_es:.3,proj_assists_pp:.15,proj_assists_pk:null,proj_shots_es:2.5,proj_shots_pp:.6,proj_shots_pk:null,proj_toi_es_seconds:900,proj_toi_pp_seconds:180,proj_toi_pk_seconds:null,proj_hits:1.2,proj_blocks:.5,proj_pim:null,proj_plus_minus:null}],goalies:[]};
const acceptedOut={assertions:[{gameId:1,teamId:10,playerId:101,dimension:'availability',value:'out',confirmed:true,evidenceId:'synthetic',sourceKey:'fixture',sourceUrl:null,publishedAt:'2026-10-19T15:00:00Z',receivedAt:'2026-10-19T15:00:00Z'}],conflicts:[]};
function build(state){return bridge.buildForgeDailyBridgeForecasts({...base,skaters:base.skaters.map(r=>({...r,availability_state:state,availability_game_id:'1'})),goalieNews:acceptedOut},players,games,now,season,calendar.forecastCalendarPolicy(14));}
const projected=build('projected_lineup'),uncertain=build('uncertain');
assert.equal(projected.forecasts[0].stats.GOALS,.35);assert.equal(projected.forecasts[0].allowedUses.totals,true);assert.equal(wire.reserveCodeOf(projected.forecasts[0]),null);
assert.equal(uncertain.forecasts[0].stats.GOALS,0);assert.equal(wire.reserveCodeOf(uncertain.forecasts[0]),'skater:confirmed_out');
const current=bridge.teamStrengthPriors([{team_abbrev:'TOR',date:'2026-10-19',games_played:10,nst_season:season,xga:null,xga_per_game:3,xgf_per_game:null}],[],season).get('TOR');
const previous=bridge.teamStrengthPriors([],[{team_abbreviation:'MTL',gp:82,xga:null,xgf:null}],season).get('MTL');
assert.equal(current.xga,0);assert.equal(current.xgfPerGame,0);assert.equal(previous.xgaPerGame,0);assert.equal(previous.xgfPerGame,0);
const allowed=(opponent,dPoints)=>[{season_id:season,opponent,position_group:'F',games:60,points:120,shots:1200},{season_id:season,opponent,position_group:'D',games:60,points:dPoints,shots:480}];
const clean=bridge.opponentTilts([...allowed('MTL',60),...allowed('TOR',60)],season),gap=bridge.opponentTilts([...allowed('MTL',null),...allowed('TOR',60)],season);
assert.equal(clean.get('MTL|D').points,1);assert.equal(gap.get('MTL|D').points,.85);assert(gap.get('TOR|D').points>1);
const noLine=bridge.buildForgeDailyBridgeForecasts(base,[...players,{...players[0],id:'s2',nhlId:102,rosterRevision:'roster-s2'}],games,now,season,calendar.forecastCalendarPolicy(14));
const missing=noLine.forecasts.find(r=>r.playerId==='s2');assert.equal(missing.stats.GOALS,null);assert.equal(missing.allowedUses.totals,false);assert(noLine.limitations.some(l=>l.includes('plans count 0 for them')));
const packed=wire.compactBridgeForecasts(projected.forecasts,{players,games},season).wire;
const bad=JSON.parse(JSON.stringify(packed));bad.rows[0].push('constructor');
const expanded=wire.expandBridgeForecasts(bad,{players,games});assert.equal(expanded.length,1);assert.equal(typeof expanded[0].limitations.at(-1),'function');
const output={pin,status:'passed',sources,confirmedOut:{projectedStateGoals:projected.forecasts[0].stats.GOALS,projectedStateTotals:projected.forecasts[0].allowedUses.totals,uncertainStateGoals:uncertain.forecasts[0].stats.GOALS},nullPriors:{current,previous},missingPositionalPoints:{cleanMtl:clean.get('MTL|D'),missingMtl:gap.get('MTL|D'),affectedPeerTor:gap.get('TOR|D')},missingLineLabel:{goals:missing.stats.GOALS,totals:missing.allowedUses.totals,aggregateNote:noLine.limitations.find(l=>l.includes('plans count 0 for them')),rowNote:missing.limitations.at(-1)},invalidReserveCode:{input:'constructor',acceptedRows:expanded.length,noteType:typeof expanded[0].limitations.at(-1),totals:expanded[0].allowedUses.totals},limits:'Exact frozen complete bridge, wire, calendar and head modules; synthetic input only. Every unused loader, transport, adjustment and goalie dependency throws on access. No live calls, app imports, environment reads, Vitest, producer, authenticated planner or page execution. Direct prior/tilt probes prove admission failures, not production incidence.'};
fs.writeFileSync('tasks/artifacts/calculation-inventory-2026-11-10/master/astra-full-audit-20261114/rsobridge1-probe-output.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output));
