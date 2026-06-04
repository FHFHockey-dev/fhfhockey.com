import crypto from "crypto";
import fs from "fs";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database-generated.types";
import {
  resolveXgArtifactPredictionType,
  type PersistedXgModelArtifact,
  type XgShotPredictionType,
} from "./shotFeaturePersistence";

export type XgModelApprovalStatus = "candidate" | "approved" | "rejected" | "retired";

export type XgModelRegistryRow = {
  model_version: string;
  prediction_type: XgShotPredictionType;
  artifact_tag: string;
  model_family: string;
  feature_family: string | null;
  feature_version: number;
  artifact_uri: string | null;
  artifact_checksum: string;
  feature_manifest_hash: string;
  calibration_fingerprint: string;
  generated_at: string | null;
  source_commit_sha: string | null;
  season_scope: number | null;
  train_start_date: string | null;
  train_end_date: string | null;
  validation_start_date: string | null;
  validation_end_date: string | null;
  test_start_date: string | null;
  test_end_date: string | null;
  train_example_count: number | null;
  validation_example_count: number | null;
  test_example_count: number | null;
  approval_status: XgModelApprovalStatus;
  model_approved: boolean;
  deployment_alias: string | null;
  is_active: boolean;
  is_champion: boolean;
  selected_features: unknown;
  feature_keys: unknown;
  feature_coverage: unknown;
  feature_transforms: unknown;
  calibration_metadata: unknown;
  evaluation_metadata: unknown;
  approval_metadata: unknown;
  artifact_metadata: unknown;
  updated_at: string;
};

