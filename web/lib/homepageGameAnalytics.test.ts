import { describe, expect, it } from "vitest";

import {
  analyticsFromPrediction,
  attachHomepageGameAnalytics,
  displayedWinPair,
  enrichHomepageGames,
  mergeForgeProjectedScores,
  mergePersistedGameMetrics,
} from "./homepageGameAnalytics";

const PIN = { modelVersion: "cfg-v2", featureVersion: 2, predictionType: "shot_goal" as const };

const prediction = {
  gameId: 2026020001,
  computedAt: "2026-10-10T16:00:00.000Z",
  homeWinProbability: 0.61,
  awayWinProbability: 0.39,
  homeTeam: { id: 6, abbreviation: "BOS" },
  awayTeam: { id: 3, abbreviation: "NYR" },
  predictedWinnerTeamId: 6,
  modelName: "nhl_game_baseline_logistic",
  modelVersion: "v6_roster_ctpi_sos_threshold_52",
  featureSetVersion: "game_features_v4_roster_sos_context",
  freshness: { hasStaleSource: false },
  market: {
    homeNoVigProbability: 0.55,
    awayNoVigProbability: 0.45,
  },
  matchup: {
    awayProjectedGoals: 2.41,
    homeProjectedGoals: 3.08,
    awayGoalieName: "Away Starter",
    awayGoalieConfirmed: false,
    awayGoalieSource: "goalie_start_projections",
    homeGoalieName: "Home Starter",
    homeGoalieConfirmed: true,
    homeGoalieSource: "lines_ccc",
  },
} as any;

