import { describe, expect, it } from "vitest";

import {
  SUSTAINABILITY_FEATURE_DICTIONARY,
  getSustainabilityFeatureDictionaryEntry,
  type SustainabilityFeatureGroup,
} from "./featureDictionary";

describe("sustainability feature dictionary", () => {
  it("covers every canonical sustainability feature group", () => {
    const groups = new Set<SustainabilityFeatureGroup>(
      SUSTAINABILITY_FEATURE_DICTIONARY.map((entry) => entry.group),
    );

    expect(groups).toEqual(
      new Set<SustainabilityFeatureGroup>([
        "recent_rate",
        "baseline_rate",
        "z_score",
        "percentile",
        "usage_delta",
        "context_delta",
        "opponent_adjustment",
        "reliability",
        "sample_weight",
      ]),
    );
  });

  it("keeps required scoring features source-backed", () => {
    const requiredEntries = SUSTAINABILITY_FEATURE_DICTIONARY.filter(
      (entry) => entry.requiredForScore,
    );

    expect(requiredEntries.length).toBeGreaterThan(0);
    expect(
      requiredEntries.every((entry) => entry.primarySources.length > 0),
    ).toBe(true);
    expect(getSustainabilityFeatureDictionaryEntry("window_z_score")).toMatchObject({
      group: "z_score",
      unit: "z_score",
    });
  });
});
