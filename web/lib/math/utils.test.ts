import { describe, expect, it } from "vitest";

import {
  clip,
  decayBlend,
  ewsd,
  goalieFinishMult,
  shrinkage,
  slope,
} from "./utils";

describe("projection math utilities", () => {
  it("computes decay weights and effective sample size", () => {
    const result = decayBlend(
      [
        { value: 2, daysAgo: 0 },
        { value: 4, daysAgo: 10 },
      ],
      10,
    );
    const oldWeight = Math.exp(-1);

    expect(result.mean).toBeCloseTo((2 + 4 * oldWeight) / (1 + oldWeight));
    expect(result.totalWeight).toBeCloseTo(1 + oldWeight);
    expect(result.effectiveSampleSize).toBeCloseTo(
      (1 + oldWeight) ** 2 / (1 + oldWeight ** 2),
    );
    expect(result.sampleCount).toBe(2);
  });

  it("ignores unusable observations and returns an empty blend", () => {
    expect(
      decayBlend(
        [
          { value: null, daysAgo: 0 },
          { value: Number.NaN, daysAgo: 0 },
          { value: 3, daysAgo: 0, weight: 0 },
        ],
        30,
      ),
    ).toEqual({
      mean: null,
      totalWeight: 0,
      effectiveSampleSize: 0,
      sampleCount: 0,
    });
  });

  it("computes exponentially weighted dispersion", () => {
    expect(
      ewsd(
        [
          { value: 1, daysAgo: 0 },
          { value: 3, daysAgo: 0 },
        ],
        30,
      ),
    ).toBeCloseTo(1);
    expect(ewsd([], 30)).toBeNull();
  });

  it("computes slope without collapsing missing observation indexes", () => {
    expect(slope([1, 3, 5])).toBeCloseTo(2);
    expect(slope([1, null, 5])).toBeCloseTo(2);
    expect(slope([null, 2])).toBeNull();
  });

  it("shrinks recent estimates toward the prior", () => {
    expect(shrinkage(10, 4, 3, 1)).toBeCloseTo(8.5);
    expect(shrinkage(null, 4, 3, 1)).toBe(4);
    expect(shrinkage(10, null, 3, 1)).toBe(10);
    expect(shrinkage(null, null, 3, 1)).toBeNull();
  });

  it("clips ordered or reversed bounds and handles invalid inputs", () => {
    expect(clip(4, 0, 3)).toBe(3);
    expect(clip(-1, 3, 0)).toBe(0);
    expect(clip(Number.NaN, 2, 4)).toBe(2);
  });

  it("bounds the goalie finishing multiplier", () => {
    expect(goalieFinishMult(0.9, 0.9)).toBe(1);
    expect(goalieFinishMult(0.92, 0.9)).toBe(0.8);
    expect(goalieFinishMult(0.88, 0.9)).toBe(1.2);
    expect(goalieFinishMult(null, 0.9)).toBe(1);
  });
});