describe("homepage game analytics", () => {
  it("maps current predictions to the canonical game id", () => {
    expect(analyticsFromPrediction(prediction)).toEqual({
      gameId: 2026020001,
      awayWinProbability: 0.39,
      homeWinProbability: 0.61,
      awayWinPercent: 39,
      homeWinPercent: 61,
      predictionPick: "home",
      predictedWinnerTeamId: 6,
      favoredTeamAbbreviation: "BOS",
      edgeTeamAbbreviation: "BOS",
      edgePercentagePoints: 6,
      awayProjectedGoals: 2.41,
      homeProjectedGoals: 3.08,
      projectedGoalsComputedAt: "2026-10-10T16:00:00.000Z",
      projectedGoalsModelName: "forge",
      projectedGoalsModelVersion: "market-context-v1",
      projectedGoalsFreshness: "fresh",
      awayStarter: {
        name: "Away Starter",
        confirmed: false,
        source: "goalie_start_projections",
      },
      homeStarter: {
        name: "Home Starter",
        confirmed: true,
        source: "lines_ccc",
      },
      predictionComputedAt: "2026-10-10T16:00:00.000Z",
      predictionModelName: "nhl_game_baseline_logistic",
      predictionModelVersion: "v6_roster_ctpi_sos_threshold_52",
      predictionFeatureSetVersion: "game_features_v4_roster_sos_context",
      predictionFreshness: "fresh",
    });
  });

  it("omits prediction values when an upstream source is stale", () => {
    expect(
      analyticsFromPrediction({
        ...prediction,
        freshness: { hasStaleSource: true },
      }),
    ).toEqual({
      gameId: 2026020001,
      predictionComputedAt: "2026-10-10T16:00:00.000Z",
      predictionModelName: "nhl_game_baseline_logistic",
      predictionModelVersion: "v6_roster_ctpi_sos_threshold_52",
      predictionFeatureSetVersion: "game_features_v4_roster_sos_context",
      predictionFreshness: "stale",
    });
  });

  it("joins the latest fresh FORGE score by canonical game id and omits stale output", () => {
    const games = [
      {
        id: 2026020001,
        startTimeUTC: "2026-10-10T20:00:00.000Z",
      },
      {
        id: 2026020002,
        startTimeUTC: "2026-10-10T21:00:00.000Z",
      },
    ];
    const analyticsByGameId = new Map<number, { gameId: number }>();

    mergeForgeProjectedScores({
      games,
      analyticsByGameId,
      rows: [
        {
          game_id: 2026020001,
          away_expected_goals: 2.41,
          home_expected_goals: 3.08,
          computed_at: "2026-10-10T16:00:00.000Z",
          model_name: "forge",
          model_version: "market-context-v1",
        },
        {
          game_id: 2026020002,
          away_expected_goals: 4.5,
          home_expected_goals: 1.2,
          computed_at: "2026-10-07T16:00:00.000Z",
          model_name: "forge",
          model_version: "market-context-v1",
        },
        {
          game_id: 2026020999,
          away_expected_goals: 99,
          home_expected_goals: 99,
          computed_at: "2026-10-10T16:00:00.000Z",
          model_name: "forge",
          model_version: "market-context-v1",
        },
      ],
    });

    expect(analyticsByGameId.get(2026020001)).toEqual({
      gameId: 2026020001,
      awayProjectedGoals: 2.41,
      homeProjectedGoals: 3.08,
      projectedGoalsComputedAt: "2026-10-10T16:00:00.000Z",
      projectedGoalsModelName: "forge",
      projectedGoalsModelVersion: "market-context-v1",
      projectedGoalsFreshness: "fresh",
    });
    expect(analyticsByGameId.get(2026020002)).toEqual({
      gameId: 2026020002,
      projectedGoalsComputedAt: "2026-10-07T16:00:00.000Z",
      projectedGoalsModelName: "forge",
      projectedGoalsModelVersion: "market-context-v1",
      projectedGoalsFreshness: "stale",
    });
    expect(analyticsByGameId.has(2026020999)).toBe(false);
  });

  it("joins xG and SOG by game and team without leaking adjacent-game values", () => {
    const games = [
      {
        id: 2026020001,
        startTimeUTC: "2026-10-10T20:00:00.000Z",
        awayTeam: { id: 3 },
        homeTeam: { id: 6 },
      },
      {
        id: 2026020002,
        startTimeUTC: "2026-10-10T20:00:00.000Z",
        awayTeam: { id: 10 },
        homeTeam: { id: 15 },
      },
    ];
    const analyticsByGameId = new Map([
      [2026020001, { gameId: 2026020001 }],
    ]);

    mergePersistedGameMetrics({
      games,
      analyticsByGameId,
      xgModel: PIN,
      xgRows: [
        xgRow({ team_id: 3, is_home: false, xg_for: 1.82 }),
        xgRow({ team_id: 6, is_home: true, xg_for: 2.35 }),
        xgRow({ game_id: 2026020999, team_id: 6, is_home: true, xg_for: 99 }),
      ] as any,
      strengthRows: [
        sogRow({ team_id: 3, shots_es: 16, shots_pp: 3, shots_pk: 1 }),
        sogRow({ team_id: 6, shots_es: 20, shots_pp: 4, shots_pk: 0 }),
      ] as any,
    });

    expect(attachHomepageGameAnalytics(games, analyticsByGameId)).toEqual([
      {
        ...games[0],
        analytics: {
          gameId: 2026020001,
          awayXg: 1.82,
          homeXg: 2.35,
          awayShotsOnGoal: 20,
          homeShotsOnGoal: 24,
          xgUpdatedAt: "2026-10-10T23:00:00.000Z",
          shotsUpdatedAt: "2026-10-10T23:01:00.000Z",
        },
      },
      games[1],
    ]);
  });
});

// W3-2 A1 / W3-3 D5: the served pair needs complete buckets, one model
// version and a timestamp from each side; the matrix below fails on a
// partial sum (ES 20 + PP null + PK 1 = 21), on the max-timestamp merge and
// on a cross-version xG pair.
const GAME = {
  id: 2026020001,
  startTimeUTC: "2026-10-10T20:00:00.000Z",
  awayTeam: { id: 3 },
  homeTeam: { id: 6 },
};

function xgRow(overrides: Record<string, unknown> = {}) {
  return {
    game_id: GAME.id,
    team_id: 6,
    is_home: true,
    xg_for: 2.35,
    model_version: PIN.modelVersion,
    feature_version: PIN.featureVersion,
    source_model_approved: true,
    source_prediction_type: "shot_goal",
    updated_at: "2026-10-10T23:00:00.000Z",
    ...overrides,
  };
}

function sogRow(overrides: Record<string, unknown> = {}) {
  return {
    game_id: GAME.id,
    team_id: 6,
    shots_es: 20,
    shots_pp: 4,
    shots_pk: 0,
    updated_at: "2026-10-10T23:01:00.000Z",
    ...overrides,
  };
}

