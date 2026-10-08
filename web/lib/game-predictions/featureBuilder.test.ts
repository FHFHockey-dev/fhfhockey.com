import { describe, expect, it } from "vitest";

import {
  buildFeatureSnapshotInsert,
  buildGamePredictionFeatureSnapshotPayload,
  buildGoalieBlendFeatures,
  buildScheduleContextFeatures,
  fetchGamePredictionFeatureInputs,
  rosterFormBlendWeights,
  type GamePredictionFeatureInputs,
  type NstTeamGamelogRow,
} from "./featureBuilder";
import { normalizeTeamGameFacts } from "./teamGameNormalization";
import { ESPN_MARKET_ODDS_SOURCE_NAME } from "./espnOdds";
import { getFeatureSourceByTable } from "./featureSources";
import { buildGamePredictionSourceProvenanceRows } from "lib/predictions/sourceProvenance";
import {
  RECENT_TEAM_FORM_APPROVED_PUBLICATION_STATUS,
  RECENT_TEAM_FORM_FORMULA_VERSION,
  RECENT_TEAM_FORM_INPUT_VERSION,
  RECENT_TEAM_FORM_LEGACY_PUBLICATION_STATUS,
} from "lib/trends/ctpi";

const approvedTeamFormProvenance = {
  publication_status: RECENT_TEAM_FORM_APPROVED_PUBLICATION_STATUS,
  formula_version: RECENT_TEAM_FORM_FORMULA_VERSION,
  input_version: RECENT_TEAM_FORM_INPUT_VERSION,
  source_game_count: "10",
};

function createNstTeamGamelogRow(args: {
  teamAbbreviation: string;
  date: string;
  seasonId?: number;
  gf: number;
  ga: number;
  xgf: number;
  xga: number;
  sf: number;
  sa: number;
  points: number;
}): NstTeamGamelogRow {
  return {
    season_id: args.seasonId ?? 20252026,
    team_abbreviation: args.teamAbbreviation,
    date: args.date,
    phase: 2,
    strength: "all",
    available_at: `${args.date}T23:50:00Z`,
    availability_basis: "original_source",
    gp: 1,
    wins: args.points === 2 ? 1 : 0,
    losses: args.points === 0 ? 1 : 0,
    otl: args.points === 1 ? 1 : 0,
    points: args.points,
    point_pct: args.points / 2,
    gf: args.gf,
    ga: args.ga,
    gf_pct: (args.gf / (args.gf + args.ga)) * 100,
    xgf: args.xgf,
    xga: args.xga,
    xgf_pct: (args.xgf / (args.xgf + args.xga)) * 100,
    xga_per_60: args.xga,
    toi_seconds: 3600,
    sf: args.sf,
    sa: args.sa,
    sf_pct: (args.sf / (args.sf + args.sa)) * 100,
    ff: args.sf - 4,
    fa: args.sa - 4,
    ff_pct: ((args.sf - 4) / (args.sf + args.sa - 8)) * 100,
    cf: args.sf + 10,
    ca: args.sa + 10,
    cf_pct: ((args.sf + 10) / (args.sf + args.sa + 20)) * 100,
  };
}

