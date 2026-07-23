import { describe, expect, it } from "vitest";

import {
  buildSustainabilityExtremeMetadata,
  compareSustainabilityDistributionDrift,
  compareSustainabilityScoreSample,
  countExtremeSustainabilityRows
} from "./observability";

describe("sustainability observability", () => {
  it("flags only finite raw z-scores beyond the canonical threshold", () => {
    expect(buildSustainabilityExtremeMetadata({
      z_shp: 5,
      z_ipp: -5.01,
      z_oishp: Number.NaN,
      z_ppshp: 7
    })).toEqual({
      extremeFlag: true,
      extremeMetrics: ["z_ipp", "z_ppshp"],
      extremeThreshold: 5
    });
  });

  it("counts persisted component-level extreme flags", () => {
    expect(countExtremeSustainabilityRows([
      { components: { extremeFlag: true } },
      { components: { extremeFlag: false } },
      { components: null }
    ])).toBe(1);
  });

  it("alerts only when stored-vs-recomputed differences exceed tolerance", () => {
    const row = {
      player_id: 1,
      snapshot_date: "2026-03-21",
      window_code: "l10",
      s_raw: 1,
      s_100: 70
    };
    const result = compareSustainabilityScoreSample(
      [{ ...row, s_100: 70.02 }],
      [row]
    );
    expect(result).toMatchObject({ compared: 1, alert: true });
    expect(result.max_diff).toBeCloseTo(0.02);
  });

  it("compares current distribution mean and stdev with prior daily baselines", () => {
    expect(compareSustainabilityDistributionDrift(
      [80, 90],
      [[40, 50], [45, 55]]
    )).toMatchObject({ status: "alert", baseline: { days: 2 } });
    expect(compareSustainabilityDistributionDrift([50], [])).toMatchObject({
      status: "insufficient_baseline"
    });
  });
});
