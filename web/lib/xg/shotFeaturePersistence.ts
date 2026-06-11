import crypto from "crypto";
import fs from "fs";
import path from "path";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "lib/supabase/database-generated.types";
import type { NhlShotFeatureRow } from "lib/supabase/Upserts/nhlShotFeatureBuilder";
import {
  auditScoringRowsAgainstFeatureCoverage,
  type XgFeatureCoverageProfile,
} from "./featureCoverage";
import {
  predictWithSerializedCalibrator,
  type SerializedCalibrationModel
} from "./calibration";

const EPSILON = 1e-9;
const DEFAULT_SHOT_FEATURE_UPSERT_BATCH_SIZE = 100;
const DEFAULT_SHOT_FEATURE_UPSERT_RETRIES = 4;

// "Prediction" here is model-scoring nomenclature: shot_goal means the
// estimated probability that this already-observed shot attempt became a goal.
// It must not be confused with pregame/team projected goals.
export type XgShotPredictionType = "shot_goal" | "rebound_creation";

export type PersistedXgModelArtifact = {
  artifactKind: "nhl_xg_model";
  artifactVersion?: number;
  artifactTag: string;
  family: string;
  generatedAt?: string;
  sourceCommitSha?: string | null;
  parserVersion?: number;
  strengthVersion?: number;
  predictionType?: XgShotPredictionType;
  featureFamily?: string;
  featureVersion: number;
  seasonScope?: number | number[];
  seasonScopes?: number[];
  trainExampleCount?: number;
  validationExampleCount?: number;
  testExampleCount?: number;
  splitDateRanges?: {
    train?: { startDate: string | null; endDate: string | null };
    validation?: { startDate: string | null; endDate: string | null };
    test?: { startDate: string | null; endDate: string | null };
  };
  approvalGradeEligibility?: {
    isEligible?: boolean;
    blockingReasons?: string[];
  };
  evaluation?: unknown;
  calibrationAssessment?: unknown;
  selectedFeatures: {
    numeric: string[];
    boolean: string[];
    categorical: string[];
  };
  categoricalLevels?: Record<string, string[]>;
  featureKeys: string[];
  featureTransforms?: {
    numericStandardization?: Record<string, { mean: number; std: number }>;
  };
  featureCoverage?: XgFeatureCoverageProfile | null;
  calibration?: {
    selectedMethod: string;
    applied: boolean;
    model?: SerializedCalibrationModel;
  };
  model: unknown;
};

type SelectedFeatureGroup = keyof PersistedXgModelArtifact["selectedFeatures"];

export type XgArtifactFeatureContractIssue = {
  code:
    | "duplicate_selected_feature"
    | "empty_categorical_levels"
    | "feature_coverage_blocking_reason"
    | "feature_null_rate_drift"
    | "feature_key_count_mismatch"
    | "model_feature_count_mismatch"
    | "missing_scoring_feature"
    | "categorical_unknown_rate";
  feature?: string;
  featureGroup?: SelectedFeatureGroup;
  rowId?: string;
  expected?: number;
  actual?: number;
  trainingRate?: number;
  scoringRate?: number;
  allowedRate?: number;
  message: string;
};

export type XgArtifactFeatureContractAudit = {
  passed: boolean;
  checkedRowCount: number;
  encodedFeatureCount: number;
  selectedFeatureCounts: Record<SelectedFeatureGroup, number>;
  issues: XgArtifactFeatureContractIssue[];
};

type LogisticModel = {
  featureCount: number;
  weights: number[];
  bias: number;
};

type XgBoostNode = {
  featureIndex: number | null;
  threshold: number | null;
  left: XgBoostNode | null;
  right: XgBoostNode | null;
  value: number | null;
  isLeaf: boolean;
};

type XgBoostModel = {
  trees: Array<{ root: XgBoostNode }>;
  params?: {
    learningRate?: number;
  };
};

export type PersistedFeatureRow = {
  feature_version: number;
  game_id: number;
  event_id: number;
  season_id: number | null;
  game_date: string | null;
  event_owner_team_id: number | null;
  shooter_player_id: number | null;
  goalie_in_net_id: number | null;
  shot_event_type: string | null;
  is_goal: boolean;
  creates_rebound: boolean;
  feature_payload: NhlShotFeatureRow;
};

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function integerOrNull(value: number | null | undefined): number | null {
  const finite = finiteOrNull(value);
  return finite == null ? null : Math.trunc(finite);
}

