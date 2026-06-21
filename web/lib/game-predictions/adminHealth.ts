import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "lib/supabase/database-generated.types";
import {
  buildMarketOddsSourceReadiness,
  compactMarketOddsSourceReadinessForMetadata,
  type CompactAccuracyLoopMarketOddsSourceReadiness,
  type MarketOddsSourceAuditRow,
  type SourceProvenanceAuditRow,
} from "./accountability";
import { getGamePredictionFeatureSources } from "./featureSources";
import {
  REQUIRED_PROMOTION_MONITORED_SEGMENT_KEYS,
  buildPredictionHealthChecks,
  type PredictionHealthCheck,
} from "./workflow";

type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

const MONITORED_SEGMENT_KEYS = REQUIRED_PROMOTION_MONITORED_SEGMENT_KEYS;

type MonitoredSegmentKey = (typeof MONITORED_SEGMENT_KEYS)[number];

export const MONITORED_GAME_PREDICTION_JOB_NAMES = [
  "game-predictions-generate",
  "game-predictions-score",
  "game-predictions-ingest-espn-odds",
  "game-predictions-backfill-feature-snapshots",
  "game-predictions-feature-signal-analysis",
  "game-predictions-backtest",
  "game-predictions-backtest-ablation",
  "game-predictions-accuracy-loop",
  "game-predictions-import-market-odds",
  "game-predictions-promote-model-version",
  "game-predictions-forecast",
] as const;

export type GamePredictionSegmentHealthMetric = {
  segmentKey: MonitoredSegmentKey;
  segmentValue: string;
  evaluatedGames: number;
  coveragePctOfOverall: number | null;
  accuracy: number | null;
  logLoss: number | null;
  brierScore: number | null;
  evaluationStartDate: string;
  evaluationEndDate: string;
  computedAt: string;
  matchesLatestOverallWindow: boolean;
};

export type GamePredictionSegmentWindowMismatch = {
  segmentKey: MonitoredSegmentKey;
  segmentValue: string;
  evaluationStartDate: string;
  evaluationEndDate: string;
  expectedEvaluationStartDate: string;
  expectedEvaluationEndDate: string;
  computedAt: string;
};

export type GamePredictionProductionPromotionAudit = {
  promotionStatus: string | null;
  decisionPromote: boolean | null;
  evaluatedGames: number | null;
  validationStartDate: string | null;
  validationEndDate: string | null;
  usesMarketFeatures: boolean | null;
  marketFeatureTrainingEligible: boolean | null;
  marketTrustedSnapshotSourceGames: number | null;
  marketRequiredGames: number | null;
  marketTrustedSnapshotSourceCoveragePct: number | null;
  marketAcceptedSourceNames: string[];
  marketTrustedSnapshotSourceNames: string[];
  marketTrustedImportBatchIds: string[];
  publicExplanationReady: boolean | null;
  explanationBlockers: string[];
  segmentRegressionCount: number;
};

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
    promotionAudit: GamePredictionProductionPromotionAudit;
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
    monitoredJobNames: readonly string[];
    failedJobCount: number;
    failedJobs: Array<{ jobName: string; runTime: string; details: Json | null }>;
  };
  featureQuality: {
    recentSnapshotCount: number;
    missingFeatureRate: number | null;
    goalieWarningCount: number;
  };
  marketOddsReadiness: CompactAccuracyLoopMarketOddsSourceReadiness;
  segmentPerformance: {
    monitoredSegmentKeys: MonitoredSegmentKey[];
    missingSegmentKeys: MonitoredSegmentKey[];
    windowMismatches: GamePredictionSegmentWindowMismatch[];
    segments: GamePredictionSegmentHealthMetric[];
  };
  alerts: PredictionHealthCheck[];
};

