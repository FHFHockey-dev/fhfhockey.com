// /Users/tim/Desktop/fhfhockey.com/web/components/GoaliePage/goalieTypes.ts

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
  | "savesPer60" // <<< ADDED
  | "shotsAgainstPer60"; // <<< ADDED

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
  savesPer60?: number; // <<< ADDED (Optional: Calculated)
  shotsAgainstPer60?: number; // <<< ADDED (Optional: Calculated)
}

// Goalie identification and team info
export interface GoalieInfo {
  playerId: number;
  goalieFullName: string;
  team?: string;
  gameDate?: string | Date;
}

// Represents goalie stats for a specific GAME (inherits GoalieBaseStats)
export interface GoalieGameStat extends GoalieBaseStats, GoalieInfo {
  weekLabel: string; // For grouping
}

// Represents aggregated goalie data over multiple games
export interface AggregatedGoalieData extends GoalieInfo {
  games: GoalieGameStat[];
}

// Type for the averages calculated (will include new keys via Record)
export type GoalieAverages = Record<NumericGoalieStatKey, string>;
// Note: Previously had explicit `& { savePct: string; ... }` but Record<NumericGoalieStatKey, string>
// should now cover all keys including the new ones.

// Ranking categories
export type Ranking = "Elite" | "Quality" | "Average" | "Bad" | "Really Bad";

// Structure for counting weeks by ranking
export type WeekCounts = Record<Ranking, number>;

// Final structure for a goalie's overall ranking
export interface GoalieRanking extends GoalieInfo {
  totalPoints: number;
  weekCounts: WeekCounts;
  percentAcceptableWeeks?: number;
  percentGoodWeeks?: number;
  wowVariance?: number;
  gogVariance?: number;
  // Aggregated stats
  totalGamesPlayed: number;
  totalWins: number;
  totalLosses: number;
  totalOtLosses: number;
  totalSaves: number;
  totalShotsAgainst: number;
  totalGoalsAgainst: number;
  totalShutouts: number;
  totalTimeOnIce: number;
  overallSavePct: number;
  overallGaa: number;
  // Optional derived overall stats
  overallSavesPer60?: number;
  overallShotsAgainstPer60?: number;
}

// Represents a week interval
export interface Week {
  start: Date;
  end: Date;
}

// Structure for dropdown options
export interface WeekOption {
  label: string;
  value: Week;
}

// Structure for defining stat columns
export interface StatColumn {
  label: string;
  value: NumericGoalieStatKey; // Now includes savesPer60 etc.
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
