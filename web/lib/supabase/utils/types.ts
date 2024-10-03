// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\lib\supabase\utils\types.ts
// utils/types.ts

import { StatField } from "./constants";

/**
 * Represents a player's statistics for a specific season.
 */
export interface PlayerYearData {
  player_id: number;
  player_name: string;
  season: number;
  games_played: number;
  // Include all StatField properties here
  // [StatField.GamesPlayed]: number; // Games Played duplicate - removing index signature, explicit definition keeps type safety and clarity
  [StatField.Goals]: number;
  [StatField.Assists]: number;
  [StatField.Points]: number;
  [StatField.Shots]: number;
  [StatField.TimeOnIce]: number;
  [StatField.ESGoalsFor]: number;
  [StatField.PPGoalsFor]: number;
  [StatField.SHGoalsFor]: number;
  [StatField.TotalPrimaryAssists]: number;
  [StatField.TotalSecondaryAssists]: number;
  [StatField.PAtoSARatio]?: number; // This will be computed later
  [StatField.ShootingPercentage]: number;
  [StatField.OnIceShootingPct]: number;
  [StatField.ZoneStartPct]: number;
  [StatField.PPToiPctPerGame]: number;
  [StatField.IPP]: number;
  [StatField.SOGPer60]: number;
}

/**
 * Represents a player's statistics for a single game.
 */
export interface PlayerGameLog {
  player_id: number;
  player_name: string;
  season_id: number;
  date: string;
  // StatField properties
  [StatField.GamesPlayed]: number;
  [StatField.Goals]: number;
  [StatField.Assists]: number;
  [StatField.Points]: number;
  [StatField.Shots]: number;
  [StatField.TimeOnIce]: number;
  [StatField.ESGoalsFor]: number;
  [StatField.PPGoalsFor]: number;
  [StatField.SHGoalsFor]: number;
  [StatField.TotalPrimaryAssists]: number;
  [StatField.TotalSecondaryAssists]: number;
  [StatField.PAtoSARatio]?: number;
  [StatField.ShootingPercentage]: number;
  [StatField.OnIceShootingPct]: number | null; // Adjusted
  [StatField.ZoneStartPct]: number;
  [StatField.PPToiPctPerGame]: number;
  [StatField.IPP]: number | null; // Adjusted
  [StatField.SOGPer60]: number | null; // Adjusted
}

/**
 * Represents per-game average statistics for a player.
 */
export type PerGameAverages = Record<StatField, number>;

/**
 * Represents statistical summaries (mean and stdDev) for each stat.
 */
export interface StatSummary {
  mean: number;
  stdDev: number;
}

export type PerGameStatSummaries = Record<StatField, StatSummary>;

/**
 * Represents the result of characteristic analysis for a single game.
 */
export interface CharacteristicResult {
  gameDate: string;
  statResults: Record<StatField, string>;
  gameStats: PlayerGameLog;
  sumOfWeightedSquaredZScores: number;
  overallStatus: string;
}

/**
 * Aggregates a player's per-game averages over multiple seasons.
 */
export interface PlayerStatistics {
  threeYrPGA: PerGameAverages;
  twoYrPGA: PerGameAverages;
  oneYrPGA: PerGameAverages;
  threeYrWPGA: PerGameAverages;
  twoYrWPGA: PerGameAverages;
}

/**
 * Represents a player.
 */
export interface Player {
  player_id: number;
  player_name: string;
}

/**
 * Represents a player's game log with additional calculated fields.
 * This is used to display game logs in the GameLogTable component.
 */

export interface CombinedGameLog extends PlayerGameLog {
  date: string;
  goals: number;
  assists: number;
  points: number;
  shots: number;
  shooting_percentage: number;
  pp_goals: number;
  pp_assists: number;
  pp_points: number;
  toi_per_game: number;
  blocked_shots: number;
  hits: number;
  total_faceoffs: number;
  total_fol: number;
  total_fow: number;
  penalties_drawn: number;
  penalties: number;
  penalty_minutes: number;
  pp_toi_pct_per_game: number;
  on_ice_shooting_pct: number;
  zone_start_pct: number;
  usat_for: number;
  usat_against: number;
  usat_percentage: number;

  // Fields from sko_skater_stats
  ipp: number | null;
  sog_per_60: number | null;
  total_primary_assists: number;
  total_secondary_assists: number;
  es_goals_for: number;
  pp_goals_for: number;
  sh_goals_for: number;
  es_goals_against: number;
  pp_goals_against: number;
  sh_goals_against: number;

  // Calculated fields
  gameScore?: number;
  rollingCV?: number;
  confidenceMultiplier?: number;
  predictedGameScore?: number;

  // Add other fields as needed
}
