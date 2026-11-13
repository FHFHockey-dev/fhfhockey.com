import { describe, expect, it, vi } from "vitest";
import { runPerGameSkaterStage } from "./skater-stage";
import { fetchOpponentGoalieCandidateQuality } from "../opponentGoalieQuality";
import { resolveSkaterRolloutConfig } from "../skaterRollout";
import { computeSkaterPhysicalEventRates } from "../calculators/skater-adjustments";
import {
  allocateTeamPkToi,
  computeSkaterPkConversion,
  splitTeamSkaterBudget,
} from "../calculators/skater-strength-buckets";
import type { RollingRow } from "../types/run-forge-projections.types";

// Invented fixtures for the L9a strength-bucket fixes (W1 P0 #18, #19): mechanics only.
const fx = vi.hoisted(() => ({
  roster: (teamId: number) => Array.from({ length: 18 }, (_, index) => teamId * 100 + index + 1),
  playerWrites: vi.fn(async (rows: unknown[]) => rows.length),
  teamWrites: vi.fn(async (_row: unknown) => 1),
  league: {
    F: { toDate: { hits: 490, blocks: 210, toiSeconds: 360_000 }, prior: { hits: 4900, blocks: 2100, toiSeconds: 3_600_000 } },
    D: { toDate: { hits: 280, blocks: 440, toiSeconds: 360_000 }, prior: { hits: 3200, blocks: 4400, toiSeconds: 3_600_000 } },
  },
  // Recent all-situation TOI above ES + PP: the old multiplier added a second PK uplift from this.
  allRow: (id: number) => ({ player_id: id, game_id: 2026020001, game_date: "2026-10-06", season: 20262027, strength_state: "all",
    toi_seconds_avg_last5: 1100, toi_seconds_total_last5: 5500, hits_per_60_last5: 0, blocks_per_60_last5: 0,
    hits_per_60_hits_3ya: 120, hits_per_60_toi_seconds_3ya: 200000, blocks_per_60_blocks_3ya: 60, blocks_per_60_toi_seconds_3ya: 200000 }),
  pkRowsFor: (_id: number) => true,
  metrics: { data_quality: {} as Record<string, number>, warnings: [] as string[] },
  // Opponent goalie fixtures (#21): start rows by team, history by goalie id.
  goalieStarts: new Map<number, Array<{ player_id: number; start_probability: number }>>(),
  goalieHistory: new Map<number, Array<{ shots_against: unknown; goals_allowed: unknown }>>(),
  evOverride: new Map<number, Record<string, unknown>>(),
}));
vi.mock("lib/supabase/server", () => ({ default: { from: (table: string) => {
  // The league save % read falls back to its fitted constant (with a warning) on this throw.
  if (!["players", "goalie_start_projections", "rolling_player_game_metrics", "forge_goalie_game"].includes(table)) {
    throw new Error(`Unexpected synthetic read: ${table}`);
  }
  const filters: Record<string, unknown> = {};
  const data = () => table === "players" ? [10, 11].flatMap(teamId => fx.roster(teamId).map(id => ({ id, team_id: teamId, position: "C" })))
    : table === "goalie_start_projections" ? fx.goalieStarts.get(Number(filters.team_id)) ?? []
      : table === "forge_goalie_game" ? (filters.goalie_id == null ? (() => { throw new Error("league read"); })() : fx.goalieHistory.get(Number(filters.goalie_id)) ?? [])
        : [];
  const query: any = { select: () => query, in: () => query, eq: (key: string, value: unknown) => (filters[key] = value, query),
    lt: () => query, gte: () => query, order: () => query, limit: () => query,
    then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => {
      try { return Promise.resolve({ data: data(), error: null }).then(resolve); } catch (error) { return Promise.reject(error).then(resolve, reject); }
    } };
  return query;
} } }));
vi.mock("lib/NHL/server", () => ({ getSeasonById: async (id: number) => ({ id, startDate: "2026-10-01", regularSeasonEndDate: "2027-04-15", endDate: "2027-06-30" }) }));
vi.mock("../starterBoardFlags", () => ({ starterBoardFlags: () => ({ compute: false }) }));
vi.mock("../queries/line-combo-queries", () => ({ fetchRecentTeamLineCombinations: async ({ teamId }: { teamId: number }) => [{
  gameId: 2026020001, teamId, forwards: fx.roster(teamId), defensemen: [], goalies: [], games: { date: "2026-10-06" },
}] }));
vi.mock("../queries/skater-queries", () => ({
  fetchCurrentRosterPlayerIds: async (teamId: number) => fx.roster(teamId),
  fetchRollingRows: async (ids: number[], strength: "ev" | "pp" | "pk" | "all") => ids.flatMap((id): Array<Record<string, unknown>> => {
    const base = { player_id: id, game_id: 2026020001, game_date: "2026-10-06", season: 20262027, strength_state: strength };
    if (strength === "all") return [fx.allRow(id)];
    if (strength === "ev") return [{ ...base, toi_seconds_avg_all: 800, toi_seconds_avg_last5: 800, sog_per_60_all: 6, shots_total_all: 80,
      goals_total_all: 8, assists_total_all: 10, ipp_all: 60, toi_seconds_total_all: 48000, ...fx.evOverride.get(id) }];
    if (strength === "pp") return [{ ...base, toi_seconds_avg_all: 120, toi_seconds_avg_last5: 120, sog_per_60_all: 12, shots_total_all: 12,
      goals_total_all: 2, assists_total_all: 3, ipp_all: 70, toi_seconds_total_all: 3600 }];
    // PK: the first six skaters of each team kill penalties; one has a known zero-shot record.
    const slot = id % 100;
    if (!fx.pkRowsFor(id) || slot > 6) return [];
    return [{ ...base, toi_seconds_avg_all: 150, toi_seconds_avg_last5: 150 + slot * 10, sog_per_60_all: slot === 1 ? 0 : 3,
      shots_total_all: slot === 1 ? 0 : 3, goals_total_all: 0, assists_total_all: 0, ipp_all: null, toi_seconds_total_all: 3600 }];
  }),
  fetchLeaguePhysicalTotals: async () => fx.league,
  fetchSkaterRecencyEvents: async (rows: any[]) => new Map(rows.map(row => [row.player_id, { date: row.game_date, seasonId: row.season, type: 2 }])),
  fetchLatestWgoSkaterDeploymentProfiles: async () => new Map(),
  fetchLatestSkaterContextProfiles: async () => ({ shotQuality: new Map(), onIceContext: new Map() }),
  fetchLatestSkaterTrendAdjustments: async () => ({ adjustments: new Map(), diagnostics: {
    eligibleRows: 0, playersWithRows: 0, playersAdjusted: 0, playersMissingRows: 18, playersNeutralizedByRecency: 0,
    selectedSoftStaleRows: 0, selectedHardStaleRows: 0, fetchFailed: false,
  } }),
}));
// Season bootstrap fixture: a history prior with far more shots than the organic line.
vi.mock("../seasonBootstrap", async importOriginal => ({
  ...await importOriginal<typeof import("../seasonBootstrap")>(),
  loadSeasonBootstrap: async (ids: number[]) => new Map(ids.map(id => [id, { currentSeasonGames: 0, historyGames: 20, limitations: [],
    previous: { SHOTS_ON_GOAL: 6, GOALS: 1, ASSISTS: 1, HITS: 1, BLOCKED_SHOTS: 1, PP_POINTS: 0.3, PP_GOALS: 0.1, PP_TOI: 2 } }])),
}));
vi.mock("../queries/goalie-queries", async importOriginal => ({
  ...await importOriginal<typeof import("../queries/goalie-queries")>(), fetchOpponentGoalieContextForGame: async () => null,
}));
vi.mock("./persistence-stage", () => ({
  persistForgePlayerProjectionRows: fx.playerWrites, persistForgeTeamProjection: fx.teamWrites,
  persistForgeGoalieProjection: vi.fn(), persistPerGameAnalyticsOutputs: vi.fn(), persistForgeReserveProjectionRows: vi.fn(),
}));

