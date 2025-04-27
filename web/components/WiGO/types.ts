// web/components/WiGO/types.ts

// Existing interfaces
export interface Player {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  position: "L" | "R" | "G" | "D" | "C";
  birthDate: string;
  birthCity: string | null;
  birthCountry: string | null;
  heightInCentimeters: number;
  weightInKilograms: number;
  team_id?: number | null;
  sweater_number?: number;
  image_url?: string;
}

export interface TeamColors {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  altColor: string;
  jerseyColor: string;
}

export const defaultColors: TeamColors = {
  primaryColor: "#000000",
  secondaryColor: "#FFFFFF",
  accentColor: "#FF0000",
  altColor: "#FFFFFF",
  jerseyColor: "#FFFFFF"
};

// Existing table aggregate interfaces
export interface TableAggregateData {
  label: string;
  // Add GP fields potentially nested or separate
  GP?: {
    STD?: number | null;
    LY?: number | null;
    "3YA"?: number | null; // Note: 3YA/CA GP from script are averages, use relevant _gp field
    CA?: number | null;
    L5?: number | null;
    L10?: number | null;
    L20?: number | null;
  } | null;
  // Existing value fields
  STD?: number | null;
  LY?: number | null;
  "3YA"?: number | null;
  CA?: number | null;
  L5?: number | null;
  L10?: number | null;
  L20?: number | null;
  DIFF?: number;
}

export interface SkaterStat {
  player_id: number;
  date: string; // ISO date string
  season_id: number;
  goals: number;
  assists: number;
  shots: number; // Shots on Goal
  pp_assists: number; // Power Play Assists
  pp_goals: number; // Power Play Goals
  hits: number; // Hits
  blocked_shots: number; // Blocked Shots
  penalty_minutes: number; // Penalty Minutes
  toi_per_game: number; // Time on Ice in seconds (per game average?)
  pp_toi_per_game: number; // Power Play Time on Ice in seconds
  pp_toi_pct_per_game: number; // Power Play Time on Ice Percentage

  // Add any OTHER columns actually present in wgo_skater_stats if needed
  [key: string]: any; // Add index signature if other unknown columns are selected with '*'
}

export interface PlayerStats {
  counts: TableAggregateData[];
  rates: TableAggregateData[];
}

export interface YearlyCount {
  season: number;
  team: string;
  SOG: number; // Shots on Goal
  TOI: number; // Time on Ice in seconds or appropriate unit
  SF: number; // Shots For
  SA: number; // Shots Against
  "SF%": number; // Shots For Percentage
  GF: number; // Goals For
  GA: number; // Goals Against
  "GF%": number; // Goals For Percentage
  SCF: number; // Shot Counts For
  SCA: number; // Shot Counts Against
  "SCF%": number; // Shot Counts For Percentage
  "S%": number; // Possibly some percentage stat
  "oiSH%": number; // On-Ice Shot Percentage
  "secA%": number; // Secondary Assist Percentage
  iHDCF: number; // Individual High-Damaging Cross Face Checks
  goals: number;
  "SOG/60": number;
  IPP: number; // Ice Penalty Percentage or similar
  "oZS%": number; // Offensive Zone Starts Percentage
  GP: number; // Games Played
  oiGF: number; // On-Ice Goals For
  assists: number;
  A1: number; // Primary Assists
  A2: number; // Secondary Assists
  PIM: number; // Penalty Minutes
  HIT: number; // Hits
  BLK: number; // Blocked Shots
  iCF: number; // Individual Corsi For
  CF: number; // Corsi For
  CA: number; // Corsi Against
  "CF%": number; // Corsi For Percentage
  iFF: number; // Individual Fenwick For
  FF: number; // Fenwick For
  FA: number; // Fenwick Against
  "FF%": number; // Fenwick For Percentage
  ixG: number; // Expected Goals
  xGF: number; // Expected Goals For
  xGA: number; // Expected Goals Against
  "xGF%": number; // Expected Goals For Percentage
  iSCF: number; // Individual Shot Counts For
  HDCF: number; // High-Damaging Cross Face Checks
  HDGF: number; // High-Damaging Goals For
  MDCF: number; // Medium-Damaging Cross Face Checks
  MDGF: number; // Medium-Damaging Goals For
  LDCF: number; // Low-Damaging Cross Face Checks
  LDGF: number; // Low-Damaging Goals For
  oZS: number; // Offensive Zone Starts
  dZS: number; // Defensive Zone Starts

