import { describe, expect, it } from "vitest";

import type { BinaryLogisticModel } from "lib/xg/binaryLogistic";
import {
  buildBaselineFeatureVector,
  buildBaselineTrainingDataset,
  buildGamePredictionHistoryInsert,
  buildGamePredictionOutputUpsert,
  predictGameWithBaselineModel,
  trainGamePredictionBaselineModel,
} from "./baselineModel";
import {
  buildGamePredictionFeatureSnapshotPayload,
  type GamePredictionFeatureInputs,
} from "./featureBuilder";

function createPayload(homeOffRating = 60) {
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
    priorGames: [],
    teamPowerRows: [
      {
        team_abbreviation: "BOS",
        date: "2026-01-09",
        off_rating: homeOffRating,
        def_rating: 55,
        goalie_rating: 52,
        special_rating: 54,
        pace_rating: 49,
        xgf60: 3,
        xga60: 2.5,
        gf60: 3,
        ga60: 2.5,
        sf60: 31,
        sa60: 28,
      },
      {
        team_abbreviation: "MTL",
        date: "2026-01-09",
        off_rating: 48,
        def_rating: 50,
        goalie_rating: 49,
        special_rating: 47,
        pace_rating: 51,
        xgf60: 2.8,
        xga60: 3,
        gf60: 2.7,
        ga60: 3.1,
        sf60: 29,
        sa60: 32,
      },
    ],
    standingsRows: [
      {
        team_abbrev: "BOS",
        date: "2026-01-09",
        games_played: 40,
        point_pctg: 0.62,
        win_pctg: 0.56,
        goal_differential: 20,
        l10_games_played: 10,
        l10_goal_differential: 5,
      },
      {
        team_abbrev: "MTL",
        date: "2026-01-09",
        games_played: 40,
        point_pctg: 0.5,
        win_pctg: 0.45,
        goal_differential: -5,
        l10_games_played: 10,
        l10_goal_differential: -2,
      },
    ],
    wgoTeamRows: [],
    goalieStartRows: [
      {
        game_id: 2025020001,
        team_id: 1,
        player_id: 100,
        game_date: "2026-01-10",
        start_probability: 1,
        confirmed_status: true,
        projected_gsaa_per_60: 0.3,
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
        projected_gsaa_per_60: -0.1,
        created_at: "2026-01-10T14:00:00+00:00",
        updated_at: "2026-01-10T14:00:00+00:00",
      },
    ],
    lineCombinationRows: [],
    linesCccRows: [],
    goaliePerformanceRows: [],
  };

  return buildGamePredictionFeatureSnapshotPayload(inputs);
}

describe("game prediction baseline model", () => {
  it("builds finite baseline feature vectors", () => {
    expect(buildBaselineFeatureVector(createPayload())).toEqual([
      12, 5, 3, 7, 0.12, 0.5, 0.4, 0,
    ]);
  });

  it("creates training examples from feature snapshots and outcomes", () => {
    const examples = buildBaselineTrainingDataset(
      [{ featureSnapshotId: "snapshot-1", payload: createPayload() }],
      [{ gameId: 2025020001, homeWon: true }],
    );

    expect(examples).toHaveLength(1);
    expect(examples[0]).toMatchObject({
      gameId: 2025020001,
      featureSnapshotId: "snapshot-1",
      label: 1,
    });
  });

  it("trains a regularized logistic baseline", () => {
    const winningPayload = createPayload(65);
    const losingPayload = createPayload(40);
    losingPayload.gameId = 2025020002;
    const examples = buildBaselineTrainingDataset(
      [
        { featureSnapshotId: "win", payload: winningPayload },
        { featureSnapshotId: "loss", payload: losingPayload },
      ],
      [
        { gameId: winningPayload.gameId, homeWon: true },
        { gameId: losingPayload.gameId, homeWon: false },
      ],
    );

    const model = trainGamePredictionBaselineModel(examples, {
      iterations: 5,
      learningRate: 0.01,
      l2: 0.01,
    });
    expect(model.featureCount).toBe(8);
    expect(model.weights).toHaveLength(8);
  });

  it("generates probability-consistent prediction payloads and persistence rows", () => {
    const model: BinaryLogisticModel = {
      featureCount: 8,
      weights: [0.02, 0.01, 0.03, 0.01, 0.4, 0.2, 0.3, 0.05],
      bias: 0,
    };
    const prediction = predictGameWithBaselineModel({
      payload: createPayload(),
      model,
      predictionCutoffAt: "2026-01-10T18:00:00+00:00",
    });

    expect(
      prediction.homeWinProbability + prediction.awayWinProbability,
    ).toBeCloseTo(1);
    expect(prediction.predictedWinnerTeamId).toBe(1);
    expect(prediction.topFactors.length).toBeGreaterThan(0);

    expect(
      buildGamePredictionHistoryInsert({
        prediction,
        featureSnapshotId: "11111111-1111-1111-1111-111111111111",
      }),
    ).toMatchObject({
      game_id: 2025020001,
      feature_snapshot_id: "11111111-1111-1111-1111-111111111111",
      home_team_id: 1,
      away_team_id: 2,
      prediction_scope: "pregame",
    });

    expect(buildGamePredictionOutputUpsert(prediction)).toMatchObject({
      game_id: 2025020001,
      model_name: "nhl_game_baseline_logistic",
      prediction_scope: "pregame",
    });
  });
});
