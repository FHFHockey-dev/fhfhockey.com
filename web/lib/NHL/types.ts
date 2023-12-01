export type Player = {
  id: number;
  firstName: string;
  fullName: string;
  lastName: string;
  positionCode: string;
  sweaterNumber: number;
  age: number;
  weight: number;
  height: number;
  image: string;
  // Team info
  teamId: number;
  teamName: string;
  teamAbbreviation: string;
  teamLogo: string;
};

export type PlayerGameLog = {
  gameId: number;
  gameDate: string;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  powerPlayGoals: number;
  powerPlayPoints: number;
  shots: number;
  pim: number;
  toi: string;
};

export type Team = {
  /**
   * e.g., 13
   */
  id: number;
  /**
   * e.g., "Florida Panthers"
   */
  name: string;
  /**
   * e.g., FLA
   */
  abbreviation: string;
  logo: string;
};

export type Season = {
  seasonId: number;
  regularSeasonStartDate: string;
  regularSeasonEndDate: string;
  seasonEndDate: string;
  numberOfGames: number;
};

export const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export type DAY_ABBREVIATION = typeof DAYS[number];

export type GameData = {
  id: number;
  season: number;
  homeTeam: { id: number; score: number; winOdds: number };
  awayTeam: { id: number; score: number; winOdds: number };
};

export type WeekData = {
  MON?: GameData;
  TUE?: GameData;
  WED?: GameData;
  THU?: GameData;
  FRI?: GameData;
  SAT?: GameData;
  SUN?: GameData;
};

export type ScheduleData = {
  data: Record<number, WeekData>;
  numGamesPerDay: number[];
};

export type PercentileRank = {
  Goals: number | null;
  Assists: number | null;
  PPP: number | null;
  Hits: number | null;
  Blocks: number | null;
  PIM: number | null;
  Shots: number | null;
  PlusMinus: number | null;
};
