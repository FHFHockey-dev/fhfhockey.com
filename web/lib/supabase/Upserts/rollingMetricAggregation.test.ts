import { describe, expect, it } from "vitest";
import {
  createHistoricalRatioAccumulator,
  createRatioRollingAccumulator,
  getHistoricalRatioSnapshot,
  getRatioRollingSnapshot,
  updateHistoricalRatioAccumulator,
  updateRatioRollingAccumulator,
  type RatioAggregationSpec
} from "./rollingMetricAggregation";

describe("rollingMetricAggregation", () => {
  it("aggregates ratio windows from summed numerators and denominators", () => {
    const acc = createRatioRollingAccumulator();
    const spec: RatioAggregationSpec = { scale: 100 };

    updateRatioRollingAccumulator(acc, { numerator: 1, denominator: 10 });
    updateRatioRollingAccumulator(acc, { numerator: 2, denominator: 20 });
    updateRatioRollingAccumulator(acc, { numerator: 0, denominator: 5 });

    const snapshot = getRatioRollingSnapshot(acc, spec);

    expect(snapshot.all).toBeCloseTo(8.571429, 6);
    expect(snapshot.windows[3]).toBeCloseTo(8.571429, 6);
    expect(snapshot.windows[5]).toBeCloseTo(8.571429, 6);
  });

  it("supports composite ratios such as PDO", () => {
    const acc = createRatioRollingAccumulator();
    const spec: RatioAggregationSpec = {
      scale: 100,
      combine: "sum",
      outputScale: 0.01
    };

    updateRatioRollingAccumulator(acc, {
      numerator: 1,
      denominator: 10,
      secondaryNumerator: 18,
      secondaryDenominator: 20
    });
    updateRatioRollingAccumulator(acc, {
      numerator: 2,
      denominator: 10,
      secondaryNumerator: 9,
      secondaryDenominator: 10
    });

    const snapshot = getRatioRollingSnapshot(acc, spec);

    expect(snapshot.all).toBeCloseTo(1.05, 6);
  });

  it("computes season, 3-year, and career ratio snapshots from aggregated components", () => {
    const acc = createHistoricalRatioAccumulator();
    const spec: RatioAggregationSpec = { scale: 100 };

    updateHistoricalRatioAccumulator(acc, 20232024, {
      numerator: 4,
      denominator: 10
    });
    updateHistoricalRatioAccumulator(acc, 20242025, {
      numerator: 3,
      denominator: 6
    });
    updateHistoricalRatioAccumulator(acc, 20252026, {
      numerator: 2,
      denominator: 4
    });

    expect(getHistoricalRatioSnapshot(acc, 20252026, spec)).toEqual({
      season: 50,
      threeYear: 45,
      career: 45
    });
  });

  it("returns zero for zero-denominator ratio metrics when configured to do so", () => {
    const acc = createRatioRollingAccumulator();
    const spec: RatioAggregationSpec = {
      scale: 100,
      zeroWhenNoDenominator: true
    };

    updateRatioRollingAccumulator(acc, { numerator: 0, denominator: 0 });

    const snapshot = getRatioRollingSnapshot(acc, spec);

    expect(snapshot.all).toBe(0);
    expect(snapshot.windows[3]).toBe(0);
  });
});
