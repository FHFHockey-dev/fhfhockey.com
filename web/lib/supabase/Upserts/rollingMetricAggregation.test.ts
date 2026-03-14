import { describe, expect, it } from "vitest";
import {
  createHistoricalRatioAccumulator,
  createRatioRollingAccumulator,
  getHistoricalRatioComponentSnapshot,
  getRatioRollingWindowModeForFamily,
  getRatioRollingComponentSnapshot,
  getHistoricalRatioSnapshot,
  normalizeRatioWindowEntry,
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

  it("exposes rolling and historical raw ratio component totals for support-field writers", () => {
    const rolling = createRatioRollingAccumulator([3, 5]);
    updateRatioRollingAccumulator(
      rolling,
      { numerator: 2, denominator: 10, secondaryNumerator: 9, secondaryDenominator: 10 },
      { windowFamily: "ratio_performance", windows: [3, 5], anchor: true }
    );
    updateRatioRollingAccumulator(
      rolling,
      { numerator: 1, denominator: 5, secondaryNumerator: 18, secondaryDenominator: 20 },
      { windowFamily: "ratio_performance", windows: [3, 5], anchor: true }
    );

    expect(getRatioRollingComponentSnapshot(rolling, [3, 5])).toEqual({
      all: {
        numerator: 3,
        denominator: 15,
        secondaryNumerator: 27,
        secondaryDenominator: 30,
        count: 2
      },
      windows: {
        3: {
          numerator: 3,
          denominator: 15,
          secondaryNumerator: 27,
          secondaryDenominator: 30,
          count: 2
        },
        5: {
          numerator: 3,
          denominator: 15,
          secondaryNumerator: 27,
          secondaryDenominator: 30,
          count: 2
        }
      }
    });

    const historical = createHistoricalRatioAccumulator();
    updateHistoricalRatioAccumulator(historical, 20232024, {
      numerator: 4,
      denominator: 10
    });
    updateHistoricalRatioAccumulator(historical, 20242025, {
      numerator: 3,
      denominator: 6
    });
    updateHistoricalRatioAccumulator(historical, 20252026, {
      numerator: 2,
      denominator: 4
    });

    expect(getHistoricalRatioComponentSnapshot(historical, 20252026)).toEqual({
      season: {
        numerator: 2,
        denominator: 4,
        secondaryNumerator: 0,
        secondaryDenominator: 0,
        count: 1
      },
      threeYear: {
        numerator: 9,
        denominator: 20,
        secondaryNumerator: 0,
        secondaryDenominator: 0,
        count: 3
      },
      career: {
        numerator: 9,
        denominator: 20,
        secondaryNumerator: 0,
        secondaryDenominator: 0,
        count: 3
      }
    });
  });

  it("returns zero for zero-denominator ratio metrics when configured to do so", () => {
    const acc = createRatioRollingAccumulator();
    const spec: RatioAggregationSpec = {
      scale: 100,
      noPrimaryDenominatorBehavior: "zero"
    };

    updateRatioRollingAccumulator(acc, { numerator: 0, denominator: 0 });

    const snapshot = getRatioRollingSnapshot(acc, spec);

    expect(snapshot.all).toBe(0);
    expect(snapshot.windows[3]).toBe(0);
  });

  it("anchors rolling ratio windows to fixed appearances when configured", () => {
    const acc = createRatioRollingAccumulator();
    const spec: RatioAggregationSpec = { scale: 100 };

    updateRatioRollingAccumulator(
      acc,
      { numerator: 1, denominator: 10 },
      { windowFamily: "ratio_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      acc,
      { numerator: 2, denominator: 10 },
      { windowFamily: "ratio_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      acc,
      { numerator: 0, denominator: 0 },
      { windowFamily: "ratio_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      acc,
      { numerator: 1, denominator: 5 },
      { windowFamily: "ratio_performance", anchor: true }
    );

    const snapshot = getRatioRollingSnapshot(acc, spec);

    expect(snapshot.windows[3]).toBeCloseTo(20, 6);
    expect(snapshot.all).toBeCloseTo(16, 6);
  });

  it("does not advance appearance-based ratio windows when the player did not appear", () => {
    const acc = createRatioRollingAccumulator();
    const spec: RatioAggregationSpec = { scale: 100 };

    updateRatioRollingAccumulator(
      acc,
      { numerator: 1, denominator: 10 },
      { windowFamily: "ratio_performance", anchor: true }
    );
    updateRatioRollingAccumulator(
      acc,
      { numerator: 4, denominator: 10 },
      { windowFamily: "ratio_performance", anchor: false }
    );
    updateRatioRollingAccumulator(
      acc,
      { numerator: 2, denominator: 10 },
      { windowFamily: "ratio_performance", anchor: true }
    );

    const snapshot = getRatioRollingSnapshot(acc, spec);

    expect(snapshot.windows[3]).toBeCloseTo(15, 6);
    expect(snapshot.all).toBeCloseTo(15, 6);
  });

  it("derives ratio window mode from the canonical metric family contract", () => {
    expect(getRatioRollingWindowModeForFamily("ratio_performance")).toBe(
      "appearance"
    );
    expect(getRatioRollingWindowModeForFamily("weighted_rate_performance")).toBe(
      "appearance"
    );
    expect(getRatioRollingWindowModeForFamily("additive_performance")).toBe(
      "valid_observation"
    );
    expect(getRatioRollingWindowModeForFamily("availability")).toBe(
      "valid_observation"
    );
  });

  it("preserves ratio-of-aggregates arithmetic for bounded ratios inside fixed appearance windows", () => {
    const acc = createRatioRollingAccumulator([3]);
    const spec: RatioAggregationSpec = {
      scale: 100,
      noPrimaryDenominatorBehavior: "zero"
    };

    updateRatioRollingAccumulator(
      acc,
      { numerator: 1, denominator: 2 },
      { windowFamily: "ratio_performance", windows: [3], anchor: true }
    );
    updateRatioRollingAccumulator(
      acc,
      { numerator: 4, denominator: 10 },
      { windowFamily: "ratio_performance", windows: [3], anchor: true }
    );
    updateRatioRollingAccumulator(
      acc,
      { numerator: null, denominator: null },
      { windowFamily: "ratio_performance", windows: [3], anchor: true }
    );
    updateRatioRollingAccumulator(
      acc,
      { numerator: 3, denominator: 12 },
      { windowFamily: "ratio_performance", windows: [3], anchor: true }
    );

    const snapshot = getRatioRollingSnapshot(acc, spec, [3]);

    expect(snapshot.windows[3]).toBeCloseTo(31.818182, 6);
  });

  it("preserves composite ratio-of-aggregates arithmetic for metrics such as PDO", () => {
    const acc = createRatioRollingAccumulator([3]);
    const spec: RatioAggregationSpec = {
      scale: 100,
      combine: "sum",
      outputScale: 0.01
    };

    updateRatioRollingAccumulator(
      acc,
      {
        numerator: 1,
        denominator: 10,
        secondaryNumerator: 18,
        secondaryDenominator: 20
      },
      { windowFamily: "ratio_performance", windows: [3], anchor: true }
    );
    updateRatioRollingAccumulator(
      acc,
      {
        numerator: 5,
        denominator: 10,
        secondaryNumerator: 9,
        secondaryDenominator: 10
      },
      { windowFamily: "ratio_performance", windows: [3], anchor: true }
    );
    updateRatioRollingAccumulator(
      acc,
      {
        numerator: null,
        denominator: null,
        secondaryNumerator: null,
        secondaryDenominator: null
      },
      { windowFamily: "ratio_performance", windows: [3], anchor: true }
    );
    updateRatioRollingAccumulator(
      acc,
      {
        numerator: 1,
        denominator: 20,
        secondaryNumerator: 8,
        secondaryDenominator: 10
      },
      { windowFamily: "ratio_performance", windows: [3], anchor: true }
    );

    const snapshot = getRatioRollingSnapshot(acc, spec, [3]);

    expect(snapshot.windows[3]).toBeCloseTo(1.05, 6);
  });

  it("preserves weighted /60 arithmetic across fixed appearance windows", () => {
    const acc = createRatioRollingAccumulator([3]);
    const spec: RatioAggregationSpec = { scale: 3600 };

    updateRatioRollingAccumulator(
      acc,
      { numerator: 4, denominator: 1200 },
      { windowFamily: "weighted_rate_performance", windows: [3], anchor: true }
    );
    updateRatioRollingAccumulator(
      acc,
      { numerator: 6, denominator: 1800 },
      { windowFamily: "weighted_rate_performance", windows: [3], anchor: true }
    );
    updateRatioRollingAccumulator(
      acc,
      { numerator: null, denominator: null },
      { windowFamily: "weighted_rate_performance", windows: [3], anchor: true }
    );
    updateRatioRollingAccumulator(
      acc,
      { numerator: 2, denominator: 600 },
      { windowFamily: "weighted_rate_performance", windows: [3], anchor: true }
    );

    const snapshot = getRatioRollingSnapshot(acc, spec, [3]);

    expect(snapshot.windows[3]).toBeCloseTo(12, 6);
  });

  it("does not let non-appearance rows advance weighted /60 windows", () => {
    const acc = createRatioRollingAccumulator([3]);
    const spec: RatioAggregationSpec = { scale: 3600 };

    updateRatioRollingAccumulator(
      acc,
      { numerator: 4, denominator: 1200 },
      { windowFamily: "weighted_rate_performance", windows: [3], anchor: true }
    );
    updateRatioRollingAccumulator(
      acc,
      { numerator: 8, denominator: 1200 },
      { windowFamily: "weighted_rate_performance", windows: [3], anchor: false }
    );
    updateRatioRollingAccumulator(
      acc,
      { numerator: 2, denominator: 600 },
      { windowFamily: "weighted_rate_performance", windows: [3], anchor: true }
    );

    const snapshot = getRatioRollingSnapshot(acc, spec, [3]);

    expect(snapshot.windows[3]).toBeCloseTo(12, 6);
    expect(snapshot.all).toBeCloseTo(12, 6);
  });

  it("coerces missing numerators to zero when a selected appearance has a denominator", () => {
    expect(
      normalizeRatioWindowEntry(
        { numerator: null, denominator: 5 },
        "ratio_performance"
      )
    ).toEqual({
      occupiesSelectedSlot: true,
      aggregatedComponents: {
        numerator: 0,
        denominator: 5,
        secondaryNumerator: 0,
        secondaryDenominator: 0
      }
    });
  });

  it("keeps the selected appearance slot but excludes aggregated components when denominators are missing", () => {
    expect(
      normalizeRatioWindowEntry(
        { numerator: 2, denominator: null },
        "weighted_rate_performance"
      )
    ).toEqual({
      occupiesSelectedSlot: true,
      aggregatedComponents: null
    });
  });

  it("distinguishes explicit zero versus null no-denominator product rules", () => {
    const zeroSpec: RatioAggregationSpec = {
      scale: 100,
      noPrimaryDenominatorBehavior: "zero"
    };
    const nullSpec: RatioAggregationSpec = {
      scale: 100,
      noPrimaryDenominatorBehavior: "null"
    };
    const acc = createRatioRollingAccumulator();

    updateRatioRollingAccumulator(acc, { numerator: 0, denominator: 0 });

    expect(getRatioRollingSnapshot(acc, zeroSpec).all).toBe(0);
    expect(getRatioRollingSnapshot(acc, nullSpec).all).toBeNull();
  });
});
