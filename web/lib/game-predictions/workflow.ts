import type { SupabaseClient } from "@supabase/supabase-js";

import type { BinaryLogisticModel } from "lib/xg/binaryLogistic";
import type { Database, Json } from "lib/supabase/database-generated.types";
import {
  BASELINE_MODEL_NAME,
  BASELINE_MODEL_VERSION,
  buildGamePredictionHistoryInsert,
  buildGamePredictionOutputUpsert,
  predictGameWithBaselineModel,
  trainGamePredictionBaselineModel,
  type GamePredictionBaselineExample,
} from "./baselineModel";
import {
  buildFeatureSnapshotInsert,
  buildGamePredictionFeatureSnapshotPayload,
  fetchGamePredictionFeatureInputs,
  persistGamePredictionFeatureSnapshot,
  type GameRow,
} from "./featureBuilder";
import { GAME_PREDICTION_FEATURE_SET_VERSION } from "./featureSources";
import {
  attachOutcomesToPredictions,
  buildMetricInserts,
  fetchCompletedGameOutcomes,
  persistMetricInserts,
  type GamePredictionHistoryRow,
} from "./evaluation";
import { upsertGamePredictionSourceProvenanceRows } from "lib/predictions/sourceProvenance";

export const PREGAME_PREDICTION_REFRESH_POLICY = {
  windowsBeforeStartHours: [24, 6, 1],
  allowMultipleSameDayRefreshes: true,
  route: "/api/v1/game-predictions/generate",
  scoringRoute: "/api/v1/game-predictions/score",
} as const;

export const INITIAL_BASELINE_MODEL: BinaryLogisticModel = {
  featureCount: 17,
  weights: [
    0.018,
    0.008,
    0.02,
    0.008,
    0.35,
    0.18,
    0.08,
    0.06,
    0.18,
    0.12,
    0,
    0.2,
    0.08,
    0.04,
    0.04,
    0.02,
    0,
  ],
  bias: 0,
};

export type GeneratePregamePredictionResult = {
  gameId: number;
  featureSnapshotId: string | null;
  predictionId: string | null;
  homeWinProbability: number;
  awayWinProbability: number;
  dryRun: boolean;
};

export type GeneratePredictionWindowResult = {
  fromDate: string;
  toDate: string;
  sourceAsOfDate: string;
  requestedGames: number;
  processedGames: number;
  skippedGames: number;
  stoppedForDeadline: boolean;
  dryRun: boolean;
  results: GeneratePregamePredictionResult[];
};

export type PromotionMetricSummary = {
  logLoss: number | null;
  brierScore: number | null;
  calibrationMaxGap: number | null;
  evaluatedGames: number;
};

export type PromotionDecision = {
  promote: boolean;
  reasons: string[];
};

export type PredictionHealthCheck = {
  status: "pass" | "warn";
  code: string;
  message: string;
};

export async function ensureGamePredictionModelVersion(args: {
  client: SupabaseClient<Database>;
  modelName: string;
  modelVersion: string;
  featureSetVersion: string;
  algorithm: string;
  status?: "candidate" | "production" | "retired" | "rejected";
  trainingRunId?: string | null;
  validationMetrics?: Json;
}): Promise<void> {
  const { error } = await args.client.from("game_prediction_model_versions").upsert(
    {
      model_name: args.modelName,
      model_version: args.modelVersion,
      feature_set_version: args.featureSetVersion,
      algorithm: args.algorithm,
      status: args.status ?? "candidate",
      training_run_id: args.trainingRunId ?? null,
      validation_metrics: args.validationMetrics ?? {},
      git_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? null,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "model_name,model_version,feature_set_version",
    }
  );
  if (error) throw error;
}