  // Power Play Stats
  pp_assists?: number;
  pp_goals?: number;
  ppp?: number;

  // Additional Stats
  shots?: number;
  blocked_shots?: number;
  penalty_minutes?: number;
  toi_per_game?: number;
  pp_toi_per_game?: number;
  pp_toi_pct_per_game?: number;
}

// components/WiGO/types.ts

export interface YearlyRate {
  season: number;
  team: string;
  TOI: number;
  "CF/60": number;
  "CA/60": number;
  "CF%": number;
  "iSCF/60": number;
  "PTS/60": number;
  "G/60": number;
  "GF/60": number;
  "GA/60": number;
  "GF%": number;
  "A/60": number;
  "A1/60": number;
  "A2/60": number;
  "SOG/60": number;
  "SF/60": number;
  "SA/60": number;
  "SF%": number;
  "SCF/60": number;
  "SCA/60": number;
  "SCF%": number;
  "iCF/60": number;
  "iFF/60": number;
  "FF/60": number;
  "FA/60": number;
  "FF%": number;
  "ixG/60": number;
  "xGF/60": number;
  "xGA/60": number;
  "xGF%": number;
  "HDCF/60": number;
  "HDGF/60": number;
  "MDCF/60": number;
  "MDGF/60": number;
  "LDCF/60": number;
  "LDGF/60": number;
  "PIM/60": number;
  "HIT/60": number;
  "BLK/60": number;
  "PPA/60": number;
  "PPG/60": number;
  "PPP/60": number;
  [key: string]: number | string | undefined;
}

export interface ThreeYearCountsAverages {
  toi: number;
  iHDCF: number;
  iSCF: number;
  ixG: number;
  oiGF: number;
  goals: number;
  assists: number;
  GP?: number; // Made optional
  A1: number;
  A2: number;
  SOG: number;
  PIM: number;
  HIT: number;
  BLK: number;
  iCF: number;
  iFF: number;
  GF: number;
  GA: number;
  SCF: number;
  SCA: number;
  CF: number;
  CA: number;
  FF: number;
  FA: number;
  SF: number;
  SA: number;
  xGF: number;
  xGA: number;
  HDCF: number;
  HDGF: number;
  MDCF: number;
  MDGF: number;
  LDCF: number;
  LDGF: number;
  "CF%": number;
  "FF%": number;
  "SF%": number;
  "GF%": number;
  "xGF%": number;
  "SCF%": number;
  IPP: number;
  "S%": number;
  "xS%": number;
  "SOG/60": number;
  "oZS%": number;
  "oiSH%": number;
  "secA%": number;
}

export interface ThreeYearRatesAverages {
  "CF/60": number;
  "CA/60": number;
  "CF%": number;
  "iSCF/60": number;
  "PTS/60": number;
  "SOG/60": number;
  "A/60": number;
  "G/60": number;
  "GF/60": number;
  "GA/60": number;
  "GF%": number;
  "SF/60": number;
  "SA/60": number;
  "SF%": number;
  "A1/60": number;
  "A2/60": number;
  "SCF/60": number;
  "SCA/60": number;
  "SCF%": number;
  "iCF/60": number;
  "iFF/60": number;
  "FF/60": number;
  "FA/60": number;
  "ixG/60": number;
  "xGF/60": number;
  "xGA/60": number;
  "xGF%": number;
  "HDCF/60": number;
  "HDGF/60": number;
  "MDCF/60": number;
  "MDGF/60": number;
  "LDCF/60": number;
  "LDGF/60": number;
  "PIM/60": number;
  "HIT/60": number;
  "BLK/60": number;
  "PPP/60": number;
}

