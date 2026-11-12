import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runPerGameSkaterStage } from "./skater-stage";
import { selectRosterEventsForSlate } from "./preflight-stage";
import { resolveSkaterRolloutConfig } from "../skaterRollout";
import type { RosterEventRow } from "../types/run-forge-projections.types";

// Invented fixtures for L9c (decision 132, W1 P0 #27): mechanics only, no real players.
// Each team: 18 line-combination skaters (slots 1–18) plus five roster skaters outside the lineup:
// 19 injured (INJURY_OUT), 20 long absence (last game > 1 year ago), 21 no NHL usage at all,
// 22 depth with recent games and no news, 23 scratched for this game.
const GAME_ID = 2026020300, AS_OF = "2026-11-20", RECENT = "2026-11-18", LONG_AGO = "2025-03-01";
const fx = vi.hoisted(() => ({
  roster: (teamId: number) => Array.from({ length: 23 }, (_, index) => teamId * 100 + index + 1),
  lineup: (teamId: number) => Array.from({ length: 18 }, (_, index) => teamId * 100 + index + 1),
  playerWrites: vi.fn(async (rows: unknown[]) => rows.length),
  reserveWrites: vi.fn(async (_rows: unknown[]) => undefined),
  teamWrites: vi.fn(async (_row: unknown) => 1),
  lastGameDate: new Map<number, string>(),
  lookbacks: [] as Array<number | undefined>,
}));
vi.mock("lib/supabase/server", () => ({ default: { from: (table: string) => {
  if (!["players", "goalie_start_projections", "rolling_player_game_metrics", "forge_goalie_game"].includes(table)) {
    throw new Error(`Unexpected synthetic read: ${table}`);
  }
  const filters: Record<string, unknown> = {};
  const data = () => table === "players" ? [10, 11].flatMap(teamId => fx.roster(teamId).map(id => ({ id, team_id: teamId, position: "C" })))
    : table === "forge_goalie_game" && filters.goalie_id == null ? (() => { throw new Error("league read"); })() : [];
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
  gameId: 2026020290, teamId, forwards: fx.lineup(teamId), defensemen: [], goalies: [], games: { date: RECENT },
}] }));
vi.mock("../queries/skater-queries", () => ({
  fetchCurrentRosterPlayerIds: async (teamId: number) => fx.roster(teamId),
  // The latest row before the cutoff within the requested window (365 days unless the caller widens it).
  fetchRollingRows: async (ids: number[], strength: "ev" | "pp" | "pk" | "all", cutoff: string, _db?: unknown, options?: { lookbackDays?: number }) => {
    fx.lookbacks.push(options?.lookbackDays);
    const floor = Date.parse(cutoff) - (options?.lookbackDays ?? 365) * 86_400_000;
    return ids.flatMap((id): Array<Record<string, unknown>> => {
      const slot = id % 100;
      if (slot === 21 || strength === "pk") return [];
      const gameDate = fx.lastGameDate.get(id) ?? (slot === 20 ? LONG_AGO : RECENT);
      if (Date.parse(gameDate) <= floor) return [];
      const base = { player_id: id, game_id: 2026020290, game_date: gameDate, season: 20262027, strength_state: strength };
      if (strength === "all") return [{ ...base, toi_seconds_avg_last5: 920, toi_seconds_total_last5: 4600 }];
      if (strength === "ev") return [{ ...base, toi_seconds_avg_all: 800, toi_seconds_avg_last5: 800, sog_per_60_all: 6, shots_total_all: 80,
        goals_total_all: 8, assists_total_all: 10, ipp_all: 60, toi_seconds_total_all: 48000 }];
      return [{ ...base, toi_seconds_avg_all: 120, toi_seconds_avg_last5: 120, sog_per_60_all: 12, shots_total_all: 12,
        goals_total_all: 2, assists_total_all: 3, ipp_all: 70, toi_seconds_total_all: 3600 }];
    });
  },
  fetchLeaguePhysicalTotals: async () => null,
  fetchSkaterRecencyEvents: async (rows: any[]) => new Map(rows.map(row => [row.player_id, { date: row.game_date, seasonId: row.season, type: 2 }])),
  fetchLatestWgoSkaterDeploymentProfiles: async () => new Map(),
  fetchLatestSkaterContextProfiles: async () => ({ shotQuality: new Map(), onIceContext: new Map() }),
  fetchLatestSkaterTrendAdjustments: async () => ({ adjustments: new Map(), diagnostics: {
    eligibleRows: 0, playersWithRows: 0, playersAdjusted: 0, playersMissingRows: 0, playersNeutralizedByRecency: 0,
    selectedSoftStaleRows: 0, selectedHardStaleRows: 0, fetchFailed: false,
  } }),
}));
vi.mock("../queries/goalie-queries", async importOriginal => ({
  ...await importOriginal<typeof import("../queries/goalie-queries")>(), fetchOpponentGoalieContextForGame: async () => null,
}));
vi.mock("./persistence-stage", () => ({
  persistForgePlayerProjectionRows: fx.playerWrites, persistForgeTeamProjection: fx.teamWrites,
  persistForgeGoalieProjection: vi.fn(), persistPerGameAnalyticsOutputs: vi.fn(), persistForgeReserveProjectionRows: fx.reserveWrites,
}));