type Strength = { toiEsSecondsAvg: number; toiPpSecondsAvg: number; toiPkSecondsAvg: number | null;
  shotsEsAvg: number; shotsPpAvg: number; shotsPkAvg?: number | null };

async function runStage(strength: Strength, opts: { seasonBootstrap?: boolean; rollout?: string } = {}) {
  fx.playerWrites.mockClear();
  fx.teamWrites.mockClear();
  const asOfDate = "2026-10-07";
  const cached = <T>(value: T) => new Map([10, 11].map(teamId => [`${teamId}:${asOfDate}`, value]));
  const teamGoalsByTeamId = new Map<number, number>();
  const teamShotsByTeamId = new Map<number, { shotsEs: number; shotsPp: number; shotsPk?: number | null }>();
  await runPerGameSkaterStage({
    seasonBootstrap: opts.seasonBootstrap ?? false, asOfDate, runId: "synthetic-l9a-buckets", horizonGames: 1,
    game: { id: 2026020002, date: asOfDate, homeTeamId: 10, awayTeamId: 11 },
    deadlineMs: Date.now() + 30_000, currentSeasonId: 20262027,
    skaterRollout: resolveSkaterRolloutConfig((opts.rollout ?? "baseline") as any),
    teamAbbreviationById: new Map(), playerAvailabilityMultiplier: new Map(), availabilityEventByPlayer: new Map(), roleEventByPlayer: new Map(),
    goalieOverrideByTeamId: new Map(), activeRosterSkaterIdsByTeamId: new Map([10, 11].map(id => [id, fx.roster(id)])),
    teamHorizonScalarsCache: cached([1]), teamSkaterRoleHistoryCache: cached(new Map()),
    teamShotsByTeamId, teamGoalsByTeamId, fallbackGoalieByTeamId: new Map([[10, null], [11, null]]),
    teamGoalieStarterContextCache: cached({ startsByGoalie: new Map(), lastPlayedDateByGoalie: new Map(), totalGames: 0,
      previousGameDate: null, previousGameStarterGoalieId: null }),
    teamDefensiveEnvironmentCache: new Map(), teamOffenseEnvironmentCache: new Map(), teamRestDaysCache: cached(null),
    teamStrengthPriorCache: cached(null), teamStrengthCache: cached(strength), teamOfficialPpUsageCache: cached(null),
    leaguePhysicalTotalsCache: new Map(),
    teamFiveOnFiveProfileCache: cached(null), teamNstExpectedGoalsCache: cached(null), teamLineComboGoaliePriorCache: cached(new Map()),
    currentTeamGoalieIdsCache: cached(new Set()), playerPropContextByGamePlayerKey: new Map(), playerPredictionOutputRows: [], modelMarketFlagRows: [],
    goalieCandidates: [], learningCounters: { players: 0, goalRecent: 0, assistRecent: 0 }, metrics: fx.metrics,
  });
  if (!fx.playerWrites.mock.calls.length) throw new Error(`no player rows: ${JSON.stringify(fx.metrics).slice(0, 3000)}`);
  const players = fx.playerWrites.mock.calls[0][0] as Array<Record<string, any>>;
  const team = fx.teamWrites.mock.calls[0][0] as Record<string, any>;
  return { players, team, teamGoalsByTeamId, teamShotsByTeamId };
}

