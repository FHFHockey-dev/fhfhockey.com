import type { SupabaseClient } from "@supabase/supabase-js";

import type { BinaryLogisticModel } from "lib/xg/binaryLogistic";
import type { Database, Json } from "lib/supabase/database-generated.types";
import {
  BASELINE_MODEL_NAME,
  BASELINE_MODEL_VERSION,
  BASELINE_FEATURE_KEYS,
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

export const REQUIRED_PROMOTION_MONITORED_SEGMENT_KEYS = [
  "season_phase",
  "goalie_confirmation_state",
  "has_stale_source",
  "market_edge_bucket",
] as const;

export const INITIAL_BASELINE_MODEL: BinaryLogisticModel = {
  featureCount: BASELINE_FEATURE_KEYS.length,
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
    ...Array(Math.max(0, BASELINE_FEATURE_KEYS.length - 17)).fill(0),
  ],
  bias: 0,
};

export type GeneratePregamePredictionResult = {
  gameId: number;
  featureSnapshotId: string | null;
  predictionId: string | null;
  homeWinProbability: number | null;
  awayWinProbability: number | null;
  skippedReason: string | null;
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

export type BackfillFeatureSnapshotResult = {
  gameId: number;
  gameDate: string;
  predictionCutoffAt: string;
  sourceAsOfDate: string;
  featureSnapshotId: string | null;
  warningCount: number;
  missingFeatureCount: number;
  marketOddsAvailable: boolean;
  skippedReason: string | null;
  dryRun: boolean;
};

export type BackfillFeatureSnapshotWindowResult = {
  fromDate: string;
  toDate: string;
  requestedGames: number;
  processedGames: number;
  skippedGames: number;
  failedGames: number;
  stoppedForDeadline: boolean;
  dryRun: boolean;
  results: BackfillFeatureSnapshotResult[];
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

type GamePredictionModelVersionRow =
  Database["public"]["Tables"]["game_prediction_model_versions"]["Row"];

type GamePredictionModelMetricRow =
  Database["public"]["Tables"]["game_prediction_model_metrics"]["Row"];

type PromotionGateModelVersionRow = Pick<
  GamePredictionModelVersionRow,
  | "feature_set_version"
  | "metadata"
  | "model_name"
  | "model_version"
  | "source_audit_metadata"
  | "status"
  | "validation_end_date"
  | "validation_metrics"
  | "validation_start_date"
>;

type PromotionOverallMetricRow = Pick<
  GamePredictionModelMetricRow,
  | "accuracy"
  | "brier_score"
  | "evaluated_games"
  | "evaluation_end_date"
  | "evaluation_start_date"
  | "log_loss"
  | "segment_key"
  | "segment_value"
>;

export type PromoteGamePredictionModelVersionResult = {
  promoted: boolean;
  reasons: string[];
  modelName: string;
  modelVersion: string;
  featureSetVersion: string;
  promotedAt: string | null;
  retiredProductionRows: number;
};

export type PreviewGamePredictionModelVersionPromotionResult = {
  wouldPromote: boolean;
  reasons: string[];
  modelName: string;
  modelVersion: string;
  featureSetVersion: string;
  persistedEvidenceChecked: boolean;
};

type PromotionGateEvidence = {
  modelVersion: PromotionGateModelVersionRow | null;
  persistedOverallMetric: PromotionOverallMetricRow | null;
  persistedMonitoredSegmentKeys: string[];
  decision: PromotionDecision;
};

type ServingModelVersionPersistenceAction =
  | "bootstrap_current_compiled_baseline"
  | "use_existing_production";

export function canBootstrapCurrentCompiledBaseline(args: {
  modelName: string;
  modelVersion: string;
  featureSetVersion: string;
}): boolean {
  return (
    args.modelName === BASELINE_MODEL_NAME &&
    args.modelVersion === BASELINE_MODEL_VERSION &&
    args.featureSetVersion === GAME_PREDICTION_FEATURE_SET_VERSION
  );
}

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

export async function ensureGamePredictionModelVersionForScoring(args: {
  client: SupabaseClient<Database>;
  modelName: string;
  modelVersion: string;
  featureSetVersion: string;
}): Promise<"existing" | "created_candidate"> {
  const { data, error } = await args.client
    .from("game_prediction_model_versions")
    .select("status")
    .eq("model_name", args.modelName)
    .eq("model_version", args.modelVersion)
    .eq("feature_set_version", args.featureSetVersion)
    .maybeSingle();
  if (error) throw error;
  if (data) return "existing";

  await ensureGamePredictionModelVersion({
    ...args,
    algorithm: "regularized_logistic_baseline",
    status: "candidate",
  });
  return "created_candidate";
}

export function servingModelVersionPersistenceAction(args: {
  modelName: string;
  modelVersion: string;
  featureSetVersion: string;
  existingStatus?: string | null;
  allowBaselineBootstrap?: boolean;
}): ServingModelVersionPersistenceAction {
  if (args.allowBaselineBootstrap && canBootstrapCurrentCompiledBaseline(args)) {
    return "bootstrap_current_compiled_baseline";
  }

  if (args.existingStatus === "production") {
    return "use_existing_production";
  }

  throw new Error(
    [
      "Refusing to persist serving game prediction for non-production model version",
      `${args.modelName}/${args.modelVersion}/${args.featureSetVersion}.`,
      "Promote the model version before serving predictions.",
    ].join(" "),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function toFiniteNumber(value: unknown): number | null {
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

function evaluatedGamesForModelVersion(
  row: Pick<GamePredictionModelVersionRow, "metadata" | "validation_metrics">,
): number {
  const validationMetrics = asRecord(row.validation_metrics);
  const validationSummary = asRecord(validationMetrics.summary);
  const metadata = asRecord(row.metadata);
  const validationWindow = asRecord(metadata.validation_window);
  return (
    toFiniteNumber(validationSummary.evaluatedGames) ??
    toFiniteNumber(validationWindow.evaluated_games) ??
    0
  );
}

function hasPromotionMetricEvidence(value: unknown): boolean {
  const metric = asRecord(value);
  return (
    toFiniteNumber(metric.logLoss) != null &&
    toFiniteNumber(metric.brierScore) != null &&
    toFiniteNumber(metric.evaluatedGames) != null
  );
}

function promotionEvidenceMetadataGateReasons(args: {
  metadata: Record<string, unknown>;
  validationStartDate: string | null;
  validationEndDate: string | null;
  evaluatedGames: number;
}): string[] {
  const reasons: string[] = [];
  const validationWindow = asRecord(args.metadata.validation_window);
  const promotionEvidence = asRecord(args.metadata.promotion_evidence);

  if (
    validationWindow.start_date !== args.validationStartDate ||
    validationWindow.end_date !== args.validationEndDate ||
    toFiniteNumber(validationWindow.evaluated_games) !== args.evaluatedGames
  ) {
    reasons.push(
      "Promotion evidence metadata must include a validation window matching the model version.",
    );
  }

  if (Object.keys(promotionEvidence).length === 0) {
    reasons.push("Promotion evidence metadata is required before promotion.");
  } else {
    if (
      !hasPromotionMetricEvidence(promotionEvidence.current) ||
      !hasPromotionMetricEvidence(promotionEvidence.candidate)
    ) {
      reasons.push(
        "Promotion evidence metadata must include current and candidate probability metrics.",
      );
    }
    if (
      !isRecord(promotionEvidence.simpleBaselineFloor) &&
      !isRecord(args.metadata.baseline_floor)
    ) {
      reasons.push(
        "Promotion evidence metadata must include strongest simple-baseline comparison metadata.",
      );
    }
  }

  if (!Array.isArray(args.metadata.excluded_feature_keys)) {
    reasons.push(
      "Promotion evidence metadata must include excluded feature keys.",
    );
  }

  return reasons;
}

function hasCompleteTrustedMarketSnapshotSourceCoverage(
  sourceAudit: Record<string, unknown>,
): boolean {
  const readiness = asRecord(sourceAudit.market_source_readiness);
  const requiredGames = toFiniteNumber(readiness.requiredGames);
  const trustedSnapshotSourceGames = toFiniteNumber(
    readiness.trustedSnapshotSourceGames,
  );
  const trustedSnapshotSourceCoveragePct = toFiniteNumber(
    readiness.trustedSnapshotSourceCoveragePct,
  );
  const acceptedSourceNames = stringArray(readiness.acceptedSourceNames);
  const trustedSnapshotSourceNames = stringArray(
    readiness.trustedSnapshotSourceNames,
  );
  const hasTrustedAcceptedSourceNames =
    trustedSnapshotSourceNames.length > 0 &&
    trustedSnapshotSourceNames.every((sourceName) =>
      acceptedSourceNames.includes(sourceName),
    );

  return (
    requiredGames != null &&
    requiredGames > 0 &&
    trustedSnapshotSourceGames != null &&
    trustedSnapshotSourceGames >= requiredGames &&
    trustedSnapshotSourceCoveragePct != null &&
    trustedSnapshotSourceCoveragePct >= 1 &&
    hasTrustedAcceptedSourceNames
  );
}

export function evaluatePersistedModelVersionPromotionGate(args: {
  modelVersion: Pick<
    GamePredictionModelVersionRow,
    | "metadata"
    | "source_audit_metadata"
    | "status"
    | "validation_end_date"
    | "validation_metrics"
      | "validation_start_date"
  >;
  persistedOverallMetric?: PromotionOverallMetricRow | null;
  persistedMonitoredSegmentKeys?: readonly string[];
  minEvaluatedGames?: number;
}): PromotionDecision {
  const row = args.modelVersion;
  const minEvaluatedGames = args.minEvaluatedGames ?? 100;
  const reasons: string[] = [];
  const metadata = asRecord(row.metadata);
  const promotionDecision = asRecord(metadata.promotion_decision);
  const sourceAudit = asRecord(row.source_audit_metadata);
  const explanationBlockers = Array.isArray(sourceAudit.explanation_blockers)
    ? sourceAudit.explanation_blockers
    : [];
  const segmentRegressionCount =
    toFiniteNumber(sourceAudit.segment_regression_count) ?? 0;
  const evaluatedGames = evaluatedGamesForModelVersion(row);
  const persistedOverallMetric = args.persistedOverallMetric ?? null;
  const persistedMonitoredSegmentKeys = new Set(
    args.persistedMonitoredSegmentKeys ?? [],
  );

  if (row.status !== "candidate") {
    reasons.push("Only candidate model versions can be promoted manually.");
  }

  if (metadata.promotion_status !== "eligible_for_manual_promotion") {
    reasons.push("Persisted promotion evidence is not eligible for promotion.");
  }

  if (promotionDecision.promote !== true) {
    reasons.push("Persisted promotion decision does not approve promotion.");
  }

  reasons.push(
    ...promotionEvidenceMetadataGateReasons({
      metadata,
      validationStartDate: row.validation_start_date,
      validationEndDate: row.validation_end_date,
      evaluatedGames,
    }),
  );

  if (!row.validation_start_date || !row.validation_end_date) {
    reasons.push("Validation date range is required before promotion.");
  }

  if (evaluatedGames < minEvaluatedGames) {
    reasons.push(`Candidate evaluated games below minimum ${minEvaluatedGames}.`);
  }

  if (!persistedOverallMetric) {
    reasons.push("Persisted overall model metric row is required before promotion.");
  } else {
    if (
      persistedOverallMetric.segment_key !== "overall" ||
      persistedOverallMetric.segment_value !== "all"
    ) {
      reasons.push("Persisted promotion metric row must be the overall/all segment.");
    }
    if (
      row.validation_start_date &&
      row.validation_end_date &&
      (
        persistedOverallMetric.evaluation_start_date !== row.validation_start_date ||
        persistedOverallMetric.evaluation_end_date !== row.validation_end_date
      )
    ) {
      reasons.push("Persisted overall metric window must match validation window.");
    }
    if (persistedOverallMetric.evaluated_games !== evaluatedGames) {
      reasons.push(
        "Persisted overall metric row does not match promotion evaluated-game count.",
      );
    }
    if (
      persistedOverallMetric.log_loss == null ||
      persistedOverallMetric.brier_score == null
    ) {
      reasons.push("Persisted overall metric row must include log loss and Brier score.");
    }
  }

  const missingMonitoredSegmentKeys =
    REQUIRED_PROMOTION_MONITORED_SEGMENT_KEYS.filter(
      (segmentKey) => !persistedMonitoredSegmentKeys.has(segmentKey),
    );
  if (missingMonitoredSegmentKeys.length > 0) {
    reasons.push(
      `Persisted monitored segment metric rows are required before promotion: ${missingMonitoredSegmentKeys.join(", ")}.`,
    );
  }

  if (
    sourceAudit.uses_market_features === true &&
    sourceAudit.market_feature_training_eligible !== true
  ) {
    reasons.push(
      "Market features require historical odds snapshots captured before prediction cutoff and puck drop.",
    );
  }

  if (
    sourceAudit.uses_market_features === true &&
    !hasCompleteTrustedMarketSnapshotSourceCoverage(sourceAudit)
  ) {
    reasons.push(
      "Market feature promotion requires trusted row-level odds snapshot source provenance for every evaluated game.",
    );
  }

  if (sourceAudit.public_explanation_ready !== true) {
    reasons.push(
      "Public explanation metadata is not ready for every promoted feature.",
    );
  }

  if (explanationBlockers.length > 0) {
    reasons.push("Promotion evidence still has public explanation blockers.");
  }

  if (segmentRegressionCount > 0) {
    reasons.push(
      `${segmentRegressionCount} evaluation segment(s) regressed beyond guardrails.`,
    );
  }

  return {
    promote: reasons.length === 0,
    reasons,
  };
}

function sameModelVersionKey(
  left: Pick<
    GamePredictionModelVersionRow,
    "feature_set_version" | "model_name" | "model_version"
  >,
  right: {
    featureSetVersion: string;
    modelName: string;
    modelVersion: string;
  },
): boolean {
  return (
    left.model_name === right.modelName &&
    left.model_version === right.modelVersion &&
    left.feature_set_version === right.featureSetVersion
  );
}

async function loadPromotionGateEvidence(args: {
  client: SupabaseClient<Database>;
  modelName: string;
  modelVersion: string;
  featureSetVersion: string;
  minEvaluatedGames?: number;
}): Promise<PromotionGateEvidence> {
  const { data: modelVersion, error } = await args.client
    .from("game_prediction_model_versions")
    .select(
      "model_name,model_version,feature_set_version,status,validation_start_date,validation_end_date,validation_metrics,source_audit_metadata,metadata",
    )
    .eq("model_name", args.modelName)
    .eq("model_version", args.modelVersion)
    .eq("feature_set_version", args.featureSetVersion)
    .maybeSingle();
  if (error) throw error;

  if (!modelVersion) {
    return {
      modelVersion: null,
      persistedOverallMetric: null,
      persistedMonitoredSegmentKeys: [],
      decision: {
        promote: false,
        reasons: ["Model version not found."],
      },
    };
  }

  let persistedOverallMetric: PromotionOverallMetricRow | null = null;
  let persistedMonitoredSegmentKeys: string[] = [];
  if (modelVersion.validation_start_date && modelVersion.validation_end_date) {
    const { data: metric, error: metricError } = await args.client
      .from("game_prediction_model_metrics")
      .select(
        "accuracy,brier_score,evaluated_games,evaluation_end_date,evaluation_start_date,log_loss,segment_key,segment_value",
      )
      .eq("model_name", args.modelName)
      .eq("model_version", args.modelVersion)
      .eq("feature_set_version", args.featureSetVersion)
      .eq("evaluation_start_date", modelVersion.validation_start_date)
      .eq("evaluation_end_date", modelVersion.validation_end_date)
      .eq("segment_key", "overall")
      .eq("segment_value", "all")
      .maybeSingle();
    if (metricError) throw metricError;
    persistedOverallMetric = metric as PromotionOverallMetricRow | null;

    const { data: segmentMetrics, error: segmentMetricError } = await args.client
      .from("game_prediction_model_metrics")
      .select("segment_key")
      .eq("model_name", args.modelName)
      .eq("model_version", args.modelVersion)
      .eq("feature_set_version", args.featureSetVersion)
      .eq("evaluation_start_date", modelVersion.validation_start_date)
      .eq("evaluation_end_date", modelVersion.validation_end_date)
      .in("segment_key", [...REQUIRED_PROMOTION_MONITORED_SEGMENT_KEYS])
      .limit(200);
    if (segmentMetricError) throw segmentMetricError;
    persistedMonitoredSegmentKeys = Array.from(
      new Set((segmentMetrics ?? []).map((row) => row.segment_key)),
    );
  }

  const decision = evaluatePersistedModelVersionPromotionGate({
    modelVersion,
    persistedOverallMetric,
    persistedMonitoredSegmentKeys,
    minEvaluatedGames: args.minEvaluatedGames,
  });

  return {
    modelVersion,
    persistedOverallMetric,
    persistedMonitoredSegmentKeys,
    decision,
  };
}

export async function previewGamePredictionModelVersionPromotion(args: {
  client: SupabaseClient<Database>;
  modelName: string;
  modelVersion: string;
  featureSetVersion: string;
  minEvaluatedGames?: number;
}): Promise<PreviewGamePredictionModelVersionPromotionResult> {
  const evidence = await loadPromotionGateEvidence(args);

  return {
    wouldPromote: evidence.decision.promote,
    reasons: evidence.decision.reasons,
    modelName: args.modelName,
    modelVersion: args.modelVersion,
    featureSetVersion: args.featureSetVersion,
    persistedEvidenceChecked: evidence.modelVersion != null,
  };
}

export async function promoteGamePredictionModelVersion(args: {
  client: SupabaseClient<Database>;
  modelName: string;
  modelVersion: string;
  featureSetVersion: string;
  promotedAt?: string;
  minEvaluatedGames?: number;
}): Promise<PromoteGamePredictionModelVersionResult> {
  const promotedAt = args.promotedAt ?? new Date().toISOString();
  const evidence = await loadPromotionGateEvidence(args);
  const { modelVersion, decision } = evidence;

  if (!modelVersion) {
    return {
      promoted: false,
      reasons: decision.reasons,
      modelName: args.modelName,
      modelVersion: args.modelVersion,
      featureSetVersion: args.featureSetVersion,
      promotedAt: null,
      retiredProductionRows: 0,
    };
  }

  if (!decision.promote) {
    return {
      promoted: false,
      reasons: decision.reasons,
      modelName: args.modelName,
      modelVersion: args.modelVersion,
      featureSetVersion: args.featureSetVersion,
      promotedAt: null,
      retiredProductionRows: 0,
    };
  }

  const { data: productionRows, error: productionError } = await args.client
    .from("game_prediction_model_versions")
    .select("model_name,model_version,feature_set_version")
    .eq("model_name", args.modelName)
    .eq("status", "production");
  if (productionError) throw productionError;

  const promotionMetadata = {
    ...asRecord(modelVersion.metadata),
    manual_promotion: {
      promoted_at: promotedAt,
      evidence_verified_at: promotedAt,
      min_evaluated_games: args.minEvaluatedGames ?? 100,
      promotion_gate: decision,
    },
  } as unknown as Json;

  const { error: promoteError } = await args.client
    .from("game_prediction_model_versions")
    .update({
      status: "production",
      promoted_at: promotedAt,
      retired_at: null,
      metadata: promotionMetadata,
      updated_at: promotedAt,
    })
    .eq("model_name", args.modelName)
    .eq("model_version", args.modelVersion)
    .eq("feature_set_version", args.featureSetVersion)
    .eq("status", "candidate");
  if (promoteError) throw promoteError;

  let retiredProductionRows = 0;
  for (const row of (productionRows ?? []) as Array<
    Pick<
      GamePredictionModelVersionRow,
      "feature_set_version" | "model_name" | "model_version"
    >
  >) {
    if (sameModelVersionKey(row, args)) continue;
    const { error: retireError } = await args.client
      .from("game_prediction_model_versions")
      .update({
        status: "retired",
        retired_at: promotedAt,
        updated_at: promotedAt,
      })
      .eq("model_name", row.model_name)
      .eq("model_version", row.model_version)
      .eq("feature_set_version", row.feature_set_version)
      .eq("status", "production");
    if (retireError) throw retireError;
    retiredProductionRows += 1;
  }

  return {
    promoted: true,
    reasons: [],
    modelName: args.modelName,
    modelVersion: args.modelVersion,
    featureSetVersion: args.featureSetVersion,
    promotedAt,
    retiredProductionRows,
  };
}

async function ensureServingModelVersion(args: {
  client: SupabaseClient<Database>;
  modelName: string;
  modelVersion: string;
  featureSetVersion: string;
  allowBaselineBootstrap?: boolean;
}): Promise<void> {
  if (args.allowBaselineBootstrap && canBootstrapCurrentCompiledBaseline(args)) {
    await ensureGamePredictionModelVersion({
      client: args.client,
      modelName: args.modelName,
      modelVersion: args.modelVersion,
      featureSetVersion: args.featureSetVersion,
      algorithm: "regularized_logistic_baseline",
      status: "production",
    });
    return;
  }

  const { data, error } = await args.client
    .from("game_prediction_model_versions")
    .select("status")
    .eq("model_name", args.modelName)
    .eq("model_version", args.modelVersion)
    .eq("feature_set_version", args.featureSetVersion)
    .maybeSingle();
  if (error) throw error;

  servingModelVersionPersistenceAction({
    ...args,
    existingStatus: data?.status ?? null,
  });
}

export function historicalPregamePredictionCutoffAt(
  game: { date: string; startTime?: string | null },
  hoursBeforeStart = 1,
): string {
  const boundedHours = Math.max(0, Math.min(48, hoursBeforeStart));
  const startTime = parseDateTimeWithGameDate(game.startTime, game.date);
  if (startTime != null) {
    return new Date(startTime - boundedHours * 3_600_000).toISOString();
  }
  return `${game.date}T16:00:00.000Z`;
}

function parseDateTimeWithGameDate(
  value: string | null | undefined,
  gameDate: string | null | undefined,
): number | null {
  if (!value) return null;
  const direct = Date.parse(value);
  if (Number.isFinite(direct)) return direct;
  if (!gameDate || !/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const hasTimeZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  const parsed = Date.parse(
    `${gameDate}T${normalized}${hasTimeZone ? "" : "Z"}`,
  );
  return Number.isFinite(parsed) ? parsed : null;
}

export function isPregamePredictionCutoff(args: {
  game: { date: string; startTime?: string | null };
  predictionCutoffAt: string;
}): boolean {
  const cutoffMs = parseDateTimeWithGameDate(
    args.predictionCutoffAt,
    args.game.date,
  );
  if (cutoffMs == null) return false;
  const startMs = parseDateTimeWithGameDate(
    args.game.startTime,
    args.game.date,
  );
  return startMs == null || cutoffMs < startMs;
}

export function sourceAsOfDateForPredictionCutoff(
  predictionCutoffAt: string,
): string {
  return predictionCutoffAt.slice(0, 10);
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
  allowBaselineBootstrap?: boolean;
  dryRun?: boolean;
}): Promise<GeneratePregamePredictionResult> {
  const model = args.model ?? INITIAL_BASELINE_MODEL;
  const modelName = args.modelName ?? BASELINE_MODEL_NAME;
  const modelVersion = args.modelVersion ?? BASELINE_MODEL_VERSION;
  const predictionCutoffAt = args.predictionCutoffAt ?? new Date().toISOString();
  const inputs = await fetchGamePredictionFeatureInputs(args.client, args.gameId, {
    sourceAsOfDate: args.sourceAsOfDate,
    predictionCutoffAt,
  });
  if (!isPregamePredictionCutoff({ game: inputs.game, predictionCutoffAt })) {
    throw new Error(
      "Refusing to generate pregame prediction at or after puck drop.",
    );
  }
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
      skippedReason: null,
      dryRun: true,
    };
  }

  await ensureServingModelVersion({
    client: args.client,
    modelName,
    modelVersion,
    featureSetVersion: payload.featureSetVersion,
    allowBaselineBootstrap: args.allowBaselineBootstrap,
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
    skippedReason: null,
    dryRun: false,
  };
}

async function existingFeatureSnapshotId(args: {
  client: SupabaseClient<Database>;
  gameId: number;
  predictionCutoffAt: string;
  modelName: string;
  modelVersion: string;
  featureSetVersion: string;
}): Promise<string | null> {
  const { data, error } = await args.client
    .from("game_prediction_feature_snapshots")
    .select("feature_snapshot_id")
    .eq("game_id", args.gameId)
    .eq("prediction_scope", "pregame")
    .eq("prediction_cutoff_at", args.predictionCutoffAt)
    .eq("model_name", args.modelName)
    .eq("model_version", args.modelVersion)
    .eq("feature_set_version", args.featureSetVersion)
    .limit(1);
  if (error) throw error;
  return data?.[0]?.feature_snapshot_id ?? null;
}

export async function backfillGamePredictionFeatureSnapshotsForWindow(args: {
  client: SupabaseClient<Database>;
  fromDate: string;
  toDate: string;
  modelName?: string;
  modelVersion?: string;
  cutoffHoursBeforeStart?: number;
  limit?: number;
  maxRuntimeMs?: number;
  skipExisting?: boolean;
  dryRun?: boolean;
}): Promise<BackfillFeatureSnapshotWindowResult> {
  const modelName = args.modelName ?? BASELINE_MODEL_NAME;
  const modelVersion = args.modelVersion ?? BASELINE_MODEL_VERSION;
  const limit = Math.min(Math.max(args.limit ?? 32, 1), 250);
  const maxRuntimeMs = Math.min(
    Math.max(args.maxRuntimeMs ?? 240_000, 1_000),
    260_000,
  );
  const deadline = Date.now() + maxRuntimeMs;
  const skipExisting = args.skipExisting ?? true;

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
  const results: BackfillFeatureSnapshotResult[] = [];
  let stoppedForDeadline = false;

  for (const game of games) {
    if (Date.now() >= deadline) {
      stoppedForDeadline = true;
      break;
    }

    const predictionCutoffAt = historicalPregamePredictionCutoffAt(
      game,
      args.cutoffHoursBeforeStart,
    );
    const sourceAsOfDate =
      sourceAsOfDateForPredictionCutoff(predictionCutoffAt);

    try {
      const existingId = skipExisting
        ? await existingFeatureSnapshotId({
            client: args.client,
            gameId: game.id,
            predictionCutoffAt,
            modelName,
            modelVersion,
            featureSetVersion: GAME_PREDICTION_FEATURE_SET_VERSION,
          })
        : null;
      if (existingId) {
        results.push({
          gameId: game.id,
          gameDate: game.date,
          predictionCutoffAt,
          sourceAsOfDate,
          featureSnapshotId: existingId,
          warningCount: 0,
          missingFeatureCount: 0,
          marketOddsAvailable: false,
          skippedReason: "existing_snapshot",
          dryRun: Boolean(args.dryRun),
        });
        continue;
      }

      const payload = buildGamePredictionFeatureSnapshotPayload(
        await fetchGamePredictionFeatureInputs(args.client, game.id, {
          sourceAsOfDate,
          predictionCutoffAt,
        }),
      );
      const featureSnapshotId = args.dryRun
        ? null
        : await persistGamePredictionFeatureSnapshot(
            args.client,
            buildFeatureSnapshotInsert({
              payload,
              modelName,
              modelVersion,
              predictionCutoffAt,
            }),
          );

      results.push({
        gameId: game.id,
        gameDate: game.date,
        predictionCutoffAt,
        sourceAsOfDate,
        featureSnapshotId,
        warningCount: payload.warnings.length,
        missingFeatureCount: payload.missingFeatures.length,
        marketOddsAvailable: payload.market != null,
        skippedReason: null,
        dryRun: Boolean(args.dryRun),
      });
    } catch (error) {
      results.push({
        gameId: game.id,
        gameDate: game.date,
        predictionCutoffAt,
        sourceAsOfDate,
        featureSnapshotId: null,
        warningCount: 0,
        missingFeatureCount: 0,
        marketOddsAvailable: false,
        skippedReason:
          error instanceof Error ? error.message : "snapshot_backfill_failed",
        dryRun: Boolean(args.dryRun),
      });
    }
  }

  return {
    fromDate: args.fromDate,
    toDate: args.toDate,
    requestedGames: games.length,
    processedGames: results.filter((result) => !result.skippedReason).length,
    skippedGames: results.filter(
      (result) => result.skippedReason === "existing_snapshot",
    ).length,
    failedGames: results.filter(
      (result) =>
        result.skippedReason != null &&
        result.skippedReason !== "existing_snapshot",
    ).length,
    stoppedForDeadline,
    dryRun: Boolean(args.dryRun),
    results,
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
  allowBaselineBootstrap?: boolean;
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

    if (!isPregamePredictionCutoff({ game, predictionCutoffAt })) {
      results.push({
        gameId: game.id,
        featureSnapshotId: null,
        predictionId: null,
        homeWinProbability: null,
        awayWinProbability: null,
        skippedReason: "prediction_cutoff_at_or_after_puck_drop",
        dryRun: Boolean(args.dryRun),
      });
      continue;
    }

    try {
      results.push(
        await generatePregamePredictionForGame({
          client: args.client,
          gameId: game.id,
          predictionCutoffAt,
          sourceAsOfDate,
          model: args.model,
          modelName: args.modelName,
          modelVersion: args.modelVersion,
          allowBaselineBootstrap: args.allowBaselineBootstrap,
          dryRun: args.dryRun,
        }),
      );
    } catch (error) {
      results.push({
        gameId: game.id,
        featureSnapshotId: null,
        predictionId: null,
        homeWinProbability: null,
        awayWinProbability: null,
        skippedReason:
          error instanceof Error ? error.message : "prediction_generation_failed",
        dryRun: Boolean(args.dryRun),
      });
    }
  }

  const processedGames = results.filter((result) => !result.skippedReason).length;
  return {
    fromDate: args.fromDate,
    toDate: args.toDate,
    sourceAsOfDate,
    requestedGames: games.length,
    processedGames,
    skippedGames: games.length - processedGames,
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
    await ensureGamePredictionModelVersionForScoring({
      client: args.client,
      modelName: args.modelName,
      modelVersion: args.modelVersion,
      featureSetVersion: args.featureSetVersion,
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
  simpleBaselineFloor?: PromotionMetricSummary | null;
  minEvaluatedGames?: number;
  minLogLossImprovement?: number;
  maxCalibrationGap?: number;
  maxCalibrationRegression?: number;
  usesMarketFeatures?: boolean;
  marketFeatureTrainingEligible?: boolean;
  segmentRegressionCount?: number;
  publicExplanationReady?: boolean;
}): PromotionDecision {
  const reasons: string[] = [];
  const minEvaluatedGames = args.minEvaluatedGames ?? 100;
  const minLogLossImprovement = args.minLogLossImprovement ?? 0.002;
  const maxCalibrationGap = args.maxCalibrationGap ?? 0.05;
  const maxCalibrationRegression = args.maxCalibrationRegression ?? 0.005;

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
    args.current.calibrationMaxGap != null &&
    args.candidate.calibrationMaxGap != null &&
    args.candidate.calibrationMaxGap - args.current.calibrationMaxGap >
      maxCalibrationRegression
  ) {
    reasons.push(
      `Candidate calibration gap regressed by more than ${maxCalibrationRegression}.`,
    );
  }

  if (
    args.current.brierScore != null &&
    args.candidate.brierScore != null &&
    args.candidate.brierScore > args.current.brierScore
  ) {
    reasons.push("Candidate Brier score is worse than current production.");
  }

  if (
    args.simpleBaselineFloor?.evaluatedGames != null &&
    args.candidate.evaluatedGames > 0 &&
    args.simpleBaselineFloor.evaluatedGames <
      Math.ceil(args.candidate.evaluatedGames * 0.95)
  ) {
    reasons.push("Simple baseline coverage is too low for promotion comparison.");
  }

  if (
    args.simpleBaselineFloor?.logLoss != null &&
    args.candidate.logLoss != null &&
    args.candidate.logLoss > args.simpleBaselineFloor.logLoss
  ) {
    reasons.push("Candidate log loss is worse than the strongest simple baseline.");
  }

  if (
    args.simpleBaselineFloor?.brierScore != null &&
    args.candidate.brierScore != null &&
    args.candidate.brierScore > args.simpleBaselineFloor.brierScore
  ) {
    reasons.push("Candidate Brier score is worse than the strongest simple baseline.");
  }

  if (args.usesMarketFeatures && !args.marketFeatureTrainingEligible) {
    reasons.push(
      "Market features require historical odds snapshots captured before prediction cutoff and puck drop.",
    );
  }

  if ((args.segmentRegressionCount ?? 0) > 0) {
    reasons.push(
      `${args.segmentRegressionCount} evaluation segment(s) regressed beyond guardrails.`,
    );
  }

  if (args.publicExplanationReady === false) {
    reasons.push(
      "Public explanation metadata is not ready for every promoted feature.",
    );
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
