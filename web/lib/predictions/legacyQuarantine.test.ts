import { describe, expect, it } from "vitest";

import {
  LEGACY_PREDICTION_ARTIFACTS,
  getLegacyPredictionArtifact
} from "./legacyQuarantine";

describe("legacy prediction artifact quarantine", () => {
  it("keeps sKO quarantined until it has real model evidence", () => {
    const sko = getLegacyPredictionArtifact("sko_predictions");

    expect(sko).toMatchObject({
      disposition: "quarantined"
    });
    expect(sko?.promotionRequirement).toMatch(/feature importances/);
    expect(LEGACY_PREDICTION_ARTIFACTS.every((artifact) => artifact.paths.length > 0)).toBe(
      true
    );
  });
});
