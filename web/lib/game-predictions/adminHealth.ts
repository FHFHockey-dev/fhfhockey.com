import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "lib/supabase/database-generated.types";
import { getGamePredictionFeatureSources } from "./featureSources";
import { buildPredictionHealthChecks, type PredictionHealthCheck } from "./workflow";

type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type GamePredictionHealthReport = {
  generatedAt: string;
  productionModel: {
    modelName: string;
    modelVersion: string;
    featureSetVersion: string;
    status: string;
    trainedAt: string | null;
    promotedAt: string | null;
    updatedAt: string;
    ageDays: number | null;
  } | null;
  latestMetric: {
    evaluatedGames: number;
    accuracy: number | null;
    logLoss: number | null;
    brierScore: number | null;
    evaluationStartDate: string;
    evaluationEndDate: string;
    computedAt: string;
  } | null;
  predictionCoverage: {
    scheduledGames: number;
    predictedGames: number;
    missingPredictionCount: number;
    missingGameIds: number[];
  };
  dataFreshness: {
    auditedSources: number;
    staleSourceCount: number;
    nullExpiryCount: number;
    staleSources: Array<{
      sourceName: string;
      sourceType: string;
      status: string;
      freshnessExpiresAt: string | null;
      observedAt: string;
    }>;
  };
  sourceAuditStatuses: Array<{
    id: string;
    tables: string[];
    use: string;
    goNoGo: string;
    fallback: string;
  }>;
  jobs: {
    failedJobCount: number;
    failedJobs: Array<{ jobName: string; runTime: string; details: Json | null }>;
  };
  featureQuality: {
    recentSnapshotCount: number;
    missingFeatureRate: number | null;
    goalieWarningCount: number;
  };
  alerts: PredictionHealthCheck[];
};

type HealthInputs = {
  generatedAt?: string;
  productionModel?: Tables<"game_prediction_model_versions"> | null;
  latestMetric?: Tables<"game_prediction_model_metrics"> | null;
  scheduledGames?: Array<Pick<Tables<"games">, "id">>;
  predictionOutputs?: Array<Pick<Tables<"game_prediction_outputs">, "game_id">>;
  provenanceRows?: Array<
    Pick<
      Tables<"source_provenance_snapshots">,
      "source_name" | "source_type" | "status" | "freshness_expires_at" | "observed_at"
    >
  >;
  failedJobs?: Array<Pick<Tables<"cron_job_audit">, "job_name" | "run_time" | "details">>;
  featureSnapshots?: Array<
    Pick<Tables<"game_prediction_feature_snapshots">, "missing_features" | "feature_payload">
  >;
};

