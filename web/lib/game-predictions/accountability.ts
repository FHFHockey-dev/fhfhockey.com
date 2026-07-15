import type { SupabaseClient } from "@supabase/supabase-js";

import type { BinaryLogisticModel } from "lib/xg/binaryLogistic";
import {
  evaluateProbabilityMetrics,
  fitProbabilityCalibrator,
  type CalibrationMethodName,
  type ProbabilityCalibrator,
} from "lib/xg/calibration";
import type { Database, Json } from "lib/supabase/database-generated.types";
import {
  BASELINE_MODEL_NAME,
  BASELINE_MODEL_VERSION,
  BASELINE_FEATURE_KEYS,
  BASELINE_WINNER_DECISION_THRESHOLD,
  CANDIDATE_ONLY_FEATURE_KEYS,
  PUBLIC_EXPLANATION_FEATURE_KEYS,
  analyzeBaselineFeatureSignals,
  buildBaselineTrainingDataset,
  getConfidenceLabel,
  predictBaselineModelRawHomeWinProbability,
  predictGameWithExtraTreesModel,
  predictGameWithBaselineModel,
  predictExtraTreesHomeWinProbability,
  trainGamePredictionBaselineModel,
  trainGamePredictionExtraTreesModel,
  type BaselineFeatureKey,
  type BaselineFeatureSignalAnalysis,
  type BaselineFeatureVectorOptions,
  type GamePredictionExtraTreesModel,
  type GamePredictionBaselineExample,
  type GamePredictionResult,
  type GamePredictionModelAuditMetadata,
} from "./baselineModel";
import {
  buildGamePredictionFeatureSnapshotPayload,
  fetchGamePredictionFeatureInputs,
  type GamePredictionFeatureSnapshotPayload,
  type SeasonPhase,
} from "./featureBuilder";
import { GAME_PREDICTION_FEATURE_SET_VERSION } from "./featureSources";
import {
  fetchCompletedGameOutcomes,
  type CompletedGameOutcome,
} from "./evaluation";
import {
  ESPN_MARKET_ODDS_REJECTED_SOURCE_NAME,
  ESPN_MARKET_ODDS_SOURCE_NAME,
  HISTORICAL_MARKET_ODDS_IMPORT_REJECTED_SOURCE_NAME,
  HISTORICAL_MARKET_ODDS_IMPORT_SOURCE_NAME,
} from "./espnOdds";
import {
  decidePromotion,
  type PromotionDecision,
  type PromotionMetricSummary,
} from "./workflow";

type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type MarketOddsSourceAuditRow = Pick<
  Tables<"game_prediction_market_odds_snapshots">,
  | "game_id"
  | "captured_at"
  | "event_start_at"
  | "provider"
  | "provenance"
  | "metadata"
>;

export type SourceProvenanceAuditRow = Pick<
  Tables<"source_provenance_snapshots">,
  | "game_id"
  | "source_type"
  | "source_name"
  | "status"
  | "observed_at"
  | "freshness_expires_at"
> & {
  metadata?: Json;
};

type FeatureSnapshotPayloadRow = Pick<
  Tables<"game_prediction_feature_snapshots">,
  | "feature_snapshot_id"
  | "game_id"
  | "feature_set_version"
  | "prediction_cutoff_at"
  | "feature_payload"
  | "metadata"
  | "computed_at"
>;

export type AccountabilityPredictionRow = Pick<
  Tables<"game_prediction_history">,
  | "prediction_id"
  | "game_id"
  | "snapshot_date"
  | "prediction_cutoff_at"
  | "model_name"
  | "model_version"
  | "feature_set_version"
  | "home_team_id"
  | "away_team_id"
  | "home_win_probability"
  | "away_win_probability"
  | "predicted_winner_team_id"
  | "confidence_label"
  | "metadata"
  | "computed_at"
>;

export type AccountabilityGameRow = Pick<
  Tables<"games">,
  | "id"
  | "date"
  | "startTime"
  | "seasonId"
  | "homeTeamId"
  | "awayTeamId"
  | "type"
>;

export type AccountabilityTeamRow = Pick<
  Tables<"teams">,
  "id" | "abbreviation" | "name"
>;

export type PredictionCandlestick = {
  gameId: number;
  snapshotDate: string;
  startTime: string | null;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamAbbreviation: string;
  awayTeamAbbreviation: string;
  openHomeWinProbability: number;
  lowHomeWinProbability: number;
  highHomeWinProbability: number;
  finalHomeWinProbability: number;
  actualHomeWinProbability: 0 | 1;
  probabilitySpread: number;
  predictionCount: number;
  finalPredictionId: string | null;
  finalPredictionCutoffAt: string;
  predictedWinnerTeamId: number;
  actualWinnerTeamId: number;
  predictedWinnerCorrect: boolean;
  homeScore: number;
  awayScore: number;
};

export type AccountabilityDailyPoint = {
  asOfDate: string;
  evaluatedGames: number;
  correctGames: number;
  wrongGames: number;
  cumulativeAccuracy: number | null;
  rolling10Accuracy: number | null;
  rolling25Accuracy: number | null;
  rolling50Accuracy: number | null;
  brierScore: number | null;
  logLoss: number | null;
};

export type AccountabilitySummary = {
  evaluatedGames: number;
  correctGames: number;
  wrongGames: number;
  accuracy: number | null;
  rolling10Accuracy: number | null;
  rolling25Accuracy: number | null;
  rolling50Accuracy: number | null;
  brierScore: number | null;
  logLoss: number | null;
};

export type BacktestBaselineComparison = {
  key: string;
  label: string;
  evaluatedGames: number;
  correctGames: number;
  wrongGames: number;
  accuracy: number | null;
  brierScore: number | null;
  logLoss: number | null;
  averagePrediction: number | null;
};

export type ConfidenceCalibrationBucket = {
  label: string;
  minConfidence: number;
  maxConfidence: number;
  predictions: number;
  correctGames: number;
  accuracy: number | null;
  averageConfidence: number | null;
};

export type AccountabilityDashboard = {
  generatedAt: string;
  modelName: string;
  modelVersion: string;
  featureSetVersion: string;
  summary: AccountabilitySummary;
  daily: AccountabilityDailyPoint[];
  candles: PredictionCandlestick[];
  baselineComparisons?: BacktestBaselineComparison[];
  calibrationBuckets?: ConfidenceCalibrationBucket[];
};

export type WalkForwardBacktestResult = AccountabilityDashboard & {
  seasonId: number;
  trainingSeasonIds: number[];
  trainingStartDate: string;
  trainingEndDate: string;
  replayStartDate: string;
  replayEndDate: string;
  trainingGames: number;
  replayGames: number;
  predictionSnapshots: number;
  retrainCadenceGames: number;
  horizonDays: number[];
  modelAuditMetadata: GamePredictionModelAuditMetadata;
  phaseSummaries: BacktestPhaseSummary[];
  monitoredSegmentSummaries: BacktestMonitoredSegmentSummary[];
  persisted: boolean;
  backtestRunId: string | null;
};

export type WalkForwardBacktestVariantOptions = {
  featureVectorOptions?: BaselineFeatureVectorOptions;
  disableDataQualityDampening?: boolean;
  winnerDecisionThreshold?: number;
  modelAuditMetadata?: GamePredictionModelAuditMetadata;
  modelFamily?: "logistic" | "extra_trees";
  calibrationMethod?: CalibrationMethodName;
  probabilityBlend?: BacktestProbabilityBlend;
  phaseSpecificTraining?: boolean;
  minimumPhaseTrainingExamples?: number;
};

export type BacktestAblationVariant = WalkForwardBacktestVariantOptions & {
  key: string;
  label: string;
};

export type BacktestAblationComparison = {
  key: string;
  label: string;
  modelVersion: string;
  excludedFeatureKeys: readonly BaselineFeatureKey[];
  disableDataQualityDampening: boolean;
  winnerDecisionThreshold: number;
  modelFamily: "logistic" | "extra_trees";
  calibrationMethod: CalibrationMethodName;
  probabilityBlend: BacktestProbabilityBlend | null;
  phaseSpecificTraining: boolean;
  minimumPhaseTrainingExamples: number | null;
  modelAuditMetadata: GamePredictionModelAuditMetadata;
  summary: AccountabilitySummary;
  phaseSummaries: BacktestPhaseSummary[];
  monitoredSegmentSummaries: BacktestMonitoredSegmentSummary[];
  calibrationBuckets: ConfidenceCalibrationBucket[];
  deltaVsBaseline: {
    accuracy: number | null;
    brierScore: number | null;
    logLoss: number | null;
  };
  recommendation: "keep" | "reject" | "review";
};

export type BacktestAblationResult = {
  generatedAt: string;
  modelName: string;
  featureSetVersion: string;
  trainingStartDate: string | null;
  trainingEndDate: string | null;
  replayStartDate: string | null;
  replayEndDate: string | null;
  baselineKey: string;
  sourceReadiness: {
    marketOdds: AccuracyLoopMarketOddsSourceReadiness;
  };
  candidateTracks: GamePredictionCandidateModelTrack[];
  promotionEvidence: BacktestPromotionEvidence[];
  promotionEvidencePersisted: boolean;
  variants: BacktestAblationComparison[];
};

export type GamePredictionCandidateModelTrack = {
  key: string;
  label: string;
  algorithm: string;
  status: "evaluated_by_ablation" | "registered" | "runtime_unavailable";
  featureVectorOptions?: BaselineFeatureVectorOptions;
  explanationSupport: "top_factors" | "requires_surrogate";
  notes: string;
};

export type BacktestPhaseSummary = {
  phase: SeasonPhase;
  trainingExamples: number;
  replayGames: number;
  correctGames: number;
  accuracy: number | null;
  brierScore: number | null;
  logLoss: number | null;
  modelSource: "phase_specific" | "overall_fallback" | "mixed";
};

export type BacktestMonitoredSegmentKey =
  | "goalie_confirmation_state"
  | "has_stale_source"
  | "market_edge_bucket";

export type BacktestMonitoredSegmentSummary = {
  segmentKey: BacktestMonitoredSegmentKey;
  segmentValue: string;
  replayGames: number;
  correctGames: number;
  accuracy: number | null;
  brierScore: number | null;
  logLoss: number | null;
};

export type BacktestSegmentRegression = {
  segmentType: "season_phase";
  segmentKey: SeasonPhase;
  baselineGames: number;
  candidateGames: number;
  brierDelta: number | null;
  logLossDelta: number | null;
};

export type BacktestPromotionEvidence = {
  candidateKey: string;
  baselineKey: string;
  current: PromotionMetricSummary;
  candidate: PromotionMetricSummary;
  simpleBaselineFloor: (PromotionMetricSummary & {
    key: string;
    label: string;
    accuracy: number | null;
  }) | null;
  usesMarketFeatures: boolean;
  marketFeatureTrainingEligible: boolean;
  marketSourceTrainingEligible: boolean;
  marketFeatureSuppressedBySourceReadiness: boolean;
  marketBaselineCoverage: {
    evaluatedGames: number;
    requiredGames: number;
    coveragePct: number | null;
  };
  marketSourceReadiness: AccuracyLoopMarketOddsSourceReadiness | null;
  publicExplanationReady: boolean;
  explanationBlockers: string[];
  activeUnexplainedFeatureKeys: BaselineFeatureKey[];
  segmentRegressionCount: number;
  segmentRegressions: BacktestSegmentRegression[];
  decision: PromotionDecision;
};

type BacktestTrainingExample = GamePredictionBaselineExample & {
  seasonPhase: SeasonPhase;
  seasonId: number;
};

export const BACKTEST_SEASON_RECENCY_WEIGHT_VERSION =
  "training_season_recency_v1_current_1_prev_0_65_prev2_0_35_prev3plus_0_2";

export function trainingSeasonRecencyWeight(
  targetSeasonId: number,
  exampleSeasonId: number,
): number {
  const targetStartYear = Number(String(targetSeasonId).slice(0, 4));
  const exampleStartYear = Number(String(exampleSeasonId).slice(0, 4));
  const seasonsBack = targetStartYear - exampleStartYear;
  if (!Number.isFinite(seasonsBack) || seasonsBack <= 0) return 1;
  if (seasonsBack === 1) return 0.65;
  if (seasonsBack === 2) return 0.35;
  return 0.2;
}

type BacktestCandidateModel = BinaryLogisticModel | GamePredictionExtraTreesModel;

type BacktestProbabilityBlend = {
  method:
    | "training_home_prior"
    | "goal_differential_anchor"
    | "standings_point_pct_anchor";
  modelWeight: number;
};

type PhaseModelState = {
  overallModel: BacktestCandidateModel;
  overallCalibrator?: ProbabilityCalibrator;
  phaseModels: Map<SeasonPhase, BacktestCandidateModel>;
  phaseCalibrators: Map<SeasonPhase, ProbabilityCalibrator>;
  phaseTrainingCounts: Map<SeasonPhase, number>;
  minimumPhaseTrainingExamples: number;
  modelFamily: "logistic" | "extra_trees";
  calibrationMethod: CalibrationMethodName;
  trainingHomeWinRate: number;
};

function isExtraTreesModel(
  model: BacktestCandidateModel,
): model is GamePredictionExtraTreesModel {
  return "modelFamily" in model && model.modelFamily === "extra_trees";
}

export type GamePredictionFeatureSignalAnalysisResult = {
  generatedAt: string;
  seasonId: number;
  gameType: number;
  featureSetVersion: string;
  analysisStartDate: string;
  analysisEndDate: string;
  analyzedGames: number;
  featureVectorOptions: BaselineFeatureVectorOptions;
  analysis: BaselineFeatureSignalAnalysis;
  segmentAnalyses: GamePredictionFeatureSignalSegmentAnalysis[];
};

export type GamePredictionFeatureSignalSegmentAnalysis = {
  phase: SeasonPhase;
  analyzedGames: number;
  analysis: BaselineFeatureSignalAnalysis | null;
};

export function buildFeatureSignalSegmentAnalyses(
  examples: Array<{
    phase: SeasonPhase;
    example: GamePredictionBaselineExample;
  }>,
): GamePredictionFeatureSignalSegmentAnalysis[] {
  return SEASON_PHASES.map((phase) => {
    const phaseExamples = examples
      .filter((entry) => entry.phase === phase)
      .map((entry) => entry.example);
    return {
      phase,
      analyzedGames: phaseExamples.length,
      analysis:
        phaseExamples.length > 0
          ? analyzeBaselineFeatureSignals(phaseExamples)
          : null,
    };
  });
}

export type GamePredictionAccuracyImprovementLoopResult = {
  generatedAt: string;
  seasonId: number;
  gameType: number;
  featureSetVersion: string;
  dryRun: true;
  sourceReadiness: GamePredictionAccuracyLoopSourceReadiness;
  signalAnalysis: GamePredictionFeatureSignalAnalysisResult;
  ablations: BacktestAblationResult;
};

export type AccuracyLoopMarketOddsSourceReadiness = {
  sourceId: "market_odds_snapshots";
  sourceName: "espn_site_api_market_odds";
  acceptedSourceNames: string[];
  trustedSnapshotSourceNames: string[];
  trustedImportBatchIds: string[];
  requiredGames: number;
  snapshotGames: number;
  preCutoffEligibleGames: number;
  trustedSnapshotSourceGames: number;
  provenanceGames: number;
  freshProvenanceGames: number;
  rejectedProvenanceGames: number;
  snapshotCoveragePct: number | null;
  preCutoffEligibleCoveragePct: number | null;
  trustedSnapshotSourceCoveragePct: number | null;
  provenanceCoveragePct: number | null;
  freshProvenanceCoveragePct: number | null;
  rejectedProvenanceCoveragePct: number | null;
  trainingFeatureEligible: boolean;
  missingSnapshotGameIds: number[];
  missingPreCutoffEligibleGameIds: number[];
  missingTrustedSnapshotSourceGameIds: number[];
  missingProvenanceGameIds: number[];
  staleProvenanceGameIds: number[];
  rejectedProvenanceGameIds: number[];
  warnings: string[];
};

export type CompactAccuracyLoopMarketOddsSourceReadiness = Omit<
  AccuracyLoopMarketOddsSourceReadiness,
  | "missingSnapshotGameIds"
  | "missingPreCutoffEligibleGameIds"
  | "missingTrustedSnapshotSourceGameIds"
  | "missingProvenanceGameIds"
  | "staleProvenanceGameIds"
  | "rejectedProvenanceGameIds"
> & {
  missingSnapshotGameIds: number[];
  missingSnapshotGameIdCount: number;
  missingSnapshotGameIdsTruncated: boolean;
  missingPreCutoffEligibleGameIds: number[];
  missingPreCutoffEligibleGameIdCount: number;
  missingPreCutoffEligibleGameIdsTruncated: boolean;
  missingTrustedSnapshotSourceGameIds: number[];
  missingTrustedSnapshotSourceGameIdCount: number;
  missingTrustedSnapshotSourceGameIdsTruncated: boolean;
  missingProvenanceGameIds: number[];
  missingProvenanceGameIdCount: number;
  missingProvenanceGameIdsTruncated: boolean;
  staleProvenanceGameIds: number[];
  staleProvenanceGameIdCount: number;
  staleProvenanceGameIdsTruncated: boolean;
  rejectedProvenanceGameIds: number[];
  rejectedProvenanceGameIdCount: number;
  rejectedProvenanceGameIdsTruncated: boolean;
};

export type CompactGamePredictionAccuracyLoopSourceReadiness = Omit<
  GamePredictionAccuracyLoopSourceReadiness,
  "marketOdds"
> & {
  marketOdds: CompactAccuracyLoopMarketOddsSourceReadiness;
};

const MARKET_ODDS_OBSERVED_SOURCE_NAMES: readonly string[] = [
  ESPN_MARKET_ODDS_SOURCE_NAME,
  HISTORICAL_MARKET_ODDS_IMPORT_SOURCE_NAME,
] as const;

const MARKET_ODDS_REJECTED_SOURCE_NAMES: readonly string[] = [
  ESPN_MARKET_ODDS_REJECTED_SOURCE_NAME,
  HISTORICAL_MARKET_ODDS_IMPORT_REJECTED_SOURCE_NAME,
] as const;

export type GamePredictionAccuracyLoopSourceReadiness = {
  generatedAt: string;
  seasonId: number;
  gameType: number;
  windowStartDate: string | null;
  windowEndDate: string | null;
  requiredGames: number;
  marketOdds: AccuracyLoopMarketOddsSourceReadiness;
};

const DAY_MS = 86_400_000;
const SEASON_PHASES: readonly SeasonPhase[] = [
  "early",
  "middle",
  "late",
  "playoff",
];
const MONITORED_BACKTEST_SEGMENT_KEYS: readonly BacktestMonitoredSegmentKey[] = [
  "goalie_confirmation_state",
  "has_stale_source",
  "market_edge_bucket",
];
const DEFAULT_MINIMUM_PHASE_TRAINING_EXAMPLES = 40;
export const SOURCE_READINESS_GAME_ID_SAMPLE_LIMIT = 25;

export const ACCURACY_IMPROVEMENT_ABLATION_VARIANT_KEYS = [
  "v4_default",
  "long_window_form_candidate",
  "training_home_prior_blend_candidate",
  "platt_calibrated_logistic_candidate",
  "no_cross_season_prior_candidate",
  "phase_specific_logistic_candidate",
  "extra_trees_candidate",
  "platt_calibrated_extra_trees_candidate",
  "market_anchored_candidate",
] as const;

function roundMetric(value: number | null): number | null {
  return value == null || !Number.isFinite(value)
    ? null
    : Number(value.toFixed(6));
}

