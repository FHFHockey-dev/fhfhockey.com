import React from 'react';
import {createRoot} from 'react-dom/client';
import Page from '/Users/tim/Code/fhfhockey.com/web/pages/roster-schedule-optimizer';
import {defaultWorkspace} from '/Users/tim/Code/fhfhockey.com/web/lib/rosterScheduleOptimizer/workspace';
import layout from '/Users/tim/Code/fhfhockey.com/web/components/Layout/Layout.module.scss';

const cutoff='2026-10-13T11:00:00Z',now='2026-10-13T12:00:00Z';
const player=(id:string,name:string,team:string,teamId:number,position='C',availability='rostered')=>({id,name,nhlId:Number(id),nhlTeamId:teamId,rosterRevision:'fixture-roster-'+id,teamAbbreviation:team,eligiblePositions:[position],eligibilityVerified:true,playerClass:'skater',availability,canDrop:true,ownership:null,holdValue:null,reserveEligibility:[]});
const members=[player('1','Fixture Alpha','AAA',1),player('2','Fixture Bravo','BBB',2),...Array.from({length:17},(_,i)=>player(String(i+10),'Fixture Defender '+(i+1),'CCC',3,'D'))];
const candidates=[player('30','Fixture AGP Candidate','CCC',3,'C','free_agent'),player('31','Fixture Points Candidate','DDD',5,'C','free_agent')];
const catalog=[...members,...candidates,player('40','Fixture Opponent X','XXX',4,'D','unknown'),player('41','Fixture Opponent Y','YYY',6,'D','unknown')];
const pair=(id:string,date:string,home:string,away:string)=>[true,false].map(isHome=>({id,date,startsAt:date+'T20:00:00Z',scheduleRevision:'fixture-schedule-'+id,teamAbbreviation:isHome?home:away,opponent:isHome?away:home,home:isHome,status:'scheduled'}));
const games=[...pair('2001','2026-10-13','CCC','XXX'),...pair('2002','2026-10-14','AAA','BBB'),...pair('2003','2026-10-14','DDD','YYY')];
const forecasts=[...members,...candidates].map(p=>{const g=games.find(g=>g.teamAbbreviation===p.teamAbbreviation)!;return {playerId:p.id,gameId:g.id,stats:{GOALS:p.id==='1'?10:p.id==='30'?2:p.id==='31'?11:1},conditioning:'unconditional',sourceKind:'detailed',sourceWatermark:'SYNTHETIC-FIXTURE-ONLY',cutoffAt:cutoff,issuedAt:cutoff,expiresAt:g.startsAt,revisionId:'fixture-revision-'+p.id,modelVersion:'fixture-mechanics',startProbability:null,confirmedStart:false,allowedUses:{assignment:true,totals:true,comparison:true,conditionalTieBreak:false},limitations:[],issuedContext:{version:'forge-issued-context-v1',playerId:p.id,gameId:g.id,nhlPlayerId:p.nhlId,teamId:p.nhlTeamId,seasonId:20262027,scheduledAt:g.startsAt,scheduleRevision:g.scheduleRevision,rosterRevision:p.rosterRevision,observedAt:cutoff,scheduleSourceUpdatedAt:cutoff,scheduleFetchedAt:cutoff,identityUpdatedAt:cutoff,membershipCreatedAt:['2026-09-01T00:00:00Z']}};});
const scenario=(window as any).__fixtureScenario??'complete';
const workspace=defaultWorkspace(new Date(now));
workspace.context={...workspace.context,startDate:'2026-10-13',endDate:'2026-10-19',timeZone:'UTC',asOf:now};
workspace.rules={...workspace.rules,rosterSlots:{C:1,D:17,BN:1},acquisitionTiming:'same_day',acquisitionCost:1,
  periods:[{id:'Fixture week',start:'2026-10-13T00:00:00Z',end:'2026-10-20T00:00:00Z',remaining:1,source:'manager'}],
  scoring:{mode:'points',weights:{GOALS:1},categories:[]},unsupported:[]};
workspace.roster=scenario==='empty'?[]:members.map(p=>({playerId:p.id,position:'bench' as const}));
workspace.manualPlayers=scenario==='empty'?[]:catalog as any;
workspace.intent.protectedPlayerIds=scenario==='empty'?[]:members.slice(1).map(p=>p.id);
const data={players:scenario==='empty'?[]:catalog,games:scenario==='empty'?[]:games,forecasts:scenario==='complete'?forecasts:scenario==='conditional'?forecasts.map(f=>({...f,stats:{},conditionalStats:f.stats,tieBreakStats:f.stats,allowedUses:{assignment:false,totals:false,comparison:false,conditionalTieBreak:true},limitations:['Conditional ability only; assumes participation. No projected total.']})):[],evidence:{schedule:{source:'LOCAL FULL-PAGE FIXTURE',asOf:now,seasonId:20262027,completeness:scenario==='complete'||scenario==='conditional'?'complete':'partial',limitations:scenario==='complete'?[]:['Fixture partial/empty data']}}};
localStorage.setItem('fhfh:rso:workspace:v1',JSON.stringify(workspace));
(window as any).__fixtureCalendar=[...new Map(games.map(g=>[g.id,g])).values()].map(g=>({id:Number(g.id),season:20262027,gameType:2,gameDate:g.date,startTimeUTC:g.startsAt,homeTeam:{id:catalog.find(p=>p.teamAbbreviation===(g.home?g.teamAbbreviation:g.opponent))!.nhlTeamId,winOdds:null},awayTeam:{id:catalog.find(p=>p.teamAbbreviation===(g.home?g.opponent:g.teamAbbreviation))!.nhlTeamId,winOdds:null}}));
(window as any).__fixtureTeams=[...new Map(catalog.map(p=>[p.nhlTeamId,{id:p.nhlTeamId,abbreviation:p.teamAbbreviation}])).values()];
(window as any).__fixtureReads=[];
window.fetch=async (input:any,options:any)=>{
  const url=String(input),method=options?.method??'GET';(window as any).__fixtureReads.push({url,method});
  if(method!=='GET')throw Error('Fixture forbids writes');
  if(url.startsWith('/api/v1/roster-schedule-optimizer/data?'))return new Response(JSON.stringify({success:true,data}),{headers:{'Content-Type':'application/json'}});
  if(url.endsWith('/roster-schedule-optimizer/access'))return new Response(JSON.stringify({data:{eligible:false,capabilities:[],grantingSources:[],reason:'local_fixture'}}),{headers:{'Content-Type':'application/json'}});
  throw Error('Unexpected fixture fetch '+url);
};
createRoot(document.getElementById('root')!).render(<div className={[layout.container,layout.rosterOptimizerLayout].join(' ')}>
  <header style={{height:56,minHeight:56,padding:12,background:'#101820'}}>FHFH · isolated RSO acceptance fixture</header><Page/>
</div>);
