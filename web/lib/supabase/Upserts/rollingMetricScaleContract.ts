export type RollingMetricValueScale =
  | "fraction_0_to_1"
  | "percent_0_to_100"
  | "index_0_to_2";

export type RollingMetricScaleContract = {
  scale: RollingMetricValueScale;
  min: number;
  max: number;
};

export type ScaledMetricFamily =
  | "gp_pct"
  | "availability_pct"
  | "shooting_pct"
  | "primary_points_pct"
  | "expected_sh_pct"
  | "ipp"
  | "oz_start_pct"
  | "pp_share_pct"
  | "on_ice_sh_pct"
  | "on_ice_sv_pct"
  | "pdo"
  | "cf_pct"
  | "ff_pct";

export const ROLLING_METRIC_SCALE_CONTRACTS: Record<
  ScaledMetricFamily,
  RollingMetricScaleContract
> = {
  gp_pct: { scale: "fraction_0_to_1", min: 0, max: 1 },
  availability_pct: { scale: "fraction_0_to_1", min: 0, max: 1 },
  shooting_pct: { scale: "percent_0_to_100", min: 0, max: 100 },
  primary_points_pct: { scale: "fraction_0_to_1", min: 0, max: 1 },
  expected_sh_pct: { scale: "fraction_0_to_1", min: 0, max: 1 },
  ipp: { scale: "percent_0_to_100", min: 0, max: 100 },
  oz_start_pct: { scale: "percent_0_to_100", min: 0, max: 100 },
  pp_share_pct: { scale: "fraction_0_to_1", min: 0, max: 1 },
  on_ice_sh_pct: { scale: "percent_0_to_100", min: 0, max: 100 },
  on_ice_sv_pct: { scale: "percent_0_to_100", min: 0, max: 100 },
  pdo: { scale: "index_0_to_2", min: 0, max: 2 },
  cf_pct: { scale: "percent_0_to_100", min: 0, max: 100 },
  ff_pct: { scale: "percent_0_to_100", min: 0, max: 100 }
};