function createInputs(
  overrides: Partial<GamePredictionFeatureInputs> = {},
): GamePredictionFeatureInputs {
  const inputs: GamePredictionFeatureInputs = {
    game: {
      id: 2025020001,
      date: "2026-01-10",
      startTime: "2026-01-10T23:00:00+00:00",
      seasonId: 20252026,
      homeTeamId: 1,
      awayTeamId: 2,
      type: 2,
    },
    sourceAsOfDate: "2026-01-10",
    homeTeam: { id: 1, abbreviation: "BOS", name: "Boston Bruins" },
    awayTeam: { id: 2, abbreviation: "MTL", name: "Montreal Canadiens" },
    teamRows: [
      { id: 1, abbreviation: "BOS", name: "Boston Bruins" },
      { id: 2, abbreviation: "MTL", name: "Montreal Canadiens" },
      { id: 3, abbreviation: "TOR", name: "Toronto Maple Leafs" },
      { id: 4, abbreviation: "OTT", name: "Ottawa Senators" },
    ],
    priorGames: [
      {
        id: 2025020000,
        date: "2026-01-09",
        startTime: "2026-01-09T23:00:00+00:00",
        seasonId: 20252026,
        homeTeamId: 1,
        awayTeamId: 3,
        type: 2,
      },
      {
        id: 2025019999,
        date: "2026-01-06",
        startTime: "2026-01-06T23:00:00+00:00",
        seasonId: 20252026,
        homeTeamId: 4,
        awayTeamId: 2,
        type: 2,
      },
    ],
    teamPowerRows: [
      {
        team_abbreviation: "BOS",
        date: "2026-01-09",
        off_rating: 56,
        def_rating: 52,
        goalie_rating: 51,
        special_rating: 54,
        pace_rating: 49,
        xgf60: 3.1,
        xga60: 2.5,
        gf60: 3.2,
        ga60: 2.6,
        sf60: 32,
        sa60: 28,
      },
      {
        team_abbreviation: "MTL",
        date: "2026-01-10",
        off_rating: 99,
        def_rating: 99,
        goalie_rating: 99,
        special_rating: 99,
        pace_rating: 99,
        xgf60: 9.9,
        xga60: 9.9,
        gf60: 9.9,
        ga60: 9.9,
        sf60: 99,
        sa60: 99,
      },
      {
        team_abbreviation: "MTL",
        date: "2026-01-08",
        off_rating: 47,
        def_rating: 49,
        goalie_rating: 50,
        special_rating: 45,
        pace_rating: 51,
        xgf60: 2.7,
        xga60: 3,
        gf60: 2.8,
        ga60: 3.1,
        sf60: 29,
        sa60: 31,
      },
      {
        team_abbreviation: "TOR",
        date: "2026-01-09",
        off_rating: 60,
        def_rating: 58,
        goalie_rating: 57,
        special_rating: 55,
        pace_rating: 52,
        xgf60: 3.4,
        xga60: 2.4,
        gf60: 3.5,
        ga60: 2.5,
        sf60: 34,
        sa60: 27,
      },
      {
        team_abbreviation: "TOR",
        date: "2026-01-08",
        off_rating: 60,
        def_rating: 58,
        goalie_rating: 57,
        special_rating: 55,
        pace_rating: 52,
        xgf60: 3.4,
        xga60: 2.4,
        gf60: 3.5,
        ga60: 2.5,
        sf60: 34,
        sa60: 27,
      },
      {
        team_abbreviation: "OTT",
        date: "2026-01-09",
        off_rating: 44,
        def_rating: 43,
        goalie_rating: 42,
        special_rating: 41,
        pace_rating: 48,
        xgf60: 2.3,
        xga60: 3.3,
        gf60: 2.4,
        ga60: 3.4,
        sf60: 27,
        sa60: 35,
      },
      {
        team_abbreviation: "OTT",
        date: "2026-01-05",
        off_rating: 44,
        def_rating: 43,
        goalie_rating: 42,
        special_rating: 41,
        pace_rating: 48,
        xgf60: 2.3,
        xga60: 3.3,
        gf60: 2.4,
        ga60: 3.4,
        sf60: 27,
        sa60: 35,
      },
    ],
    standingsRows: [
      {
        team_abbrev: "BOS",
        season_id: 20252026,
        date: "2026-01-09",
        games_played: 40,
        point_pctg: 0.61,
        win_pctg: 0.55,
        goal_differential: 18,
        l10_games_played: 10,
        l10_goal_differential: 4,
      },
      {
        team_abbrev: "MTL",
        season_id: 20252026,
        date: "2026-01-09",
        games_played: 40,
        point_pctg: 0.48,
        win_pctg: 0.43,
        goal_differential: -8,
        l10_games_played: 10,
        l10_goal_differential: -3,
      },
    ],
    wgoTeamRows: [],
    nstTeamGamelogRows: [
      createNstTeamGamelogRow({
        teamAbbreviation: "BOS",
        date: "2026-01-09",
        gf: 4,
        ga: 2,
        xgf: 3,
        xga: 2,
        sf: 35,
        sa: 25,
        points: 2,
      }),
      createNstTeamGamelogRow({
        teamAbbreviation: "BOS",
        date: "2026-01-07",
        gf: 3,
        ga: 2,
        xgf: 2.6,
        xga: 2.4,
        sf: 31,
        sa: 29,
        points: 1,
      }),
      createNstTeamGamelogRow({
        teamAbbreviation: "MTL",
        date: "2026-01-09",
        gf: 2,
        ga: 3,
        xgf: 2,
        xga: 3,
        sf: 27,
        sa: 33,
        points: 0,
      }),
      createNstTeamGamelogRow({
        teamAbbreviation: "MTL",
        date: "2026-01-08",
        gf: 1,
        ga: 4,
        xgf: 2,
        xga: 3,
        sf: 26,
        sa: 34,
        points: 1,
      }),
    ],
    teamCtpiRows: [
      {
        ...approvedTeamFormProvenance,
        team: "BOS",
        date: "2026-01-09",
        computed_at: "2026-01-09T10:00:00+00:00",
        ctpi_0_to_100: 64,
        ctpi_raw: 0.64,
        offense: 65,
        defense: 62,
        goaltending: 61,
        special_teams: 66,
        luck: 50,
      },
      {
        ...approvedTeamFormProvenance,
        team: "MTL",
        date: "2026-01-10",
        computed_at: "2026-01-10T10:00:00+00:00",
        ctpi_0_to_100: 99,
        ctpi_raw: 0.99,
        offense: 99,
        defense: 99,
        goaltending: 99,
        special_teams: 99,
        luck: 99,
      },
      {
        ...approvedTeamFormProvenance,
        team: "MTL",
        date: "2026-01-08",
        computed_at: "2026-01-08T10:00:00+00:00",
        ctpi_0_to_100: 48,
        ctpi_raw: 0.48,
        offense: 47,
        defense: 49,
        goaltending: 50,
        special_teams: 45,
        luck: 52,
      },
    ],
    goalieStartRows: [
      {
        game_id: 2025020001,
        team_id: 1,
        player_id: 100,
        game_date: "2026-01-10",
        start_probability: 0.75,
        confirmed_status: false,
        projected_gsaa_per_60: 0.4,
        created_at: "2026-01-10T14:00:00+00:00",
        updated_at: "2026-01-10T14:00:00+00:00",
      },
      {
        game_id: 2025020001,
        team_id: 1,
        player_id: 101,
        game_date: "2026-01-10",
        start_probability: 0.25,
        confirmed_status: false,
        projected_gsaa_per_60: -0.2,
        created_at: "2026-01-10T14:00:00+00:00",
        updated_at: "2026-01-10T14:00:00+00:00",
      },
      {
        game_id: 2025020001,
        team_id: 2,
        player_id: 200,
        game_date: "2026-01-10",
        start_probability: 1,
        confirmed_status: true,
        projected_gsaa_per_60: 0.1,
        created_at: "2026-01-10T14:00:00+00:00",
        updated_at: "2026-01-10T14:00:00+00:00",
      },
    ],
    lineCombinationRows: [
      {
        gameId: 2025020001,
        teamId: 1,
        forwards: [1, 2, 3, 4, 5, 6],
        defensemen: [7, 8, 9, 10],
        goalies: [100, 101],
      },
    ],
    linesCccRows: [],
    goaliePerformanceRows: [],
    forgeGoalieGameRows: [
      {
        game_id: 2025019990,
        game_date: "2026-01-09",
        goalie_id: 100,
        team_id: 1,
        shots_against: 32,
        saves: 30,
        goals_allowed: 2,
        toi_seconds: 3600,
      },
      {
        game_id: 2025019989,
        game_date: "2026-01-06",
        goalie_id: 100,
        team_id: 1,
        shots_against: 28,
        saves: 25,
        goals_allowed: 3,
        toi_seconds: 3580,
      },
      {
        game_id: 2025019988,
        game_date: "2026-01-09",
        goalie_id: 200,
        team_id: 2,
        shots_against: 30,
        saves: 27,
        goals_allowed: 3,
        toi_seconds: 3600,
      },
    ],
    wgoGoalieRows: [
      {
        goalie_id: 100,
        goalie_name: "Home Starter",
        team_abbreviation: "BOS",
        date: "2026-01-09",
        games_played: 25,
        games_started: 23,
        save_pct: 0.918,
        shots_against_per_60: 30.5,
        quality_start: 14,
        quality_starts_pct: 60,
        games_played_days_rest_0: 2,
        games_played_days_rest_1: 8,
        games_played_days_rest_2: 5,
        games_played_days_rest_3: 4,
        games_played_days_rest_4_plus: 6,
        save_pct_days_rest_0: 0.9,
        save_pct_days_rest_1: 0.914,
        save_pct_days_rest_2: 0.92,
        save_pct_days_rest_3: 0.922,
        save_pct_days_rest_4_plus: 0.925,
      },
      {
        goalie_id: 200,
        goalie_name: "Away Starter",
        team_abbreviation: "MTL",
        date: "2026-01-09",
        games_played: 20,
        games_started: 18,
        save_pct: 0.905,
        shots_against_per_60: 32,
        quality_start: 8,
        quality_starts_pct: 44,
        games_played_days_rest_0: 3,
        games_played_days_rest_1: 6,
        games_played_days_rest_2: 4,
        games_played_days_rest_3: 3,
        games_played_days_rest_4_plus: 4,
        save_pct_days_rest_0: 0.891,
        save_pct_days_rest_1: 0.904,
        save_pct_days_rest_2: 0.91,
        save_pct_days_rest_3: 0.907,
        save_pct_days_rest_4_plus: 0.912,
      },
    ],
    forgeTeamProjectionRows: [],
    ...overrides,
  };
  inputs.priorGames = inputs.priorGames.map((game) => ({ ...game, completed_at: `${game.date}T23:45:00Z` }));
  inputs.teamGameRecords ??= inputs.nstTeamGamelogRows.map((row, index) => {
    const teamId = row.team_abbreviation === "BOS" ? 1 : 2;
    return { id: index + 1, date: row.date, startTime: `${row.date}T20:00:00Z`,
      completed_at: `${row.date}T23:00:00Z`, seasonId: row.season_id!,
      homeTeamId: teamId, awayTeamId: teamId === 1 ? 3 : 4, type: 2 };
  });
  return inputs;
}