export interface CareerAverageCounts {
  toi: number;
  iHDCF: number;
  iSCF: number;
  ixG: number;
  oiGF: number;
  goals: number;
  assists: number;
  GP?: number; // Made optional
  A1: number;
  A2: number;
  SOG: number;
  PIM: number;
  HIT: number;
  BLK: number;
  iCF: number;
  iFF: number;
  GF: number;
  GA: number;
  SCF: number;
  SCA: number;
  CF: number;
  CA: number;
  FF: number;
  FA: number;
  SF: number;
  SA: number;
  xGF: number;
  xGA: number;
  HDCF: number;
  HDGF: number;
  MDCF: number;
  MDGF: number;
  LDCF: number;
  LDGF: number;
  "CF%": number;
  "FF%": number;
  "SF%": number;
  "GF%": number;
  "xGF%": number;
  "SCF%": number;
  IPP: number;
  "S%": number;
  "xS%": number;
  "SOG/60": number;
  "oZS%": number;
  "oiSH%": number;
  "secA%": number;
}

export interface CareerAverageRates {
  "CF/60": number;
  "CA/60": number;
  "CF%": number;
  "iSCF/60": number;
  "PTS/60": number;
  "SOG/60": number;
  "A/60": number;
  "G/60": number;
  "GF/60": number;
  "GA/60": number;
  "GF%": number;
  "SF/60": number;
  "SA/60": number;
  "SF%": number;
  "A1/60": number;
  "A2/60": number;
  "SCF/60": number;
  "SCA/60": number;
  "SCF%": number;
  "iCF/60": number;
  "iFF/60": number;
  "FF/60": number;
  "FA/60": number;
  "ixG/60": number;
  "xGF/60": number;
  "xGA/60": number;
  "xGF%": number;
  "HDCF/60": number;
  "HDGF/60": number;
  "MDCF/60": number;
  "MDGF/60": number;
  "LDCF/60": number;
  "LDGF/60": number;
  "PIM/60": number;
  "HIT/60": number;
  "BLK/60": number;
  "PPP/60": number;
}

export interface ThreeYearAveragesResponse {
  success: boolean;
  message: string;
  yearlyCounts: {
    counts: YearlyCount[];
  };
  threeYearCountsAverages: ThreeYearCountsAverages;
  yearlyRates: {
    rates: YearlyRate[];
  };
  threeYearRatesAverages: ThreeYearRatesAverages;
  careerAverageCounts: CareerAverageCounts;
  careerAverageRates: CareerAverageRates;
}

export interface CombinedPlayerStats {
  counts: TableAggregateData[];
  rates: TableAggregateData[];
}

// PERCENTILE RANKS

export type PercentileStrength = "as" | "es" | "pp" | "pk";

// Use Database type helper for table names if possible, otherwise define manually
// (These types might primarily be useful within the fetch function itself)
export type NSTRatesTable = `nst_gamelog_${PercentileStrength}_rates`;
export type NSTRatesOiTable = `nst_gamelog_${PercentileStrength}_rates_oi`;

export type OffensePercentileTable =
  | "nst_percentile_as_offense"
  | "nst_percentile_es_offense"
  | "nst_percentile_pp_offense"
  | "nst_percentile_pk_offense";

export type DefensePercentileTable =
  | "nst_percentile_as_defense"
  | "nst_percentile_es_defense"
  | "nst_percentile_pp_defense"
  | "nst_percentile_pk_defense";