const sum = (rows: Array<Record<string, any>>, key: string) => rows.reduce((total, row) => total + Number(row[key]), 0);
const physicalHitsPer60 = computeSkaterPhysicalEventRates({ all: fx.allRow(1001) as unknown as RollingRow, position: "C", esPpToiSeconds: 0,
  currentSeasonId: 20262027, league: fx.league }).hitsPer60;

describe("FORGE skater strength buckets (W1 P0 #18, decisions 24 and 59)", () => {
  const strength = { toiEsSecondsAvg: 15000, toiPpSecondsAvg: 1200, toiPkSecondsAvg: 1800, shotsEsAvg: 25, shotsPpAvg: 6, shotsPkAvg: 3 };

  it("writes an explicit PK bucket whose exclusive ES + PP + PK seconds reconcile to the team budget", async () => {
    const { players, team, teamGoalsByTeamId, teamShotsByTeamId } = await runStage(strength);
    expect(players).toHaveLength(18);
    for (const row of players) {
      for (const key of ["proj_toi_pk_seconds", "proj_shots_pk", "proj_goals_pk", "proj_assists_pk"]) expect(row[key]).not.toBeNull();
      expect(row.uncertainty.model.skater_selection.strength_accounting).toMatchObject({ pk_status: "modeled",
        es_definition: "even_strength", exclusive: true, empty_net: { mean: null } });
      expect(row.uncertainty).toHaveProperty("goals_pk");
    }
    // 1800 / 18000 of the 18000 s budget is PK; ES is the remainder, never PK time again.
    expect(team.proj_toi_pk_seconds).toBe(1800);
    expect(team.proj_toi_es_seconds + team.proj_toi_pp_seconds + team.proj_toi_pk_seconds).toBe(18000);
    expect(Math.abs(sum(players, "proj_toi_es_seconds") + sum(players, "proj_toi_pp_seconds") + sum(players, "proj_toi_pk_seconds") - 18000)).toBeLessThanOrEqual(players.length);
    // PK shots are pinned to the team's strength-table PK shots.
    expect(sum(players, "proj_shots_pk")).toBeCloseTo(3, 2);
    expect(team.proj_shots_pk).toBeCloseTo(3, 3);
    // Skaters without a PK rolling row get no invented PK time.
    const noPk = players.filter(row => row.player_id % 100 > 6);
    expect(noPk.every(row => row.proj_toi_pk_seconds === 0)).toBe(true);
    expect(noPk[0].uncertainty.model.skater_selection.strength_accounting.pk_history).toBe("no_pk_rolling_row");
    // Team goals for the goalie and game stages are the all-situation sum of serialized heads.
    expect(team.proj_goals_pk).toBe(Number(sum(players, "proj_goals_pk").toFixed(3)));
    expect(teamGoalsByTeamId.get(10)).toBe(Number((team.proj_goals_es + team.proj_goals_pp + team.proj_goals_pk).toFixed(3)));
    expect(teamShotsByTeamId.get(10)?.shotsPk).toBe(team.proj_shots_pk);
  });

  it("keeps the PK bucket unknown (null, never zero) when the team's PK exposure is unknown", async () => {
    const { players, team, teamGoalsByTeamId } = await runStage({ ...strength, toiPkSecondsAvg: null, shotsPkAvg: null });
    for (const row of players) {
      expect(row).toMatchObject({ proj_toi_pk_seconds: null, proj_shots_pk: null, proj_goals_pk: null, proj_assists_pk: null });
      expect(row.uncertainty.model.skater_selection.strength_accounting).toMatchObject({
        pk_status: "unknown_team_pk_exposure", es_definition: "all_non_pp_time" });
    }
    expect(team.proj_toi_es_seconds + team.proj_toi_pp_seconds).toBe(18000);
    expect(teamGoalsByTeamId.get(10)).toBe(Number((team.proj_goals_es + team.proj_goals_pp).toFixed(3)));
  });
});

