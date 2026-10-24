// Artifact-only diagnostic. Imports the frozen candidate; does not change its source or production catalog.
import { afterEach, expect, it, vi } from "vitest";
import { consumerGameRevisionFixture, setConsumerSkaterEvidence } from "__test-fixture/consumerGameRevision";
import { normalizePlanningGames, publicPlanningForecasts } from "lib/rosterScheduleData/planning";
import { evaluatePlan } from "lib/rosterScheduleOptimizer/planning";
import type { PlanningSnapshot, PlanIntent } from "lib/rosterScheduleOptimizer/planningTypes";
import * as policy from "lib/player-forecasts/rsoUsePolicy";
import { bindFixtureForecast, fixtureRsoPolicy } from "lib/player-forecasts/rsoUsePolicy.fixtures";

function inputs() {
  const f = consumerGameRevisionFixture();
  vi.useFakeTimers({toFake:["Date"]}); vi.setSystemTime(f.now);
  const first=f.revision.payload.players[0]; first.players={fullName:"Fixture shots skater",position:"C"};
  const second=structuredClone(first); second.player_id=f.players[1].nhlId!;
  second.players={fullName:"Fixture goals skater",position:"C"};second.proj_goals_es=3;second.proj_shots_es=0.2;
  setConsumerSkaterEvidence(f.revision,second);f.revision.payload.players.push(second);
  f.players=f.players.map(p=>({...p,playerClass:"skater",eligiblePositions:["C"],eligibilityVerified:true,availability:"rostered"}));
  const games=normalizePlanningGames(f.scheduleRows);
  const forecasts=publicPlanningForecasts([f.revision],f.players,games,f.now,{},[],f.seasonId);
  expect(forecasts).toHaveLength(2);
  const snapshot:PlanningSnapshot={id:"synthetic-crowded-consumer-checkpoint",context:{provider:"manual",seasonId:f.seasonId,leagueId:"fixture",teamId:"fixture",startDate:f.date,endDate:f.date,timeZone:"UTC",asOf:f.now.toISOString()},
    players:f.players,roster:f.players.map(p=>({playerId:p.id,position:"bench"})),games,forecasts,
    rules:{lineupMode:"daily",rosterSlots:{C:1,BN:1},acquisitionTiming:"same_day",acquisitionCost:1,periods:[],scoring:{mode:"points",weights:{GOALS:1},categories:[]},goalieMinimum:{required:null,credited:null,counts:"unknown",penalty:"none"},unsupported:[]},
    lockedAssignments:[],realized:{},opponent:null,evidence:{schedule:{source:"synthetic complete schedule",asOf:f.now.toISOString(),seasonId:f.seasonId,completeness:"complete",limitations:[]}}};
  const intent:PlanIntent={revision:3,steps:[],protectedPlayerIds:[],excludedPlayerIds:[],goalieCoverage:"accept_risk",goalieWindow:"any",goalieSplit:"mon_thu",alternativeCount:5};
  return {f,snapshot,intent};
}
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();});
it("keeps the original unreviewed fixture denied despite valid numeric values and serialized allowed uses",()=>{
 const {snapshot,intent}=inputs();expect(policy.RSO_USE_POLICY.reviews).toHaveLength(0);
 const result=evaluatePlan(snapshot,intent,"outcome");
 expect(result.comparisonEligible).toBe(false);expect(result.projectedValue).toBeNull();expect(result.recommendation?.eligible).toBe(false);
});
it("preserves goal and shot selection with exact fictional review and withdraws it on revocation",()=>{
 const {f,snapshot,intent}=inputs();const codes=[...new Set(snapshot.forecasts.map(x=>x.modelVersion!))];
 const testPolicy=fixtureRsoPolicy(codes,["GOALS","SHOTS_ON_GOAL"]);
 const mocked=vi.spyOn(policy,"currentRsoUsePolicy").mockReturnValue(testPolicy);
 snapshot.forecasts=snapshot.forecasts.map(bindFixtureForecast);const unchanged=JSON.stringify(snapshot);
 for(const [target,expectedId] of [["GOALS",f.players[1].id],["SHOTS_ON_GOAL",f.players[0].id]]){
  const result=evaluatePlan({...snapshot,rules:{...snapshot.rules,scoring:{mode:"points",weights:{[target]:1},categories:[]}}},intent,"outcome");
  expect(result).toMatchObject({legal:true,activeGames:1,benchGames:1,comparisonEligible:true,recommendation:{eligible:true}});
  expect(result.assignments.map(x=>x.playerId)).toEqual([expectedId]);
  expect(result.projectedValue).toBeCloseTo(snapshot.forecasts.find(x=>x.playerId===expectedId)!.stats[target]!);
 }
 expect(JSON.stringify(snapshot)).toBe(unchanged);expect(policy.RSO_USE_POLICY.reviews).toHaveLength(0);
 mocked.mockReturnValue({...testPolicy,revokedReviewIds:testPolicy.reviews.map(x=>x.id)});
 const revoked=evaluatePlan(snapshot,intent,"outcome");expect(revoked.comparisonEligible).toBe(false);expect(revoked.projectedValue).toBeNull();
});
