import type { GameData, ScheduleData } from "lib/NHL/types";

/** Social-local compatibility with complete records and October indexed rows. */
export type SocialScheduleGame = GameData & {
  startTimeUTC?: string;
  homeTeam: GameData["homeTeam"] & { abbrev?: string; name?: string };
  awayTeam: GameData["awayTeam"] & { abbrev?: string; name?: string };
};
export type SocialScheduleData = ScheduleData & {
  /** Legacy schedule-check time; October supplies ScheduleData.retrievedAt. */
  fetchedAt?: string;
  updatedAt?: string | null;
  games?: SocialScheduleGame[];
};

export const SOCIAL_SHARE_FORMATS = [
  "game-grid", "tuesday-trends", "remaining-week", "player-spotlight", "category-rescue"
] as const;

export type SocialShareFormat = typeof SOCIAL_SHARE_FORMATS[number];
export type ShareDataState = "ready" | "partial" | "stale" | "missing" | "blocked";
export const SHARE_TIME_ZONE = "America/New_York";

export type ShareTeam = { id: number; abbreviation: string; name: string };
export type ShareGame = {
  id: number;
  season: number;
  gameType: number;
  date: string;
  startTimeUtc: string | null;
  status: "scheduled" | "live" | "final" | "postponed" | "cancelled" | "unknown";
  homeTeam: ShareTeam;
  awayTeam: ShareTeam;
};

export type ShareDay = {
  date: string;
  label: string;
  leagueGames: number;
  offNight: boolean;
  selected: boolean;
};

export type ShareTeamRow = {
  team: ShareTeam;
  rank: number;
  score: number;
  remainingGames: number;
  offNightGames: number;
  weightedOffNights: number;
  games: ShareGame[];
};

/** Public presentation only; never a forecast capture packet or private league state. */
export type SocialShareSnapshot = {
  schemaVersion: 1;
  id: string;
  format: SocialShareFormat;
  state: ShareDataState;
  reasons: string[];
  generatedAt: string;
  expiresAt: string | null;
  timeZone: typeof SHARE_TIME_ZONE;
  weekStart: string;
  weekEnd: string;
  selectedDates: string[];
  basis: "schedule_only";
  source: {
    name: "NHL schedule";
    fetchedAt: string | null;
    updatedAt: string | null;
    coveredDates: string[];
    state: ShareDataState;
    reasons: string[];
  };
  days: ShareDay[];
  teams: ShareTeam[];
  games: ShareGame[];
  rows: ShareTeamRow[];
};

export const isSocialShareFormat = (value: string): value is SocialShareFormat =>
  (SOCIAL_SHARE_FORMATS as readonly string[]).includes(value);
