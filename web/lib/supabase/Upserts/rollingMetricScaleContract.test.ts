import { describe, expect, it } from "vitest";

import { ROLLING_METRIC_SCALE_CONTRACTS } from "./rollingMetricScaleContract";

describe("rollingMetricScaleContract", () => {
  it("encodes explicit pct-family scale expectations", () => {
    expect(ROLLING_METRIC_SCALE_CONTRACTS.gp_pct).toEqual({
      scale: "fraction_0_to_1",
      min: 0,
      max: 1
    });
    expect(ROLLING_METRIC_SCALE_CONTRACTS.availability_pct).toEqual({
      scale: "fraction_0_to_1",
      min: 0,
      max: 1
    });
    expect(ROLLING_METRIC_SCALE_CONTRACTS.shooting_pct).toEqual({
      scale: "percent_0_to_100",
      min: 0,
      max: 100
    });
    expect(ROLLING_METRIC_SCALE_CONTRACTS.primary_points_pct).toEqual({
      scale: "fraction_0_to_1",
      min: 0,
      max: 1
    });
    expect(ROLLING_METRIC_SCALE_CONTRACTS.expected_sh_pct).toEqual({
      scale: "fraction_0_to_1",
      min: 0,
      max: 1
    });
    expect(ROLLING_METRIC_SCALE_CONTRACTS.ipp).toEqual({
      scale: "percent_0_to_100",
      min: 0,
      max: 100
    });
    expect(ROLLING_METRIC_SCALE_CONTRACTS.oz_start_pct).toEqual({
      scale: "percent_0_to_100",
      min: 0,
      max: 100
    });
    expect(ROLLING_METRIC_SCALE_CONTRACTS.pp_share_pct).toEqual({
      scale: "fraction_0_to_1",
      min: 0,
      max: 1
    });
    expect(ROLLING_METRIC_SCALE_CONTRACTS.on_ice_sh_pct).toEqual({
      scale: "percent_0_to_100",
      min: 0,
      max: 100
    });
    expect(ROLLING_METRIC_SCALE_CONTRACTS.cf_pct).toEqual({
      scale: "percent_0_to_100",
      min: 0,
      max: 100
    });
    expect(ROLLING_METRIC_SCALE_CONTRACTS.ff_pct).toEqual({
      scale: "percent_0_to_100",
      min: 0,
      max: 100
    });
    expect(ROLLING_METRIC_SCALE_CONTRACTS.pdo).toEqual({
      scale: "index_0_to_2",
      min: 0,
      max: 2
    });
  });
});