describe("FORGE physical exposure (W1 P0 #19)", () => {
  it.each([
    { label: "with a PK bucket", pk: 1800, shotsPk: 3 },
    { label: "without a PK bucket", pk: null, shotsPk: null },
  ])("applies all-situation hit and block rates once to the reconciled bucket seconds ($label)", async ({ pk, shotsPk }) => {
    const { players } = await runStage({ toiEsSecondsAvg: 15000, toiPpSecondsAvg: 1200, toiPkSecondsAvg: pk,
      shotsEsAvg: 25, shotsPpAvg: 6, shotsPkAvg: shotsPk });
    for (const row of players) {
      const seconds = row.proj_toi_es_seconds + row.proj_toi_pp_seconds + (row.proj_toi_pk_seconds ?? 0);
      // Each row's hits are its rate times its own exposure (rounded heads), with no second PK uplift.
      expect(row.proj_hits).toBeCloseTo((seconds / 3600) * physicalHitsPer60, 2);
    }
    // Team physical exposure is the nominal budget, not the budget times recent all/(ES+PP) TOI (1100/920).
    const exposureHours = sum(players, "proj_hits") / physicalHitsPer60;
    expect(exposureHours * 3600).toBeCloseTo(18000, -2);
  });
});

describe("strength-bucket calculators", () => {
  it("splits a budget into exclusive targets that add to it", () => {
    const budget = splitTeamSkaterBudget({ totalSeconds: 18000, ppShare: 0.07,
      strengthAverages: { toiEsSecondsAvg: 15000, toiPpSecondsAvg: 1200, toiPkSecondsAvg: 1800, shotsEsAvg: 25, shotsPpAvg: 6, shotsPkAvg: 3 } });
    expect(budget).toMatchObject({ toiPpTarget: 1260, toiPkTarget: 1800, toiEsTarget: 14940, pkStatus: "modeled" });
    expect(budget.toiEsTarget + budget.toiPpTarget + budget.toiPkTarget!).toBe(18000);
  });

  it("returns no allocation when no projected skater has PK history", () => {
    expect(allocateTeamPkToi({ players: [{ playerId: 1, weightSeconds: null }], targetSeconds: 1800 })).toBeNull();
    const allocation = allocateTeamPkToi({ players: [{ playerId: 1, weightSeconds: 100 }, { playerId: 2, weightSeconds: null },
      { playerId: 3, weightSeconds: 300 }], targetSeconds: 1800 });
    expect([...allocation!.perPlayer.values()]).toEqual([450, 0, 1350]);
    expect(allocation!.playersWithoutPkHistory).toEqual([2]);
  });

  it("moves a known zero-shot PK record toward zero as its matched exposure grows", () => {
    const rate = (seconds: number) => computeSkaterPkConversion({ pk: { toi_seconds_total_all: seconds, shots_total_all: 0 } as RollingRow,
      position: "C", teamPkShotsPer60: 6, esGoalRate: 0.1, esAssistShare: 0.37 }).shotsPer60;
    expect(rate(0)).toBe(6);
    expect(rate(3600)).toBeLessThan(rate(0));
    expect(rate(36000)).toBeLessThan(rate(3600));
    expect(rate(3_600_000)).toBeLessThan(0.1);
  });
});

