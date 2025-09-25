export interface SkoPredictionRow {
  player_id: number;
  as_of_date: string;
  sko: number | null;
  pred_points: number | null;
  pred_points_per_game: number | null;
  stability_multiplier: number | null;
}

export interface SkoMetricRow {
  stat_key: string;
  model_name: string;
  sample_size: number;
  mae: number | null;
  mape: number | null;
  rmse: number | null;
  margin_of_error: number | null;
  hit_rate_within_moe: number | null;
  created_at: string;
  run_id: string;
  horizon_games: number;
}

export interface PlayerInfoRow {
  id: number;
  fullName?: string | null;
  position?: string | null;
  team_id?: number | null;
}

export interface SparklinePoint {
  date: string;
  value: number | null;
}

export interface PlayerPredictionDatum {
  playerId: number;
  playerName: string;
  position: string | null | undefined;
  team: string | null | undefined;
  sko: number | null;
  predPoints: number | null;
  stability: number | null;
  asOfDate: string;
  sparkline: SparklinePoint[];
}

export interface MetricSummary {
  statKey: string;
  mae: number | null;
  mape: number | null;
  hitRate: number | null;
  marginOfError: number | null;
  sampleSize: number;
  modelName: string;
}

export interface PlayerSearchResult {
  id: number;
  fullName: string;
  position: string | null;
  team_id: number | null;
}

export interface PlayerMeta {
  id: number;
  name: string;
  position: string | null;
  teamId: number | null;
  teamLabel: string | null;
}

export interface PlayerTrendDatum {
  date: string;
  predicted: number | null;
  actual: number | null;
  diff: number | null;
  low: number | null;
  high: number | null;
  direction: "over" | "under" | "match";
  timestamp?: number;
  dateObj?: Date;
}
