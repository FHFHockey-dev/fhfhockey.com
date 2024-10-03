// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\lib\NHL\teamPageTypes.ts

export interface TeamInfo {
  name: string;
  abbrev: string;
  shortName: string;
  location: string;
  primaryColor: string;
  secondaryColor: string;
  jersey: string;
  accent: string;
  alt: string;
  franchiseId: number;
  id: number;
}

export interface SoS {
  team: string;
  sos: number;
}

export interface GoalieStat {
  goalieId: number;
  goalieFullName: string;
  lastName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses: number;
  shotsAgainst: number;
  goalsAgainst: number;
  savePercentage: number;
  shutouts: number;
  goalsAgainstAverage: number;
  percentage: number;
}

export interface GoalieStats {
  totalGames: number;
  goalies: GoalieStat[];
}

export interface TeamPowerRanking {
  id: number;
  abbreviation: string;
  name: string;
  lastTenGames: {
    lastTenGames: TeamStats[];
  }[];
  [key: string]: any; // For dynamic stat ranks
}

export interface TeamStats {
  L10ptsPct: number;
  L10goalsFor: number;
  L10goalsAgainst: number;
  L10shotsFor: number;
  L10shotsAgainst: number;
  L10powerPlay: number;
  L10penaltyKill: number;
  L10powerPlayOpportunities: number;
  L10hits: number;
  L10blocks: number;
  L10pim: number;
  [key: string]: any; // For additional stats
}

export interface Team {
  id: number;
  abbreviation: string;
  fullName: string;
  lastSeason: string | null;
  firstSeason: string | null;
  [key: string]: any; // For additional properties
}

export interface Rank {
  teamId: number;
  rank: string;
}

export interface GameStat {
  gameId: string;
  teamId: number;
  L10ptsPct: number;
  L10goalsFor: number;
  L10goalsAgainst: number;
  L10shotsFor: number;
  L10shotsAgainst: number;
  L10powerPlay: number;
  L10penaltyKill: number;
  L10powerPlayOpportunities: number;
  L10hits: number;
  L10blocks: number;
  L10pim: number;
}

export interface SortedTeamPowerRanking extends TeamPowerRanking {
  [key: string]: any;
}

export interface PowerScoreConfig {
  [key: string]: number;
}

// lib/NHL/teamPageTypes.ts
export interface PowerScoreTeam extends Team {
  powerScore: number;
  lastTenGames: TeamStats[];
}

// Define the sorting configuration interface
export interface SortConfig {
  key: keyof PowerScoreTeam | null;
  direction: "ascending" | "descending";
}

export interface BoxscoreData {
  homeTeam: {
    id: number;
    powerPlayConversion: string;
    pim: number;
    hits: number;
    blocks: number;
  };
  awayTeam: {
    id: number;
    powerPlayConversion: string;
    pim: number;
    hits: number;
    blocks: number;
  };
}

// Define interface for aggregated team stats
export interface AggregatedTeamStats extends TeamStats {
  teamId: number;
}
