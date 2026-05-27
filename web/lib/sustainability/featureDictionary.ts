export type SustainabilityFeatureGroup =
  | "recent_rate"
  | "baseline_rate"
  | "z_score"
  | "percentile"
  | "usage_delta"
  | "context_delta"
  | "opponent_adjustment"
  | "reliability"
  | "sample_weight";

export type SustainabilityFeatureDictionaryEntry = {
  key: string;
  group: SustainabilityFeatureGroup;
  unit: "per_60" | "count" | "z_score" | "percentile_0_to_100" | "fraction_0_to_1" | "multiplier" | "seconds" | "index";
  primarySources: string[];
  description: string;
  requiredForScore: boolean;
};

export const SUSTAINABILITY_FEATURE_DICTIONARY: SustainabilityFeatureDictionaryEntry[] = [
  {
    key: "recent_rate_per_60",
    group: "recent_rate",
    unit: "per_60",
    primarySources: ["rolling_player_game_metrics"],
    description: "Recent player production rate over the selected canonical rolling window.",
    requiredForScore: true,
  },
  {
    key: "baseline_rate_per_60",
    group: "baseline_rate",
    unit: "per_60",
    primarySources: ["sustainability_player_priors", "rolling_player_game_metrics"],
    description: "Shrunk season, three-year, or career rate baseline used as the stable expectation.",
    requiredForScore: true,
  },
  {
    key: "window_z_score",
    group: "z_score",
    unit: "z_score",
    primarySources: ["sustainability_window_z_scores"],
    description: "Recent-minus-baseline delta normalized by metric/window volatility.",
    requiredForScore: true,
  },
  {
    key: "window_percentile",
    group: "percentile",
    unit: "percentile_0_to_100",
    primarySources: ["sustainability_window_z_scores"],
    description: "Population percentile for the player/metric/window snapshot.",
    requiredForScore: true,
  },
  {
    key: "usage_delta_pct",
    group: "usage_delta",
    unit: "fraction_0_to_1",
    primarySources: ["rolling_player_game_metrics", "lineCombinations", "powerPlayCombinations"],
    description: "Recent usage change versus baseline usage, including TOI and PP-share movement.",
    requiredForScore: false,
  },
  {
    key: "context_delta_index",
    group: "context_delta",
    unit: "index",
    primarySources: ["rolling_player_game_metrics"],
    description: "Context change for PDO, on-ice shooting, zone starts, and related environment indicators.",
    requiredForScore: false,
  },
  {
    key: "opponent_adjustment_multiplier",
    group: "opponent_adjustment",
    unit: "multiplier",
    primarySources: ["team_power_ratings_daily", "team_ctpi_daily", "nst_team_gamelogs_as_counts"],
    description: "Adjustment for opponent defensive, goaltending, and penalty-kill context as of the snapshot.",
    requiredForScore: false,
  },
  {
    key: "reliability_score",
    group: "reliability",
    unit: "fraction_0_to_1",
    primarySources: ["rolling_player_game_metrics", "sustainability_player_priors"],
    description: "Confidence in the feature set after sample size, recency, and source completeness checks.",
    requiredForScore: true,
  },
  {
    key: "sample_weight",
    group: "sample_weight",
    unit: "fraction_0_to_1",
    primarySources: ["rolling_player_game_metrics"],
    description: "Window exposure weight used for shrinkage and small-sample damping.",
    requiredForScore: true,
  },
];

export function getSustainabilityFeatureDictionaryEntry(
  key: string
): SustainabilityFeatureDictionaryEntry | null {
  return (
    SUSTAINABILITY_FEATURE_DICTIONARY.find((entry) => entry.key === key) ?? null
  );
}
