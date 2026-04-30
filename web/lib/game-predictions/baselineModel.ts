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
export const BASELINE_MODEL_VERSION = "v4_no_recent_point_pct_threshold_52";
export const BASELINE_PROBABILITY_FLOOR = 0.05;
export const BASELINE_MIN_DATA_QUALITY_MULTIPLIER = 0.55;
export const BASELINE_WINNER_DECISION_THRESHOLD = 0.52;

export const BASELINE_FEATURE_KEYS = [
  "homeMinusAwayOffRating",
  "homeMinusAwayDefRating",
  "homeMinusAwayGoalieRating",
  "homeMinusAwaySpecialRating",
  "homeMinusAwayPointPctg",
  "homeMinusAwayGoalDifferential",
  "homeMinusAwayRecent5GoalDifferentialPerGame",
  "homeMinusAwayRecent10GoalDifferentialPerGame",
  "homeMinusAwayRecent5XgfPct",
  "homeMinusAwayRecent10XgfPct",
  "homeMinusAwayRecent10PointPct",
  "homeMinusAwayWeightedGoalieGsaaPer60",
  "homeRestAdvantageDays",
] as const;

export type BaselineFeatureKey = (typeof BASELINE_FEATURE_KEYS)[number];

export type GamePredictionBaselineExample = BinaryTrainingExample & {
  gameId: number;
  featureSnapshotId: string;
  featureKeys: readonly BaselineFeatureKey[];
};

export type BaselineFeatureNormalization = {
  means: number[];
  scales: number[];
};

export type GamePredictionBaselineModel = BinaryLogisticModel & {
  featureNormalization?: BaselineFeatureNormalization;
  probabilityFloor?: number;
};

