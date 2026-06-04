import { describe, expect, it } from "vitest";

import { buildXgModelRegistryRow } from "./modelRegistry";
import type { PersistedXgModelArtifact } from "./shotFeaturePersistence";

function artifact(overrides: Partial<PersistedXgModelArtifact> = {}): PersistedXgModelArtifact {
  return {
    artifactKind: "nhl_xg_model",
    artifactVersion: 1,
    artifactTag: "logistic_l2-s20252026-p1-st1-f1-cfgtest",
    family: "logistic_l2",
    generatedAt: "2026-06-01T12:00:00.000Z",
    sourceCommitSha: "abc123",
    parserVersion: 1,
    strengthVersion: 1,
    featureVersion: 1,
    predictionType: "shot_goal",
    seasonScope: 20252026,
    trainExampleCount: 100,
    validationExampleCount: 20,
    testExampleCount: 20,
    splitDateRanges: {
      train: { startDate: "2025-10-01", endDate: "2026-01-01" },
      validation: { startDate: "2026-01-02", endDate: "2026-02-01" },
      test: { startDate: "2026-02-02", endDate: "2026-04-15" },
    },
    approvalGradeEligibility: {
      isEligible: true,
      blockingReasons: [],
    },
    selectedFeatures: {
      numeric: ["shotDistanceFeet"],
      boolean: ["isReboundShot"],
      categorical: ["shotType"],
    },
    featureKeys: ["shotDistanceFeet", "isReboundShot", "shotType:wrist"],
    categoricalLevels: {
      shotType: ["wrist"],
    },
    calibration: {
      selectedMethod: "isotonic",
      applied: true,
      model: { method: "isotonic", blocks: [] },
    },
    model: {
      featureCount: 3,
      weights: [0.1, 0.2, 0.3],
      bias: -1,
    },
    ...overrides,
  };
}

describe("modelRegistry", () => {
  it("builds a deterministic registry row from an approved model artifact", () => {
    const row = buildXgModelRegistryRow({
      artifact: artifact(),
      artifactPath: "/models/model-artifact.json",
      artifactChecksum: "checksum",
      deploymentAlias: "champion",
      isActive: true,
      isChampion: true,
    });

    expect(row).toMatchObject({
      model_version: "logistic_l2-s20252026-p1-st1-f1-cfgtest",
      prediction_type: "shot_goal",
      artifact_tag: "logistic_l2-s20252026-p1-st1-f1-cfgtest",
      model_family: "logistic_l2",
      feature_version: 1,
      artifact_uri: "/models/model-artifact.json",
      artifact_checksum: "checksum",
      generated_at: "2026-06-01T12:00:00.000Z",
      source_commit_sha: "abc123",
      season_scope: 20252026,
      train_start_date: "2025-10-01",
      train_end_date: "2026-01-01",
      validation_start_date: "2026-01-02",
      validation_end_date: "2026-02-01",
      test_start_date: "2026-02-02",
      test_end_date: "2026-04-15",
      train_example_count: 100,
      validation_example_count: 20,
      test_example_count: 20,
      approval_status: "approved",
      model_approved: true,
      deployment_alias: "champion",
      is_active: true,
      is_champion: true,
    });
    expect(row.feature_manifest_hash).toHaveLength(64);
    expect(row.calibration_fingerprint).toHaveLength(64);
  });

  it("defaults unapproved artifacts to candidate status", () => {
    const row = buildXgModelRegistryRow({
      artifact: artifact({
        artifactTag: "candidate",
        approvalGradeEligibility: {
          isEligible: false,
          blockingReasons: ["not enough test goals"],
        },
      }),
      artifactChecksum: "checksum",
    });

    expect(row.approval_status).toBe("candidate");
    expect(row.model_approved).toBe(false);
    expect(row.deployment_alias).toBe("candidate");
    expect(row.approval_metadata).toEqual({
      isEligible: false,
      blockingReasons: ["not enough test goals"],
    });
  });
});
