import { describe, expect, it } from "vitest";
import {
  resolvePer60Components,
  resolveShareComponents
} from "./rollingPlayerMetricMath";
import {
  createRatioRollingAccumulator,
  getRatioRollingSnapshot,
  updateRatioRollingAccumulator
} from "./rollingMetricAggregation";

describe("resolvePer60Components", () => {
  it("uses raw totals over TOI when available", () => {
    expect(
      resolvePer60Components({
        rawValue: 4,
        toiSeconds: 1200,
        per60Rate: 30
      })
    ).toEqual({
      numerator: 4,
      denominator: 1200
    });
  });

  it("reconstructs implied totals from per-60 rate and TOI when raw totals are missing", () => {
    expect(
      resolvePer60Components({
        rawValue: null,
        toiSeconds: 900,
        per60Rate: 12
      })
    ).toEqual({
      numerator: 3,
      denominator: 900
    });
  });

  it("supports weighted horizon aggregation instead of averaging per-game rates", () => {
    const acc = createRatioRollingAccumulator();

    updateRatioRollingAccumulator(
      acc,
      resolvePer60Components({
        rawValue: null,
        toiSeconds: 600,
        per60Rate: 24
      })
    );
    updateRatioRollingAccumulator(
      acc,
      resolvePer60Components({
        rawValue: 4,
        toiSeconds: 1800
      })
    );

    const snapshot = getRatioRollingSnapshot(acc, { scale: 3600 });

    expect(snapshot.all).toBeCloseTo(12, 6);
  });

  it("returns null when TOI is unavailable or invalid", () => {
    expect(
      resolvePer60Components({
        rawValue: 2,
        toiSeconds: null
      })
    ).toBe(null);
    expect(
      resolvePer60Components({
        rawValue: null,
        toiSeconds: 0,
        per60Rate: 10
      })
    ).toBe(null);
  });

  it("reconstructs total-share denominators from numerator and share inputs", () => {
    expect(
      resolveShareComponents({
        numeratorValue: 180,
        share: 0.6
      })
    ).toEqual({
      numerator: 180,
      denominator: 300
    });
  });
});
