// =============================
// /web/lib/trends/types.ts
// =============================

export type Strength = "AS" | "ES" | "PP" | "PK";
export type TableSource =
  | "wgo_skater_stats"
  | "wgo_skater_stats_totals"
  | "nst_counts"
  | "nst_counts_oi"
  | "nst_rates"
  | "nst_rates_oi";

export const TABLE_SOURCE_LABEL: Record<TableSource, string> = {
  wgo_skater_stats: "WGO Game Logs",
  wgo_skater_stats_totals: "WGO Season Totals",
  nst_counts: "NST Counts (Indiv)",
  nst_counts_oi: "NST Counts (On-Ice)",
  nst_rates: "NST Rates (Indiv)",
  nst_rates_oi: "NST Rates (On-Ice)"
};

export type Category = "Offense" | "Defense";
export type Dimension = "Individual" | "OnIce";

export interface MetricDef {
  id: string; // e.g., 'points', 'ixg', 'xgf_per_60'
  label: string;
  source: TableSource;
  strength?: Strength; // undefined means "all strengths" or N/A
  category: Category;
  dimension: Dimension;
  direction: "higher_is_better" | "lower_is_better";
  luckComponent?: "Shooting" | "PDO" | "IPP" | "xGDelta";
  stabilizesAfterSamples?: number; // rough guidance for UI (shots, mins, etc.)
}

export interface PlayerIdName {
  player_id: number;
  player_name: string;
}

export interface PlayerSeasonKey extends PlayerIdName {
  season: string; // e.g., '2022-2023'
}

export interface CorrelationRow {
  metricId: string;
  metricLabel: string;
  r: number; // Pearson correlation
  r2: number; // coefficient of determination
  n: number; // sample size
  source: TableSource;
  strength?: Strength;
  category: Category;
  dimension: Dimension;
}

export interface RegressionSummary {
  target: "points" | "goals" | "assists" | "points_per_60" | "xga_per_60";
  features: string[]; // metric ids
  coefficients: Record<string, number>;
  intercept: number;
  r2: number;
  n: number;
}

export interface SKOComponents {
  skillOffense: number; // 0-100 scaled
  skillDefense: number; // 0-100 scaled
  onIceImpact: number; // 0-100 scaled
  luckInflation: number; // 0-100 scaled (higher = more luck / less sustainable)
  sustainability: number; // final 0-100 score
}

export interface PlayerSkoSnapshot extends PlayerIdName {
  season?: string; // optional for to-date
  components: SKOComponents;
  role:
    | "Play Driver"
    | "Play Maker"
    | "Balanced"
    | "Two-Way"
    | "Defensive Specialist";
  deltas: {
    xG_minus_G?: number; // positive means under-finished
    IPP_delta?: number; // above/below baseline
    onIceSH_delta?: number;
    PDO_delta?: number;
  };
}

export interface LeagueDistribution {
  metricId: string;
  p25: number;
  p50: number;
  p75: number;
  mean: number;
  std: number;
}

export interface ScatterPoint {
  x: number;
  y: number;
  label?: string;
  meta?: Record<string, any>;
}

export type ApiError = { error: string };

export type MetricOption = MetricDef;

export interface MetricSeries {
  x: number[];
  y: number[];
  xLabel: string;
  yLabel: string;
  n: number;
}

// Suggested registry of metrics for the correlation explorer
export const METRICS_REGISTRY: MetricDef[] = [
  // WGO
  {
    id: "points",
    label: "Points",
    source: "wgo_skater_stats_totals",
    category: "Offense",
    dimension: "OnIce",
    direction: "higher_is_better"
  },
  {
    id: "goals",
    label: "Goals",
    source: "wgo_skater_stats_totals",
    category: "Offense",
    dimension: "Individual",
    direction: "higher_is_better"
  },
  {
    id: "assists",
    label: "Assists",
    source: "wgo_skater_stats_totals",
    category: "Offense",
    dimension: "OnIce",
    direction: "higher_is_better"
  },
  {
    id: "shots",
    label: "Shots",
    source: "wgo_skater_stats_totals",
    category: "Offense",
    dimension: "Individual",
    direction: "higher_is_better"
  },
  {
    id: "shooting_percentage",
    label: "Shooting %",
    source: "wgo_skater_stats_totals",
    category: "Offense",
    dimension: "Individual",
    direction: "higher_is_better",
    luckComponent: "Shooting"
  },
  {
    id: "on_ice_shooting_pct",
    label: "On-Ice SH%",
    source: "wgo_skater_stats_totals",
    category: "Offense",
    dimension: "OnIce",
    direction: "higher_is_better",
    luckComponent: "Shooting"
  },
  {
    id: "plus_minus",
    label: "+/-",
    source: "wgo_skater_stats_totals",
    category: "Defense",
    dimension: "OnIce",
    direction: "higher_is_better"
  },

  // NST counts (individual, AS)
  {
    id: "ixg",
    label: "Individual xG",
    source: "nst_counts",
    strength: "AS",
    category: "Offense",
    dimension: "Individual",
    direction: "higher_is_better"
  },
  {
    id: "icf",
    label: "iCF",
    source: "nst_counts",
    strength: "AS",
    category: "Offense",
    dimension: "Individual",
    direction: "higher_is_better"
  },
  {
    id: "iff",
    label: "iFF",
    source: "nst_counts",
    strength: "AS",
    category: "Offense",
    dimension: "Individual",
    direction: "higher_is_better"
  },
  {
    id: "takeaways",
    label: "Takeaways",
    source: "nst_counts",
    strength: "AS",
    category: "Defense",
    dimension: "Individual",
    direction: "higher_is_better"
  },
  {
    id: "shots_blocked",
    label: "Shots Blocked (i)",
    source: "nst_counts",
    strength: "AS",
    category: "Defense",
    dimension: "Individual",
    direction: "higher_is_better"
  },

  // NST on-ice rates (ES)
  {
    id: "xgf_per_60",
    label: "xGF/60 (on-ice)",
    source: "nst_rates_oi",
    strength: "ES",
    category: "Offense",
    dimension: "OnIce",
    direction: "higher_is_better"
  },
  {
    id: "xga_per_60",
    label: "xGA/60 (on-ice)",
    source: "nst_rates_oi",
    strength: "ES",
    category: "Defense",
    dimension: "OnIce",
    direction: "lower_is_better"
  },
  {
    id: "cf_pct",
    label: "CF% (on-ice)",
    source: "nst_rates_oi",
    strength: "ES",
    category: "Offense",
    dimension: "OnIce",
    direction: "higher_is_better"
  },
  {
    id: "hdcf_per_60",
    label: "HDCF/60 (on-ice)",
    source: "nst_rates_oi",
    strength: "ES",
    category: "Offense",
    dimension: "OnIce",
    direction: "higher_is_better"
  },
  {
    id: "hdga_per_60",
    label: "HDGA/60 (on-ice)",
    source: "nst_rates_oi",
    strength: "ES",
    category: "Defense",
    dimension: "OnIce",
    direction: "lower_is_better"
  },
  // On-ice luck
  {
    id: "on_ice_sh_pct_oi",
    label: "On-Ice SH% (oi)",
    source: "nst_counts_oi",
    strength: "AS",
    category: "Offense",
    dimension: "OnIce",
    direction: "higher_is_better",
    luckComponent: "Shooting"
  },
  {
    id: "pdo",
    label: "PDO",
    source: "nst_rates_oi",
    strength: "AS",
    category: "Offense",
    dimension: "OnIce",
    direction: "higher_is_better",
    luckComponent: "PDO"
  }
];
