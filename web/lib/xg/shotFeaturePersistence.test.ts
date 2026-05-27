import { describe, expect, it } from "vitest";

import {
  buildPredictionDbRow,
  predictShotGoalProbabilities,
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
});
