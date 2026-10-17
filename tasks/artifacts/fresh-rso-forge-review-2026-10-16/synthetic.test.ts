import { describe, it, expect } from 'vitest';
import { candidatePlanMetrics, candidatePlanForSort } from '../../../web/lib/rosterScheduleOptimizer/candidatePlanMetrics';
import { evaluatePlan } from '../../../web/lib/rosterScheduleOptimizer/planning';
import { buildGameExpectations } from '../../../web/lib/player-forecasts/gameExpectations';
import { buildSkaterBaselineRates } from '../../../web/lib/player-forecasts/baselineRates';
import { startChartFromGameExpectations, selectStartChartExpectationBasis } from '../../../web/lib/projections/startChartContract';
import { loadPlanningInputs } from '../../../web/lib/rosterScheduleData/planningInputs';
import type { PlanningSnapshot, PlanIntent, GameForecast } from '../../../web/lib/rosterScheduleOptimizer/planningTypes';

const intent: PlanIntent = { revision: 0, steps: [], protectedPlayerIds: [], excludedPlayerIds: [],
  goalieCoverage: 'accept_risk', goalieWindow: 'any', goalieSplit: 'mon_thu', alternativeCount: 5 };
function fixture(candidateCount: number): PlanningSnapshot {
  const ids = ['1', '2', '3', ...Array.from({length:candidateCount}, (_,i)=>String(100+i))];
  const context = { provider: 'manual' as const, seasonId: 20262027, leagueId: 'synthetic', teamId: 'synthetic',
    startDate: '2026-10-16', endDate: '2026-10-16', timeZone: 'UTC', asOf: '2026-10-16T12:00:00Z' };
  const players = ids.map((id,i)=>({id, nhlId:10000+i, nhlTeamId:1, rosterRevision:`r-${id}`, name:`Synthetic ${id}`,
    teamAbbreviation:'NJD', eligiblePositions:['C'], eligibilityVerified:true, playerClass:'skater' as const,
    availability:i<3?'rostered' as const:'free_agent' as const, canDrop:true, holdValue:null, ownership:null, reserveEligibility:[]}));
  const games = [{id:'2026020001',date:context.startDate,startsAt:'2026-10-16T23:00:00Z',scheduleRevision:'s-1',
    teamAbbreviation:'NJD',opponent:'NYR',home:true,status:'scheduled' as const}];
  const forecasts: GameForecast[] = players.map((p,i)=>({playerId:p.id,gameId:games[0].id,
    stats:{GOALS:i===0?100:i===1?90:i===2?1:10},conditioning:'unconditional',sourceKind:'detailed',
    sourceWatermark:'synthetic-only',cutoffAt:context.asOf,issuedAt:context.asOf,expiresAt:'2026-10-16T22:00:00Z',
    revisionId:`f-${p.id}`,modelVersion:'synthetic',startProbability:null,appearanceProbability:1,confirmedStart:false,
    allowedUses:{assignment:true,totals:true,comparison:true,conditionalTieBreak:true},limitations:[],
    issuedContext:{version:'forge-issued-context-v1',playerId:p.id,gameId:games[0].id,nhlPlayerId:p.nhlId,teamId:1,
      seasonId:context.seasonId,scheduledAt:games[0].startsAt,scheduleRevision:'s-1',rosterRevision:p.rosterRevision,
      observedAt:context.asOf,scheduleFetchedAt:context.asOf,scheduleSourceUpdatedAt:context.asOf,
      identityUpdatedAt:context.asOf,membershipCreatedAt:['2026-09-01T00:00:00Z']}}));
  return {id:'synthetic-audit',context,players,games,forecasts,roster:ids.slice(0,3).map(playerId=>({playerId,position:'active'})),
    rules:{lineupMode:'daily',rosterSlots:{C:3,BN:0},acquisitionTiming:'same_day',acquisitionCost:1,
      periods:[{id:'week',start:'2026-10-16T00:00:00Z',end:'2026-10-19T00:00:00Z',remaining:1,source:'manager'}],
      scoring:{mode:'points',weights:{GOALS:1},categories:[]},
      goalieMinimum:{required:null,credited:null,counts:'unknown',penalty:'none'},unsupported:[]},
    lockedAssignments:[],realized:{},opponent:null,evidence:{schedule:{source:'synthetic',asOf:context.asOf,seasonId:20262027,completeness:'complete',limitations:[]}}};
}

