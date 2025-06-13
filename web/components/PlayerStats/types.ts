import { formatTOIFromSeconds } from "../../utils/formattingUtils";

// Core game log interfaces
export interface BaseGameLogEntry {
  date: string;
  games_played: number | null;
  isPlayoff?: boolean;
  [key: string]: any; // Allow dynamic stat access
}

// Missed game interface
export interface MissedGame {
  date: string;
  gameId: number;
  homeTeamId: number;
  awayTeamId: number;
  isPlayoff: boolean;
  seasonId: number;
  isFuture?: boolean; // Flag to distinguish future scheduled games
}

export interface SkaterGameLogEntry extends BaseGameLogEntry {
  goals: number | null;
  assists: number | null;
  points: number | null;
  plus_minus: number | null;
  shots: number | null;
  shooting_percentage: number | null;
  pp_points: number | null;
  gw_goals: number | null;
  fow_percentage: number | null;
  toi_per_game: number | null;
  pp_toi_per_game: number | null; // Add power play TOI field
  blocked_shots: number | null;
  hits: number | null;
  takeaways: number | null;
  giveaways: number | null;
  sat_pct: number | null;
  zone_start_pct: number | null;

  // Advanced stats
  individual_sat_for_per_60: number | null;
  on_ice_shooting_pct: number | null;
  sat_relative: number | null;
  usat_pct: number | null;

  // NST Advanced Stats - Possession Percentages
  cf_pct: number | null;
  ff_pct: number | null;
  sf_pct: number | null;
  gf_pct: number | null;
  xgf_pct: number | null;
  scf_pct: number | null;
  hdcf_pct: number | null;
  mdcf_pct: number | null;
  ldcf_pct: number | null;

  // NST Advanced Stats - Individual Per 60
  ixg_per_60: number | null;
  icf_per_60: number | null;
  iff_per_60: number | null;
  iscfs_per_60: number | null;
  hdcf_per_60: number | null;
  shots_per_60: number | null;
  goals_per_60: number | null;
  total_assists_per_60: number | null;
  total_points_per_60: number | null;
  rush_attempts_per_60: number | null;
  rebounds_created_per_60: number | null;

  // NST Advanced Stats - Defensive Per 60
  hdca_per_60: number | null;
  sca_per_60: number | null;
  shots_blocked_per_60: number | null;
  xga_per_60: number | null;
  ga_per_60: number | null;

  // NST Advanced Stats - Zone Usage
  off_zone_start_pct: number | null;
  def_zone_start_pct: number | null;
  neu_zone_start_pct: number | null;
  off_zone_faceoff_pct: number | null;

  // NST Advanced Stats - On-Ice Impact
  on_ice_sh_pct: number | null;
  on_ice_sv_pct: number | null;
  pdo: number | null;

  // NST Advanced Stats - Discipline Per 60
  pim_per_60: number | null;
  total_penalties_per_60: number | null;
  penalties_drawn_per_60: number | null;
  giveaways_per_60: number | null;
  takeaways_per_60: number | null;
  hits_per_60: number | null;
}

export interface GoalieGameLogEntry extends BaseGameLogEntry {
  games_started: number | null;
  wins: number | null;
  losses: number | null;
  ot_losses: number | null;
  save_pct: number | null;
  goals_against_avg: number | null;
  shutouts: number | null;
  saves: number | null;
  shots_against: number | null;
  goals_against: number | null;
  time_on_ice: string | null;
  quality_start: number | null;

  // Advanced goalie stats
  goals_saved_above_average: number | null;
  high_danger_save_pct: number | null;
  medium_danger_save_pct: number | null;
}

export type GameLogEntry = SkaterGameLogEntry | GoalieGameLogEntry;

// Player information interface with all required properties
export interface PlayerInfo {
  id: number;
  fullName: string;
  position: string;
  team?: string;
  team_id?: number;
  birthDate?: string;
  birthCity?: string;
  birthCountry?: string;
  height?: string;
  heightInCentimeters?: number;
  weight?: number;
  weightInKilograms?: number;
  shootsCatches?: string;
  sweater_number?: number;
  image_url?: string;
}

// Season totals interfaces
export interface SeasonTotals {
  season: string;
  season_id?: number;
  [key: string]: any;
}

export interface SkaterSeasonTotals extends SeasonTotals {
  points: number;
  goals: number;
  assists: number;
  games_played: number;
  shots: number;
  shooting_percentage: number;
  hits: number;
  blocked_shots: number;
  fow_percentage?: number;
  toi_per_game: number;
}

export interface GoalieSeasonTotals extends SeasonTotals {
  games_played: number;
  wins: number;
  losses: number;
  save_pct: number;
  goals_against_avg: number;
  saves: number;
  shutouts: number;
}