function boolOrFalse(value: boolean | null | undefined): boolean {
  return value === true;
}

function dotProduct(left: number[], right: number[]): number {
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) {
    sum += left[index] * (right[index] ?? 0);
  }
  return sum;
}

function sigmoid(value: number): number {
  if (value >= 0) {
    const exp = Math.exp(-value);
    return 1 / (1 + exp);
  }

  const exp = Math.exp(value);
  return exp / (1 + exp);
}

function clipProbability(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1 - EPSILON, Math.max(EPSILON, value));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return String(error);
}

function isRetryableSupabaseError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("fetch failed") ||
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("socket") ||
    message.includes("network")
  );
}

function normalizeCategoricalValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function readFeatureValue(row: NhlShotFeatureRow, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}

function hasFeatureKey(row: NhlShotFeatureRow, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(row, key);
}

function buildFeatureRowId(row: NhlShotFeatureRow): string {
  const gameId = (row as { gameId?: unknown }).gameId;
  const eventId = (row as { eventId?: unknown }).eventId;
  return `${gameId ?? "unknown"}:${eventId ?? "unknown"}`;
}

function getSelectedFeatureEntries(artifact: PersistedXgModelArtifact): Array<{
  feature: string;
  featureGroup: SelectedFeatureGroup;
}> {
  return (["numeric", "boolean", "categorical"] as SelectedFeatureGroup[]).flatMap(
    (featureGroup) =>
      artifact.selectedFeatures[featureGroup].map((feature) => ({
        feature,
        featureGroup
      }))
  );
}

function resolveEncodedFeatureCount(artifact: PersistedXgModelArtifact): number {
  const categoricalLevels = resolveCategoricalLevels(artifact);
  return (
    artifact.selectedFeatures.numeric.length +
    artifact.selectedFeatures.boolean.length +
    artifact.selectedFeatures.categorical.reduce(
      (sum, key) => sum + (categoricalLevels[key]?.length ?? 0),
      0
    )
  );
}

function resolveModelFeatureCount(artifact: PersistedXgModelArtifact): number | null {
  const model = artifact.model;
  if (
    model &&
    typeof model === "object" &&
    "featureCount" in model &&
    typeof (model as { featureCount?: unknown }).featureCount === "number" &&
    Number.isFinite((model as { featureCount: number }).featureCount)
  ) {
    return (model as { featureCount: number }).featureCount;
  }

  return null;
}

