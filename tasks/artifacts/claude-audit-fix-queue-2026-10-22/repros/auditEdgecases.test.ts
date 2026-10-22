import { describe, it, expect, vi } from "vitest";
vi.mock("lib/supabase/server", () => ({ default: {} }));
import { buildForgeDailyBridgeForecasts } from "./rosterScheduleData/forgeDailyBridge";
import { forecastCalendarPolicy } from "./player-forecasts/contributions";
import { aggregateNstTeamCounts, aggregateWgoTeamGames } from "./stats/percentUnits";
import { buildLedgerRows, settleLedgerRows, scoreLedger } from "./player-forecasts/servedForecastLedger";
import { yahooPastLineupPoints } from "./integrations/yahoo/rosterPlanning";
import { isRollingForgeStageLeaseDead } from "./rollingForgePipelineRunState";
const player:any = {id:"p1",nhlId:11,nhlTeamId:1,rosterRevision:"r",name:"Synthetic player",teamAbbreviation:"TOR",eligiblePositions:["C"],eligibilityVerified:true,playerClass:"skater",availability:"free_agent",ownership:null,canDrop:true,holdValue:null,reserveEligibility:[]};
const game=(id:string,date:string):any=>({id,date,scheduleRevision:`s-${id}`,startsAt:`${date}T23:00:00Z`,teamAbbreviation:"TOR",opponent:"MTL",home:true,status:"scheduled"});
const line=(run:string,date:string,id:number):any=>({run_id:run,as_of_date:date,horizon_games:1,game_id:id,player_id:11,team_id:1,opponent_team_id:2,proj_goals_es:0.25,proj_goals_pp:0.1,proj_goals_pk:null,proj_assists_es:0.3,proj_assists_pp:0.15,proj_assists_pk:null,proj_shots_es:2.5,proj_shots_pp:0.6,proj_shots_pk:null,proj_toi_es_seconds:900,proj_toi_pp_seconds:180,proj_toi_pk_seconds:null,proj_hits:1.2,proj_blocks:0.5});
describe("independent audit reproductions",()=>{
 it("keeps a complete exact-game forecast when tomorrow's newer row has null learned heads",()=>{
 const inputs:any={runs:[{run_id:"today",as_of_date:"2026-10-21",created_at:"2026-10-21T10:00:00Z",git_sha:"a"},{run_id:"tomorrow",as_of_date:"2026-10-22",created_at:"2026-10-21T11:00:00Z",git_sha:"b"}],skaters:[line("today","2026-10-21",100),{...line("tomorrow","2026-10-22",101),proj_assists_es:null}],goalies:[],goalieShares:[]};
 const output=buildForgeDailyBridgeForecasts(inputs,[player],[game("100","2026-10-21"),game("101","2026-10-22")],new Date("2026-10-21T12:00:00Z"),20262027,forecastCalendarPolicy(14));
 console.log("BRIDGE_OBSERVED",JSON.stringify(output));
 expect(output.forecasts.find(x=>x.gameId==="100")).toBeDefined();
 });
 it("does not produce season percentages from unpaired missing count columns",()=>{
 const nst=aggregateNstTeamCounts([{gp:1,cf:10,ca:null},{gp:1,cf:10,ca:10}]);
 const wgo=aggregateWgoTeamGames([{games_played:1,power_play_goals_for:null,pp_opportunities:5,shots_for_per_game:null},{games_played:1,power_play_goals_for:1,pp_opportunities:5,shots_for_per_game:30}]);
 console.log("AGGREGATE_OBSERVED",JSON.stringify({nst:nst.cfPct,wgo:wgo.powerPlayPct,shots:wgo.shotsFor}));
 expect(wgo.powerPlayPct).toBeNull();
 });
 it("keeps a missing weighted actual stat unknown in the recorded Yahoo lineup",async()=>{
 const data=[{player_id:11,game_id:100,goals:2,hits:null}];
 const q:any={select:()=>q,in:()=>q,order:()=>q,range:async()=>({data,error:null})};
 const scored=await yahooPastLineupPoints({from:()=>q} as any,{pastLineups:[{date:"2026-10-20",source:"yahoo",entries:[{playerId:"p1",name:"Synthetic player",position:"C",slotId:"C1"}]}],players:[player],games:[{...game("100","2026-10-20"),status:"final"}],scoring:{mode:"points",weights:{GOALS:1,HITS:1},categories:[]}});
 console.log("PAST_POINTS_OBSERVED",JSON.stringify(scored));
 expect(scored[0].entries[0].points).toBeNull();
 });
 it("does not mark an absent player DNP just because one unrelated actual row arrived",()=>{
 const rows=buildLedgerRows({date:"2026-10-21",seasonId:20262027,now:new Date("2026-10-21T12:00:00Z"),games:[{gameId:100,date:"2026-10-21",scheduledAt:"2026-10-21T23:00:00Z",status:"scheduled",homeTeamId:1,awayTeamId:2}],players:[{nhlId:11,planningId:"p1",playerClass:"skater",teamId:1}],bridgeForecasts:[{playerId:"p1",gameId:"100",stats:{GOALS:1,ASSISTS:1,PP_POINTS:0,SHOTS_ON_GOAL:2,HITS:1,BLOCKED_SHOTS:1},revisionId:"bridge:today",modelVersion:"v",issuedAt:"2026-10-21T10:00:00Z",limitations:[]} as any],runDates:new Map([["today","2026-10-21"]]),scheduleGames:[],wgoGameRows:[],goalieGameRows:[]}).rows;
 const settled=settleLedgerRows(rows,{skaters:[{game_id:100,player_id:999,goals:1}],goalies:[]},"2026-10-22T11:00:00Z");
 console.log("SETTLE_OBSERVED",JSON.stringify(settled.map(x=>({dressed:x.dressed,fp:x.act_fantasy_points,settled:x.settled_at}))));
 expect(settled[0].settled_at).toBeNull();
 });
 it("recognizes an expired in-flight lease after a late durable checkpoint",()=>{
 const t=Date.parse("2026-10-21T10:00:00Z");
 const state:any={status:"running",cursorGameId:11,lastError:null,updatedAt:new Date(t+215000).toISOString(),leaseExpiresAt:new Date(t+270000).toISOString()};
 const dead=isRollingForgeStageLeaseDead(state,t+301000);
 console.log("LATE_LEASE_OBSERVED",JSON.stringify({state,dead}));
 expect(dead).toBe(true);
 });
});