describe("canonical team-game facts", () => {
  const row = (overrides: Partial<NstTeamGamelogRow> = {}) => ({ ...createNstTeamGamelogRow({
    teamAbbreviation: "BOS", date: "2026-01-09", gf: 4, ga: 2, xgf: 3, xga: 2, sf: 30, sa: 20, points: 2,
  }), ...overrides });
  const normalize = (rows: NstTeamGamelogRow[], overrides: Partial<Parameters<typeof normalizeTeamGameFacts>[0]> = {}) => {
    const inputs = createInputs({ nstTeamGamelogRows: [row()] });
    return normalizeTeamGameFacts({ rows, games: inputs.teamGameRecords!, teams: [inputs.homeTeam, inputs.awayTeam],
      cutoffAt: "2026-01-10T18:00:00-05:00", phase: 2, ...overrides });
  };
  it("preserves legacy totals and distinct corrected exposures", () => {
    expect(normalize([row(), row({ gp: 40, gf: 120, ga: 100 })])).toMatchObject({
      legacyTotals: { gp: 41, gf: 124, ga: 102 }, correctedTotals: { gp: 1, gf: 4, ga: 2 },
      exclusions: [{ rowIndex: 1, reason: "cumulative_or_invalid_gp" }],
    });
  });
  it.each([
    [{ phase: 3 }, "unknown_or_mismatched_phase"],
    [{ strength: "5v5" }, "unknown_or_mismatched_strength"],
    [{ season_id: 20242025 }, "ambiguous_or_missing_game"],
    [{ availability_basis: "ingestion_only" }, "unknown_original_availability"],
    [{ available_at: "2026-01-10T18:00:00-05:00" }, "future_or_invalid_availability"],
    [{ available_at: "2026-01-11T00:00:00Z" }, "future_or_invalid_availability"],
    [{ correction_of_available_at: "2026-01-10T00:00:00Z" }, "invalid_correction"],
    [{ gf: -1 }, "invalid_counts"],
    [{ available_at: undefined }, "unknown_original_availability"],
    [{ available_at: "2026-01-09T23:50:00" }, "unknown_original_availability"],
    [{ phase: undefined }, "unknown_or_mismatched_phase"],
    [{ strength: undefined }, "unknown_or_mismatched_strength"],
  ] as Array<[Partial<NstTeamGamelogRow>, string]>)("excludes unsupported metadata %j", (overrides, reason) => {
    expect(normalize([row(overrides)]).exclusions).toEqual([{ rowIndex: 0, reason }]);
  });
  it("deduplicates identical verified revisions and rejects conflicts without doubling exposure", () => {
    const first = row();
    const laterReceipt = row({ available_at: "2026-01-10T11:40:00Z", availability_basis: "retained_capture" });
    const deduplicated = normalize([laterReceipt, first, row()]);
    expect(deduplicated.facts).toHaveLength(1);
    expect(deduplicated.facts[0]?.available_at).toBe(first.available_at);
    expect(deduplicated).toMatchObject({ legacyTotals: { gp: 3, gf: 12, ga: 6 }, correctedTotals: { gp: 1, gf: 4, ga: 2 } });
    expect(deduplicated.exclusions).toEqual([{ rowIndex: 2, reason: "duplicate_identical_game" }, { rowIndex: 0, reason: "duplicate_identical_game" }]);
    const conflict = normalize([row(), row({ gf: 5 })]);
    expect(conflict.facts).toEqual([]);
    expect(conflict.exclusions.every(exclusion => exclusion.reason === "duplicate_or_conflicting_game")).toBe(true);
    const inputs = createInputs({ nstTeamGamelogRows: [row()] });
    const game = inputs.teamGameRecords![0]!;
    expect(normalize([row()], { games: [game, { ...game, id: 99 }] }).exclusions[0]?.reason).toBe("ambiguous_or_missing_game");
  });
  it("requires completed game evidence before original availability", () => {
    const game = createInputs({ nstTeamGamelogRows: [row()] }).teamGameRecords![0]!;
    expect(normalize([row()], { games: [{ ...game, completed_at: undefined }] }).facts).toEqual([]);
    expect(normalize([row()], { games: [{ ...game, completed_at: "2026-01-11T00:00:00Z" }] }).facts).toEqual([]);
    expect(normalize([row({ available_at: "2026-01-09T18:01:00-05:00" })]).facts).toHaveLength(1);
  });
  it("accepts proved retained receipts only at their actual pre-cutoff timestamps", () => {
    expect(normalize([row({ availability_basis: "retained_capture" })]).facts).toHaveLength(1);
    expect(normalize([row({ availability_basis: "retained_capture", available_at: "2026-01-11T00:00:00Z" })]).facts).toEqual([]);
  });
  it("differences only one verified completed game with matching stat definitions", () => {
    const previous = row({ date: "2026-01-08", available_at: "2026-01-08T23:50:00Z", gp: 2, gf: 8, ga: 4,
      observation_kind: "cumulative", stat_definition: "all_v1" });
    const current = row({ gp: 3, gf: 12, ga: 6, observation_kind: "cumulative", stat_definition: "all_v1" });
    const result = normalize([previous, current]);
    expect(result.facts).toMatchObject([{ gp: 1, gf: 4, ga: 2, derivation: "cumulative_difference" }]);
    expect(normalize([previous, { ...previous }, current]).facts).toMatchObject([{ gp: 1, gf: 4, ga: 2, derivation: "cumulative_difference" }]);
    expect(normalize([previous, { ...previous, gf: 7 }, current]).facts).toEqual([]);
    expect(normalize([previous, { ...current, stat_definition: "all_v2" }]).facts).toEqual([]);
    expect(normalize([previous, { ...current, gp: 4 }]).facts).toEqual([]);
    expect(normalize([previous, { ...current, gf: 7 }]).facts).toEqual([]);
    expect(normalize([previous, { ...current, correction_of_available_at: previous.available_at }]).facts).toEqual([]);
    const game = createInputs({ nstTeamGamelogRows: [row()] }).teamGameRecords![0]!;
    expect(normalize([previous, current], { games: [game, { ...game, id: 9 }] }).facts).toEqual([]);
  });
});

describe("game prediction feature sources", () => {
  it("marks latest-only team display data as excluded", () => {
    expect(getFeatureSourceByTable("nhl_team_data")).toMatchObject({
      use: "excluded",
      goNoGo: "no_go",
    });
  });
});

