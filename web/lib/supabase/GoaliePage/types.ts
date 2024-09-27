// lib/supabase/GoaliePage/types.ts

export type WeekRanking =
  | "Elite Week"
  | "Quality Week"
  | "Week"
  | "Bad Week"
  | "Really Bad Week";

export interface GoalieStat {
  id: number;
  playerId: number;
  weekId: number;
  gamesPlayed: number;
  gamesStarted: number;
  wins: number;
  losses: number;
  otLosses: number;
  saves: number;
  shotsAgainst: number;
  goalsAgainst: number;
  shutouts: number;
  timeOnIce: number;
  savePct: number;
  goalsAgainstAverage: number;
  team: string;
  goalieFullName: string;
}

export interface GoalieStatRaw {
  id: number;
  player_id: number;
  week_id: number;
  games_played: number;
  games_started: number;
  wins: number;
  losses: number;
  ot_losses: number;
  saves: number;
  shots_against: number;
  goals_against: number;
  shutouts: number;
  time_on_ice: number;
  save_pct: number;
  goals_against_average: number;
  team: string;
  goalie_full_name: string;
}

export interface Averages {
  gamesPlayed: number;
  gamesStarted: number;
  wins: number;
  losses: number;
  otLosses: number;
  saves: number;
  shotsAgainst: number;
  goalsAgainst: number;
  shutouts: number;
  timeOnIce: number;
  savePct: number;
  goalsAgainstAverage: number;
}

export interface RankingResult {
  percentage: number;
  ranking: WeekRanking;
}

export interface GoalieWithRanking extends GoalieStat {
  percentage: number;
  ranking: WeekRanking;
  percentAcceptableWeeks: number;
  percentGoodWeeks: number;
}

export interface Week {
  id: number;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
}

export interface LeagueAverage extends Averages {
  id: number;
  weekId: number;
}

export type NumericStatKey = keyof Averages;

export interface GoalieWithWeeks {
  playerId: number;
  goalieFullName: string;
  team: string;
  weeks: GoalieStat[];
}

export interface GoalieRanking {
  playerId: number;
  goalieFullName: string;
  team: string;
  totalPoints: number;
  weekCounts: {
    [key in WeekRanking]: number;
  };
  percentAcceptableWeeks: number; // New field
  percentGoodWeeks: number; // New field
}