export function auditXgArtifactFeatureContract(args: {
  artifact: PersistedXgModelArtifact;
  rows?: NhlShotFeatureRow[];
  maxIssues?: number;
}): XgArtifactFeatureContractAudit {
  const { artifact } = args;
  const rows = args.rows ?? [];
  const maxIssues = Math.max(1, args.maxIssues ?? 25);
  const issues: XgArtifactFeatureContractIssue[] = [];
  const pushIssue = (issue: XgArtifactFeatureContractIssue): void => {
    if (issues.length < maxIssues) issues.push(issue);
  };
  const categoricalLevels = resolveCategoricalLevels(artifact);
  const encodedFeatureCount = resolveEncodedFeatureCount(artifact);
  const selectedFeatureEntries = getSelectedFeatureEntries(artifact);
  const seenFeatures = new Map<string, SelectedFeatureGroup>();

  for (const reason of artifact.featureCoverage?.blockingReasons ?? []) {
    pushIssue({
      code: "feature_coverage_blocking_reason",
      message: reason
    });
  }

  for (const entry of selectedFeatureEntries) {
    const priorGroup = seenFeatures.get(entry.feature);
    if (priorGroup) {
      pushIssue({
        code: "duplicate_selected_feature",
        feature: entry.feature,
        featureGroup: entry.featureGroup,
        message:
          `Selected feature "${entry.feature}" appears in both ${priorGroup} ` +
          `and ${entry.featureGroup}.`
      });
    }
    seenFeatures.set(entry.feature, entry.featureGroup);
  }

  for (const feature of artifact.selectedFeatures.categorical) {
    const levels = categoricalLevels[feature] ?? [];
    if (levels.length === 0) {
      pushIssue({
        code: "empty_categorical_levels",
        feature,
        featureGroup: "categorical",
        message: `Categorical selected feature "${feature}" has no encoded levels.`
      });
    }
  }

  if (artifact.featureKeys.length > 0 && artifact.featureKeys.length !== encodedFeatureCount) {
    pushIssue({
      code: "feature_key_count_mismatch",
      expected: encodedFeatureCount,
      actual: artifact.featureKeys.length,
      message:
        `Artifact featureKeys length ${artifact.featureKeys.length} does not match ` +
        `the encoded selected-feature count ${encodedFeatureCount}.`
    });
  }

  const modelFeatureCount = resolveModelFeatureCount(artifact);
  if (modelFeatureCount != null && modelFeatureCount !== encodedFeatureCount) {
    pushIssue({
      code: "model_feature_count_mismatch",
      expected: modelFeatureCount,
      actual: encodedFeatureCount,
      message:
        `Model expects ${modelFeatureCount} features but the artifact contract ` +
        `encodes ${encodedFeatureCount}.`
    });
  }

  for (const row of rows) {
    for (const entry of selectedFeatureEntries) {
      if (!hasFeatureKey(row, entry.feature)) {
        pushIssue({
          code: "missing_scoring_feature",
          feature: entry.feature,
          featureGroup: entry.featureGroup,
          rowId: buildFeatureRowId(row),
          message:
            `Scoring payload ${buildFeatureRowId(row)} is missing selected ` +
            `${entry.featureGroup} feature "${entry.feature}".`
        });
      }
    }
  }

  for (const issue of auditScoringRowsAgainstFeatureCoverage({
    rows,
    selectedFeatures: artifact.selectedFeatures,
    trainingProfile: artifact.featureCoverage ?? null,
  })) {
    pushIssue({
      code: issue.code,
      feature: issue.feature,
      featureGroup: issue.featureGroup,
      trainingRate: issue.trainingRate,
      scoringRate: issue.scoringRate,
      allowedRate: issue.allowedRate,
      message: issue.message,
    });
  }

  return {
    passed: issues.length === 0,
    checkedRowCount: rows.length,
    encodedFeatureCount,
    selectedFeatureCounts: {
      numeric: artifact.selectedFeatures.numeric.length,
      boolean: artifact.selectedFeatures.boolean.length,
      categorical: artifact.selectedFeatures.categorical.length
    },
    issues
  };
}

export function assertXgArtifactFeatureContract(args: {
  artifact: PersistedXgModelArtifact;
  rows?: NhlShotFeatureRow[];
  maxIssues?: number;
}): void {
  const audit = auditXgArtifactFeatureContract(args);
  if (audit.passed) return;

  throw new Error(
    `xG artifact feature contract failed for ${args.artifact.artifactTag}: ` +
      audit.issues.map((issue) => issue.message).join("; ")
  );
}

