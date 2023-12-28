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

// === Boxscore ===
export interface Boxscore {
  id: number;
  season: number;
  gameType: number;
  gameDate: Date;
  venue: Venue;
  startTimeUTC: Date;
  easternUTCOffset: string;
  venueUTCOffset: string;
  tvBroadcasts: TvBroadcast[];
  gameState: string;
  gameScheduleState: string;
  period: number;
  periodDescriptor: PeriodDescriptor;
  awayTeam: BoxscoreTeam;
  homeTeam: BoxscoreTeam;
  clock: Clock;
  boxscore: BoxscoreClass;
  gameOutcome: GameOutcome;
  gameVideo: GameVideo;
}

interface BoxscoreTeam {
  id: number;
  name: Venue;
  abbrev: string;
  score: number;
  sog: number;
  faceoffWinningPctg: number;
  powerPlayConversion: string;
  pim: number;
  hits: number;
  blocks: number;
  logo: string;
}

interface Venue {
  default: string;
}

interface BoxscoreClass {
  linescore: Linescore;
  shotsByPeriod: ByPeriod[];
  gameReports: GameReports;
  playerByGameStats: PlayerByGameStats;
  gameInfo: GameInfo;
}

interface GameInfo {
  referees: Venue[];
  linesmen: Venue[];
  awayTeam: GameInfoAwayTeam;
  homeTeam: GameInfoAwayTeam;
}

interface GameInfoAwayTeam {
  headCoach: Venue;
  scratches: Scratch[];
}

interface Scratch {
  id: number;
  firstName: Venue;
  lastName: Venue;
}

interface GameReports {
  gameSummary: string;
  eventSummary: string;
  playByPlay: string;
  faceoffSummary: string;
  faceoffComparison: string;
  rosters: string;
  shotSummary: string;
  shiftChart: string;
  toiAway: string;
  toiHome: string;
}

interface Linescore {
  byPeriod: ByPeriod[];
  totals: Totals;
}

interface ByPeriod {
  period: number;
  periodDescriptor: PeriodDescriptor;
  away: number;
  home: number;
}

interface PeriodDescriptor {
  number: number;
  periodType: string;
}

interface Totals {
  away: number;
  home: number;
}

interface PlayerByGameStats {
  awayTeam: PlayerByGameStatsAwayTeam;
  homeTeam: PlayerByGameStatsAwayTeam;
}

interface PlayerByGameStatsAwayTeam {
  forwards: Defense[];
  defense: Defense[];
  goalies: Goalie[];
}

interface Defense {
  playerId: number;
  sweaterNumber: number;
  name: Venue;
  position: Position;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  pim: number;
  hits: number;
  blockedShots: number;
  powerPlayGoals: number;
  powerPlayPoints: number;
  shorthandedGoals: number;
  shPoints: number;
  shots: number;
  faceoffs: string;
  faceoffWinningPctg: number;
  toi: string;
  powerPlayToi: string;
  shorthandedToi: string;
}

enum Position {
  C = "C",
  D = "D",
  L = "L",
  R = "R",
}

interface Goalie {
  playerId: number;
  sweaterNumber: number;
  name: Venue;
  position: string;
  evenStrengthShotsAgainst: string;
  powerPlayShotsAgainst: string;
  shorthandedShotsAgainst: string;
  saveShotsAgainst: string;
  evenStrengthGoalsAgainst: number;
  powerPlayGoalsAgainst: number;
  shorthandedGoalsAgainst: number;
  pim: number;
  goalsAgainst: number;
  toi: string;
  savePctg?: string;
}

interface Clock {
  timeRemaining: string;
  secondsRemaining: number;
  running: boolean;
  inIntermission: boolean;
}

interface GameOutcome {
  lastPeriodType: string;
}

interface GameVideo {
  threeMinRecap: number;
  condensedGame: number;
}

interface TvBroadcast {
  id: number;
  market: string;
  countryCode: string;
  network: string;
}

// === Boxscore ===

export const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export type DAY_ABBREVIATION = typeof DAYS[number];

export const EXTENDED_DAYS = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
  "nMON",
  "nTUE",
  "nWED",
] as const;
export type EXTENDED_DAY_ABBREVIATION = typeof EXTENDED_DAYS[number];

export type GameData = {
  id: number;
  season: number;
  homeTeam: { id: number; score: number; winOdds: number };
  awayTeam: { id: number; score: number; winOdds: number };
};

export type WeekData = Record<EXTENDED_DAY_ABBREVIATION, GameData>;

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
