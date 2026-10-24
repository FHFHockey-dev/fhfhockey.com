import { describe, expect, it } from 'vitest';
import { LEDGER_SOURCES, scoreLedger, scorePairedLedger, settleLedgerRows, settleLedgerUniverse, type LedgerRow } from 'lib/player-forecasts/servedForecastLedger';

export function row(source: LedgerRow['source'], id: number, extra: Partial<LedgerRow> = {}): LedgerRow {
  return { served_date:'2026-10-20', season_id:20262027, player_id:id, game_id:100, source, player_class:'skater',
    team_id:1, opponent_team_id:2, is_home:true, scheduled_at:'2026-10-20T23:00:00Z', team_rest_days:1, opponent_rest_days:2,
    run_id:null, source_watermark:null, method_version:null, cutoff_at:null, issued_at:null, expires_at:null,
    participation_probability:null, start_probability:null,
    exp_goals:1, exp_assists:0, exp_pp_points:0, exp_shots:0, exp_hits:0, exp_blocks:0,
    exp_saves:0, exp_goals_against:0, exp_shots_against:0, exp_win_prob:0, exp_shutout_prob:0, exp_fantasy_points:1,
    act_goals:0, act_assists:0, act_pp_points:0, act_shots:0, act_hits:0, act_blocks:0,
    act_saves:0, act_goals_against:0, act_shots_against:0, act_win:0, act_shutout:0, act_fantasy_points:0,
    dressed:true, started:null, settled_at:'2026-10-22T01:00:00Z', outcome_source:'synthetic', ...extra };
}
const pair = (rows: LedgerRow[], weights?: Parameters<typeof scorePairedLedger>[1]) => scorePairedLedger(rows, weights).comparisons
  .find(value => value.source === 'bridge_exact' && value.reference === 'naive_last5')!;
const two = (id: number, extra: Partial<LedgerRow>) => [row('bridge_exact',id,extra), row('naive_last5',id,extra)];

