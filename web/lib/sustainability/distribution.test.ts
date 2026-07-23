import { describe, expect, it } from "vitest";

import { buildSustainabilityDistributionSnapshot } from "./distribution";

describe("sustainability distribution snapshot", () => {
  it("returns deterministic summary statistics and interpolated percentiles", () => {
    expect(buildSustainabilityDistributionSnapshot([100, 0, 50, 75, 25]))
      .toEqual({
        count: 5,
        minimum: 0,
        maximum: 100,
        mean: 50,
        stdev: 35.3553,
        percentiles: {
          p10: 10,
          p25: 25,
          p50: 50,
          p75: 75,
          p90: 90
        }
      });
  });

  it("ignores non-finite values and returns null for an empty population", () => {
    expect(buildSustainabilityDistributionSnapshot([Number.NaN, 60]))
      .toMatchObject({ count: 1, mean: 60 });
    expect(buildSustainabilityDistributionSnapshot([])).toBeNull();
  });
});
