export type RollingMetricUnit =
  | "seconds"
  | "count"
  | "count_per_60"
  | "percent_0_to_100"
  | "fraction_0_to_1"
  | "index"
  | "label";

export type RollingMetricSourceUnitContract = {
  metricKey: string;
  unit: RollingMetricUnit;
  primarySources: string[];
  fallbackSources?: string[];
  notes: string;
};

export const ROLLING_METRIC_SOURCE_UNIT_CONTRACTS: RollingMetricSourceUnitContract[] = [
  {
    metricKey: "strength_state",
    unit: "label",
    primarySources: ["rolling_player_game_metrics.strength_state"],
    notes: "Rows are split by all/ev/pp/pk. ES-style FORGE reads use ev rows; PP and PK rows stay separate.",
  },
  {
    metricKey: "toi_seconds",
    unit: "seconds",
    primarySources: ["nst_*_counts.toi_seconds", "nst_*_counts_oi.toi_seconds"],
    fallbackSources: ["wgo_skater_stats.toi"],
    notes: "Stored as seconds; WGO minute-like values are normalized before aggregation.",
  },
  {
    metricKey: "pp_toi_seconds",
    unit: "seconds",
    primarySources: ["powerPlayCombinations.PPTOI"],
    fallbackSources: ["wgo_skater_stats.pp_toi"],
    notes: "Player PP TOI in seconds for all/pp rows only.",
  },
  {
    metricKey: "shots",
    unit: "count",
    primarySources: ["nst_*_counts.shots"],
    fallbackSources: ["wgo_skater_stats.shots"],
    notes: "Raw individual shot count.",
  },
  {
    metricKey: "sog_per_60",
    unit: "count_per_60",
    primarySources: ["nst_*_counts.shots", "toi_seconds"],
    fallbackSources: ["nst_*_rates.shots_per_60"],
    notes: "Weighted per-60 rate from aggregated shots and TOI.",
  },
  {
    metricKey: "ixg",
    unit: "count",
    primarySources: ["nst_*_counts.ixg"],
    fallbackSources: ["wgo_skater_stats.ixg"],
    notes: "Individual expected goals.",
  },
  {
    metricKey: "ixg_per_60",
    unit: "count_per_60",
    primarySources: ["nst_*_counts.ixg", "toi_seconds"],
    fallbackSources: ["wgo_skater_stats.ixg", "nst_*_rates.ixg_per_60"],
    notes: "Weighted per-60 rate from aggregated ixG and TOI.",
  },
  {
    metricKey: "iscf",
    unit: "count",
    primarySources: ["nst_*_counts.iscfs"],
    notes: "Individual scoring chances for.",
  },
  {
    metricKey: "ihdcf",
    unit: "count",
    primarySources: ["nst_*_counts.hdcf"],
    notes: "Individual high-danger chances for.",
  },
  {
    metricKey: "goals",
    unit: "count",
    primarySources: ["nst_*_counts.goals"],
    fallbackSources: ["wgo_skater_stats.goals"],
    notes: "Raw goal count.",
  },
  {
    metricKey: "assists",
    unit: "count",
    primarySources: ["nst_*_counts.total_assists"],
    fallbackSources: ["wgo_skater_stats.assists"],
    notes: "Total assists. Primary and secondary assists are also stored as separate additive counts.",
  },
  {
    metricKey: "points",
    unit: "count",
    primarySources: ["nst_*_counts.total_points"],
    fallbackSources: ["wgo_skater_stats.points"],
    notes: "Goals plus assists.",
  },
  {
    metricKey: "hits",
    unit: "count",
    primarySources: ["nst_*_counts.hits"],
    fallbackSources: ["wgo_skater_stats.hits"],
    notes: "Raw hit count.",
  },
  {
    metricKey: "blocks",
    unit: "count",
    primarySources: ["nst_*_counts.blocks"],
    fallbackSources: ["wgo_skater_stats.blocks"],
    notes: "Raw blocked-shot count.",
  },
  {
    metricKey: "ipp",
    unit: "percent_0_to_100",
    primarySources: ["nst_*_counts.total_points", "nst_*_counts_oi.gf"],
    notes: "Individual points percentage, aggregated from raw point and on-ice goal components.",
  },
  {
    metricKey: "pdo",
    unit: "index",
    primarySources: ["nst_*_counts_oi.gf", "nst_*_counts_oi.sf", "nst_*_counts_oi.ga", "nst_*_counts_oi.sa"],
    notes: "On-ice shooting percentage plus save percentage, stored as a 0-2 index.",
  },
  {
    metricKey: "on_ice_sh_pct",
    unit: "percent_0_to_100",
    primarySources: ["nst_*_counts_oi.gf", "nst_*_counts_oi.sf"],
    notes: "On-ice shooting percentage from aggregated goals-for and shots-for.",
  },
  {
    metricKey: "oz_start_pct",
    unit: "percent_0_to_100",
    primarySources: ["nst_*_counts_oi.off_zone_starts", "nst_*_counts_oi.def_zone_starts"],
    notes: "Offensive-zone start share excluding neutral-zone starts.",
  },
  {
    metricKey: "pp_share_pct",
    unit: "fraction_0_to_1",
    primarySources: ["powerPlayCombinations.PPTOI", "powerPlayCombinations.pp_share_of_team"],
    fallbackSources: ["wgo_skater_stats.pp_toi", "wgo_skater_stats.pp_toi_pct_per_game"],
    notes: "Player share of team PP TOI. Unit-relative PP fields are contextual only.",
  },
];

export function getRollingMetricSourceUnitContract(
  metricKey: string
): RollingMetricSourceUnitContract | null {
  return (
    ROLLING_METRIC_SOURCE_UNIT_CONTRACTS.find((contract) => contract.metricKey === metricKey) ??
    null
  );
}
