import { describe, expect, it } from "vitest";

import type { SustainabilityTrendBandRow } from "../types/run-forge-projections.types";
import {
  compareTrendBandRowsForSelection,
  computeSkaterTrendAdjustment,
  computeTrendAdjustmentRecencyWeight
} from "./trend-adjustments";

function buildTrendBandRow(
  overrides: Partial<SustainabilityTrendBandRow>
): SustainabilityTrendBandRow {
  return {
    player_id: 8471214,
    snapshot_date: "2026-03-28",
    metric_key: "fantasy_score",
    window_code: "l5",
    value: 1.35,
    ci_lower: 0.8,
    ci_upper: 1.05,
    n_eff: 6,
    ...overrides
  };
}

describe("trend adjustment row selection", () => {
  it("prefers fresher evidence over older higher-priority metrics", () => {
    const olderHighPriority = buildTrendBandRow({
      snapshot_date: "2026-03-18",
      metric_key: "fantasy_score",
      window_code: "l5"
    });
    const fresherLowerPriority = buildTrendBandRow({
      snapshot_date: "2026-03-27",
      metric_key: "shots_per_60",
      window_code: "l10"
    });

    const sorted = [olderHighPriority, fresherLowerPriority].sort((a, b) =>
      compareTrendBandRowsForSelection(a, b, "2026-03-28")
    );

    expect(sorted[0]).toBe(fresherLowerPriority);
  });
});

describe("trend adjustment recency decay", () => {
  it("decays very old signals fully back to neutral", () => {
    const adjustment = computeSkaterTrendAdjustment({
      row: buildTrendBandRow({
        snapshot_date: "2026-03-01",
        value: 1.5,
        ci_lower: 0.85,
        ci_upper: 1.05,
        n_eff: 8
      }),
      asOfDate: "2026-03-28"
    });

    expect(adjustment).not.toBeNull();
    expect(adjustment?.effectState).toBe("neutralized_by_recency");
    expect(adjustment?.recencyClass).toBe("hard_stale");
    expect(adjustment?.ageDays).toBe(27);
    expect(adjustment?.confidence).toBe(0);
    expect(adjustment?.signedDistance).toBe(0);
    expect(adjustment?.goalRateMultiplier).toBe(1);
    expect(adjustment?.assistRateMultiplier).toBe(1);
  });

  it("keeps recent signals active with non-neutral confidence", () => {
    const adjustment = computeSkaterTrendAdjustment({
      row: buildTrendBandRow({
        snapshot_date: "2026-03-26",
        value: 1.5,
        ci_lower: 0.85,
        ci_upper: 1.05,
        n_eff: 8
      }),
      asOfDate: "2026-03-28"
    });

    expect(adjustment).not.toBeNull();
    expect(adjustment?.effectState).toBe("applied");
    expect(adjustment?.recencyClass).toBe("fresh");
    expect(adjustment?.ageDays).toBe(2);
    expect(adjustment?.confidence).toBeGreaterThan(0.8);
    expect(adjustment?.signedDistance).not.toBe(0);
    expect(adjustment?.goalRateMultiplier).toBeGreaterThan(1);
  });

  it("keeps in-band signals neutral without labeling them as recency-neutralized", () => {
    const adjustment = computeSkaterTrendAdjustment({
      row: buildTrendBandRow({
        snapshot_date: "2026-03-27",
        value: 0.97,
        ci_lower: 0.9,
        ci_upper: 1.05,
        n_eff: 8
      }),
      asOfDate: "2026-03-28"
    });

    expect(adjustment).not.toBeNull();
    expect(adjustment?.effectState).toBe("within_band_neutral");
    expect(adjustment?.confidence).toBeGreaterThan(0);
    expect(adjustment?.signedDistance).toBe(0);
    expect(adjustment?.goalRateMultiplier).toBe(1);
  });

  it("drops recency weight to zero once the signal is older than 21 days", () => {
    expect(computeTrendAdjustmentRecencyWeight(21)).toBe(0);
    expect(computeTrendAdjustmentRecencyWeight(28)).toBe(0);
  });
});