function merged(args: {
  xgRows?: Array<Record<string, unknown>>;
  strengthRows?: Array<Record<string, unknown>>;
  xgModel?: typeof PIN | null;
}) {
  const analyticsByGameId = new Map<number, any>();
  mergePersistedGameMetrics({
    games: [GAME],
    analyticsByGameId,
    xgModel: args.xgModel === undefined ? PIN : args.xgModel,
    xgRows: (args.xgRows ?? []) as any,
    strengthRows: (args.strengthRows ?? []) as any,
  });
  return analyticsByGameId.get(GAME.id) ?? { gameId: GAME.id };
}

describe("homepage persisted metric pairs (W3-2 A1 matrix)", () => {
  it("serves SOG only when every strength bucket of both sides is known", () => {
    const complete = merged({
      strengthRows: [
        sogRow({ team_id: 3, shots_es: 20, shots_pp: 2, shots_pk: 1 }),
        sogRow({ team_id: 6 }),
      ],
    });
    expect(complete).toMatchObject({ awayShotsOnGoal: 23, homeShotsOnGoal: 24 });

    const missingBucket = merged({
      strengthRows: [
        sogRow({ team_id: 3, shots_es: 20, shots_pp: null, shots_pk: 1 }),
        sogRow({ team_id: 6 }),
      ],
    });
    expect(missingBucket.awayShotsOnGoal).toBeUndefined();
    expect(missingBucket.homeShotsOnGoal).toBeUndefined();
    expect(missingBucket.shotsUpdatedAt).toBeUndefined();
  });

  it("never serves one side alone", () => {
    const oneSide = merged({
      strengthRows: [sogRow({ team_id: 6 })],
      xgRows: [xgRow({ team_id: 6 })],
    });
    expect(oneSide.homeShotsOnGoal).toBeUndefined();
    expect(oneSide.homeXg).toBeUndefined();
  });

  it("rejects a side written before the game started and dates the pair by its older side", () => {
    const staleSide = merged({
      strengthRows: [
        sogRow({ team_id: 3, updated_at: "2026-06-17T03:00:00.000Z" }),
        sogRow({ team_id: 6, updated_at: "2026-10-10T23:01:00.000Z" }),
      ],
      xgRows: [
        xgRow({ team_id: 3, is_home: false, updated_at: "2026-06-17T03:00:00.000Z" }),
        xgRow({ team_id: 6, updated_at: "2026-10-10T23:00:00.000Z" }),
      ],
    });
    expect(staleSide.awayShotsOnGoal).toBeUndefined();
    expect(staleSide.homeShotsOnGoal).toBeUndefined();
    expect(staleSide.awayXg).toBeUndefined();
    expect(staleSide.homeXg).toBeUndefined();

    const bothValid = merged({
      strengthRows: [
        sogRow({ team_id: 3, updated_at: "2026-10-10T21:30:00.000Z" }),
        sogRow({ team_id: 6, updated_at: "2026-10-10T23:01:00.000Z" }),
      ],
      xgRows: [
        xgRow({ team_id: 3, is_home: false, xg_for: 1.8, updated_at: "2026-10-10T21:00:00.000Z" }),
        xgRow({ team_id: 6, updated_at: "2026-10-10T23:00:00.000Z" }),
      ],
    });
    expect(bothValid.shotsUpdatedAt).toBe("2026-10-10T21:30:00.000Z");
    expect(bothValid.xgUpdatedAt).toBe("2026-10-10T21:00:00.000Z");
  });

  it.each([
    ["away side from another model version", { model_version: "cfg9bac2706" }],
    ["away side from another feature version", { feature_version: 1 }],
    ["away side not from an approved model", { source_model_approved: false }],
  ])("drops the xG pair when the %s", (_label, override) => {
    const result = merged({
      xgRows: [
        xgRow({ team_id: 3, is_home: false, xg_for: 1.82, ...override }),
        xgRow({ team_id: 6 }),
      ],
    });
    expect(result.awayXg).toBeUndefined();
    expect(result.homeXg).toBeUndefined();
    expect(result.xgUpdatedAt).toBeUndefined();
  });

  it("serves no in-house xG when the selector returns no model (decision 99)", () => {
    const result = merged({
      xgModel: null,
      xgRows: [xgRow({ team_id: 3, is_home: false, xg_for: 1.82 }), xgRow({ team_id: 6 })],
    });
    expect(result.awayXg).toBeUndefined();
    expect(result.homeXg).toBeUndefined();
  });
});

