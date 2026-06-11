import { describe, expect, it } from "vitest";

import {
  auditXgArtifactFeatureContract,
  buildPredictionDbRow,
  assertXgArtifactSupportsPredictionType,
  predictShotGoalProbabilities,
  resolveXgArtifactPredictionType,
  type PersistedXgModelArtifact,
} from "./shotFeaturePersistence";

describe("shotFeaturePersistence", () => {
  it("applies persisted calibration and stores raw and calibrated probabilities", () => {
    const artifact: PersistedXgModelArtifact = {
      artifactKind: "nhl_xg_model",
      artifactTag: "test-calibrated-artifact",
      family: "logistic_l2",
      featureVersion: 1,
      approvalGradeEligibility: {
        isEligible: true,
        blockingReasons: [],
      },
      selectedFeatures: {
        numeric: [],
        boolean: [],
        categorical: [],
      },
      featureKeys: [],
      calibration: {
        selectedMethod: "isotonic",
        applied: true,
        model: {
          method: "isotonic",
          blocks: [{ maxPrediction: 0.6, weight: 10, averageLabel: 0.25 }],
        },
      },
      model: {
        featureCount: 0,
        weights: [],
        bias: 0,
      },
    };
    const featurePayload = {
      featureVersion: 1,
      gameId: 2025020001,
      eventId: 101,
      isGoal: false,
    } as any;
    const probabilities = predictShotGoalProbabilities(featurePayload, artifact);

    expect(probabilities.rawProbability).toBeCloseTo(0.5, 6);
    expect(probabilities.calibratedProbability).toBeCloseTo(0.25, 6);
    expect(probabilities.xg).toBeCloseTo(0.25, 6);

    const dbRow = buildPredictionDbRow({
      artifact,
      modelArtifactPath: "/tmp/model-artifact.json",
      predictionType: "shot_goal",
      feature: {
        feature_version: 1,
        game_id: 2025020001,
        event_id: 101,
        season_id: 20252026,
        game_date: "2025-10-07",
        event_owner_team_id: 10,
        shooter_player_id: 91,
        goalie_in_net_id: 31,
        shot_event_type: "shot-on-goal",
        is_goal: false,
        creates_rebound: false,
        feature_payload: featurePayload,
      },
      rawProbability: probabilities.rawProbability,
      calibratedProbability: probabilities.calibratedProbability,
      xg: probabilities.xg,
    });

    expect(dbRow.raw_probability).toBeCloseTo(0.5, 6);
    expect(dbRow.calibrated_probability).toBeCloseTo(0.25, 6);
    expect(dbRow.xg).toBeCloseTo(0.25, 6);
    expect(dbRow.provenance.calibration).toMatchObject({
      selectedMethod: "isotonic",
      applied: true,
    });
  });

  it("requires artifacts to match the requested prediction type", () => {
    const legacyShotGoalArtifact = {
      artifactKind: "nhl_xg_model",
      artifactTag: "legacy-shot-goal",
      family: "logistic_l2",
      featureVersion: 1,
      selectedFeatures: {
        numeric: [],
        boolean: [],
        categorical: [],
      },
      featureKeys: [],
      model: {
        featureCount: 0,
        weights: [],
        bias: 0,
      },
    } satisfies PersistedXgModelArtifact;
    const reboundArtifact = {
      ...legacyShotGoalArtifact,
      artifactTag: "rebound-model",
      predictionType: "rebound_creation",
    } satisfies PersistedXgModelArtifact;

    expect(resolveXgArtifactPredictionType(legacyShotGoalArtifact)).toBe("shot_goal");
    expect(resolveXgArtifactPredictionType(reboundArtifact)).toBe("rebound_creation");
    expect(() =>
      assertXgArtifactSupportsPredictionType(legacyShotGoalArtifact, "rebound_creation")
    ).toThrow(
      "Model artifact legacy-shot-goal is for predictionType=shot_goal; requested predictionType=rebound_creation."
    );
    expect(() =>
      assertXgArtifactSupportsPredictionType(reboundArtifact, "rebound_creation")
    ).not.toThrow();
  });

  it("fails closed when a scoring payload is missing a selected feature", () => {
    const artifact: PersistedXgModelArtifact = {
      artifactKind: "nhl_xg_model",
      artifactTag: "requires-shot-distance",
      family: "logistic_l2",
      featureVersion: 1,
      selectedFeatures: {
        numeric: ["shotDistanceFeet"],
        boolean: [],
        categorical: [],
      },
      featureKeys: ["shotDistanceFeet"],
      model: {
        featureCount: 1,
        weights: [0.1],
        bias: 0,
      },
    };

    const audit = auditXgArtifactFeatureContract({
      artifact,
      rows: [{ gameId: 2025020001, eventId: 101 } as any],
    });

    expect(audit.passed).toBe(false);
    expect(audit.issues[0]).toMatchObject({
      code: "missing_scoring_feature",
      feature: "shotDistanceFeet",
      rowId: "2025020001:101",
    });
    expect(() =>
      predictShotGoalProbabilities({ gameId: 2025020001, eventId: 101 } as any, artifact)
    ).toThrow(/missing selected numeric feature "shotDistanceFeet"/);
  });

  it("flags encoded feature count mismatches before scoring", () => {
    const artifact: PersistedXgModelArtifact = {
      artifactKind: "nhl_xg_model",
      artifactTag: "bad-feature-count",
      family: "logistic_l2",
      featureVersion: 1,
      selectedFeatures: {
        numeric: ["shotDistanceFeet"],
        boolean: [],
        categorical: [],
      },
      featureKeys: ["shotDistanceFeet"],
      model: {
        featureCount: 2,
        weights: [0.1, 0.2],
        bias: 0,
      },
    };

    const audit = auditXgArtifactFeatureContract({ artifact });

    expect(audit.passed).toBe(false);
    expect(audit.issues).toContainEqual(
      expect.objectContaining({
        code: "model_feature_count_mismatch",
        expected: 2,
        actual: 1,
      })
    );
  });
});
