import { describe, expect, it } from "vitest";
import { computeGoalieRestSplitSavePctAdjustment, toGoalieRestSplitBucket } from "./goalie-save-pct-context";

const profile = {
  sourceDate: "2025-11-01",
  savePctByBucket: { "0": 0.89, "1": 0.9, "2": 0.9, "3": 0.9, "4_plus": 0.93 },
  gamesByBucket: { "0": 10, "1": 10, "2": 10, "3": 10, "4_plus": 20 }
};

describe("rest-split save % with unknown rest (W3-4 N1)", () => {
  it("gives unknown rest no bucket and no adjustment", () => {
    expect(toGoalieRestSplitBucket(null)).toBeNull();
    // Before the fix null rest read as "4_plus" and earned that bucket's long-rest bonus.
    expect(computeGoalieRestSplitSavePctAdjustment({ profile, daysSinceLastStart: null })).toBe(0);
    expect(computeGoalieRestSplitSavePctAdjustment({ profile, daysSinceLastStart: 5 })).toBeGreaterThan(0);
  });
});