export type BaselineFeatureVectorOptions = {
  excludedFeatureKeys?: readonly BaselineFeatureKey[];
  includeDefaultExcludedFeatureKeys?: boolean;
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

function isFeatureExcluded(
  featureKey: BaselineFeatureKey,
  options?: BaselineFeatureVectorOptions,
): boolean {
  return getExcludedFeatureKeys(options).includes(featureKey);
}

function getExcludedFeatureKeys(
  options?: BaselineFeatureVectorOptions,
): readonly BaselineFeatureKey[] {
  const defaultExcluded: readonly BaselineFeatureKey[] =
    options?.includeDefaultExcludedFeatureKeys
      ? []
      : ["homeMinusAwayRecent10PointPct"];
  return Array.from(
    new Set([
      ...defaultExcluded,
      ...(options?.excludedFeatureKeys ?? []),
    ]),
  );
}

function finiteOrZero(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function clipProbability(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(0.999999, Math.max(0.000001, value));
}

function applyProbabilityFloor(
  value: number,
  model: BinaryLogisticModel,
): number {
  const floor =
    (model as GamePredictionBaselineModel).probabilityFloor ??
    BASELINE_PROBABILITY_FLOOR;
  const boundedFloor = Math.max(0, Math.min(0.49, floor));
  return Math.min(1 - boundedFloor, Math.max(boundedFloor, value));
}

function roundProbability(value: number): number {
  return Number(clipProbability(value).toFixed(6));
}

function parseDateOnly(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`);
}

function differenceInDays(laterDate: string, earlierDate: string): number {
  return Math.floor(
    (parseDateOnly(laterDate) - parseDateOnly(earlierDate)) / 86_400_000,
  );
}

function dampenTowardCoinFlip(probability: number, multiplier: number): number {
  return 0.5 + (probability - 0.5) * multiplier;
}

function buildDataQualityMultiplier(
  payload: GamePredictionFeatureSnapshotPayload,
): { multiplier: number; penalties: Record<string, number> } {
  const penalties: Record<string, number> = {};
  const staleCount = payload.sourceCutoffs.filter((cutoff) => cutoff.stale).length;
  if (staleCount > 0) {
    penalties.stale_sources = Math.min(0.18, staleCount * 0.03);
  }

  if (payload.missingFeatures.length > 0) {
    penalties.missing_features = Math.min(0.18, payload.missingFeatures.length * 0.025);
  }

  const goalieFallbackCount = [payload.home.goalie, payload.away.goalie].filter(
    (goalie) => goalie.source === "fallback",
  ).length;
  if (goalieFallbackCount > 0) {
    penalties.goalie_fallback = goalieFallbackCount * 0.06;
  }

  const projectedGoalieCount = [payload.home.goalie, payload.away.goalie].filter(
    (goalie) => !goalie.confirmed && goalie.source !== "fallback",
  ).length;
  if (projectedGoalieCount > 0) {
    penalties.projected_goalie = projectedGoalieCount * 0.025;
  }

  if (!payload.home.lineup || !payload.away.lineup) {
    penalties.missing_lineup = (!payload.home.lineup ? 0.03 : 0) +
      (!payload.away.lineup ? 0.03 : 0);
  }

  const horizonDays = Math.max(
    0,
    differenceInDays(payload.gameDate, payload.sourceAsOfDate),
  );
  if (horizonDays > 0) {
    penalties.prediction_horizon = Math.min(0.14, horizonDays * 0.02);
  }

  const totalPenalty = Object.values(penalties).reduce(
    (sum, penalty) => sum + penalty,
    0,
  );

  return {
    multiplier: Math.max(
      BASELINE_MIN_DATA_QUALITY_MULTIPLIER,
      Math.min(1, 1 - totalPenalty),
    ),
    penalties,
  };
}

function buildFeatureNormalization(
  examples: GamePredictionBaselineExample[],
): BaselineFeatureNormalization {
  const featureCount = examples[0]?.features.length ?? 0;
  const means = Array.from({ length: featureCount }, (_, featureIndex) => {
    const sum = examples.reduce(
      (total, example) => total + example.features[featureIndex],
      0,
    );
    return sum / examples.length;
  });
  const scales = means.map((mean, featureIndex) => {
    const variance =
      examples.reduce((total, example) => {
        const delta = example.features[featureIndex] - mean;
        return total + delta * delta;
      }, 0) / examples.length;
    const stdDev = Math.sqrt(variance);
    return stdDev > 1e-9 ? stdDev : 1;
  });

  return { means, scales };
}

function normalizeFeatureVector(
  features: number[],
  normalization?: BaselineFeatureNormalization,
): number[] {
  if (!normalization) return features;
  return features.map((feature, index) => {
    const mean = normalization.means[index] ?? 0;
    const scale = normalization.scales[index] ?? 1;
    return (feature - mean) / scale;
  });
}

function normalizeExamples(
  examples: GamePredictionBaselineExample[],
  normalization: BaselineFeatureNormalization,
): GamePredictionBaselineExample[] {
  return examples.map((example) => ({
    ...example,
    features: normalizeFeatureVector(example.features, normalization),
  }));
}

export function buildBaselineFeatureVector(
  payload: GamePredictionFeatureSnapshotPayload,
  options: BaselineFeatureVectorOptions = {},
): number[] {
  const values: Record<BaselineFeatureKey, number | null> = {
    homeMinusAwayOffRating: payload.matchup.homeMinusAwayOffRating,
    homeMinusAwayDefRating: payload.matchup.homeMinusAwayDefRating,
    homeMinusAwayGoalieRating: payload.matchup.homeMinusAwayGoalieRating,
    homeMinusAwaySpecialRating: payload.matchup.homeMinusAwaySpecialRating,
    homeMinusAwayPointPctg: payload.matchup.homeMinusAwayPointPctg,
    homeMinusAwayGoalDifferential:
      payload.matchup.homeMinusAwayGoalDifferential == null
        ? null
        : payload.matchup.homeMinusAwayGoalDifferential / 50,
    homeMinusAwayRecent5GoalDifferentialPerGame:
      payload.matchup.homeMinusAwayRecent5GoalDifferentialPerGame == null
        ? null
        : payload.matchup.homeMinusAwayRecent5GoalDifferentialPerGame / 3,
    homeMinusAwayRecent10GoalDifferentialPerGame:
      payload.matchup.homeMinusAwayRecent10GoalDifferentialPerGame == null
        ? null
        : payload.matchup.homeMinusAwayRecent10GoalDifferentialPerGame / 3,
    homeMinusAwayRecent5XgfPct: payload.matchup.homeMinusAwayRecent5XgfPct,
    homeMinusAwayRecent10XgfPct: payload.matchup.homeMinusAwayRecent10XgfPct,
    homeMinusAwayRecent10PointPct:
      payload.matchup.homeMinusAwayRecent10PointPct,
    homeMinusAwayWeightedGoalieGsaaPer60:
      payload.matchup.homeMinusAwayWeightedGoalieGsaaPer60,
    homeRestAdvantageDays:
      payload.matchup.homeRestAdvantageDays == null
        ? null
        : Math.max(-3, Math.min(3, payload.matchup.homeRestAdvantageDays)) / 3,
  };

  return BASELINE_FEATURE_KEYS.map((featureKey) =>
    isFeatureExcluded(featureKey, options) ? 0 : finiteOrZero(values[featureKey]),
  );
}

export function buildBaselineTrainingDataset(
  snapshots: Array<{ featureSnapshotId: string; payload: GamePredictionFeatureSnapshotPayload }>,
  outcomes: GameOutcome[],
  featureVectorOptions: BaselineFeatureVectorOptions = {},
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
        features: buildBaselineFeatureVector(snapshot.payload, featureVectorOptions),
        label: outcome.homeWon ? 1 : 0,
      },
    ];
  });
}

export function trainGamePredictionBaselineModel(
  examples: GamePredictionBaselineExample[],
  options: Parameters<typeof trainBinaryLogisticModel>[1] = { iterations: 800, learningRate: 0.05, l2: 0.01 }
): GamePredictionBaselineModel {
  const featureNormalization = buildFeatureNormalization(examples);
  const normalizedExamples = normalizeExamples(examples, featureNormalization);
  const model = trainBinaryLogisticModel(normalizedExamples, options);
  return {
    ...model,
    featureNormalization,
    probabilityFloor: BASELINE_PROBABILITY_FLOOR,
  };
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
  const normalizedFeatures = normalizeFeatureVector(
    features,
    (model as GamePredictionBaselineModel).featureNormalization,
  );
  return BASELINE_FEATURE_KEYS.map((featureKey, index) => {
    const value = features[index] ?? 0;
    const weight = model.weights[index] ?? 0;
    return {
      featureKey,
      value,
      weight,
      contribution: (normalizedFeatures[index] ?? 0) * weight,
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
  featureVectorOptions?: BaselineFeatureVectorOptions;
  disableDataQualityDampening?: boolean;
  winnerDecisionThreshold?: number;
}): GamePredictionResult {
  const features = buildBaselineFeatureVector(
    args.payload,
    args.featureVectorOptions,
  );
  const normalizedFeatures = normalizeFeatureVector(
    features,
    (args.model as GamePredictionBaselineModel).featureNormalization,
  );
  const rawHomeProbability = predictBinaryLogisticProbability(
    args.model,
    normalizedFeatures,
  );
  const calibratedHomeProbability = args.calibrator
    ? args.calibrator.predict(rawHomeProbability)
    : rawHomeProbability;
  const dataQuality = args.disableDataQualityDampening
    ? { multiplier: 1, penalties: {} }
    : buildDataQualityMultiplier(args.payload);
  const qualityAdjustedHomeProbability = dampenTowardCoinFlip(
    calibratedHomeProbability,
    dataQuality.multiplier,
  );
  const homeWinProbability = roundProbability(
    applyProbabilityFloor(qualityAdjustedHomeProbability, args.model),
  );
  const awayWinProbability = roundProbability(1 - homeWinProbability);
  const winnerDecisionThreshold = Math.max(
    0.01,
    Math.min(
      0.99,
      args.winnerDecisionThreshold ?? BASELINE_WINNER_DECISION_THRESHOLD,
    ),
  );
  const excludedFeatureKeys = getExcludedFeatureKeys(args.featureVectorOptions);

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
      homeWinProbability >= winnerDecisionThreshold
        ? args.payload.home.teamId
        : args.payload.away.teamId,
    confidenceLabel: getConfidenceLabel(homeWinProbability),
    topFactors: buildTopFactors(args.model, features),
    components: {
      baseline_features: Object.fromEntries(
        BASELINE_FEATURE_KEYS.map((featureKey, index) => [featureKey, features[index]])
      ) as Json,
      normalized_baseline_features: Object.fromEntries(
        BASELINE_FEATURE_KEYS.map((featureKey, index) => [
          featureKey,
          normalizedFeatures[index],
        ])
      ) as Json,
      raw_home_win_probability: rawHomeProbability,
      quality_adjusted_home_win_probability: qualityAdjustedHomeProbability,
      bounded_home_win_probability: homeWinProbability,
      calibration_method: args.calibrator?.method ?? "raw",
      data_quality_multiplier: dataQuality.multiplier,
      data_quality_penalties: dataQuality.penalties,
      probability_floor:
        (args.model as GamePredictionBaselineModel).probabilityFloor ??
        BASELINE_PROBABILITY_FLOOR,
      normalization_method: (args.model as GamePredictionBaselineModel)
        .featureNormalization
        ? "training_set_standard_score"
        : "none",
      excluded_feature_keys: excludedFeatureKeys as unknown as Json,
      winner_decision_threshold: winnerDecisionThreshold,
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
      data_quality_multiplier: dataQuality.multiplier,
      excluded_feature_keys: excludedFeatureKeys as unknown as Json,
      winner_decision_threshold: winnerDecisionThreshold,
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
