import { describe, expect, it } from "vitest";

import type { NhlShotFeatureRow } from "../supabase/Upserts/nhlShotFeatureBuilder";
import {
  auditScoringRowsAgainstFeatureCoverage,
  buildXgFeatureCoverageProfile,
} from "./featureCoverage";

function row(overrides: Record<string, unknown> = {}): NhlShotFeatureRow {
  return {
    gameId: 1,
    eventId: 1,
    shotDistanceFeet: 20,
    isReboundShot: false,
    shotType: "wrist",
    ...overrides,
  } as unknown as NhlShotFeatureRow;
}

describe("featureCoverage", () => {
  it("profiles selected feature null coverage and categorical levels", () => {
    const profile = buildXgFeatureCoverageProfile({
      rows: [
        row({ shotDistanceFeet: 12, shotType: "wrist" }),
        row({ shotDistanceFeet: null, shotType: "snap" }),
      ],
      selectedFeatures: {
        numeric: ["shotDistanceFeet"],
        boolean: ["isReboundShot"],
        categorical: ["shotType"],
      },
    });

    expect(profile.features.shotDistanceFeet).toMatchObject({
      rowCount: 2,
      nullCount: 1,
      populatedCount: 1,
      nullRate: 0.5,
    });
    expect(profile.features.shotType.categoricalLevels).toEqual(["snap", "wrist"]);
    expect(profile.blockingReasons).toEqual([]);
  });

  it("blocks selected features that are absent or entirely unpopulated", () => {
    const profile = buildXgFeatureCoverageProfile({
      rows: [row({ shotDistanceFeet: null }), row({ shotDistanceFeet: null })],
      selectedFeatures: {
        numeric: ["shotDistanceFeet", "missingFeature"],
        boolean: [],
        categorical: [],
      },
    });

    expect(profile.blockingReasons).toContain(
      'Selected numeric feature "shotDistanceFeet" is entirely unpopulated in the training rows.'
    );
    expect(profile.blockingReasons).toContain(
      'Selected numeric feature "missingFeature" is absent from 2/2 training rows.'
    );
  });

  it("detects scoring null-rate and categorical unknown drift after the minimum sample", () => {
    const selectedFeatures = {
      numeric: ["shotDistanceFeet"],
      boolean: [],
      categorical: ["shotType"],
    };
    const trainingProfile = buildXgFeatureCoverageProfile({
      rows: [
        row({ shotDistanceFeet: 12, shotType: "wrist" }),
        row({ shotDistanceFeet: 18, shotType: "snap" }),
      ],
      selectedFeatures,
      policy: {
        minScoringRowsForDriftCheck: 2,
        maxAllowedNullRateDrift: 0.25,
        maxAllowedCategoricalUnknownRate: 0.1,
      },
    });

    const issues = auditScoringRowsAgainstFeatureCoverage({
      rows: [
        row({ shotDistanceFeet: null, shotType: "backhand" }),
        row({ shotDistanceFeet: null, shotType: "backhand" }),
      ],
      selectedFeatures,
      trainingProfile,
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "feature_null_rate_drift" }),
        expect.objectContaining({ code: "categorical_unknown_rate" }),
      ])
    );
  });
});
