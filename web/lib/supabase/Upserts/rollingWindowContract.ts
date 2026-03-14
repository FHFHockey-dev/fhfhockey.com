export type RollingMetricWindowFamily =
  | "availability"
  | "additive_performance"
  | "ratio_performance"
  | "weighted_rate_performance";

export type RollingWindowSelectionUnit =
  | "current_team_chronological_team_games"
  | "chronological_appearances_in_strength_state";

export type RollingWindowAggregationMethod =
  | "availability_ratio_from_selected_team_games"
  | "sum_and_mean_over_selected_appearances"
  | "ratio_of_aggregated_components_over_selected_appearances"
  | "weighted_rate_from_aggregated_components_over_selected_appearances";

export type RollingWindowContract = {
  family: RollingMetricWindowFamily;
  selectionUnit: RollingWindowSelectionUnit;
  aggregationMethod: RollingWindowAggregationMethod;
  missingComponentPolicy: {
    selectedWindowSlotBehavior:
      | "selected_slot_always_counts"
      | "selected_slot_counts_only_with_defined_value";
    missingNumeratorBehavior:
      | "coerce_to_zero_when_denominator_present"
      | "not_applicable";
    missingDenominatorBehavior:
      | "exclude_components_but_keep_selected_slot"
      | "not_applicable";
  };
  contractSummary: string;
};

export const CANONICAL_ROLLING_WINDOW_CONTRACTS: Record<
  RollingMetricWindowFamily,
  RollingWindowContract
> = {
  availability: {
    family: "availability",
    selectionUnit: "current_team_chronological_team_games",
    aggregationMethod: "availability_ratio_from_selected_team_games",
    missingComponentPolicy: {
      selectedWindowSlotBehavior: "selected_slot_always_counts",
      missingNumeratorBehavior: "not_applicable",
      missingDenominatorBehavior: "not_applicable"
    },
    contractSummary: "Last N means the current team's last N chronological team games."
  },
  additive_performance: {
    family: "additive_performance",
    selectionUnit: "chronological_appearances_in_strength_state",
    aggregationMethod: "sum_and_mean_over_selected_appearances",
    missingComponentPolicy: {
      selectedWindowSlotBehavior: "selected_slot_counts_only_with_defined_value",
      missingNumeratorBehavior: "not_applicable",
      missingDenominatorBehavior: "not_applicable"
    },
    contractSummary:
      "Last N means the player's last N chronological appearances in the relevant strength state."
  },
  ratio_performance: {
    family: "ratio_performance",
    selectionUnit: "chronological_appearances_in_strength_state",
    aggregationMethod: "ratio_of_aggregated_components_over_selected_appearances",
    missingComponentPolicy: {
      selectedWindowSlotBehavior: "selected_slot_always_counts",
      missingNumeratorBehavior: "coerce_to_zero_when_denominator_present",
      missingDenominatorBehavior: "exclude_components_but_keep_selected_slot"
    },
    contractSummary:
      "Last N means the player's last N chronological appearances in the relevant strength state, then aggregate numerator and denominator components inside that fixed appearance window."
  },
  weighted_rate_performance: {
    family: "weighted_rate_performance",
    selectionUnit: "chronological_appearances_in_strength_state",
    aggregationMethod:
      "weighted_rate_from_aggregated_components_over_selected_appearances",
    missingComponentPolicy: {
      selectedWindowSlotBehavior: "selected_slot_always_counts",
      missingNumeratorBehavior: "coerce_to_zero_when_denominator_present",
      missingDenominatorBehavior: "exclude_components_but_keep_selected_slot"
    },
    contractSummary:
      "Last N means the player's last N chronological appearances in the relevant strength state, then aggregate the raw event and TOI components inside that fixed appearance window."
  }
};

export type RollingMetricKey =
  | "sog_per_60"
  | "ixg_per_60"
  | "shooting_pct"
  | "ixg"
  | "primary_points_pct"
  | "expected_sh_pct"
  | "ipp"
  | "iscf"
  | "ihdcf"
  | "toi_seconds"
  | "pp_toi_seconds"
  | "hits_per_60"
  | "blocks_per_60"
  | "penalties_drawn_per_60"
  | "oz_start_pct"
  | "pp_share_pct"
  | "on_ice_sh_pct"
  | "pdo"
  | "cf"
  | "ca"
  | "cf_pct"
  | "ff"
  | "fa"
  | "ff_pct"
  | "goals"
  | "assists"
  | "primary_assists"
  | "secondary_assists"
  | "penalties_drawn"
  | "shots"
  | "hits"
  | "blocks"
  | "pp_points"
  | "points";

export const ROLLING_METRIC_WINDOW_FAMILIES: Record<
  RollingMetricKey,
  RollingMetricWindowFamily
> = {
  sog_per_60: "weighted_rate_performance",
  ixg_per_60: "weighted_rate_performance",
  shooting_pct: "ratio_performance",
  ixg: "additive_performance",
  primary_points_pct: "ratio_performance",
  expected_sh_pct: "ratio_performance",
  ipp: "ratio_performance",
  iscf: "additive_performance",
  ihdcf: "additive_performance",
  toi_seconds: "additive_performance",
  pp_toi_seconds: "additive_performance",
  hits_per_60: "weighted_rate_performance",
  blocks_per_60: "weighted_rate_performance",
  penalties_drawn_per_60: "weighted_rate_performance",
  oz_start_pct: "ratio_performance",
  pp_share_pct: "ratio_performance",
  on_ice_sh_pct: "ratio_performance",
  pdo: "ratio_performance",
  cf: "additive_performance",
  ca: "additive_performance",
  cf_pct: "ratio_performance",
  ff: "additive_performance",
  fa: "additive_performance",
  ff_pct: "ratio_performance",
  goals: "additive_performance",
  assists: "additive_performance",
  primary_assists: "additive_performance",
  secondary_assists: "additive_performance",
  penalties_drawn: "additive_performance",
  shots: "additive_performance",
  hits: "additive_performance",
  blocks: "additive_performance",
  pp_points: "additive_performance",
  points: "additive_performance"
};

export function getRollingWindowContractForMetric(
  metricKey: RollingMetricKey
): RollingWindowContract {
  return CANONICAL_ROLLING_WINDOW_CONTRACTS[
    ROLLING_METRIC_WINDOW_FAMILIES[metricKey]
  ];
}

export function getRollingWindowContractForMetricFamily(
  family: RollingMetricWindowFamily
): RollingWindowContract {
  return CANONICAL_ROLLING_WINDOW_CONTRACTS[family];
}