describe('Independent synthetic product audit — source behavior, no empirical forecast claims',()=>{
  it('positive control: one candidate finds the weak-player drop and +9 points',()=>{
    const s=fixture(1); const result=candidatePlanMetrics(s,intent);
    const best=candidatePlanForSort(result.candidates[0].plans,'points');
    expect(result.baseline.projectedPoints).toBe(191);
    expect(best?.netPoints).toBe(9); expect(best?.steps[0].dropPlayerId).toBe('3');
    console.log('CONTROL',JSON.stringify({baseline:result.baseline,best}));
  });
  it('40 candidates exhaust default budget before any weak-player drop despite identical +9 legal opportunities',()=>{
    const s=fixture(40); const result=candidatePlanMetrics(s,intent);
    const best=result.candidates.map(c=>candidatePlanForSort(c.plans,'points'));
    const oracle=evaluatePlan(s,intent,'outcome',[{id:'oracle',type:'add',playerId:'100',dropPlayerId:'3',at:s.context.asOf,effectiveAt:s.context.asOf,conditional:false,dependsOn:[]}],false);
    expect(oracle.legal).toBe(true);expect(oracle.budgetVerified).toBe(true);expect(oracle.projectedValue).toBe(200);
    expect(best.every(p=>p?.netPoints!=null && p.netPoints<0)).toBe(true);
    expect(result.candidates.flatMap(c=>c.plans).some(p=>p.steps.some(step=>step.dropPlayerId==='3'))).toBe(false);
    console.log('MISSED_POSITIVE_SWAP',JSON.stringify({search:result.search,returnedBestNet:Math.max(...best.map(p=>p!.netPoints!)),oracleNet:oracle.projectedValue!-result.baseline.projectedPoints!,drops:[...new Set(best.map(p=>p?.steps[0].dropPlayerId))]}));
  });
  it('41st ID is never evaluated even when its forecast is far stronger',()=>{
    const s=fixture(41);s.forecasts.find(f=>f.playerId==='140')!.stats.GOALS=1000;
    const result=candidatePlanMetrics(s,intent);
    expect(result.candidates.some(c=>c.playerId==='140')).toBe(false);
    expect(result.diagnostics.find(d=>d.playerId==='140')).toMatchObject({status:'not_selected',stopReason:'candidate_limit',evaluated:0});
    console.log('UNSEEN_BEST_CANDIDATE',JSON.stringify(result.diagnostics.find(d=>d.playerId==='140')));
  });
  it('unresolved team on an owned player does not block quality certification or a quantified drop',()=>{
    const s=fixture(1);s.players[0].teamAbbreviation=null;
    s.players[0].nhlTeamId=undefined;s.players[0].rosterRevision=undefined;
    s.evidence.identities={source:'synthetic',asOf:s.context.asOf,seasonId:20262027,completeness:'partial',limitations:['Owned player 1 has unknown current NHL membership.']};
    const baseline=evaluatePlan(s,intent,'outcome',[],false);
    const result=candidatePlanMetrics(s,intent);
    const best=candidatePlanForSort(result.candidates[0].plans,'points');
    expect(baseline.recommendation?.eligible).toBe(true);expect(baseline.comparisonEligible).toBe(true);
    expect(baseline.projectedValue).toBe(91);expect(best?.steps[0].dropPlayerId).toBe('1');expect(best?.netPoints).toBe(10);
    console.log('UNKNOWN_OWNED_TEAM',JSON.stringify({baseline:baseline.projectedValue,qualityEligible:baseline.recommendation?.eligible,comparisonEligible:baseline.comparisonEligible,best}));
  });
  it('shared FORGE values sum actual unequal games and keep absent targets unknown',()=>{
    const s=fixture(0); const second={...s.games[0],id:'2026020002',date:'2026-10-17',startsAt:'2026-10-17T23:00:00Z',scheduleRevision:'s-2'};
    s.games.push(second); const first=s.forecasts[0];
    s.forecasts.push({...first,gameId:second.id,stats:{GOALS:7},revisionId:'f-second',issuedContext:{...first.issuedContext!,gameId:second.id,scheduledAt:second.startsAt,scheduleRevision:'s-2'}});
    const result=buildGameExpectations(s,{seasonId:20262027,startDate:'2026-10-16',endDate:'2026-10-18',timeZone:'UTC',mode:'next_n',games:2,playerIds:['1']},new Date(s.context.asOf));
    expect(result.players[0].totals.GOALS.expected).toBe(107);
    expect(result.players[0].totals.SHOTS_ON_GOAL.expected).toBeNull();
  });
  it('Start Chart preserves the shared expected value and does not borrow it into a conditional basis',()=>{
    const s=fixture(0);
    const data=buildGameExpectations(s,{seasonId:20262027,startDate:'2026-10-16',endDate:'2026-10-16',timeZone:'UTC',mode:'calendar',games:1,playerIds:['1']},new Date(s.context.asOf));
    const board=startChartFromGameExpectations(data);
    expect(board.players[0].proj_goals).toBe(data.players[0].games[0].targets.GOALS.expected);
    expect(selectStartChartExpectationBasis(board,'per_appearance').players[0].proj_goals).toBeNull();
  });
  it('broad baseline drops current-season-only targets when no previous-season or projection prior exists',()=>{
    const result=buildSkaterBaselineRates({playerId:1,nhlPlayerId:10001,seasonId:20262027,
      cutoffAt:'2026-11-16T12:00:00Z',sourceWatermark:'synthetic',projections:[],
      appearances:Array.from({length:20},(_,i)=>({gameId:100+i,seasonId:20262027,gameDate:`2026-10-${String(i+1).padStart(2,'0')}`,
        availableAt:'2026-11-01T12:00:00Z',teamId:1,regularSeason:true,targets:{GOALS:1,SHOTS_ON_GOAL:3}}))});
    expect(result.targets).toEqual([]);
    console.log('NO_PRIOR_BASELINE',JSON.stringify({currentSeasonAppearances:20,returnedTargets:result.targets.length}));
  });
  it('schedule loader calls a sparse fresh single team-row complete without a coverage witness',async()=>{
    const rows:any={roster_optimizer_team_games:[{id:1,source_game_id:2026020001,source_season_id:20262027,game_type:2,
      game_date:'2026-10-16',start_time:'2026-10-16T23:00:00Z',game_status:'FUT',schedule_status:'OK',is_countable:true,
      team_abbreviation:'NJD',opponent_abbreviation:'NYR',home_away:'home',fetched_at:'2026-10-16T11:00:00Z'}],
      fhfh_player_identities:[],teams:[],rosters:[]};
    const db:any={from(table:string){let chain:any;chain=new Proxy({}, {get(_t,key){if(key==='then')return (resolve:any)=>Promise.resolve({data:rows[table],count:rows[table].length,error:null}).then(resolve);return ()=>chain;}});return chain;}};
    const result=await loadPlanningInputs(db,{seasonId:20262027,startDate:'2026-10-16',endDate:'2026-10-22',timeZone:'UTC'},new Date('2026-10-16T12:00:00Z'));
    expect(result.games).toHaveLength(1);expect(result.evidence.schedule.completeness).toBe('complete');
    console.log('SCHEDULE_COVERAGE',JSON.stringify({games:result.games.length,evidence:result.evidence.schedule}));
  });
});
