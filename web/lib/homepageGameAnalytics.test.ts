import { describe, expect, it } from "vitest";

import {
  analyticsFromPrediction,
  attachHomepageGameAnalytics,
  mergeForgeProjectedScores,
  mergePersistedGameMetrics,
} from "./homepageGameAnalytics";

const prediction = {
  gameId: 2026020001,
  computedAt: "2026-10-10T16:00:00.000Z",
  homeWinProbability: 0.61,
  awayWinProbability: 0.39,
  homeTeam: { abbreviation: "BOS" },
  awayTeam: { abbreviation: "NYR" },
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
        awayTeam: { id: 3 },
        homeTeam: { id: 6 },
      },
      {
        id: 2026020002,
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
      xgRows: [
        {
          game_id: 2026020001,
          team_id: 3,
          is_home: false,
          xg_for: 1.82,
          updated_at: "2026-10-10T23:00:00.000Z",
        },
        {
          game_id: 2026020001,
          team_id: 6,
          is_home: true,
          xg_for: 2.35,
          updated_at: "2026-10-10T23:00:00.000Z",
        },
        {
          game_id: 2026020999,
          team_id: 6,
          is_home: true,
          xg_for: 99,
          updated_at: "2026-10-10T23:00:00.000Z",
        },
      ] as any,
      strengthRows: [
        {
          game_id: 2026020001,
          team_id: 3,
          shots_es: 16,
          shots_pp: 3,
          shots_pk: 1,
          updated_at: "2026-10-10T23:01:00.000Z",
        },
        {
          game_id: 2026020001,
          team_id: 6,
          shots_es: 20,
          shots_pp: 4,
          shots_pk: 0,
          updated_at: "2026-10-10T23:01:00.000Z",
        },
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