export async function generatePregamePredictionForGame(args: {
  client: SupabaseClient<Database>;
  gameId: number;
  predictionCutoffAt?: string;
  sourceAsOfDate?: string;
  model?: BinaryLogisticModel;
  modelName?: string;
  modelVersion?: string;
  runId?: string | null;
  dryRun?: boolean;
}): Promise<GeneratePregamePredictionResult> {
  const model = args.model ?? INITIAL_BASELINE_MODEL;
  const modelName = args.modelName ?? BASELINE_MODEL_NAME;
  const modelVersion = args.modelVersion ?? BASELINE_MODEL_VERSION;
  const predictionCutoffAt = args.predictionCutoffAt ?? new Date().toISOString();
  const inputs = await fetchGamePredictionFeatureInputs(args.client, args.gameId, {
    sourceAsOfDate: args.sourceAsOfDate,
  });
  const payload = buildGamePredictionFeatureSnapshotPayload(inputs);
  const prediction = predictGameWithBaselineModel({
    payload,
    model,
    modelName,
    modelVersion,
    predictionCutoffAt,
  });

  if (args.dryRun) {
    return {
      gameId: args.gameId,
      featureSnapshotId: null,
      predictionId: null,
      homeWinProbability: prediction.homeWinProbability,
      awayWinProbability: prediction.awayWinProbability,
      dryRun: true,
    };
  }

  await ensureGamePredictionModelVersion({
    client: args.client,
    modelName,
    modelVersion,
    featureSetVersion: payload.featureSetVersion,
    algorithm: "regularized_logistic_baseline",
    status: "production",
  });

  const featureSnapshotId = await persistGamePredictionFeatureSnapshot(
    args.client,
    buildFeatureSnapshotInsert({
      payload,
      modelName,
      modelVersion,
      predictionCutoffAt,
    })
  );
  const { data, error } = await args.client
    .from("game_prediction_history")
    .insert(
      buildGamePredictionHistoryInsert({
        prediction,
        featureSnapshotId,
        runId: args.runId,
      })
    )
    .select("prediction_id")
    .single();
  if (error) throw error;

  const { error: latestError } = await args.client
    .from("game_prediction_outputs")
    .upsert(buildGamePredictionOutputUpsert(prediction), {
      onConflict: "snapshot_date,game_id,model_name,model_version,prediction_scope",
    });
  if (latestError) throw latestError;
  await upsertGamePredictionSourceProvenanceRows({
    client: args.client,
    payload,
    prediction,
  });

  return {
    gameId: args.gameId,
    featureSnapshotId,
    predictionId: data.prediction_id,
    homeWinProbability: prediction.homeWinProbability,
    awayWinProbability: prediction.awayWinProbability,
    dryRun: false,
  };
}

export async function generatePregamePredictionsForWindow(args: {
  client: SupabaseClient<Database>;
  fromDate: string;
  toDate: string;
  sourceAsOfDate?: string;
  predictionCutoffAt?: string;
  model?: BinaryLogisticModel;
  modelName?: string;
  modelVersion?: string;
  limit?: number;
  maxRuntimeMs?: number;
  dryRun?: boolean;
}): Promise<GeneratePredictionWindowResult> {
  const limit = Math.min(Math.max(args.limit ?? 16, 1), 64);
  const maxRuntimeMs = Math.min(Math.max(args.maxRuntimeMs ?? 240_000, 1_000), 260_000);
  const deadline = Date.now() + maxRuntimeMs;
  const sourceAsOfDate =
    args.sourceAsOfDate ?? args.predictionCutoffAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const predictionCutoffAt = args.predictionCutoffAt ?? new Date().toISOString();

  const { data, error } = await args.client
    .from("games")
    .select("id,date,startTime,seasonId,homeTeamId,awayTeamId,type")
    .gte("date", args.fromDate)
    .lte("date", args.toDate)
    .order("date", { ascending: true })
    .order("startTime", { ascending: true })
    .limit(limit);
  if (error) throw error;

  const games = ((data ?? []) as GameRow[]).filter(
    (game) => game.type == null || game.type === 2 || game.type === 3,
  );
  const results: GeneratePregamePredictionResult[] = [];
  let stoppedForDeadline = false;

  for (const game of games) {
    if (Date.now() >= deadline) {
      stoppedForDeadline = true;
      break;
    }

    results.push(
      await generatePregamePredictionForGame({
        client: args.client,
        gameId: game.id,
        predictionCutoffAt,
        sourceAsOfDate,
        model: args.model,
        modelName: args.modelName,
        modelVersion: args.modelVersion,
        dryRun: args.dryRun,
      }),
    );
  }

  return {
    fromDate: args.fromDate,
    toDate: args.toDate,
    sourceAsOfDate,
    requestedGames: games.length,
    processedGames: results.length,
    skippedGames: Math.max(0, games.length - results.length),
    stoppedForDeadline,
    dryRun: Boolean(args.dryRun),
    results,
  };
}

export async function scoreGamePredictions(args: {
  client: SupabaseClient<Database>;
  modelName: string;
  modelVersion: string;
  featureSetVersion: string;
  evaluationStartDate: string;
  evaluationEndDate: string;
  runId?: string | null;
  dryRun?: boolean;
}) {
  const { data, error } = await args.client
    .from("game_prediction_history")
    .select(
      "prediction_id,game_id,snapshot_date,model_name,model_version,feature_set_version,home_team_id,away_team_id,home_win_probability,away_win_probability,predicted_winner_team_id,confidence_label,metadata,computed_at"
    )
    .eq("model_name", args.modelName)
    .eq("model_version", args.modelVersion)
    .eq("feature_set_version", args.featureSetVersion)
    .gte("snapshot_date", args.evaluationStartDate)
    .lte("snapshot_date", args.evaluationEndDate);
  if (error) throw error;

  const predictions = (data ?? []) as GamePredictionHistoryRow[];
  const outcomes = await fetchCompletedGameOutcomes(
    args.client,
    Array.from(new Set(predictions.map((prediction) => prediction.game_id)))
  );
  const evaluated = attachOutcomesToPredictions(predictions, outcomes);
  const metricRows = buildMetricInserts({
    evaluated,
    modelName: args.modelName,
    modelVersion: args.modelVersion,
    featureSetVersion: args.featureSetVersion,
    evaluationStartDate: args.evaluationStartDate,
    evaluationEndDate: args.evaluationEndDate,
    runId: args.runId,
  });

  if (!args.dryRun) {
    await ensureGamePredictionModelVersion({
      client: args.client,
      modelName: args.modelName,
      modelVersion: args.modelVersion,
      featureSetVersion: args.featureSetVersion,
      algorithm: "regularized_logistic_baseline",
    });
    await persistMetricInserts(args.client, metricRows);
  }

  return {
    predictions: predictions.length,
    evaluatedGames: evaluated.length,
    metrics: metricRows,
    dryRun: Boolean(args.dryRun),
  };
}

