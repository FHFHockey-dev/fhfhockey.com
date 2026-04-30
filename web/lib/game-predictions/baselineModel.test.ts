import { describe, expect, it } from "vitest";

import type { BinaryLogisticModel } from "lib/xg/binaryLogistic";
import {
  BASELINE_MODEL_VERSION,
  analyzeBaselineFeatureSignals,
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
    nstTeamGamelogRows: [],
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
      12, 5, 3, 7, 0.12, 0.5, 0, 0, 0, 0, 0, 0.4, 0,
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
    expect(model.featureCount).toBe(13);
    expect(model.weights).toHaveLength(13);
    expect(model.featureNormalization?.means).toHaveLength(13);
    expect(model.featureNormalization?.scales).toHaveLength(13);
    expect(model.probabilityFloor).toBe(0.05);
  });

  it("analyzes per-feature winning signal with standardized logistic weights", () => {
    const winningPayload = createPayload(75);
    const losingPayload = createPayload(35);
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

    const analysis = analyzeBaselineFeatureSignals(examples, {
      iterations: 20,
      learningRate: 0.05,
      l2: 0.01,
    });
    const offRatingSignal = analysis.signals.find(
      (signal) => signal.featureKey === "homeMinusAwayOffRating",
    );

    expect(analysis.sampleSize).toBe(2);
    expect(analysis.homeWins).toBe(1);
    expect(analysis.awayWins).toBe(1);
    expect(offRatingSignal?.pearsonCorrelation).toBeGreaterThan(0);
    expect(offRatingSignal?.univariateOddsRatioPerStdDev).toBeGreaterThan(1);
    expect(offRatingSignal?.multivariateOddsRatioPerStdDev).toBeGreaterThan(1);
  });

  it("bounds extreme probabilities and records normalization metadata", () => {
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
      iterations: 20,
      learningRate: 0.05,
      l2: 0.01,
    });

    const prediction = predictGameWithBaselineModel({
      payload: createPayload(1000),
      model: {
        ...model,
        weights: model.weights.map(() => 100),
        bias: 100,
      },
      predictionCutoffAt: "2026-01-10T18:00:00+00:00",
    });

    expect(prediction.homeWinProbability).toBeLessThanOrEqual(0.95);
    expect(prediction.homeWinProbability).toBeGreaterThan(0.85);
    expect(prediction.components.normalization_method).toBe(
      "training_set_standard_score",
    );
    expect(prediction.components.probability_floor).toBe(0.05);
  });

  it("dampens confidence when source quality is weaker", () => {
    const model: BinaryLogisticModel = {
      featureCount: 13,
      weights: [
        0.12,
        0.08,
        0.04,
        0.04,
        0.4,
        0.2,
        0.02,
        0.02,
        0.02,
        0.02,
        0.02,
        0.1,
        0.05,
      ],
      bias: 0,
    };
    const cleanPayload = createPayload(65);
    const weakerPayload = {
      ...createPayload(65),
      sourceAsOfDate: "2026-01-03",
      missingFeatures: [
        "home.goalie_start_projection",
        "away.goalie_start_projection",
      ],
      sourceCutoffs: [
        {
          table: "team_power_ratings_daily",
          cutoff: "2025-12-15",
          asOfRule: "strict_before_source_as_of_date",
          stale: true,
        },
      ],
      home: {
        ...cleanPayload.home,
        lineup: null,
        goalie: {
          ...cleanPayload.home.goalie,
          source: "fallback" as const,
          confirmed: false,
        },
      },
      away: {
        ...cleanPayload.away,
        lineup: null,
        goalie: {
          ...cleanPayload.away.goalie,
          source: "fallback" as const,
          confirmed: false,
        },
      },
    };

    const clean = predictGameWithBaselineModel({
      payload: cleanPayload,
      model,
      predictionCutoffAt: "2026-01-10T18:00:00+00:00",
    });
    const weaker = predictGameWithBaselineModel({
      payload: weakerPayload,
      model,
      predictionCutoffAt: "2026-01-10T18:00:00+00:00",
    });

    expect(Math.abs(weaker.homeWinProbability - 0.5)).toBeLessThan(
      Math.abs(clean.homeWinProbability - 0.5),
    );
    expect(Number(weaker.components.data_quality_multiplier)).toBeLessThan(1);
    expect(weaker.components.data_quality_penalties).toMatchObject({
      goalie_fallback: 0.12,
    });
  });

  it("generates probability-consistent prediction payloads and persistence rows", () => {
    const model: BinaryLogisticModel = {
      featureCount: 13,
      weights: [
        0.02,
        0.01,
        0.03,
        0.01,
        0.4,
        0.2,
        0.02,
        0.02,
        0.02,
        0.02,
        0.02,
        0.3,
        0.05,
      ],
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
    expect(prediction.components).toMatchObject({
      threshold_50_predicted_winner_team_id: 1,
      selected_threshold_predicted_winner_team_id: 1,
      model_audit: {
        winnerPolicyVersion:
          "winner_policy_v1_report_50_and_selected_threshold",
        rosterImpactVersion: "none",
        strengthOfScheduleVersion: "none",
        seasonDecayVersion: "none",
        probabilityBlendVersion: "none",
      },
    });

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
      model_version: BASELINE_MODEL_VERSION,
      prediction_scope: "pregame",
    });
  });
});