export function mapShotFeatureRowToDb(row: NhlShotFeatureRow) {
  return {
    feature_version: row.featureVersion,
    game_id: row.gameId,
    event_id: row.eventId,
    season_id: row.seasonId,
    game_date: row.gameDate,
    event_index: row.eventIndex,
    sort_order: row.sortOrder,
    period_number: row.periodNumber,
    period_type: row.periodType,
    game_seconds_elapsed: integerOrNull(row.gameSecondsElapsed),
    period_seconds_elapsed: integerOrNull(row.periodSecondsElapsed),
    event_owner_team_id: row.eventOwnerTeamId,
    event_owner_side: row.eventOwnerSide,
    strength_state: row.strengthState,
    strength_exact: row.strengthExact,
    shot_event_type: row.shotEventType,
    is_goal: row.isGoal,
    is_own_goal: row.isOwnGoal,
    is_shot_on_goal: row.isShotOnGoal,
    is_missed_shot: row.isMissedShot,
    is_blocked_shot: row.isBlockedShot,
    is_unblocked_shot_attempt: row.isUnblockedShotAttempt,
    shooter_player_id: row.shooterPlayerId,
    shooting_player_id: row.shootingPlayerId,
    scoring_player_id: row.scoringPlayerId,
    goalie_in_net_id: row.goalieInNetId,
    shot_type: row.shotType,
    zone_code: row.zoneCode,
    raw_x: row.rawX,
    raw_y: row.rawY,
    normalized_x: row.normalizedX,
    normalized_y: row.normalizedY,
    shot_distance_feet: row.shotDistanceFeet,
    shot_angle_degrees: row.shotAngleDegrees,
    shooter_roster_position: row.shooterRosterPosition,
    shooter_position_group: row.shooterPositionGroup,
    is_defenseman_shooter: row.isDefensemanShooter,
    shooter_handedness: row.shooterHandedness,
    goalie_catch_hand: row.goalieCatchHand,
    shooter_goalie_handedness_matchup: row.shooterGoalieHandednessMatchup,
    previous_event_id: row.previousEventId,
    previous_event_type_desc_key: row.previousEventTypeDescKey,
    previous_event_team_id: row.previousEventTeamId,
    previous_event_same_team: row.previousEventSameTeam,
    time_since_previous_event_seconds: row.timeSincePreviousEventSeconds,
    distance_from_previous_event: row.distanceFromPreviousEvent,
    is_rebound_shot: row.isReboundShot,
    rebound_source_event_id: row.reboundSourceEventId,
    rebound_time_delta_seconds: row.reboundTimeDeltaSeconds,
    rebound_distance_from_source: row.reboundDistanceFromSource,
    rebound_lateral_displacement_feet: row.reboundLateralDisplacementFeet,
    rebound_distance_delta_feet: row.reboundDistanceDeltaFeet,
    rebound_angle_change_degrees: row.reboundAngleChangeDegrees,
    creates_rebound: row.createsRebound,
    is_rush_shot: row.isRushShot,
    rush_source_event_id: row.rushSourceEventId,
    rush_time_since_source_seconds: row.rushTimeSinceSourceSeconds,
    is_flurry_shot: row.isFlurryShot,
    flurry_sequence_id: row.flurrySequenceId,
    flurry_shot_index: row.flurryShotIndex,
    flurry_shot_count: row.flurryShotCount,
    miss_reason_bucket: row.missReasonBucket,
    is_short_side_miss: row.isShortSideMiss,
    owner_power_play_age_seconds: row.ownerPowerPlayAgeSeconds,
    shooter_shift_age_seconds: row.shooterShiftAgeSeconds,
    owner_forward_count_on_ice: row.ownerForwardCountOnIce,
    owner_defense_count_on_ice: row.ownerDefenseCountOnIce,
    opponent_forward_count_on_ice: row.opponentForwardCountOnIce,
    opponent_defense_count_on_ice: row.opponentDefenseCountOnIce,
    owner_goalie_on_ice: row.ownerGoalieOnIce,
    opponent_goalie_on_ice: row.opponentGoalieOnIce,
    owner_skater_deployment_bucket: row.ownerSkaterDeploymentBucket,
    opponent_skater_deployment_bucket: row.opponentSkaterDeploymentBucket,
    skater_role_matchup_bucket: row.skaterRoleMatchupBucket,
    east_west_movement_feet: row.eastWestMovementFeet,
    north_south_movement_feet: row.northSouthMovementFeet,
    crossed_royal_road: row.crossedRoyalRoad,
    is_penalty_shot_event: row.isPenaltyShotEvent,
    is_shootout_event: row.isShootoutEvent,
    is_delayed_penalty_event: row.isDelayedPenaltyEvent,
    is_empty_net_event: row.isEmptyNetEvent,
    is_overtime_event: row.isOvertimeEvent,
    has_rare_manpower: row.hasRareManpower,
    feature_payload: row,
    provenance: {
      source: "nhl_api_pbp_events+nhl_api_shift_rows",
      builder: "buildShotFeatureRows"
    },
    updated_at: new Date().toISOString()
  };
}

export function loadXgModelArtifact(filePath: string): PersistedXgModelArtifact {
  const resolved = path.resolve(filePath);
  return JSON.parse(fs.readFileSync(resolved, "utf8")) as PersistedXgModelArtifact;
}

export function resolveXgArtifactPredictionType(
  artifact: PersistedXgModelArtifact
): XgShotPredictionType {
  return artifact.predictionType ?? "shot_goal";
}

export function assertXgArtifactSupportsPredictionType(
  artifact: PersistedXgModelArtifact,
  predictionType: XgShotPredictionType
): void {
  const artifactPredictionType = resolveXgArtifactPredictionType(artifact);
  if (artifactPredictionType !== predictionType) {
    throw new Error(
      `Model artifact ${artifact.artifactTag} is for predictionType=${artifactPredictionType}; requested predictionType=${predictionType}.`
    );
  }
}