type Row = Record<string, any>;
function fakeClient(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const filters: Array<(row: Row) => boolean> = [];
      const query: any = {
        select: () => query,
        eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), query),
        in: (column: string, values: unknown[]) => (filters.push((row) => values.includes(row[column])), query),
        gte: () => query,
        lte: () => query,
        or: () => query,
        order: () => query,
        limit: () => query,
        then: (resolve: (value: unknown) => void, reject?: (error: unknown) => void) =>
          Promise.resolve({
            data: (tables[table] ?? []).filter((row) => filters.every((filter) => filter(row))),
            error: null,
          }).then(resolve, reject),
      };
      return query;
    },
  };
}

describe("enrichHomepageGames xG model selection", () => {
  const xgTable = [
    xgRow({ team_id: 3, is_home: false, xg_for: 1.82 }),
    xgRow({ team_id: 6 }),
    xgRow({ team_id: 3, is_home: false, xg_for: 9, model_version: "cfg9bac2706", feature_version: 1 }),
    xgRow({ team_id: 6, xg_for: 9, model_version: "cfg9bac2706", feature_version: 1 }),
  ];
  const registryRow = (overrides: Row) => ({
    model_version: PIN.modelVersion,
    feature_version: PIN.featureVersion,
    prediction_type: "shot_goal",
    approval_status: "approved",
    model_approved: true,
    is_active: true,
    is_champion: false,
    updated_at: "2026-11-01T00:00:00.000Z",
    ...overrides,
  });

  async function enrich(registry: Row[]) {
    const [game] = (await enrichHomepageGames({
      supabase: fakeClient({
        nhl_xg_model_registry: registry,
        nhl_xg_team_game_aggregates: xgTable,
      }) as any,
      games: [{ ...GAME }],
      date: "2026-10-10",
    })) as Array<{ analytics?: Record<string, unknown> }>;
    return game!.analytics ?? {};
  }

  it("reads the aggregates of the single active approved model the L14 selector picks", async () => {
    // An inactive champion listed first must not win over the active model.
    const analytics = await enrich([
      registryRow({ model_version: "cfg9bac2706", feature_version: 1, is_active: false, is_champion: true }),
      registryRow({}),
    ]);
    expect(analytics).toMatchObject({ awayXg: 1.82, homeXg: 2.35 });
  });

  it("shows in-house xG as unavailable when the active row is not affirmatively approved", async () => {
    const analytics = await enrich([registryRow({ approval_status: "retired" })]);
    expect(analytics.awayXg).toBeUndefined();
    expect(analytics.homeXg).toBeUndefined();
  });
});

// W3-2 D2 / decision 43: the pick follows the displayed pair; exactly 50% is a tie.
describe("displayed win pair and pick (decision 43)", () => {
  it("rounds one side, takes the complement and calls a displayed 50/50 a tie", () => {
    expect(displayedWinPair(0.496, 0.504)).toEqual({ awayPercent: 50, homePercent: 50, pick: "tie" });
    expect(displayedWinPair(0.495, 0.505)).toEqual({ awayPercent: 49, homePercent: 51, pick: "home" });
    expect(displayedWinPair(0.505, 0.495)).toEqual({ awayPercent: 51, homePercent: 49, pick: "away" });
  });

  it("rejects incoherent pairs", () => {
    expect(displayedWinPair(0.7, 0.5)).toBeNull();
    expect(displayedWinPair(-0.1, 1.1)).toBeNull();
    expect(displayedWinPair(undefined, 0.6)).toBeNull();
  });

  it("maps a 0.504/0.496 prediction to a tie with no favoured team or winner id", () => {
    const analytics = analyticsFromPrediction({
      ...prediction,
      homeWinProbability: 0.504,
      awayWinProbability: 0.496,
      predictedWinnerTeamId: 6,
      market: null,
    });
    expect(analytics).toMatchObject({ awayWinPercent: 50, homeWinPercent: 50, predictionPick: "tie" });
    expect(analytics.favoredTeamAbbreviation).toBeUndefined();
    expect(analytics.predictedWinnerTeamId).toBeUndefined();
  });

  it("serves no probabilities, pick or edge for an incoherent pair", () => {
    const analytics = analyticsFromPrediction({
      ...prediction,
      homeWinProbability: 0.7,
      awayWinProbability: 0.5,
    });
    expect(analytics.homeWinProbability).toBeUndefined();
    expect(analytics.awayWinProbability).toBeUndefined();
    expect(analytics.favoredTeamAbbreviation).toBeUndefined();
    expect(analytics.predictedWinnerTeamId).toBeUndefined();
    expect(analytics.edgeTeamAbbreviation).toBeUndefined();
  });
});
