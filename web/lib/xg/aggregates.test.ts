import { describe, expect, it } from "vitest";

import {
  buildArtifactDriftReport,
  buildTeamSurfaceDriftReport,
  buildXgAggregates,
  validateXgAggregateReconciliation,
  xgFeatureEventKey,
  type XgAggregatePredictionRow,
} from "./aggregates";

function prediction(
  overrides: Partial<XgAggregatePredictionRow> = {}
): XgAggregatePredictionRow {
  return {
    model_version: "model-v1",
    prediction_type: "shot_goal",
    feature_version: 1,
    game_id: 2025020001,
    event_id: 101,
    season_id: 20252026,
    game_date: "2025-10-07",
    event_owner_team_id: 10,
    shooter_player_id: 91,
    goalie_in_net_id: 31,
    label: false,
    xg: 0.25,
    model_approved: true,
    ...overrides,
  };
}

describe("xG aggregates", () => {
  it("builds team, player, and goalie game aggregates from approved shot-goal rows", () => {
    const result = buildXgAggregates(
      [
        prediction({ event_id: 101, xg: 0.25, label: false }),
        prediction({ event_id: 102, xg: 0.5, label: true, shooter_player_id: 92 }),
        prediction({
          event_id: 103,
          event_owner_team_id: 20,
          shooter_player_id: 201,
          goalie_in_net_id: 41,
          xg: 0.1,
          label: false,
        }),
      ],
      [
        {
          id: 2025020001,
          seasonId: 20252026,
          date: "2025-10-07",
          homeTeamId: 10,
          awayTeamId: 20,
        },
      ],
      { generatedAt: "2026-05-27T20:00:00.000Z", rollingWindows: [2] }
    );

    expect(result.skippedPredictionRows).toEqual([]);
    expect(result.teamGameRows).toEqual([
      expect.objectContaining({
        team_id: 10,
        opponent_team_id: 20,
        is_home: true,
        xg_for: 0.75,
        xg_against: 0.1,
        goals_for: 1,
        goals_against: 0,
        shot_attempts_for: 2,
        shot_attempts_against: 1,
      }),
      expect.objectContaining({
        team_id: 20,
        opponent_team_id: 10,
        is_home: false,
        xg_for: 0.1,
        xg_against: 0.75,
        goals_for: 0,
        goals_against: 1,
        shot_attempts_for: 1,
        shot_attempts_against: 2,
      }),
    ]);
    expect([...result.playerGameRows].sort((left, right) => left.player_id - right.player_id)).toEqual([
      expect.objectContaining({ player_id: 91, team_id: 10, ixg: 0.25, goals: 0 }),
      expect.objectContaining({ player_id: 92, team_id: 10, ixg: 0.5, goals: 1 }),
      expect.objectContaining({ player_id: 201, team_id: 20, ixg: 0.1, goals: 0 }),
    ]);
    expect(result.goalieGameRows).toEqual([
      expect.objectContaining({
        goalie_player_id: 31,
        team_id: 20,
        opponent_team_id: 10,
        xg_against: 0.75,
        goals_against: 1,
        shots_against: 2,
        goals_saved_above_expected: -0.25,
      }),
      expect.objectContaining({
        goalie_player_id: 41,
        team_id: 10,
        opponent_team_id: 20,
        xg_against: 0.1,
        goals_against: 0,
        shots_against: 1,
        goals_saved_above_expected: 0.1,
      }),
    ]);
    expect(
      validateXgAggregateReconciliation(
        [
          prediction({ event_id: 101, xg: 0.25, label: false }),
          prediction({ event_id: 102, xg: 0.5, label: true, shooter_player_id: 92 }),
          prediction({
            event_id: 103,
            event_owner_team_id: 20,
            shooter_player_id: 201,
            goalie_in_net_id: 41,
            xg: 0.1,
            label: false,
          }),
        ],
        [
          {
            id: 2025020001,
            seasonId: 20252026,
            date: "2025-10-07",
            homeTeamId: 10,
            awayTeamId: 20,
          },
        ],
        result
      )
    ).toMatchObject({
      passed: true,
      checks: {
        teamGame: { passed: true, rowsChecked: 2, issueCount: 0 },
        playerGame: { passed: true, rowsChecked: 3, issueCount: 0 },
        goalieGame: { passed: true, rowsChecked: 2, issueCount: 0 },
      },
      exclusions: {
        emptyNetGoalieRows: 0,
        missingShooterRows: 0,
        missingGoalieRows: 0,
      },
    });
  });

  it("builds rolling aggregates and skips unapproved or non-shot-goal rows", () => {
    const result = buildXgAggregates(
      [
        prediction({ game_id: 1, event_id: 1, game_date: "2025-10-01", xg: 0.1 }),
        prediction({ game_id: 2, event_id: 2, game_date: "2025-10-02", xg: 0.2 }),
        prediction({ game_id: 3, event_id: 3, game_date: "2025-10-03", xg: 0.3 }),
        prediction({ game_id: 3, event_id: 4, prediction_type: "rebound_creation" }),
        prediction({ game_id: 3, event_id: 5, model_approved: false }),
      ],
      [
        { id: 1, seasonId: 20252026, date: "2025-10-01", homeTeamId: 10, awayTeamId: 20 },
        { id: 2, seasonId: 20252026, date: "2025-10-02", homeTeamId: 10, awayTeamId: 20 },
        { id: 3, seasonId: 20252026, date: "2025-10-03", homeTeamId: 10, awayTeamId: 20 },
      ],
      { generatedAt: "2026-05-27T20:00:00.000Z", rollingWindows: [2] }
    );

    expect(result.skippedPredictionRows).toEqual([
      { gameId: 3, eventId: 4, reason: "not_approved_shot_goal_prediction" },
      { gameId: 3, eventId: 5, reason: "not_approved_shot_goal_prediction" },
    ]);
    expect(
      result.teamRollingRows.find((row) => row.team_id === 10 && row.as_of_game_id === 3)
    ).toMatchObject({
      window_games: 2,
      games_count: 2,
      xg_for: 0.5,
      shot_attempts_for: 2,
    });
    expect(
      result.playerRollingRows.find((row) => row.player_id === 91 && row.as_of_game_id === 3)
    ).toMatchObject({
      window_games: 2,
      games_count: 2,
      ixg: 0.5,
      shot_attempts: 2,
    });
  });

  it("reports aggregate reconciliation issues and unmapped goalie exclusions", () => {
    const predictions = [
      prediction({ event_id: 101, xg: 0.25, label: false, goalie_in_net_id: null }),
      prediction({ event_id: 102, xg: 0.5, label: true, shooter_player_id: null }),
    ];
    const games = [
      {
        id: 2025020001,
        seasonId: 20252026,
        date: "2025-10-07",
        homeTeamId: 10,
        awayTeamId: 20,
      },
    ];
    const result = buildXgAggregates(predictions, games, {
      generatedAt: "2026-05-27T20:00:00.000Z",
      rollingWindows: [2],
    });
    result.teamGameRows[0]!.xg_for = 0.5;

    const qa = validateXgAggregateReconciliation(predictions, games, result, {
      emptyNetEventKeys: new Set([
        xgFeatureEventKey({ featureVersion: 1, gameId: 2025020001, eventId: 101 }),
      ]),
    });

    expect(qa.passed).toBe(false);
    expect(qa.exclusions).toMatchObject({
      emptyNetGoalieRows: 1,
      emptyNetGoalieXg: 0.25,
      emptyNetGoalieGoals: 0,
      missingShooterRows: 1,
      missingGoalieRows: 0,
      missingGoalieXg: 0,
      missingGoalieGoals: 0,
    });
    expect(qa.issues).toEqual([
      expect.objectContaining({
        scope: "team_game",
        metric: "xg_for",
        expected: 0.75,
        actual: 0.5,
      }),
    ]);
  });

  it("builds artifact and external team-surface drift reports", () => {
    const predictions = [
      prediction({ event_id: 101, xg: 0.1, label: false }),
      prediction({ event_id: 102, xg: 0.3, label: true }),
    ];

    expect(
      buildArtifactDriftReport(predictions, {
        source: "artifact.json",
        exampleCount: 2,
        averagePrediction: 0.2,
        goalRate: 0.5,
      })
    ).toMatchObject({
      status: "checked",
      current: {
        predictionRows: 2,
        averagePrediction: 0.2,
        goalRate: 0.5,
      },
      deltas: {
        averagePrediction: 0,
        goalRate: 0,
        predictionRowsPct: 0,
      },
      warnings: [],
    });

    expect(
      buildTeamSurfaceDriftReport({
        source: "nst_team_gamelogs_as_counts",
        teamGameRows: [
          {
            model_version: "model-v1",
            feature_version: 1,
            season_id: 20252026,
            game_id: 1,
            game_date: "2025-10-07",
            team_id: 10,
            opponent_team_id: 20,
            is_home: true,
            xg_for: 2.5,
            xg_against: 1.5,
            goals_for: 2,
            goals_against: 1,
            shot_attempts_for: 30,
            shot_attempts_against: 22,
            source_prediction_type: "shot_goal",
            source_model_approved: true,
            provenance: {},
            updated_at: "2026-05-27T20:00:00.000Z",
          },
        ],
        externalRows: [
          {
            team_id: 10,
            game_date: "2025-10-07",
            xgf: 2.3,
            xga: 1.8,
          },
        ],
      })
    ).toMatchObject({
      status: "checked",
      rowsCompared: 1,
      missingComparisonRows: 0,
      metrics: {
        xgf: { averageAbsoluteDelta: 0.2, maxAbsoluteDelta: 0.2 },
        xga: { averageAbsoluteDelta: 0.3, maxAbsoluteDelta: 0.3 },
      },
      warnings: [],
    });
  });
});
