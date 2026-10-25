import type { EvDeploymentBucket, SpecialTeamsDeploymentBucket } from "lib/rankings/skaterDeploymentAggregation";
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
/** Formats backed by the NHL schedule edition; the rest stay source-gated. */
export const SCHEDULE_FORMATS: readonly SocialShareFormat[] = ["game-grid", "remaining-week", "tuesday-trends"];
/**
 * Formats whose API makes upstream reads (NHL schedule, team rates). Tuesday trends stays out until
 * a live trend source is approved: its API answers "not connected" without any read (SS1-6-O1).
 */
export const UPSTREAM_READ_FORMATS: readonly SocialShareFormat[] = ["game-grid", "remaining-week"];
/** Formats whose matchup cards use opponent team rates. */
export const OPPONENT_RATE_FORMATS: readonly SocialShareFormat[] = ["game-grid", "remaining-week"];
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

/** Public team rates behind Game Grid's opponent ratings (nst_team_stats, situation "all"). */
export type ShareTeamRates = { gp: number; xgf: number; xga: number; gf?: number; ga?: number; sf?: number; sa?: number };
export type ShareOpponentStats = {
  name: "NST team stats";
  season: number;
  fetchedAt: string | null;
  updatedAt: string | null;
  state: ShareDataState;
  reasons: string[];
  /** Keyed by team abbreviation; only complete, valid rows. */
  teams: Record<string, ShareTeamRates>;
};

/** Last five games played, from rolling_player_game_metrics (skaters) or wgo_goalie_stats (goalies). */
export type SharePlayerRecent =
  | { kind: "skater"; games: number; through: string; goals: number | null; assists: number | null; points: number | null; shots: number | null; hitsPerGame: number | null; blocksPerGame: number | null; toiSeconds: number | null; ppPoints: number | null;
      /** Latest game's role (SS1-15): even-strength line L1–L4 or pair P1–P3, PP unit, and season TOI per game for the relative-TOI note. */
      line?: EvDeploymentBucket | null; ppUnit?: SpecialTeamsDeploymentBucket | null; toiSeasonSeconds?: number | null }
  | { kind: "goalie"; games: number; through: string; wins: number; saves: number; shotsAgainst: number; goalsAgainst: number; qualityStarts: number; shutouts?: number };

/** One public player row joined from Yahoo ownership and NHL.com (WGO) season totals. */
export type SharePlayer = {
  nhlId: number;
  name: string;
  /** NHL abbreviation of the player's current team (WGO current_team_abbreviation). */
  team: string;
  group: "F" | "D" | "G";
  positions: string;
  /** Yahoo rostered %, 0–100. */
  ownership: number;
  gamesPlayed: number;
  /** Skaters: existing WGO season totals; goalies leave these null. */
  pointsPerGame: number | null;
  hits: number | null;
  shots: number | null;
  blocks: number | null;
  /** Goalies: existing WGO columns; skaters leave these null. */
  gamesStarted: number | null;
  qualityStartPct: number | null;
  savePct: number | null;
  /** Last-five-games evidence for the card; null when no recent game is on record. */
  recent?: SharePlayerRecent | null;
};
export type SharePlayerLayer = {
  name: "Yahoo ownership + NHL.com season totals";
  season: number;
  fetchedAt: string | null;
  /** Oldest Yahoo ownership observation date (YYYY-MM-DD) among included players. */
  ownershipAsOf: string | null;
  /** Oldest WGO season-total update time among included players. */
  statsUpdatedAt: string | null;
  state: ShareDataState;
  reasons: string[];
  players: SharePlayer[];
  /**
   * Live editions keep only the players their cards show for these selected dates; another day
   * selection needs a refresh. Absent (fixtures) means the rows are not trimmed to one selection.
   */
  selectedDates?: string[] | null;
  /**
   * Trimmed live layers (SS1-14): each streaming tier's full eligible-player count per tier mode, so the
   * tier list can split its rows and say "+N more" without the unshown players leaving the server.
   */
  tierCounts?: { strict: number[]; widened: number[] } | null;
  /**
   * Last-five-games read outcome (C7 SS1-10-F1): "ready" when the source answered, even with no rows
   * (a player's `recent: null` then means no game in two weeks); "unavailable" when the read failed or
   * exceeded its limit, so no tile may claim the player has not played. Absent: no read was attempted.
   */
  recentState?: "ready" | "unavailable";
};

/** One skater's last-5 vs season windows from rolling_player_game_metrics (strength "all"). */
export type ShareTrendPlayer = {
  nhlId: number;
  name: string;
  team: string;
  position: string;
  /** Latest game in the rolling rows and the player's season games played through it. */
  lastGame: string;
  seasonGames: number;
  pointsPerGame: { last5: number | null; season: number | null };
  toiSeconds: { last5: number | null; season: number | null };
  ppSharePct: { last5: number | null; season: number | null };
  sogPer60: { last5: number | null; season: number | null };
  icfPer60: { last5: number | null; season: number | null };
  ixgPer60: { last5: number | null; season: number | null };
  /** Total TOI over the last five games, the sample behind the last-5 per-60 rates. */
  toiSecondsLast5: number | null;
  /** Line slot and PP unit in the latest game and five games earlier (null when unknown). */
  line: { now: number | null; before: number | null; group: string | null };
  ppUnit: { now: number | null; before: number | null };
};
/** One Yahoo rostered-% mover (ownership-trends rule: latest vs the value at or before 5 days earlier). */
export type ShareOwnershipMover = { /** Public name|team, never a Yahoo key. */ key: string; name: string; team: string | null; positions: string; latest: number; previous: number; delta: number; latestDate: string; previousDate: string };
export type ShareTrendLayer = {
  name: "FHFH rolling game metrics + Yahoo ownership";
  season: number;
  fetchedAt: string | null;
  /** Oldest latest-game date among included skaters. */
  metricsThrough: string | null;
  /** Oldest rolling-row update time among included skaters. */
  metricsUpdatedAt: string | null;
  /** Oldest latest ownership date among included movers. */
  ownershipAsOf: string | null;
  moverWindowDays: number;
  /** Rolling-metric state (hot/cold, deployment, rates). */
  state: ShareDataState;
  reasons: string[];
  /** Ownership-mover state, gated separately so stale ownership never blocks metric cards. */
  moversState: ShareDataState;
  moversReasons: string[];
  players: ShareTrendPlayer[];
  movers: ShareOwnershipMover[];
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
  /** Optional matchup layer; schedule-only cards never read it. */
  opponents?: ShareOpponentStats | null;
  /** Optional player layer for the pickups and specialists cards. */
  players?: SharePlayerLayer | null;
  /** Optional trend layer for the Tuesday edition. */
  trends?: ShareTrendLayer | null;
};

export const isSocialShareFormat = (value: string): value is SocialShareFormat =>
  (SOCIAL_SHARE_FORMATS as readonly string[]).includes(value);