// Interface for RAW player stats fetched from DB
/**
 * Represents the COMBINED raw stats for a player for a specific strength,
 * potentially merging data from _rates and _rates_oi tables.
 * Ensure all keys needed for OFFENSE_RATING_STATS, DEFENSE_RATING_STATS,
 * and HIGHER_IS_BETTER_MAP are included here.
 * Also includes 'toi' (total seconds) and 'gp'.
 */
/**
 * Defines the structure for raw player statistics fetched and merged
 * from nst_gamelog_[strength]_rates and nst_gamelog_[strength]_rates_oi.
 * This is the primary type used for percentile and rating calculations.
 * All potentially used stats should be listed here as optional.
 * 'toi' MUST represent total seconds played in that strength for the season.
 */
// web/components/WiGO/types.ts (Excerpt - replace previous PlayerRawStats)
export interface PlayerRawStats {
  player_id: number;
  season: number | null;
  gp: number | null;
  toi_seconds: number | null; // Use toi_seconds

  // Combined Available Offense Stats (Optional)
  goals_per_60?: number | null;
  total_assists_per_60?: number | null;
  first_assists_per_60?: number | null;
  second_assists_per_60?: number | null;
  total_points_per_60?: number | null;
  shots_per_60?: number | null;
  ixg_per_60?: number | null;
  icf_per_60?: number | null;
  iff_per_60?: number | null;
  iscfs_per_60?: number | null;
  i_hdcf_per_60?: number | null; // From offense table schema
  rush_attempts_per_60?: number | null;
  rebounds_created_per_60?: number | null;
  cf_per_60?: number | null;
  ff_per_60?: number | null;
  sf_per_60?: number | null;
  gf_per_60?: number | null;
  xgf_per_60?: number | null;
  scf_per_60?: number | null;
  oi_hdcf_per_60?: number | null; // From offense table schema
  hdgf_per_60?: number | null;
  mdgf_per_60?: number | null;
  ldgf_per_60?: number | null;
  cf_pct?: number | null;
  ff_pct?: number | null;
  sf_pct?: number | null;
  gf_pct?: number | null;
  xgf_pct?: number | null;
  scf_pct?: number | null;
  hdcf_pct?: number | null;
  hdgf_pct?: number | null;
  mdgf_pct?: number | null;
  ldgf_pct?: number | null;
  ipp?: number | null;
  sh_percentage?: number | null;
  on_ice_sh_pct?: number | null;
  penalties_drawn_per_60?: number | null;

  // Combined Available Defense Stats (Optional)
  ca_per_60?: number | null;
  fa_per_60?: number | null;
  sa_per_60?: number | null;
  ga_per_60?: number | null;
  xga_per_60?: number | null;
  sca_per_60?: number | null;
  hdca_per_60?: number | null;
  hdga_per_60?: number | null;
  mdga_per_60?: number | null;
  ldga_per_60?: number | null;
  shots_blocked_per_60?: number | null;
  takeaways_per_60?: number | null;
  hits_per_60?: number | null; // Note: Also in defense schema
  pim_per_60?: number | null;
  total_penalties_per_60?: number | null;
  minor_penalties_per_60?: number | null;
  major_penalties_per_60?: number | null;
  misconduct_penalties_per_60?: number | null;
  giveaways_per_60?: number | null;
  on_ice_sv_pct?: number | null;

  // Allow indexing for constants
  [key: string]: number | string | null | undefined;
}

// web/components/WiGO/types.ts (Refactored/New Types)

// Represents the raw stats fetched for ONE strength from ONE table (offense or defense)
// Based on the provided Supabase table schemas
export interface PlayerStrengthStats {
  player_id: number;
  season: number;
  gp: number; // Games played AT THIS STRENGTH
  toi_seconds: number; // TOI AT THIS STRENGTH

