import { describe, expect, it } from "vitest";

import {
  buildXgModelRegistryRow,
  pickActiveXgModel,
  type XgActiveModelRegistryRow,
} from "./modelRegistry";
import { XG_APPROVAL_GATE_VERSION } from "./approvalGate";
import type { PersistedXgModelArtifact } from "./shotFeaturePersistence";

/** A decision-88 gate record with every check passed. */
const AFFIRMATIVE_APPROVAL = {
  gateVersion: XG_APPROVAL_GATE_VERSION,
  isEligible: true,
  blockingReasons: [],
  evidence: {
    testExampleCount: 20000,
    relativeStandardError: 0.03,
    checks: {
      holdoutPresent: true,
      chronologicalUntouchedTest: true,
      sufficientEvidence: true,
      beatsBaseRateLogLoss: true,
      beatsBaseRateBrier: true,
      calibrationInTheLarge: true,
      spiegelhalter: true,
      subgroupCalibration: true,
      noOutcomeLeakage: true,
      calibrationAppliedFromValidation: true,
      featureCoverage: true,
    },
  },
};

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
    approvalGradeEligibility: AFFIRMATIVE_APPROVAL,
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
      promotionConfirmed: true,
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

  it("does not approve or promote an old-schema record without decision-88 evidence (W3-1 D6)", () => {
    const oldSchema = artifact({ approvalGradeEligibility: { isEligible: true, blockingReasons: [] } });
    const row = buildXgModelRegistryRow({ artifact: oldSchema, artifactChecksum: "checksum" });
    expect(row).toMatchObject({ approval_status: "candidate", model_approved: false });
    expect(() =>
      buildXgModelRegistryRow({ artifact: oldSchema, isActive: true, isChampion: true, promotionConfirmed: true })
    ).toThrow("Only an approved artifact can be activated or promoted.");
  });

  it("rejects approved lifecycle state for an ineligible artifact", () => {
    expect(() =>
      buildXgModelRegistryRow({
        artifact: artifact({
          approvalGradeEligibility: {
            isEligible: false,
            blockingReasons: ["calibration drift"],
          },
        }),
        approvalStatus: "approved",
      })
    ).toThrow("not approval-eligible");
  });

  it("requires explicit confirmation before activation or champion promotion", () => {
    expect(() =>
      buildXgModelRegistryRow({
        artifact: artifact(),
        isActive: true,
      })
    ).toThrow("confirmPromotion=true");

    expect(() =>
      buildXgModelRegistryRow({
        artifact: artifact(),
        isChampion: true,
        promotionConfirmed: true,
      })
    ).toThrow("must also be active");
  });
});

describe("pickActiveXgModel (registry pin)", () => {
  const row = (overrides: Partial<XgActiveModelRegistryRow>): XgActiveModelRegistryRow => ({
    model_version: "cfg-champion",
    feature_version: 1,
    prediction_type: "shot_goal",
    approval_status: "approved",
    model_approved: true,
    is_active: true,
    is_champion: true,
    ...overrides,
  });
  const champion = row({});
  const shadow = row({
    model_version: "cfg-shadow",
    feature_version: 2,
    approval_status: "candidate",
    model_approved: false,
    is_active: false,
    is_champion: false,
  });
  const otherActive = row({ model_version: "cfg-other", feature_version: 2, is_champion: false });

  it("pins the unique active approved champion whatever the row order", () => {
    for (const rows of [[champion, shadow, otherActive], [otherActive, shadow, champion]]) {
      expect(pickActiveXgModel(rows)).toEqual({
        model: { modelVersion: "cfg-champion", featureVersion: 1, predictionType: "shot_goal" },
        reason: "unique_active_champion",
      });
    }
  });

  it("never selects an unapproved, inactive or other-type row", () => {
    expect(pickActiveXgModel([shadow]).model).toBeNull();
    expect(pickActiveXgModel([row({ approval_status: "retired" })]).model).toBeNull();
    expect(pickActiveXgModel([row({ is_active: false })]).model).toBeNull();
    expect(pickActiveXgModel([row({ prediction_type: "rebound_creation" })]).model).toBeNull();
  });

  it("returns unknown, not the first row, when two active rows tie", () => {
    const a = row({ is_champion: false });
    expect(pickActiveXgModel([a, otherActive])).toEqual({
      model: null,
      reason: "ambiguous_active_models",
    });
    expect(pickActiveXgModel([champion, row({ model_version: "cfg-two" })])).toEqual({
      model: null,
      reason: "ambiguous_active_models",
    });
  });
});