describe("FORGE opponent goalie context (W1 P0 #21, decision 148)", () => {
  const strength = { toiEsSecondsAvg: 15000, toiPpSecondsAvg: 1200, toiPkSecondsAvg: 1800, shotsEsAvg: 25, shotsPpAvg: 6, shotsPkAvg: 3 };
  const history = (games: number, shots: number, goals: number) => Array.from({ length: games }, () => ({ shots_against: shots, goals_allowed: goals }));
  // Everything but the labelled goalie context and the write timestamp.
  const withoutGoalieContext = (rows: Array<Record<string, any>>) => rows.map(({ updated_at: _written, ...row }) => {
    const { opponent_goalie_context: _context, ...selection } = row.uncertainty.model.skater_selection;
    return { ...row, uncertainty: { ...row.uncertainty, model: { ...row.uncertainty.model, skater_selection: selection } } };
  });
  const reset = () => { fx.goalieStarts.clear(); fx.goalieHistory.clear(); };

  it("keeps the start-weighted posterior as labelled context with a neutral 1.0 multiplier", async () => {
    // Team 11's goalies face team 10's skaters: a strong starter, a weak backup, 10% unresolved.
    fx.goalieStarts.set(11, [{ player_id: 9001, start_probability: 0.7 }, { player_id: 9002, start_probability: 0.2 }]);
    fx.goalieHistory.set(9001, history(60, 30, 2));   // 1800 shots, .9333
    fx.goalieHistory.set(9002, history(20, 30, 4));   // 600 shots, .8667
    const { players } = await runStage(strength);
    reset();
    const context = players[0].uncertainty.model.skater_selection.opponent_goalie_context;
    const league = context.league_save_pct;
    const posterior = (shots: number, goals: number) => (shots - goals + 6000 * league) / (shots + 6000);
    const expectedGa = 0.7 * (1 - posterior(1800, 120)) + 0.2 * (1 - posterior(600, 80)) + 0.1 * (1 - league);
    expect(context).toMatchObject({ feature: "goalie_save_quality_posterior", unresolved_start_mass: 0.1,
      adjustment: "neutral_unvalidated", start_mass_normalized: false, goal_rate_multiplier: 1, assist_rate_multiplier: 1 });
    expect(context).not.toHaveProperty("pass_through");
    expect(context.expected_goals_allowed_per_shot).toBeCloseTo(expectedGa, 6);
    expect(context.candidates.map((c: any) => [c.goalie_id, c.posterior_save_pct])).toEqual([
      [9001, Number(posterior(1800, 120).toFixed(5))], [9002, Number(posterior(600, 80).toFixed(5))]]);
    expect(context).not.toHaveProperty("weighted_projected_gsaa_per_60");
  });

  it("writes an identical skater and team payload against a strong and a weak opponent goalie", async () => {
    fx.goalieStarts.set(11, [{ player_id: 9001, start_probability: 1 }]);
    fx.goalieHistory.set(9001, history(200, 30, 1));   // .967 history
    const strong = await runStage(strength);
    fx.goalieHistory.set(9001, history(200, 30, 6));   // .800 history
    const weak = await runStage(strength);
    reset();
    const strongContext = strong.players[0].uncertainty.model.skater_selection.opponent_goalie_context;
    const weakContext = weak.players[0].uncertainty.model.skater_selection.opponent_goalie_context;
    expect(strongContext.candidates[0].posterior_save_pct).toBeGreaterThan(weakContext.candidates[0].posterior_save_pct);
    for (const context of [strongContext, weakContext]) {
      expect(context).toMatchObject({ adjustment: "neutral_unvalidated", goal_rate_multiplier: 1, assist_rate_multiplier: 1 });
    }
    expect(sum(strong.players, "proj_goals_es")).toBeGreaterThan(0);
    expect(withoutGoalieContext(strong.players)).toEqual(withoutGoalieContext(weak.players));
    expect({ ...strong.team, updated_at: null }).toEqual({ ...weak.team, updated_at: null });
    expect([...strong.teamGoalsByTeamId]).toEqual([...weak.teamGoalsByTeamId]);
  });

  it("drops history games with an unknown, empty or non-integer count instead of reading them as zero (Astra AF-02)", async () => {
    fx.goalieStarts.set(11, [{ player_id: 9003, start_probability: 0.6 }, { player_id: 9004, start_probability: null as unknown as number }]);
    fx.goalieHistory.set(9003, [
      { shots_against: 30, goals_allowed: null },       // was a 30-shot shutout
      { shots_against: null, goals_allowed: 2 },
      { shots_against: "", goals_allowed: "" },
      { shots_against: 30, goals_allowed: undefined },
      { shots_against: "abc", goals_allowed: 1 },
      { shots_against: 30.5, goals_allowed: 2 },
      { shots_against: 20, goals_allowed: 25 },
      { shots_against: 28, goals_allowed: 3 },
      { shots_against: "31", goals_allowed: "4" },
    ]);
    const adapter = await fetchOpponentGoalieCandidateQuality({ gameId: 2026020002, opponentTeamId: 11, asOfDate: "2026-10-07" });
    expect(adapter).toEqual([{ goalieId: 9003, startProbability: 0.6, historyShotsAgainst: 59, historyGoalsAllowed: 7 }]);

    // A goalie whose only game has a null goals count has no evidence: the posterior is the league prior.
    fx.goalieStarts.set(11, [{ player_id: 9003, start_probability: 1 }]);
    fx.goalieHistory.set(9003, [{ shots_against: 30, goals_allowed: null }]);
    const { players } = await runStage(strength);
    reset();
    const context = players[0].uncertainty.model.skater_selection.opponent_goalie_context;
    expect(context.candidates).toEqual([{ goalie_id: 9003, start_probability: 1, history_shots_against: 0,
      posterior_save_pct: Number(context.league_save_pct.toFixed(5)) }]);
    expect(context.expected_goals_allowed_per_shot).toBeCloseTo(1 - context.league_save_pct, 6);
    expect(context).toMatchObject({ adjustment: "neutral_unvalidated", goal_rate_multiplier: 1, assist_rate_multiplier: 1 });
  });
});