describe('independent adversarial review of frozen Task 1 scorer', () => {
  it('uses pairwise source intersections, including native and both naive benchmarks, at the full declared key', () => {
    const rows = LEDGER_SOURCES.flatMap((source,i) => [row(source,1),row(source,10+i)]);
    const report = scorePairedLedger(rows);
    expect(report.comparisons).toHaveLength(10);
    for (const comparison of report.comparisons) expect(comparison.pairing).toMatchObject({matched:1,sourceOnly:1,referenceOnly:1,dressed:1});
    const mismatch = ['game_id','player_id','season_id','served_date','player_class'] as const;
    for (const key of mismatch) {
      const value = key === 'served_date' ? '2026-10-21' : key === 'player_class' ? 'goalie' : 999;
      expect(pair([row('bridge_exact',1),row('naive_last5',1,{[key]:value})]).pairing.matched).toBe(0);
    }
    const overlap = [row('bridge_exact',1),row('naive_last5',1),row('bridge_exact',2),row('naive_season',2)];
    expect(scorePairedLedger(overlap).comparisons.filter(c => c.source === 'bridge_exact' && c.reference.startsWith('naive')).map(c => c.pairing.matched)).toEqual([1,1]);
  });

  it('computes signed bias, RMSE, total ratio, MZ intercept/slope and naive skill on the same head-specific rows', () => {
    const rows = [1,4,7].flatMap((forecast,i) => [
      row('bridge_exact',i+1,{exp_goals:forecast,act_goals:1+2*forecast,exp_shots:i===2?null:10*(i+1),act_shots:4+i}),
      row('naive_last5',i+1,{exp_goals:0,act_goals:1+2*forecast,exp_shots:7+i,act_shots:4+i})]);
    rows.push(row('bridge_exact',99,{exp_goals:1000000}),row('naive_last5',98,{act_goals:1000000}));
    const score=pair(rows);
    expect(score.heads.goals.source).toMatchObject({n:3,expected:12,actual:27,bias:-5,mae:5,ratio:2.25,rmse:5.5678,mzSlope:2,mzIntercept:1});
    expect(score.heads.goals.reference).toMatchObject({n:3,rmse:10.247,mzSlope:null,mzIntercept:null,ratio:null});
    expect(score.heads.goals.rmseSkill).toBeCloseTo(1-Math.sqrt(31/105),4);
    expect(score.heads.shots).toMatchObject({source:{n:2,bias:10.5},reference:{n:2},exclusions:{missingPrediction:1}});
    expect(pair([...rows].reverse())).toEqual(score);
  });

  it('retains relief appearances and known DNP non-starts in event scores while counts remain dressed-only', () => {
    const rows = [true,true,false,null].flatMap((dressed,i) => [
      row('bridge_exact',i+1,{player_class:'goalie',dressed,started:i===0,start_probability:[.8,.7,.4,.3][i]}),
      row('naive_last5',i+1,{player_class:'goalie',dressed,started:i===0,start_probability:.5})]);
    const score=pair(rows);
    expect(score.pairing).toMatchObject({matched:4,dressed:2});
    expect(score.fantasyPoints.source.n).toBe(2);
    expect(score.binary.start).toMatchObject({source:{n:4,brier:.195},reference:{n:4,brier:.25}});
    expect(score.binary.start!.source.reliability.reduce((n,bin)=>n+bin.n,0)).toBe(4);
    expect(scoreLedger(rows)[0].binary.start).toEqual(score.binary.start!.source);
  });

  it('keeps event denominators independent and excludes ambiguous, missing or invalid pairs', () => {
    const rows = [
      ...two(1,{player_class:'goalie',started:true,start_probability:1,exp_win_prob:0,act_win:0,exp_shutout_prob:1,act_shutout:1}),
      ...two(2,{player_class:'goalie',started:false,start_probability:0,exp_win_prob:1,act_win:1,exp_shutout_prob:0,act_shutout:null}),
      ...two(3,{player_class:'goalie',started:false,start_probability:.5,exp_win_prob:.5,act_win:0}),
      ...two(4,{player_class:'goalie',started:false,start_probability:.5,exp_win_prob:.5,act_win:0})];
    rows.find(r=>r.player_id===3 && r.source==='bridge_exact')!.start_probability=NaN;
    rows.find(r=>r.player_id===3 && r.source==='bridge_exact')!.act_win=1;
    rows.find(r=>r.player_id===4 && r.source==='bridge_exact')!.dressed=false;
    const score=pair(rows);
    expect(score.pairing.conflictingParticipation).toBe(1);
    expect(score.binary.start).toMatchObject({source:{n:2,brier:0,reliability:[{bin:0,n:1},{bin:9,n:1}]},exclusions:{missingPrediction:1}});
    expect(score.binary.win).toMatchObject({source:{n:2,brier:0},exclusions:{conflictingOutcome:1}});
    expect(score.binary.shutout).toMatchObject({source:{n:2},exclusions:{missingOutcome:1}});
    rows.push({...rows[0]});
    expect(pair(rows).pairing).toMatchObject({matched:3,duplicateSourceKeys:1});
  });

  it('uses source expected-FP midpoint ranks before outcome/head exclusions, with ties and signed FP', () => {
    const values=[-4,-3,-2,-1,0,0,0,2,3,4];
    const rows=values.flatMap((fp,i)=>[
      row('bridge_exact',i+1,{exp_fantasy_points:fp,act_fantasy_points:i===9?null:100-i,exp_goals:10-i}),
      row('naive_last5',i+1,{exp_fantasy_points:20-fp,act_fantasy_points:i===9?null:100-i})]);
    const score=pair(rows), tied=score.expectedFpDeciles.find(bin=>bin.minExpectedFp===0)!;
    expect(tied).toMatchObject({decile:6,n:3,minExpectedFp:0,maxExpectedFp:0});
    expect(score.expectedFpDeciles.find(bin=>bin.decile===10)).toMatchObject({n:1,minExpectedFp:4,maxExpectedFp:4,
      fantasyPoints:{source:{n:0},exclusions:{missingOutcome:1}},heads:{goals:{source:{n:1}}}});
    const changed=rows.map(r=>({...r,act_fantasy_points:r.player_id*1000}));
    expect(pair(changed).expectedFpDeciles.map(({decile,n,minExpectedFp,maxExpectedFp})=>({decile,n,minExpectedFp,maxExpectedFp})))
      .toEqual(score.expectedFpDeciles.map(({decile,n,minExpectedFp,maxExpectedFp})=>({decile,n,minExpectedFp,maxExpectedFp})));
  });

  it('honors zero and negative FP weights without filling missing weighted actuals', () => {
    const rows=two(1,{exp_goals:2,act_goals:1,exp_hits:null,act_hits:null,exp_fantasy_points:999,act_fantasy_points:999});
    expect(pair(rows,{skater:{GOALS:3,HITS:0}}).fantasyPoints.source).toMatchObject({n:1,expected:6,actual:3,bias:3});
    expect(pair(rows,{skater:{GOALS:3,HITS:1}}).fantasyPoints).toMatchObject({source:{n:0},exclusions:{missingPrediction:1}});
    const goalie=two(2,{player_class:'goalie',exp_saves:20,act_saves:30,exp_goals_against:3,act_goals_against:2,
      exp_win_prob:.25,act_win:1,exp_shutout_prob:null,act_shutout:null});
    expect(pair(goalie,{goalie:{SAVES_GOALIE:.5,GOALS_AGAINST_GOALIE:-2,WINS_GOALIE:4,SHUTOUTS_GOALIE:0}}).fantasyPoints.source)
      .toMatchObject({n:1,expected:5,actual:15,bias:-10});
    expect(pair(goalie,{goalie:{SHUTOUTS_GOALIE:3}}).fantasyPoints.source.n).toBe(0);
  });

  it('preserves A3 late/partial settlement and A4 an independent universe including no-forecast players', () => {
    const rows=two(1,{exp_hits:1});
    const partial={skaters:[{game_id:100,player_id:1,goals:1}],goalies:[]};
    const settled=settleLedgerRows(rows,partial,'settled');
    expect(pair(settled).heads.goals.source.n).toBe(1);
    expect(pair(settled).heads.hits).toMatchObject({source:{n:0},exclusions:{missingOutcome:1}});
    expect(pair(settled).fantasyPoints.source.n).toBe(0);
    expect(settleLedgerRows(settled,{skaters:[],goalies:[]},'recheck')[0]).toMatchObject({dressed:null,act_goals:null,settled_at:null});
    const receipt={gameId:100,teamId:1,playerClass:'skater' as const,final:true,complete:true};
    expect(settleLedgerRows(rows,{skaters:[],goalies:[],completeScopes:[{...receipt,complete:false}]},'s')[0].dressed).toBeNull();
    expect(settleLedgerRows(rows,{skaters:[],goalies:[],completeScopes:[receipt]},'s')[0]).toMatchObject({dressed:false,act_goals:0});
    const universe=settleLedgerUniverse([row('bridge_exact',1),row('bridge_exact',2)],{skaters:[...partial.skaters,{game_id:100,player_id:2,goals:1}],goalies:[]});
    expect(scoreLedger(settled)[0]).toMatchObject({dressed:null,coverage:null,coverageStatus:'unavailable'});
    expect(scoreLedger(settled,undefined,universe)[0]).toMatchObject({dressed:2,covered:1,coverage:.5,coverageStatus:'known'});
    expect(scorePairedLedger(settled).limitations).toMatchObject({position:'unavailable_skater_position_not_captured',opportunityRate:'unavailable_expected_and_actual_toi_pp_toi_not_captured',coverage:'unavailable_independent_universe_not_persisted'});
  });
});