describe("game prediction feature builder", () => {
  it("keeps neutral 100 SOS unchanged and discloses missing opponent slots", () => {
    const inputs = createInputs();
    inputs.teamPowerRows = inputs.teamPowerRows.map((row) => ({ ...row, off_rating: 100, def_rating: 100, goalie_rating: 100, special_rating: 100 }));
    const neutral = buildGamePredictionFeatureSnapshotPayload(inputs);
    expect(neutral.home.opponentAdjustedForm?.adjustedLast5GoalDifferentialPerGame).toBe(neutral.home.recentForm?.last5GoalDifferentialPerGame);
    expect(neutral.home.opponentAdjustedForm?.adjustedLast5XgfPct).toBe(neutral.home.recentForm?.last5XgfPct);
    inputs.priorGames = Array.from({ length: 6 }, (_, index) => ({ ...inputs.priorGames[0]!, id: index + 10,
      date: `2026-01-0${9 - index}`, startTime: `2026-01-0${9 - index}T20:00:00Z`, completed_at: `2026-01-0${9 - index}T23:45:00Z`, awayTeamId: index < 5 ? 4 : 3 }));
    inputs.teamPowerRows = inputs.teamPowerRows.filter((row) => row.team_abbreviation === "TOR").map((row) => ({ ...row, date: "2026-01-01" }));
    const coverage = buildGamePredictionFeatureSnapshotPayload(inputs).home.scheduleStrength;
    expect(coverage).toMatchObject({ selectedOpponentGames: 6, missingOpponentGames: 5, last5SelectedGames: 5,
      last5RatedGames: 0, last10RatedGames: 1, last5OpponentCompositeRating: null });
  });
  it("excludes opponent ratings first available after that opponent game", () => {
    const inputs = createInputs();
    inputs.teamPowerRows = inputs.teamPowerRows.map((row) => row.team_abbreviation === "TOR"
      ? { ...row, available_at: "2026-01-10T12:00:00Z", availability_basis: "original_source" } : row);
    const home = buildGamePredictionFeatureSnapshotPayload(inputs).home;
    expect(home.scheduleStrength).toMatchObject({ selectedOpponentGames: 1, missingOpponentGames: 1, last5OpponentCompositeRating: null });
  });
  it("exposes exclusions when no verified form remains and omits mutable replay joins", () => {
    const inputs = createInputs({ historicalReplay: true });
    inputs.nstTeamGamelogRows = inputs.nstTeamGamelogRows.map((row) => ({ ...row, availability_basis: "unknown" }));
    const payload = buildGamePredictionFeatureSnapshotPayload(inputs);
    expect(payload.home.recentForm).toBeNull();
    expect(payload.home.teamGameNormalization.exclusions.length).toBeGreaterThan(0);
    expect(payload.home.forgeProjection).toBeNull();
    expect(payload.home.lineup).toBeNull();
    expect(payload.home.rosterImpact.skaterOffenseImpact).toBeNull();
  });
  it("fetches required opponent/date ratings and applies the explicit pregame cutoff", async () => {
    const inputs = createInputs();
    const queries: Array<{ table: string; calls: Array<[string, ...unknown[]]> }> = [];
    const client = { from: (table: string) => {
      const query = { table, calls: [] as Array<[string, ...unknown[]]> };
      queries.push(query);
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "in", "lt", "lte", "gte", "or", "order", "limit"]) {
        chain[method] = (...args: unknown[]) => { query.calls.push([method, ...args]); return chain; };
      }
      chain.single = async () => ({ data: inputs.game, error: null });
      chain.maybeSingle = async () => ({ data: null, error: null });
      chain.then = (resolve: (value: unknown) => unknown) => resolve({
        data: table === "games" ? inputs.priorGames : table === "teams" ? inputs.teamRows : [], error: null,
      });
      return chain;
    } } as unknown as Parameters<typeof fetchGamePredictionFeatureInputs>[0];
    const cutoff = "2026-01-10T18:00:00-05:00";
    const fetched = await fetchGamePredictionFeatureInputs(client, inputs.game.id, { predictionCutoffAt: cutoff, sourceAsOfDate: "2026-01-10" });
    expect(fetched.historicalReplay).toBe(true);
    const power = queries.filter((query) => query.table === "team_power_ratings_daily");
    expect(power).toHaveLength(4);
    expect(power.every((query) => query.calls.some((call) => call[0] === "eq" && call[1] === "team_abbreviation") &&
      query.calls.some((call) => call[0] === "limit" && call[1] === 1))).toBe(true);
    expect(power.find((query) => query.calls.some((call) => call[2] === "TOR"))?.calls).toContainEqual(["lt", "date", "2026-01-09"]);
    expect(queries.find((query) => query.table === "goalie_start_projections")?.calls).toEqual(expect.arrayContaining([
      ["lt", "created_at", cutoff], ["lt", "updated_at", cutoff],
    ]));
    expect(queries.find((query) => query.table === "lines_ccc")?.calls).toContainEqual(["lt", "observed_at", cutoff]);
  });
  it("retains missing metric exposure without inventing zero goals", () => {
    const inputs = createInputs();
    inputs.nstTeamGamelogRows = inputs.nstTeamGamelogRows.map((row, index) => index === 0 ? { ...row, gf: null, xgf: null } : row);
    const last5 = buildGamePredictionFeatureSnapshotPayload(inputs).home.recentForm?.last5;
    expect(last5).toMatchObject({ games: 2, goalsForGames: 1, goalsAgainstGames: 2, xgGames: 1,
      goalDifferentialPerGame: null, xgfPct: null });
    for (const [field, feature] of [
      ["ff", "fenwickShare"], ["fa", "fenwickShare"],
      ["cf", "corsiShare"], ["ca", "corsiShare"],
      ["xga", "xgaPer60"], ["toi_seconds", "xgaPer60"],
      ["points", "pointPct"],
    ] as const) {
      const incomplete = createInputs();
      incomplete.nstTeamGamelogRows[0] = { ...incomplete.nstTeamGamelogRows[0]!, [field]: null };
      const window = buildGamePredictionFeatureSnapshotPayload(incomplete).home.recentForm?.last5;
      expect(window?.games).toBe(2);
      expect(window?.[feature]).toBeNull();
    }
    const noExposure = createInputs();
    noExposure.nstTeamGamelogRows[0] = { ...noExposure.nstTeamGamelogRows[0]!, toi_seconds: 0 };
    expect(buildGamePredictionFeatureSnapshotPayload(noExposure).home.recentForm?.last5.xgaPer60).toBeNull();
  });
  it("bounds availability by kickoff even when a later cutoff is requested", () => {
    const inputs = createInputs({ predictionCutoffAt: "2026-01-11T12:00:00Z" });
    inputs.nstTeamGamelogRows = inputs.nstTeamGamelogRows.map((row) => ({ ...row, available_at: "2026-01-11T00:00:00Z" }));
    expect(buildGamePredictionFeatureSnapshotPayload(inputs).home.teamGameNormalization.facts).toEqual([]);
  });
  it("does not let future observations affect a pregame snapshot", () => {
    const inputs = createInputs({ predictionCutoffAt: "2026-01-10T18:00:00-05:00" });
    inputs.goalieStartRows = inputs.goalieStartRows.map((row) => ({ ...row, created_at: "2026-01-11T00:00:00Z", updated_at: "2026-01-11T00:00:00Z" }));
    inputs.linesCccRows = inputs.linesCccRows.map((row) => ({ ...row, observed_at: "2026-01-11T00:00:00Z" }));
    const payload = buildGamePredictionFeatureSnapshotPayload(inputs);
    expect(payload.home.goalie.source).not.toBe("goalie_start_projections");
    expect(payload.home.goalie.source).not.toBe("lines_ccc");
  });
  it("uses a granular games-played curve that retains roster context", () => {
    expect(rosterFormBlendWeights(0)).toMatchObject({
      rosterPriorWeight: 0.8,
      currentFormWeight: 0.2,
    });
    expect(rosterFormBlendWeights(10)).toMatchObject({
      rosterPriorWeight: 0.7,
      currentFormWeight: 0.3,
    });
    expect(rosterFormBlendWeights(25)).toMatchObject({
      rosterPriorWeight: 0.5,
      currentFormWeight: 0.5,
    });
    expect(rosterFormBlendWeights(50)).toMatchObject({
      rosterPriorWeight: 0.15,
      currentFormWeight: 0.85,
    });
    expect(rosterFormBlendWeights(82)).toMatchObject({
      rosterPriorWeight: 0.1,
      currentFormWeight: 0.9,
    });
    expect(rosterFormBlendWeights(100)).toMatchObject({
      gamesPlayedAsOf: 82,
      rosterPriorWeight: 0.1,
      currentFormWeight: 0.9,
    });
    expect(rosterFormBlendWeights(37.5)).toMatchObject({
      rosterPriorWeight: 0.325,
      currentFormWeight: 0.675,
    });
  });

  it("computes rest context from prior games", () => {
    const context = buildScheduleContextFeatures({
      game: createInputs().game,
      teamId: 1,
      priorGames: createInputs().priorGames,
    });

    expect(context).toEqual({
      daysRest: 0,
      isBackToBack: true,
      gamesInLast3Days: 1,
    });
  });

  it("uses only rows before game date for team features", () => {
    const payload = buildGamePredictionFeatureSnapshotPayload(createInputs());

    expect(payload.away.teamPower?.sourceDate).toBe("2026-01-08");
    expect(payload.away.teamPower?.offRating).toBe(47);
  });

  it("does not use prior-season standings to classify an early-season game", () => {
    const payload = buildGamePredictionFeatureSnapshotPayload(
      createInputs({
        game: {
          id: 2025020001,
          date: "2025-10-07",
          startTime: "2025-10-07T23:00:00+00:00",
          seasonId: 20252026,
          homeTeamId: 1,
          awayTeamId: 2,
          type: 2,
        },
        sourceAsOfDate: "2025-10-07",
        priorGames: [],
        standingsRows: [
          {
            team_abbrev: "BOS",
            season_id: 20242025,
            date: "2025-04-17",
            games_played: 82,
            point_pctg: 0.61,
            win_pctg: 0.55,
            goal_differential: 18,
            l10_games_played: 10,
            l10_goal_differential: 4,
          },
          {
            team_abbrev: "MTL",
            season_id: 20242025,
            date: "2025-04-17",
            games_played: 82,
            point_pctg: 0.48,
            win_pctg: 0.43,
            goal_differential: -8,
            l10_games_played: 10,
            l10_goal_differential: -3,
          },
        ],
      }),
    );

    expect(payload.home.standings).toBeNull();
    expect(payload.away.standings).toBeNull();
    expect(payload.seasonPhase).toMatchObject({
      phase: "early",
      homeGamesPlayed: 0,
      awayGamesPlayed: 0,
    });
  });

  it("builds recent team form from NST gamelog rows", () => {
    const payload = buildGamePredictionFeatureSnapshotPayload(createInputs());

    expect(payload.home.recentForm).toMatchObject({
      sourceMaxDate: "2026-01-09",
      last5Games: 2,
      last10Games: 2,
      last10GoalDifferentialPerGame: 1.5,
      last10PointPct: 0.75,
    });
    expect(payload.away.recentForm?.last10GoalDifferentialPerGame).toBe(-2);
    expect(payload.matchup.homeMinusAwayRecent10GoalDifferentialPerGame).toBe(
      3.5,
    );
    expect(payload.matchup.homeMinusAwayRecent10XgfPct).toBeCloseTo(0.16);
    expect(payload.matchup.homeMinusAwayRecent10PointPct).toBe(0.5);
  });

  it("builds long-window, season-to-date, and early-season prior NST features", () => {
    const priorHomeRows = Array.from({ length: 4 }, (_, index) =>
      createNstTeamGamelogRow({
        teamAbbreviation: "BOS",
        seasonId: 20242025,
        date: `2025-04-${String(10 + index).padStart(2, "0")}`,
        gf: 4,
        ga: 2,
        xgf: 3.5,
        xga: 1.5,
        sf: 36,
        sa: 24,
        points: 2,
      }),
    );
    const priorAwayRows = Array.from({ length: 4 }, (_, index) =>
      createNstTeamGamelogRow({
        teamAbbreviation: "MTL",
        seasonId: 20242025,
        date: `2025-04-${String(10 + index).padStart(2, "0")}`,
        gf: 2,
        ga: 4,
        xgf: 1.5,
        xga: 3.5,
        sf: 24,
        sa: 36,
        points: 0,
      }),
    );
    const payload = buildGamePredictionFeatureSnapshotPayload(
      createInputs({
        nstTeamGamelogRows: [
          ...createInputs().nstTeamGamelogRows,
          ...priorHomeRows,
          ...priorAwayRows,
        ],
      }),
    );

    expect(payload.seasonPhase).toMatchObject({
      phase: "middle",
      homeGamesPlayed: 40,
      awayGamesPlayed: 40,
    });
    expect(payload.home.rosterFormBlendWeights).toMatchObject({
      gamesPlayedAsOf: 40,
      rosterPriorWeight: 0.29,
      currentFormWeight: 0.71,
    });
    expect(payload.home.recentForm).toMatchObject({
      currentSeasonGames: 2,
      last20Games: 2,
      seasonToDateGames: 2,
    });
    expect(payload.home.recentForm?.earlySeasonPrior?.games).toBe(4);
    expect(payload.home.recentForm?.crossSeasonLast20?.games).toBe(6);
    expect(payload.matchup.homeMinusAwayRecent20ShotShare).toBeGreaterThan(0);
    expect(payload.matchup.homeMinusAwayRecent40ShotShare).toBeGreaterThan(0);
    expect(payload.matchup.homeMinusAwayRecent20FenwickShare).toBeGreaterThan(
      0,
    );
    expect(payload.matchup.homeMinusAwaySeasonToDateXgfPct).toBeCloseTo(0.16);
    expect(payload.matchup.homeMinusAwayCrossSeasonPriorXgfPct).toBeCloseTo(
      0.4,
    );
  });

  it("uses only market odds snapshots captured before the prediction cutoff", () => {
    const payload = buildGamePredictionFeatureSnapshotPayload(
      createInputs({
        predictionCutoffAt: "2026-01-10T18:00:00.000Z",
        marketOddsRows: [
          {
            odds_snapshot_id: "22222222-2222-2222-2222-222222222222",
            game_id: 2025020001,
            provider: "DraftKings",
            captured_at: "2026-01-10T19:00:00.000Z",
            game_date: "2026-01-10",
            event_start_at: "2026-01-10T23:00:00.000Z",
            home_team_id: 1,
            away_team_id: 2,
            home_moneyline: -250,
            away_moneyline: 210,
            home_market_no_vig_probability: 0.69,
            away_market_no_vig_probability: 0.31,
            market_overround: 0.04,
            home_spread_line: -1.5,
            home_spread_odds: 130,
            away_spread_line: 1.5,
            away_spread_odds: -150,
            total_line: 5.5,
            over_odds: -110,
            under_odds: -110,
            source_url: "https://site.api.espn.com/test-late",
            provenance: {
              provider: "espn_site_api",
            },
            metadata: {},
          },
          {
            odds_snapshot_id: "11111111-1111-1111-1111-111111111111",
            game_id: 2025020001,
            provider: "DraftKings",
            captured_at: "2026-01-10T17:00:00.000Z",
            game_date: "2026-01-10",
            event_start_at: "2026-01-10T23:00:00.000Z",
            home_team_id: 1,
            away_team_id: 2,
            home_moneyline: -120,
            away_moneyline: 100,
            home_market_no_vig_probability: 0.545455,
            away_market_no_vig_probability: 0.454545,
            market_overround: 0.045455,
            home_spread_line: -1.5,
            home_spread_odds: 180,
            away_spread_line: 1.5,
            away_spread_odds: -210,
            total_line: 5.5,
            over_odds: -110,
            under_odds: -110,
            source_url: "https://site.api.espn.com/test",
            provenance: {
              import_source_name: "historical_market_odds_import",
              import_recorded_at: "2026-06-15T12:00:00.000Z",
              import_batch_id: "market-import-2026-06-15",
            },
            metadata: {},
          },
        ],
      }),
    );

    expect(payload.market).toMatchObject({
      oddsSnapshotId: "11111111-1111-1111-1111-111111111111",
      sourceName: "historical_market_odds_import",
      importRecordedAt: "2026-06-15T12:00:00.000Z",
      importBatchId: "market-import-2026-06-15",
      homeMoneyline: -120,
      awayMoneyline: 100,
      homeNoVigProbability: 0.545455,
    });
    expect(payload.fallbackFlags.market_odds_unavailable).toBeUndefined();
    expect(payload.sourceCutoffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "game_prediction_market_odds_snapshots",
          cutoff: "2026-01-10T17:00:00.000Z",
          stale: false,
        }),
      ]),
    );
  });

  it("does not use market odds snapshots captured after a time-only game start", () => {
    const payload = buildGamePredictionFeatureSnapshotPayload(
      createInputs({
        game: {
          id: 2025020001,
          date: "2026-01-10",
          startTime: "19:00:00",
          seasonId: 20252026,
          homeTeamId: 1,
          awayTeamId: 2,
          type: 2,
        },
        predictionCutoffAt: "2026-01-10T21:00:00.000Z",
        marketOddsRows: [
          {
            odds_snapshot_id: "44444444-4444-4444-4444-444444444444",
            game_id: 2025020001,
            provider: "DraftKings",
            captured_at: "2026-01-10T20:00:00.000Z",
            game_date: "2026-01-10",
            event_start_at: null,
            home_team_id: 1,
            away_team_id: 2,
            home_moneyline: -120,
            away_moneyline: 100,
            home_market_no_vig_probability: 0.545455,
            away_market_no_vig_probability: 0.454545,
            market_overround: 0.045455,
            home_spread_line: -1.5,
            home_spread_odds: 180,
            away_spread_line: 1.5,
            away_spread_odds: -210,
            total_line: 5.5,
            over_odds: -110,
            under_odds: -110,
            source_url: "https://site.api.espn.com/test-time-only",
            provenance: {
              import_source_name: "historical_market_odds_import",
            },
            metadata: {},
          },
        ],
      }),
    );

    expect(payload.market).toBeNull();
    expect(payload.fallbackFlags.market_odds_unavailable).toBe(true);
  });

  it("preserves canonical live ESPN market odds source names in feature snapshots", () => {
    const payload = buildGamePredictionFeatureSnapshotPayload(
      createInputs({
        predictionCutoffAt: "2026-01-10T18:00:00.000Z",
        marketOddsRows: [
          {
            odds_snapshot_id: "33333333-3333-3333-3333-333333333333",
            game_id: 2025020001,
            provider: "ESPN BET",
            captured_at: "2026-01-10T17:00:00.000Z",
            game_date: "2026-01-10",
            event_start_at: "2026-01-10T23:00:00.000Z",
            home_team_id: 1,
            away_team_id: 2,
            home_moneyline: -120,
            away_moneyline: 100,
            home_market_no_vig_probability: 0.545455,
            away_market_no_vig_probability: 0.454545,
            market_overround: 0.045455,
            home_spread_line: -1.5,
            home_spread_odds: 180,
            away_spread_line: 1.5,
            away_spread_odds: -210,
            total_line: 5.5,
            over_odds: -110,
            under_odds: -110,
            source_url: "https://site.api.espn.com/test",
            provenance: {
              source_name: ESPN_MARKET_ODDS_SOURCE_NAME,
              provider: "espn_site_api",
              capture_recorded_at: "2026-01-10T17:00:05.000Z",
            },
            metadata: {
              source_name: ESPN_MARKET_ODDS_SOURCE_NAME,
              capture_recorded_at: "2026-01-10T17:00:05.000Z",
            },
          },
        ],
      }),
    );

    expect(payload.market).toMatchObject({
      sourceName: ESPN_MARKET_ODDS_SOURCE_NAME,
      oddsSnapshotId: "33333333-3333-3333-3333-333333333333",
      provider: "ESPN BET",
    });
  });

  it("builds CTPI and schedule-strength context without using same-day rows", () => {
    const payload = buildGamePredictionFeatureSnapshotPayload(
      createInputs({
        forgeTeamProjectionRows: [
          {
            run_id: "run-1",
            game_id: 2025020001,
            team_id: 1,
            horizon_games: 1,
            proj_goals_es: 2.4,
            proj_goals_pp: 0.6,
            proj_shots_es: 26,
            proj_shots_pp: 5,
            updated_at: "2026-01-10T15:00:00+00:00",
          },
          {
            run_id: "run-1",
            game_id: 2025020001,
            team_id: 2,
            horizon_games: 1,
            proj_goals_es: 1.9,
            proj_goals_pp: 0.3,
            proj_shots_es: 24,
            proj_shots_pp: 4,
            updated_at: "2026-01-10T15:00:00+00:00",
          },
        ],
      }),
    );

    expect(payload.home.ctpi).toMatchObject({
      sourceDate: "2026-01-09",
      publicationStatus: RECENT_TEAM_FORM_APPROVED_PUBLICATION_STATUS,
      formulaVersion: RECENT_TEAM_FORM_FORMULA_VERSION,
      inputVersion: RECENT_TEAM_FORM_INPUT_VERSION,
      sourceGameCount: 10,
      ctpi0To100: 64,
      offense: 65,
    });
    expect(payload.away.ctpi).toMatchObject({
      sourceDate: "2026-01-08",
      ctpi0To100: 48,
    });
    expect(payload.home.scheduleStrength).toMatchObject({
      sourceMaxDate: "2026-01-08",
      pastOpponentGames: 1,
      pastOpponentAvgOffRating: 60,
      pastOpponentCompositeRating: 57.5,
      last5OpponentCompositeRating: 57.5,
      last10OpponentCompositeRating: 57.5,
    });
    expect(payload.away.scheduleStrength).toMatchObject({
      sourceMaxDate: "2026-01-05",
      pastOpponentGames: 1,
      pastOpponentAvgOffRating: 44,
      pastOpponentCompositeRating: 42.5,
      last5OpponentCompositeRating: 42.5,
      last10OpponentCompositeRating: 42.5,
    });
    expect(payload.home.opponentAdjustedForm).toMatchObject({
      rawLast10GoalDifferentialPerGame: 1.5,
      adjustedLast10GoalDifferentialPerGame: 1.075,
    });
    expect(payload.home.opponentAdjustedForm?.rawLast10XgfPct).toBeCloseTo(
      0.56,
    );
    expect(payload.home.opponentAdjustedForm?.adjustedLast10XgfPct).toBeCloseTo(
      0.53875,
    );
    expect(payload.away.opponentAdjustedForm).toMatchObject({
      rawLast10GoalDifferentialPerGame: -2,
      adjustedLast10GoalDifferentialPerGame: -2.575,
      rawLast10XgfPct: 0.4,
      adjustedLast10XgfPct: 0.37125,
    });
    expect(payload.matchup.homeMinusAwayCtpi).toBe(16);
    expect(payload.matchup.homeMinusAwayPastOpponentCompositeRating).toBe(15);
    expect(payload.matchup.homeMinusAwayLast5OpponentCompositeRating).toBe(15);
    expect(payload.matchup.homeMinusAwayLast10OpponentCompositeRating).toBe(15);
    expect(
      payload.matchup.homeMinusAwayAdjustedRecent10GoalDifferentialPerGame,
    ).toBeCloseTo(3.65);
    expect(payload.matchup.homeMinusAwayAdjustedRecent10XgfPct).toBeCloseTo(
      0.1675,
    );
    expect(payload.matchup.homeMinusAwayForgeProjectedGoals).toBeCloseTo(0.8);
    expect(payload.matchup.homeMinusAwayForgeProjectedShots).toBe(3);
    expect(payload.sourceCutoffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "team_ctpi_daily",
          cutoff: "2026-01-09",
        }),
        expect.objectContaining({
          table: "team_power_ratings_daily",
          cutoff: "2026-01-08",
          asOfRule: "strict_before_source_as_of_date_for_schedule_strength",
        }),
        expect.objectContaining({
          table: "forge_team_projections",
          cutoff: "2026-01-10",
          asOfRule: "current_prediction_only",
        }),
      ]),
    );
  });

  it("uses only explicitly approved CTPI rows in prediction features", () => {
    const inputs = createInputs();
    const latestBos = inputs.teamCtpiRows.find(
      (row) => row.team === "BOS" && row.date === "2026-01-09",
    );
    expect(latestBos).toBeDefined();
    inputs.teamCtpiRows = [
      {
        ...latestBos!,
        publication_status: RECENT_TEAM_FORM_LEGACY_PUBLICATION_STATUS,
        ctpi_0_to_100: 99,
      },
      {
        ...latestBos!,
        date: "2026-01-08",
        ctpi_0_to_100: 52,
      },
      ...inputs.teamCtpiRows.filter((row) => row.team !== "BOS"),
    ];

    const payload = buildGamePredictionFeatureSnapshotPayload(inputs);
    expect(payload.home.ctpi).toMatchObject({
      sourceDate: "2026-01-08",
      ctpi0To100: 52,
    });
    expect(payload.away.ctpi).toMatchObject({
      sourceDate: "2026-01-08",
      ctpi0To100: 48,
    });
    expect(payload.matchup.homeMinusAwayCtpi).toBe(4);

    const unapprovedInputs = createInputs();
    unapprovedInputs.teamCtpiRows = unapprovedInputs.teamCtpiRows.map(
      (row) => ({
        ...row,
        publication_status: RECENT_TEAM_FORM_LEGACY_PUBLICATION_STATUS,
      }),
    );
    const unavailablePayload =
      buildGamePredictionFeatureSnapshotPayload(unapprovedInputs);
    expect(unavailablePayload.home.ctpi).toBeNull();
    expect(unavailablePayload.away.ctpi).toBeNull();
    expect(unavailablePayload.matchup.homeMinusAwayCtpi).toBeNull();
    expect(unavailablePayload.missingFeatures).toEqual(
      expect.arrayContaining(["home.ctpi", "away.ctpi"]),
    );
  });

  it("blends unconfirmed goalie candidates and collapses confirmed candidates", () => {
    const homeGoalie = buildGoalieBlendFeatures(
      createInputs().goalieStartRows,
      1,
    );
    expect(homeGoalie).toMatchObject({
      source: "goalie_start_projections",
      confirmed: false,
      candidateCount: 2,
      topGoalieId: 100,
      topGoalieStartProbability: 0.75,
    });
    expect(homeGoalie.weightedProjectedGsaaPer60).toBeCloseTo(0.25);

    expect(
      buildGoalieBlendFeatures(createInputs().goalieStartRows, 2),
    ).toMatchObject({
      confirmed: true,
      candidateCount: 1,
      topGoalieId: 200,
      weightedProjectedGsaaPer60: 0.1,
    });
  });

  it("attaches goalie workload, rest, and quality-start context", () => {
    const payload = buildGamePredictionFeatureSnapshotPayload(createInputs());

    expect(payload.home.goalie.context).toMatchObject({
      sourceMaxDate: "2026-01-09",
      gamesPlayedLast14Days: 2,
      startsLast14Days: 2,
      daysSinceLastStart: 1,
      isGoalieBackToBack: true,
      seasonGamesPlayed: 25,
      seasonGamesStarted: 23,
      seasonSavePct: 0.918,
      seasonShotsAgainstPer60: 30.5,
      qualityStarts: 14,
      qualityStartsPct: 0.6,
      restSplitGamesPlayed: {
        rest0: 2,
        rest4Plus: 6,
      },
    });
    expect(payload.home.goalie.context?.last5ShotsAgainstPerGame).toBe(30);
    expect(payload.home.goalie.context?.last5SavePct).toBeCloseTo(55 / 60);
    expect(payload.sourceCutoffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "forge_goalie_game",
          cutoff: "2026-01-09",
        }),
        expect.objectContaining({
          table: "wgo_goalie_stats",
          cutoff: "2026-01-09",
        }),
      ]),
    );
  });

  it("prefers accepted CCC confirmed goalies over projection rows", () => {
    const payload = buildGamePredictionFeatureSnapshotPayload(
      createInputs({
        linesCccRows: [
          {
            game_id: 2025020001,
            team_id: 1,
            observed_at: "2026-01-10T16:00:00+00:00",
            tweet_posted_at: "2026-01-10T15:58:00+00:00",
            classification: "confirmed",
            status: "observed",
            nhl_filter_status: "accepted",
            goalie_1_player_id: 999,
            goalie_1_name: "Confirmed Starter",
            goalie_2_player_id: null,
            goalie_2_name: null,
          },
        ],
      }),
    );

    expect(payload.home.goalie).toMatchObject({
      source: "lines_ccc",
      confirmed: true,
      topGoalieId: 999,
      topGoalieName: "Confirmed Starter",
      topGoalieStartProbability: 1,
    });
  });

  it("infers an unconfirmed goalie from recent prior starters when projection rows are absent", () => {
    const payload = buildGamePredictionFeatureSnapshotPayload(
      createInputs({
        goalieStartRows: [],
        lineCombinationRows: [
          {
            gameId: 2025019998,
            teamId: 1,
            forwards: [],
            defensemen: [],
            goalies: [300],
          },
          {
            gameId: 2025019999,
            teamId: 1,
            forwards: [],
            defensemen: [],
            goalies: [301],
          },
          {
            gameId: 2025020000,
            teamId: 1,
            forwards: [],
            defensemen: [],
            goalies: [300],
          },
        ],
        goaliePerformanceRows: [
          {
            player_id: 300,
            team_id: 1,
            date: "2026-01-08",
            player_name: "Recent Starter",
            nst_all_rates_gsaa_per_60: 0.42,
            nst_5v5_rates_gsaa_per_60: 0.31,
          },
        ],
        priorGames: [
          {
            id: 2025020000,
            date: "2026-01-09",
            startTime: "2026-01-09T23:00:00+00:00",
            seasonId: 20252026,
            homeTeamId: 1,
            awayTeamId: 3,
            type: 2,
          },
          {
            id: 2025019999,
            date: "2026-01-07",
            startTime: "2026-01-07T23:00:00+00:00",
            seasonId: 20252026,
            homeTeamId: 4,
            awayTeamId: 1,
            type: 2,
          },
          {
            id: 2025019998,
            date: "2026-01-05",
            startTime: "2026-01-05T23:00:00+00:00",
            seasonId: 20252026,
            homeTeamId: 1,
            awayTeamId: 5,
            type: 2,
          },
        ],
      }),
    );

    expect(payload.home.goalie).toMatchObject({
      source: "recent_usage",
      confirmed: false,
      candidateCount: 2,
      topGoalieId: 300,
      weightedProjectedGsaaPer60: 0.42,
    });
    expect(payload.home.goalie.topGoalieStartProbability).toBeCloseTo(2 / 3);
  });

  it("clips audited WGO and goalie projection outliers before building model features", () => {
    const payload = buildGamePredictionFeatureSnapshotPayload(
      createInputs({
        wgoTeamRows: [
          {
            team_id: 1,
            date: "2026-01-09",
            game_id: null,
            opponent_id: null,
            goals_for_per_game: 12,
            goals_against_per_game: -1,
            shots_for_per_game: 77,
            shots_against_per_game: 80,
            power_play_pct: 0.2,
            penalty_kill_pct: 0.81,
          },
          {
            team_id: 2,
            date: "2026-01-09",
            game_id: null,
            opponent_id: null,
            goals_for_per_game: 2,
            goals_against_per_game: 3,
            shots_for_per_game: 28,
            shots_against_per_game: 31,
            power_play_pct: 0.18,
            penalty_kill_pct: 0.78,
          },
        ],
        goalieStartRows: [
          {
            game_id: 2025020001,
            team_id: 1,
            player_id: 100,
            game_date: "2026-01-10",
            start_probability: 0.5,
            confirmed_status: false,
            projected_gsaa_per_60: 9,
            created_at: "2026-01-10T14:00:00+00:00",
            updated_at: "2026-01-10T14:00:00+00:00",
          },
          {
            game_id: 2025020001,
            team_id: 1,
            player_id: 101,
            game_date: "2026-01-10",
            start_probability: 0.5,
            confirmed_status: false,
            projected_gsaa_per_60: -9,
            created_at: "2026-01-10T14:00:00+00:00",
            updated_at: "2026-01-10T14:00:00+00:00",
          },
        ],
      }),
    );

    expect(payload.home.wgoTeam).toMatchObject({
      goalsForPerGame: 8,
      goalsAgainstPerGame: 0,
      shotsForPerGame: 60,
      shotsAgainstPerGame: 60,
    });
    expect(payload.home.goalie.weightedProjectedGsaaPer60).toBe(0);
  });

  it("builds matchup features, fallback flags, and snapshot insert payload", () => {
    const payload = buildGamePredictionFeatureSnapshotPayload(createInputs());

    expect(payload.matchup.homeMinusAwayOffRating).toBe(9);
    expect(payload.matchup.homeMinusAwayGoalDifferential).toBe(26);
    expect(payload.fallbackFlags.away_wgo_team_fallback).toBe(true);
    expect(payload.home.lineup).toMatchObject({
      forwardCount: 6,
      defensemanCount: 4,
      goalieCount: 2,
    });

    const insert = buildFeatureSnapshotInsert({
      payload,
      modelName: "baseline_logistic",
      modelVersion: "v0",
      predictionCutoffAt: "2026-01-10T18:00:00+00:00",
    });

    expect(insert).toMatchObject({
      game_id: 2025020001,
      snapshot_date: "2026-01-10",
      model_name: "baseline_logistic",
      model_version: "v0",
      feature_set_version: "game_features_v6_verified_team_game_sos100",
      home_team_id: 1,
      away_team_id: 2,
    });
    expect(insert.metadata).toMatchObject({
      prediction_contract: {
        modelName: "baseline_logistic",
        modelVersion: "v0",
        featureSetVersion: "game_features_v6_verified_team_game_sos100",
        asOfDate: "2026-01-10",
        fallbackFlags: {
          away_wgo_team_fallback: true,
        },
      },
    });
    expect(insert.provenance).toMatchObject({
      source_freshness: expect.arrayContaining([
        expect.objectContaining({
          source: "team_power_ratings_daily",
          degradedState: "fresh",
          stale: false,
        }),
      ]),
    });
    expect(payload.sourceCutoffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "goalie_start_projections",
          asOfRule: "current_prediction_only",
        }),
        expect.objectContaining({
          table: "lineCombinations",
          asOfRule: "current_prediction_only",
        }),
      ]),
    );
  });

  it("embeds TOI-weighted roster impacts and matchup deltas with truthful source state", () => {
    const payload = buildGamePredictionFeatureSnapshotPayload(
      createInputs({
        currentRosterRows: [
          { playerId: 10, teamId: 1 },
          { playerId: 20, teamId: 2 },
        ],
        skaterOffenseRatingRows: [
          {
            player_id: 10,
            team_id: 1,
            snapshot_date: "2026-01-09",
            rating_raw: 1.2,
            sample_toi_seconds: 100,
            components: { shrinkage: 0.5 },
          },
          {
            player_id: 20,
            team_id: 2,
            snapshot_date: "2026-01-09",
            rating_raw: 0.2,
            sample_toi_seconds: 100,
            components: { shrinkage: 0.5 },
          },
        ],
        skaterDefenseRatingRows: [
          {
            player_id: 10,
            team_id: 1,
            snapshot_date: "2026-01-09",
            rating_raw: 0.5,
            sample_toi_seconds: 100,
          },
          {
            player_id: 20,
            team_id: 2,
            snapshot_date: "2026-01-09",
            rating_raw: -0.5,
            sample_toi_seconds: 100,
          },
        ],
        goalieRatingRows: [
          {
            player_id: 10,
            team_id: 1,
            snapshot_date: "2026-01-09",
            rating_raw: 0.3,
            sample_toi_seconds: 100,
          },
          {
            player_id: 20,
            team_id: 2,
            snapshot_date: "2026-01-09",
            rating_raw: -0.2,
            sample_toi_seconds: 100,
          },
        ],
      }),
    );

    expect(payload.home.rosterImpact).toMatchObject({
      source: "projected_lineup",
      skaterOffenseImpact: 1.2,
      skaterDefenseImpact: 0.5,
      fallbackDerived: false,
    });
    expect(payload.away.rosterImpact).toMatchObject({
      source: "current_roster",
      skaterOffenseImpact: 0.2,
      skaterDefenseImpact: -0.5,
      fallbackDerived: true,
    });
    expect(payload.matchup).toMatchObject({
      homeMinusAwayRosterOffImpact: 1,
      homeMinusAwayRosterDefImpact: 1,
      homeMinusAwayRosterGoalieImpact: 0.5,
      homeMinusAwayRosterOffImpactPer60Only: 2,
      homeRosterPriorWeight: 0.29,
      awayRosterPriorWeight: 0.29,
      homeCurrentFormWeight: 0.71,
      awayCurrentFormWeight: 0.71,
      homeMinusAwayWeightedRosterOffImpact: 0.29,
      homeMinusAwayWeightedRosterDefImpact: 0.29,
      homeMinusAwayWeightedRosterGoalieImpact: 0.145,
      homeMinusAwayWeightedRecent10GoalDifferentialPerGame: 2.485,
    });
    expect(payload.matchup.homeMinusAwayWeightedRecent10XgfPct).toBeCloseTo(
      0.1136,
    );
    expect(payload.fallbackFlags.away_roster_impact_fallback).toBe(true);
  });

  it("emits warnings for stale, sparse, and fallback feature sources", () => {
    const payload = buildGamePredictionFeatureSnapshotPayload(
      createInputs({
        sourceAsOfDate: "2026-02-01",
        teamPowerRows: [
          {
            team_abbreviation: "BOS",
            date: "2026-01-01",
            off_rating: 56,
            def_rating: 52,
            goalie_rating: 51,
            special_rating: 54,
            pace_rating: 49,
            xgf60: 3.1,
            xga60: 2.5,
            gf60: 3.2,
            ga60: 2.6,
            sf60: 32,
            sa60: 28,
          },
        ],
        lineCombinationRows: [],
        forgeGoalieGameRows: [],
        wgoGoalieRows: [],
      }),
    );

    expect(payload.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "stale_source",
          source: "team_power_ratings_daily",
        }),
        expect.objectContaining({
          code: "missing_source",
          source: "lineCombinations",
        }),
        expect.objectContaining({
          code: "fallback_lineup_omitted",
          source: "lineCombinations",
        }),
      ]),
    );
    expect(payload.fallbackFlags.home_lineup_omitted).toBe(true);
  });

  it("builds deduplicated game-scoped source provenance rows for prediction health", () => {
    const payload = buildGamePredictionFeatureSnapshotPayload(createInputs());
    const rows = buildGamePredictionSourceProvenanceRows({
      payload,
      prediction: {
        gameId: payload.gameId,
        snapshotDate: payload.gameDate,
        predictionScope: "pregame",
        predictionCutoffAt: "2026-01-10T18:00:00+00:00",
        modelName: "baseline_logistic",
        modelVersion: "v0",
        featureSetVersion: payload.featureSetVersion,
        homeTeamId: payload.home.teamId,
        awayTeamId: payload.away.teamId,
        homeWinProbability: 0.55,
        awayWinProbability: 0.45,
        predictedWinnerTeamId: payload.home.teamId,
        confidenceLabel: "medium",
        topFactors: [],
        components: {},
        provenance: {},
        metadata: {},
      },
    });

    const sourceNames = rows.map((row) => row.source_name);
    expect(sourceNames).toContain("team_power_ratings_daily");
    expect(sourceNames).toContain("goalie_start_projections");
    expect(sourceNames).toContain("lineCombinations");
    expect(sourceNames).toContain("game_prediction_outputs");
    expect(new Set(sourceNames).size).toBe(sourceNames.length);
    expect(
      rows.every(
        (row) =>
          row.entity_type === "game" &&
          row.entity_id === payload.gameId &&
          row.game_id === payload.gameId,
      ),
    ).toBe(true);
  });
});