describe("known zero-shot history keeps its exposure (BC W1-6 A2)", () => {
  it("projects fewer ES shots for a skater with zero shots over 100 ES hours than for his teammates", async () => {
    fx.evOverride.set(1003, { shots_total_all: 0, sog_per_60_all: 0, toi_seconds_total_all: 360_000, goals_total_all: 0 });
    const { players } = await runStage({ toiEsSecondsAvg: 15000, toiPpSecondsAvg: 1200, toiPkSecondsAvg: 1800,
      shotsEsAvg: 25, shotsPpAvg: 6, shotsPkAvg: 3 });
    fx.evOverride.clear();
    const zero = players.find(row => row.player_id === 1003)!;
    const teammate = players.find(row => row.player_id === 1010)!;
    // Same ES TOI and role inputs; only the shot history differs.
    expect(Math.abs(zero.proj_toi_es_seconds - teammate.proj_toi_es_seconds)).toBeLessThanOrEqual(1);
    expect(zero.proj_shots_es).toBeLessThan(0.5 * teammate.proj_shots_es);
  });
});

describe("season bootstrap on the final serialized line (BC W1-6 A1, W1-7 N1)", () => {
  const strength = { toiEsSecondsAvg: 15000, toiPpSecondsAvg: 1200, toiPkSecondsAvg: 1800, shotsEsAvg: 25, shotsPpAvg: 6, shotsPkAvg: 3 };

  it("keeps the team's served shots pinned to the targets when the bootstrap re-splits lines", async () => {
    const { players, team } = await runStage(strength, { seasonBootstrap: true });
    expect(players.some(row => row.uncertainty.model.skater_selection.season_bootstrap != null)).toBe(true);
    expect(sum(players, "proj_shots_es")).toBeCloseTo(25, 1);
    expect(sum(players, "proj_shots_pp")).toBeCloseTo(6, 1);
    expect(sum(players, "proj_shots_pk")).toBeCloseTo(3, 1);
    expect(team.proj_shots_es).toBeCloseTo(25, 2);
  });

  it("centres the stored scenario lines on the served goals and assists", async () => {
    const { players } = await runStage(strength, { seasonBootstrap: true, rollout: "candidate" });
    expect(players.filter(row => row.uncertainty.model.skater_selection.role_scenarios.scenario_stat_lines.length > 0).length).toBeGreaterThan(0);
    for (const row of players) {
      const lines = row.uncertainty.model.skater_selection.role_scenarios.scenario_stat_lines as Array<Record<string, number>>;
      if (lines.length === 0) continue;
      const weight = lines.reduce((total, line) => total + line.probability, 0);
      const mean = (key: string) => lines.reduce((total, line) => total + line.probability * line[key], 0) / weight;
      expect(mean("goals_es")).toBeCloseTo(row.proj_goals_es, 2);
      expect(mean("assists_pp")).toBeCloseTo(row.proj_assists_pp, 2);
    }
  });
});