it("coverage includes dressed roster players who lack every prediction and naive history",()=>{
 const rows=buildLedgerRows({date:"2026-10-21",seasonId:20262027,now:new Date("2026-10-21T12:00:00Z"),games:[{gameId:100,date:"2026-10-21",scheduledAt:"2026-10-21T23:00:00Z",status:"scheduled",homeTeamId:1,awayTeamId:2}],players:[{nhlId:11,planningId:"p1",playerClass:"skater",teamId:1},{nhlId:22,planningId:"rookie",playerClass:"skater",teamId:1}],bridgeForecasts:[{playerId:"p1",gameId:"100",stats:{GOALS:1,ASSISTS:1,PP_POINTS:0,SHOTS_ON_GOAL:2,HITS:1,BLOCKED_SHOTS:1},revisionId:"bridge:today",modelVersion:"v",issuedAt:"2026-10-21T10:00:00Z",limitations:[]} as any],runDates:new Map([["today","2026-10-21"]]),scheduleGames:[],wgoGameRows:[],goalieGameRows:[]}).rows;
 const actual=(player_id:number)=>({player_id,game_id:100,goals:1,assists:1,pp_points:0,shots:2,hits:1,blocked_shots:1});
 const score=scoreLedger(settleLedgerRows(rows,{skaters:[actual(11),actual(22)],goalies:[]},"2026-10-22T11:00:00Z"));
 console.log("COVERAGE_UNIVERSE_OBSERVED",JSON.stringify(score));
 expect(score[0]).toMatchObject({dressed:2,covered:1,coverage:0.5});
});
