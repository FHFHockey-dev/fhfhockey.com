import type { SupabaseClient } from "@supabase/supabase-js";

import type { BinaryLogisticModel, BinaryTrainingExample } from "lib/xg/binaryLogistic";
import {
  predictBinaryLogisticProbability,
  trainBinaryLogisticModel,
} from "lib/xg/binaryLogistic";
import type { ProbabilityCalibrator } from "lib/xg/calibration";
import type { Database, Json } from "lib/supabase/database-generated.types";
import type { GamePredictionFeatureSnapshotPayload } from "./featureBuilder";

export const BASELINE_MODEL_NAME = "nhl_game_baseline_logistic";
export const BASELINE_MODEL_VERSION = "v1";

export const BASELINE_FEATURE_KEYS = [
  "homeMinusAwayOffRating",
  "homeMinusAwayDefRating",
  "homeMinusAwayGoalieRating",
  "homeMinusAwaySpecialRating",
  "homeMinusAwayPointPctg",
  "homeMinusAwayGoalDifferential",
  "homeMinusAwayWeightedGoalieGsaaPer60",
  "homeRestAdvantageDays",
] as const;

export type BaselineFeatureKey = (typeof BASELINE_FEATURE_KEYS)[number];

export type GamePredictionBaselineExample = BinaryTrainingExample & {
  gameId: number;
  featureSnapshotId: string;
  featureKeys: readonly BaselineFeatureKey[];
};

export type GameOutcome = {
  gameId: number;
  homeWon: boolean;
};

export type GamePredictionTopFactor = {
  featureKey: BaselineFeatureKey;
  value: number;
  weight: number;
  contribution: number;
};

export type GamePredictionResult = {
  gameId: number;
  snapshotDate: string;
  predictionScope: "pregame";
  predictionCutoffAt: string;
  modelName: string;
  modelVersion: string;
  featureSetVersion: string;
  homeTeamId: number;
  awayTeamId: number;
  homeWinProbability: number;
  awayWinProbability: number;
  predictedWinnerTeamId: number;
  confidenceLabel: "low" | "medium" | "high";
  topFactors: GamePredictionTopFactor[];
  components: Record<string, Json>;
  provenance: Record<string, Json>;
  metadata: Record<string, Json>;
};

function finiteOrZero(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function clipProbability(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(0.999999, Math.max(0.000001, value));
}

function roundProbability(value: number): number {
  return Number(clipProbability(value).toFixed(6));
}

export function buildBaselineFeatureVector(
  payload: GamePredictionFeatureSnapshotPayload
): number[] {
  return [
    payload.matchup.homeMinusAwayOffRating,
    payload.matchup.homeMinusAwayDefRating,
    payload.matchup.homeMinusAwayGoalieRating,
    payload.matchup.homeMinusAwaySpecialRating,
    payload.matchup.homeMinusAwayPointPctg,
    payload.matchup.homeMinusAwayGoalDifferential == null
      ? null
      : payload.matchup.homeMinusAwayGoalDifferential / 50,
    payload.matchup.homeMinusAwayWeightedGoalieGsaaPer60,
    payload.matchup.homeRestAdvantageDays == null
      ? null
      : Math.max(-3, Math.min(3, payload.matchup.homeRestAdvantageDays)) / 3,
  ].map(finiteOrZero);
}

export function buildBaselineTrainingDataset(
  snapshots: Array<{ featureSnapshotId: string; payload: GamePredictionFeatureSnapshotPayload }>,
  outcomes: GameOutcome[]
): GamePredictionBaselineExample[] {
  const outcomesByGameId = new Map(outcomes.map((outcome) => [outcome.gameId, outcome]));

  return snapshots.flatMap((snapshot) => {
    const outcome = outcomesByGameId.get(snapshot.payload.gameId);
    if (!outcome) return [];

    return [
      {
        gameId: snapshot.payload.gameId,
        featureSnapshotId: snapshot.featureSnapshotId,
        featureKeys: BASELINE_FEATURE_KEYS,
        features: buildBaselineFeatureVector(snapshot.payload),
        label: outcome.homeWon ? 1 : 0,
      },
    ];
  });
}

export function trainGamePredictionBaselineModel(
  examples: GamePredictionBaselineExample[],
  options: Parameters<typeof trainBinaryLogisticModel>[1] = { iterations: 800, learningRate: 0.05, l2: 0.01 }
): BinaryLogisticModel {
  return trainBinaryLogisticModel(examples, options);
}

export function getConfidenceLabel(probability: number): GamePredictionResult["confidenceLabel"] {
  const edge = Math.abs(probability - 0.5);
  if (edge >= 0.15) return "high";
  if (edge >= 0.07) return "medium";
  return "low";
}

function buildTopFactors(
  model: BinaryLogisticModel,
  features: number[],
  limit = 5
): GamePredictionTopFactor[] {
  return BASELINE_FEATURE_KEYS.map((featureKey, index) => {
    const value = features[index] ?? 0;
    const weight = model.weights[index] ?? 0;
    return {
      featureKey,
      value,
      weight,
      contribution: value * weight,
    };
  })
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, limit);
}