type HealthInputs = {
  generatedAt?: string;
  productionModel?: Tables<"game_prediction_model_versions"> | null;
  latestMetric?: Tables<"game_prediction_model_metrics"> | null;
  scheduledGames?: Array<
    Pick<
      Tables<"games">,
      "id" | "date" | "startTime" | "seasonId" | "homeTeamId" | "awayTeamId" | "type"
    >
  >;
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
  segmentMetrics?: Tables<"game_prediction_model_metrics">[];
  marketOddsRows?: MarketOddsSourceAuditRow[];
  marketOddsProvenanceRows?: SourceProvenanceAuditRow[];
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

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];
}

function hasCompleteTrustedMarketSnapshotSourceCoverage(
  audit: GamePredictionProductionPromotionAudit,
): boolean {
  const acceptedSourceNames = new Set(audit.marketAcceptedSourceNames);
  const hasTrustedAcceptedSourceNames =
    audit.marketTrustedSnapshotSourceNames.length > 0 &&
    audit.marketTrustedSnapshotSourceNames.every((sourceName) =>
      acceptedSourceNames.has(sourceName),
    );

  return (
    audit.marketRequiredGames != null &&
    audit.marketRequiredGames > 0 &&
    audit.marketTrustedSnapshotSourceGames != null &&
    audit.marketTrustedSnapshotSourceGames >= audit.marketRequiredGames &&
    audit.marketTrustedSnapshotSourceCoveragePct != null &&
    audit.marketTrustedSnapshotSourceCoveragePct >= 1 &&
    hasTrustedAcceptedSourceNames
  );
}