function dateDiffDays(laterIso: string, earlierIso: string | null): number | null {
  if (!earlierIso) return null;
  const later = Date.parse(laterIso);
  const earlier = Date.parse(earlierIso);
  if (!Number.isFinite(later) || !Number.isFinite(earlier)) return null;
  return Math.floor((later - earlier) / 86_400_000);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonArrayLength(value: Json): number {
  return Array.isArray(value) ? value.length : 0;
}

function collectGoalieWarningCount(snapshots: HealthInputs["featureSnapshots"] = []): number {
  return snapshots.reduce((count, snapshot) => {
    if (!isRecord(snapshot.feature_payload)) return count;
    const warnings = snapshot.feature_payload.warnings;
    if (!Array.isArray(warnings)) return count;
    return (
      count +
      warnings.filter((warning) => {
        if (!isRecord(warning)) return false;
        const code = String(warning.code ?? "");
        const message = String(warning.message ?? "");
        return /goalie|starter|probability/i.test(`${code} ${message}`);
      }).length
    );
  }, 0);
}

function metricHasImpossibleValues(metric: Tables<"game_prediction_model_metrics"> | null | undefined) {
  if (!metric) return false;
  const probabilityMetrics = [metric.accuracy, metric.brier_score, metric.auc];
  return (
    probabilityMetrics.some((value) => value != null && (value < 0 || value > 1)) ||
    (metric.log_loss != null && metric.log_loss < 0)
  );
}

export function buildGamePredictionHealthReport(
  inputs: HealthInputs
): GamePredictionHealthReport {
  const generatedAt = inputs.generatedAt ?? new Date().toISOString();
  const productionModel = inputs.productionModel ?? null;
  const latestMetric = inputs.latestMetric ?? null;
  const scheduledGameIds = new Set((inputs.scheduledGames ?? []).map((game) => game.id));
  const predictedGameIds = new Set((inputs.predictionOutputs ?? []).map((row) => row.game_id));
  const missingGameIds = [...scheduledGameIds].filter((gameId) => !predictedGameIds.has(gameId));
  const staleSources = (inputs.provenanceRows ?? []).filter((row) => {
    if (row.status === "stale") return true;
    if (!row.freshness_expires_at) return true;
    return row.freshness_expires_at < generatedAt;
  });
  const nullExpiryCount = (inputs.provenanceRows ?? []).filter(
    (row) => !row.freshness_expires_at
  ).length;
  const recentSnapshotCount = inputs.featureSnapshots?.length ?? 0;
  const snapshotsWithMissingFeatures = (inputs.featureSnapshots ?? []).filter(
    (snapshot) => jsonArrayLength(snapshot.missing_features) > 0
  ).length;
  const missingFeatureRate =
    recentSnapshotCount === 0 ? null : snapshotsWithMissingFeatures / recentSnapshotCount;
  const modelAgeDays = productionModel
    ? dateDiffDays(generatedAt, productionModel.promoted_at ?? productionModel.trained_at ?? productionModel.updated_at)
    : null;

  const alerts = buildPredictionHealthChecks({
    staleSourceCount: staleSources.length,
    missingPredictionCount: missingGameIds.length,
    failedJobCount: inputs.failedJobs?.length ?? 0,
    staleModelAgeDays: modelAgeDays,
    recentLogLoss: latestMetric?.log_loss ?? null,
    referenceLogLoss: null,
  });

  if (metricHasImpossibleValues(latestMetric)) {
    alerts.push({
      status: "warn",
      code: "impossible_metric_values",
      message: "Latest game-prediction metrics include values outside valid bounds.",
    });
  }

  const goalieWarningCount = collectGoalieWarningCount(inputs.featureSnapshots);
  if (goalieWarningCount > 0) {
    alerts.push({
      status: "warn",
      code: "goalie_probability_anomalies",
      message: `${goalieWarningCount} recent feature snapshots include goalie or starter probability warnings.`,
    });
  }

  return {
    generatedAt,
    productionModel: productionModel
      ? {
          modelName: productionModel.model_name,
          modelVersion: productionModel.model_version,
          featureSetVersion: productionModel.feature_set_version,
          status: productionModel.status,
          trainedAt: productionModel.trained_at,
          promotedAt: productionModel.promoted_at,
          updatedAt: productionModel.updated_at,
          ageDays: modelAgeDays,
        }
      : null,
    latestMetric: latestMetric
      ? {
          evaluatedGames: latestMetric.evaluated_games,
          accuracy: latestMetric.accuracy,
          logLoss: latestMetric.log_loss,
          brierScore: latestMetric.brier_score,
          evaluationStartDate: latestMetric.evaluation_start_date,
          evaluationEndDate: latestMetric.evaluation_end_date,
          computedAt: latestMetric.computed_at,
        }
      : null,
    predictionCoverage: {
      scheduledGames: scheduledGameIds.size,
      predictedGames: predictedGameIds.size,
      missingPredictionCount: missingGameIds.length,
      missingGameIds,
    },
    dataFreshness: {
      auditedSources: inputs.provenanceRows?.length ?? 0,
      staleSourceCount: staleSources.length,
      nullExpiryCount,
      staleSources: staleSources.map((row) => ({
        sourceName: row.source_name,
        sourceType: row.source_type,
        status: row.status,
        freshnessExpiresAt: row.freshness_expires_at,
        observedAt: row.observed_at,
      })),
    },
    sourceAuditStatuses: getGamePredictionFeatureSources().map((source) => ({
      id: source.id,
      tables: source.tables,
      use: source.use,
      goNoGo: source.goNoGo,
      fallback: source.fallback,
    })),
    jobs: {
      failedJobCount: inputs.failedJobs?.length ?? 0,
      failedJobs: (inputs.failedJobs ?? []).map((job) => ({
        jobName: job.job_name,
        runTime: job.run_time,
        details: job.details,
      })),
    },
    featureQuality: {
      recentSnapshotCount,
      missingFeatureRate,
      goalieWarningCount,
    },
    alerts,
  };
}

function addDays(date: Date, days: number): string {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy.toISOString().slice(0, 10);
}

export async function fetchGamePredictionHealthReport(args: {
  client: SupabaseClient<Database>;
  fromDate?: string;
  toDate?: string;
}) {
  const now = new Date();
  const generatedAt = now.toISOString();
  const fromDate = args.fromDate ?? generatedAt.slice(0, 10);
  const toDate = args.toDate ?? addDays(now, 7);
  const failedSince = addDays(now, -7);

  const [
    modelResult,
    metricResult,
    gamesResult,
    outputsResult,
    provenanceResult,
    jobsResult,
    snapshotsResult,
  ] = await Promise.all([
    args.client
      .from("game_prediction_model_versions")
      .select("*")
      .eq("status", "production")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    args.client
      .from("game_prediction_model_metrics")
      .select("*")
      .eq("segment_key", "overall")
      .eq("segment_value", "all")
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    args.client.from("games").select("id").gte("date", fromDate).lte("date", toDate),
    args.client
      .from("game_prediction_outputs")
      .select("game_id")
      .gte("snapshot_date", fromDate)
      .lte("snapshot_date", toDate),
    args.client
      .from("source_provenance_snapshots")
      .select("source_name,source_type,status,freshness_expires_at,observed_at")
      .order("updated_at", { ascending: false })
      .limit(200),
    args.client
      .from("cron_job_audit")
      .select("job_name,run_time,details")
      .in("job_name", ["game-predictions-generate", "game-predictions-score"])
      .eq("status", "failure")
      .gte("run_time", failedSince)
      .order("run_time", { ascending: false })
      .limit(25),
    args.client
      .from("game_prediction_feature_snapshots")
      .select("missing_features,feature_payload")
      .order("computed_at", { ascending: false })
      .limit(100),
  ]);

  for (const result of [
    modelResult,
    metricResult,
    gamesResult,
    outputsResult,
    provenanceResult,
    jobsResult,
    snapshotsResult,
  ]) {
    if (result.error) throw result.error;
  }

  return buildGamePredictionHealthReport({
    generatedAt,
    productionModel: modelResult.data,
    latestMetric: metricResult.data,
    scheduledGames: gamesResult.data ?? [],
    predictionOutputs: outputsResult.data ?? [],
    provenanceRows: provenanceResult.data ?? [],
    failedJobs: jobsResult.data ?? [],
    featureSnapshots: snapshotsResult.data ?? [],
  });
}

export async function fetchGamePredictionDebugDetail(args: {
  client: SupabaseClient<Database>;
  predictionId: string;
}) {
  const { data: prediction, error } = await args.client
    .from("game_prediction_history")
    .select("*")
    .eq("prediction_id", args.predictionId)
    .maybeSingle();
  if (error) throw error;
  if (!prediction) return null;

  const [snapshotResult, outputResult] = await Promise.all([
    args.client
      .from("game_prediction_feature_snapshots")
      .select("*")
      .eq("feature_snapshot_id", prediction.feature_snapshot_id)
      .maybeSingle(),
    args.client
      .from("game_prediction_outputs")
      .select("*")
      .eq("game_id", prediction.game_id)
      .eq("model_name", prediction.model_name)
      .eq("model_version", prediction.model_version)
      .eq("prediction_scope", prediction.prediction_scope)
      .maybeSingle(),
  ]);

  if (snapshotResult.error) throw snapshotResult.error;
  if (outputResult.error) throw outputResult.error;

  return {
    prediction,
    featureSnapshot: snapshotResult.data,
    latestServingRow: outputResult.data,
    sourceAuditStatuses: getGamePredictionFeatureSources(),
  };
}
