// lib/variance-hub/types.ts

// Types for fantasy scoring configurations
export interface FantasyScoringConfig {
  goals: number;
  assists: number;
  shots: number;
  hits: number;
  blocks: number;
  penalty_minutes: number;
  plus_minus: number;
  pp_goals: number;
  pp_assists: number;
  sh_goals: number;
  sh_assists: number;
  wins?: number;
  saves?: number;
  goals_against?: number;
  shutouts?: number;
}

// Default fantasy scoring configuration (standard Yahoo settings)
export const DEFAULT_SCORING_CONFIG: FantasyScoringConfig = {
  goals: 6,
  assists: 4,
  shots: 0.9,
  hits: 0.5,
  blocks: 1,
  penalty_minutes: -0.5,
  plus_minus: 0.5,
  pp_goals: 1,
  pp_assists: 1,
  sh_goals: 2,
  sh_assists: 1,
  wins: 5,
  saves: 0.6,
  goals_against: -3,
  shutouts: 5
};

// League size configuration for replacement calculations
export interface LeagueConfig {
  num_teams: number;
  roster_spots_per_team: number;
  position_slots: {
    C: number;
    LW: number;
    RW: number;
    D: number;
    G: number;
    BENCH: number;
  };
}

// Default 12-team Yahoo league configuration
export const DEFAULT_LEAGUE_CONFIG: LeagueConfig = {
  num_teams: 12,
  roster_spots_per_team: 16,
  position_slots: {
    C: 2,
    LW: 2,
    RW: 2,
    D: 4,
    G: 2,
    BENCH: 4
  }
};

// Foundational type for player stats used across all calculations
export interface PlayerFantasyStats {
  player_id: number;
  player_name: string;
  position_code: string;
  games_played: number;
  fantasy_points_total: number;
  fantasy_points_per_game: number;
}