function promotionAuditForModel(
  model: Tables<"game_prediction_model_versions">,
): GamePredictionProductionPromotionAudit {
  const metadata = isRecord(model.metadata) ? model.metadata : {};
  const sourceAudit = isRecord(model.source_audit_metadata)
    ? model.source_audit_metadata
    : {};
  const decision = isRecord(metadata.promotion_decision)
    ? metadata.promotion_decision
    : {};
  const validationWindow = isRecord(metadata.validation_window)
    ? metadata.validation_window
    : {};
  const validationMetrics = isRecord(model.validation_metrics)
    ? model.validation_metrics
    : {};
  const validationSummary = isRecord(validationMetrics.summary)
    ? validationMetrics.summary
    : {};
  const marketSourceReadiness = isRecord(sourceAudit.market_source_readiness)
    ? sourceAudit.market_source_readiness
    : {};
  const explanationBlockers = Array.isArray(sourceAudit.explanation_blockers)
    ? sourceAudit.explanation_blockers.filter(
        (blocker): blocker is string => typeof blocker === "string",
      )
    : [];

  return {
    promotionStatus:
      typeof metadata.promotion_status === "string"
        ? metadata.promotion_status
        : null,
    decisionPromote:
      typeof decision.promote === "boolean" ? decision.promote : null,
    evaluatedGames:
      toNumber(validationSummary.evaluatedGames) ??
      toNumber(validationWindow.evaluated_games),
    validationStartDate:
      model.validation_start_date ??
      (typeof validationWindow.start_date === "string"
        ? validationWindow.start_date
        : null),
    validationEndDate:
      model.validation_end_date ??
      (typeof validationWindow.end_date === "string"
        ? validationWindow.end_date
        : null),
    usesMarketFeatures:
      typeof sourceAudit.uses_market_features === "boolean"
        ? sourceAudit.uses_market_features
        : null,
    marketFeatureTrainingEligible:
      typeof sourceAudit.market_feature_training_eligible === "boolean"
        ? sourceAudit.market_feature_training_eligible
        : null,
    marketTrustedSnapshotSourceGames:
      toNumber(marketSourceReadiness.trustedSnapshotSourceGames),
    marketRequiredGames: toNumber(marketSourceReadiness.requiredGames),
    marketTrustedSnapshotSourceCoveragePct:
      toNumber(marketSourceReadiness.trustedSnapshotSourceCoveragePct),
    marketAcceptedSourceNames: stringArray(
      marketSourceReadiness.acceptedSourceNames,
    ),
    marketTrustedSnapshotSourceNames: stringArray(
      marketSourceReadiness.trustedSnapshotSourceNames,
    ),
    marketTrustedImportBatchIds: stringArray(
      marketSourceReadiness.trustedImportBatchIds,
    ),
    publicExplanationReady:
      typeof sourceAudit.public_explanation_ready === "boolean"
        ? sourceAudit.public_explanation_ready
        : null,
    explanationBlockers,
    segmentRegressionCount:
      toNumber(sourceAudit.segment_regression_count) ?? 0,
  };
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

function metricHasImpossibleValues(
  metric: Tables<"game_prediction_model_metrics"> | null | undefined,
) {
  if (!metric) return false;
  const probabilityMetrics = [metric.accuracy, metric.brier_score, metric.auc];
  return (
    probabilityMetrics.some((value) => value != null && (value < 0 || value > 1)) ||
    (metric.log_loss != null && metric.log_loss < 0)
  );
}

function isMonitoredSegmentKey(value: string): value is MonitoredSegmentKey {
  return MONITORED_SEGMENT_KEYS.includes(value as MonitoredSegmentKey);
}

function latestSegmentMetricsByBucket(
  metrics: Tables<"game_prediction_model_metrics">[] = [],
): Tables<"game_prediction_model_metrics">[] {
  const latest = new Map<string, Tables<"game_prediction_model_metrics">>();
  for (const metric of [...metrics].sort((a, b) =>
    b.computed_at.localeCompare(a.computed_at),
  )) {
    if (!isMonitoredSegmentKey(metric.segment_key)) continue;
    const key = `${metric.segment_key}|${metric.segment_value}`;
    if (!latest.has(key)) latest.set(key, metric);
  }
  return [...latest.values()];
}

function buildSegmentPerformance(args: {
  latestMetric?: Tables<"game_prediction_model_metrics"> | null;
  segmentMetrics?: Tables<"game_prediction_model_metrics">[];
}): GamePredictionHealthReport["segmentPerformance"] {
  const latestSegmentMetrics = latestSegmentMetricsByBucket(args.segmentMetrics);
  const overallGames = args.latestMetric?.evaluated_games ?? null;
  const expectedEvaluationStartDate =
    args.latestMetric?.evaluation_start_date ?? null;
  const expectedEvaluationEndDate =
    args.latestMetric?.evaluation_end_date ?? null;
  const segments = latestSegmentMetrics.map((metric) => ({
    segmentKey: metric.segment_key as MonitoredSegmentKey,
    segmentValue: metric.segment_value,
    evaluatedGames: metric.evaluated_games,
    coveragePctOfOverall:
      overallGames && overallGames > 0
        ? metric.evaluated_games / overallGames
        : null,
    accuracy: metric.accuracy,
    logLoss: metric.log_loss,
    brierScore: metric.brier_score,
    evaluationStartDate: metric.evaluation_start_date,
    evaluationEndDate: metric.evaluation_end_date,
    computedAt: metric.computed_at,
    matchesLatestOverallWindow:
      !expectedEvaluationStartDate ||
      !expectedEvaluationEndDate ||
      (
        metric.evaluation_start_date === expectedEvaluationStartDate &&
        metric.evaluation_end_date === expectedEvaluationEndDate
      ),
  }));
  const observedKeys = new Set(
    segments
      .filter((segment) => segment.matchesLatestOverallWindow)
      .map((segment) => segment.segmentKey),
  );
  const windowMismatches =
    expectedEvaluationStartDate && expectedEvaluationEndDate
      ? segments
          .filter((segment) => !segment.matchesLatestOverallWindow)
          .map((segment) => ({
            segmentKey: segment.segmentKey,
            segmentValue: segment.segmentValue,
            evaluationStartDate: segment.evaluationStartDate,
            evaluationEndDate: segment.evaluationEndDate,
            expectedEvaluationStartDate,
            expectedEvaluationEndDate,
            computedAt: segment.computedAt,
          }))
      : [];

  return {
    monitoredSegmentKeys: [...MONITORED_SEGMENT_KEYS],
    missingSegmentKeys: MONITORED_SEGMENT_KEYS.filter(
      (segmentKey) => !observedKeys.has(segmentKey),
    ),
    windowMismatches,
    segments,
  };
}

function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
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
    ? dateDiffDays(
        generatedAt,
        productionModel.promoted_at ??
          productionModel.trained_at ??
          productionModel.updated_at,
      )
    : null;
  const promotionAudit = productionModel
    ? promotionAuditForModel(productionModel)
    : null;
  const segmentPerformance = buildSegmentPerformance({
    latestMetric,
    segmentMetrics: inputs.segmentMetrics,
  });
  const marketOddsReadiness = compactMarketOddsSourceReadinessForMetadata(
    buildMarketOddsSourceReadiness({
      games: inputs.scheduledGames ?? [],
      oddsRows: inputs.marketOddsRows ?? [],
      provenanceRows: inputs.marketOddsProvenanceRows ?? [],
    }),
  );

  const alerts = buildPredictionHealthChecks({
    staleSourceCount: staleSources.length,
    missingPredictionCount: missingGameIds.length,
    failedJobCount: inputs.failedJobs?.length ?? 0,
    staleModelAgeDays: modelAgeDays,
    recentLogLoss: latestMetric?.log_loss ?? null,
    referenceLogLoss: null,
  });

  if (!productionModel) {
    alerts.push({
      status: "warn",
      code: "production_model_missing",
      message: "No production game-prediction model version is active.",
    });
  }

  if (productionModel && !latestMetric) {
    alerts.push({
      status: "warn",
      code: "production_metric_missing",
      message:
        "Production game-prediction model is missing persisted overall evaluation metrics.",
    });
  }

  if (
    marketOddsReadiness.requiredGames > 0 &&
    marketOddsReadiness.trainingFeatureEligible !== true
  ) {
    alerts.push({
      status: "warn",
      code: "market_odds_source_readiness_incomplete",
      message: `Market odds source readiness is incomplete for ${marketOddsReadiness.trustedSnapshotSourceGames}/${marketOddsReadiness.requiredGames} required games with trusted pre-cutoff snapshot provenance.`,
    });
  }

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

  if (
    latestMetric?.evaluated_games &&
    latestMetric.evaluated_games > 0 &&
    segmentPerformance.missingSegmentKeys.length > 0
  ) {
    alerts.push({
      status: "warn",
      code: "segment_monitoring_incomplete",
      message: `Missing monitored segment metrics for ${segmentPerformance.missingSegmentKeys.join(", ")}.`,
    });
  }
  if (segmentPerformance.windowMismatches.length > 0) {
    alerts.push({
      status: "warn",
      code: "segment_monitoring_window_mismatch",
      message:
        "Some monitored segment metrics do not match the latest overall evaluation window.",
    });
  }

  if (
    promotionAudit &&
    (
      promotionAudit.promotionStatus !== "eligible_for_manual_promotion" ||
      promotionAudit.decisionPromote !== true ||
      !promotionAudit.validationStartDate ||
      !promotionAudit.validationEndDate ||
      promotionAudit.evaluatedGames == null ||
      promotionAudit.publicExplanationReady !== true ||
      promotionAudit.explanationBlockers.length > 0 ||
      promotionAudit.segmentRegressionCount > 0 ||
      (
        promotionAudit.usesMarketFeatures === true &&
        promotionAudit.marketFeatureTrainingEligible !== true
      ) ||
      (
        promotionAudit.usesMarketFeatures === true &&
        !hasCompleteTrustedMarketSnapshotSourceCoverage(promotionAudit)
      )
    )
  ) {
    alerts.push({
      status: "warn",
      code: "production_promotion_evidence_incomplete",
      message:
        "Production game-prediction model is missing eligible persisted promotion evidence or required guardrail metadata.",
    });
  }

  const finalAlerts = alerts.some((alert) => alert.status === "warn")
    ? alerts.filter((alert) => alert.status === "warn")
    : alerts;

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
          promotionAudit: promotionAuditForModel(productionModel),
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
      monitoredJobNames: MONITORED_GAME_PREDICTION_JOB_NAMES,
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
    marketOddsReadiness,
    segmentPerformance,
    alerts: finalAlerts,
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

  const modelResult = await args.client
    .from("game_prediction_model_versions")
    .select("*")
    .eq("status", "production")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (modelResult.error) throw modelResult.error;
  const productionModel = modelResult.data;
  const overallMetricQuery = productionModel
    ? args.client
        .from("game_prediction_model_metrics")
        .select("*")
        .eq("model_name", productionModel.model_name)
        .eq("model_version", productionModel.model_version)
        .eq("feature_set_version", productionModel.feature_set_version)
        .eq("segment_key", "overall")
        .eq("segment_value", "all")
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });
  const segmentMetricsQuery = productionModel
    ? args.client
        .from("game_prediction_model_metrics")
        .select("*")
        .eq("model_name", productionModel.model_name)
        .eq("model_version", productionModel.model_version)
        .eq("feature_set_version", productionModel.feature_set_version)
        .in("segment_key", [...MONITORED_SEGMENT_KEYS])
        .order("computed_at", { ascending: false })
        .limit(200)
    : Promise.resolve({ data: [], error: null });

  const [
    metricResult,
    segmentMetricsResult,
    gamesResult,
    outputsResult,
    provenanceResult,
    jobsResult,
    snapshotsResult,
  ] = await Promise.all([
    overallMetricQuery,
    segmentMetricsQuery,
    args.client
      .from("games")
      .select("id,date,startTime,seasonId,homeTeamId,awayTeamId,type")
      .gte("date", fromDate)
      .lte("date", toDate),
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
      .in("job_name", [...MONITORED_GAME_PREDICTION_JOB_NAMES])
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
    metricResult,
    segmentMetricsResult,
    gamesResult,
    outputsResult,
    provenanceResult,
    jobsResult,
    snapshotsResult,
  ]) {
    if (result.error) throw result.error;
  }

  const scheduledGames = gamesResult.data ?? [];
  const gameIds = scheduledGames.map((game) => game.id);
  let marketOddsRows: MarketOddsSourceAuditRow[] = [];
  let marketOddsProvenanceRows: SourceProvenanceAuditRow[] = [];
  if (gameIds.length > 0) {
    const gameIdChunks = chunkValues(gameIds, 250);
    const [marketOddsResults, marketOddsProvenanceResults] = await Promise.all([
      Promise.all(
        gameIdChunks.map((chunk) =>
          args.client
            .from("game_prediction_market_odds_snapshots")
            .select("game_id,captured_at,event_start_at,provider,provenance,metadata")
            .in("game_id", chunk)
            .limit(10_000),
        ),
      ),
      Promise.all(
        gameIdChunks.map((chunk) =>
          args.client
            .from("source_provenance_snapshots")
            .select(
              "game_id,source_type,source_name,status,observed_at,freshness_expires_at,metadata",
            )
            .eq("source_type", "game_prediction_market_odds")
            .in("game_id", chunk)
            .limit(10_000),
        ),
      ),
    ]);

    for (const result of marketOddsResults) {
      if (result.error) throw result.error;
      marketOddsRows.push(...((result.data ?? []) as MarketOddsSourceAuditRow[]));
    }
    for (const result of marketOddsProvenanceResults) {
      if (result.error) throw result.error;
      marketOddsProvenanceRows.push(
        ...((result.data ?? []) as SourceProvenanceAuditRow[]),
      );
    }
  }

  return buildGamePredictionHealthReport({
    generatedAt,
    productionModel,
    latestMetric: metricResult.data,
    segmentMetrics: segmentMetricsResult.data ?? [],
    scheduledGames,
    predictionOutputs: outputsResult.data ?? [],
    provenanceRows: provenanceResult.data ?? [],
    failedJobs: jobsResult.data ?? [],
    featureSnapshots: snapshotsResult.data ?? [],
    marketOddsRows,
    marketOddsProvenanceRows,
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