function roundProbability(value: number): number {
  const bounded = Number.isFinite(value) ? value : 0.5;
  return Number(Math.min(0.999999, Math.max(0.000001, bounded)).toFixed(6));
}

function isoBefore(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) return false;
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime < rightTime;
}

function isoAtOrAfter(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  if (!left || !right) return false;
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime >= rightTime;
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

function isoDateTimeWithGameDate(
  value: string | null | undefined,
  gameDate: string | null | undefined,
): string | null {
  const parsed = parseDateTimeWithGameDate(value, gameDate);
  return parsed == null ? null : new Date(parsed).toISOString();
}

function earliestValidIso(
  values: Array<string | null | undefined>,
): string | null {
  return values
    .map((value) => {
      if (!value) return null;
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? { value, parsed } : null;
    })
    .filter((value): value is { value: string; parsed: number } => Boolean(value))
    .sort((left, right) => left.parsed - right.parsed)[0]?.value ?? null;
}

function accuracyLoopSyntheticPredictionCutoff(game: AccountabilityGameRow): string {
  return `${game.date}T16:00:00.000Z`;
}

function marketOddsReadinessCutoff(args: {
  game: AccountabilityGameRow;
  eventStartAt?: string | null;
}): string | null {
  return earliestValidIso([
    accuracyLoopSyntheticPredictionCutoff(args.game),
    isoDateTimeWithGameDate(args.game.startTime, args.game.date),
    isoDateTimeWithGameDate(args.eventStartAt, args.game.date),
  ]);
}

export function syntheticBacktestPredictionCutoffAt(args: {
  game: Pick<AccountabilityGameRow, "date" | "startTime">;
  simulationDate: string;
  horizonDays: number;
  hoursBeforeStart?: number;
}): string {
  if (args.horizonDays === 0 && args.game.startTime) {
    const startMs = parseDateTimeWithGameDate(
      args.game.startTime,
      args.game.date,
    );
    if (startMs != null) {
      const hoursBeforeStart = Math.max(
        0,
        Math.min(48, args.hoursBeforeStart ?? 1),
      );
      return new Date(startMs - hoursBeforeStart * 3_600_000).toISOString();
    }
  }

  return `${args.simulationDate}T16:00:00.000Z`;
}

function coveragePct(covered: number, required: number): number | null {
  return required > 0 ? roundMetric(covered / required) : null;
}

function sortedMissingGameIds(requiredGameIds: Set<number>, coveredGameIds: Set<number>): number[] {
  return Array.from(requiredGameIds)
    .filter((gameId) => !coveredGameIds.has(gameId))
    .sort((left, right) => left - right);
}

function sortedStrings(values: Set<string>): string[] {
  return Array.from(values).sort((left, right) => left.localeCompare(right));
}

function compactGameIds(
  gameIds: readonly number[],
  limit = SOURCE_READINESS_GAME_ID_SAMPLE_LIMIT,
): {
  sample: number[];
  count: number;
  truncated: boolean;
} {
  return {
    sample: gameIds.slice(0, limit),
    count: gameIds.length,
    truncated: gameIds.length > limit,
  };
}

export function compactMarketOddsSourceReadinessForMetadata(
  readiness: AccuracyLoopMarketOddsSourceReadiness,
): CompactAccuracyLoopMarketOddsSourceReadiness {
  const missingSnapshot = compactGameIds(readiness.missingSnapshotGameIds);
  const missingPreCutoff = compactGameIds(
    readiness.missingPreCutoffEligibleGameIds,
  );
  const missingTrustedSnapshotSource = compactGameIds(
    readiness.missingTrustedSnapshotSourceGameIds,
  );
  const missingProvenance = compactGameIds(
    readiness.missingProvenanceGameIds,
  );
  const staleProvenance = compactGameIds(readiness.staleProvenanceGameIds);
  const rejectedProvenance = compactGameIds(
    readiness.rejectedProvenanceGameIds,
  );

  return {
    sourceId: readiness.sourceId,
    sourceName: readiness.sourceName,
    acceptedSourceNames: readiness.acceptedSourceNames,
    trustedSnapshotSourceNames: readiness.trustedSnapshotSourceNames,
    trustedImportBatchIds: readiness.trustedImportBatchIds,
    requiredGames: readiness.requiredGames,
    snapshotGames: readiness.snapshotGames,
    preCutoffEligibleGames: readiness.preCutoffEligibleGames,
    trustedSnapshotSourceGames: readiness.trustedSnapshotSourceGames,
    provenanceGames: readiness.provenanceGames,
    freshProvenanceGames: readiness.freshProvenanceGames,
    rejectedProvenanceGames: readiness.rejectedProvenanceGames,
    snapshotCoveragePct: readiness.snapshotCoveragePct,
    preCutoffEligibleCoveragePct: readiness.preCutoffEligibleCoveragePct,
    trustedSnapshotSourceCoveragePct:
      readiness.trustedSnapshotSourceCoveragePct,
    provenanceCoveragePct: readiness.provenanceCoveragePct,
    freshProvenanceCoveragePct: readiness.freshProvenanceCoveragePct,
    rejectedProvenanceCoveragePct: readiness.rejectedProvenanceCoveragePct,
    trainingFeatureEligible: readiness.trainingFeatureEligible,
    missingSnapshotGameIds: missingSnapshot.sample,
    missingSnapshotGameIdCount: missingSnapshot.count,
    missingSnapshotGameIdsTruncated: missingSnapshot.truncated,
    missingPreCutoffEligibleGameIds: missingPreCutoff.sample,
    missingPreCutoffEligibleGameIdCount: missingPreCutoff.count,
    missingPreCutoffEligibleGameIdsTruncated: missingPreCutoff.truncated,
    missingTrustedSnapshotSourceGameIds: missingTrustedSnapshotSource.sample,
    missingTrustedSnapshotSourceGameIdCount: missingTrustedSnapshotSource.count,
    missingTrustedSnapshotSourceGameIdsTruncated:
      missingTrustedSnapshotSource.truncated,
    missingProvenanceGameIds: missingProvenance.sample,
    missingProvenanceGameIdCount: missingProvenance.count,
    missingProvenanceGameIdsTruncated: missingProvenance.truncated,
    staleProvenanceGameIds: staleProvenance.sample,
    staleProvenanceGameIdCount: staleProvenance.count,
    staleProvenanceGameIdsTruncated: staleProvenance.truncated,
    rejectedProvenanceGameIds: rejectedProvenance.sample,
    rejectedProvenanceGameIdCount: rejectedProvenance.count,
    rejectedProvenanceGameIdsTruncated: rejectedProvenance.truncated,
    warnings: readiness.warnings,
  };
}

function compactSourceReadinessForMetadata<
  T extends { marketOdds: AccuracyLoopMarketOddsSourceReadiness },
>(
  readiness: T,
): Omit<T, "marketOdds"> & {
  marketOdds: CompactAccuracyLoopMarketOddsSourceReadiness;
} {
  return {
    ...readiness,
    marketOdds: compactMarketOddsSourceReadinessForMetadata(
      readiness.marketOdds,
    ),
  };
}

function compactPromotionEvidenceForMetadata(
  evidence: BacktestPromotionEvidence | null,
): (Omit<BacktestPromotionEvidence, "marketSourceReadiness"> & {
  marketSourceReadiness: CompactAccuracyLoopMarketOddsSourceReadiness | null;
}) | null {
  if (!evidence) return null;
  return {
    ...evidence,
    marketSourceReadiness: evidence.marketSourceReadiness
      ? compactMarketOddsSourceReadinessForMetadata(evidence.marketSourceReadiness)
      : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function marketOddsSnapshotSourceName(
  row: MarketOddsSourceAuditRow,
): string | null {
  const provenance = isRecord(row.provenance) ? row.provenance : {};
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  return (
    stringValue(provenance.import_source_name) ??
    stringValue(metadata.import_source_name) ??
    stringValue(provenance.source_name) ??
    stringValue(metadata.source_name)
  );
}

function marketOddsSnapshotImportBatchId(
  row: MarketOddsSourceAuditRow,
): string | null {
  const provenance = isRecord(row.provenance) ? row.provenance : {};
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  return (
    stringValue(provenance.import_batch_id) ??
    stringValue(metadata.import_batch_id) ??
    stringValue(metadata.importBatchId)
  );
}

function sourceProvenanceImportBatchId(
  row: SourceProvenanceAuditRow,
): string | null {
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  return (
    stringValue(metadata.importBatchId) ??
    stringValue(metadata.import_batch_id)
  );
}

function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function accuracyFor(candles: PredictionCandlestick[]): number | null {
  if (candles.length === 0) return null;
  return roundMetric(
    candles.filter((row) => row.predictedWinnerCorrect).length / candles.length,
  );
}

function addDateDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  for (let date = startDate; date <= endDate; date = addDateDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

function normalizeHorizonDays(horizonDays?: number[]): number[] {
  const values = horizonDays?.length ? horizonDays : [0];
  const normalized = Array.from(
    new Set(values.filter((value) => Number.isInteger(value) && value >= 0)),
  ).sort((a, b) => b - a);
  return normalized.length > 0 ? normalized : [0];
}

function smoothedHomeWinRate(
  examples: readonly GamePredictionBaselineExample[],
): number {
  if (examples.length === 0) return 0.54;
  const totalWeight = examples.reduce(
    (sum, example) => sum + (example.weight ?? 1),
    0,
  );
  const homeWins = examples.reduce(
    (sum, example) => sum + example.label * (example.weight ?? 1),
    0,
  );
  return roundProbability((homeWins + 1) / (totalWeight + 2));
}

const RECENT_FORM_FEATURE_KEYS: readonly BaselineFeatureKey[] = [
  "homeMinusAwayRecent5GoalDifferentialPerGame",
  "homeMinusAwayRecent10GoalDifferentialPerGame",
  "homeMinusAwayRecent20GoalDifferentialPerGame",
  "homeMinusAwayRecent40GoalDifferentialPerGame",
  "homeMinusAwayRecent5XgfPct",
  "homeMinusAwayRecent10XgfPct",
  "homeMinusAwayRecent20XgfPct",
  "homeMinusAwayRecent40XgfPct",
  "homeMinusAwaySeasonToDateXgfPct",
  "homeMinusAwayCrossSeasonPriorXgfPct",
  "homeMinusAwayRecent10PointPct",
  "homeMinusAwaySeasonToDatePointPct",
  "homeMinusAwayRecent20FenwickShare",
  "homeMinusAwayRecent40FenwickShare",
  "homeMinusAwayRecent20GfPct",
  "homeMinusAwayRecent40GfPct",
  "homeMinusAwayRecent20XgaPer60",
  "homeMinusAwayRecent40XgaPer60",
];

const ROSTER_PRIOR_CANDIDATE_FEATURE_KEYS: readonly BaselineFeatureKey[] = [
  "homeMinusAwayRosterOffImpact",
  "homeMinusAwayRosterDefImpact",
  "homeMinusAwayRosterGoalieImpact",
];

const PER60_ONLY_ROSTER_PRIOR_FEATURE_KEYS: readonly BaselineFeatureKey[] = [
  "homeMinusAwayRosterOffImpactPer60Only",
  "homeMinusAwayRosterDefImpactPer60Only",
  "homeMinusAwayRosterGoalieImpactPer60Only",
];

const TIME_WEIGHTED_ROSTER_FORM_FEATURE_KEYS: readonly BaselineFeatureKey[] = [
  "homeMinusAwayWeightedRosterOffImpact",
  "homeMinusAwayWeightedRosterDefImpact",
  "homeMinusAwayWeightedRosterGoalieImpact",
  "homeMinusAwayWeightedRecent10GoalDifferentialPerGame",
  "homeMinusAwayWeightedRecent10XgfPct",
];

const SOS_ADJUSTED_FORM_FEATURE_KEYS: readonly BaselineFeatureKey[] = [
  "homeMinusAwayLast5OpponentCompositeRating",
  "homeMinusAwayLast10OpponentCompositeRating",
  "homeMinusAwayAdjustedRecent5GoalDifferentialPerGame",
  "homeMinusAwayAdjustedRecent10GoalDifferentialPerGame",
  "homeMinusAwayAdjustedRecent5XgfPct",
  "homeMinusAwayAdjustedRecent10XgfPct",
];

function candidateExclusionsExcept(
  includedKeys: readonly BaselineFeatureKey[],
): BaselineFeatureKey[] {
  const included = new Set(includedKeys);
  return CANDIDATE_ONLY_FEATURE_KEYS.filter((key) => !included.has(key));
}

export const DEFAULT_BACKTEST_ABLATION_VARIANTS: BacktestAblationVariant[] = [
  {
    key: "v4_default",
    label: "Current v4 default",
  },
  {
    key: "with_recent_point_pct",
    label: "Include recent point %",
    featureVectorOptions: {
      includeDefaultExcludedFeatureKeys: true,
      excludedFeatureKeys: CANDIDATE_ONLY_FEATURE_KEYS,
    },
    winnerDecisionThreshold: 0.52,
  },
  {
    key: "v3_recent_form",
    label: "Prior v3 recent form",
    featureVectorOptions: {
      includeDefaultExcludedFeatureKeys: true,
      excludedFeatureKeys: CANDIDATE_ONLY_FEATURE_KEYS,
    },
    winnerDecisionThreshold: 0.5,
  },
  {
    key: "no_recent_form",
    label: "No recent form features",
    featureVectorOptions: {
      excludedFeatureKeys: RECENT_FORM_FEATURE_KEYS,
    },
  },
  {
    key: "no_recent_goal_diff",
    label: "No recent goal differential",
    featureVectorOptions: {
      excludedFeatureKeys: [
        "homeMinusAwayRecent5GoalDifferentialPerGame",
        "homeMinusAwayRecent10GoalDifferentialPerGame",
      ],
    },
  },
  {
    key: "no_recent_xg",
    label: "No recent xG share",
    featureVectorOptions: {
      excludedFeatureKeys: [
        "homeMinusAwayRecent5XgfPct",
        "homeMinusAwayRecent10XgfPct",
      ],
    },
  },
  {
    key: "no_recent_point_pct",
    label: "No recent point %",
    featureVectorOptions: {
      excludedFeatureKeys: ["homeMinusAwayRecent10PointPct"],
    },
  },
  {
    key: "signal_selected",
    label: "Signal selected factors",
    featureVectorOptions: {
      excludedFeatureKeys: [
        "homeMinusAwaySpecialRating",
        "homeMinusAwayRecent10PointPct",
        "homeMinusAwayWeightedGoalieGsaaPer60",
      ],
    },
  },
  {
    key: "signal_selected_strict",
    label: "Signal selected without point % or short xG",
    featureVectorOptions: {
      excludedFeatureKeys: [
        "homeMinusAwaySpecialRating",
        "homeMinusAwayPointPctg",
        "homeMinusAwayRecent5XgfPct",
        "homeMinusAwayRecent10PointPct",
        "homeMinusAwayWeightedGoalieGsaaPer60",
      ],
    },
  },
  {
    key: "long_window_form_candidate",
    label: "Candidate long-window form",
    featureVectorOptions: {
      includeDefaultExcludedFeatureKeys: true,
      excludedFeatureKeys: ["homeMarketNoVigProbability"],
    },
    modelAuditMetadata: {
      seasonDecayVersion: "team_games_played_phase_v1",
      probabilityBlendVersion: "none",
    },
  },
  {
    key: "roster_prior_candidate",
    label: "Candidate TOI-shrunk roster priors",
    featureVectorOptions: {
      includeDefaultExcludedFeatureKeys: true,
      excludedFeatureKeys: candidateExclusionsExcept(
        ROSTER_PRIOR_CANDIDATE_FEATURE_KEYS,
      ),
    },
    modelAuditMetadata: {
      rosterImpactVersion: "player_impact_ratings_v1_toi_weighted",
      probabilityBlendVersion: "none",
    },
  },
  {
    key: "per60_only_roster_prior_candidate",
    label: "Candidate unshrunk per60 roster priors",
    featureVectorOptions: {
      includeDefaultExcludedFeatureKeys: true,
      excludedFeatureKeys: candidateExclusionsExcept(
        PER60_ONLY_ROSTER_PRIOR_FEATURE_KEYS,
      ),
    },
    modelAuditMetadata: {
      rosterImpactVersion: "player_impact_ratings_v1_per60_unshrunk",
      probabilityBlendVersion: "none",
    },
  },
  {
    key: "time_weighted_roster_form_candidate",
    label: "Candidate time-weighted roster and current form",
    featureVectorOptions: {
      includeDefaultExcludedFeatureKeys: true,
      excludedFeatureKeys: candidateExclusionsExcept(
        TIME_WEIGHTED_ROSTER_FORM_FEATURE_KEYS,
      ),
    },
    modelAuditMetadata: {
      rosterImpactVersion: "player_impact_ratings_v1_toi_weighted",
      probabilityBlendVersion:
        "roster_form_blend_v1_gp0_80_20_gp10_70_30_gp25_50_50_gp50_15_85_gp82_10_90",
    },
  },
  {
    key: "sos_adjusted_form_candidate",
    label: "Candidate SoS-adjusted current form",
    featureVectorOptions: {
      includeDefaultExcludedFeatureKeys: true,
      excludedFeatureKeys: candidateExclusionsExcept(
        SOS_ADJUSTED_FORM_FEATURE_KEYS,
      ),
    },
    modelAuditMetadata: {
      strengthOfScheduleVersion:
        "sos_adjusted_form_v1_neutral50_goal_diff_div50_xgf_scale_0_05",
      probabilityBlendVersion: "none",
    },
  },
  {
    key: "roster_plus_sos_candidate",
    label: "Candidate roster priors plus SoS-adjusted form",
    featureVectorOptions: {
      includeDefaultExcludedFeatureKeys: true,
      excludedFeatureKeys: candidateExclusionsExcept([
        ...ROSTER_PRIOR_CANDIDATE_FEATURE_KEYS,
        ...SOS_ADJUSTED_FORM_FEATURE_KEYS,
      ]),
    },
    modelAuditMetadata: {
      rosterImpactVersion: "player_impact_ratings_v1_toi_weighted",
      strengthOfScheduleVersion:
        "sos_adjusted_form_v1_neutral50_goal_diff_div50_xgf_scale_0_05",
      probabilityBlendVersion: "none",
    },
  },
  {
    key: "training_home_prior_blend_candidate",
    label: "Training home-prior blend",
    probabilityBlend: {
      method: "training_home_prior",
      modelWeight: 0.2,
    },
    modelAuditMetadata: {
      probabilityBlendVersion: "training_home_prior_blend_v1",
      seasonDecayVersion: "none",
    },
  },
  {
    key: "goal_differential_anchor_blend_candidate",
    label: "50/50 model and goal-differential anchor",
    probabilityBlend: {
      method: "goal_differential_anchor",
      modelWeight: 0.5,
    },
    modelAuditMetadata: {
      probabilityBlendVersion: "goal_differential_anchor_blend_v1_model_0_5",
    },
  },
  {
    key: "standings_point_pct_anchor_blend_candidate",
    label: "50/50 model and standings-point-% anchor",
    probabilityBlend: {
      method: "standings_point_pct_anchor",
      modelWeight: 0.5,
    },
    modelAuditMetadata: {
      probabilityBlendVersion: "standings_point_pct_anchor_blend_v1_model_0_5",
    },
  },
  {
    key: "platt_calibrated_logistic_candidate",
    label: "Platt-calibrated long-window logistic",
    featureVectorOptions: {
      includeDefaultExcludedFeatureKeys: true,
      excludedFeatureKeys: ["homeMarketNoVigProbability"],
    },
    calibrationMethod: "platt",
    modelAuditMetadata: {
      seasonDecayVersion: "team_games_played_phase_v1",
      probabilityBlendVersion: "platt_calibration_v1",
    },
  },
  {
    key: "no_cross_season_prior_candidate",
    label: "Long-window without cross-season prior",
    featureVectorOptions: {
      includeDefaultExcludedFeatureKeys: true,
      excludedFeatureKeys: [
        "homeMinusAwayCrossSeasonPriorXgfPct",
        "homeMarketNoVigProbability",
      ],
    },
    modelAuditMetadata: {
      seasonDecayVersion: "team_games_played_phase_v1",
      probabilityBlendVersion: "none",
    },
  },
  {
    key: "phase_specific_logistic_candidate",
    label: "Phase-specific logistic candidate",
    featureVectorOptions: {
      includeDefaultExcludedFeatureKeys: true,
      excludedFeatureKeys: ["homeMarketNoVigProbability"],
    },
    phaseSpecificTraining: true,
    minimumPhaseTrainingExamples: DEFAULT_MINIMUM_PHASE_TRAINING_EXAMPLES,
    modelAuditMetadata: {
      seasonDecayVersion: "phase_specific_logistic_v1",
      probabilityBlendVersion: "none",
    },
  },
  {
    key: "extra_trees_candidate",
    label: "ExtraTrees candidate",
    featureVectorOptions: {
      includeDefaultExcludedFeatureKeys: true,
      excludedFeatureKeys: ["homeMarketNoVigProbability"],
    },
    modelFamily: "extra_trees",
    modelAuditMetadata: {
      candidateModelFamily: "extra_trees",
      seasonDecayVersion: "team_games_played_phase_v1",
      probabilityBlendVersion: "none",
    },
  },
  {
    key: "platt_calibrated_extra_trees_candidate",
    label: "Platt-calibrated ExtraTrees candidate",
    featureVectorOptions: {
      includeDefaultExcludedFeatureKeys: true,
      excludedFeatureKeys: ["homeMarketNoVigProbability"],
    },
    modelFamily: "extra_trees",
    calibrationMethod: "platt",
    modelAuditMetadata: {
      candidateModelFamily: "extra_trees",
      seasonDecayVersion: "team_games_played_phase_v1",
      probabilityBlendVersion: "platt_calibration_v1",
    },
  },
  {
    key: "market_anchored_candidate",
    label: "Market snapshot candidate",
    featureVectorOptions: {
      includeDefaultExcludedFeatureKeys: true,
    },
    modelAuditMetadata: {
      probabilityBlendVersion: "market_snapshot_candidate_v1",
      seasonDecayVersion: "team_games_played_phase_v1",
    },
  },
  {
    key: "no_quality_dampening",
    label: "No data quality dampening",
    disableDataQualityDampening: true,
  },
  {
    key: "home_threshold_52",
    label: "Home decision threshold 52%",
    winnerDecisionThreshold: 0.52,
  },
];

export function selectAccuracyImprovementAblationVariants(
  variantKeys: readonly string[] = ACCURACY_IMPROVEMENT_ABLATION_VARIANT_KEYS,
): BacktestAblationVariant[] {
  const requestedKeys = new Set(variantKeys);
  return DEFAULT_BACKTEST_ABLATION_VARIANTS.filter((variant) =>
    requestedKeys.has(variant.key),
  );
}

export const DEFAULT_CANDIDATE_MODEL_TRACKS: GamePredictionCandidateModelTrack[] = [
  {
    key: "production_logistic",
    label: "Production logistic",
    algorithm: "regularized_logistic",
    status: "evaluated_by_ablation",
    explanationSupport: "top_factors",
    notes: "Existing serving contract and top-factor explanations.",
  },
  {
    key: "logistic_plus_candidate_features",
    label: "Logistic plus candidate features",
    algorithm: "regularized_logistic",
    status: "evaluated_by_ablation",
    featureVectorOptions: {
      includeDefaultExcludedFeatureKeys: true,
      excludedFeatureKeys: ["homeMarketNoVigProbability"],
    },
    explanationSupport: "top_factors",
    notes:
      "Evaluates longer-window NST form, season phase, and goalie uncertainty without market odds.",
  },
  {
    key: "training_home_prior_blend_candidate",
    label: "Training home-prior blend",
    algorithm: "regularized_logistic_training_prior_blend",
    status: "evaluated_by_ablation",
    explanationSupport: "top_factors",
    notes:
      "Blends production-feature logistic probability with a smoothed home-win prior learned only from current pre-cutoff training examples.",
  },
  {
    key: "platt_calibrated_logistic_candidate",
    label: "Platt-calibrated logistic candidate",
    algorithm: "regularized_logistic_platt_calibrated",
    status: "evaluated_by_ablation",
    featureVectorOptions: {
      includeDefaultExcludedFeatureKeys: true,
      excludedFeatureKeys: ["homeMarketNoVigProbability"],
    },
    explanationSupport: "top_factors",
    notes:
      "Fits Platt calibration from pre-cutoff training predictions only and evaluates probability quality before any promotion.",
  },
  {
    key: "phase_specific_logistic_candidate",
    label: "Phase-specific logistic candidate",
    algorithm: "regularized_logistic_by_season_phase",
    status: "evaluated_by_ablation",
    featureVectorOptions: {
      includeDefaultExcludedFeatureKeys: true,
      excludedFeatureKeys: ["homeMarketNoVigProbability"],
    },
    explanationSupport: "top_factors",
    notes:
      "Trains separate early, middle, late, and playoff logistic models when enough pre-cutoff examples exist; otherwise falls back to the overall logistic model.",
  },
  {
    key: "market_anchored_logistic",
    label: "Market anchored logistic",
    algorithm: "regularized_logistic",
    status: "registered",
    featureVectorOptions: {
      includeDefaultExcludedFeatureKeys: true,
    },
    explanationSupport: "top_factors",
    notes:
      "Allowed only when odds snapshots are historically captured before cutoff and puck drop.",
  },
  {
    key: "nhl_game_extratrees_candidate_v1",
    label: "ExtraTrees-inspired candidate",
    algorithm: "extra_trees_classifier",
    status: "evaluated_by_ablation",
    featureVectorOptions: {
      includeDefaultExcludedFeatureKeys: true,
      excludedFeatureKeys: ["homeMarketNoVigProbability"],
    },
    explanationSupport: "requires_surrogate",
    notes:
      "Deterministic shallow randomized-tree ensemble evaluated only in dry-run ablations; promotion remains blocked until calibrated probabilities and public explanation support are validated.",
  },
  {
    key: "platt_calibrated_extra_trees_candidate",
    label: "Platt-calibrated ExtraTrees candidate",
    algorithm: "extra_trees_classifier_platt_calibrated",
    status: "evaluated_by_ablation",
    featureVectorOptions: {
      includeDefaultExcludedFeatureKeys: true,
      excludedFeatureKeys: ["homeMarketNoVigProbability"],
    },
    explanationSupport: "requires_surrogate",
    notes:
      "Fits Platt calibration from pre-cutoff training predictions only; remains blocked from promotion without explanation-ready factors and guardrail evidence.",
  },
];

function boundedEdgeProbability(
  edge: number | null | undefined,
  scale: number,
  baseConfidence = 0.55,
  maxConfidence = 0.75,
): number {
  if (edge == null || !Number.isFinite(edge) || Math.abs(edge) < 1e-9) {
    return 0.5;
  }
  const confidence =
    baseConfidence + Math.min(maxConfidence - baseConfidence, Math.abs(edge) / scale);
  return edge > 0 ? confidence : 1 - confidence;
}

function teamAbbreviation(
  teamsById: Map<number, AccountabilityTeamRow>,
  teamId: number,
): string {
  return teamsById.get(teamId)?.abbreviation ?? String(teamId);
}

function sortPredictions(
  predictions: AccountabilityPredictionRow[],
): AccountabilityPredictionRow[] {
  return [...predictions].sort((a, b) => {
    const left = a.prediction_cutoff_at ?? a.computed_at;
    const right = b.prediction_cutoff_at ?? b.computed_at;
    return left.localeCompare(right);
  });
}

function finalPregamePredictions(
  predictions: AccountabilityPredictionRow[],
  game?: AccountabilityGameRow,
): AccountabilityPredictionRow[] {
  const sorted = sortPredictions(predictions);
  if (!game?.startTime) return sorted;
  const startMs = parseDateTimeWithGameDate(game.startTime, game.date);
  if (startMs == null) return sorted;
  const beforeStart = sorted.filter(
    (prediction) => {
      const predictionMs = parseDateTimeWithGameDate(
        prediction.prediction_cutoff_at ?? prediction.computed_at,
        game.date,
      );
      return predictionMs != null && predictionMs < startMs;
    },
  );
  return beforeStart;
}

export function buildPredictionCandlestick(args: {
  predictions: AccountabilityPredictionRow[];
  outcome: CompletedGameOutcome;
  game?: AccountabilityGameRow;
  teamsById?: Map<number, AccountabilityTeamRow>;
}): PredictionCandlestick | null {
  const usablePredictions = finalPregamePredictions(
    args.predictions,
    args.game,
  );
  if (usablePredictions.length === 0) return null;

  const first = usablePredictions[0]!;
  const final = usablePredictions[usablePredictions.length - 1]!;
  const probabilities = usablePredictions.map((prediction) =>
    Number(prediction.home_win_probability),
  );
  if (probabilities.some((value) => !Number.isFinite(value))) return null;

  const actualWinnerTeamId = args.outcome.homeWon
    ? args.outcome.homeTeamId
    : args.outcome.awayTeamId;
  const predictedWinnerTeamId =
    final.predicted_winner_team_id ??
    (final.home_win_probability >= final.away_win_probability
      ? final.home_team_id
      : final.away_team_id);
  const teamsById = args.teamsById ?? new Map<number, AccountabilityTeamRow>();

  return {
    gameId: final.game_id,
    snapshotDate: final.snapshot_date,
    startTime: args.game?.startTime ?? null,
    homeTeamId: final.home_team_id,
    awayTeamId: final.away_team_id,
    homeTeamAbbreviation: teamAbbreviation(teamsById, final.home_team_id),
    awayTeamAbbreviation: teamAbbreviation(teamsById, final.away_team_id),
    openHomeWinProbability: first.home_win_probability,
    lowHomeWinProbability: Math.min(...probabilities),
    highHomeWinProbability: Math.max(...probabilities),
    finalHomeWinProbability: final.home_win_probability,
    actualHomeWinProbability: args.outcome.homeWon ? 1 : 0,
    probabilitySpread: roundMetric(
      Math.max(...probabilities) - Math.min(...probabilities),
    )!,
    predictionCount: usablePredictions.length,
    finalPredictionId: final.prediction_id,
    finalPredictionCutoffAt: final.prediction_cutoff_at ?? final.computed_at,
    predictedWinnerTeamId,
    actualWinnerTeamId,
    predictedWinnerCorrect: predictedWinnerTeamId === actualWinnerTeamId,
    homeScore: args.outcome.homeScore,
    awayScore: args.outcome.awayScore,
  };
}

export function buildAccountabilityDailySeries(
  candles: PredictionCandlestick[],
): AccountabilityDailyPoint[] {
  const sorted = [...candles].sort((a, b) =>
    a.snapshotDate === b.snapshotDate
      ? a.gameId - b.gameId
      : a.snapshotDate.localeCompare(b.snapshotDate),
  );
  const byDate = new Map<string, PredictionCandlestick[]>();
  for (const candle of sorted) {
    byDate.set(candle.snapshotDate, [
      ...(byDate.get(candle.snapshotDate) ?? []),
      candle,
    ]);
  }

  const cumulative: PredictionCandlestick[] = [];
  return Array.from(byDate.entries()).map(([asOfDate, dayCandles]) => {
    cumulative.push(...dayCandles);
    const correctGames = cumulative.filter(
      (row) => row.predictedWinnerCorrect,
    ).length;
    const probabilityMetrics = evaluateProbabilityMetrics(
      cumulative.map((row) => ({
        label: row.actualHomeWinProbability,
        prediction: row.finalHomeWinProbability,
      })),
    );

    return {
      asOfDate,
      evaluatedGames: cumulative.length,
      correctGames,
      wrongGames: cumulative.length - correctGames,
      cumulativeAccuracy: accuracyFor(cumulative),
      rolling10Accuracy: accuracyFor(cumulative.slice(-10)),
      rolling25Accuracy: accuracyFor(cumulative.slice(-25)),
      rolling50Accuracy: accuracyFor(cumulative.slice(-50)),
      brierScore: probabilityMetrics.brierScore,
      logLoss: probabilityMetrics.logLoss,
    };
  });
}

export function buildAccountabilitySummary(
  candles: PredictionCandlestick[],
): AccountabilitySummary {
  const correctGames = candles.filter(
    (row) => row.predictedWinnerCorrect,
  ).length;
  const probabilityMetrics = evaluateProbabilityMetrics(
    candles.map((row) => ({
      label: row.actualHomeWinProbability,
      prediction: row.finalHomeWinProbability,
    })),
  );

  return {
    evaluatedGames: candles.length,
    correctGames,
    wrongGames: candles.length - correctGames,
    accuracy: accuracyFor(candles),
    rolling10Accuracy: accuracyFor(candles.slice(-10)),
    rolling25Accuracy: accuracyFor(candles.slice(-25)),
    rolling50Accuracy: accuracyFor(candles.slice(-50)),
    brierScore: probabilityMetrics.brierScore,
    logLoss: probabilityMetrics.logLoss,
  };
}

function buildBaselineComparison(args: {
  key: string;
  label: string;
  candles: PredictionCandlestick[];
  probabilityFor: (candle: PredictionCandlestick) => number | null;
}): BacktestBaselineComparison {
  const predictions = args.candles.flatMap((candle) => {
    const rawProbability = args.probabilityFor(candle);
    if (rawProbability == null || !Number.isFinite(rawProbability)) return [];
    const homeWinProbability = Math.min(
      0.95,
      Math.max(0.05, rawProbability),
    );
    const predictedHome = homeWinProbability >= 0.5;
    const actualHome = candle.actualHomeWinProbability === 1;
    return [{
      label: candle.actualHomeWinProbability,
      prediction: homeWinProbability,
      correct: predictedHome === actualHome,
    }];
  });
  const metrics = evaluateProbabilityMetrics(predictions);
  const correctGames = predictions.filter((prediction) => prediction.correct).length;

  return {
    key: args.key,
    label: args.label,
    evaluatedGames: predictions.length,
    correctGames,
    wrongGames: predictions.length - correctGames,
    accuracy: predictions.length ? roundMetric(correctGames / predictions.length) : null,
    brierScore: metrics.brierScore,
    logLoss: metrics.logLoss,
    averagePrediction: metrics.averagePrediction,
  };
}

export function buildBacktestBaselineComparisons(args: {
  candles: PredictionCandlestick[];
  payloadsByGameId?: Map<number, GamePredictionFeatureSnapshotPayload>;
}): BacktestBaselineComparison[] {
  const { candles, payloadsByGameId = new Map() } = args;
  const payloadFor = (candle: PredictionCandlestick) =>
    payloadsByGameId.get(candle.gameId);

  return [
    buildBaselineComparison({
      key: "home_team_fixed_54",
      label: "Always home team",
      candles,
      probabilityFor: () => 0.54,
    }),
    buildBaselineComparison({
      key: "market_no_vig_moneyline",
      label: "Market no-vig moneyline",
      candles,
      probabilityFor: (candle) =>
        payloadFor(candle)?.market?.homeNoVigProbability ?? null,
    }),
    buildBaselineComparison({
      key: "standings_point_pct",
      label: "Better standings point %",
      candles,
      probabilityFor: (candle) =>
        boundedEdgeProbability(
          payloadFor(candle)?.matchup.homeMinusAwayPointPctg,
          0.3,
          0.53,
          0.68,
        ),
    }),
    buildBaselineComparison({
      key: "goal_differential",
      label: "Better goal differential",
      candles,
      probabilityFor: (candle) =>
        boundedEdgeProbability(
          payloadFor(candle)?.matchup.homeMinusAwayGoalDifferential,
          100,
          0.53,
          0.68,
        ),
    }),
    buildBaselineComparison({
      key: "recent10_goal_differential",
      label: "Better last 10 goal differential",
      candles,
      probabilityFor: (candle) =>
        boundedEdgeProbability(
          payloadFor(candle)?.matchup
            .homeMinusAwayRecent10GoalDifferentialPerGame,
          3,
          0.53,
          0.68,
        ),
    }),
    buildBaselineComparison({
      key: "team_power_composite",
      label: "Team power composite",
      candles,
      probabilityFor: (candle) => {
        const matchup = payloadFor(candle)?.matchup;
        const edge =
          (matchup?.homeMinusAwayOffRating ?? 0) +
          (matchup?.homeMinusAwayDefRating ?? 0) +
          (matchup?.homeMinusAwayGoalieRating ?? 0) +
          (matchup?.homeMinusAwaySpecialRating ?? 0);
        return boundedEdgeProbability(edge, 120, 0.53, 0.72);
      },
    }),
    buildBaselineComparison({
      key: "goalie_gsaa",
      label: "Goalie GSAA edge",
      candles,
      probabilityFor: (candle) =>
        boundedEdgeProbability(
          payloadFor(candle)?.matchup.homeMinusAwayWeightedGoalieGsaaPer60,
          2,
          0.52,
          0.65,
        ),
    }),
  ];
}

export function buildBacktestPhaseSummaries(args: {
  candles: PredictionCandlestick[];
  payloadsByGameId: Map<number, GamePredictionFeatureSnapshotPayload>;
  phaseTrainingCounts?: Map<SeasonPhase, number>;
  phaseModelSourceByGameId?: Map<
    number,
    "phase_specific" | "overall_fallback"
  >;
}): BacktestPhaseSummary[] {
  return SEASON_PHASES.map((phase) => {
    const phaseCandles = args.candles.filter(
      (candle) =>
        args.payloadsByGameId.get(candle.gameId)?.seasonPhase.phase === phase,
    );
    const modelSources = new Set(
      phaseCandles.flatMap((candle) => {
        const source = args.phaseModelSourceByGameId?.get(candle.gameId);
        return source ? [source] : [];
      }),
    );
    const metrics = evaluateProbabilityMetrics(
      phaseCandles.map((candle) => ({
        label: candle.actualHomeWinProbability,
        prediction: candle.finalHomeWinProbability,
      })),
    );
    const correctGames = phaseCandles.filter(
      (candle) => candle.predictedWinnerCorrect,
    ).length;

    return {
      phase,
      trainingExamples: args.phaseTrainingCounts?.get(phase) ?? 0,
      replayGames: phaseCandles.length,
      correctGames,
      accuracy: phaseCandles.length
        ? roundMetric(correctGames / phaseCandles.length)
        : null,
      brierScore: metrics.brierScore,
      logLoss: metrics.logLoss,
      modelSource:
        modelSources.size > 1
          ? "mixed"
          : modelSources.has("phase_specific")
            ? "phase_specific"
            : "overall_fallback",
    };
  });
}

function monitoredBacktestSegmentValue(
  metadata: Record<string, Json> | undefined,
  segmentKey: BacktestMonitoredSegmentKey,
): string | null {
  if (!metadata) return null;
  const value = metadata[segmentKey];
  if (segmentKey === "has_stale_source") {
    return typeof value === "boolean" ? String(value) : null;
  }
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function buildBacktestMonitoredSegmentSummaries(args: {
  candles: PredictionCandlestick[];
  predictionMetadataByGameId: Map<number, Record<string, Json>>;
}): BacktestMonitoredSegmentSummary[] {
  const summaries: BacktestMonitoredSegmentSummary[] = [];

  for (const segmentKey of MONITORED_BACKTEST_SEGMENT_KEYS) {
    const segmentValues = Array.from(
      new Set(
        args.candles
          .map((candle) =>
            monitoredBacktestSegmentValue(
              args.predictionMetadataByGameId.get(candle.gameId),
              segmentKey,
            ),
          )
          .filter((value): value is string => value != null),
      ),
    ).sort();

    for (const segmentValue of segmentValues) {
      const segmentCandles = args.candles.filter(
        (candle) =>
          monitoredBacktestSegmentValue(
            args.predictionMetadataByGameId.get(candle.gameId),
            segmentKey,
          ) === segmentValue,
      );
      const metrics = evaluateProbabilityMetrics(
        segmentCandles.map((candle) => ({
          label: candle.actualHomeWinProbability,
          prediction: candle.finalHomeWinProbability,
        })),
      );
      const correctGames = segmentCandles.filter(
        (candle) => candle.predictedWinnerCorrect,
      ).length;

      summaries.push({
        segmentKey,
        segmentValue,
        replayGames: segmentCandles.length,
        correctGames,
        accuracy: segmentCandles.length
          ? roundMetric(correctGames / segmentCandles.length)
          : null,
        brierScore: metrics.brierScore,
        logLoss: metrics.logLoss,
      });
    }
  }

  return summaries;
}

export function buildConfidenceCalibrationBuckets(
  candles: PredictionCandlestick[],
): ConfidenceCalibrationBucket[] {
  const bucketEdges = [0.5, 0.55, 0.6, 0.65, 0.7, 0.8, 0.9, 1.000001];
  return bucketEdges.slice(0, -1).map((minConfidence, index) => {
    const maxConfidence = bucketEdges[index + 1]!;
    const bucketCandles = candles.filter((candle) => {
      const confidence = Math.max(
        candle.finalHomeWinProbability,
        1 - candle.finalHomeWinProbability,
      );
      return confidence >= minConfidence && confidence < maxConfidence;
    });
    const correctGames = bucketCandles.filter(
      (candle) => candle.predictedWinnerCorrect,
    ).length;
    const confidenceSum = bucketCandles.reduce(
      (sum, candle) =>
        sum +
        Math.max(
          candle.finalHomeWinProbability,
          1 - candle.finalHomeWinProbability,
        ),
      0,
    );

    return {
      label: `${Math.round(minConfidence * 100)}-${Math.round(
        Math.min(1, maxConfidence) * 100,
      )}%`,
      minConfidence,
      maxConfidence: Math.min(1, maxConfidence),
      predictions: bucketCandles.length,
      correctGames,
      accuracy: bucketCandles.length
        ? roundMetric(correctGames / bucketCandles.length)
        : null,
      averageConfidence: bucketCandles.length
        ? roundMetric(confidenceSum / bucketCandles.length)
        : null,
    };
  });
}

export function calibrationMaxGapFromBuckets(
  buckets: ConfidenceCalibrationBucket[],
): number | null {
  const gaps = buckets.flatMap((bucket) => {
    if (bucket.accuracy == null || bucket.averageConfidence == null) return [];
    return [Math.abs(bucket.accuracy - bucket.averageConfidence)];
  });
  return gaps.length > 0 ? roundMetric(Math.max(...gaps)) : null;
}

function activeFeatureKeys(
  options?: BaselineFeatureVectorOptions,
): BaselineFeatureKey[] {
  const defaultExcluded: readonly BaselineFeatureKey[] =
    options?.includeDefaultExcludedFeatureKeys
      ? []
      : [
          "homeMinusAwayRecent10PointPct",
          ...CANDIDATE_ONLY_FEATURE_KEYS,
        ];
  const excluded = new Set<BaselineFeatureKey>([
    ...defaultExcluded,
    ...(options?.excludedFeatureKeys ?? []),
  ]);
  return BASELINE_FEATURE_KEYS.filter((featureKey) => !excluded.has(featureKey));
}

function excludeFeatureKey(
  options: BaselineFeatureVectorOptions | undefined,
  featureKey: BaselineFeatureKey,
): BaselineFeatureVectorOptions {
  return {
    ...options,
    excludedFeatureKeys: Array.from(
      new Set([...(options?.excludedFeatureKeys ?? []), featureKey]),
    ),
  };
}

export function applyMarketFeatureTrainingGuardrailToVariants(args: {
  variants: readonly BacktestAblationVariant[];
  marketSourceReadiness: AccuracyLoopMarketOddsSourceReadiness;
}): BacktestAblationVariant[] {
  if (args.marketSourceReadiness.trainingFeatureEligible) {
    return [...args.variants];
  }

  return args.variants.map((variant) => {
    if (!activeFeatureKeys(variant.featureVectorOptions).includes("homeMarketNoVigProbability")) {
      return variant;
    }

    return {
      ...variant,
      featureVectorOptions: excludeFeatureKey(
        variant.featureVectorOptions,
        "homeMarketNoVigProbability",
      ),
      modelAuditMetadata: {
        ...variant.modelAuditMetadata,
        marketFeatureSuppressedBySourceReadiness: true,
        marketFeatureGuardrailReason:
          "market_odds_source_readiness_not_training_eligible",
      },
    };
  });
}

function buildPromotionMetricSummary(args: {
  summary: AccountabilitySummary;
  calibrationBuckets: ConfidenceCalibrationBucket[];
}): PromotionMetricSummary {
  return {
    logLoss: args.summary.logLoss,
    brierScore: args.summary.brierScore,
    calibrationMaxGap: calibrationMaxGapFromBuckets(args.calibrationBuckets),
    evaluatedGames: args.summary.evaluatedGames,
  };
}

function strongestSimpleBaselineFloor(
  comparisons: BacktestBaselineComparison[] | undefined,
): BacktestPromotionEvidence["simpleBaselineFloor"] {
  const eligibleBaselines = (comparisons ?? [])
    .filter(
      (baseline) =>
        baseline.key !== "market_no_vig_moneyline" &&
        baseline.evaluatedGames > 0 &&
        baseline.logLoss != null &&
        baseline.brierScore != null,
    )
    .sort((left, right) => {
      const logLossDelta = (left.logLoss ?? Infinity) - (right.logLoss ?? Infinity);
      if (Math.abs(logLossDelta) > 1e-12) return logLossDelta;
      return (left.brierScore ?? Infinity) - (right.brierScore ?? Infinity);
    });
  const strongest = eligibleBaselines[0];
  if (!strongest) return null;

  return {
    key: strongest.key,
    label: strongest.label,
    evaluatedGames: strongest.evaluatedGames,
    accuracy: strongest.accuracy,
    logLoss: strongest.logLoss,
    brierScore: strongest.brierScore,
    calibrationMaxGap: null,
  };
}

export function countBacktestSegmentRegressions(args: {
  baseline: BacktestPhaseSummary[];
  candidate: BacktestPhaseSummary[];
  minSegmentGames?: number;
  maxBrierRegression?: number;
  maxLogLossRegression?: number;
}): BacktestSegmentRegression[] {
  const minSegmentGames = args.minSegmentGames ?? 20;
  const maxBrierRegression = args.maxBrierRegression ?? 0.005;
  const maxLogLossRegression = args.maxLogLossRegression ?? 0.01;
  return args.candidate.flatMap((candidateSegment) => {
    const baselineSegment = args.baseline.find(
      (segment) => segment.phase === candidateSegment.phase,
    );
    if (
      !baselineSegment ||
      baselineSegment.replayGames < minSegmentGames ||
      candidateSegment.replayGames < minSegmentGames
    ) {
      return [];
    }
    const brierDelta = deltaMetric(
      candidateSegment.brierScore,
      baselineSegment.brierScore,
    );
    const logLossDelta = deltaMetric(
      candidateSegment.logLoss,
      baselineSegment.logLoss,
    );
    if (
      (brierDelta != null && brierDelta > maxBrierRegression) ||
      (logLossDelta != null && logLossDelta > maxLogLossRegression)
    ) {
      return [{
        segmentType: "season_phase" as const,
        segmentKey: candidateSegment.phase,
        baselineGames: baselineSegment.replayGames,
        candidateGames: candidateSegment.replayGames,
        brierDelta,
        logLossDelta,
      }];
    }
    return [];
  });
}

export function buildBacktestPromotionEvidence(args: {
  baseline: BacktestAblationComparison;
  candidate: BacktestAblationComparison;
  candidateFeatureVectorOptions?: BaselineFeatureVectorOptions;
  marketBaselineComparison?: BacktestBaselineComparison;
  marketSourceReadiness?: AccuracyLoopMarketOddsSourceReadiness | null;
  candidateBaselineComparisons?: BacktestBaselineComparison[];
}): BacktestPromotionEvidence {
  const candidateActiveFeatureKeys = activeFeatureKeys(
    args.candidateFeatureVectorOptions,
  );
  const activeUnexplainedFeatureKeys = candidateActiveFeatureKeys.filter(
    (featureKey) => !PUBLIC_EXPLANATION_FEATURE_KEYS.includes(featureKey),
  );
  const usesMarketFeatures = candidateActiveFeatureKeys.includes(
    "homeMarketNoVigProbability",
  );
  const requiredMarketGames = args.candidate.summary.evaluatedGames;
  const marketEvaluatedGames =
    args.marketBaselineComparison?.evaluatedGames ?? 0;
  const marketCoveragePct =
    requiredMarketGames > 0
      ? roundMetric(marketEvaluatedGames / requiredMarketGames)
      : null;
  const marketBaselineCoverageComplete =
    requiredMarketGames > 0 && marketEvaluatedGames >= requiredMarketGames;
  const marketSourceTrainingEligible =
    args.marketSourceReadiness?.trainingFeatureEligible ?? false;
  const marketFeatureSuppressedBySourceReadiness =
    args.candidate.modelAuditMetadata.marketFeatureSuppressedBySourceReadiness ===
    true;
  const marketFeatureTrainingEligible =
    usesMarketFeatures
      ? marketBaselineCoverageComplete && marketSourceTrainingEligible
      : !marketFeatureSuppressedBySourceReadiness;
  const segmentRegressions = countBacktestSegmentRegressions({
    baseline: args.baseline.phaseSummaries,
    candidate: args.candidate.phaseSummaries,
  });
  const current = buildPromotionMetricSummary({
    summary: args.baseline.summary,
    calibrationBuckets: args.baseline.calibrationBuckets,
  });
  const candidate = buildPromotionMetricSummary({
    summary: args.candidate.summary,
    calibrationBuckets: args.candidate.calibrationBuckets,
  });
  const simpleBaselineFloor = strongestSimpleBaselineFloor(
    args.candidateBaselineComparisons,
  );
  const explanationBlockers: string[] = [];
  if (activeUnexplainedFeatureKeys.length > 0) {
    explanationBlockers.push("active_unexplained_feature_keys");
  }
  if (args.candidate.modelFamily === "extra_trees") {
    explanationBlockers.push("extra_trees_requires_surrogate_explanation");
  }
  const publicExplanationReady = explanationBlockers.length === 0;

  return {
    candidateKey: args.candidate.key,
    baselineKey: args.baseline.key,
    current,
    candidate,
    simpleBaselineFloor,
    usesMarketFeatures,
    marketFeatureTrainingEligible,
    marketSourceTrainingEligible,
    marketFeatureSuppressedBySourceReadiness,
    marketBaselineCoverage: {
      evaluatedGames: marketEvaluatedGames,
      requiredGames: requiredMarketGames,
      coveragePct: marketCoveragePct,
    },
    marketSourceReadiness: args.marketSourceReadiness ?? null,
    publicExplanationReady,
    explanationBlockers,
    activeUnexplainedFeatureKeys,
    segmentRegressionCount: segmentRegressions.length,
    segmentRegressions,
    decision: decidePromotion({
      current,
      candidate,
      simpleBaselineFloor,
      usesMarketFeatures,
      marketFeatureTrainingEligible,
      segmentRegressionCount: segmentRegressions.length,
      publicExplanationReady,
    }),
  };
}

function ablationAlgorithm(variant: BacktestAblationComparison): string {
  if (variant.modelFamily === "extra_trees") {
    return variant.calibrationMethod === "platt"
      ? "calibrated_extra_trees_candidate"
      : "extra_trees_candidate";
  }
  if (variant.phaseSpecificTraining) {
    return variant.calibrationMethod === "platt"
      ? "calibrated_logistic_by_season_phase"
      : "regularized_logistic_by_season_phase";
  }
  if (variant.probabilityBlend?.method === "training_home_prior") {
    return "regularized_logistic_training_home_prior_blend";
  }
  return variant.calibrationMethod === "platt"
    ? "calibrated_regularized_logistic"
    : "regularized_logistic";
}

export function buildAblationPromotionEvidenceModelVersionRows(args: {
  result: BacktestAblationResult;
  generatedAt?: string;
}): Database["public"]["Tables"]["game_prediction_model_versions"]["Insert"][] {
  const generatedAt = args.generatedAt ?? args.result.generatedAt;
  const evidenceByCandidateKey = new Map(
    args.result.promotionEvidence.map((evidence) => [
      evidence.candidateKey,
      evidence,
    ]),
  );
  const compactRunSourceReadiness = compactSourceReadinessForMetadata(
    args.result.sourceReadiness,
  );

  return args.result.variants.map((variant) => {
    const evidence = evidenceByCandidateKey.get(variant.key) ?? null;
    const compactEvidence = compactPromotionEvidenceForMetadata(evidence);
    const promotionStatus = evidence
      ? evidence.decision.promote
        ? "eligible_for_manual_promotion"
        : "rejected_by_guardrails"
      : "baseline_reference";

    return {
      model_name: args.result.modelName,
      model_version: variant.modelVersion,
      feature_set_version: args.result.featureSetVersion,
      algorithm: ablationAlgorithm(variant),
      status: evidence?.decision.promote === false ? "rejected" : "candidate",
      training_start_date: args.result.trainingStartDate,
      training_end_date: args.result.trainingEndDate,
      validation_start_date: args.result.replayStartDate,
      validation_end_date: args.result.replayEndDate,
      training_metrics: {
        phase_summaries: variant.phaseSummaries,
        training_window: {
          start_date: args.result.trainingStartDate,
          end_date: args.result.trainingEndDate,
        },
      } as unknown as Json,
      validation_metrics: {
        summary: variant.summary,
        calibration_buckets: variant.calibrationBuckets,
        monitored_segment_summaries: variant.monitoredSegmentSummaries,
        delta_vs_baseline: variant.deltaVsBaseline,
        recommendation: variant.recommendation,
        promotion_evidence: compactEvidence,
      } as unknown as Json,
      source_audit_metadata: {
        uses_market_features: evidence?.usesMarketFeatures ?? false,
        market_feature_training_eligible:
          evidence?.marketFeatureTrainingEligible ?? null,
        market_source_training_eligible:
          evidence?.marketSourceTrainingEligible ?? null,
        market_feature_suppressed_by_source_readiness:
          evidence?.marketFeatureSuppressedBySourceReadiness ?? false,
        market_baseline_coverage: evidence?.marketBaselineCoverage ?? null,
        market_source_readiness: compactEvidence?.marketSourceReadiness ?? null,
        run_source_readiness: compactRunSourceReadiness,
        public_explanation_ready: evidence?.publicExplanationReady ?? null,
        explanation_blockers: evidence?.explanationBlockers ?? [],
        active_unexplained_feature_keys:
          evidence?.activeUnexplainedFeatureKeys ?? [],
        segment_regression_count: evidence?.segmentRegressionCount ?? 0,
        segment_regressions: evidence?.segmentRegressions ?? [],
      } as unknown as Json,
      metadata: {
        accuracy_improvement_ablation: true,
        generated_at: generatedAt,
        baseline_key: args.result.baselineKey,
        candidate_key: variant.key,
        label: variant.label,
        promotion_status: promotionStatus,
        promotion_decision: evidence?.decision ?? null,
        promotion_evidence: compactEvidence,
        validation_window: {
          start_date: args.result.replayStartDate,
          end_date: args.result.replayEndDate,
          evaluated_games: variant.summary.evaluatedGames,
        },
        baseline_floor: evidence?.simpleBaselineFloor ?? null,
        market_source_readiness: compactEvidence?.marketSourceReadiness ?? null,
        source_readiness: compactRunSourceReadiness,
        excluded_feature_keys: variant.excludedFeatureKeys,
        model_family: variant.modelFamily,
        calibration_method: variant.calibrationMethod,
        probability_blend: variant.probabilityBlend,
        phase_specific_training: variant.phaseSpecificTraining,
        minimum_phase_training_examples: variant.minimumPhaseTrainingExamples,
        winner_decision_threshold: variant.winnerDecisionThreshold,
        model_audit: variant.modelAuditMetadata,
      } as unknown as Json,
      updated_at: new Date().toISOString(),
    };
  });
}

export function buildAblationPromotionEvidenceMetricRows(args: {
  result: BacktestAblationResult;
  generatedAt?: string;
}): Database["public"]["Tables"]["game_prediction_model_metrics"]["Insert"][] {
  if (!args.result.replayStartDate || !args.result.replayEndDate) return [];
  const generatedAt = args.generatedAt ?? args.result.generatedAt;
  const evaluationStartDate = args.result.replayStartDate;
  const evaluationEndDate = args.result.replayEndDate;
  const evidenceByCandidateKey = new Map(
    args.result.promotionEvidence.map((evidence) => [
      evidence.candidateKey,
      evidence,
    ]),
  );

  return args.result.variants.flatMap((variant) => {
    const evidence = evidenceByCandidateKey.get(variant.key) ?? null;
    const baseMetadata = {
      accuracy_improvement_ablation: true,
      generated_at: generatedAt,
      baseline_key: args.result.baselineKey,
      candidate_key: variant.key,
      recommendation: variant.recommendation,
      model_family: variant.modelFamily,
      calibration_method: variant.calibrationMethod,
      promotion_status: evidence
        ? evidence.decision.promote
          ? "eligible_for_manual_promotion"
          : "rejected_by_guardrails"
        : "baseline_reference",
      promotion_decision: evidence?.decision ?? null,
    };
    const rows: Database["public"]["Tables"]["game_prediction_model_metrics"]["Insert"][] = [
      {
        model_name: args.result.modelName,
        model_version: variant.modelVersion,
        feature_set_version: args.result.featureSetVersion,
        evaluation_start_date: evaluationStartDate,
        evaluation_end_date: evaluationEndDate,
        segment_key: "overall",
        segment_value: "all",
        evaluated_games: variant.summary.evaluatedGames,
        log_loss: variant.summary.logLoss,
        brier_score: variant.summary.brierScore,
        accuracy: variant.summary.accuracy,
        auc: null,
        calibration: variant.calibrationBuckets as unknown as Json,
        coverage: {
          evaluated_games: variant.summary.evaluatedGames,
          correct_games: variant.summary.correctGames,
          wrong_games: variant.summary.wrongGames,
          rolling_10_accuracy: variant.summary.rolling10Accuracy,
          rolling_25_accuracy: variant.summary.rolling25Accuracy,
          rolling_50_accuracy: variant.summary.rolling50Accuracy,
          prediction_snapshots: null,
        } as unknown as Json,
        metadata: baseMetadata as unknown as Json,
        computed_at: generatedAt,
      },
    ];

    for (const phase of variant.phaseSummaries) {
      rows.push({
        model_name: args.result.modelName,
        model_version: variant.modelVersion,
        feature_set_version: args.result.featureSetVersion,
        evaluation_start_date: evaluationStartDate,
        evaluation_end_date: evaluationEndDate,
        segment_key: "season_phase",
        segment_value: phase.phase,
        evaluated_games: phase.replayGames,
        log_loss: phase.logLoss,
        brier_score: phase.brierScore,
        accuracy: phase.accuracy,
        auc: null,
        calibration: [] as unknown as Json,
        coverage: {
          evaluated_games: phase.replayGames,
          correct_games: phase.correctGames,
          training_examples: phase.trainingExamples,
          model_source: phase.modelSource,
        } as unknown as Json,
        metadata: {
          ...baseMetadata,
          segment_source: "walk_forward_phase_summary",
        } as unknown as Json,
        computed_at: generatedAt,
      });
    }

    for (const segment of variant.monitoredSegmentSummaries) {
      rows.push({
        model_name: args.result.modelName,
        model_version: variant.modelVersion,
        feature_set_version: args.result.featureSetVersion,
        evaluation_start_date: evaluationStartDate,
        evaluation_end_date: evaluationEndDate,
        segment_key: segment.segmentKey,
        segment_value: segment.segmentValue,
        evaluated_games: segment.replayGames,
        log_loss: segment.logLoss,
        brier_score: segment.brierScore,
        accuracy: segment.accuracy,
        auc: null,
        calibration: [] as unknown as Json,
        coverage: {
          evaluated_games: segment.replayGames,
          correct_games: segment.correctGames,
        } as unknown as Json,
        metadata: {
          ...baseMetadata,
          segment_source: "walk_forward_prediction_metadata",
        } as unknown as Json,
        computed_at: generatedAt,
      });
    }

    return rows;
  });
}

export async function persistAblationPromotionEvidence(args: {
  client: SupabaseClient<Database>;
  result: BacktestAblationResult;
}): Promise<void> {
  const rows = buildAblationPromotionEvidenceModelVersionRows({
    result: args.result,
  });
  if (rows.length === 0) return;
  const metricRows = buildAblationPromotionEvidenceMetricRows({
    result: args.result,
  });
  const { error } = await args.client
    .from("game_prediction_model_versions")
    .upsert(rows, {
      onConflict: "model_name,model_version,feature_set_version",
    });
  if (error) throw error;
  if (metricRows.length === 0) return;
  const { error: metricError } = await args.client
    .from("game_prediction_model_metrics")
    .upsert(metricRows, {
      onConflict:
        "model_name,model_version,feature_set_version,evaluation_start_date,evaluation_end_date,segment_key,segment_value",
    });
  if (metricError) throw metricError;
}

export function buildAccountabilityDashboard(args: {
  modelName: string;
  modelVersion: string;
  featureSetVersion: string;
  candles: PredictionCandlestick[];
  baselineComparisons?: BacktestBaselineComparison[];
  calibrationBuckets?: ConfidenceCalibrationBucket[];
  generatedAt?: string;
}): AccountabilityDashboard {
  const candles = [...args.candles].sort((a, b) =>
    a.snapshotDate === b.snapshotDate
      ? a.gameId - b.gameId
      : a.snapshotDate.localeCompare(b.snapshotDate),
  );

  return {
    generatedAt: args.generatedAt ?? new Date().toISOString(),
    modelName: args.modelName,
    modelVersion: args.modelVersion,
    featureSetVersion: args.featureSetVersion,
    summary: buildAccountabilitySummary(candles),
    daily: buildAccountabilityDailySeries(candles),
    candles,
    baselineComparisons: args.baselineComparisons,
    calibrationBuckets: args.calibrationBuckets,
  };
}

export async function fetchAccountabilityDashboard(args: {
  client: SupabaseClient<Database>;
  modelName?: string;
  modelVersion?: string;
  featureSetVersion?: string;
  backtestRunId?: string;
  latestBacktest?: boolean;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}): Promise<AccountabilityDashboard> {
  const modelName = args.modelName ?? BASELINE_MODEL_NAME;
  const modelVersion = args.modelVersion ?? BASELINE_MODEL_VERSION;
  const featureSetVersion =
    args.featureSetVersion ?? GAME_PREDICTION_FEATURE_SET_VERSION;
  const limit = Math.min(Math.max(args.limit ?? 250, 1), 1000);
  if (args.backtestRunId || args.latestBacktest) {
    return fetchPersistedBacktestDashboard({
      client: args.client,
      modelName,
      modelVersion: args.modelVersion,
      featureSetVersion,
      backtestRunId: args.backtestRunId,
      limit,
    });
  }

  let query = args.client
    .from("game_prediction_history")
    .select(
      "prediction_id,game_id,snapshot_date,prediction_cutoff_at,model_name,model_version,feature_set_version,home_team_id,away_team_id,home_win_probability,away_win_probability,predicted_winner_team_id,confidence_label,metadata,computed_at",
    )
    .eq("prediction_scope", "pregame")
    .eq("model_name", modelName)
    .eq("model_version", modelVersion)
    .eq("feature_set_version", featureSetVersion)
    .order("snapshot_date", { ascending: true })
    .order("prediction_cutoff_at", { ascending: true })
    .limit(limit * 5);

  if (args.fromDate) query = query.gte("snapshot_date", args.fromDate);
  if (args.toDate) query = query.lte("snapshot_date", args.toDate);

  const { data, error } = await query;
  if (error) throw error;

  const predictions = (data ?? []) as AccountabilityPredictionRow[];
  const gameIds = Array.from(new Set(predictions.map((row) => row.game_id)));
  const teamIds = Array.from(
    new Set(predictions.flatMap((row) => [row.home_team_id, row.away_team_id])),
  );

  const [gamesResult, teamsResult, outcomes] = await Promise.all([
    gameIds.length
      ? args.client
          .from("games")
          .select("id,date,startTime,seasonId,homeTeamId,awayTeamId,type")
          .in("id", gameIds)
      : Promise.resolve({ data: [], error: null }),
    teamIds.length
      ? args.client
          .from("teams")
          .select("id,abbreviation,name")
          .in("id", teamIds)
      : Promise.resolve({ data: [], error: null }),
    fetchCompletedGameOutcomes(args.client, gameIds),
  ]);
  if (gamesResult.error) throw gamesResult.error;
  if (teamsResult.error) throw teamsResult.error;

  const gamesById = new Map(
    ((gamesResult.data ?? []) as AccountabilityGameRow[]).map((game) => [
      game.id,
      game,
    ]),
  );
  const teamsById = new Map(
    ((teamsResult.data ?? []) as AccountabilityTeamRow[]).map((team) => [
      team.id,
      team,
    ]),
  );
  const outcomesByGameId = new Map(
    outcomes.map((outcome) => [outcome.gameId, outcome]),
  );
  const predictionsByGameId = new Map<number, AccountabilityPredictionRow[]>();
  for (const prediction of predictions) {
    predictionsByGameId.set(prediction.game_id, [
      ...(predictionsByGameId.get(prediction.game_id) ?? []),
      prediction,
    ]);
  }

  const candles = Array.from(predictionsByGameId.entries())
    .flatMap(([gameId, gamePredictions]) => {
      const outcome = outcomesByGameId.get(gameId);
      if (!outcome) return [];
      const candle = buildPredictionCandlestick({
        predictions: gamePredictions,
        outcome,
        game: gamesById.get(gameId),
        teamsById,
      });
      return candle ? [candle] : [];
    })
    .slice(-limit);

  return buildAccountabilityDashboard({
    modelName,
    modelVersion,
    featureSetVersion,
    candles,
  });
}

async function fetchPersistedBacktestDashboard(args: {
  client: SupabaseClient<Database>;
  modelName: string;
  modelVersion?: string;
  featureSetVersion: string;
  backtestRunId?: string;
  limit: number;
}): Promise<AccountabilityDashboard> {
  let backtestRunId = args.backtestRunId;
  let modelVersion = args.modelVersion;
  let modelName = args.modelName;
  let featureSetVersion = args.featureSetVersion;

  let runQuery = args.client
    .from("game_prediction_backtest_runs" as any)
    .select(
      "backtest_run_id,model_name,model_version,feature_set_version,metadata,completed_at",
    )
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1);
  if (backtestRunId) {
    runQuery = runQuery.eq("backtest_run_id", backtestRunId);
  } else if (args.modelVersion) {
    runQuery = runQuery.eq("model_version", args.modelVersion);
  }

  const { data: runRows, error: runError } = await runQuery;
  if (runError) throw runError;
  const latestRun = (runRows ?? [])[0] as any;
  if (!latestRun) {
    return buildAccountabilityDashboard({
      modelName,
      modelVersion: modelVersion ?? BASELINE_MODEL_VERSION,
      featureSetVersion,
      candles: [],
    });
  }

  backtestRunId = String(latestRun.backtest_run_id);
  modelName = String(latestRun.model_name);
  modelVersion = String(latestRun.model_version);
  featureSetVersion = String(latestRun.feature_set_version);
  const runMetadata =
    latestRun.metadata && typeof latestRun.metadata === "object"
      ? latestRun.metadata
      : {};

  const { data, error } = await args.client
    .from("game_prediction_accountability_games" as any)
    .select(
      "game_id,snapshot_date,home_team_id,away_team_id,open_home_win_probability,low_home_win_probability,high_home_win_probability,final_home_win_probability,actual_home_win_probability,prediction_count,predicted_winner_team_id,actual_winner_team_id,predicted_winner_correct,home_score,away_score,probability_spread,final_prediction_cutoff_at",
    )
    .eq("backtest_run_id", backtestRunId)
    .order("snapshot_date", { ascending: true })
    .limit(args.limit);
  if (error) throw error;

  const rows = (data ?? []) as any[];
  const teamIds = Array.from(
    new Set(rows.flatMap((row) => [row.home_team_id, row.away_team_id])),
  );
  const { data: teamRows, error: teamError } = teamIds.length
    ? await args.client
        .from("teams")
        .select("id,abbreviation,name")
        .in("id", teamIds)
    : { data: [], error: null };
  if (teamError) throw teamError;
  const teamsById = new Map(
    ((teamRows ?? []) as AccountabilityTeamRow[]).map((team) => [
      team.id,
      team,
    ]),
  );

  const candles: PredictionCandlestick[] = rows.map((row) => ({
    gameId: Number(row.game_id),
    snapshotDate: String(row.snapshot_date),
    startTime: null,
    homeTeamId: Number(row.home_team_id),
    awayTeamId: Number(row.away_team_id),
    homeTeamAbbreviation: teamAbbreviation(teamsById, Number(row.home_team_id)),
    awayTeamAbbreviation: teamAbbreviation(teamsById, Number(row.away_team_id)),
    openHomeWinProbability: Number(row.open_home_win_probability),
    lowHomeWinProbability: Number(row.low_home_win_probability),
    highHomeWinProbability: Number(row.high_home_win_probability),
    finalHomeWinProbability: Number(row.final_home_win_probability),
    actualHomeWinProbability: Number(row.actual_home_win_probability) as 0 | 1,
    probabilitySpread: Number(row.probability_spread),
    predictionCount: Number(row.prediction_count),
    finalPredictionId: null,
    finalPredictionCutoffAt: String(row.final_prediction_cutoff_at),
    predictedWinnerTeamId: Number(row.predicted_winner_team_id),
    actualWinnerTeamId: Number(row.actual_winner_team_id),
    predictedWinnerCorrect: Boolean(row.predicted_winner_correct),
    homeScore: Number(row.home_score),
    awayScore: Number(row.away_score),
  }));

  return buildAccountabilityDashboard({
    modelName,
    modelVersion: modelVersion ?? BASELINE_MODEL_VERSION,
    featureSetVersion,
    candles,
    baselineComparisons: Array.isArray(runMetadata.baseline_comparisons)
      ? runMetadata.baseline_comparisons
      : undefined,
    calibrationBuckets: Array.isArray(runMetadata.calibration_buckets)
      ? runMetadata.calibration_buckets
      : undefined,
  });
}

async function fetchCompletedSeasonGames(args: {
  client: SupabaseClient<Database>;
  seasonId: number;
  gameType?: number;
}): Promise<{
  games: AccountabilityGameRow[];
  outcomes: CompletedGameOutcome[];
}> {
  let gamesQuery = args.client
    .from("games")
    .select("id,date,startTime,seasonId,homeTeamId,awayTeamId,type")
    .eq("seasonId", args.seasonId)
    .order("date", { ascending: true })
    .order("startTime", { ascending: true });

  if (args.gameType != null) gamesQuery = gamesQuery.eq("type", args.gameType);

  const { data, error } = await gamesQuery;
  if (error) throw error;

  const games = (data ?? []) as AccountabilityGameRow[];
  const outcomes = await fetchCompletedGameOutcomes(
    args.client,
    games.map((game) => game.id),
  );
  const outcomeGameIds = new Set(outcomes.map((outcome) => outcome.gameId));

  return {
    games: games.filter((game) => outcomeGameIds.has(game.id)),
    outcomes,
  };
}

export function buildMarketOddsSourceReadiness(args: {
  games: AccountabilityGameRow[];
  oddsRows: MarketOddsSourceAuditRow[];
  provenanceRows: SourceProvenanceAuditRow[];
}): AccuracyLoopMarketOddsSourceReadiness {
  const gamesById = new Map(args.games.map((game) => [game.id, game]));
  const requiredGameIds = new Set(args.games.map((game) => game.id));
  const snapshotGameIds = new Set(
    args.oddsRows
      .filter((row) => requiredGameIds.has(row.game_id))
      .map((row) => row.game_id),
  );
  const preCutoffEligibleGameIds = new Set<number>();
  const trustedSnapshotSourceGameIds = new Set<number>();
  const trustedSnapshotSourceNames = new Set<string>();
  const trustedImportBatchIds = new Set<string>();

  for (const row of args.oddsRows) {
    const game = gamesById.get(row.game_id);
    if (!game) continue;
    const cutoff = marketOddsReadinessCutoff({
      game,
      eventStartAt: row.event_start_at,
    });
    if (isoBefore(row.captured_at, cutoff)) {
      preCutoffEligibleGameIds.add(row.game_id);
      const rowSourceName = marketOddsSnapshotSourceName(row);
      if (
        rowSourceName &&
        MARKET_ODDS_OBSERVED_SOURCE_NAMES.includes(rowSourceName)
      ) {
        trustedSnapshotSourceGameIds.add(row.game_id);
        trustedSnapshotSourceNames.add(rowSourceName);
        const importBatchId = marketOddsSnapshotImportBatchId(row);
        if (importBatchId) {
          trustedImportBatchIds.add(importBatchId);
        }
      }
    }
  }

  const marketProvenanceRows = args.provenanceRows.filter(
    (row) =>
      requiredGameIds.has(row.game_id) &&
      row.source_type === "game_prediction_market_odds" &&
      MARKET_ODDS_OBSERVED_SOURCE_NAMES.includes(row.source_name) &&
      row.status === "observed",
  );
  const rejectedMarketProvenanceRows = args.provenanceRows.filter(
    (row) =>
      requiredGameIds.has(row.game_id) &&
      row.source_type === "game_prediction_market_odds" &&
      MARKET_ODDS_REJECTED_SOURCE_NAMES.includes(row.source_name) &&
      row.status === "rejected",
  );
  const provenanceGameIds = new Set<number>();
  const freshProvenanceGameIds = new Set<number>();
  const rejectedProvenanceGameIds = new Set<number>();

  for (const row of marketProvenanceRows) {
    const game = gamesById.get(row.game_id);
    if (!game) continue;
    const cutoff = marketOddsReadinessCutoff({ game });
    if (!isoBefore(row.observed_at, cutoff)) continue;
    provenanceGameIds.add(row.game_id);
    if (isoAtOrAfter(row.freshness_expires_at, cutoff)) {
      freshProvenanceGameIds.add(row.game_id);
      const importBatchId = sourceProvenanceImportBatchId(row);
      if (importBatchId) {
        trustedImportBatchIds.add(importBatchId);
      }
    }
  }
  for (const row of rejectedMarketProvenanceRows) {
    rejectedProvenanceGameIds.add(row.game_id);
  }

  const requiredGames = requiredGameIds.size;
  const staleProvenanceGameIds = Array.from(provenanceGameIds)
    .filter((gameId) => !freshProvenanceGameIds.has(gameId))
    .sort((left, right) => left - right);
  const warnings: string[] = [];

  if (requiredGames === 0) {
    warnings.push("no_completed_games_in_accuracy_loop_window");
  }
  if (preCutoffEligibleGameIds.size < requiredGames) {
    warnings.push("market_odds_snapshots_missing_or_after_prediction_cutoff");
  }
  if (trustedSnapshotSourceGameIds.size < requiredGames) {
    warnings.push("market_odds_snapshot_source_provenance_missing_or_untrusted");
  }
  if (provenanceGameIds.size < requiredGames) {
    warnings.push("market_odds_source_provenance_missing");
  }
  if (staleProvenanceGameIds.length > 0) {
    warnings.push("market_odds_source_provenance_stale_before_cutoff");
  }
  if (rejectedProvenanceGameIds.size > 0) {
    warnings.push("market_odds_source_provenance_rejected");
  }

  const trainingFeatureEligible =
    requiredGames > 0 &&
    preCutoffEligibleGameIds.size === requiredGames &&
    trustedSnapshotSourceGameIds.size === requiredGames &&
    freshProvenanceGameIds.size === requiredGames;

  return {
    sourceId: "market_odds_snapshots",
    sourceName: "espn_site_api_market_odds",
    acceptedSourceNames: Array.from(MARKET_ODDS_OBSERVED_SOURCE_NAMES),
    trustedSnapshotSourceNames: sortedStrings(trustedSnapshotSourceNames),
    trustedImportBatchIds: sortedStrings(trustedImportBatchIds),
    requiredGames,
    snapshotGames: snapshotGameIds.size,
    preCutoffEligibleGames: preCutoffEligibleGameIds.size,
    trustedSnapshotSourceGames: trustedSnapshotSourceGameIds.size,
    provenanceGames: provenanceGameIds.size,
    freshProvenanceGames: freshProvenanceGameIds.size,
    rejectedProvenanceGames: rejectedProvenanceGameIds.size,
    snapshotCoveragePct: coveragePct(snapshotGameIds.size, requiredGames),
    preCutoffEligibleCoveragePct: coveragePct(
      preCutoffEligibleGameIds.size,
      requiredGames,
    ),
    trustedSnapshotSourceCoveragePct: coveragePct(
      trustedSnapshotSourceGameIds.size,
      requiredGames,
    ),
    provenanceCoveragePct: coveragePct(provenanceGameIds.size, requiredGames),
    freshProvenanceCoveragePct: coveragePct(
      freshProvenanceGameIds.size,
      requiredGames,
    ),
    rejectedProvenanceCoveragePct: coveragePct(
      rejectedProvenanceGameIds.size,
      requiredGames,
    ),
    trainingFeatureEligible,
    missingSnapshotGameIds: sortedMissingGameIds(
      requiredGameIds,
      snapshotGameIds,
    ),
    missingPreCutoffEligibleGameIds: sortedMissingGameIds(
      requiredGameIds,
      preCutoffEligibleGameIds,
    ),
    missingTrustedSnapshotSourceGameIds: sortedMissingGameIds(
      requiredGameIds,
      trustedSnapshotSourceGameIds,
    ),
    missingProvenanceGameIds: sortedMissingGameIds(
      requiredGameIds,
      provenanceGameIds,
    ),
    staleProvenanceGameIds,
    rejectedProvenanceGameIds: Array.from(rejectedProvenanceGameIds).sort(
      (left, right) => left - right,
    ),
    warnings,
  };
}

export function selectAccuracyLoopSourceReadinessGames(args: {
  games: AccountabilityGameRow[];
  trainStartDate?: string;
  blindDate?: string;
  replayEndDate?: string;
  analysisEndDate?: string;
  horizonDays?: number[];
  maxSimulationDays?: number;
  maxTrainingGames?: number;
  maxReplayGames?: number;
}): AccountabilityGameRow[] {
  const sortedGames = [...args.games].sort((left, right) => {
    if (left.date !== right.date) return left.date.localeCompare(right.date);
    const startCompare = (left.startTime ?? "").localeCompare(
      right.startTime ?? "",
    );
    return startCompare !== 0 ? startCompare : left.id - right.id;
  });
  const applyLimit = (
    games: AccountabilityGameRow[],
    limit: number | undefined,
    direction: "first" | "last",
  ) => {
    if (!limit) return games;
    const boundedLimit = Math.max(1, limit);
    return direction === "first"
      ? games.slice(0, boundedLimit)
      : games.slice(-boundedLimit);
  };
  const windowEndDate =
    args.replayEndDate ??
    args.analysisEndDate ??
    sortedGames[sortedGames.length - 1]?.date;

  if (args.blindDate) {
    const trainingGames = applyLimit(
      sortedGames.filter(
        (game) =>
          (!args.trainStartDate || game.date >= args.trainStartDate) &&
          game.date <= args.blindDate!,
      ),
      args.maxTrainingGames,
      "last",
    );
    const replayGames = applyLimit(
      sortedGames.filter(
        (game) =>
          game.date > args.blindDate! &&
          (!windowEndDate || game.date <= windowEndDate),
      ),
      args.maxReplayGames,
      "first",
    );
    const replayGamesByDate = new Map<string, AccountabilityGameRow[]>();
    for (const game of replayGames) {
      replayGamesByDate.set(game.date, [
        ...(replayGamesByDate.get(game.date) ?? []),
        game,
      ]);
    }
    const replayEndDate =
      replayGames[replayGames.length - 1]?.date ?? args.blindDate;
    const simulationDates = enumerateDates(args.blindDate, replayEndDate).slice(
      0,
      args.maxSimulationDays,
    );
    const horizonDays = normalizeHorizonDays(args.horizonDays);
    const evaluatedReplayGames = new Map<number, AccountabilityGameRow>();
    for (const simulationDate of simulationDates) {
      for (const horizonDaysValue of horizonDays) {
        const targetDate = addDateDays(simulationDate, horizonDaysValue);
        for (const game of replayGamesByDate.get(targetDate) ?? []) {
          evaluatedReplayGames.set(game.id, game);
        }
      }
    }
    const selectedById = new Map<number, AccountabilityGameRow>();
    for (const game of [...trainingGames, ...evaluatedReplayGames.values()]) {
      selectedById.set(game.id, game);
    }
    return [...selectedById.values()].sort((left, right) =>
      left.date === right.date
        ? left.id - right.id
        : left.date.localeCompare(right.date),
    );
  }

  const windowGames = sortedGames.filter(
    (game) =>
      (!args.trainStartDate || game.date >= args.trainStartDate) &&
      (!windowEndDate || game.date <= windowEndDate),
  );
  if (!args.maxTrainingGames && !args.maxReplayGames) return windowGames;

  const splitIndex = Math.floor(windowGames.length / 2);
  const trainingGames = applyLimit(
    windowGames.slice(0, splitIndex),
    args.maxTrainingGames,
    "last",
  );
  const replayGames = applyLimit(
    windowGames.slice(splitIndex),
    args.maxReplayGames,
    "first",
  );
  const selectedById = new Map<number, AccountabilityGameRow>();
  for (const game of [...trainingGames, ...replayGames]) {
    selectedById.set(game.id, game);
  }
  return [...selectedById.values()].sort((left, right) =>
    left.date === right.date
      ? left.id - right.id
      : left.date.localeCompare(right.date),
  );
}

export type AccuracyLoopExpectedMarketOddsGameWindow = {
  seasonId: number;
  gameType?: number;
  trainStartDate?: string;
  blindDate?: string;
  replayEndDate?: string;
  analysisEndDate?: string;
  horizonDays?: number[];
  maxSimulationDays?: number;
  maxTrainingGames?: number;
  maxReplayGames?: number;
};

export type AccuracyLoopExpectedMarketOddsGameIds = {
  gameIds: number[];
  gameCount: number;
  windowStartDate: string | null;
  windowEndDate: string | null;
};

export async function fetchAccuracyLoopExpectedMarketOddsGameIds(args: {
  client: SupabaseClient<Database>;
  window: AccuracyLoopExpectedMarketOddsGameWindow;
}): Promise<AccuracyLoopExpectedMarketOddsGameIds> {
  const { games } = await fetchCompletedSeasonGames({
    client: args.client,
    seasonId: args.window.seasonId,
    gameType: args.window.gameType ?? 2,
  });
  const windowGames = selectAccuracyLoopSourceReadinessGames({
    games,
    trainStartDate: args.window.trainStartDate,
    blindDate: args.window.blindDate,
    analysisEndDate: args.window.analysisEndDate,
    replayEndDate: args.window.replayEndDate,
    horizonDays: args.window.horizonDays,
    maxSimulationDays: args.window.maxSimulationDays,
    maxTrainingGames: args.window.maxTrainingGames,
    maxReplayGames: args.window.maxReplayGames,
  });

  return {
    gameIds: windowGames.map((game) => game.id),
    gameCount: windowGames.length,
    windowStartDate: windowGames[0]?.date ?? null,
    windowEndDate: windowGames[windowGames.length - 1]?.date ?? null,
  };
}

export function selectWalkForwardBacktestGameWindows(args: {
  games: AccountabilityGameRow[];
  trainStartDate?: string;
  blindDate?: string;
  replayEndDate?: string;
  analysisEndDate?: string;
  maxTrainingGames?: number;
  maxReplayGames?: number;
}): {
  trainingGames: AccountabilityGameRow[];
  replayGames: AccountabilityGameRow[];
} {
  const sortedGames = [...args.games].sort((left, right) => {
    if (left.date !== right.date) return left.date.localeCompare(right.date);
    const startCompare = (left.startTime ?? "").localeCompare(
      right.startTime ?? "",
    );
    return startCompare !== 0 ? startCompare : left.id - right.id;
  });
  const applyLimit = (
    games: AccountabilityGameRow[],
    limit: number | undefined,
    direction: "first" | "last",
  ) => {
    if (!limit) return games;
    const boundedLimit = Math.max(1, limit);
    return direction === "first"
      ? games.slice(0, boundedLimit)
      : games.slice(-boundedLimit);
  };
  const windowEndDate =
    args.replayEndDate ??
    args.analysisEndDate ??
    sortedGames[sortedGames.length - 1]?.date;
  const windowGames = sortedGames.filter(
    (game) =>
      (!args.trainStartDate || game.date >= args.trainStartDate) &&
      (!windowEndDate || game.date <= windowEndDate),
  );

  if (args.trainStartDate && args.blindDate) {
    return {
      trainingGames: applyLimit(
        windowGames.filter((game) => game.date <= args.blindDate!),
        args.maxTrainingGames,
        "last",
      ),
      replayGames: applyLimit(
        windowGames.filter((game) => game.date > args.blindDate!),
        args.maxReplayGames,
        "first",
      ),
    };
  }

  const splitIndex = Math.floor(windowGames.length / 2);
  return {
    trainingGames: applyLimit(
      windowGames.slice(0, splitIndex),
      args.maxTrainingGames,
      "last",
    ),
    replayGames: applyLimit(
      windowGames.slice(splitIndex),
      args.maxReplayGames,
      "first",
    ),
  };
}

async function fetchAccuracyLoopSourceReadiness(args: {
  client: SupabaseClient<Database>;
  seasonId: number;
  gameType: number;
  trainStartDate?: string;
  blindDate?: string;
  analysisEndDate?: string;
  replayEndDate?: string;
  horizonDays?: number[];
  maxSimulationDays?: number;
  maxTrainingGames?: number;
  maxReplayGames?: number;
}): Promise<GamePredictionAccuracyLoopSourceReadiness> {
  const { games } = await fetchCompletedSeasonGames({
    client: args.client,
    seasonId: args.seasonId,
    gameType: args.gameType,
  });
  const windowGames = selectAccuracyLoopSourceReadinessGames({
    games,
    trainStartDate: args.trainStartDate,
    blindDate: args.blindDate,
    analysisEndDate: args.analysisEndDate,
    replayEndDate: args.replayEndDate,
    horizonDays: args.horizonDays,
    maxSimulationDays: args.maxSimulationDays,
    maxTrainingGames: args.maxTrainingGames,
    maxReplayGames: args.maxReplayGames,
  });
  const gameIds = windowGames.map((game) => game.id);

  let oddsRows: MarketOddsSourceAuditRow[] = [];
  let provenanceRows: SourceProvenanceAuditRow[] = [];
  if (gameIds.length > 0) {
    const gameIdChunks = chunkValues(gameIds, 250);
    const [oddsResults, provenanceResults] = await Promise.all([
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
            .in("source_name", [
              ...MARKET_ODDS_OBSERVED_SOURCE_NAMES,
              ...MARKET_ODDS_REJECTED_SOURCE_NAMES,
            ])
            .in("game_id", chunk)
            .limit(10_000),
        ),
      ),
    ]);

    for (const result of oddsResults) {
      if (result.error) throw result.error;
      oddsRows.push(...((result.data ?? []) as MarketOddsSourceAuditRow[]));
    }
    for (const result of provenanceResults) {
      if (result.error) throw result.error;
      provenanceRows.push(...((result.data ?? []) as SourceProvenanceAuditRow[]));
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    seasonId: args.seasonId,
    gameType: args.gameType,
    windowStartDate: windowGames[0]?.date ?? null,
    windowEndDate: windowGames[windowGames.length - 1]?.date ?? null,
    requiredGames: windowGames.length,
    marketOdds: buildMarketOddsSourceReadiness({
      games: windowGames,
      oddsRows,
      provenanceRows,
    }),
  };
}

export function persistedFeatureSnapshotRowToPayload(args: {
  row: FeatureSnapshotPayloadRow;
  featureSetVersion: string;
  sourceAsOfDate?: string;
}): GamePredictionFeatureSnapshotPayload | null {
  if (!isRecord(args.row.feature_payload)) return null;
  const payload = args.row
    .feature_payload as unknown as GamePredictionFeatureSnapshotPayload;
  if (payload.featureSetVersion !== args.featureSetVersion) return null;
  if (payload.gameId !== args.row.game_id) return null;
  if (
    args.sourceAsOfDate &&
    payload.sourceAsOfDate !== args.sourceAsOfDate &&
    (!isRecord(args.row.metadata) ||
      args.row.metadata.source_as_of_date !== args.sourceAsOfDate)
  ) {
    return null;
  }
  return payload;
}

async function fetchPersistedFeatureSnapshotPayload(args: {
  client: SupabaseClient<Database>;
  gameId: number;
  featureSetVersion: string;
  sourceAsOfDate?: string;
}): Promise<GamePredictionFeatureSnapshotPayload | null> {
  const { data, error } = await args.client
    .from("game_prediction_feature_snapshots")
    .select(
      "feature_snapshot_id,game_id,feature_set_version,prediction_cutoff_at,feature_payload,metadata,computed_at",
    )
    .eq("game_id", args.gameId)
    .eq("prediction_scope", "pregame")
    .eq("feature_set_version", args.featureSetVersion)
    .order("computed_at", { ascending: false })
    .limit(20);
  if (error) throw error;

  for (const row of (data ?? []) as FeatureSnapshotPayloadRow[]) {
    const payload = persistedFeatureSnapshotRowToPayload({
      row,
      featureSetVersion: args.featureSetVersion,
      sourceAsOfDate: args.sourceAsOfDate,
    });
    if (payload) return payload;
  }
  return null;
}

async function buildPayloadForGame(
  client: SupabaseClient<Database>,
  gameId: number,
  sourceAsOfDate?: string,
  featureSetVersion = GAME_PREDICTION_FEATURE_SET_VERSION,
): Promise<GamePredictionFeatureSnapshotPayload> {
  const persistedPayload = await fetchPersistedFeatureSnapshotPayload({
    client,
    gameId,
    featureSetVersion,
    sourceAsOfDate,
  });
  if (persistedPayload) return persistedPayload;
  if (featureSetVersion !== GAME_PREDICTION_FEATURE_SET_VERSION) {
    throw new Error(
      `Persisted game prediction feature snapshot is required for feature set ${featureSetVersion}.`,
    );
  }
  return buildGamePredictionFeatureSnapshotPayload(
    await fetchGamePredictionFeatureInputs(client, gameId, {
      sourceAsOfDate,
      predictionCutoffAt: sourceAsOfDate
        ? `${sourceAsOfDate}T16:00:00.000Z`
        : undefined,
    }),
  );
}

function toTrainingExample(args: {
  payload: GamePredictionFeatureSnapshotPayload;
  outcome: CompletedGameOutcome;
  featureVectorOptions?: BaselineFeatureVectorOptions;
  targetSeasonId?: number;
}): BacktestTrainingExample {
  const example = buildBaselineTrainingDataset(
    [
      {
        featureSnapshotId: `walk-forward-${args.payload.gameId}`,
        payload: args.payload,
      },
    ],
    [{ gameId: args.outcome.gameId, homeWon: args.outcome.homeWon }],
    args.featureVectorOptions,
  )[0]!;
  return {
    ...example,
    seasonPhase: args.payload.seasonPhase.phase,
    seasonId: args.payload.seasonId,
    weight: trainingSeasonRecencyWeight(
      args.targetSeasonId ?? args.payload.seasonId,
      args.payload.seasonId,
    ),
  };
}

function trainBacktestModel(args: {
  examples: GamePredictionBaselineExample[];
  modelFamily: "logistic" | "extra_trees";
}): BacktestCandidateModel {
  if (args.modelFamily === "extra_trees") {
    return trainGamePredictionExtraTreesModel(args.examples, {
      treeCount: 41,
      maxDepth: 4,
      minLeafExamples: 8,
      sampleRate: 0.85,
      seed: 20260615,
    });
  }

  return trainGamePredictionBaselineModel(args.examples, {
    iterations: 800,
    learningRate: 0.03,
    l2: 0.02,
  });
}

function rawHomeProbabilityForExample(args: {
  model: BacktestCandidateModel;
  modelFamily: "logistic" | "extra_trees";
  example: GamePredictionBaselineExample;
}): number {
  if (args.modelFamily === "extra_trees" && isExtraTreesModel(args.model)) {
    return predictExtraTreesHomeWinProbability(
      args.model,
      args.example.features.slice(0, args.model.featureCount),
    );
  }

  return predictBaselineModelRawHomeWinProbability(
    args.model as BinaryLogisticModel,
    args.example.features,
  );
}

function buildBacktestProbabilityCalibrator(args: {
  examples: GamePredictionBaselineExample[];
  model: BacktestCandidateModel;
  modelFamily: "logistic" | "extra_trees";
  calibrationMethod?: CalibrationMethodName;
}): ProbabilityCalibrator | undefined {
  const calibrationMethod = args.calibrationMethod ?? "raw";
  if (calibrationMethod === "raw") return undefined;

  const labels = new Set(args.examples.map((example) => example.label));
  if (args.examples.length < 10 || labels.size < 2) return undefined;

  const calibrator = fitProbabilityCalibrator(
    args.examples.map((example) => ({
      rowId: String(example.gameId),
      label: example.label,
      prediction: rawHomeProbabilityForExample({
        model: args.model,
        modelFamily: args.modelFamily,
        example,
      }),
    })),
    calibrationMethod,
  );
  return calibrator.method === "raw" ? undefined : calibrator;
}

function hasBothOutcomeClasses(examples: GamePredictionBaselineExample[]): boolean {
  const labels = new Set(examples.map((example) => example.label));
  return labels.has(0) && labels.has(1);
}

function buildPhaseModelState(args: {
  examples: BacktestTrainingExample[];
  modelFamily?: "logistic" | "extra_trees";
  phaseSpecificTraining?: boolean;
  minimumPhaseTrainingExamples?: number;
  calibrationMethod?: CalibrationMethodName;
  initialModel?: BinaryLogisticModel;
}): PhaseModelState {
  const modelFamily = args.modelFamily ?? "logistic";
  const calibrationMethod = args.calibrationMethod ?? "raw";
  const minimumPhaseTrainingExamples = Math.max(
    1,
    args.minimumPhaseTrainingExamples ??
      DEFAULT_MINIMUM_PHASE_TRAINING_EXAMPLES,
  );
  const overallModel =
    modelFamily === "logistic" && args.initialModel
      ? args.initialModel
      : trainBacktestModel({ examples: args.examples, modelFamily });
  const overallCalibrator = buildBacktestProbabilityCalibrator({
    examples: args.examples,
    model: overallModel,
    modelFamily,
    calibrationMethod,
  });
  const phaseModels = new Map<SeasonPhase, BacktestCandidateModel>();
  const phaseCalibrators = new Map<SeasonPhase, ProbabilityCalibrator>();
  const phaseTrainingCounts = new Map<SeasonPhase, number>();

  for (const phase of SEASON_PHASES) {
    const phaseExamples = args.examples.filter(
      (example) => example.seasonPhase === phase,
    );
    phaseTrainingCounts.set(phase, phaseExamples.length);
    if (
      args.phaseSpecificTraining &&
      phaseExamples.length >= minimumPhaseTrainingExamples &&
      hasBothOutcomeClasses(phaseExamples)
    ) {
      const phaseModel = trainBacktestModel({ examples: phaseExamples, modelFamily });
      phaseModels.set(phase, phaseModel);
      const phaseCalibrator = buildBacktestProbabilityCalibrator({
        examples: phaseExamples,
        model: phaseModel,
        modelFamily,
        calibrationMethod,
      });
      if (phaseCalibrator) phaseCalibrators.set(phase, phaseCalibrator);
    }
  }

  return {
    overallModel,
    overallCalibrator,
    phaseModels,
    phaseCalibrators,
    phaseTrainingCounts,
    minimumPhaseTrainingExamples,
    modelFamily,
    calibrationMethod,
    trainingHomeWinRate: smoothedHomeWinRate(args.examples),
  };
}

function modelSelectionForPayload(
  state: PhaseModelState,
  payload: GamePredictionFeatureSnapshotPayload,
): {
  model: BacktestCandidateModel;
  calibrator?: ProbabilityCalibrator;
  source: "phase_specific" | "overall_fallback";
} {
  const phaseModel = state.phaseModels.get(payload.seasonPhase.phase);
  return phaseModel
    ? {
        model: phaseModel,
        calibrator: state.phaseCalibrators.get(payload.seasonPhase.phase),
        source: "phase_specific",
      }
    : {
        model: state.overallModel,
        calibrator: state.overallCalibrator,
        source: "overall_fallback",
      };
}

function predictGameWithBacktestModel(args: {
  payload: GamePredictionFeatureSnapshotPayload;
  model: BacktestCandidateModel;
  modelName: string;
  modelVersion: string;
  predictionCutoffAt: string;
  calibrator?: ProbabilityCalibrator;
  probabilityBlend?: BacktestProbabilityBlend;
  trainingHomeWinRate?: number;
  featureVectorOptions?: BaselineFeatureVectorOptions;
  disableDataQualityDampening?: boolean;
  winnerDecisionThreshold?: number;
  modelAuditMetadata?: GamePredictionModelAuditMetadata;
}): GamePredictionResult {
  const prediction = isExtraTreesModel(args.model)
    ? predictGameWithExtraTreesModel({
        payload: args.payload,
        model: args.model,
        modelName: args.modelName,
        modelVersion: args.modelVersion,
        predictionCutoffAt: args.predictionCutoffAt,
        calibrator: args.calibrator,
        featureVectorOptions: args.featureVectorOptions,
        disableDataQualityDampening: args.disableDataQualityDampening,
        winnerDecisionThreshold: args.winnerDecisionThreshold,
        modelAuditMetadata: args.modelAuditMetadata,
      })
    : predictGameWithBaselineModel({
        payload: args.payload,
        model: args.model,
        modelName: args.modelName,
        modelVersion: args.modelVersion,
        predictionCutoffAt: args.predictionCutoffAt,
        calibrator: args.calibrator,
        featureVectorOptions: args.featureVectorOptions,
        disableDataQualityDampening: args.disableDataQualityDampening,
        winnerDecisionThreshold: args.winnerDecisionThreshold,
        modelAuditMetadata: args.modelAuditMetadata,
      });

  if (!args.probabilityBlend) return prediction;

  const modelWeight = Math.min(
    1,
    Math.max(0, args.probabilityBlend.modelWeight),
  );
  const trainingHomeWinRate = roundProbability(args.trainingHomeWinRate ?? 0.54);
  const blendAnchorProbability =
    args.probabilityBlend.method === "goal_differential_anchor"
      ? boundedEdgeProbability(
          args.payload.matchup.homeMinusAwayGoalDifferential,
          100,
          0.53,
          0.68,
        )
      : args.probabilityBlend.method === "standings_point_pct_anchor"
        ? boundedEdgeProbability(
            args.payload.matchup.homeMinusAwayPointPctg,
            0.3,
            0.53,
            0.68,
          )
        : trainingHomeWinRate;
  const blendedHomeProbability = roundProbability(
    blendAnchorProbability +
      modelWeight * (prediction.homeWinProbability - blendAnchorProbability),
  );
  const winnerDecisionThreshold = Math.max(
    0.01,
    Math.min(
      0.99,
      args.winnerDecisionThreshold ?? BASELINE_WINNER_DECISION_THRESHOLD,
    ),
  );
  const predictedWinnerTeamId =
    blendedHomeProbability >= winnerDecisionThreshold
      ? prediction.homeTeamId
      : prediction.awayTeamId;

  return {
    ...prediction,
    homeWinProbability: blendedHomeProbability,
    awayWinProbability: roundProbability(1 - blendedHomeProbability),
    predictedWinnerTeamId,
    confidenceLabel: getConfidenceLabel(blendedHomeProbability),
    components: {
      ...prediction.components,
      pre_blend_home_win_probability: prediction.homeWinProbability,
      probability_blend_method: args.probabilityBlend.method,
      probability_blend_model_weight: modelWeight,
      probability_blend_anchor_probability: blendAnchorProbability,
      training_home_win_rate: trainingHomeWinRate,
      blended_home_win_probability: blendedHomeProbability,
      selected_threshold_predicted_winner_team_id: predictedWinnerTeamId,
    },
    metadata: {
      ...prediction.metadata,
      confidence_label: getConfidenceLabel(blendedHomeProbability),
      probability_blend_method: args.probabilityBlend.method,
      probability_blend_model_weight: modelWeight,
      probability_blend_anchor_probability: blendAnchorProbability,
      training_home_win_rate: trainingHomeWinRate,
      selected_threshold_predicted_winner_team_id: predictedWinnerTeamId,
    },
  };
}

export async function runGamePredictionFeatureSignalAnalysis(args: {
  client: SupabaseClient<Database>;
  seasonId: number;
  gameType?: number;
  featureSetVersion?: string;
  trainStartDate?: string;
  analysisEndDate?: string;
  maxGames?: number;
  featureVectorOptions?: BaselineFeatureVectorOptions;
}): Promise<GamePredictionFeatureSignalAnalysisResult> {
  const gameType = args.gameType ?? 2;
  const featureSetVersion =
    args.featureSetVersion ?? GAME_PREDICTION_FEATURE_SET_VERSION;
  const { games, outcomes } = await fetchCompletedSeasonGames({
    client: args.client,
    seasonId: args.seasonId,
    gameType,
  });
  const outcomesByGameId = new Map(
    outcomes.map((outcome) => [outcome.gameId, outcome]),
  );
  const windowGames = games.filter(
    (game) =>
      (!args.trainStartDate || game.date >= args.trainStartDate) &&
      (!args.analysisEndDate || game.date <= args.analysisEndDate),
  );
  const analysisGames = args.maxGames
    ? windowGames.slice(-Math.max(1, args.maxGames))
    : windowGames;
  const featureVectorOptions = args.featureVectorOptions ?? {
    includeDefaultExcludedFeatureKeys: true,
  };

  const segmentedExamples: Array<{
    phase: SeasonPhase;
    example: GamePredictionBaselineExample;
  }> = [];
  for (const game of analysisGames) {
    const outcome = outcomesByGameId.get(game.id);
    if (!outcome) continue;
    const payload = await buildPayloadForGame(
      args.client,
      game.id,
      game.date,
      featureSetVersion,
    );
    segmentedExamples.push({
      phase: payload.seasonPhase.phase,
      example: toTrainingExample({
        payload,
        outcome,
        featureVectorOptions,
      }),
    });
  }

  const examples = segmentedExamples.map((entry) => entry.example);

  if (examples.length === 0) {
    throw new Error("No feature examples could be built for signal analysis.");
  }

  return {
    generatedAt: new Date().toISOString(),
    seasonId: args.seasonId,
    gameType,
    featureSetVersion,
    analysisStartDate: analysisGames[0]!.date,
    analysisEndDate: analysisGames[analysisGames.length - 1]!.date,
    analyzedGames: examples.length,
    featureVectorOptions,
    analysis: analyzeBaselineFeatureSignals(examples),
    segmentAnalyses: buildFeatureSignalSegmentAnalyses(segmentedExamples),
  };
}

function predictionToAccountabilityRow(args: {
  prediction: GamePredictionResult;
  outcome: CompletedGameOutcome;
  teamAbbreviationsById: Map<number, string>;
}): PredictionCandlestick {
  const prediction = args.prediction;
  const predictedWinnerTeamId =
    prediction.predictedWinnerTeamId ??
    (prediction.homeWinProbability >= prediction.awayWinProbability
      ? prediction.homeTeamId
      : prediction.awayTeamId);
  const actualWinnerTeamId = args.outcome.homeWon
    ? args.outcome.homeTeamId
    : args.outcome.awayTeamId;

  return {
    gameId: prediction.gameId,
    snapshotDate: prediction.snapshotDate,
    startTime: prediction.predictionCutoffAt,
    homeTeamId: prediction.homeTeamId,
    awayTeamId: prediction.awayTeamId,
    homeTeamAbbreviation:
      args.teamAbbreviationsById.get(prediction.homeTeamId) ??
      String(prediction.homeTeamId),
    awayTeamAbbreviation:
      args.teamAbbreviationsById.get(prediction.awayTeamId) ??
      String(prediction.awayTeamId),
    openHomeWinProbability: prediction.homeWinProbability,
    lowHomeWinProbability: prediction.homeWinProbability,
    highHomeWinProbability: prediction.homeWinProbability,
    finalHomeWinProbability: prediction.homeWinProbability,
    actualHomeWinProbability: args.outcome.homeWon ? 1 : 0,
    probabilitySpread: 0,
    predictionCount: 1,
    finalPredictionId: null,
    finalPredictionCutoffAt: prediction.predictionCutoffAt,
    predictedWinnerTeamId,
    actualWinnerTeamId,
    predictedWinnerCorrect: predictedWinnerTeamId === actualWinnerTeamId,
    homeScore: args.outcome.homeScore,
    awayScore: args.outcome.awayScore,
  };
}

function predictionToSyntheticHistoryRow(args: {
  prediction: GamePredictionResult;
  sourceAsOfDate: string;
  horizonDays: number;
}): AccountabilityPredictionRow {
  const prediction = args.prediction;
  const predictedWinnerTeamId =
    prediction.predictedWinnerTeamId ??
    (prediction.homeWinProbability >= prediction.awayWinProbability
      ? prediction.homeTeamId
      : prediction.awayTeamId);

  return {
    prediction_id: `backtest-${prediction.gameId}-${args.sourceAsOfDate}-${args.horizonDays}`,
    game_id: prediction.gameId,
    snapshot_date: prediction.snapshotDate,
    prediction_cutoff_at: prediction.predictionCutoffAt,
    model_name: prediction.modelName,
    model_version: prediction.modelVersion,
    feature_set_version: prediction.featureSetVersion,
    home_team_id: prediction.homeTeamId,
    away_team_id: prediction.awayTeamId,
    home_win_probability: prediction.homeWinProbability,
    away_win_probability: prediction.awayWinProbability,
    predicted_winner_team_id: predictedWinnerTeamId,
    confidence_label: prediction.confidenceLabel,
    metadata: {
      ...prediction.metadata,
      blind_backtest: true,
      source_as_of_date: args.sourceAsOfDate,
      horizon_days: args.horizonDays,
    },
    computed_at: prediction.predictionCutoffAt,
  };
}

async function persistBacktestResult(args: {
  client: SupabaseClient<Database>;
  result: WalkForwardBacktestResult;
}): Promise<string> {
  const { client, result } = args;
  const { error: modelVersionError } = await client
    .from("game_prediction_model_versions")
    .upsert(
      {
        model_name: result.modelName,
        model_version: result.modelVersion,
        feature_set_version: result.featureSetVersion,
        algorithm: "regularized_logistic_walk_forward",
        status: "candidate",
        training_start_date: result.trainingStartDate,
        training_end_date: result.trainingEndDate,
        validation_start_date: result.replayStartDate,
        validation_end_date: result.replayEndDate,
        training_metrics: result.summary as unknown as Json,
        validation_metrics: result.summary as unknown as Json,
        metadata: {
          season_id: result.seasonId,
          training_season_ids: result.trainingSeasonIds,
          retrain_cadence_games: result.retrainCadenceGames,
          horizon_days: result.horizonDays,
          prediction_snapshots: result.predictionSnapshots,
          baseline_comparisons: result.baselineComparisons ?? [],
          calibration_buckets: result.calibrationBuckets ?? [],
          monitored_segment_summaries: result.monitoredSegmentSummaries,
          model_audit: result.modelAuditMetadata as unknown as Json,
          accountability_backtest: true,
        },
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "model_name,model_version,feature_set_version",
      },
    );
  if (modelVersionError) throw modelVersionError;

  const { data: run, error: runError } = await client
    .from("game_prediction_backtest_runs" as any)
    .insert({
      model_name: result.modelName,
      model_version: result.modelVersion,
      feature_set_version: result.featureSetVersion,
      season_id: result.seasonId,
      training_start_date: result.trainingStartDate,
      training_end_date: result.trainingEndDate,
      replay_start_date: result.replayStartDate,
      replay_end_date: result.replayEndDate,
      training_games: result.trainingGames,
      replay_games: result.replayGames,
      retrain_cadence_games: result.retrainCadenceGames,
      status: "completed",
      metrics: result.summary as unknown as Json,
      metadata: {
        training_season_ids: result.trainingSeasonIds,
        horizon_days: result.horizonDays,
        prediction_snapshots: result.predictionSnapshots,
        baseline_comparisons: result.baselineComparisons ?? [],
        calibration_buckets: result.calibrationBuckets ?? [],
        phase_summaries: result.phaseSummaries,
        monitored_segment_summaries: result.monitoredSegmentSummaries,
        model_audit: result.modelAuditMetadata as unknown as Json,
      },
      completed_at: new Date().toISOString(),
    })
    .select("backtest_run_id")
    .single();
  if (runError) throw runError;
  const backtestRunId = String((run as any).backtest_run_id);

  const gameRows = result.candles.map((candle) => ({
    backtest_run_id: backtestRunId,
    game_id: candle.gameId,
    snapshot_date: candle.snapshotDate,
    model_name: result.modelName,
    model_version: result.modelVersion,
    feature_set_version: result.featureSetVersion,
    home_team_id: candle.homeTeamId,
    away_team_id: candle.awayTeamId,
    open_home_win_probability: candle.openHomeWinProbability,
    low_home_win_probability: candle.lowHomeWinProbability,
    high_home_win_probability: candle.highHomeWinProbability,
    final_home_win_probability: candle.finalHomeWinProbability,
    actual_home_win_probability: candle.actualHomeWinProbability,
    prediction_count: candle.predictionCount,
    predicted_winner_team_id: candle.predictedWinnerTeamId,
    actual_winner_team_id: candle.actualWinnerTeamId,
    predicted_winner_correct: candle.predictedWinnerCorrect,
    home_score: candle.homeScore,
    away_score: candle.awayScore,
    probability_spread: candle.probabilitySpread,
    final_prediction_cutoff_at: candle.finalPredictionCutoffAt,
  }));
  if (gameRows.length > 0) {
    const { error } = await client
      .from("game_prediction_accountability_games" as any)
      .insert(gameRows);
    if (error) throw error;
  }

  const dailyRows = result.daily.map((point) => ({
    backtest_run_id: backtestRunId,
    model_name: result.modelName,
    model_version: result.modelVersion,
    feature_set_version: result.featureSetVersion,
    as_of_date: point.asOfDate,
    evaluated_games: point.evaluatedGames,
    correct_games: point.correctGames,
    wrong_games: point.wrongGames,
    cumulative_accuracy: point.cumulativeAccuracy,
    rolling_10_accuracy: point.rolling10Accuracy,
    rolling_25_accuracy: point.rolling25Accuracy,
    rolling_50_accuracy: point.rolling50Accuracy,
    brier_score: point.brierScore,
    log_loss: point.logLoss,
  }));
  if (dailyRows.length > 0) {
    const { error } = await client
      .from("game_prediction_accountability_daily" as any)
      .insert(dailyRows);
    if (error) throw error;
  }

  return backtestRunId;
}

export async function runWalkForwardBacktest(args: {
  client: SupabaseClient<Database>;
  seasonId: number;
  trainingSeasonIds?: number[];
  gameType?: number;
  modelName?: string;
  modelVersion?: string;
  featureSetVersion?: string;
  trainStartDate?: string;
  blindDate?: string;
  replayEndDate?: string;
  analysisEndDate?: string;
  horizonDays?: number[];
  maxSimulationDays?: number;
  retrainCadenceGames?: number;
  persist?: boolean;
  maxTrainingGames?: number;
  maxReplayGames?: number;
  initialModel?: BinaryLogisticModel;
  payloadCache?: Map<string, GamePredictionFeatureSnapshotPayload>;
  featureVectorOptions?: BaselineFeatureVectorOptions;
  disableDataQualityDampening?: boolean;
  winnerDecisionThreshold?: number;
  modelAuditMetadata?: GamePredictionModelAuditMetadata;
  modelFamily?: "logistic" | "extra_trees";
  calibrationMethod?: CalibrationMethodName;
  probabilityBlend?: BacktestProbabilityBlend;
  phaseSpecificTraining?: boolean;
  minimumPhaseTrainingExamples?: number;
}): Promise<WalkForwardBacktestResult> {
  const modelName = args.modelName ?? BASELINE_MODEL_NAME;
  const modelVersion =
    args.modelVersion ?? `${BASELINE_MODEL_VERSION}_walk_forward`;
  const featureSetVersion =
    args.featureSetVersion ?? GAME_PREDICTION_FEATURE_SET_VERSION;
  const retrainCadenceGames = Math.max(1, args.retrainCadenceGames ?? 1);
  const trainingSeasonIds = Array.from(
    new Set([...(args.trainingSeasonIds ?? []), args.seasonId]),
  ).sort((left, right) => left - right);
  const seasonData = await Promise.all(
    trainingSeasonIds.map((seasonId) =>
      fetchCompletedSeasonGames({
        client: args.client,
        seasonId,
        gameType: args.gameType ?? 2,
      }),
    ),
  );
  const games = seasonData.flatMap((entry) => entry.games);
  const outcomes = seasonData.flatMap((entry) => entry.outcomes);
  const hasBlindWindow = Boolean(args.trainStartDate && args.blindDate);
  const { trainingGames, replayGames } = selectWalkForwardBacktestGameWindows({
    games,
    trainStartDate: args.trainStartDate,
    blindDate: args.blindDate,
    replayEndDate: args.replayEndDate,
    analysisEndDate: args.analysisEndDate,
    maxTrainingGames: args.maxTrainingGames,
    maxReplayGames: args.maxReplayGames,
  });
  if (trainingGames.length + replayGames.length < 4) {
    throw new Error(
      "At least four completed games are required in the selected walk-forward backtest window.",
    );
  }

  const outcomesByGameId = new Map(
    outcomes.map((outcome) => [outcome.gameId, outcome]),
  );
  const teamIds = Array.from(
    new Set(
      [...trainingGames, ...replayGames].flatMap((game) => [
        game.homeTeamId,
        game.awayTeamId,
      ]),
    ),
  );
  const { data: teamRows, error: teamError } = await args.client
    .from("teams")
    .select("id,abbreviation,name")
    .in("id", teamIds);
  if (teamError) throw teamError;
  const teamAbbreviationsById = new Map(
    ((teamRows ?? []) as AccountabilityTeamRow[]).map((team) => [
      team.id,
      team.abbreviation,
    ]),
  );

  const examples: BacktestTrainingExample[] = [];
  const payloadCache =
    args.payloadCache ?? new Map<string, GamePredictionFeatureSnapshotPayload>();
  const getPayload = async (gameId: number, sourceAsOfDate?: string) => {
    const key = `${featureSetVersion}:${gameId}:${sourceAsOfDate ?? "pregame"}`;
    const cached = payloadCache.get(key);
    if (cached) return cached;
    const payload = await buildPayloadForGame(
      args.client,
      gameId,
      sourceAsOfDate,
      featureSetVersion,
    );
    payloadCache.set(key, payload);
    return payload;
  };

  for (const game of trainingGames) {
    const outcome = outcomesByGameId.get(game.id);
    if (!outcome) continue;
    const payload = await getPayload(game.id, game.date);
    examples.push(
      toTrainingExample({
        payload,
        outcome,
        featureVectorOptions: args.featureVectorOptions,
        targetSeasonId: args.seasonId,
      }),
    );
  }
  if (examples.length === 0) {
    throw new Error(
      "No training examples could be built for walk-forward backtest.",
    );
  }
  const initialTrainingExamples = examples.length;

  let modelState = buildPhaseModelState({
    examples,
    modelFamily: args.modelFamily,
    calibrationMethod: args.calibrationMethod,
    phaseSpecificTraining: args.phaseSpecificTraining,
    minimumPhaseTrainingExamples: args.minimumPhaseTrainingExamples,
    initialModel: args.initialModel,
  });

  const candles: PredictionCandlestick[] = [];
  const predictionMetadataByGameId = new Map<number, Record<string, Json>>();
  const phaseModelSourceByGameId = new Map<
    number,
    "phase_specific" | "overall_fallback"
  >();
  let predictionSnapshots = 0;
  let replayedSinceRetrain = 0;
  const addedTrainingGameIds = new Set(trainingGames.map((game) => game.id));

  if (hasBlindWindow) {
    const horizonDays = normalizeHorizonDays(args.horizonDays);
    const replayGamesByDate = new Map<string, AccountabilityGameRow[]>();
    for (const game of replayGames) {
      replayGamesByDate.set(game.date, [
        ...(replayGamesByDate.get(game.date) ?? []),
        game,
      ]);
    }
    const replayEndDate =
      replayGames[replayGames.length - 1]?.date ?? args.blindDate!;
    const simulationDates = enumerateDates(args.blindDate!, replayEndDate).slice(
      0,
      args.maxSimulationDays,
    );
    const syntheticRowsByGameId = new Map<number, AccountabilityPredictionRow[]>();

    for (const simulationDate of simulationDates) {
      let addedExamplesToday = 0;
      for (const game of replayGames) {
        if (game.date >= simulationDate || addedTrainingGameIds.has(game.id)) {
          continue;
        }
        const outcome = outcomesByGameId.get(game.id);
        if (!outcome) continue;
        const payload = await getPayload(game.id, game.date);
        examples.push(
          toTrainingExample({
            payload,
            outcome,
            featureVectorOptions: args.featureVectorOptions,
            targetSeasonId: args.seasonId,
          }),
        );
        addedTrainingGameIds.add(game.id);
        addedExamplesToday += 1;
      }

      if (addedExamplesToday > 0) {
        modelState = buildPhaseModelState({
          examples,
          modelFamily: args.modelFamily,
          calibrationMethod: args.calibrationMethod,
          phaseSpecificTraining: args.phaseSpecificTraining,
          minimumPhaseTrainingExamples: args.minimumPhaseTrainingExamples,
        });
      }

      for (const horizonDaysValue of horizonDays) {
        const targetDate = addDateDays(simulationDate, horizonDaysValue);
        const targetGames = replayGamesByDate.get(targetDate) ?? [];
        for (const game of targetGames) {
          const payload = await getPayload(game.id, simulationDate);
          const predictionCutoffAt = syntheticBacktestPredictionCutoffAt({
            game,
            simulationDate,
            horizonDays: horizonDaysValue,
          });
          const modelSelection = modelSelectionForPayload(modelState, payload);
          phaseModelSourceByGameId.set(game.id, modelSelection.source);
          const prediction = predictGameWithBacktestModel({
            payload,
            model: modelSelection.model,
            modelName,
            modelVersion,
            predictionCutoffAt,
            calibrator: modelSelection.calibrator,
            probabilityBlend: args.probabilityBlend,
            trainingHomeWinRate: modelState.trainingHomeWinRate,
            featureVectorOptions: args.featureVectorOptions,
            disableDataQualityDampening: args.disableDataQualityDampening,
            winnerDecisionThreshold: args.winnerDecisionThreshold,
            modelAuditMetadata: args.modelAuditMetadata,
          });
          const row = predictionToSyntheticHistoryRow({
            prediction,
            sourceAsOfDate: simulationDate,
            horizonDays: horizonDaysValue,
          });
          syntheticRowsByGameId.set(game.id, [
            ...(syntheticRowsByGameId.get(game.id) ?? []),
            row,
          ]);
          predictionSnapshots += 1;
        }
      }
    }

    const teamsById = new Map(
      ((teamRows ?? []) as AccountabilityTeamRow[]).map((team) => [
        team.id,
        team,
      ]),
    );
    const gamesById = new Map(replayGames.map((game) => [game.id, game]));
    for (const [gameId, predictions] of syntheticRowsByGameId.entries()) {
      const outcome = outcomesByGameId.get(gameId);
      if (!outcome) continue;
      const candle = buildPredictionCandlestick({
        predictions,
        outcome,
        game: gamesById.get(gameId),
        teamsById,
      });
      if (candle) {
        candles.push(candle);
        const finalPrediction = finalPregamePredictions(
          predictions,
          gamesById.get(gameId),
        ).at(-1);
        if (isRecord(finalPrediction?.metadata)) {
          predictionMetadataByGameId.set(
            gameId,
            finalPrediction.metadata as Record<string, Json>,
          );
        }
      }
    }
  } else {
    for (const game of replayGames) {
      const outcome = outcomesByGameId.get(game.id);
      if (!outcome) continue;
      const payload = await getPayload(game.id, game.date);
      const predictionCutoffAt = syntheticBacktestPredictionCutoffAt({
        game,
        simulationDate: game.date,
        horizonDays: 0,
      });
      const modelSelection = modelSelectionForPayload(modelState, payload);
      phaseModelSourceByGameId.set(game.id, modelSelection.source);
      const prediction = predictGameWithBacktestModel({
        payload,
        model: modelSelection.model,
        modelName,
        modelVersion,
        predictionCutoffAt,
        calibrator: modelSelection.calibrator,
        probabilityBlend: args.probabilityBlend,
        trainingHomeWinRate: modelState.trainingHomeWinRate,
        featureVectorOptions: args.featureVectorOptions,
        disableDataQualityDampening: args.disableDataQualityDampening,
        winnerDecisionThreshold: args.winnerDecisionThreshold,
        modelAuditMetadata: args.modelAuditMetadata,
      });
      candles.push(
        predictionToAccountabilityRow({
          prediction,
          outcome,
          teamAbbreviationsById,
        }),
      );
      predictionMetadataByGameId.set(game.id, prediction.metadata);
      predictionSnapshots += 1;

      examples.push(
        toTrainingExample({
          payload,
          outcome,
          featureVectorOptions: args.featureVectorOptions,
          targetSeasonId: args.seasonId,
        }),
      );
      replayedSinceRetrain += 1;
      if (replayedSinceRetrain >= retrainCadenceGames) {
        modelState = buildPhaseModelState({
          examples,
          modelFamily: args.modelFamily,
          calibrationMethod: args.calibrationMethod,
          phaseSpecificTraining: args.phaseSpecificTraining,
          minimumPhaseTrainingExamples: args.minimumPhaseTrainingExamples,
        });
        replayedSinceRetrain = 0;
      }
    }
  }

  const payloadsByGameId = new Map<number, GamePredictionFeatureSnapshotPayload>();
  for (const candle of candles) {
    payloadsByGameId.set(
      candle.gameId,
      await getPayload(candle.gameId, candle.snapshotDate),
    );
  }
  const baselineComparisons = buildBacktestBaselineComparisons({
    candles,
    payloadsByGameId,
  });
  const phaseSummaries = buildBacktestPhaseSummaries({
    candles,
    payloadsByGameId,
    phaseTrainingCounts: modelState.phaseTrainingCounts,
    phaseModelSourceByGameId,
  });
  const monitoredSegmentSummaries = buildBacktestMonitoredSegmentSummaries({
    candles,
    predictionMetadataByGameId,
  });
  const calibrationBuckets = buildConfidenceCalibrationBuckets(candles);

  const dashboard = buildAccountabilityDashboard({
    modelName,
    modelVersion,
    featureSetVersion,
    candles,
    baselineComparisons,
    calibrationBuckets,
  });
  const result: WalkForwardBacktestResult = {
    ...dashboard,
    seasonId: args.seasonId,
    trainingSeasonIds,
    trainingStartDate: trainingGames[0]!.date,
    trainingEndDate: trainingGames[trainingGames.length - 1]!.date,
    replayStartDate:
      replayGames[0]?.date ?? trainingGames[trainingGames.length - 1]!.date,
    replayEndDate:
      replayGames[replayGames.length - 1]?.date ??
      trainingGames[trainingGames.length - 1]!.date,
    trainingGames: initialTrainingExamples,
    replayGames: candles.length,
    predictionSnapshots,
    retrainCadenceGames,
    horizonDays: hasBlindWindow ? normalizeHorizonDays(args.horizonDays) : [0],
    modelAuditMetadata: {
      winnerPolicyVersion: "winner_policy_v1_report_50_and_selected_threshold",
      winnerPolicyMode: "report_default_50_and_selected_threshold",
      defaultWinnerThreshold: 0.5,
      selectedWinnerThreshold:
        args.winnerDecisionThreshold ?? BASELINE_WINNER_DECISION_THRESHOLD,
      rosterImpactVersion: "none",
      strengthOfScheduleVersion: "none",
      seasonDecayVersion: BACKTEST_SEASON_RECENCY_WEIGHT_VERSION,
      probabilityBlendVersion: "none",
      ...args.modelAuditMetadata,
      ...(args.probabilityBlend
        ? { probabilityBlendVersion: `${args.probabilityBlend.method}_v1` }
        : {}),
    },
    phaseSummaries,
    monitoredSegmentSummaries,
    persisted: false,
    backtestRunId: null,
  };

  if (args.persist) {
    const backtestRunId = await persistBacktestResult({
      client: args.client,
      result,
    });
    return {
      ...result,
      persisted: true,
      backtestRunId,
    };
  }

  return result;
}

function deltaMetric(
  value: number | null,
  baseline: number | null,
): number | null {
  if (value == null || baseline == null) return null;
  return roundMetric(value - baseline);
}

function recommendAblationVariant(args: {
  summary: AccountabilitySummary;
  baseline: AccountabilitySummary;
}): BacktestAblationComparison["recommendation"] {
  const accuracyDelta = deltaMetric(args.summary.accuracy, args.baseline.accuracy) ?? 0;
  const brierDelta =
    deltaMetric(args.summary.brierScore, args.baseline.brierScore) ?? 0;
  const logLossDelta =
    deltaMetric(args.summary.logLoss, args.baseline.logLoss) ?? 0;

  if (accuracyDelta > 0 && brierDelta <= 0 && logLossDelta <= 0) {
    return "keep";
  }

  if (accuracyDelta < 0 && brierDelta >= 0 && logLossDelta >= 0) {
    return "reject";
  }

  return "review";
}

export async function runWalkForwardBacktestAblations(args: {
  client: SupabaseClient<Database>;
  seasonId: number;
  gameType?: number;
  modelName?: string;
  baseModelVersion?: string;
  featureSetVersion?: string;
  trainStartDate?: string;
  blindDate?: string;
  replayEndDate?: string;
  analysisEndDate?: string;
  horizonDays?: number[];
  maxSimulationDays?: number;
  retrainCadenceGames?: number;
  maxTrainingGames?: number;
  maxReplayGames?: number;
  variants?: BacktestAblationVariant[];
  marketSourceReadiness?: AccuracyLoopMarketOddsSourceReadiness;
  persistEvidence?: boolean;
}): Promise<BacktestAblationResult> {
  const modelName = args.modelName ?? BASELINE_MODEL_NAME;
  const featureSetVersion =
    args.featureSetVersion ?? GAME_PREDICTION_FEATURE_SET_VERSION;
  const variants = args.variants?.length
    ? args.variants
    : DEFAULT_BACKTEST_ABLATION_VARIANTS;
  const marketSourceReadiness =
    args.marketSourceReadiness ??
    (
      await fetchAccuracyLoopSourceReadiness({
        client: args.client,
        seasonId: args.seasonId,
        gameType: args.gameType ?? 2,
        trainStartDate: args.trainStartDate,
        blindDate: args.blindDate,
        analysisEndDate: args.analysisEndDate,
        replayEndDate: args.replayEndDate,
        horizonDays: args.horizonDays,
        maxSimulationDays: args.maxSimulationDays,
        maxTrainingGames: args.maxTrainingGames,
        maxReplayGames: args.maxReplayGames,
      })
    ).marketOdds;
  const guardedVariants = applyMarketFeatureTrainingGuardrailToVariants({
    variants,
    marketSourceReadiness,
  });
  const baselineKey = guardedVariants[0]?.key ?? "baseline";
  const sharedPayloadCache = new Map<string, GamePredictionFeatureSnapshotPayload>();
  const results: Array<{
    variant: BacktestAblationVariant;
    result: WalkForwardBacktestResult;
  }> = [];

  for (const variant of guardedVariants) {
    const modelVersion =
      `${args.baseModelVersion ?? BASELINE_MODEL_VERSION}_ablation_${variant.key}_${args.seasonId}`;
    const result = await runWalkForwardBacktest({
      client: args.client,
      seasonId: args.seasonId,
      gameType: args.gameType,
      modelName,
      modelVersion,
      featureSetVersion,
      trainStartDate: args.trainStartDate,
      blindDate: args.blindDate,
      replayEndDate: args.replayEndDate,
      analysisEndDate: args.analysisEndDate,
      horizonDays: args.horizonDays,
      maxSimulationDays: args.maxSimulationDays,
      retrainCadenceGames: args.retrainCadenceGames,
      maxTrainingGames: args.maxTrainingGames,
      maxReplayGames: args.maxReplayGames,
      persist: false,
      payloadCache: sharedPayloadCache,
      featureVectorOptions: variant.featureVectorOptions,
      disableDataQualityDampening: variant.disableDataQualityDampening,
      winnerDecisionThreshold: variant.winnerDecisionThreshold,
      modelAuditMetadata: variant.modelAuditMetadata,
      modelFamily: variant.modelFamily,
      calibrationMethod: variant.calibrationMethod,
      probabilityBlend: variant.probabilityBlend,
      phaseSpecificTraining: variant.phaseSpecificTraining,
      minimumPhaseTrainingExamples: variant.minimumPhaseTrainingExamples,
    });
    results.push({ variant, result });
  }

  const baselineSummary = results[0]?.result.summary ?? {
    evaluatedGames: 0,
    correctGames: 0,
    wrongGames: 0,
    accuracy: null,
    rolling10Accuracy: null,
    rolling25Accuracy: null,
    rolling50Accuracy: null,
    brierScore: null,
    logLoss: null,
  };
  const comparisons: BacktestAblationComparison[] = results.map(
    ({ variant, result }) => {
      const deltaVsBaseline = {
        accuracy: deltaMetric(result.summary.accuracy, baselineSummary.accuracy),
        brierScore: deltaMetric(
          result.summary.brierScore,
          baselineSummary.brierScore,
        ),
        logLoss: deltaMetric(result.summary.logLoss, baselineSummary.logLoss),
      };

      return {
        key: variant.key,
        label: variant.label,
        modelVersion: result.modelVersion,
        excludedFeatureKeys:
          variant.featureVectorOptions?.excludedFeatureKeys ?? [],
        disableDataQualityDampening:
          variant.disableDataQualityDampening ?? false,
        winnerDecisionThreshold:
          variant.winnerDecisionThreshold ?? BASELINE_WINNER_DECISION_THRESHOLD,
        modelFamily: variant.modelFamily ?? "logistic",
        calibrationMethod: variant.calibrationMethod ?? "raw",
        probabilityBlend: variant.probabilityBlend ?? null,
        phaseSpecificTraining: variant.phaseSpecificTraining ?? false,
        minimumPhaseTrainingExamples:
          variant.phaseSpecificTraining
            ? variant.minimumPhaseTrainingExamples ??
              DEFAULT_MINIMUM_PHASE_TRAINING_EXAMPLES
            : null,
        modelAuditMetadata: result.modelAuditMetadata,
        summary: result.summary,
        phaseSummaries: result.phaseSummaries,
        monitoredSegmentSummaries: result.monitoredSegmentSummaries,
        calibrationBuckets: result.calibrationBuckets ?? [],
        deltaVsBaseline,
        recommendation:
          variant.key === baselineKey
            ? "review"
            : recommendAblationVariant({
                summary: result.summary,
                baseline: baselineSummary,
              }),
      };
    },
  );
  const baselineComparison =
    comparisons.find((comparison) => comparison.key === baselineKey) ??
    comparisons[0];
  const variantsByKey = new Map(
    guardedVariants.map((variant) => [variant.key, variant]),
  );
  const resultsByKey = new Map(results.map((row) => [row.variant.key, row.result]));
  const firstResult = results[0]?.result;
  const promotionEvidence = baselineComparison
    ? comparisons
        .filter((comparison) => comparison.key !== baselineKey)
        .map((comparison) =>
          buildBacktestPromotionEvidence({
            baseline: baselineComparison,
            candidate: comparison,
            candidateFeatureVectorOptions:
              variantsByKey.get(comparison.key)?.featureVectorOptions,
            marketBaselineComparison: resultsByKey
              .get(comparison.key)
              ?.baselineComparisons?.find(
                (baseline) => baseline.key === "market_no_vig_moneyline",
              ),
            marketSourceReadiness,
            candidateBaselineComparisons: resultsByKey.get(comparison.key)
              ?.baselineComparisons,
          }),
        )
    : [];
  const ablationResult: BacktestAblationResult = {
    generatedAt: new Date().toISOString(),
    modelName,
    featureSetVersion,
    trainingStartDate: firstResult?.trainingStartDate ?? null,
    trainingEndDate: firstResult?.trainingEndDate ?? null,
    replayStartDate: firstResult?.replayStartDate ?? null,
    replayEndDate: firstResult?.replayEndDate ?? null,
    baselineKey,
    sourceReadiness: {
      marketOdds: marketSourceReadiness,
    },
    candidateTracks: DEFAULT_CANDIDATE_MODEL_TRACKS,
    promotionEvidence,
    promotionEvidencePersisted: false,
    variants: comparisons,
  };

  if (args.persistEvidence) {
    await persistAblationPromotionEvidence({
      client: args.client,
      result: ablationResult,
    });
    return {
      ...ablationResult,
      promotionEvidencePersisted: true,
    };
  }

  return ablationResult;
}

export async function runGamePredictionAccuracyImprovementLoop(args: {
  client: SupabaseClient<Database>;
  seasonId: number;
  gameType?: number;
  modelName?: string;
  baseModelVersion?: string;
  featureSetVersion?: string;
  trainStartDate?: string;
  analysisEndDate?: string;
  maxSignalGames?: number;
  blindDate?: string;
  replayEndDate?: string;
  horizonDays?: number[];
  maxSimulationDays?: number;
  retrainCadenceGames?: number;
  maxTrainingGames?: number;
  maxReplayGames?: number;
  persistEvidence?: boolean;
  variantKeys?: readonly string[];
}): Promise<GamePredictionAccuracyImprovementLoopResult> {
  const gameType = args.gameType ?? 2;
  const featureSetVersion =
    args.featureSetVersion ?? GAME_PREDICTION_FEATURE_SET_VERSION;
  const variants = selectAccuracyImprovementAblationVariants(args.variantKeys);
  if (variants.length === 0) {
    throw new Error("No accuracy-improvement ablation variants were selected.");
  }

  const [sourceReadiness, signalAnalysis] = await Promise.all([
    fetchAccuracyLoopSourceReadiness({
      client: args.client,
      seasonId: args.seasonId,
      gameType,
      trainStartDate: args.trainStartDate,
      blindDate: args.blindDate,
      analysisEndDate: args.analysisEndDate,
      replayEndDate: args.replayEndDate,
      horizonDays: args.horizonDays,
      maxSimulationDays: args.maxSimulationDays,
      maxTrainingGames: args.maxTrainingGames,
      maxReplayGames: args.maxReplayGames,
    }),
    runGamePredictionFeatureSignalAnalysis({
      client: args.client,
      seasonId: args.seasonId,
      gameType,
      featureSetVersion,
      trainStartDate: args.trainStartDate,
      analysisEndDate: args.analysisEndDate,
      maxGames: args.maxSignalGames,
      featureVectorOptions: {
        includeDefaultExcludedFeatureKeys: true,
      },
    }),
  ]);
  const ablations = await runWalkForwardBacktestAblations({
    client: args.client,
    seasonId: args.seasonId,
    gameType,
    modelName: args.modelName,
    baseModelVersion: args.baseModelVersion,
    featureSetVersion,
    trainStartDate: args.trainStartDate,
    blindDate: args.blindDate,
    replayEndDate: args.replayEndDate,
    analysisEndDate: args.analysisEndDate,
    horizonDays: args.horizonDays,
    maxSimulationDays: args.maxSimulationDays,
    retrainCadenceGames: args.retrainCadenceGames,
    maxTrainingGames: args.maxTrainingGames,
    maxReplayGames: args.maxReplayGames,
    marketSourceReadiness: sourceReadiness.marketOdds,
    persistEvidence: args.persistEvidence,
    variants,
  });

  return {
    generatedAt: new Date().toISOString(),
    seasonId: args.seasonId,
    gameType,
    featureSetVersion,
    dryRun: true,
    sourceReadiness,
    signalAnalysis,
    ablations,
  };
}
