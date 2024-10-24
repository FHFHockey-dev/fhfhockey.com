// lib\NHL\types.ts

import { match } from "assert";

export type Player = {
  id: number;
  firstName: string;
  fullName: string;
  lastName: string;
  position: "L" | "R" | "G" | "D" | "C";
  sweaterNumber: number;
  age: number;
  birthDate: string;
  birthCity: string | null;
  birthCountry: string | null;
  weightInKilograms: number;
  heightInCentimeters: number;
  // Team info
  teamId: number | undefined;
  teamName: string | undefined;
  teamAbbreviation: string | undefined;
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
  slice(arg0: number, arg1: number): string;
  seasonId: number;
  regularSeasonStartDate: string;
  regularSeasonEndDate: string;
  seasonEndDate: string;
  numberOfGames: number;
  lastSeasonId: number;
  lastRegularSeasonStartDate: string;
  lastRegularSeasonEndDate: string;
  lastSeasonEndDate: string;
  lastNumberOfGames: number;
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

// === Game Grid ===
// web\lib\NHL\types.ts

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

export type TeamGameData = {
  id: number;
  score?: number;
  winOdds?: number | null;
  apiWinOdds?: number | null;
};

export type GameData = {
  id: number;
  season: number;
  homeTeam: TeamGameData;
  awayTeam: TeamGameData;
};

export type WeekData = Partial<Record<EXTENDED_DAY_ABBREVIATION, GameData>>;

export type GameSituation = "all" | "5v5" | "pp" | "pk";

export type ScheduleData = {
  data: Record<number, WeekData>;
  numGamesPerDay: number[];
};

export type PercentileRank = {
  goals: number;
  assists: number;
  plusMinus: number;
  pim: number;
  hits: number;
  blockedShots: number;
  powerPlayPoints: number;
  shots: number;
};

export type WGOGoalieStat = {
  assists: number;
  gamesPlayed: number;
  gamesStarted: number;
  goalieFullName: string;
  goals: number;
  goalsAgainst: number;
  goalsAgainstAverage: number;
  lastName: string;
  losses: number;
  otLosses: number;
  penaltyMinutes: number;
  playerId: number;
  points: number;
  savePct: number;
  saves: number;
  shootsCatches: string;
  shotsAgainst: number;
  shutouts: number;
  ties: number | null;
  timeOnIce: number;
  wins: number;
};

export type WGOAdvancedGoalieStat = {
  playerId: number;
  completeGamePct: number;
  completeGames: number;
  incompleteGames: number;
  qualityStart: number;
  qualityStartsPct: number;
  regulationLosses: number;
  regulationWins: number;
  shotsAgainstPer60: number;
};

export type WGOSummarySkaterStat = {
  [key: string]: any;
  playerId: number;
  skaterFullName: string;
  shootsCatches: string;
  positionCode: string;
  gamesPlayed: number;
  points: number;
  pointsPerGame: number;
  goals: number;
  assists: number;
  shots: number;
  shootingPct: number;
  plusMinus: number;
  otGoals: number;
  gameWinningGoals: number;
  ppPoints: number;
  faceoffWinPct: number;
  timeOnIcePerGame: number;
};

export type WGOSkatersBio = {
  playerId: number;
  birthCity: string;
  birthCountryCode: string;
  birthDate: string;
  currentTeamAbbrev: string;
  currentTeamName: string;
  draftOverall: number;
  draftRound: number;
  draftYear: number;
  firstSeasonForGameType: number;
  nationalityCode: string;
  weight: number;
  height: number;
};

export type WGORealtimeSkaterStat = {
  playerId: number;
  blockedShots: number;
  blockedShotsPer60: number;
  emptyNetAssists: number;
  emptyNetGoals: number;
  emptyNetPoints: number;
  firstGoals: number;
  giveaways: number;
  giveawaysPer60: number;
  hits: number;
  hitsPer60: number;
  missedShotCrossbar: number;
  missedShotGoalpost: number;
  missedShotOverNet: number;
  missedShotShort: number;
  missedShotWideOfNet: number;
  missedShots: number;
  takeaways: number;
  takeawaysPer60: number;
};

export type WGOFaceoffSkaterStat = {
  playerId: number;
  defensiveZoneFaceoffPct: number;
  defensiveZoneFaceoffs: number;
  evFaceoffPct: number;
  evFaceoffs: number;
  neutralZoneFaceoffPct: number;
  neutralZoneFaceoffs: number;
  offensiveZoneFaceoffPct: number;
  offensiveZoneFaceoffs: number;
  ppFaceoffPct: number;
  ppFaceoffs: number;
  shFaceoffPct: number;
  shFaceoffs: number;
  totalFaceoffs: number;
};

export type WGOFaceOffWinLossSkaterStat = {
  playerId: number;
  defensiveZoneFaceoffLosses: number;
  defensiveZoneFaceoffWins: number;
  evFaceoffsLost: number;
  evFaceoffsWon: number;
  neutralZoneFaceoffLosses: number;
  neutralZoneFaceoffWins: number;
  offensiveZoneFaceoffLosses: number;
  offensiveZoneFaceoffWins: number;
  ppFaceoffsLost: number;
  ppFaceoffsWon: number;
  shFaceoffsLost: number;
  shFaceoffsWon: number;
  totalFaceoffLosses: number;
  totalFaceoffWins: number;
};

export type WGOGoalsForAgainstSkaterStat = {
  playerId: number;
  evenStrengthGoalDifference: number;
  evenStrengthGoalsAgainst: number;
  evenStrengthGoalsFor: number;
  evenStrengthGoalsForPct: number;
  evenStrengthTimeOnIcePerGame: number;
  powerPlayGoalsAgainst: number;
  powerPlayGoalFor: number;
  powerPlayTimeOnIcePerGame: number;
  shortHandedGoalsAgainst: number;
  shortHandedGoalsFor: number;
  shortHandedTimeOnIcePerGame: number;
};

export type WGOPenaltySkaterStat = {
  playerId: number;
  gameMisconductPenalties: number;
  majorPenalties: number;
  matchPenalties: number;
  minorPenalties: number;
  misconductPenalties: number;
  netPenalties: number;
  netPenaltiesPer60: number;
  penalties: number;
  penaltiesDrawn: number;
  penaltiesDrawnPer60: number;
  penaltiesTakenPer60: number;
  penaltyMinutes: number;
  penaltyMinutesPerTimeOnIce: number;
  penaltySecondsPerGame: number;
};

export type WGOPenaltyKillSkaterStat = {
  playerId: number;
  ppGoalsAgainstPer60: number;
  shAssists: number;
  shGoals: number;
  shPoints: number;
  shGoalsPer60: number;
  shIndividualSatFor: number;
  shIndividualSatForPer60: number;
  shPointsPer60: number;
  shPrimaryAssists: number;
  shPrimaryAssistsPer60: number;
  shSecondaryAssists: number;
  shSecondaryAssistsPer60: number;
  shShootingPct: number;
  shShots: number;
  shShotsPer60: number;
  shTimeOnIce: number;
  shTimeOnIcePctPerGame: number;
};

export type WGOPowerPlaySkaterStat = {
  playerId: number;
  ppAssists: number;
  ppGoals: number;
  ppGoalsForPer60: number;
  ppGoalsPer60: number;
  ppIndividualSatFor: number;
  ppIndividualSatPer60: number;
  ppPointsPer60: number;
  ppPrimaryAssists: number;
  ppPrimaryAssistsPer60: number;
  ppSecondaryAssists: number;
  ppSecondaryAssistsPer60: number;
  ppShootingPct: number;
  ppShots: number;
  ppShotsPer60: number;
  ppTimeOnIce: number;
  ppTimeOnIcePctPerGame: number;
};

export type WGOPuckPossessionSkaterStat = {
  playerId: number;
  goalsPct: number;
  faceoffPct5v5: number;
  individualSatForPer60: number;
  individualShotsForPer60: number;
  onIceShootingPct: number;
  satPct: number;
  timeOnIcePerGame5v5: number;
  usatPct: number;
  zoneStartPct: number;
};

export type WGOSatCountSkaterStat = {
  playerId: number;
  satAgainst: number;
  satAhead: number;
  satBehind: number;
  satClose: number;
  satFor: number;
  satTied: number;
  satTotal: number;
  usatAgainst: number;
  usatAhead: number;
  usatBehind: number;
  usatClose: number;
  usatFor: number;
  usatTied: number;
  usatTotal: number;
};

export type WGOSatPercentageSkaterStat = {
  playerId: number;
  satPercentage: number;
  satPercentageAhead: number;
  satPercentageBehind: number;
  satPercentageClose: number;
  satPercentageTied: number;
  satRelative: number;
  shootingPct5v5: number;
  skaterSavePct5v5: number;
  skaterShootingPlusSavePct5v5: number;
  usatPercentage: number;
  usatPercentageAhead: number;
  usatPercentageBehind: number;
  usatPrecentageClose: number;
  usatPercentageTied: number;
  usatRelative: number;
  zoneStartPct5v5: number;
};

export type WGOScoringRatesSkaterStat = {
  playerId: number;
  assists5v5: number;
  assistsPer605v5: number;
  goals5v5: number;
  goalsPer605v5: number;
  netMinorPenaltiesPer60: number;
  offensiveZoneStartPct5v5: number;
  onIceShootingPct5v5: number;
  points5v5: number;
  pointsPer605v5: number;
  primaryAssists5v5: number;
  primaryAssistsPer605v5: number;
  satRelative5v5: number;
  secondaryAssists5v5: number;
  secondaryAssistsPer605v5: number;
};

export type WGOScoringCountsSkaterStat = {
  playerId: number;
  assistsPerGame: number;
  blocksPerGame: number;
  goalsPerGame: number;
  hitsPerGame: number;
  penaltyMinutesPerGame: number;
  primaryAssistsPerGame: number;
  secondaryAssistsPerGame: number;
  shotsPerGame: number;
  totalPrimaryAssists: number;
  totalSecondaryAssists: number;
};

export type WGOShotTypeSkaterStat = {
  playerId: number;
  goalsBackhand: number;
  goalsBat: number;
  goalsBetweenLegs: number;
  goalsCradle: number;
  goalsDeflected: number;
  goalsPoke: number;
  goalsSlap: number;
  goalsSnap: number;
  goalsTipIn: number;
  goalsWrapAround: number;
  goalsWrist: number;
  shootingPctBackhand: number;
  shootingPctBat: number;
  shootingPctBetweenLegs: number;
  shootingPctCradle: number;
  shootingPctDeflected: number;
  shootingPctPoke: number;
  shootingPctSlap: number;
  shootingPctSnap: number;
  shootingPctTipIn: number;
  shootingPctWrapAround: number;
  shootingPctWrist: number;
  shotsOnNetBackhand: number;
  shotsOnNetBat: number;
  shotsOnNetBetweenLegs: number;
  shotsOnNetCradle: number;
  shotsOnNetDeflected: number;
  shotsOnNetPoke: number;
  shotsOnNetSlap: number;
  shotsOnNetSnap: number;
  shotsOnNetTipIn: number;
  shotsOnNetWrapAround: number;
  shotsOnNetWrist: number;
};

export type WGOToiSkaterStat = {
  playerId: number;
  evTimeOnIce: number;
  evTimeOnIcePerGame: number;
  otTimeOnIce: number;
  otTimeOnIcePerOtGame: number;
  shifts: number;
  shiftsPerGame: number;
  timeOnIcePerShift: number;
};

export type WGOSkaterStat = WGOSummarySkaterStat &
  WGORealtimeSkaterStat &
  WGOFaceoffSkaterStat &
  WGOFaceOffWinLossSkaterStat &
  WGOGoalsForAgainstSkaterStat &
  WGOPenaltySkaterStat &
  WGOPenaltyKillSkaterStat &
  WGOPowerPlaySkaterStat &
  WGOPuckPossessionSkaterStat &
  WGOSatCountSkaterStat &
  WGOSatPercentageSkaterStat &
  WGOScoringRatesSkaterStat &
  WGOScoringCountsSkaterStat &
  WGOShotTypeSkaterStat &
  WGOToiSkaterStat;

export type lastPerSummarySkaterStat = {
  [key: string]: any;
  playerId: number;
  skaterFullName: string;
  shootsCatches: string;
  positionCode: string;
  gamesPlayed: number;
  points: number;
  pointsPerGame: number;
  goals: number;
  assists: number;
  shots: number;
  shootingPct: number;
  plusMinus: number;
  otGoals: number;
  gameWinningGoals: number;
  ppPoints: number;
  faceoffWinPct: number;
  timeOnIcePerGame: number;
};

export type lastPerSkatersBio = {
  playerId: number;
  birthCity: string;
  birthCountryCode: string;
  birthDate: string;
  currentTeamAbbrev: string;
  currentTeamName: string;
  draftOverall: number;
  draftRound: number;
  draftYear: number;
  firstSeasonForGameType: number;
  nationalityCode: string;
  weight: number;
  height: number;
};

export type lastPerRealtimeSkaterStat = {
  playerId: number;
  blockedShots: number;
  blockedShotsPer60: number;
  emptyNetAssists: number;
  emptyNetGoals: number;
  emptyNetPoints: number;
  firstGoals: number;
  giveaways: number;
  giveawaysPer60: number;
  hits: number;
  hitsPer60: number;
  missedShotCrossbar: number;
  missedShotGoalpost: number;
  missedShotOverNet: number;
  missedShotShort: number;
  missedShotWideOfNet: number;
  missedShots: number;
  takeaways: number;
  takeawaysPer60: number;
};

export type lastPerFaceoffSkaterStat = {
  playerId: number;
  defensiveZoneFaceoffPct: number;
  defensiveZoneFaceoffs: number;
  evFaceoffPct: number;
  evFaceoffs: number;
  neutralZoneFaceoffPct: number;
  neutralZoneFaceoffs: number;
  offensiveZoneFaceoffPct: number;
  offensiveZoneFaceoffs: number;
  ppFaceoffPct: number;
  ppFaceoffs: number;
  shFaceoffPct: number;
  shFaceoffs: number;
  totalFaceoffs: number;
};

export type lastPerFaceOffWinLossSkaterStat = {
  playerId: number;
  defensiveZoneFaceoffLosses: number;
  defensiveZoneFaceoffWins: number;
  evFaceoffsLost: number;
  evFaceoffsWon: number;
  neutralZoneFaceoffLosses: number;
  neutralZoneFaceoffWins: number;
  offensiveZoneFaceoffLosses: number;
  offensiveZoneFaceoffWins: number;
  ppFaceoffsLost: number;
  ppFaceoffsWon: number;
  shFaceoffsLost: number;
  shFaceoffsWon: number;
  totalFaceoffLosses: number;
  totalFaceoffWins: number;
};

export type lastPerGoalsForAgainstSkaterStat = {
  playerId: number;
  evenStrengthGoalDifference: number;
  evenStrengthGoalsAgainst: number;
  evenStrengthGoalsFor: number;
  evenStrengthGoalsForPct: number;
  evenStrengthTimeOnIcePerGame: number;
  powerPlayGoalsAgainst: number;
  powerPlayGoalFor: number;
  powerPlayTimeOnIcePerGame: number;
  shortHandedGoalsAgainst: number;
  shortHandedGoalsFor: number;
  shortHandedTimeOnIcePerGame: number;
};

export type lastPerPenaltySkaterStat = {
  playerId: number;
  gameMisconductPenalties: number;
  majorPenalties: number;
  matchPenalties: number;
  minorPenalties: number;
  misconductPenalties: number;
  netPenalties: number;
  netPenaltiesPer60: number;
  penalties: number;
  penaltiesDrawn: number;
  penaltiesDrawnPer60: number;
  penaltiesTakenPer60: number;
  penaltyMinutes: number;
  penaltyMinutesPerTimeOnIce: number;
  penaltySecondsPerGame: number;
};

export type lastPerPenaltyKillSkaterStat = {
  playerId: number;
  ppGoalsAgainstPer60: number;
  shAssists: number;
  shGoals: number;
  shPoints: number;
  shGoalsPer60: number;
  shIndividualSatFor: number;
  shIndividualSatForPer60: number;
  shPointsPer60: number;
  shPrimaryAssists: number;
  shPrimaryAssistsPer60: number;
  shSecondaryAssists: number;
  shSecondaryAssistsPer60: number;
  shShootingPct: number;
  shShots: number;
  shShotsPer60: number;
  shTimeOnIce: number;
  shTimeOnIcePctPerGame: number;
};

export type lastPerPowerPlaySkaterStat = {
  playerId: number;
  ppAssists: number;
  ppGoals: number;
  ppGoalsForPer60: number;
  ppGoalsPer60: number;
  ppIndividualSatFor: number;
  ppIndividualSatPer60: number;
  ppPointsPer60: number;
  ppPrimaryAssists: number;
  ppPrimaryAssistsPer60: number;
  ppSecondaryAssists: number;
  ppSecondaryAssistsPer60: number;
  ppShootingPct: number;
  ppShots: number;
  ppShotsPer60: number;
  ppTimeOnIce: number;
  ppTimeOnIcePctPerGame: number;
};

export type lastPerPuckPossessionSkaterStat = {
  playerId: number;
  goalsPct: number;
  faceoffPct5v5: number;
  individualSatForPer60: number;
  individualShotsForPer60: number;
  onIceShootingPct: number;
  satPct: number;
  timeOnIcePerGame5v5: number;
  usatPct: number;
  zoneStartPct: number;
};

export type lastPerSatCountSkaterStat = {
  playerId: number;
  satAgainst: number;
  satAhead: number;
  satBehind: number;
  satClose: number;
  satFor: number;
  satTied: number;
  satTotal: number;
  usatAgainst: number;
  usatAhead: number;
  usatBehind: number;
  usatClose: number;
  usatFor: number;
  usatTied: number;
  usatTotal: number;
};

export type lastPerSatPercentageSkaterStat = {
  playerId: number;
  satPercentage: number;
  satPercentageAhead: number;
  satPercentageBehind: number;
  satPercentageClose: number;
  satPercentageTied: number;
  satRelative: number;
  shootingPct5v5: number;
  skaterSavePct5v5: number;
  skaterShootingPlusSavePct5v5: number;
  usatPercentage: number;
  usatPercentageAhead: number;
  usatPercentageBehind: number;
  usatPrecentageClose: number;
  usatPercentageTied: number;
  usatRelative: number;
  zoneStartPct5v5: number;
};

export type lastPerScoringRatesSkaterStat = {
  playerId: number;
  assists5v5: number;
  assistsPer605v5: number;
  goals5v5: number;
  goalsPer605v5: number;
  netMinorPenaltiesPer60: number;
  offensiveZoneStartPct5v5: number;
  onIceShootingPct5v5: number;
  points5v5: number;
  pointsPer605v5: number;
  primaryAssists5v5: number;
  primaryAssistsPer605v5: number;
  satRelative5v5: number;
  secondaryAssists5v5: number;
  secondaryAssistsPer605v5: number;
};

export type lastPerScoringCountsSkaterStat = {
  playerId: number;
  assistsPerGame: number;
  blocksPerGame: number;
  goalsPerGame: number;
  hitsPerGame: number;
  penaltyMinutesPerGame: number;
  primaryAssistsPerGame: number;
  secondaryAssistsPerGame: number;
  shotsPerGame: number;
  totalPrimaryAssists: number;
  totalSecondaryAssists: number;
};

export type lastPerShotTypeSkaterStat = {
  playerId: number;
  goalsBackhand: number;
  goalsBat: number;
  goalsBetweenLegs: number;
  goalsCradle: number;
  goalsDeflected: number;
  goalsPoke: number;
  goalsSlap: number;
  goalsSnap: number;
  goalsTipIn: number;
  goalsWrapAround: number;
  goalsWrist: number;
  shootingPctBackhand: number;
  shootingPctBat: number;
  shootingPctBetweenLegs: number;
  shootingPctCradle: number;
  shootingPctDeflected: number;
  shootingPctPoke: number;
  shootingPctSlap: number;
  shootingPctSnap: number;
  shootingPctTipIn: number;
  shootingPctWrapAround: number;
  shootingPctWrist: number;
  shotsOnNetBackhand: number;
  shotsOnNetBat: number;
  shotsOnNetBetweenLegs: number;
  shotsOnNetCradle: number;
  shotsOnNetDeflected: number;
  shotsOnNetPoke: number;
  shotsOnNetSlap: number;
  shotsOnNetSnap: number;
  shotsOnNetTipIn: number;
  shotsOnNetWrapAround: number;
  shotsOnNetWrist: number;
};

export type lastPerToiSkaterStat = {
  playerId: number;
  evTimeOnIce: number;
  evTimeOnIcePerGame: number;
  otTimeOnIce: number;
  otTimeOnIcePerOtGame: number;
  shifts: number;
  shiftsPerGame: number;
  timeOnIcePerShift: number;
};

export type WGOSummarySkaterTotal = {
  playerId: number;
  skaterFullName: string;
  season: string;
  shootsCatches: string;
  positionCode: string;
  gamesPlayed: number;
  points: number;
  pointsPerGame: number;
  goals: number;
  assists: number;
  shots: number;
  shootingPct: number;
  plusMinus: number;
  otGoals: number;
  gameWinningGoals: number;
  ppPoints: number;
  faceoffWinPct: number;
  timeOnIcePerGame: number;
};

export type WGORealtimeSkaterTotal = {
  playerId: number;
  season: string;
  blockedShots: number;
  blockedShotsPer60: number;
  emptyNetGoals: number;
  emptyNetPoints: number;
  giveaways: number;
  giveawaysPer60: number;
  hits: number;
  hitsPer60: number;
  missedShots: number;
  takeaways: number;
  takeawaysPer60: number;
};

export type WGOFaceoffSkaterTotal = {
  playerId: number;
  season: string;
  defensiveZoneFaceoffPct: number;
  defensiveZoneFaceoffs: number;
  evFaceoffPct: number;
  evFaceoffs: number;
  neutralZoneFaceoffPct: number;
  neutralZoneFaceoffs: number;
  offensiveZoneFaceoffPct: number;
  offensiveZoneFaceoffs: number;
  ppFaceoffPct: number;
  ppFaceoffs: number;
  shFaceoffPct: number;
  shFaceoffs: number;
  totalFaceoffs: number;
};

export type WGOFaceOffWinLossSkaterTotal = {
  playerId: number;
  season: string;
  defensiveZoneFaceoffLosses: number;
  defensiveZoneFaceoffWins: number;
  evFaceoffsLost: number;
  evFaceoffsWon: number;
  neutralZoneFaceoffLosses: number;
  neutralZoneFaceoffWins: number;
  offensiveZoneFaceoffLosses: number;
  offensiveZoneFaceoffWins: number;
  ppFaceoffsLost: number;
  ppFaceoffsWon: number;
  shFaceoffsLost: number;
  shFaceoffsWon: number;
  totalFaceoffLosses: number;
  totalFaceoffWins: number;
};

export type WGOGoalsForAgainstSkaterTotal = {
  playerId: number;
  season: string;
  evenStrengthGoalsAgainst: number;
  evenStrengthGoalsFor: number;
  evenStrengthGoalsForPct: number;
  evenStrengthTimeOnIcePerGame: number;
  powerPlayGoalsAgainst: number;
  powerPlayGoalFor: number;
  powerPlayTimeOnIcePerGame: number;
  shortHandedGoalsAgainst: number;
  shortHandedGoalsFor: number;
  shortHandedTimeOnIcePerGame: number;
};

export type WGOPenaltySkaterTotal = {
  playerId: number;
  season: string;
  gameMisconductPenalties: number;
  majorPenalties: number;
  matchPenalties: number;
  minorPenalties: number;
  misconductPenalties: number;
  penalties: number;
  penaltiesDrawn: number;
  penaltiesDrawnPer60: number;
  penaltiesTakenPer60: number;
  penaltyMinutes: number;
  penaltyMinutesPerTimeOnIce: number;
  penaltySecondsPerGame: number;
};

export type WGOPenaltyKillSkaterTotal = {
  playerId: number;
  season: string;
  ppGoalsAgainstPer60: number;
  shAssists: number;
  shGoals: number;
  shPoints: number;
  shGoalsPer60: number;
  shIndividualSatFor: number;
  shIndividualSatForPer60: number;
  shPointsPer60: number;
  shPrimaryAssists: number;
  shPrimaryAssistsPer60: number;
  shSecondaryAssists: number;
  shSecondaryAssistsPer60: number;
  shShootingPct: number;
  shShots: number;
  shShotsPer60: number;
  shTimeOnIce: number;
  shTimeOnIcePctPerGame: number;
};

export type WGOPowerPlaySkaterTotal = {
  playerId: number;
  season: string;
  ppAssists: number;
  ppGoals: number;
  ppGoalsForPer60: number;
  ppGoalsPer60: number;
  ppIndividualSatFor: number;
  ppIndividualSatPer60: number;
  ppPointsPer60: number;
  ppPrimaryAssists: number;
  ppPrimaryAssistsPer60: number;
  ppSecondaryAssists: number;
  ppSecondaryAssistsPer60: number;
  ppShootingPct: number;
  ppShots: number;
  ppShotsPer60: number;
  ppTimeOnIce: number;
  ppTimeOnIcePctPerGame: number;
};

export type WGOPuckPossessionSkaterTotal = {
  playerId: number;
  season: string;
  goalsPct: number;
  faceoffPct5v5: number;
  individualSatForPer60: number;
  individualShotsForPer60: number;
  onIceShootingPct: number;
  satPct: number;
  timeOnIcePerGame5v5: number;
  usatPct: number;
  zoneStartPct: number;
};

export type WGOSatCountSkaterTotal = {
  playerId: number;
  season: string;
  satAgainst: number;
  satAhead: number;
  satBehind: number;
  satClose: number;
  satFor: number;
  satTied: number;
  satTotal: number;
  usatAgainst: number;
  usatAhead: number;
  usatBehind: number;
  usatClose: number;
  usatFor: number;
  usatTied: number;
  usatTotal: number;
};

export type WGOSatPercentageSkaterTotal = {
  playerId: number;
  season: string;
  satPercentage: number;
  satPercentageAhead: number;
  satPercentageBehind: number;
  satPercentageClose: number;
  satPercentageTied: number;
  satRelative: number;
  shootingPct5v5: number;
  skaterSavePct5v5: number;
  skaterShootingPlusSavePct5v5: number;
  usatPercentage: number;
  usatPercentageAhead: number;
  usatPercentageBehind: number;
  usatPrecentageClose: number;
  usatPercentageTied: number;
  usatRelative: number;
  zoneStartPct5v5: number;
};

export type WGOScoringRatesSkaterTotal = {
  playerId: number;
  season: string;
  assists5v5: number;
  assistsPer605v5: number;
  goals5v5: number;
  goalsPer605v5: number;
  offensiveZoneStartPct5v5: number;
  onIceShootingPct5v5: number;
  points5v5: number;
  pointsPer605v5: number;
  primaryAssists5v5: number;
  primaryAssistsPer605v5: number;
  satRelative5v5: number;
  secondaryAssists5v5: number;
  secondaryAssistsPer605v5: number;
};

export type WGOScoringCountsSkaterTotal = {
  playerId: number;
  season: string;
  totalPrimaryAssists: number;
  totalSecondaryAssists: number;
};

export type WGOShotTypeSkaterTotal = {
  playerId: number;
  season: string;
  goalsBackhand: number;
  goalsBat: number;
  goalsBetweenLegs: number;
  goalsCradle: number;
  goalsDeflected: number;
  goalsPoke: number;
  goalsSlap: number;
  goalsSnap: number;
  goalsTipIn: number;
  goalsWrapAround: number;
  goalsWrist: number;
  shotsOnNetBackhand: number;
  shotsOnNetBat: number;
  shotsOnNetBetweenLegs: number;
  shotsOnNetCradle: number;
  shotsOnNetDeflected: number;
  shotsOnNetPoke: number;
  shotsOnNetSlap: number;
  shotsOnNetSnap: number;
  shotsOnNetTipIn: number;
  shotsOnNetWrapAround: number;
  shotsOnNetWrist: number;
};

export type WGOToiSkaterTotal = {
  playerId: number;
  season: string;
  evTimeOnIce: number;
  evTimeOnIcePerGame: number;
  otTimeOnIce: number;
  otTimeOnIcePerOtGame: number;
  shifts: number;
  shiftsPerGame: number;
  timeOnIcePerShift: number;
};

export type WGOSummarySkaterTotalLY = {
  playerId: number;
  skaterFullName: string;
  season: string;
  shootsCatches: string;
  positionCode: string;
  gamesPlayed: number;
  points: number;
  pointsPerGame: number;
  goals: number;
  assists: number;
  shots: number;
  shootingPct: number;
  plusMinus: number;
  otGoals: number;
  gameWinningGoals: number;
  ppPoints: number;
  faceoffWinPct: number;
  timeOnIcePerGame: number;
};

export type WGORealtimeSkaterTotalLY = {
  playerId: number;
  season: string;
  blockedShots: number;
  blockedShotsPer60: number;
  emptyNetGoals: number;
  emptyNetPoints: number;
  giveaways: number;
  giveawaysPer60: number;
  hits: number;
  hitsPer60: number;
  missedShots: number;
  takeaways: number;
  takeawaysPer60: number;
};

export type WGOFaceoffSkaterTotalLY = {
  playerId: number;
  season: string;
  defensiveZoneFaceoffPct: number;
  defensiveZoneFaceoffs: number;
  evFaceoffPct: number;
  evFaceoffs: number;
  neutralZoneFaceoffPct: number;
  neutralZoneFaceoffs: number;
  offensiveZoneFaceoffPct: number;
  offensiveZoneFaceoffs: number;
  ppFaceoffPct: number;
  ppFaceoffs: number;
  shFaceoffPct: number;
  shFaceoffs: number;
  totalFaceoffs: number;
};

export type WGOFaceOffWinLossSkaterTotalLY = {
  playerId: number;
  season: string;
  defensiveZoneFaceoffLosses: number;
  defensiveZoneFaceoffWins: number;
  evFaceoffsLost: number;
  evFaceoffsWon: number;
  neutralZoneFaceoffLosses: number;
  neutralZoneFaceoffWins: number;
  offensiveZoneFaceoffLosses: number;
  offensiveZoneFaceoffWins: number;
  ppFaceoffsLost: number;
  ppFaceoffsWon: number;
  shFaceoffsLost: number;
  shFaceoffsWon: number;
  totalFaceoffLosses: number;
  totalFaceoffWins: number;
};

export type WGOGoalsForAgainstSkaterTotalLY = {
  playerId: number;
  season: string;
  evenStrengthGoalsAgainst: number;
  evenStrengthGoalsFor: number;
  evenStrengthGoalsForPct: number;
  evenStrengthTimeOnIcePerGame: number;
  powerPlayGoalsAgainst: number;
  powerPlayGoalFor: number;
  powerPlayTimeOnIcePerGame: number;
  shortHandedGoalsAgainst: number;
  shortHandedGoalsFor: number;
  shortHandedTimeOnIcePerGame: number;
};

export type WGOPenaltySkaterTotalLY = {
  playerId: number;
  season: string;
  gameMisconductPenalties: number;
  majorPenalties: number;
  matchPenalties: number;
  minorPenalties: number;
  misconductPenalties: number;
  penalties: number;
  penaltiesDrawn: number;
  penaltiesDrawnPer60: number;
  penaltiesTakenPer60: number;
  penaltyMinutes: number;
  penaltyMinutesPerTimeOnIce: number;
  penaltySecondsPerGame: number;
};

export type WGOPenaltyKillSkaterTotalLY = {
  playerId: number;
  season: string;
  ppGoalsAgainstPer60: number;
  shAssists: number;
  shGoals: number;
  shPoints: number;
  shGoalsPer60: number;
  shIndividualSatFor: number;
  shIndividualSatForPer60: number;
  shPointsPer60: number;
  shPrimaryAssists: number;
  shPrimaryAssistsPer60: number;
  shSecondaryAssists: number;
  shSecondaryAssistsPer60: number;
  shShootingPct: number;
  shShots: number;
  shShotsPer60: number;
  shTimeOnIce: number;
  shTimeOnIcePctPerGame: number;
};

export type WGOPowerPlaySkaterTotalLY = {
  playerId: number;
  season: string;
  ppAssists: number;
  ppGoals: number;
  ppGoalsForPer60: number;
  ppGoalsPer60: number;
  ppIndividualSatFor: number;
  ppIndividualSatPer60: number;
  ppPointsPer60: number;
  ppPrimaryAssists: number;
  ppPrimaryAssistsPer60: number;
  ppSecondaryAssists: number;
  ppSecondaryAssistsPer60: number;
  ppShootingPct: number;
  ppShots: number;
  ppShotsPer60: number;
  ppTimeOnIce: number;
  ppTimeOnIcePctPerGame: number;
};

export type WGOPuckPossessionSkaterTotalLY = {
  playerId: number;
  season: string;
  goalsPct: number;
  faceoffPct5v5: number;
  individualSatForPer60: number;
  individualShotsForPer60: number;
  onIceShootingPct: number;
  satPct: number;
  timeOnIcePerGame5v5: number;
  usatPct: number;
  zoneStartPct: number;
};

export type WGOSatCountSkaterTotalLY = {
  playerId: number;
  season: string;
  satAgainst: number;
  satAhead: number;
  satBehind: number;
  satClose: number;
  satFor: number;
  satTied: number;
  satTotal: number;
  usatAgainst: number;
  usatAhead: number;
  usatBehind: number;
  usatClose: number;
  usatFor: number;
  usatTied: number;
  usatTotal: number;
};

export type WGOSatPercentageSkaterTotalLY = {
  playerId: number;
  season: string;
  satPercentage: number;
  satPercentageAhead: number;
  satPercentageBehind: number;
  satPercentageClose: number;
  satPercentageTied: number;
  satRelative: number;
  shootingPct5v5: number;
  skaterSavePct5v5: number;
  skaterShootingPlusSavePct5v5: number;
  usatPercentage: number;
  usatPercentageAhead: number;
  usatPercentageBehind: number;
  usatPrecentageClose: number;
  usatPercentageTied: number;
  usatRelative: number;
  zoneStartPct5v5: number;
};

export type WGOScoringRatesSkaterTotalLY = {
  playerId: number;
  season: string;
  assists5v5: number;
  assistsPer605v5: number;
  goals5v5: number;
  goalsPer605v5: number;
  offensiveZoneStartPct5v5: number;
  onIceShootingPct5v5: number;
  points5v5: number;
  pointsPer605v5: number;
  primaryAssists5v5: number;
  primaryAssistsPer605v5: number;
  satRelative5v5: number;
  secondaryAssists5v5: number;
  secondaryAssistsPer605v5: number;
};

export type WGOScoringCountsSkaterTotalLY = {
  playerId: number;
  season: string;
  assistsPerGame: number;
  blocksPerGame: number;
  goalsPerGame: number;
  hitsPerGame: number;
  penaltyMinutesPerGame: number;
  primaryAssistsPerGame: number;
  secondaryAssistsPerGame: number;
  shotsPerGame: number;
  totalPrimaryAssists: number;
  totalSecondaryAssists: number;
};

export type WGOShotTypeSkaterTotalLY = {
  playerId: number;
  season: string;
  goalsBackhand: number;
  goalsBat: number;
  goalsBetweenLegs: number;
  goalsCradle: number;
  goalsDeflected: number;
  goalsPoke: number;
  goalsSlap: number;
  goalsSnap: number;
  goalsTipIn: number;
  goalsWrapAround: number;
  goalsWrist: number;
  shotsOnNetBackhand: number;
  shotsOnNetBat: number;
  shotsOnNetBetweenLegs: number;
  shotsOnNetCradle: number;
  shotsOnNetDeflected: number;
  shotsOnNetPoke: number;
  shotsOnNetSlap: number;
  shotsOnNetSnap: number;
  shotsOnNetTipIn: number;
  shotsOnNetWrapAround: number;
  shotsOnNetWrist: number;
};

export type WGOToiSkaterTotalLY = {
  playerId: number;
  season: string;
  evTimeOnIce: number;
  evTimeOnIcePerGame: number;
  otTimeOnIce: number;
  otTimeOnIcePerOtGame: number;
  shifts: number;
  shiftsPerGame: number;
  timeOnIcePerShift: number;
};

// SKO Stats

export type SKOSummarySkaterStat = {
  playerId: number;
  skaterFullName: string;
  teamAbbrevs: string;
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  shootingPct: number;
  timeOnIcePerGame: number;
  pointsPerGame: number;
  evGoals: number;
  evPoints: number;
  ppGoals: number;
  ppPoints: number;
  shots: number;
};

export type DRMShift = {
  id: number;
  gameId: number;
  playerId: number;
  period: number;
  firstName: string;
  lastName: string;
  teamId: number;
  teamName: string;
  duration: string | null;
  startTime: string;
  endTime: string;
  type: "ES" | "SH" | "PP"; // Added type property
  line: number; // Added line property
};
