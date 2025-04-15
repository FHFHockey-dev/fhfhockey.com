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
  label: string; // "Games Played", "Goals", "Assists", etc.
  CA: number; // Current Average
  "3YA": number; // Three-Year Average
  LY: number; // Last Year
  L5: number; // Last 5 Games
  L10: number; // Last 10 Games
  L20: number; // Last 20 Games
  STD: number; // Season To Date
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