export function encodeFeatureVector(
  row: NhlShotFeatureRow,
  artifact: PersistedXgModelArtifact
): number[] {
  assertXgArtifactFeatureContract({ artifact, rows: [row], maxIssues: 10 });
  const categoricalLevels = resolveCategoricalLevels(artifact);
  const numeric = artifact.selectedFeatures.numeric.map((key) => {
    const value = readFeatureValue(row, key);
    const raw = typeof value === "number" && Number.isFinite(value) ? value : 0;
    const transform = artifact.featureTransforms?.numericStandardization?.[key];
    return transform ? (raw - transform.mean) / transform.std : raw;
  });
  const bools = artifact.selectedFeatures.boolean.map((key) =>
    readFeatureValue(row, key) === true ? 1 : 0
  );
  const categorical = artifact.selectedFeatures.categorical.flatMap((key) => {
    const value = normalizeCategoricalValue(readFeatureValue(row, key));
    return (categoricalLevels[key] ?? []).map((level) =>
      value === level ? 1 : 0
    );
  });

  return [...numeric, ...bools, ...categorical];
}

function resolveCategoricalLevels(
  artifact: PersistedXgModelArtifact
): Record<string, string[]> {
  if (artifact.categoricalLevels) {
    return artifact.categoricalLevels;
  }

  return Object.fromEntries(
    artifact.selectedFeatures.categorical.map((key) => {
      const prefix = `${key}:`;
      const levels = artifact.featureKeys
        .filter((featureKey) => featureKey.startsWith(prefix))
        .map((featureKey) => featureKey.slice(prefix.length));
      return [key, levels];
    })
  );
}

function predictLogistic(model: LogisticModel, features: number[]): number {
  if (features.length !== model.featureCount) {
    throw new Error(
      `Model expects ${model.featureCount} features but encoded ${features.length}.`
    );
  }

  return clipProbability(sigmoid(dotProduct(model.weights, features) + model.bias));
}

function predictXgBoostNode(features: number[], node: XgBoostNode): number {
  if (node.isLeaf) return node.value ?? 0;
  const featureIndex = node.featureIndex ?? 0;
  const threshold = node.threshold ?? 0;
  const child = (features[featureIndex] ?? 0) <= threshold ? node.left : node.right;
  return child ? predictXgBoostNode(features, child) : 0;
}

function predictXgBoost(model: XgBoostModel, features: number[]): number {
  const learningRate = model.params?.learningRate ?? 0.3;
  let prediction = 0.5;

  for (const tree of model.trees ?? []) {
    prediction += learningRate * predictXgBoostNode(features, tree.root);
  }

  return clipProbability(sigmoid(prediction));
}

export function predictShotGoalProbability(
  row: NhlShotFeatureRow,
  artifact: PersistedXgModelArtifact
): number {
  return predictShotGoalProbabilities(row, artifact).xg;
}

export function predictShotGoalProbabilities(
  row: NhlShotFeatureRow,
  artifact: PersistedXgModelArtifact
): { rawProbability: number; calibratedProbability: number | null; xg: number } {
  // This function returns a shot-quality probability for a single shot event.
  // Summing these probabilities creates ixG/xGF/xGA; it is not forecasting
  // future goals for a player or team.
  const features = encodeFeatureVector(row, artifact);
  let rawProbability: number;

  if (
    artifact.family === "logistic_unregularized" ||
    artifact.family === "logistic_l2" ||
    artifact.family === "logistic_elastic_net"
  ) {
    rawProbability = predictLogistic(artifact.model as LogisticModel, features);
  } else if (artifact.family === "xgboost_js") {
    rawProbability = predictXgBoost(artifact.model as XgBoostModel, features);
  } else {
    throw new Error(`Unsupported xG model family: ${artifact.family}`);
  }

  const calibratedProbability =
    artifact.calibration?.applied === true
      ? predictWithSerializedCalibrator(artifact.calibration.model, rawProbability)
      : null;

  return {
    rawProbability,
    calibratedProbability,
    xg: calibratedProbability ?? rawProbability,
  };
}

export function hashFeaturePayload(row: NhlShotFeatureRow): string {
  return crypto.createHash("sha1").update(JSON.stringify(row)).digest("hex");
}