// Component prop interfaces
export interface PlayerStatsChartProps {
  gameLog: GameLogEntry[];
  playoffGameLog?: GameLogEntry[];
  selectedStats: string[];
  showRollingAverage?: boolean;
  title?: string;
  showPlayoffData?: boolean;
}

export interface PlayerStatsSummaryProps {
  gameLog: GameLogEntry[];
  playoffGameLog?: GameLogEntry[];
  selectedStats: string[];
  isGoalie: boolean;
  showPlayoffData?: boolean;
}

export interface PlayerStatsTableProps {
  gameLog: GameLogEntry[];
  playoffGameLog?: GameLogEntry[];
  selectedStats: string[];
  isGoalie: boolean;
  showAdvanced?: boolean;
  showPlayoffData?: boolean;
  playerId?: string | number;
  playerTeamId?: number;
  seasonId?: string | number | null;
}

export interface PlayerPerformanceHeatmapProps {
  player: PlayerInfo;
  gameLog: GameLogEntry[];
  playoffGameLog?: GameLogEntry[];
  selectedStats: string[];
  selectedStat: string;
  isGoalie: boolean;
  playerId?: string | number;
  playerTeamId?: number;
  seasonId?: string | number | null;
}

// Position-based stat configurations with mutable arrays
export const POSITION_STAT_CONFIGS = {
  C: {
    primary: [
      "points",
      "goals",
      "assists",
      "fow_percentage",
      "toi_per_game"
    ] as string[],
    secondary: [
      "shots",
      "shooting_percentage",
      "hits",
      "blocked_shots",
      "sat_pct"
    ] as string[],
    advanced: [
      "cf_pct",
      "xgf_pct",
      "hdcf_pct",
      "ixg_per_60",
      "total_points_per_60",
      "ff_pct",
      "sf_pct",
      "pdo",
      "on_ice_sh_pct",
      "off_zone_start_pct",
      "penalties_drawn_per_60"
    ] as string[]
  },
  LW: {
    primary: [
      "points",
      "goals",
      "assists",
      "shots",
      "shooting_percentage"
    ] as string[],
    secondary: ["hits", "blocked_shots", "toi_per_game", "sat_pct"] as string[],
    advanced: [
      "cf_pct",
      "xgf_pct",
      "hdcf_pct",
      "ixg_per_60",
      "goals_per_60",
      "ff_pct",
      "sf_pct",
      "pdo",
      "rush_attempts_per_60",
      "rebounds_created_per_60",
      "hits_per_60"
    ] as string[]
  },
  RW: {
    primary: [
      "points",
      "goals",
      "assists",
      "shots",
      "shooting_percentage"
    ] as string[],
    secondary: ["hits", "blocked_shots", "toi_per_game", "sat_pct"] as string[],
    advanced: [
      "cf_pct",
      "xgf_pct",
      "hdcf_pct",
      "ixg_per_60",
      "goals_per_60",
      "ff_pct",
      "sf_pct",
      "pdo",
      "rush_attempts_per_60",
      "rebounds_created_per_60",
      "hits_per_60"
    ] as string[]
  },
  D: {
    primary: [
      "points",
      "assists",
      "blocked_shots",
      "hits",
      "toi_per_game"
    ] as string[],
    secondary: ["goals", "shots", "shooting_percentage", "sat_pct"] as string[],
    advanced: [
      "cf_pct",
      "xgf_pct",
      "hdcf_pct",
      "shots_blocked_per_60",
      "def_zone_start_pct",
      "hdca_per_60",
      "xga_per_60",
      "pdo",
      "off_zone_start_pct",
      "takeaways_per_60",
      "giveaways_per_60"
    ] as string[]
  },
  G: {
    primary: ["save_pct", "goals_against_avg", "wins", "shutouts"] as string[],
    secondary: ["saves"] as string[],
    advanced: [
      "high_danger_save_pct",
      "medium_danger_save_pct",
      "goals_saved_above_average"
    ] as string[]
  }
} as const;

// Chart configuration
export const CHART_COLORS = [
  "#14a2d2", // Primary blue
  "#07aae2", // Secondary blue
  "#00ff99", // Success green
  "#ffcc00", // Warning yellow
  "#ff6384", // Danger red
  "#9b59b6", // Purple
  "#4bc0c0", // Teal
  "#ff9f40" // Orange
] as const;

