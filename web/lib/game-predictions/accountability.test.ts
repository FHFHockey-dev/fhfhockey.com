import { describe, expect, it } from "vitest";

import {
  buildAccountabilityDailySeries,
  buildAccountabilitySummary,
  buildPredictionCandlestick,
  type AccountabilityPredictionRow,
  type PredictionCandlestick,
} from "./accountability";

const teamsById = new Map([
  [1, { id: 1, abbreviation: "BOS", name: "Boston Bruins" }],
  [2, { id: 2, abbreviation: "BUF", name: "Buffalo Sabres" }],
]);

function prediction(
  overrides: Partial<AccountabilityPredictionRow>,
): AccountabilityPredictionRow {
  return {
    prediction_id: "prediction-1",
    game_id: 1,
    snapshot_date: "2026-01-10",
    prediction_cutoff_at: "2026-01-10T18:00:00.000Z",
    model_name: "nhl_game_baseline_logistic",
    model_version: "v1",
    feature_set_version: "game_features_v1",
    home_team_id: 2,
    away_team_id: 1,
    home_win_probability: 0.52,
    away_win_probability: 0.48,
    predicted_winner_team_id: 2,
    confidence_label: "low",
    metadata: {},
    computed_at: "2026-01-10T18:00:00.000Z",
    ...overrides,
  };
}

function candle(
  overrides: Partial<PredictionCandlestick>,
): PredictionCandlestick {
  return {
    gameId: 1,
    snapshotDate: "2026-01-10",
    startTime: "2026-01-10T23:00:00.000Z",
    homeTeamId: 2,
    awayTeamId: 1,
    homeTeamAbbreviation: "BUF",
    awayTeamAbbreviation: "BOS",
    openHomeWinProbability: 0.52,
    lowHomeWinProbability: 0.48,
    highHomeWinProbability: 0.57,
    finalHomeWinProbability: 0.54,
    actualHomeWinProbability: 1,
    probabilitySpread: 0.09,
    predictionCount: 3,
    finalPredictionId: "prediction-3",
    finalPredictionCutoffAt: "2026-01-10T22:00:00.000Z",
    predictedWinnerTeamId: 2,
    actualWinnerTeamId: 2,
    predictedWinnerCorrect: true,
    homeScore: 4,
    awayScore: 2,
    ...overrides,
  };
}

describe("game prediction accountability", () => {
  it("builds candlesticks from repeated predictions and uses final pregame prediction", () => {
    const result = buildPredictionCandlestick({
      teamsById,
      game: {
        id: 1,
        date: "2026-01-10",
        startTime: "2026-01-10T23:00:00.000Z",
        seasonId: 20252026,
        homeTeamId: 2,
        awayTeamId: 1,
        type: 2,
      },
      outcome: {
        gameId: 1,
        homeTeamId: 2,
        awayTeamId: 1,
        homeScore: 4,
        awayScore: 2,
        homeWon: true,
      },
      predictions: [
        prediction({
          prediction_id: "prediction-1",
          prediction_cutoff_at: "2026-01-10T16:00:00.000Z",
          home_win_probability: 0.52,
          away_win_probability: 0.48,
        }),
        prediction({
          prediction_id: "prediction-2",
          prediction_cutoff_at: "2026-01-10T18:00:00.000Z",
          home_win_probability: 0.48,
          away_win_probability: 0.52,
          predicted_winner_team_id: 1,
        }),
        prediction({
          prediction_id: "prediction-3",
          prediction_cutoff_at: "2026-01-10T22:00:00.000Z",
          home_win_probability: 0.57,
          away_win_probability: 0.43,
        }),
      ],
    });

    expect(result).toMatchObject({
      openHomeWinProbability: 0.52,
      lowHomeWinProbability: 0.48,
      highHomeWinProbability: 0.57,
      finalHomeWinProbability: 0.57,
      actualHomeWinProbability: 1,
      probabilitySpread: 0.09,
      predictionCount: 3,
      finalPredictionId: "prediction-3",
      predictedWinnerCorrect: true,
      homeTeamAbbreviation: "BUF",
      awayTeamAbbreviation: "BOS",
    });
  });

  it("summarizes cumulative and rolling accountability", () => {
    const candles = [
      candle({
        gameId: 1,
        snapshotDate: "2026-01-10",
        predictedWinnerCorrect: true,
      }),
      candle({
        gameId: 2,
        snapshotDate: "2026-01-11",
        predictedWinnerCorrect: false,
      }),
      candle({
        gameId: 3,
        snapshotDate: "2026-01-11",
        predictedWinnerCorrect: true,
      }),
    ];

    expect(buildAccountabilitySummary(candles)).toMatchObject({
      evaluatedGames: 3,
      correctGames: 2,
      wrongGames: 1,
      accuracy: 0.666667,
    });

    expect(buildAccountabilityDailySeries(candles)).toMatchObject([
      {
        asOfDate: "2026-01-10",
        evaluatedGames: 1,
        correctGames: 1,
        wrongGames: 0,
        cumulativeAccuracy: 1,
      },
      {
        asOfDate: "2026-01-11",
        evaluatedGames: 3,
        correctGames: 2,
        wrongGames: 1,
        cumulativeAccuracy: 0.666667,
      },
    ]);
  });
});