const event = (id: number, playerId: number, type: string, extra: Partial<RosterEventRow> = {}): RosterEventRow => ({
  event_id: id, team_id: 10, player_id: playerId, event_type: type, confidence: type === "DTD" ? 0.75 : 0.95,
  payload: type === "SCRATCH" ? { game_id: GAME_ID, game_scope: "game_id" } : {}, effective_from: "2026-11-19T12:00:00Z", effective_to: null, ...extra,
});

async function runStage(events: RosterEventRow[] = []) {
  fx.playerWrites.mockClear(); fx.reserveWrites.mockClear(); fx.teamWrites.mockClear(); fx.lookbacks.length = 0;
  const metrics: Record<string, any> = { data_quality: {}, warnings: [] };
  const slate = selectRosterEventsForSlate({ events, startTs: "2026-11-20T00:00:00Z", gameIds: [GAME_ID], goalieLikelyOverrides: false });
  const cached = <T>(value: T) => new Map([10, 11].map(teamId => [`${teamId}:${AS_OF}`, value]));
  await runPerGameSkaterStage({
    seasonBootstrap: false, asOfDate: AS_OF, runId: "synthetic-l9c-coverage", horizonGames: 1,
    game: { id: GAME_ID, date: AS_OF, homeTeamId: 10, awayTeamId: 11 },
    deadlineMs: Date.now() + 30_000, currentSeasonId: 20262027, skaterRollout: resolveSkaterRolloutConfig("baseline" as any),
    teamAbbreviationById: new Map(), playerAvailabilityMultiplier: slate.playerAvailabilityMultiplier,
    availabilityEventByPlayer: slate.availabilityEventByPlayer, roleEventByPlayer: new Map(),
    goalieOverrideByTeamId: new Map(), activeRosterSkaterIdsByTeamId: new Map([10, 11].map(id => [id, fx.roster(id)])),
    teamHorizonScalarsCache: cached([1]), teamSkaterRoleHistoryCache: cached(new Map()),
    teamShotsByTeamId: new Map(), teamGoalsByTeamId: new Map(), fallbackGoalieByTeamId: new Map([[10, null], [11, null]]),
    teamGoalieStarterContextCache: cached({ startsByGoalie: new Map(), lastPlayedDateByGoalie: new Map(), totalGames: 0,
      previousGameDate: null, previousGameStarterGoalieId: null }),
    teamDefensiveEnvironmentCache: new Map(), teamOffenseEnvironmentCache: new Map(), teamRestDaysCache: cached(null),
    teamStrengthPriorCache: cached(null), teamOfficialPpUsageCache: cached(null),
    teamStrengthCache: cached({ toiEsSecondsAvg: 15000, toiPpSecondsAvg: 1200, toiPkSecondsAvg: 1800, shotsEsAvg: 25, shotsPpAvg: 6, shotsPkAvg: 3 }),
    leaguePhysicalTotalsCache: new Map(), teamFiveOnFiveProfileCache: cached(null), teamNstExpectedGoalsCache: cached(null),
    teamLineComboGoaliePriorCache: cached(new Map()), currentTeamGoalieIdsCache: cached(new Set()),
    playerPropContextByGamePlayerKey: new Map(), playerPredictionOutputRows: [], modelMarketFlagRows: [],
    goalieCandidates: [], learningCounters: { players: 0, goalRecent: 0, assistRecent: 0 }, metrics,
  });
  // The final serialized payloads, exactly as handed to persistence.
  const players = fx.playerWrites.mock.calls.flatMap(call => call[0] as Array<Record<string, any>>).filter(row => row.team_id === 10);
  const reserves = fx.reserveWrites.mock.calls.flatMap(call => call[0] as Array<Record<string, any>>).filter(row => row.team_id === 10);
  return { players, reserves, metrics, coverage: (metrics.skater_coverage ?? []).find((row: any) => row.team_id === 10) };
}