// Stat formatting functions
export const STAT_FORMATTERS = {
  // Percentages
  shooting_percentage: (value: number) => `${(value || 0).toFixed(1)}%`,
  save_pct: (value: number) => `${(value || 0).toFixed(3)}`,
  fow_percentage: (value: number) => `${(value || 0).toFixed(1)}%`,
  sat_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  zone_start_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  on_ice_shooting_pct: (value: number) => `${(value || 0).toFixed(1)}%`,

  // NST Advanced Stats - Possession Percentages
  cf_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  ff_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  sf_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  gf_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  xgf_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  scf_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  hdcf_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  mdcf_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  ldcf_pct: (value: number) => `${(value || 0).toFixed(1)}%`,

  // NST Advanced Stats - Zone Usage Percentages
  off_zone_start_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  def_zone_start_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  neu_zone_start_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  off_zone_faceoff_pct: (value: number) => `${(value || 0).toFixed(1)}%`,

  // NST Advanced Stats - On-Ice Impact
  on_ice_sh_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  on_ice_sv_pct: (value: number) => `${(value || 0).toFixed(1)}%`,
  pdo: (value: number) => (value || 0).toFixed(1),

  // Decimal stats
  goals_against_avg: (value: number) => (value || 0).toFixed(2),

  // Time on Ice formatting - handles seconds input
  toi_per_game: (value: number) => formatTOIFromSeconds(value),

  // Power play time on ice (also in seconds)
  pp_toi_per_game: (value: number) => formatTOIFromSeconds(value),

  // General time formatter for any TOI fields
  time_on_ice: (value: number) => formatTOIFromSeconds(value),

  // Per 60 stats (1 decimal place)
  ixg_per_60: (value: number) => (value || 0).toFixed(1),
  icf_per_60: (value: number) => (value || 0).toFixed(1),
  iff_per_60: (value: number) => (value || 0).toFixed(1),
  iscfs_per_60: (value: number) => (value || 0).toFixed(1),
  hdcf_per_60: (value: number) => (value || 0).toFixed(1),
  shots_per_60: (value: number) => (value || 0).toFixed(1),
  goals_per_60: (value: number) => (value || 0).toFixed(1),
  total_assists_per_60: (value: number) => (value || 0).toFixed(1),
  total_points_per_60: (value: number) => (value || 0).toFixed(1),
  rush_attempts_per_60: (value: number) => (value || 0).toFixed(1),
  rebounds_created_per_60: (value: number) => (value || 0).toFixed(1),

  // NST Advanced Stats - Defensive Per 60
  hdca_per_60: (value: number) => (value || 0).toFixed(1),
  sca_per_60: (value: number) => (value || 0).toFixed(1),
  shots_blocked_per_60: (value: number) => (value || 0).toFixed(1),
  xga_per_60: (value: number) => (value || 0).toFixed(1),
  ga_per_60: (value: number) => (value || 0).toFixed(1),

  // NST Advanced Stats - Discipline Per 60
  pim_per_60: (value: number) => (value || 0).toFixed(1),
  total_penalties_per_60: (value: number) => (value || 0).toFixed(1),
  penalties_drawn_per_60: (value: number) => (value || 0).toFixed(1),
  giveaways_per_60: (value: number) => (value || 0).toFixed(1),
  takeaways_per_60: (value: number) => (value || 0).toFixed(1),
  hits_per_60: (value: number) => (value || 0).toFixed(1),

  // Legacy stats
  individual_sat_for_per_60: (value: number) => (value || 0).toFixed(1),
  blocks_per_60: (value: number) => (value || 0).toFixed(1),

  // Default integer formatting
  default: (value: number) => Math.round(value || 0).toString()
} as const;

