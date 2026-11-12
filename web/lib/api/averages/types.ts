// Shared averages API types.

/**
 * The one scale contract both legacy routes serve (W3-3 D3/A2, TJ 2026-11-12:
 * every share on 0-100 points). Readers can tell v2 output from the earlier
 * mixed-scale output by `scaleContract.version`.
 */
export const AVERAGES_SCALE_CONTRACT = {
  version: "legacy-averages-v2",
  toi: "seconds (NST decimal minutes x 60)",
  perSixty:
    "count x 3600 / TOI seconds; traded-season (TOT) and multi-season rates pooled by TOI",
  shares:
    "percentage points 0-100, pooled from components (numerator / denominator); xS% = ixG / iFF (decision 17)",
  counts: "season rows: sums; averages: mean per season",
  seasons:
    "completed regular seasons before the season in progress; three-year = the newest three",
  unknown: "null for an unknown cell or a zero denominator"
} as const;

export type AveragesScaleContract = typeof AVERAGES_SCALE_CONTRACT;

export type Data = {
  // Counting Stats
  IPP: number | null;
  "S%": number | null;
  "xS%": number | null;
  "SOG/60": number | null;
  "oZS%": number | null;
  "oiSH%": number | null;
  "secA%": number | null;
  iHDCF: number | null;
  iSCF: number | null;
  ixG: number | null;
  goals: number | null;
  GP: number | null;
  A1: number | null;
  A2: number | null;
  SOG: number | null;
  PIM: number | null;
  HIT: number | null;
  BLK: number | null;
  iCF: number | null;
  CF: number | null;
  iFF: number | null;

  // New Counting Stats
  toi: number | null;
  GF: number | null;
  GA: number | null;
  "GF%": number | null;
  SCF: number | null;
  SCA: number | null;
  "SCF%": number | null;
  oiGF: number | null;
  assists: number | null;
  CA: number | null;
  "CF%": number | null;
  FF: number | null;
  FA: number | null;
  "FF%": number | null;
  SF: number | null;
  SA: number | null;
  "SF%": number | null;
  xGF: number | null;
  xGA: number | null;
  "xGF%": number | null;
  HDCF: number | null;
  HDGF: number | null;
  MDCF: number | null;
  MDGF: number | null;
  LDCF: number | null;
  LDGF: number | null;
  oZS: number | null;
  dZS: number | null;
};

export type RatesData = {
  "CF/60": number | null;
  "CA/60": number | null;
  "CF%": number | null;
  "iSCF/60": number | null;
  "PTS/60": number | null;
  "SOG/60": number | null;
  "A/60": number | null;
  "G/60": number | null;
  "GF/60": number | null;
  "GA/60": number | null;
  "GF%": number | null;
  "A1/60": number | null;
  "A2/60": number | null;
  "SF/60": number | null;
  "SA/60": number | null;
  "SF%": number | null;
  "SCF/60": number | null;
  "SCA/60": number | null;
  "SCF%": number | null;
  "iCF/60": number | null;
  "iFF/60": number | null;
  "FF/60": number | null;
  "FA/60": number | null;
  "FF%": number | null;
  "ixG/60": number | null;
  "xGF/60": number | null;
  "xGA/60": number | null;
  "xGF%": number | null;
  "HDCF/60": number | null;
  "HDGF/60": number | null;
  "MDCF/60": number | null;
  "MDGF/60": number | null;
  "LDCF/60": number | null;
  "LDGF/60": number | null;
  "PIM/60": number | null;
  "HIT/60": number | null;
  "BLK/60": number | null;
};

export interface YearlyCount {
  season: number;
  team: string;
  TOI: number | null;
  GF: number | null;
  GA: number | null;
  "GF%": number | null;
  "S%": number | null;
  "oiSH%": number | null;
  "secA%": number | null;
  iHDCF: number | null;
  goals: number | null;
  "SOG/60": number | null;
  IPP: number | null;
  "oZS%": number | null;
  GP: number | null;
  oiGF: number | null;
  assists: number | null;
  A1: number | null;
  A2: number | null;
  SOG: number | null;
  PIM: number | null;
  HIT: number | null;
  BLK: number | null;
  iCF: number | null;
  CF: number | null;
  CA: number | null;
  "CF%": number | null;
  iFF: number | null;
  FF: number | null;
  FA: number | null;
  "FF%": number | null;
  SF: number | null;
  SA: number | null;
  "SF%": number | null;
  ixG: number | null;
  xGF: number | null;
  xGA: number | null;
  "xGF%": number | null;
  iSCF: number | null;
  HDCF: number | null;
  HDGF: number | null;
  MDCF: number | null;
  MDGF: number | null;
  LDCF: number | null;
  LDGF: number | null;
  oZS: number | null;
  dZS: number | null;
  SCF: number | null; // Added to match usage
  SCA: number | null; // Added to match usage
  "SCF%": number | null; // Added to match usage
}

export interface YearlyCounts {
  counts: YearlyCount[];
}

export interface YearlyRate {
  season: number;
  team: string;
  TOI: number | null;
  "CF/60": number | null;
  "CA/60": number | null;
  "CF%": number | null;
  "iSCF/60": number | null;
  "PTS/60": number | null;
  "SOG/60": number | null;
  "A/60": number | null;
  "G/60": number | null;
  "GF/60": number | null;
  "GA/60": number | null;
  "GF%": number | null;
  "A1/60": number | null;
  "A2/60": number | null;
  "SF/60": number | null;
  "SA/60": number | null;
  "SF%": number | null;
  "SCF/60": number | null;
  "SCA/60": number | null;
  "SCF%": number | null;
  "iCF/60": number | null;
  "iFF/60": number | null;
  "FF/60": number | null;
  "FA/60": number | null;
  "FF%": number | null;
  "ixG/60": number | null;
  "xGF/60": number | null;
  "xGA/60": number | null;
  "xGF%": number | null;
  "HDCF/60": number | null;
  "HDGF/60": number | null;
  "MDCF/60": number | null;
  "MDGF/60": number | null;
  "LDCF/60": number | null;
  "LDGF/60": number | null;
  "PIM/60": number | null;
  "HIT/60": number | null;
  "BLK/60": number | null;
}

export interface YearlyRates {
  rates: YearlyRate[];
}

export type Response = {
  message: string;
  success: boolean;
  scaleContract?: AveragesScaleContract;
  yearlyCounts?: YearlyCounts;
  threeYearCountsAverages?: Data;
  careerAverageCounts?: Data;
  yearlyRates?: YearlyRates;
  threeYearRatesAverages?: RatesData;
  careerAverageRates?: RatesData;
};
