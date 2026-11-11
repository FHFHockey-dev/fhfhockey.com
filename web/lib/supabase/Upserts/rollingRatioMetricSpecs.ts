import type { RatioAggregationSpec } from "./rollingMetricAggregation";

/**
 * Ratio specs for every rolling ratio metric, shared by the writer
 * (`fetchRollingPlayerAverages.ts`) and readers that pool stored components
 * (the player trend page's calendar windows). Client-safe: no server imports.
 *
 * - `expected_sh_pct` is ixG ÷ unblocked attempts (Fenwick, NST `iff`) on a
 *   0–100 scale (owner decision 17).
 * - A ratio with no denominator is undefined, so every spec returns null there
 *   (BA W1-3 D14); a known zero numerator over a known denominator stays 0.
 */
export const ROLLING_RATIO_METRIC_SPECS = {
  sog_per_60: { scale: 3600, noPrimaryDenominatorBehavior: "null" },
  ixg_per_60: { scale: 3600, noPrimaryDenominatorBehavior: "null" },
  shot_attempts_per_60: { scale: 3600, noPrimaryDenominatorBehavior: "null" },
  goals_per_60: { scale: 3600, noPrimaryDenominatorBehavior: "null" },
  assists_per_60: { scale: 3600, noPrimaryDenominatorBehavior: "null" },
  penalties_drawn_per_60: { scale: 3600, noPrimaryDenominatorBehavior: "null" },
  penalties_taken_per_60: { scale: 3600, noPrimaryDenominatorBehavior: "null" },
  primary_assists_per_60: { scale: 3600, noPrimaryDenominatorBehavior: "null" },
  secondary_assists_per_60: {
    scale: 3600,
    noPrimaryDenominatorBehavior: "null"
  },
  shooting_pct: { scale: 100, noPrimaryDenominatorBehavior: "null" },
  primary_points_pct: { scale: 1, noPrimaryDenominatorBehavior: "null" },
  expected_sh_pct: { scale: 100, noPrimaryDenominatorBehavior: "null" },
  ipp: { scale: 100, noPrimaryDenominatorBehavior: "null" },
  hits_per_60: { scale: 3600, noPrimaryDenominatorBehavior: "null" },
  blocks_per_60: { scale: 3600, noPrimaryDenominatorBehavior: "null" },
  oz_start_pct: { scale: 100, noPrimaryDenominatorBehavior: "null" },
  pp_share_pct: { scale: 1, noPrimaryDenominatorBehavior: "null" },
  on_ice_sh_pct: { scale: 100, noPrimaryDenominatorBehavior: "null" },
  on_ice_sv_pct: { scale: 100, noPrimaryDenominatorBehavior: "null" },
  pdo: {
    scale: 100,
    combine: "sum",
    outputScale: 0.01,
    noPrimaryDenominatorBehavior: "null",
    noSecondaryDenominatorBehavior: "null"
  },
  cf_pct: { scale: 100, noPrimaryDenominatorBehavior: "null" },
  ff_pct: { scale: 100, noPrimaryDenominatorBehavior: "null" }
} as const satisfies Record<string, RatioAggregationSpec>;

export type RollingRatioMetricKey = keyof typeof ROLLING_RATIO_METRIC_SPECS;

export function isRollingRatioMetricKey(
  key: string
): key is RollingRatioMetricKey {
  return Object.prototype.hasOwnProperty.call(ROLLING_RATIO_METRIC_SPECS, key);
}
