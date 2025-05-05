// /Users/tim/Desktop/fhfhockey.com/web/components/GoaliePage/goalieTypes.ts

// --- Fantasy Scoring Types ---
export type FantasyCountStatKey = "goalAgainst" | "save" | "shutout" | "win"; // Stats that get fPts

// Structure for fantasy point settings (editable)
export type FantasyPointSettings = Record<FantasyCountStatKey, number>;

// --- Existing Types (modified) ---

// Define the keys for numeric goalie stats
export type NumericGoalieStatKey =
  | "gamesPlayed"
  | "gamesStarted"
  | "wins"
  | "losses"
  | "otLosses"
  | "saves"
  | "shotsAgainst"
  | "goalsAgainst"
  | "shutouts"
  | "timeOnIce"
  | "savePct"
  | "goalsAgainstAverage"
  | "savesPer60"
  | "shotsAgainstPer60";

// Base stats typically returned by the API per game OR calculated weekly
export interface GoalieBaseStats {
  gamesPlayed: number;
  gamesStarted: number;
  wins: number;
  losses: number;
  otLosses: number;
  saves: number;
  shotsAgainst: number;
  goalsAgainst: number;
  shutouts: number;
  timeOnIce: number; // In minutes
  savePct?: number; // Optional: Calculated
  goalsAgainstAverage?: number; // Optional: Calculated
  savesPer60?: number; // Optional: Calculated
  shotsAgainstPer60?: number; // Optional: Calculated
}

// Goalie identification and team info
export interface GoalieInfo {
  playerId: number;
  goalieFullName: string;
  team?: string;
  gameDate?: string | Date;
}

// Represents aggregated goalie data over multiple games
export interface AggregatedGoalieData extends GoalieInfo {
  games: GoalieGameStat[];
}

// Type for the averages calculated (will include new keys via Record)
export type GoalieAverages = Record<NumericGoalieStatKey, string>;

// Ranking categories
export type Ranking = "Elite" | "Quality" | "Average" | "Bad" | "Really Bad";

// Structure for counting weeks by ranking
export type WeekCounts = Record<Ranking, number>;

// Final structure for a goalie's overall ranking
export interface GoalieRanking extends GoalieInfo {
  totalPoints: number; // Based on WoW ranking
  weekCounts: WeekCounts;
  percentAcceptableWeeks?: number;
  percentGoodWeeks?: number;
  wowVariance?: number; // StdDev of Weekly Points (vs League Avg)
  gogVariance?: number; // StdDev of Game Fantasy Points (vs Goalie's Avg fPts) **<- NEW MEANING**
  // Aggregated stats
  totalGamesPlayed: number;
  totalWins: number;
  totalLosses: number;
  totalOtLosses: number;
  totalSaves: number;
  totalShotsAgainst: number;
  totalGoalsAgainst: number;
  totalShutouts: number;
  totalTimeOnIce: number; // In minutes
  overallSavePct: number;
  overallGaa: number;
  // --- NEW Fantasy Point Fields ---
  averageFantasyPointsPerGame: number;
  leagueAverageFantasyPointsPerGame?: number; // Overall league avg for the period
  // --- NEW Percentile Fields ---
  percentiles?: Partial<Record<NumericGoalieStatKey, number>>; // Store percentile for each stat
  averagePercentileRank?: number; // Average of all calculated percentiles
}

// Represents a week interval
export interface Week {
  start: Date;
  end: Date;
}

// Structure for defining stat columns
// Add a flag to indicate if a stat is eligible for fantasy points
export interface StatColumn {
  label: string;
  value: NumericGoalieStatKey; // Now includes savesPer60 etc.
  dbFieldGoalie?: keyof GoalieWeeklyAggregate; // Optional mapping for goalie data
  dbFieldAverage?: keyof LeagueWeeklyAverage; // Optional mapping for average data
  dbFieldRate?: boolean; // Indicate if it's a rate stat needing different comparison logic
  fantasyStatKey?: FantasyCountStatKey; // Map to fantasy point key if applicable
}

// Basic Season Info
export interface Season {
  start: Date;
  end: Date;
}

// Type for raw API data for a single goalie game entry
export interface ApiGoalieData extends GoalieBaseStats, GoalieInfo {}

// Type for raw API data for season info
export interface ApiSeasonData {
  id: number;
  startDate: string;
  regularSeasonEndDate: string;
}

// Generic API response structure
export interface ApiResponse<T> {
  data: T[];
}

export interface GoalieWeeklyAggregate {
  matchup_season: string | null; // Allow null based on error
  week: number | null; // Allow null based on error
  week_start_date: string | null; // Allow null
  week_end_date: string | null; // Allow null
  goalie_id: number | null; // Allow null based on error
  goalie_name: string | null; // Allow null
  team: string | null; // Allow null
  goalie_game_season: number | null; // Allow null (adjust type if it's number)
  weekly_gp: number | null;
  weekly_gs: number | null;
  weekly_wins: number | null;
  weekly_losses: number | null;
  weekly_ot_losses: number | null;
  weekly_saves: number | null;
  weekly_sa: number | null;
  weekly_ga: number | null;
  weekly_so: number | null;
  weekly_toi_seconds: number | null;
  weekly_sv_pct: number | null;
  weekly_gaa: number | null;
  weekly_saves_per_60: number | null;
  weekly_sa_per_60: number | null;
}

// GoalieGameStat should contain the raw stats needed for fPts calculation
export interface GoalieGameStat {
  goalie_id: number; // is_nullable: NO
  goalie_name: string; // is_nullable: NO
  date: string; // data_type: date, comes as string from Supabase client
  shoots_catches?: string | null;
  position_code?: string | null;
  games_played?: number | null; // Should always be 1 for a single game row?
  games_started?: number | null;
  wins?: number | null; // Stored as integer (likely 1 or 0) - **NEEDED FOR FPTS**
  losses?: number | null; // Stored as integer
  ot_losses?: number | null; // Stored as integer
  save_pct?: number | null; // Pre-calculated
  saves?: number | null; // **NEEDED FOR FPTS**
  goals_against?: number | null; // **NEEDED FOR FPTS**
  goals_against_avg?: number | null; // Pre-calculated
  shots_against?: number | null;
  time_on_ice?: number | null; // Stored as double precision (seconds)
  shutouts?: number | null; // **NEEDED FOR FPTS**
  goals?: number | null;
  assists?: number | null;
  // --- Add fantasy points calculated per game ---
  fantasyPoints?: number; // Calculated field
}

export interface LeagueWeeklyAverage {
  matchup_season: string | null; // Allow null based on error
  week: number | null; // Allow null based on error
  total_league_saves: number | null;
  total_league_sa: number | null;
  total_league_ga: number | null;
  total_league_toi_seconds: number | null;
  avg_league_weekly_gp: number | null;
  avg_league_weekly_gs: number | null;
  avg_league_weekly_wins: number | null;
  avg_league_weekly_losses: number | null;
  avg_league_weekly_ot_losses: number | null;
  avg_league_weekly_saves: number | null;
  avg_league_weekly_sa: number | null;
  avg_league_weekly_ga: number | null;
  avg_league_weekly_so: number | null;
  avg_league_weekly_toi_seconds: number | null;
  avg_league_weekly_sv_pct: number | null;
  avg_league_weekly_gaa: number | null;
  avg_league_weekly_saves_per_60: number | null;
  avg_league_weekly_sa_per_60: number | null;
}

export interface WeekOption {
  label: string;
  value: {
    week: number;
    season: string; // Or number, matching matchup_season type
    start: Date; // Keep as Date object for potential date logic
    end: Date; // Keep as Date object
  };
}
