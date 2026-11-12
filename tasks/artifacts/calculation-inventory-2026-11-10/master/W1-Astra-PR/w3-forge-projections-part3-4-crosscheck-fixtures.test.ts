// Independent audit fixture. Synthetic caches only; no DB clients, provider requests or production writes.
// The stage runner below is adapted from goaliePipeline.test.ts; the stage and model implementations are unchanged.
import { describe, expect, it, vi } from "vitest";
import { runPerGameGoalieStage } from "lib/projections/stages/goalie-stage";
import { computeGoalieRestSplitSavePctAdjustment, toGoalieRestSplitBucket } from "lib/projections/calculators/goalie-save-pct-context";
import { buildModelMarketFlagRow } from "lib/projections/utils/market-output-builders";
import { buildReserveGoalieRow } from "lib/projections/reserveProjections";
import { projectContext } from "lib/projections/research/skater-candidates/context";
import type { BoardAssertion, DailyBoardEvidence } from "lib/projections/dailyBoardEvidence";
const {fixtureWrites, reserveWrites} = vi.hoisted(() => {
  globalThis.fetch = () => { throw Error("Network disabled in audit fixture"); };
  return { fixtureWrites: vi.fn(async (_row: Record<string, unknown>) => 1), reserveWrites: vi.fn(async (_rows: any[]) => 1) };
});
vi.mock("lib/projections/stages/persistence-stage", () => ({ persistForgeGoalieProjection: fixtureWrites, persistForgeReserveProjectionRows: reserveWrites }));
vi.mock("lib/projections/starterBoardFlags", () => ({ starterBoardFlags: () => ({ compute: true }) }));
vi.mock("lib/projections/reserveProjections", async importOriginal => ({ ...await importOriginal<any>(), forgeReservePassEnabled: () => true }));
vi.mock("lib/supabase/server", () => ({ default: { from: () => { throw Error("Unexpected fixture DB read"); }, rpc: () => { throw Error("Unexpected fixture RPC"); } } }));
const profile = (games = 10) => ({ sourceDate: "2026-10-09", gamesByBucket: { "0":games,"1":games,"2":0,"3":games,"4_plus":games },
  savePctByBucket: {"0":.92,"1":.94,"2":null,"3":.8,"4_plus":.94} });
