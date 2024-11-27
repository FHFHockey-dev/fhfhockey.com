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
  CA: number; // Current Average (placeholder)
  threeYA: number; // Three-Year Average
  LY: number; // Last Year
  L5: number; // Last 5 Games
  L10: number; // Last 10 Games
  L20: number; // Last 20 Games
  STD: number; // Season To Date
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
  ppp: number; // Power Play Points
  hits: number; // Hits
  blocked_shots: number; // Blocked Shots
  penalty_minutes: number; // Penalty Minutes
  ixG: number; // Ice Faceoffs
  toi_per_game: number; // Time on Ice in seconds
  pp_toi_per_game: number; // Power Play Time on Ice in seconds
  toi: number; // Total Time on Ice in seconds
  pp_toi_pct_per_game: number; // Power Play Time on Ice Percentage
  // hdcf: number;
  // scf: number;
}

export interface PlayerStats {
  counts: TableAggregateData[];
  rates: TableAggregateData[];
}

// New interfaces based on ThreeYearAverages API response

// Yearly Counts and Rates
export interface YearlyCount {
  season: number;
  team: string;
  TOI: number;
  GF: number;
  GA: number;
  "GF%": number;
  SCF: number;
  SCA: number;
  "SCF%": number;
  "S%": number;
  "oiSH%": number;
  "secA%": number;
  iHDCF: number;
  goals: number;
  SOG: number;
  "SOG/60": number;
  IPP: number;
  "oZS%": number;
  GP: number;
  oiGF: number;
  assists: number;
  A1: number;
  A2: number;
  PIM: number;
  HIT: number;
  BLK: number;
  iCF: number;
  CF: number;
  CA: number;
  FF: number;
  FA: number;
  SF: number;
  SA: number;
  xGF: number;
  xGA: number;
  "CF%": number;
  "FF%": number;
  "SF%": number;
  ixG: number;
  "xGF%": number;
  iSCF: number;
  HDCF: number;
  HDGF: number;
  MDCF: number;
  MDGF: number;
  LDCF: number;
  LDGF: number;
  oZS: number;
  dZS: number;
}

export interface YearlyRate {
  season: number;
  team: string;
  TOI: number;
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

// **New Interface**: CombinedPlayerStats
export interface CombinedPlayerStats extends PlayerStats {
  threeYearCountsAverages: ThreeYearCountsAverages;
  threeYearRatesAverages: ThreeYearRatesAverages;
  careerAverageCounts: CareerAverageCounts;
  careerAverageRates: CareerAverageRates;
}