const SLATE_EVENTS = () => [event(1, 1019, "INJURY_OUT"), event(2, 1023, "SCRATCH"), event(3, 1005, "DTD")];
const line = (row: Record<string, any>) => ["proj_toi_es_seconds", "proj_toi_pp_seconds", "proj_shots_es", "proj_shots_pp",
  "proj_goals_es", "proj_goals_pp", "proj_assists_es", "proj_assists_pp"].map(key => row[key]);

describe("FORGE coverage: a projection for every eligible skater (decision 132.2/132.4, W1 P0 #27)", () => {
  beforeEach(() => { vi.stubEnv("FORGE_RESERVE_PASS_ENABLED", "true"); fx.lastGameDate.clear(); });
  afterEach(() => vi.unstubAllEnvs());

  it("gives every eligible roster skater a lineup or if-plays reserve row and reports the rest as unknown with a reason", async () => {
    const { players, reserves, coverage, metrics } = await runStage(SLATE_EVENTS());
    expect(players.map(row => row.player_id).sort((a, b) => a - b)).toEqual(fx.lineup(10));
    expect(reserves.map(row => row.player_id).sort((a, b) => a - b)).toEqual([1019, 1020, 1022, 1023]);
    for (const row of reserves) {
      expect(row.conditioning).toBe("if_dressed");
      expect(row.proj_toi_es_seconds).toBeGreaterThan(0);
      expect(row.proj_shots_es).toBeGreaterThan(0);
    }
    expect(coverage).toMatchObject({ game_id: GAME_ID, eligible: 23, lineup: 18, reserve: 4, unknown: 1, complete: false,
      unknown_by_reason: { no_nhl_usage_in_window: [1021] } });
    // Two teams of 23 eligible skaters, the same shape on both.
    expect(metrics.data_quality).toMatchObject({ skater_coverage_eligible: 46, skater_coverage_lineup: 36,
      skater_coverage_reserve: 8, skater_coverage_unknown: 2 });
  });

  it("projects a long absence from his last active games with a bounded wider read, disclosing the time away", async () => {
    const { reserves } = await runStage(SLATE_EVENTS());
    const longAbsent = reserves.find(row => row.player_id === 1020)!;
    expect(longAbsent.uncertainty.latest_metric_date).toBe(LONG_AGO);
    expect(fx.lookbacks).toContain(1095);
    expect(longAbsent.uncertainty.time_away).toMatchObject({ last_game_date: LONG_AGO, days_away: 629, status: "away",
      line_basis: "last_active_games", decay: { status: "unvalidated", applied: false, mean_ratio: null, uncertainty: "widened_unquantified" } });
    // No fixed-rate decline: his if-plays line equals a recent depth player's line built from the same per-game rates.
    expect(line(longAbsent)).toEqual(line(reserves.find(row => row.player_id === 1022)!));
  });
});

