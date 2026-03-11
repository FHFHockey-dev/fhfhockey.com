import { describe, expect, it } from "vitest";

import {
  createRatioRollingAccumulator,
  getRatioRollingSnapshot,
  updateRatioRollingAccumulator,
  type RatioAggregationSpec,
  type RatioComponents
} from "./rollingMetricAggregation";

type RatioMetricCase = {
  metricKey:
    | "shooting_pct"
    | "primary_points_pct"
    | "expected_sh_pct"
    | "ipp"
    | "on_ice_sh_pct"
    | "pdo"
    | "cf_pct"
    | "ff_pct";
  spec: RatioAggregationSpec;
  updates: Array<RatioComponents | null>;
  expectedWindowValue: number | null;
};

type WeightedRateMetricCase = {
  metricKey: "sog_per_60" | "ixg_per_60" | "hits_per_60" | "blocks_per_60";
  spec: RatioAggregationSpec;
  updates: Array<RatioComponents | null>;
  expectedWindowValue: number | null;
};

function buildWindowSnapshot(
  updates: Array<RatioComponents | null>,
  spec: RatioAggregationSpec,
  windowFamily: "ratio_performance" | "weighted_rate_performance"
): number | null {
  const acc = createRatioRollingAccumulator([3]);

  updates.forEach((components) => {
    updateRatioRollingAccumulator(acc, components, {
      windowFamily,
      windows: [3],
      anchor: true
    });
  });

  return getRatioRollingSnapshot(acc, spec, [3]).windows[3];
}

describe("rolling metric contract cases", () => {
  const ratioCases: RatioMetricCase[] = [
    {
      metricKey: "shooting_pct",
      spec: { scale: 100, noPrimaryDenominatorBehavior: "zero" },
      updates: [
        { numerator: 1, denominator: 2 },
        { numerator: 2, denominator: 5 },
        null,
        { numerator: 1, denominator: 5 }
      ],
      expectedWindowValue: 30
    },
    {
      metricKey: "primary_points_pct",
      spec: { scale: 1, noPrimaryDenominatorBehavior: "zero" },
      updates: [
        { numerator: 1, denominator: 2 },
        { numerator: 2, denominator: 5 },
        null,
        { numerator: 1, denominator: 5 }
      ],
      expectedWindowValue: 0.3
    },
    {
      metricKey: "expected_sh_pct",
      spec: { scale: 1, noPrimaryDenominatorBehavior: "null" },
      updates: [
        { numerator: 1, denominator: 2 },
        { numerator: 2, denominator: 5 },
        null,
        { numerator: 1, denominator: 5 }
      ],
      expectedWindowValue: 0.3
    },
    {
      metricKey: "ipp",
      spec: { scale: 100, noPrimaryDenominatorBehavior: "zero" },
      updates: [
        { numerator: 1, denominator: 2 },
        { numerator: 2, denominator: 5 },
        null,
        { numerator: 1, denominator: 5 }
      ],
      expectedWindowValue: 30
    },
    {
      metricKey: "on_ice_sh_pct",
      spec: { scale: 100, noPrimaryDenominatorBehavior: "null" },
      updates: [
        { numerator: 1, denominator: 2 },
        { numerator: 2, denominator: 5 },
        null,
        { numerator: 1, denominator: 5 }
      ],
      expectedWindowValue: 30
    },
    {
      metricKey: "pdo",
      spec: {
        scale: 100,
        combine: "sum",
        outputScale: 0.01,
        noPrimaryDenominatorBehavior: "null",
        noSecondaryDenominatorBehavior: "null"
      },
      updates: [
        {
          numerator: 1,
          denominator: 2,
          secondaryNumerator: 8,
          secondaryDenominator: 10
        },
        {
          numerator: 2,
          denominator: 5,
          secondaryNumerator: 4,
          secondaryDenominator: 5
        },
        null,
        {
          numerator: 1,
          denominator: 5,
          secondaryNumerator: 2,
          secondaryDenominator: 5
        }
      ],
      expectedWindowValue: 0.9
    },
    {
      metricKey: "cf_pct",
      spec: { scale: 100, noPrimaryDenominatorBehavior: "null" },
      updates: [
        { numerator: 1, denominator: 2 },
        { numerator: 2, denominator: 5 },
        null,
        { numerator: 1, denominator: 5 }
      ],
      expectedWindowValue: 30
    },
    {
      metricKey: "ff_pct",
      spec: { scale: 100, noPrimaryDenominatorBehavior: "null" },
      updates: [
        { numerator: 1, denominator: 2 },
        { numerator: 2, denominator: 5 },
        null,
        { numerator: 1, denominator: 5 }
      ],
      expectedWindowValue: 30
    }
  ];

  ratioCases.forEach(({ metricKey, spec, updates, expectedWindowValue }) => {
    it(`keeps ${metricKey} on the appearance-window ratio contract`, () => {
      expect(
        buildWindowSnapshot(updates, spec, "ratio_performance")
      ).toBeCloseTo(expectedWindowValue ?? 0, 6);
    });
  });

  const weightedRateCases: WeightedRateMetricCase[] = [
    {
      metricKey: "sog_per_60",
      spec: { scale: 3600, noPrimaryDenominatorBehavior: "null" },
      updates: [
        { numerator: 1, denominator: 300 },
        { numerator: 2, denominator: 600 },
        null,
        { numerator: 1, denominator: 300 }
      ],
      expectedWindowValue: 12
    },
    {
      metricKey: "ixg_per_60",
      spec: { scale: 3600, noPrimaryDenominatorBehavior: "null" },
      updates: [
        { numerator: 1, denominator: 300 },
        { numerator: 2, denominator: 600 },
        null,
        { numerator: 1, denominator: 300 }
      ],
      expectedWindowValue: 12
    },
    {
      metricKey: "hits_per_60",
      spec: { scale: 3600, noPrimaryDenominatorBehavior: "null" },
      updates: [
        { numerator: 1, denominator: 300 },
        { numerator: 2, denominator: 600 },
        null,
        { numerator: 1, denominator: 300 }
      ],
      expectedWindowValue: 12
    },
    {
      metricKey: "blocks_per_60",
      spec: { scale: 3600, noPrimaryDenominatorBehavior: "null" },
      updates: [
        { numerator: 1, denominator: 300 },
        { numerator: 2, denominator: 600 },
        null,
        { numerator: 1, denominator: 300 }
      ],
      expectedWindowValue: 12
    }
  ];

  weightedRateCases.forEach(({ metricKey, spec, updates, expectedWindowValue }) => {
    it(`keeps ${metricKey} on the appearance-window weighted-rate contract`, () => {
      expect(
        buildWindowSnapshot(updates, spec, "weighted_rate_performance")
      ).toBeCloseTo(expectedWindowValue ?? 0, 6);
    });
  });
});
