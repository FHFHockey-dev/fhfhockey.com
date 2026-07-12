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
    expect(keys).toContain("offense_rating");
    expect(keys).toContain("defense_rating");
    expect(keys).toContain("mcm_score");
    expect(keys).toContain("beast_tier");
    expect(keys).not.toContain("results_luck_index");
    expect(keys).not.toContain("pp_points_per_60");
  });

  it("filters default columns by strength applicability", () => {
    const allStrengthKeys = getDefaultMatrixMetricColumns({ strength: "all" }).map(
      (column) => column.metricKey,
    );

    expect(allStrengthKeys).toContain("goals_per_60");
    expect(allStrengthKeys).toContain("expected_shooting_percentage");
    expect(allStrengthKeys).not.toContain("xga_per_60");
    expect(allStrengthKeys).not.toContain("on_ice_xgf_percentage");
    expect(allStrengthKeys).not.toContain("pp_points_per_60");
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
    expect(luck?.tooltip).toContain("Current 100-centered Results Luck Index");
    expect(luck?.tooltip).toContain("above 100");
    expect(luck?.tooltip).toContain("selected-window-excluded baseline");
    expect(luck?.definition?.sourceTable).toBe("skater_composite_ratings");
  });

  it("publishes offense and defensive impact as first-class composite columns", () => {
    const offense = getMatrixMetricColumn("offense_rating");
    const defense = getMatrixMetricColumn("defense_rating");

    expect(offense).toMatchObject({
      availabilityState: "available",
      defaultVisible: true,
      fullLabel: "Offense Rating",
    });
    expect(offense?.tooltip).toContain("contextual descriptive");
    expect(offense?.tooltip).toContain("not an adjusted isolated-impact metric");
    expect(offense?.definition?.sourceTable).toBe("skater_composite_ratings");
    expect(defense).toMatchObject({
      availabilityState: "available",
      defaultVisible: true,
      fullLabel: "Defensive Impact",
    });
    expect(defense?.sourceQualityFlags).toContain(
      "context_influenced_unadjusted_on_ice",
    );
    expect(defense?.tooltip).toContain("not isolated defensive talent");

    const mcm = getMatrixMetricColumn("mcm_score");
    const beast = getMatrixMetricColumn("beast_tier");
    expect(mcm?.tooltip).toContain("including live PP points");
    expect(beast?.tooltip).toContain("including live PP points");

    const ppPoints = getMatrixMetricColumn("pp_points_per_60");
    expect(ppPoints).toMatchObject({
      availabilityState: "available",
      defaultVisible: false,
      fullLabel: "PP Points/60",
    });
    expect(ppPoints?.definition?.applicableStrengthStates).toEqual(["pp"]);
  });

  it("keeps relative 5v5 metrics planned with explicit missing baseline requirements", () => {
    const relGf = getMatrixMetricColumn("rel_5v5_gf_percentage");
    const relXgf = getMatrixMetricColumn("rel_5v5_xgf_percentage");

    expect(relGf).toMatchObject({
      availabilityState: "planned",
      defaultVisible: false,
    });
    expect(relGf?.plannedReason).toContain("goals-for/goals-against");
    expect(relXgf).toMatchObject({
      availabilityState: "planned",
      defaultVisible: false,
    });
    expect(relXgf?.plannedReason).toContain("xGF/xGA");
  });
});