  // Offensive Stats (from offense tables) - Optional because they won't exist in defense data
  goals_per_60?: number | null;
  total_assists_per_60?: number | null;
  first_assists_per_60?: number | null;
  second_assists_per_60?: number | null;
  total_points_per_60?: number | null;
  shots_per_60?: number | null;
  ixg_per_60?: number | null;
  icf_per_60?: number | null;
  iff_per_60?: number | null;
  iscfs_per_60?: number | null;
  i_hdcf_per_60?: number | null;
  rush_attempts_per_60?: number | null;
  rebounds_created_per_60?: number | null;
  cf_per_60?: number | null;
  ff_per_60?: number | null;
  sf_per_60?: number | null;
  gf_per_60?: number | null;
  xgf_per_60?: number | null;
  scf_per_60?: number | null;
  oi_hdcf_per_60?: number | null;
  hdgf_per_60?: number | null;
  mdgf_per_60?: number | null;
  ldgf_per_60?: number | null;
  cf_pct?: number | null;
  ff_pct?: number | null;
  sf_pct?: number | null;
  gf_pct?: number | null;
  xgf_pct?: number | null;
  scf_pct?: number | null;
  hdcf_pct?: number | null;
  hdgf_pct?: number | null;
  mdgf_pct?: number | null;
  ldgf_pct?: number | null;
  ipp?: number | null;
  sh_percentage?: number | null;
  on_ice_sh_pct?: number | null;
  penalties_drawn_per_60?: number | null;

  // Defensive Stats (from defense tables) - Optional
  ca_per_60?: number | null;
  fa_per_60?: number | null;
  sa_per_60?: number | null;
  ga_per_60?: number | null;
  xga_per_60?: number | null;
  sca_per_60?: number | null;
  hdca_per_60?: number | null;
  hdga_per_60?: number | null;
  mdga_per_60?: number | null;
  ldga_per_60?: number | null;
  shots_blocked_per_60?: number | null;
  takeaways_per_60?: number | null;
  hits_per_60?: number | null;
  pim_per_60?: number | null;
  total_penalties_per_60?: number | null;
  minor_penalties_per_60?: number | null;
  major_penalties_per_60?: number | null;
  misconduct_penalties_per_60?: number | null;
  giveaways_per_60?: number | null;
  on_ice_sv_pct?: number | null;

  // Allow flexible access using string keys (used by calculation logic)
  [key: string]: number | string | null | undefined;
}

// Structure to hold all fetched raw stats, organized by strength
export type Strength = "as" | "es" | "pp" | "pk";
export type RawStatsCollection = {
  [key in Strength]?: {
    offense: PlayerStrengthStats[];
    defense: PlayerStrengthStats[];
  };
};

// Structure for the final calculated ratings
export interface CalculatedPlayerRatings {
  offense: {
    as: number | null;
    es: number | null;
    pp: number | null;
    // pk offense rating might not be meaningful, can omit if desired
    pk: number | null;
  };
  defense: {
    as: number | null;
    es: number | null;
    // pp defense rating might not be meaningful
    pp: number | null;
    pk: number | null;
  };
  overall: {
    // We can recalculate these easily from the offense/defense ratings
    as: number | null;
    es: number | null;
    st: number | null; // Special Teams (weighted PP Offense + PK Defense)
    final: number | null; // Overall combined rating
  };
  // Include raw data or intermediate steps for debugging if needed
  _debug?: {
    percentiles?: any; // Store calculated percentiles before weighting/regression
    regressedPercentiles?: any; // Store percentiles after regression
  };
}

// Type for the weighting configuration
export type StatWeight = {
  stat: keyof PlayerStrengthStats; // The column name from the database/interface
  weight: number; // The importance factor
  higherIsBetter: boolean; // Needed for percentile calculation
};

export type RatingWeightsConfig = {
  [key in Strength]?: {
    offense: StatWeight[];
    defense: StatWeight[];
  };
};

// Configuration for small sample size regression
export interface RegressionConfig {
  minGPThreshold: number; // e.g., 10 games played *at that strength*
  enabled: boolean; // Toggle regression on/off
}