describe("FORGE availability beside the if-plays line (decision 132.3, decision 31)", () => {
  beforeEach(() => { vi.stubEnv("FORGE_RESERVE_PASS_ENABLED", "true"); fx.lastGameDate.clear(); });
  afterEach(() => vi.unstubAllEnvs());

  it("keeps a confirmed out's line with 0.0 expected for that game, and never zeroes unknown or uncertain players", async () => {
    const { players, reserves } = await runStage(SLATE_EVENTS());
    const byId = new Map(reserves.map(row => [row.player_id, row]));
    expect(byId.get(1019)!.uncertainty.availability).toMatchObject({ game_id: GAME_ID, state: "confirmed_out", expected_for_game: 0,
      line_conditioning: "if_plays", participation_probability: null, event_type: "INJURY_OUT", event_id: 1 });
    expect(byId.get(1023)!.uncertainty.availability).toMatchObject({ state: "confirmed_out", expected_for_game: 0,
      label: "scratched / not expected to dress" });
    expect(byId.get(1022)!.uncertainty.availability).toMatchObject({ state: "unknown", expected_for_game: null, participation_probability: null });
    expect(byId.get(1019)!.proj_goals_es).toBeGreaterThan(0);
    const dtd = players.find(row => row.player_id === 1005)!;
    expect(dtd.uncertainty.availability).toMatchObject({ state: "uncertain", expected_for_game: null, participation_probability: null,
      participation_qualified: false, event_type: "DTD" });
    expect(players.find(row => row.player_id === 1007)!.uncertainty.availability).toMatchObject({ state: "projected_lineup" });
  });

  it("does not scale a day-to-day skater's line by the unqualified legacy multiplier", async () => {
    const without = await runStage([]);
    const withDtd = await runStage([event(3, 1005, "DTD")]);
    const pick = (rows: Array<Record<string, any>>) => line(rows.find(row => row.player_id === 1005)!);
    expect(pick(withDtd.players)).toEqual(pick(without.players));
  });

  it("does not apply the fixed-rate recency decline to a returning lineup skater (time away is disclosed instead)", async () => {
    const recent = await runStage([]);
    fx.lastGameDate.set(1006, "2026-10-20");
    const returning = await runStage([]);
    const row = returning.players.find(r => r.player_id === 1006)!;
    expect(line(row)).toEqual(line(recent.players.find(r => r.player_id === 1006)!));
    expect(row.uncertainty.time_away).toMatchObject({ days_away: 31, status: "away", decay: { status: "unvalidated", applied: false } });
    expect(row.uncertainty.model.skater_selection.recency).toMatchObject({ recency_multiplier_applied: false });
  });
});

describe("FORGE coverage report when lines cannot be built", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("counts every non-lineup skater as unknown (reserve_pass_disabled) while the reserve pass is off", async () => {
    vi.stubEnv("FORGE_RESERVE_PASS_ENABLED", "false");
    const { reserves, coverage } = await runStage(SLATE_EVENTS());
    expect(reserves).toEqual([]);
    expect(coverage).toMatchObject({ eligible: 23, lineup: 18, reserve: 0, unknown: 5,
      unknown_by_reason: { reserve_pass_disabled: [1019, 1020, 1021, 1022, 1023] } });
  });

  it("counts the whole roster as unknown (team_lineup_unavailable) when the team's lineup cannot be built", async () => {
    vi.stubEnv("FORGE_RESERVE_PASS_ENABLED", "true");
    const allOut = fx.roster(10).map((id, index) => event(100 + index, id, "INJURY_OUT"));
    const { players, coverage } = await runStage(allOut);
    expect(players).toEqual([]);
    expect(coverage).toMatchObject({ eligible: 23, lineup: 0, reserve: 0, unknown: 23 });
    expect(coverage.unknown_by_reason.team_lineup_unavailable).toHaveLength(23);
  });
});