export function buildWalkForwardSplits<T extends { snapshotDate: string }>(
  examples: T[],
  minTrainExamples: number,
  validationWindowExamples: number
): Array<{ train: T[]; validation: T[] }> {
  const sorted = [...examples].sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
  const splits: Array<{ train: T[]; validation: T[] }> = [];

  for (
    let trainEnd = minTrainExamples;
    trainEnd + validationWindowExamples <= sorted.length;
    trainEnd += validationWindowExamples
  ) {
    splits.push({
      train: sorted.slice(0, trainEnd),
      validation: sorted.slice(trainEnd, trainEnd + validationWindowExamples),
    });
  }

  return splits;
}

export function trainCandidateBaselineModel(
  examples: GamePredictionBaselineExample[]
): BinaryLogisticModel {
  return trainGamePredictionBaselineModel(examples, {
    iterations: 1000,
    learningRate: 0.03,
    l2: 0.02,
  });
}

export function decidePromotion(args: {
  current: PromotionMetricSummary;
  candidate: PromotionMetricSummary;
  minEvaluatedGames?: number;
  minLogLossImprovement?: number;
  maxCalibrationGap?: number;
}): PromotionDecision {
  const reasons: string[] = [];
  const minEvaluatedGames = args.minEvaluatedGames ?? 100;
  const minLogLossImprovement = args.minLogLossImprovement ?? 0.002;
  const maxCalibrationGap = args.maxCalibrationGap ?? 0.05;

  if (args.candidate.evaluatedGames < minEvaluatedGames) {
    reasons.push(`Candidate evaluated games below minimum ${minEvaluatedGames}.`);
  }

  if (args.current.logLoss == null || args.candidate.logLoss == null) {
    reasons.push("Current and candidate log loss are required for promotion.");
  } else if (args.current.logLoss - args.candidate.logLoss < minLogLossImprovement) {
    reasons.push(`Candidate log loss improvement is below ${minLogLossImprovement}.`);
  }

  if (
    args.candidate.calibrationMaxGap != null &&
    args.candidate.calibrationMaxGap > maxCalibrationGap
  ) {
    reasons.push(`Candidate calibration gap exceeds ${maxCalibrationGap}.`);
  }

  if (
    args.current.brierScore != null &&
    args.candidate.brierScore != null &&
    args.candidate.brierScore > args.current.brierScore
  ) {
    reasons.push("Candidate Brier score is worse than current production.");
  }

  return {
    promote: reasons.length === 0,
    reasons,
  };
}

export function buildPredictionHealthChecks(args: {
  staleSourceCount: number;
  missingPredictionCount: number;
  failedJobCount: number;
  staleModelAgeDays: number | null;
  recentLogLoss: number | null;
  referenceLogLoss: number | null;
}): PredictionHealthCheck[] {
  const checks: PredictionHealthCheck[] = [];

  if (args.staleSourceCount > 0) {
    checks.push({
      status: "warn",
      code: "stale_sources",
      message: `${args.staleSourceCount} source groups are stale for current prediction generation.`,
    });
  }

  if (args.missingPredictionCount > 0) {
    checks.push({
      status: "warn",
      code: "missing_predictions",
      message: `${args.missingPredictionCount} scheduled games are missing predictions.`,
    });
  }

  if (args.failedJobCount > 0) {
    checks.push({
      status: "warn",
      code: "failed_jobs",
      message: `${args.failedJobCount} prediction jobs failed in the monitored window.`,
    });
  }

  if (args.staleModelAgeDays != null && args.staleModelAgeDays > 14) {
    checks.push({
      status: "warn",
      code: "stale_model",
      message: `Production model is ${args.staleModelAgeDays} days old.`,
    });
  }

  if (
    args.recentLogLoss != null &&
    args.referenceLogLoss != null &&
    args.recentLogLoss - args.referenceLogLoss > 0.02
  ) {
    checks.push({
      status: "warn",
      code: "metric_degradation",
      message: "Recent log loss degraded by more than 0.02 versus reference.",
    });
  }

  if (checks.length === 0) {
    checks.push({
      status: "pass",
      code: "healthy",
      message: "No prediction workflow health warnings detected.",
    });
  }

  return checks;
}
