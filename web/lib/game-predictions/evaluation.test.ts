import { describe, expect, it } from "vitest";

import {
  attachOutcomesToPredictions,
  buildMetricInserts,
  buildSegmentMetrics,
  calculateAuc,
  deriveOutcomeFromScore,
  type GamePredictionHistoryRow,
} from "./evaluation";

function createPrediction(
  overrides: Partial<GamePredictionHistoryRow> = {}
): GamePredictionHistoryRow {
  return {
    prediction_id: "prediction-1",
    game_id: 2025020001,
    snapshot_date: "2026-01-10",
    model_name: "nhl_game_baseline_logistic",
    model_version: "v1",
    feature_set_version: "game_features_v1",
    home_team_id: 1,
    away_team_id: 2,
    home_win_probability: 0.62,
    away_win_probability: 0.38,
    predicted_winner_team_id: 1,
    confidence_label: "medium",
    metadata: {},
    computed_at: "2026-01-10T18:00:00+00:00",
    ...overrides,
  };
}

describe("game prediction evaluation", () => {
  it("derives completed outcomes from score rows", () => {
    expect(
      deriveOutcomeFromScore({
        game_id: 1,
        home_team_id: 10,
        away_team_id: 20,
        home_team_score: 4,
        away_team_score: 2,
      })
    ).toMatchObject({
      gameId: 1,
      homeWon: true,
      homeScore: 4,
      awayScore: 2,
    });
    expect(
      deriveOutcomeFromScore({
        game_id: 1,
        home_team_id: 10,
        away_team_id: 20,
        home_team_score: 2,
        away_team_score: 2,
      })
    ).toBeNull();
  });

  it("attaches outcomes without mutating prediction rows", () => {
    const prediction = createPrediction();
    const evaluated = attachOutcomesToPredictions([prediction], [
      {
        gameId: 2025020001,
        homeTeamId: 1,
        awayTeamId: 2,
        homeScore: 3,
        awayScore: 1,
        homeWon: true,
      },
    ]);

    expect(evaluated).toHaveLength(1);
    expect(evaluated[0]).toMatchObject({
      label: 1,
      predictionProbability: 0.62,
      predictedWinnerCorrect: true,
    });
    expect(prediction).not.toHaveProperty("outcome");
  });

  it("calculates segment metrics and calibration bins", () => {
    const evaluated = attachOutcomesToPredictions(
      [
        createPrediction({ prediction_id: "p1", game_id: 1, home_win_probability: 0.8, confidence_label: "high" }),
        createPrediction({
          prediction_id: "p2",
          game_id: 2,
          home_win_probability: 0.4,
          predicted_winner_team_id: 2,
          confidence_label: "medium",
          snapshot_date: "2026-03-15",
          metadata: { goalie_confirmation_state: "both_confirmed", game_type: 2 },
        }),
        createPrediction({
          prediction_id: "p3",
          game_id: 3,
          home_win_probability: 0.7,
          confidence_label: "high",
          metadata: { has_stale_source: true, goalie_confirmation_state: "projected_or_fallback", game_type: 3 },
        }),
      ],
      [
        { gameId: 1, homeTeamId: 1, awayTeamId: 2, homeScore: 4, awayScore: 1, homeWon: true },
        { gameId: 2, homeTeamId: 1, awayTeamId: 2, homeScore: 1, awayScore: 3, homeWon: false },
        { gameId: 3, homeTeamId: 1, awayTeamId: 2, homeScore: 2, awayScore: 3, homeWon: false },
      ]
    );
    const segments = buildSegmentMetrics(evaluated);

    expect(segments[0]).toMatchObject({
      segmentKey: "overall",
      evaluatedGames: 3,
    });
    expect(segments.some((segment) => segment.segmentKey === "confidence_label")).toBe(true);
    expect(segments.some((segment) => segment.segmentKey === "has_stale_source")).toBe(true);
    expect(segments[0].calibration).toHaveLength(10);
    expect(segments.some((segment) => segment.segmentKey === "season_phase")).toBe(true);
    expect(segments.some((segment) => segment.segmentKey === "predicted_side")).toBe(true);
    expect(segments.some((segment) => segment.segmentKey === "goalie_confirmation_state")).toBe(true);
    expect(segments.some((segment) => segment.segmentKey === "game_type")).toBe(true);
  });

  it("calculates AUC when both classes are present", () => {
    const evaluated = attachOutcomesToPredictions(
      [
        createPrediction({ game_id: 1, home_win_probability: 0.9 }),
        createPrediction({ game_id: 2, home_win_probability: 0.2 }),
      ],
      [
        { gameId: 1, homeTeamId: 1, awayTeamId: 2, homeScore: 4, awayScore: 1, homeWon: true },
        { gameId: 2, homeTeamId: 1, awayTeamId: 2, homeScore: 1, awayScore: 4, homeWon: false },
      ]
    );

    expect(calculateAuc(evaluated)).toBe(1);
  });

  it("builds model metric rows for persistence", () => {
    const evaluated = attachOutcomesToPredictions([createPrediction()], [
      {
        gameId: 2025020001,
        homeTeamId: 1,
        awayTeamId: 2,
        homeScore: 3,
        awayScore: 2,
        homeWon: true,
      },
    ]);
    const rows = buildMetricInserts({
      evaluated,
      modelName: "nhl_game_baseline_logistic",
      modelVersion: "v1",
      featureSetVersion: "game_features_v1",
      evaluationStartDate: "2026-01-01",
      evaluationEndDate: "2026-01-31",
    });

    expect(rows[0]).toMatchObject({
      model_name: "nhl_game_baseline_logistic",
      model_version: "v1",
      feature_set_version: "game_features_v1",
      evaluation_start_date: "2026-01-01",
      evaluation_end_date: "2026-01-31",
      segment_key: "overall",
      evaluated_games: 1,
    });
  });
});