export function buildPredictionDbRow(args: {
  feature: PersistedFeatureRow;
  artifact: PersistedXgModelArtifact;
  modelArtifactPath: string | null;
  predictionType: XgShotPredictionType;
  rawProbability: number;
  calibratedProbability: number | null;
  xg: number;
}) {
  const featurePayload = args.feature.feature_payload;
  const approved = args.artifact.approvalGradeEligibility?.isEligible === true;

  return {
    model_version: args.artifact.artifactTag,
    prediction_type: args.predictionType,
    feature_version: args.feature.feature_version,
    game_id: args.feature.game_id,
    event_id: args.feature.event_id,
    season_id: args.feature.season_id,
    game_date: args.feature.game_date,
    event_owner_team_id: args.feature.event_owner_team_id,
    shooter_player_id: args.feature.shooter_player_id,
    goalie_in_net_id: args.feature.goalie_in_net_id,
    shot_event_type: args.feature.shot_event_type,
    label:
      args.predictionType === "shot_goal"
        ? boolOrFalse(args.feature.is_goal)
        : boolOrFalse(args.feature.creates_rebound),
    xg: args.xg,
    raw_probability: args.rawProbability,
    calibrated_probability: args.calibratedProbability,
    model_family: args.artifact.family,
    model_artifact_tag: args.artifact.artifactTag,
    model_artifact_path: args.modelArtifactPath,
    model_approved: approved,
    feature_payload_hash: hashFeaturePayload(featurePayload),
    provenance: {
      featureFamily: args.artifact.featureFamily ?? null,
      selectedFeatures: args.artifact.selectedFeatures,
      featureCoverage: args.artifact.featureCoverage ?? null,
      calibration: args.artifact.calibration ?? null,
      predictionType: resolveXgArtifactPredictionType(args.artifact),
      approved,
      approvalBlockingReasons:
        args.artifact.approvalGradeEligibility?.blockingReasons ?? []
    },
    updated_at: new Date().toISOString()
  };
}

export async function upsertXgShotFeatureRows(
  supabase: SupabaseClient<Database>,
  rows: NhlShotFeatureRow[],
  options?: { batchSize?: number; maxRetries?: number }
): Promise<number> {
  if (rows.length === 0) return 0;

  const batchSize = Math.max(1, options?.batchSize ?? DEFAULT_SHOT_FEATURE_UPSERT_BATCH_SIZE);
  const maxRetries = Math.max(0, options?.maxRetries ?? DEFAULT_SHOT_FEATURE_UPSERT_RETRIES);
  let upserted = 0;

  for (let index = 0; index < rows.length; index += batchSize) {
    const dbRows = rows.slice(index, index + batchSize).map(mapShotFeatureRowToDb);

    for (let attempt = 0; ; attempt += 1) {
      try {
        const { error } = await supabase
          .from("nhl_xg_shot_features" as any)
          .upsert(dbRows as any, {
            onConflict: "feature_version,game_id,event_id"
          });

        if (error) {
          throw error;
        }

        break;
      } catch (error) {
        if (attempt >= maxRetries || !isRetryableSupabaseError(error)) {
          throw new Error(
            `Failed to upsert nhl_xg_shot_features at row ${index}: ${getErrorMessage(error)}`
          );
        }

        await sleep(1000 * 2 ** attempt);
      }
    }

    upserted += dbRows.length;
  }

  return upserted;
}

export async function fetchPersistedFeatureRows(args: {
  supabase: SupabaseClient<Database>;
  gameIds: number[];
  featureVersion: number;
  predictionType?: XgShotPredictionType;
  limit: number | null;
}): Promise<PersistedFeatureRow[]> {
  const predictionType = args.predictionType ?? "shot_goal";
  let query = args.supabase
    .from("nhl_xg_shot_features" as any)
    .select(
      "feature_version, game_id, event_id, season_id, game_date, event_owner_team_id, shooter_player_id, goalie_in_net_id, shot_event_type, is_goal, creates_rebound, feature_payload"
    )
    .eq("feature_version", args.featureVersion)
    .in("game_id", args.gameIds)
    .eq("is_penalty_shot_event", false)
    .eq("is_shootout_event", false)
    .order("game_id", { ascending: true })
    .order("event_id", { ascending: true });

  if (predictionType === "rebound_creation") {
    query = query.in("shot_event_type", ["shot-on-goal", "missed-shot", "blocked-shot"]);
  } else {
    query = query.eq("is_unblocked_shot_attempt", true);
  }

  if (args.limit != null) {
    query = query.limit(args.limit);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch nhl_xg_shot_features: ${error.message}`);
  }

  return ((data ?? []) as unknown) as PersistedFeatureRow[];
}
