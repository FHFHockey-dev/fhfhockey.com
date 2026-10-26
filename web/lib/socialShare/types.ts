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
      line?: EvDeploymentBucket | null; ppUnit?: SpecialTeamsDeploymentBucket | null; toiSeasonSeconds?: number | null;
      /** Streak inputs (SS1-18): L5 games with a point (null unless the 6 latest rows are consecutive games), and
       *  pre-L5 averages that exclude the L5 games ((season total − L5 total) ÷ (GP − 5)); seconds per game. */
      pointGames?: number | null; toiPreSeconds?: number | null; ppToiSeconds?: number | null; ppToiPreSeconds?: number | null }
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
  /** Skaters: season goals (ticket 22 scorer picks); null when the source has none. */
  goals?: number | null;
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
   * Trimmed live layers (SS1-22): each Targeted Matchups night's picks (key `TEAM:gameId`) with their tilt roles,
   * recorded by the server from the full candidate set so the client never re-derives them from fewer players.
   */
  targets?: Record<string, { id: number; roles: ("scorer" | "shooter" | "blocker")[] }[]> | null;
  /**
   * Last-five-games read outcome (C7 SS1-10-F1): "ready" when the source answered, even with no rows
   * (a player's `recent: null` then means no game in two weeks); "unavailable" when the read failed or
   * exceeded its limit, so no tile may claim the player has not played. Absent: no read was attempted.
   */
  recentState?: "ready" | "partial" | "unavailable";
  /** With "partial" (SS1-17): the source that failed, so only its players say "Recent form unavailable". */
  recentUnavailable?: ("skaters" | "goalies")[];
  /** With "partial" (SS1-24): players whose id chunk failed; only they say "Recent form unavailable". Shown players only. */
  recentUnavailableIds?: number[];
};

/** Tuesday sections (CONTRACT.md in tasks/artifacts/tuesday-trends-2026-10-26). */
export type ShareTrendKind = "hot" | "deployment" | "rates" | "movers";
export type ShareTrendWho = { nhlId: number; name: string; /** Team of the player's latest game (per-game team_id). */ team: string; position: string };
/** Edition rule for the form card. A different window needs a new id and a documented transition (CONTRACT.md). */
export const RECENT_FORM_RULE = "recent-form-v1-early" as const;
/** Recent Form (recent-form-v1-early): P/GP over the last 5 appearances vs the preceding 5, all in the current season. */
/** Sparkline values, oldest first: one per game (or per date for movers); null is a gap, never interpolated. Absent or null: no sparkline. */
export type ShareSeries = (number | null)[] | null;
export type ShareHotRow = ShareTrendWho & { lastGame: string; recent: number; preceding: number; delta: number; /** Points in each of the last 10 games. */ series?: ShareSeries };
/** PP unit in one game: a unit number, "none" (the game has PP rows and the player is absent) or null (unknown). */
export type SharePpState = number | "none" | null;
export type ShareDeploymentRow = ShareTrendWho & {
  lastGame: string;
  /** TOI per game in seconds: L5 vs season; EV from the ev rows and PP from the all row (null when unknown). */
  toi: { l5: number; season: number }; ev: { l5: number | null; season: number | null }; pp: { l5: number | null; season: number | null };
  delta: number;
  /** Column: "toi" when abs(TOI change) ≥ 1:00 (column by its sign), else "role" (column by the line/PP direction). */
  driver: "toi" | "role";
  /** Line/pair and PP unit in the latest game vs the previous contiguous game (null when not provable). */
  line: { now: string | null; before: string | null }; ppUnit: { now: SharePpState; before: SharePpState };
  teamChange: boolean; lineChange: -1 | 0 | 1; ppChange: -1 | 0 | 1;
  /** TOI (seconds) in each of the last 10 games. */
  series?: ShareSeries;
};
export type ShareRateRow = ShareTrendWho & { l5: number; season: number; delta: number; l5Minutes: number; /** The rate in each of the last 10 games. */ series?: ShareSeries };
/** Percentage-point change in Yahoo rostered % between two dated observations; never adds or drops. */
export type ShareMoverRow = ShareTrendWho & { latest: number; previous: number; delta: number; /** Rostered % on each of ownershipSeriesDates. */ series?: ShareSeries };
export type ShareTrendSectionState = { state: ShareDataState; reasons: string[] };
export type ShareTrendLayer = {
  name: "FHFH rolling game metrics + Yahoo ownership";
  version: 2;
  season: number;
  fetchedAt: string | null;
  /** Newest game date among included skaters, and the newest rolling-row update time (the writer's last run). */
  metricsThrough: string | null;
  metricsUpdatedAt: string | null;
  /** The two Yahoo observation dates the movers compare (latest, and the latest on or before 5 days earlier). */
  ownershipLatestDate: string | null;
  ownershipPreviousDate: string | null;
  /** The movers sparkline's dates (comparison date to latest, inclusive); absent or null when not available. */
  ownershipSeriesDates?: string[] | null;
  /** Each section is gated on its own sources; only the players a card shows are present. */
  sections: {
    hot: ShareTrendSectionState & { rule: typeof RECENT_FORM_RULE; qualifiers: number; hot: ShareHotRow[]; cold: ShareHotRow[] };
    deployment: ShareTrendSectionState & { up: ShareDeploymentRow[]; down: ShareDeploymentRow[] };
    rates: ShareTrendSectionState & { sogPer60: ShareRateRow[]; icfPer60: ShareRateRow[]; ixgPer60: ShareRateRow[] };
    movers: ShareTrendSectionState & { risers: ShareMoverRow[]; fallers: ShareMoverRow[] };
  };
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