const near = (a: number,b: number) => expect(a).toBeCloseTo(b, 8);
const outcomes = (row: any) => Object.fromEntries(Object.entries(row).filter(([k]) => k.startsWith("proj_")));
describe("W3 independent FORGE cross-check", () => {
  const date = "2026-10-10", cutoff = "2026-10-10T18:02:00Z";
  const game = { id: 2026029999, date, homeTeamId: 10, awayTeamId: 11 };
  const assertion = (changed: Partial<BoardAssertion> = {}): BoardAssertion => ({
    gameId: game.id, teamId: 10, playerId: 100, dimension: "goalie", value: "confirmed", confirmed: true,
    evidenceId: "synthetic-confirmation", sourceKey: "synthetic-reporter", sourceUrl: "https://example.invalid/confirmation",
    publishedAt: "2026-10-10T18:00:00Z", receivedAt: "2026-10-10T18:01:00Z", ...changed,
  });
  const evidence = (assertions = [assertion()]): DailyBoardEvidence => ({ informationCutoffAt: cutoff, assertions, conflicts: [] });
  async function run(source?: DailyBoardEvidence, options: {
    profile?: any; onlySelectedProfile?: boolean; days?: number | null; probability?: number; override?: boolean; cutoffAt?: string | null; horizon?: number; goalsFor?: number | null; opponentGoalsFor?: number | null;
  } = {}) {
    const probability = options.probability ?? 0.8;
    const cache = <T,>(value: T) => new Map([[`10:${date}`, value], [`11:${date}`, value]]);
    const goalieHistory = { recentStarts: 10, recentShotsAgainst: 300, recentGoalsAllowed: 24,
      seasonStarts: 20, seasonShotsAgainst: 600, seasonGoalsAllowed: 50,
      baselineStarts: 60, baselineShotsAgainst: 1800, baselineGoalsAllowed: 162, residualStdDev: 1 };
    const args: Parameters<typeof runPerGameGoalieStage>[0] = {
      asOfDate: date, runId: "synthetic-goalie-run", horizonGames: options.horizon ?? 1, game, deadlineMs: Date.now() + 30000,
      dailyBoardEvidence: source, evidenceCutoffAt: options.cutoffAt === undefined ? cutoff : options.cutoffAt,
      goalieCandidates: [{ teamId: 10, opponentTeamId: 11, candidateGoalieIds: [100, 101], rosterGoalieIds: [100, 101],
        priorStartProbByGoalieId: new Map([[100, probability], [101, 1 - probability]]),
        // A legacy boolean without a scoped receipt cannot confirm either player.
        confirmedStarterByGoalieId: new Map([[100, true], [101, true]]),
        lineComboPriorByGoalieId: new Map(), projectedGsaaPer60ByGoalieId: new Map(),
        seasonStartPctByGoalieId: new Map(), seasonGamesPlayedByGoalieId: new Map(),
        override: options.override === false ? null : { goalieId: 100, starterProb: probability },
      }],
      teamShotsByTeamId: new Map([[11, { shotsEs: 25, shotsPp: 5 }]]), teamGoalsByTeamId: new Map([
        ...(options.goalsFor === null ? [] : [[10, options.goalsFor ?? 3] as [number, number]]),
        ...(options.opponentGoalsFor === null ? [] : [[11, options.opponentGoalsFor ?? 3] as [number, number]]),
      ]),
      teamAbbreviationById: new Map(), teamStrengthPriorCache: cache(null), teamFiveOnFiveProfileCache: cache(null),
      teamNstExpectedGoalsCache: cache(null), teamDefensiveEnvironmentCache: cache({ avgShotsAgainstLast10: null, avgShotsAgainstLast5: null }),
      teamOffenseEnvironmentCache: cache({ avgShotsForLast10: null, avgShotsForLast5: null, avgGoalsForLast10: null, avgGoalsForLast5: null }),
      teamRestDaysCache: cache(null), teamGoalieStarterContextCache: cache({ startsByGoalie: new Map([[100, 1], [101, 1]]),
        lastPlayedDateByGoalie: new Map(), totalGames: 2, previousGameDate: null, previousGameStarterGoalieId: null }),
      goalieEvidenceCache: new Map([100, 101].map(id => [`${id}:${date}`, goalieHistory])),
      goalieWorkloadContextCache: new Map([100, 101].map(id => [`${id}:${date}`, {
        startsLast7Days: 0, startsLast14Days: 0, daysSinceLastStart: options.days === undefined ? 3 : options.days, isGoalieBackToBack: options.days === 1 }])),
      goalieRestSplitProfileCache: new Map([100, 101].map(id => [`${id}:${date}`, (options.onlySelectedProfile && id !== 100 ? null : options.profile) ?? null])),
      teamHorizonScalarsCache: new Map(), playerPropContextByGamePlayerKey: new Map([100, 101].map(id => [`${game.id}:${id}`, {
        player_total_saves: { marketType: "player_total_saves", sourceRank: 1, sourceNames: ["synthetic-book"], sportsbookKeys: [],
          observedAt: null, freshnessExpiresAt: null, outcomes: [] } }])),
      selectedGoalieByTeamId: new Map(), playerPredictionOutputRows: [], modelMarketFlagRows: [], leagueSavePctCache: new Map([[date, Promise.resolve({savePct: .8955, currentSeasonShots: 0, previousSeasonSavePct: null, source: "fallback", warning: null})]]),
      metrics: { warnings: [] },
    };
    fixtureWrites.mockClear(); reserveWrites.mockClear();
    expect(await runPerGameGoalieStage(args)).toEqual({ timedOut: false, goalieRowsUpserted: 1 });
    expect(fixtureWrites).toHaveBeenCalledTimes(1);
    const row = fixtureWrites.mock.calls[0][0] as any;
    return { row, reserve: reserveWrites.mock.calls[0]?.[0]?.[0] as any, candidates: row.uncertainty.daily_board_candidates as any[],
      selected: args.selectedGoalieByTeamId.get(10)!, market: args.playerPredictionOutputRows[0] as any };
  }

  it("proves one-game profiles are inert, including missing rest", async () => {
    const single = { ...profile(1), gamesByBucket: {"0":0,"1":0,"2":0,"3":1,"4_plus":0} };
    for (const bucket of ["0","1","2","3","4_plus"]) {
      const oneGame = { ...single, gamesByBucket: Object.fromEntries(["0","1","2","3","4_plus"].map(key => [key,key===bucket?1:0])) };
      for (const days of [null, 0, 1, 2, 3, 4, 15]) expect(computeGoalieRestSplitSavePctAdjustment({profile:oneGame,daysSinceLastStart:days})).toBe(0);
    }
    const a = await run(), b = await run(undefined, {profile:single});
    expect(outcomes(a.row)).toEqual(outcomes(b.row));
    expect(outcomes(a.reserve)).toEqual(outcomes(b.reserve));
  });
  it("traces a latent rest adjustment to actual stage persistence payloads and reserve payloads", async () => {
    const a=await run(), b=await run(undefined,{profile:profile()});
    const raw=computeGoalieRestSplitSavePctAdjustment({profile:profile(),daysSinceLastStart:3});
    near(raw,-.012);
    near(b.reserve.uncertainty.modeled_save_pct-a.reserve.uncertainty.modeled_save_pct,-.003);
    expect(b.row.proj_saves).toBeLessThan(a.row.proj_saves);
    expect(b.row.proj_goals_allowed).toBeGreaterThan(a.row.proj_goals_allowed);
    expect(b.row.proj_shutout_prob).toBeLessThan(a.row.proj_shutout_prob);
    expect(Math.abs((b.reserve.proj_saves-a.reserve.proj_saves)+a.reserve.proj_shots_against*.003)).toBeLessThanOrEqual(.0011);
    expect(Math.abs((b.reserve.proj_goals_allowed-a.reserve.proj_goals_allowed)-a.reserve.proj_shots_against*.003)).toBeLessThanOrEqual(.0011);
    near(b.reserve.proj_saves+b.reserve.proj_goals_allowed,a.reserve.proj_saves+a.reserve.proj_goals_allowed);
    console.log("AUDIT_REST_STAGE",JSON.stringify({raw,off:outcomes(a.row),on:outcomes(b.row),reserveOff:a.reserve.uncertainty,reserveOn:b.reserve.uncertainty}));
  });
  it("changes candidate win probabilities only through relative goalie quality, not the fixed team win", async () => {
    const a=await run(undefined,{override:false}), b=await run(undefined,{override:false,profile:profile(),onlySelectedProfile:true});
    const aw=a.row.uncertainty.win_populations,bw=b.row.uncertainty.win_populations;
    near(aw.team.win_probability,bw.team.win_probability);
    expect(bw.goalies.find((g:any)=>g.goalie_id===100).team_win_if_starts).toBeLessThan(aw.goalies.find((g:any)=>g.goalie_id===100).team_win_if_starts);
    console.log("AUDIT_CANDIDATE_WIN",JSON.stringify({off:aw,on:bw}));
  });
  it("shows raw gap and unknown gap lookup, without claiming a provider-validated adapter", async () => {
    expect(toGoalieRestSplitBucket(1)).toBe("1"); expect(toGoalieRestSplitBucket(0)).toBe("0");
    expect(toGoalieRestSplitBucket(null)).toBe("4_plus");
    const p=profile();
    near(computeGoalieRestSplitSavePctAdjustment({profile:p,daysSinceLastStart:null}),.012);
    const a=await run(undefined,{days:null}),b=await run(undefined,{days:null,profile:p});
    expect(b.reserve.uncertainty.modeled_save_pct).toBeGreaterThan(a.reserve.uncertainty.modeled_save_pct);
    console.log("AUDIT_UNKNOWN_REST",JSON.stringify({off:a.reserve.uncertainty.modeled_save_pct,on:b.reserve.uncertainty.modeled_save_pct}));
  });
  it("reproduces confidence saturation and wrong-way mean spread without calling a writer", () => {
    const build=(edgeValue:number)=>buildModelMarketFlagRow({asOfDate:date,entityType:"game",entityId:1,gameId:1,marketType:"spreads",flagType:edgeValue>0?"model_home_cover":"model_away_cover",edgeValue,reasons:[],provider:null});
    expect(build(.5).confidence_0_to_100).toBe(50); expect(build(1).confidence_0_to_100).toBe(100);
    const margin=3.4-2.6, signedHandicap=-1.5, buggy=build(margin-signedHandicap), corrected=build(margin+signedHandicap);
    expect(buggy).toMatchObject({edge_value:2.3,flag_type:"model_home_cover",confidence_0_to_100:100});
    expect(corrected).toMatchObject({edge_value:-.7,flag_type:"model_away_cover",confidence_0_to_100:70});
    console.log("AUDIT_SPREAD",JSON.stringify({buggy,corrected}));
  });
  it("preserves per-game reserve probability while counts scale", () => {
    const make=(k:number)=>buildReserveGoalieRow({runId:"fixture",asOfDate:date,horizonGames:k,gameId:1,playerId:101,teamId:10,opponentTeamId:11,reason:"backup_goalie",horizonScalar:k,
      model:{shotsAgainst:30,projectedSaves:27,projectedGoalsAllowed:3,shutoutProbability:.05,modeledSavePct:.9}});
    expect(make(5).proj_saves).toBe(135);expect(make(5).proj_shutout_prob).toBe(.05);
    console.log("AUDIT_RESERVE",JSON.stringify({one:outcomes(make(1)),five:outcomes(make(5)),iidAtLeastOne:1-.95**5,expectedShutoutCount:5*.05}));
  });
  it("reproduces team-owned shot effect bypassing on-ice goals and assists", () => {
    const base={seconds:1200,shotsPer60:6,goalsPerShot:.1,onIceGoalsPer60:3,assistShare:.5};
    const a=projectContext(base,[]),b=projectContext(base,[{effect:"home",owner:"team",channel:"shotVolume",multiplier:1.03,evidence:"synthetic audit"}]);
    near(b.goals/a.goals,1.03);near(b.assists/a.assists,1);near(b.onIceGoals/a.onIceGoals,1);
    console.log("AUDIT_CONTEXT",JSON.stringify({neutral:a,teamShotVolume:b}));
  });
  it("demonstrates MAE can prefer zero over the true sparse Poisson mean", () => {
    const mu=.2;let p=Math.exp(-mu),mae0=0,maeMean=0,mse0=0,mseMean=0;
    for(let x=0;x<30;x++){if(x>0)p*=mu/x;mae0+=p*x;maeMean+=p*Math.abs(x-mu);mse0+=p*x*x;mseMean+=p*(x-mu)**2;}
    expect(mae0).toBeLessThan(maeMean);expect(mseMean).toBeLessThan(mse0);
    console.log("AUDIT_SPARSE_SCORE",JSON.stringify({mu,mae0,maeMean,mse0,mseMean}));
  });
});