function stableJsonStringify(value: unknown): string {
  if (value == null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJsonStringify(entry)).join(",")}]`;
  }

  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJsonStringify(object[key])}`)
    .join(",")}}`;
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hashXgModelArtifactFile(filePath: string): string {
  return sha256(fs.readFileSync(filePath, "utf8"));
}

function inferApprovalStatus(
  artifact: PersistedXgModelArtifact,
  explicitStatus?: XgModelApprovalStatus | null
): XgModelApprovalStatus {
  if (explicitStatus) return explicitStatus;
  return artifact.approvalGradeEligibility?.isEligible === true ? "approved" : "candidate";
}

function dateRange(
  artifact: PersistedXgModelArtifact,
  split: "train" | "validation" | "test",
  field: "startDate" | "endDate"
): string | null {
  return artifact.splitDateRanges?.[split]?.[field] ?? null;
}

export function buildXgModelRegistryRow(args: {
  artifact: PersistedXgModelArtifact;
  artifactPath?: string | null;
  artifactChecksum?: string | null;
  approvalStatus?: XgModelApprovalStatus | null;
  deploymentAlias?: string | null;
  isActive?: boolean;
  isChampion?: boolean;
}): XgModelRegistryRow {
  const artifactChecksum =
    args.artifactChecksum ??
    (args.artifactPath ? hashXgModelArtifactFile(args.artifactPath) : sha256(stableJsonStringify(args.artifact)));
  const predictionType = resolveXgArtifactPredictionType(args.artifact);
  const featureManifest = {
    selectedFeatures: args.artifact.selectedFeatures,
    featureKeys: args.artifact.featureKeys,
    categoricalLevels: args.artifact.categoricalLevels ?? null,
    featureCoverage: args.artifact.featureCoverage ?? null,
  };
  const calibrationMetadata = {
    calibration: args.artifact.calibration ?? null,
    calibrationAssessment: args.artifact.calibrationAssessment ?? null,
  };
  const now = new Date().toISOString();
  const modelApproved = args.artifact.approvalGradeEligibility?.isEligible === true;

  return {
    model_version: args.artifact.artifactTag,
    prediction_type: predictionType,
    artifact_tag: args.artifact.artifactTag,
    model_family: args.artifact.family,
    feature_family: args.artifact.featureFamily ?? null,
    feature_version: args.artifact.featureVersion,
    artifact_uri: args.artifactPath ?? null,
    artifact_checksum: artifactChecksum,
    feature_manifest_hash: sha256(stableJsonStringify(featureManifest)),
    calibration_fingerprint: sha256(stableJsonStringify(calibrationMetadata)),
    generated_at: args.artifact.generatedAt ?? null,
    source_commit_sha: args.artifact.sourceCommitSha ?? null,
    season_scope:
      typeof args.artifact.seasonScope === "number"
        ? args.artifact.seasonScope
        : args.artifact.seasonScopes?.[0] ?? null,
    train_start_date: dateRange(args.artifact, "train", "startDate"),
    train_end_date: dateRange(args.artifact, "train", "endDate"),
    validation_start_date: dateRange(args.artifact, "validation", "startDate"),
    validation_end_date: dateRange(args.artifact, "validation", "endDate"),
    test_start_date: dateRange(args.artifact, "test", "startDate"),
    test_end_date: dateRange(args.artifact, "test", "endDate"),
    train_example_count: args.artifact.trainExampleCount ?? null,
    validation_example_count: args.artifact.validationExampleCount ?? null,
    test_example_count: args.artifact.testExampleCount ?? null,
    approval_status: inferApprovalStatus(args.artifact, args.approvalStatus),
    model_approved: modelApproved,
    deployment_alias: args.deploymentAlias ?? "candidate",
    is_active: args.isActive === true,
    is_champion: args.isChampion === true,
    selected_features: args.artifact.selectedFeatures,
    feature_keys: args.artifact.featureKeys,
    feature_coverage: args.artifact.featureCoverage ?? null,
    feature_transforms: args.artifact.featureTransforms ?? null,
    calibration_metadata: calibrationMetadata,
    evaluation_metadata: {
      evaluation: args.artifact.evaluation ?? null,
      trainExampleCount: args.artifact.trainExampleCount ?? null,
      validationExampleCount: args.artifact.validationExampleCount ?? null,
      testExampleCount: args.artifact.testExampleCount ?? null,
      splitDateRanges: args.artifact.splitDateRanges ?? null,
    },
    approval_metadata: args.artifact.approvalGradeEligibility ?? {},
    artifact_metadata: {
      artifactKind: args.artifact.artifactKind,
      artifactVersion: args.artifact.artifactVersion ?? null,
      parserVersion: args.artifact.parserVersion ?? null,
      strengthVersion: args.artifact.strengthVersion ?? null,
      seasonScope: args.artifact.seasonScope ?? null,
      seasonScopes: args.artifact.seasonScopes ?? null,
      randomSeed: (args.artifact as { randomSeed?: unknown }).randomSeed ?? null,
      splitConfig: (args.artifact as { splitConfig?: unknown }).splitConfig ?? null,
      splitStrategy: (args.artifact as { splitStrategy?: unknown }).splitStrategy ?? null,
      fitOptions: (args.artifact as { fitOptions?: unknown }).fitOptions ?? null,
    },
    updated_at: now,
  };
}

export async function upsertXgModelRegistryRow(args: {
  supabase: SupabaseClient<Database>;
  row: XgModelRegistryRow;
}): Promise<void> {
  if (args.row.is_active && args.row.deployment_alias) {
    const { error } = await args.supabase
      .from("nhl_xg_model_registry" as never)
      .update({ is_active: false, updated_at: new Date().toISOString() } as never)
      .eq("prediction_type", args.row.prediction_type)
      .eq("deployment_alias", args.row.deployment_alias);
    if (error) throw error;
  }

  if (args.row.is_champion) {
    const { error } = await args.supabase
      .from("nhl_xg_model_registry" as never)
      .update({ is_champion: false, updated_at: new Date().toISOString() } as never)
      .eq("prediction_type", args.row.prediction_type);
    if (error) throw error;
  }

  const { error } = await args.supabase
    .from("nhl_xg_model_registry" as never)
    .upsert(args.row as never, {
      onConflict: "model_version,prediction_type",
    });
  if (error) throw error;
}