// Comprehensive stat display names
export const STAT_DISPLAY_NAMES: { [key: string]: string } = {
  // Basic Stats
  date: "Date",
  games_played: "GP",
  points: "P",
  goals: "G",
  assists: "A",
  shots: "SOG",
  shooting_percentage: "SH%",
  plus_minus: "+/-",
  pp_points: "PPP",
  fow_percentage: "FO%",
  toi_per_game: "TOI",
  pp_toi_per_game: "PPTOI",
  hits: "HIT",
  blocked_shots: "BLK",
  takeaways: "TK",
  giveaways: "GV",
  sat_pct: "CF%",
  zone_start_pct: "ZS%",

  // Goalie stats
  wins: "W",
  losses: "L",
  ot_losses: "OTL",
  save_pct: "SV%",
  saves: "SV",
  goals_against: "GA",
  goals_against_avg: "GAA",
  shots_against: "SA",
  shutouts: "SO",
  time_on_ice: "TOI",
  quality_start: "QS",

  // NST Advanced Stats - Possession Metrics
  cf_pct: "CF%",
  ff_pct: "FF%",
  sf_pct: "SF%",
  gf_pct: "GF%",
  xgf_pct: "xGF%",
  scf_pct: "SCF%",
  hdcf_pct: "HDCF%",
  mdcf_pct: "MDCF%",
  ldcf_pct: "LDCF%",

  // NST Advanced Stats - Individual Per 60
  ixg_per_60: "ixG/60",
  icf_per_60: "iCF/60",
  iff_per_60: "iFF/60",
  iscfs_per_60: "iSCF/60",
  hdcf_per_60: "HDCF/60",
  shots_per_60: "SOG/60",
  goals_per_60: "G/60",
  total_assists_per_60: "A/60",
  total_points_per_60: "P/60",
  rush_attempts_per_60: "Rush/60",
  rebounds_created_per_60: "Reb/60",

  // NST Advanced Stats - Defensive Per 60
  hdca_per_60: "HDCA/60",
  sca_per_60: "SCA/60",
  shots_blocked_per_60: "BLK/60",
  xga_per_60: "xGA/60",
  ga_per_60: "GA/60",

  // NST Advanced Stats - Zone Usage
  off_zone_start_pct: "OZS%",
  def_zone_start_pct: "DZS%",
  neu_zone_start_pct: "NZS%",
  off_zone_faceoff_pct: "OZFO%",

  // NST Advanced Stats - On-Ice Impact
  on_ice_sh_pct: "oiSH%",
  on_ice_sv_pct: "oiSV%",
  pdo: "PDO",

  // NST Advanced Stats - Discipline Per 60
  pim_per_60: "PIM/60",
  total_penalties_per_60: "Pen/60",
  penalties_drawn_per_60: "PenD/60",
  giveaways_per_60: "GV/60",
  takeaways_per_60: "TK/60",
  hits_per_60: "HIT/60",

  // Legacy advanced stats
  individual_sat_for_per_60: "iSF/60",
  on_ice_shooting_pct: "oiSH%",
  sat_relative: "CF% Rel",
  usat_pct: "uCF%",
  goals_saved_above_average: "GSAA",
  high_danger_save_pct: "HDSV%",
  medium_danger_save_pct: "MDSV%",
  gw_goals: "GWG",
  games_started: "GS"
} as const;

// Helper function to format stat values
export const formatStatValue = (value: any, stat: string): string => {
  if (value === null || value === undefined) return "-";

  const numValue = Number(value);
  if (isNaN(numValue)) return "-";

  const formatter = STAT_FORMATTERS[stat as keyof typeof STAT_FORMATTERS];
  if (formatter) {
    return formatter(numValue);
  }
  return STAT_FORMATTERS.default(numValue);
};

// Categories for percentage stats (used in calculations)
export const PERCENTAGE_STATS = [
  "shooting_percentage",
  "save_pct",
  "fow_percentage",
  "sat_pct",
  "zone_start_pct",
  "cf_pct",
  "ff_pct",
  "sf_pct",
  "gf_pct",
  "xgf_pct",
  "scf_pct",
  "hdcf_pct",
  "mdcf_pct",
  "ldcf_pct",
  "off_zone_start_pct",
  "def_zone_start_pct",
  "neu_zone_start_pct",
  "off_zone_faceoff_pct",
  "on_ice_sh_pct",
  "on_ice_sv_pct",
  "pdo",
  "on_ice_shooting_pct",
  "usat_pct"
] as const;

export const PER_GAME_STATS = [
  "goals_against_avg",
  "toi_per_game",
  "pp_toi_per_game",
  "time_on_ice"
] as const;

export const PER_60_STATS = [
  "ixg_per_60",
  "icf_per_60",
  "iff_per_60",
  "iscfs_per_60",
  "hdcf_per_60",
  "shots_per_60",
  "goals_per_60",
  "total_assists_per_60",
  "total_points_per_60",
  "rush_attempts_per_60",
  "rebounds_created_per_60",
  "hdca_per_60",
  "sca_per_60",
  "shots_blocked_per_60",
  "xga_per_60",
  "ga_per_60",
  "pim_per_60",
  "total_penalties_per_60",
  "penalties_drawn_per_60",
  "giveaways_per_60",
  "takeaways_per_60",
  "hits_per_60",
  "individual_sat_for_per_60",
  "blocks_per_60"
] as const;

// Additional types that were missing
export interface CalendarDay {
  date: Date;
  dayOfWeek: number;
  monthOfYear: number;
  isOtherMonth: boolean;
  games: GameLogEntry[];
  performance?: "excellent" | "good" | "average" | "poor";
  missedGame?: boolean;
}

export interface CalendarTooltipData {
  date: string;
  games: GameLogEntry[];
  performance?: string;
  missedGame?: boolean;
}

export interface PerformanceLevel {
  level: number;
  className: string;
  label: string;
}

// Time frame options
export type TimeFrame = "season" | "last10" | "last20" | "last30" | "custom";

// Tab options
export type StatsTab =
  | "overview"
  | "advanced"
  | "trends"
  | "calendar"
  | "gamelog";

// Export utility function types
export type StatFormatter = (value: number) => string;
export type PercentileCalculator = (value: number, thresholds: any) => number;
