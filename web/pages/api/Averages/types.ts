// /Users/tim/Desktop/FHFH/fhfhockey.com/web/pages/api/Averages/types.ts

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
  TOI: number;
  GF: number;
  GA: number;
  "GF%": number;
  "S%": number;
  "oiSH%": number;
  "secA%": number;
  iHDCF: number;
  goals: number;
  "SOG/60": number;
  IPP: number;
  "oZS%": number;
  GP: number;
  oiGF: number;
  assists: number;
  A1: number;
  A2: number;
  SOG: number;
  PIM: number;
  HIT: number;
  BLK: number;
  iCF: number;
  CF: number;
  CA: number;
  "CF%": number;
  iFF: number;
  FF: number;
  FA: number;
  "FF%": number;
  SF: number;
  SA: number;
  "SF%": number;
  ixG: number;
  xGF: number;
  xGA: number;
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
  SCF: number; // Added to match usage
  SCA: number; // Added to match usage
  "SCF%": number; // Added to match usage
}

export interface YearlyCounts {
  counts: YearlyCount[];
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
  "A1/60": number;
  "A2/60": number;
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
}

export interface YearlyRates {
  rates: YearlyRate[];
}

export type Response = {
  message: string;
  success: boolean;
  yearlyCounts?: YearlyCounts;
  threeYearCountsAverages?: Data;
  careerAverageCounts?: Data;
  yearlyRates?: YearlyRates;
  threeYearRatesAverages?: RatesData;
  careerAverageRates?: RatesData;
};
