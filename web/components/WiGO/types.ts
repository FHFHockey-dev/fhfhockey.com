// web/components/WiGO/types.ts

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
  jerseyColor: "#FFFFFF",
};

// Define interfaces for aggregated data and skater stats
export interface TableAggregateData {
  label: string; // "Games Played", "Goals", "Assists", etc.
  LY: number; // Last Year
  L5: number; // Last 5 Games
  L10: number; // Last 10 Games
  L15: number; // Last 15 Games
  L20: number; // Last 20 Games
  STD: number; // Season To Date
}

export interface SkaterStat {
  player_id: number;
  date: string; // ISO date string
  season_id: number;
  goals: number;
  assists: number;
  sog: number; // Shots on Goal
  ppa: number; // Power Play Attempts
  ppg: number; // Power Play Goals
  ppp: number; // Power Play Points
  hit: number;
  blk: number; // Blocks
  pim: number; // Penalty Minutes
  ixf: number; // Ice Faceoffs
  hdcf: number; // High-Danger Corsi For
  scf: number; // Scoring Corsi For
  toi_per_game: number; // Time on Ice in seconds
}

/**
 * Interface to hold both counts and rates data.
 */
export interface PlayerStats {
  counts: TableAggregateData[];
  rates: TableAggregateData[];
}
