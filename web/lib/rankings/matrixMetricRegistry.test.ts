import { describe, expect, it } from "vitest";

import {
  MATRIX_METRIC_GROUPS,
  getDefaultMatrixMetricColumns,
  getMatrixMetricColumn,
  getMatrixMetricColumns,
} from "./matrixMetricRegistry";

describe("matrixMetricRegistry", () => {
  it("groups verified live matrix metrics and excludes planned metrics from defaults", () => {
    const columns = getDefaultMatrixMetricColumns({ strength: "5v5" });
    const keys = columns.map((column) => column.metricKey);

    expect(MATRIX_METRIC_GROUPS.map((group) => group.key)).toContain("offense");
    expect(keys).toContain("goals_per_60");
    expect(keys).toContain("points_per_60");
    expect(keys).toContain("xga_per_60");
    expect(keys).toContain("on_ice_xgf_percentage");
    expect(keys).toContain("penalties_taken_per_60");
    expect(keys).toContain("mcm_score");
    expect(keys).toContain("beast_tier");
    expect(keys).not.toContain("results_luck_index");
  });

  it("filters default columns by strength applicability", () => {
    const allStrengthKeys = getDefaultMatrixMetricColumns({ strength: "all" }).map(
      (column) => column.metricKey,
    );

    expect(allStrengthKeys).toContain("goals_per_60");
    expect(allStrengthKeys).toContain("expected_shooting_percentage");
    expect(allStrengthKeys).not.toContain("xga_per_60");
    expect(allStrengthKeys).not.toContain("on_ice_xgf_percentage");
  });

  it("publishes lower-is-better metadata for defensive suppression metrics", () => {
    const xga = getMatrixMetricColumn("xga_per_60");
    const goals = getMatrixMetricColumn("goals_per_60");

    expect(xga?.lowerIsBetter).toBe(true);
    expect(xga?.sourceQualityFlags).toContain(
      "context_influenced_unadjusted_on_ice",
    );
    expect(goals?.lowerIsBetter).toBe(false);
    expect(getMatrixMetricColumns().length).toBeGreaterThan(10);
  });

  it("keeps Results Luck live but not default-visible with selected-window exclusion copy", () => {
    const luck = getMatrixMetricColumn("results_luck_index");

    expect(luck?.availabilityState).toBe("available");
    expect(luck?.defaultVisible).toBe(false);
    expect(luck?.tooltip).toContain("above 100");
    expect(luck?.tooltip).toContain("selected-window-excluded baseline");
    expect(luck?.definition?.sourceTable).toBe("skater_composite_ratings");
  });
});