export function predictGameWithBaselineModel(args: {
  payload: GamePredictionFeatureSnapshotPayload;
  model: BinaryLogisticModel;
  predictionCutoffAt: string;
  calibrator?: ProbabilityCalibrator;
  modelName?: string;
  modelVersion?: string;
}): GamePredictionResult {
  const features = buildBaselineFeatureVector(args.payload);
  const rawHomeProbability = predictBinaryLogisticProbability(args.model, features);
  const calibratedHomeProbability = args.calibrator
    ? args.calibrator.predict(rawHomeProbability)
    : rawHomeProbability;
  const homeWinProbability = roundProbability(calibratedHomeProbability);
  const awayWinProbability = roundProbability(1 - homeWinProbability);

  return {
    gameId: args.payload.gameId,
    snapshotDate: args.payload.gameDate,
    predictionScope: "pregame",
    predictionCutoffAt: args.predictionCutoffAt,
    modelName: args.modelName ?? BASELINE_MODEL_NAME,
    modelVersion: args.modelVersion ?? BASELINE_MODEL_VERSION,
    featureSetVersion: args.payload.featureSetVersion,
    homeTeamId: args.payload.home.teamId,
    awayTeamId: args.payload.away.teamId,
    homeWinProbability,
    awayWinProbability,
    predictedWinnerTeamId:
      homeWinProbability >= awayWinProbability ? args.payload.home.teamId : args.payload.away.teamId,
    confidenceLabel: getConfidenceLabel(homeWinProbability),
    topFactors: buildTopFactors(args.model, features),
    components: {
      baseline_features: Object.fromEntries(
        BASELINE_FEATURE_KEYS.map((featureKey, index) => [featureKey, features[index]])
      ) as Json,
      raw_home_win_probability: rawHomeProbability,
      calibration_method: args.calibrator?.method ?? "raw",
    },
    provenance: {
      source_cutoffs: args.payload.sourceCutoffs as unknown as Json,
      missing_features: args.payload.missingFeatures as unknown as Json,
      fallback_flags: args.payload.fallbackFlags as unknown as Json,
    },
    metadata: {
      confidence_label: getConfidenceLabel(homeWinProbability),
      feature_set_version: args.payload.featureSetVersion,
      game_type: args.payload.gameType,
      has_stale_source: args.payload.sourceCutoffs.some((cutoff) => cutoff.stale),
      goalie_confirmation_state:
        args.payload.home.goalie.confirmed && args.payload.away.goalie.confirmed
          ? "both_confirmed"
          : args.payload.home.goalie.confirmed || args.payload.away.goalie.confirmed
            ? "partial_confirmed"
            : "projected_or_fallback",
      warnings: args.payload.warnings as unknown as Json,
    },
  };
}

export function buildGamePredictionHistoryInsert(args: {
  prediction: GamePredictionResult;
  featureSnapshotId: string;
  runId?: string | null;
}): Database["public"]["Tables"]["game_prediction_history"]["Insert"] {
  const { prediction } = args;
  return {
    feature_snapshot_id: args.featureSnapshotId,
    run_id: args.runId ?? null,
    snapshot_date: prediction.snapshotDate,
    game_id: prediction.gameId,
    prediction_scope: prediction.predictionScope,
    prediction_cutoff_at: prediction.predictionCutoffAt,
    model_name: prediction.modelName,
    model_version: prediction.modelVersion,
    feature_set_version: prediction.featureSetVersion,
    home_team_id: prediction.homeTeamId,
    away_team_id: prediction.awayTeamId,
    home_win_probability: prediction.homeWinProbability,
    away_win_probability: prediction.awayWinProbability,
    predicted_winner_team_id: prediction.predictedWinnerTeamId,
    confidence_label: prediction.confidenceLabel,
    top_factors: prediction.topFactors as unknown as Json,
    components: prediction.components,
    provenance: prediction.provenance,
    metadata: prediction.metadata,
    computed_at: prediction.predictionCutoffAt,
  };
}

export function buildGamePredictionOutputUpsert(
  prediction: GamePredictionResult
): Database["public"]["Tables"]["game_prediction_outputs"]["Insert"] {
  return {
    snapshot_date: prediction.snapshotDate,
    game_id: prediction.gameId,
    model_name: prediction.modelName,
    model_version: prediction.modelVersion,
    prediction_scope: prediction.predictionScope,
    home_team_id: prediction.homeTeamId,
    away_team_id: prediction.awayTeamId,
    home_win_probability: prediction.homeWinProbability,
    away_win_probability: prediction.awayWinProbability,
    components: {
      ...prediction.components,
      top_factors: prediction.topFactors as unknown as Json,
    },
    provenance: prediction.provenance,
    metadata: prediction.metadata,
    computed_at: prediction.predictionCutoffAt,
    updated_at: new Date().toISOString(),
  };
}

export async function persistGamePrediction(args: {
  client: SupabaseClient<Database>;
  prediction: GamePredictionResult;
  featureSnapshotId: string;
  runId?: string | null;
}): Promise<string> {
  const historyInsert = buildGamePredictionHistoryInsert({
    prediction: args.prediction,
    featureSnapshotId: args.featureSnapshotId,
    runId: args.runId,
  });
  const { data, error } = await args.client
    .from("game_prediction_history")
    .insert(historyInsert)
    .select("prediction_id")
    .single();
  if (error) throw error;

  const { error: latestError } = await args.client
    .from("game_prediction_outputs")
    .upsert(buildGamePredictionOutputUpsert(args.prediction), {
      onConflict: "snapshot_date,game_id,model_name,model_version,prediction_scope",
    });
  if (latestError) throw latestError;

  return data.prediction_id;
}
