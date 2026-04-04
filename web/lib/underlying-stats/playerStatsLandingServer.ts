import type { SupabaseClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { Pool } from "pg";

import supabase from "lib/supabase/server";
import type { Database } from "lib/supabase/database-generated.types";
import {
  getGoalModifierFromRawEvent,
  type ParsedNhlPbpEvent,
} from "lib/supabase/Upserts/nhlPlayByPlayParser";
import type {
  GoalieCountsRow,
  NhlNstParityMetricsOutput,
  SkaterCountsOiRow,
  SkaterCountsRow,
} from "lib/supabase/Upserts/nhlNstParityMetrics";
import { buildNstParityMetrics } from "lib/supabase/Upserts/nhlNstParityMetrics";
import { buildShotFeatureRows } from "lib/supabase/Upserts/nhlShotFeatureBuilder";
import {
  classifyTeamStrengthState,
  getEventOwnerSide,
  parseSituationCode,
} from "lib/supabase/Upserts/nhlStrengthState";
import {
  buildLandingTradeDisplay,
  matchesPlayerStatsPositionGroup,
  normalizeCanonicalPlayerPositionCode,
  type CanonicalPlayerPositionCode,
  type PlayerStatsDetailApiRow,
  type PlayerStatsLandingApiRow,
} from "./playerStatsQueries";

import type {
  PlayerStatsDetailFilterState,
  PlayerStatsDisplayMode,
  PlayerStatsFilterState,
  PlayerStatsLandingFilterState,
  PlayerStatsMode,
  PlayerStatsSeasonType,
  PlayerStatsSortDirection,
  PlayerStatsStrength,
  PlayerStatsTableFamily,
  PlayerStatsTablePaginationMeta,
} from "./playerStatsTypes";

export type PlayerStatsSourceGameRow =
  Pick<
    Database["public"]["Tables"]["games"]["Row"],
    | "id"
    | "seasonId"
    | "type"
    | "date"
    | "startTime"
    | "homeTeamId"
    | "awayTeamId"
  >;
export type PlayerStatsSourceEventRow = Pick<
  Database["public"]["Tables"]["nhl_api_pbp_events"]["Row"],
  | "game_id"
  | "season_id"
  | "game_date"
  | "event_id"
  | "sort_order"
  | "source_play_by_play_hash"
  | "period_number"
  | "period_type"
  | "time_in_period"
  | "time_remaining"
  | "time_remaining_seconds"
  | "period_seconds_elapsed"
  | "situation_code"
  | "away_goalie"
  | "away_skaters"
  | "home_skaters"
  | "home_goalie"
  | "strength_exact"
  | "strength_state"
  | "home_team_defending_side"
  | "type_code"
  | "type_desc_key"
  | "event_owner_team_id"
  | "is_shot_like"
  | "is_goal"
  | "is_penalty"
  | "losing_player_id"
  | "winning_player_id"
  | "shooting_player_id"
  | "scoring_player_id"
  | "goalie_in_net_id"
  | "blocking_player_id"
  | "hitting_player_id"
  | "hittee_player_id"
  | "committed_by_player_id"
  | "drawn_by_player_id"
  | "served_by_player_id"
  | "player_id"
  | "assist1_player_id"
  | "assist2_player_id"
  | "shot_type"
  | "penalty_type_code"
  | "penalty_desc_key"
  | "penalty_duration_minutes"
  | "reason"
  | "secondary_reason"
  | "x_coord"
  | "y_coord"
  | "zone_code"
  | "home_score"
  | "away_score"
  | "home_sog"
  | "away_sog"
>;
export type PlayerStatsSourceShiftRow = Pick<
  Database["public"]["Tables"]["nhl_api_shift_rows"]["Row"],
  | "game_id"
  | "shift_id"
  | "season_id"
  | "game_date"
  | "player_id"
  | "team_id"
  | "team_abbrev"
  | "first_name"
  | "last_name"
  | "period"
  | "shift_number"
  | "start_seconds"
  | "end_seconds"
  | "duration_seconds"
>;
export type PlayerStatsSourceRosterSpotRow = Pick<
  Database["public"]["Tables"]["nhl_api_game_roster_spots"]["Row"],
  | "game_id"
  | "team_id"
  | "player_id"
  | "first_name"
  | "last_name"
  | "sweater_number"
  | "position_code"
>;
export type PlayerStatsLandingSourceBundle = {
  games: PlayerStatsSourceGameRow[];
  eventsByGameId: Map<number, PlayerStatsSourceEventRow[]>;
  shiftRowsByGameId: Map<number, PlayerStatsSourceShiftRow[]>;
  rosterSpotsByGameId: Map<number, PlayerStatsSourceRosterSpotRow[]>;
  ownGoalEventIdsByGameId: Map<number, Set<number>>;
};
export type PlayerStatsLandingNativeGameParity = {
  game: PlayerStatsSourceGameRow;
  parity: NhlNstParityMetricsOutput;
  shotFeatures: ReturnType<typeof buildShotFeatureRows>;
};

type PlayerStatsSupabaseClient = SupabaseClient<Database>;
type PlayerRow = Pick<
  Database["public"]["Tables"]["players"]["Row"],
  "id" | "fullName" | "position"
>;
type TeamRow = Pick<
  Database["public"]["Tables"]["teams"]["Row"],
  "id" | "abbreviation"
>;
type PlayerStatsSummaryPayloadRow = Pick<
  Database["public"]["Tables"]["nhl_api_game_payloads_raw"]["Row"],
  "game_id" | "payload" | "fetched_at" | "source_url"
>;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

const NHL_REGULATION_PERIOD_SECONDS = 20 * 60;
const NHL_REGULAR_SEASON_OVERTIME_SECONDS = 5 * 60;
const SUPABASE_PAGE_SIZE = 1000;
const GAME_ID_CHUNK_SIZE = 50;
export const PLAYER_STATS_SUMMARY_ENDPOINT = "underlying-player-summary-v1";
export const PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT = "landing";
export const PLAYER_STATS_SUMMARY_SOURCE_URL_PREFIX =
  "derived://underlying-player-summary/";
export const PLAYER_STATS_SUMMARY_PARTITION_SOURCE_URL_PREFIX =
  "derived://underlying-player-summary-v2/";
const PLAYER_STATS_SUMMARY_VERSION = 1;
const PLAYER_STATS_SEASON_AGGREGATE_CACHE_TTL_MS = 10 * 60 * 1000;
const PLAYER_STATS_SOURCE_GAME_SELECT =
  "id,seasonId,type,date,startTime,homeTeamId,awayTeamId";
const PLAYER_STATS_SOURCE_EVENT_SELECT = [
  "game_id",
  "season_id",
  "game_date",
  "event_id",
  "sort_order",
  "period_number",
  "period_type",
  "time_in_period",
  "time_remaining",
  "period_seconds_elapsed",
  "situation_code",
  "away_goalie",
  "away_skaters",
  "home_skaters",
  "home_goalie",
  "strength_exact",
  "strength_state",
  "home_team_defending_side",
  "type_code",
  "type_desc_key",
  "event_owner_team_id",
  "is_shot_like",
  "is_goal",
  "is_penalty",
  "losing_player_id",
  "winning_player_id",
  "shooting_player_id",
  "scoring_player_id",
  "goalie_in_net_id",
  "blocking_player_id",
  "hitting_player_id",
  "hittee_player_id",
  "committed_by_player_id",
  "drawn_by_player_id",
  "served_by_player_id",
  "player_id",
  "assist1_player_id",
  "assist2_player_id",
  "shot_type",
  "penalty_type_code",
  "penalty_desc_key",
  "penalty_duration_minutes",
  "reason",
  "secondary_reason",
  "x_coord",
  "y_coord",
  "zone_code",
  "home_score",
  "away_score",
  "home_sog",
  "away_sog",
].join(",");
const PLAYER_STATS_SOURCE_SHIFT_SELECT = [
  "game_id",
  "shift_id",
  "season_id",
  "game_date",
  "player_id",
  "team_id",
  "team_abbrev",
  "first_name",
  "last_name",
  "period",
  "shift_number",
  "start_seconds",
  "end_seconds",
  "duration_seconds",
].join(",");
const PLAYER_STATS_SOURCE_ROSTER_SELECT = [
  "game_id",
  "team_id",
  "player_id",
  "first_name",
  "last_name",
  "sweater_number",
  "position_code",
].join(",");
const PLAYER_STATS_PG_SOURCE_EVENT_SELECT = PLAYER_STATS_SOURCE_EVENT_SELECT;
const PLAYER_STATS_PG_SOURCE_SHIFT_SELECT = PLAYER_STATS_SOURCE_SHIFT_SELECT;
const PLAYER_STATS_PG_SOURCE_ROSTER_SELECT = PLAYER_STATS_SOURCE_ROSTER_SELECT;

let playerStatsPgPool: Pool | null = null;

type PlayerStatsSupportedStrength =
  | "allStrengths"
  | "evenStrength"
  | "fiveOnFive"
  | "powerPlay"
  | "penaltyKill";

type PlayerStatsNativeSkaterSplitKey =
  keyof NhlNstParityMetricsOutput["skaters"];
type PlayerStatsNativeGoalieSplitKey =
  keyof NhlNstParityMetricsOutput["goalies"];

type PlayerStatsLandingPlayerIdentity = {
  playerId: number;
  playerName: string;
  positionCode: CanonicalPlayerPositionCode;
};

type PlayerStatsLandingGameContextBase = PlayerStatsLandingPlayerIdentity & {
  gameId: number;
  seasonId: number;
  gameDate: string;
  teamId: number;
  teamAbbrev: string | null;
  opponentTeamId: number;
  isHome: boolean;
  hasReliableToi: boolean;
};

type PlayerStatsLandingIndividualContext = PlayerStatsLandingGameContextBase & {
  kind: "individual";
  counts: SkaterCountsRow;
  onIceCounts: SkaterCountsOiRow | null;
};

type PlayerStatsLandingOnIceContext = PlayerStatsLandingGameContextBase & {
  kind: "onIce";
  counts: SkaterCountsOiRow;
};

type PlayerStatsLandingGoalieContext = PlayerStatsLandingGameContextBase & {
  kind: "goalies";
  counts: GoalieCountsRow;
  shotFeatures: ReturnType<typeof buildShotFeatureRows>;
};

type PlayerStatsLandingAppearanceContext =
  | PlayerStatsLandingIndividualContext
  | PlayerStatsLandingOnIceContext
  | PlayerStatsLandingGoalieContext;

type PlayerStatsLandingIdentityMaps = {
  playersById: Map<number, PlayerRow>;
  teamsById: Map<number, TeamRow>;
  fallbackPlayerNamesById: Map<number, string>;
};

type PlayerStatsLandingAggregateMetrics = {
  toiSeconds: number;
  gamesPlayed: number;
  onIceGoalsForForIpp: number;
  hasUnknownToi: boolean;
  hasUnknownOnIceGoalDenominator: boolean;
  individual: {
    goals: number;
    totalAssists: number;
    firstAssists: number;
    secondAssists: number;
    shots: number;
    ixg: number | null;
    iCf: number;
    iFf: number;
    iScf: number | null;
    iHdcf: number | null;
    rushAttempts: number;
    reboundsCreated: number;
    pim: number;
    totalPenalties: number;
    minorPenalties: number;
    majorPenalties: number;
    misconductPenalties: number;
    penaltiesDrawn: number;
    giveaways: number;
    takeaways: number;
    hits: number;
    hitsTaken: number;
    shotsBlocked: number;
    faceoffsWon: number;
    faceoffsLost: number;
  };
  onIce: {
    cf: number;
    ca: number;
    ff: number;
    fa: number;
    sf: number;
    sa: number;
    gf: number;
    ga: number;
    xgf: number | null;
    xga: number | null;
    scf: number | null;
    sca: number | null;
    hdcf: number | null;
    hdca: number | null;
    hdgf: number | null;
    hdga: number | null;
    mdcf: number | null;
    mdca: number | null;
    mdgf: number | null;
    mdga: number | null;
    ldcf: number | null;
  };
  goalies: {
    shotsAgainst: number;
    saves: number;
    goalsAgainst: number;
    xgAgainst: number | null;
    hdShotsAgainst: number;
    hdSaves: number;
    hdGoalsAgainst: number;
    hdXgAgainst: number | null;
    mdShotsAgainst: number;
    mdSaves: number;
    mdGoalsAgainst: number;
    mdXgAgainst: number | null;
    ldShotsAgainst: number;
    ldSaves: number;
    ldGoalsAgainst: number;
    ldXgAgainst: number | null;
    rushAttemptsAgainst: number;
    reboundAttemptsAgainst: number;
    shotDistanceTotal: number;
    shotDistanceCount: number;
    goalDistanceTotal: number;
    goalDistanceCount: number;
  };
};

type PlayerStatsLandingAggregationRow = {
  rowKey: string;
  playerId: number;
  playerName: string;
  positionCode: CanonicalPlayerPositionCode;
  teamId: number | null;
  teamLabel: string;
  gamesPlayed: number;
  toiSeconds: number | null;
  toiPerGameSeconds: number | null;
  metrics: PlayerStatsLandingAggregateMetrics;
};

type PlayerStatsLandingAggregationResult = {
  family: PlayerStatsTableFamily;
  rows: PlayerStatsLandingApiRow[];
  pagination: PlayerStatsTablePaginationMeta;
  sort: PlayerStatsLandingFilterState["view"]["sort"];
};

type PlayerStatsDetailAggregationRow = PlayerStatsLandingAggregationRow & {
  seasonId: number;
  seasonLabel: string;
};

type PlayerStatsDetailAggregationResult = {
  playerId: number;
  family: PlayerStatsTableFamily;
  rows: PlayerStatsDetailApiRow[];
  pagination: PlayerStatsTablePaginationMeta;
  sort: PlayerStatsDetailFilterState["view"]["sort"];
};

type PlayerStatsSeasonAggregateCacheEntry = {
  cachedAt: number;
  rows: PlayerStatsLandingAggregationRow[];
};

type PlayerStatsLandingSummaryRow = {
  kind: PlayerStatsLandingAppearanceContext["kind"];
  mode: PlayerStatsMode;
  strength: PlayerStatsSupportedStrength;
  supportedDisplayModes: PlayerStatsDisplayMode[];
  playerId: number;
  playerName: string;
  positionCode: CanonicalPlayerPositionCode;
  gameId: number;
  seasonId: number;
  gameDate: string;
  teamId: number;
  teamAbbrev: string | null;
  opponentTeamId: number;
  isHome: boolean;
  hasReliableToi: boolean;
  metrics: PlayerStatsLandingAggregateMetrics;
};

type PlayerStatsLandingSummaryPayload = {
  version: number;
  generatedAt: string;
  game: {
    id: number;
    seasonId: number;
    date: string;
    homeTeamId: number;
    awayTeamId: number;
  };
  rows: PlayerStatsLandingSummaryRow[];
};

const playerStatsSeasonAggregateCache = new Map<
  string,
  PlayerStatsSeasonAggregateCacheEntry
>();

export type PlayerStatsLandingSummarySnapshotRow = Pick<
  Database["public"]["Tables"]["nhl_api_game_payloads_raw"]["Insert"],
  | "game_id"
  | "endpoint"
  | "season_id"
  | "game_date"
  | "source_url"
  | "payload_hash"
  | "payload"
  | "fetched_at"
>;

type SupabasePagedResult<TRow> = {
  data: TRow[] | null;
  error: unknown;
};

function chunkNumberArray(
  values: readonly number[],
  chunkSize: number
): number[][] {
  if (chunkSize <= 0) {
    return [Array.from(values)];
  }

  const chunks: number[][] = [];

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
}

function sha256Json(payload: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function fetchAllSupabaseRows<TRow>(
  fetchPage: (from: number, to: number) => PromiseLike<{
    data: unknown[] | null;
    error: unknown;
  }>
): Promise<TRow[]> {
  const rows: TRow[] = [];

  for (let offset = 0; ; offset += SUPABASE_PAGE_SIZE) {
    const result = await fetchPage(offset, offset + SUPABASE_PAGE_SIZE - 1);

    if (result.error) {
      throw result.error;
    }

    const pageRows = (result.data ?? []) as TRow[];
    rows.push(...pageRows);

    if (pageRows.length < SUPABASE_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

function getPlayerStatsPgPool(): Pool | null {
  const dbConfig = readPlayerStatsDbConfigFromEnv();
  if (dbConfig == null) {
    return null;
  }

  if (playerStatsPgPool == null) {
    playerStatsPgPool = new Pool({
      ...dbConfig,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 4,
    });
  }

  return playerStatsPgPool;
}

function readPlayerStatsDbConfigFromEnv():
  | {
      user: string;
      password: string;
      host: string;
      port: number;
      database: string;
    }
  | null {
  const rawUrl = process.env.SUPABASE_DB_URL;

  if (!rawUrl) {
    return null;
  }

  const withoutPrefix = rawUrl.replace(/^postgresql:\/\//, "");
  const atIndex = withoutPrefix.lastIndexOf("@");

  if (atIndex === -1) {
    throw new Error("Unexpected SUPABASE_DB_URL format: missing credential delimiter.");
  }

  const creds = withoutPrefix.slice(0, atIndex);
  const hostPart = withoutPrefix.slice(atIndex + 1);
  const colonIndex = creds.indexOf(":");

  if (colonIndex === -1) {
    throw new Error("Unexpected SUPABASE_DB_URL format: missing password delimiter.");
  }

  const user = creds.slice(0, colonIndex);
  const password = creds.slice(colonIndex + 1);
  const hostMatch = hostPart.match(/^([^:]+):(\d+)\/([^?]+)(\?.*)?$/);

  if (!hostMatch) {
    throw new Error("Unexpected SUPABASE_DB_URL format: missing host, port, or database.");
  }

  const [, host, port, database] = hostMatch;

  return {
    user,
    password,
    host,
    port: Number(port),
    database,
  };
}

async function fetchPlayerStatsPgRows<TRow extends Record<string, unknown>>(
  query: string,
  params: unknown[]
): Promise<TRow[]> {
  const pool = getPlayerStatsPgPool();
  if (pool == null) {
    throw new Error("SUPABASE_DB_URL is required for direct landing aggregation SQL.");
  }

  const client = await pool.connect();

  try {
    await client.query("SET statement_timeout TO '300000'");
    const result = await client.query(query, params);
    return result.rows as TRow[];
  } finally {
    client.release();
  }
}

async function fetchSupabaseRowsForGameChunks<TRow>(args: {
  gameIdChunks: readonly number[][];
  fetchChunkPage: (
    gameIdChunk: readonly number[],
    from: number,
    to: number
  ) => PromiseLike<{
    data: unknown[] | null;
    error: unknown;
  }>;
}): Promise<TRow[]> {
  const rows: TRow[] = [];

  for (const gameIdChunk of args.gameIdChunks) {
    const chunkRows = await fetchAllSupabaseRows<TRow>((from, to) =>
      args.fetchChunkPage(gameIdChunk, from, to)
    );
    rows.push(...chunkRows);
  }

  return rows;
}

export function resolvePlayerStatsSeasonGameType(
  seasonType: PlayerStatsSeasonType
): number {
  if (seasonType === "preSeason") {
    return 1;
  }

  if (seasonType === "playoffs") {
    return 3;
  }

  return 2;
}

function isFinishedPlayerStatsSourceGame(
  game: Pick<PlayerStatsSourceGameRow, "date" | "startTime">,
  now: Date
): boolean {
  const today = now.toISOString().slice(0, 10);

  if (game.date < today) {
    return true;
  }

  if (game.date > today) {
    return false;
  }

  if (typeof game.startTime !== "string") {
    return false;
  }

  const finishedCutoff = new Date(now.getTime() - 8 * 60 * 60 * 1000);
  return new Date(game.startTime) <= finishedCutoff;
}

export function filterPlayerStatsLandingSourceGames(
  games: readonly PlayerStatsSourceGameRow[],
  state: PlayerStatsLandingFilterState,
  now: Date = new Date()
): PlayerStatsSourceGameRow[] {
  const fromSeasonId = state.primary.seasonRange.fromSeasonId;
  const throughSeasonId = state.primary.seasonRange.throughSeasonId;
  const gameType = resolvePlayerStatsSeasonGameType(state.primary.seasonType);
  const teamId = state.expandable.teamId;
  const venue = state.expandable.venue;
  const scope = state.expandable.scope;

  return [...games]
    .filter((game) => {
      if (!isFinishedPlayerStatsSourceGame(game, now)) {
        return false;
      }

      if (fromSeasonId != null && game.seasonId < fromSeasonId) {
        return false;
      }

      if (throughSeasonId != null && game.seasonId > throughSeasonId) {
        return false;
      }

      if (game.type !== gameType) {
        return false;
      }

      if (scope.kind === "dateRange") {
        if (scope.startDate != null && game.date < scope.startDate) {
          return false;
        }

        if (scope.endDate != null && game.date > scope.endDate) {
          return false;
        }
      }

      if (teamId == null) {
        return true;
      }

      const involvesTeam = game.homeTeamId === teamId || game.awayTeamId === teamId;
      if (!involvesTeam) {
        return false;
      }

      if (venue === "home") {
        return game.homeTeamId === teamId;
      }

      if (venue === "away") {
        return game.awayTeamId === teamId;
      }

      return true;
    })
    .sort((left, right) => {
      if (left.date !== right.date) {
        return left.date.localeCompare(right.date);
      }

      return left.id - right.id;
    });
}

function resolvePeriodDurationSeconds(
  row: PlayerStatsSourceEventRow
): number | null {
  if (
    row.period_seconds_elapsed != null &&
    row.time_remaining_seconds != null
  ) {
    return row.period_seconds_elapsed + row.time_remaining_seconds;
  }

  const normalizedPeriodType = row.period_type?.trim().toUpperCase() ?? null;
  if (normalizedPeriodType === "SO" || normalizedPeriodType === "SHOOTOUT") {
    return 0;
  }

  if (
    normalizedPeriodType === "OT" ||
    normalizedPeriodType === "OVERTIME" ||
    normalizedPeriodType === "REGULAR_SEASON_OT"
  ) {
    return NHL_REGULAR_SEASON_OVERTIME_SECONDS;
  }

  return NHL_REGULATION_PERIOD_SECONDS;
}

function resolveGameSecondsElapsed(
  row: PlayerStatsSourceEventRow,
  periodDurationSeconds: number | null
): number | null {
  if (row.period_number == null || row.period_seconds_elapsed == null) {
    return null;
  }

  const completedPeriods = Math.max(row.period_number - 1, 0);
  const basePeriodDuration =
    periodDurationSeconds == null || row.period_number <= 3
      ? NHL_REGULATION_PERIOD_SECONDS
      : periodDurationSeconds;

  return completedPeriods * basePeriodDuration + row.period_seconds_elapsed;
}

function extractOwnGoalEventIdsFromLandingPayload(payload: unknown): Set<number> {
  if (!isObjectRecord(payload)) {
    return new Set();
  }

  const summary = payload.summary;
  if (!isObjectRecord(summary) || !Array.isArray(summary.scoring)) {
    return new Set();
  }

  const ownGoalEventIds = new Set<number>();

  for (const period of summary.scoring) {
    if (!isObjectRecord(period) || !Array.isArray(period.goals)) {
      continue;
    }

    for (const goal of period.goals) {
      if (!isObjectRecord(goal)) {
        continue;
      }

      if (getGoalModifierFromRawEvent(goal) !== "own-goal") {
        continue;
      }

      const eventId = Number(goal.eventId);
      if (Number.isFinite(eventId)) {
        ownGoalEventIds.add(eventId);
      }
    }
  }

  return ownGoalEventIds;
}

function buildOwnGoalEventIdsByGameId(
  payloadRows: readonly PlayerStatsSummaryPayloadRow[]
): Map<number, Set<number>> {
  const ownGoalEventIdsByGameId = new Map<number, Set<number>>();

  for (const row of payloadRows) {
    if (row.source_url?.startsWith("derived://")) {
      continue;
    }

    if (ownGoalEventIdsByGameId.has(row.game_id)) {
      continue;
    }

    ownGoalEventIdsByGameId.set(
      row.game_id,
      extractOwnGoalEventIdsFromLandingPayload(row.payload)
    );
  }

  return ownGoalEventIdsByGameId;
}

function buildTaggedOwnGoalRawEvent(
  eventId: number
): ParsedNhlPbpEvent["raw_event"] {
  return {
    eventId,
    goalModifier: "own-goal",
  };
}

export function buildStoredPbpEventSequence(
  rows: readonly PlayerStatsSourceEventRow[],
  game: Pick<PlayerStatsSourceGameRow, "homeTeamId" | "awayTeamId">,
  ownGoalEventIds: ReadonlySet<number> = new Set()
): ParsedNhlPbpEvent[] {
  const sorted = [...rows].sort((left, right) => {
    const leftOrder = left.sort_order ?? left.event_id;
    const rightOrder = right.sort_order ?? right.event_id;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.event_id - right.event_id;
  });

  return sorted.map((row, index) => {
    const previous = index > 0 ? sorted[index - 1] : null;
    const next = index < sorted.length - 1 ? sorted[index + 1] : null;
    const periodDurationSeconds = resolvePeriodDurationSeconds(row);
    const gameSecondsElapsed = resolveGameSecondsElapsed(
      row,
      periodDurationSeconds
    );
    const previousGameSecondsElapsed =
      previous == null
        ? null
        : resolveGameSecondsElapsed(
            previous,
            resolvePeriodDurationSeconds(previous)
          );

    return {
      ...row,
      raw_event: ownGoalEventIds.has(row.event_id)
        ? buildTaggedOwnGoalRawEvent(row.event_id)
        : null,
      details: null,
      event_owner_side: getEventOwnerSide(
        row.event_owner_team_id,
        game.homeTeamId,
        game.awayTeamId
      ),
      event_index: index,
      period_duration_seconds: periodDurationSeconds,
      game_seconds_elapsed: gameSecondsElapsed,
      previous_event_id: previous?.event_id ?? null,
      previous_event_sort_order: previous?.sort_order ?? null,
      previous_event_type_desc_key: previous?.type_desc_key ?? null,
      next_event_id: next?.event_id ?? null,
      next_event_sort_order: next?.sort_order ?? null,
      next_event_type_desc_key: next?.type_desc_key ?? null,
      seconds_since_previous_event:
        gameSecondsElapsed != null && previousGameSecondsElapsed != null
          ? gameSecondsElapsed - previousGameSecondsElapsed
          : null,
    };
  });
}

export function buildPlayerStatsNativeGameParity(args: {
  game: PlayerStatsSourceGameRow;
  events: readonly PlayerStatsSourceEventRow[];
  shiftRows: readonly PlayerStatsSourceShiftRow[];
  ownGoalEventIds?: ReadonlySet<number>;
}) {
  const parsedEvents = buildStoredPbpEventSequence(
    args.events,
    args.game,
    args.ownGoalEventIds
  );
  const shotFeatures = buildShotFeatureRows(
    parsedEvents,
    [...args.shiftRows],
    args.game.homeTeamId,
    args.game.awayTeamId
  );

  return {
    parity: buildNstParityMetrics(parsedEvents, shotFeatures, [...args.shiftRows], {
      date: args.game.date,
      season: args.game.seasonId,
      homeTeamId: args.game.homeTeamId,
      awayTeamId: args.game.awayTeamId,
    }),
    shotFeatures,
  };
}

export function groupPlayerStatsSourceRowsByGameId<
  TRow extends { game_id: number | null }
>(rows: readonly TRow[]): Map<number, TRow[]> {
  const rowsByGameId = new Map<number, TRow[]>();

  for (const row of rows) {
    if (row.game_id == null) {
      continue;
    }

    const existing = rowsByGameId.get(row.game_id);
    if (existing) {
      existing.push(row);
      continue;
    }

    rowsByGameId.set(row.game_id, [row]);
  }

  return rowsByGameId;
}

async function fetchPlayerStatsSourceGamesForFilterState(
  state: PlayerStatsFilterState,
  client: PlayerStatsSupabaseClient = supabase
): Promise<PlayerStatsSourceGameRow[]> {
  const fromSeasonId = state.primary.seasonRange.fromSeasonId;
  const throughSeasonId = state.primary.seasonRange.throughSeasonId;
  const gameType = resolvePlayerStatsSeasonGameType(state.primary.seasonType);

  const rawGames = await fetchAllSupabaseRows<PlayerStatsSourceGameRow>(async (from, to) => {
    let gamesQuery = client
      .from("games")
      .select(PLAYER_STATS_SOURCE_GAME_SELECT)
      .eq("type", gameType)
      .order("date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);

    if (fromSeasonId != null) {
      gamesQuery = gamesQuery.gte("seasonId", fromSeasonId);
    }

    if (throughSeasonId != null) {
      gamesQuery = gamesQuery.lte("seasonId", throughSeasonId);
    }

    if (state.expandable.scope.kind === "dateRange") {
      if (state.expandable.scope.startDate != null) {
        gamesQuery = gamesQuery.gte("date", state.expandable.scope.startDate);
      }

      if (state.expandable.scope.endDate != null) {
        gamesQuery = gamesQuery.lte("date", state.expandable.scope.endDate);
      }
    }

    return gamesQuery;
  });

  return rawGames ?? [];
}

async function fetchPlayerStatsLandingSourceGames(
  state: PlayerStatsLandingFilterState,
  client: PlayerStatsSupabaseClient = supabase
): Promise<PlayerStatsSourceGameRow[]> {
  const rawGames = await fetchPlayerStatsSourceGamesForFilterState(state, client);
  return filterPlayerStatsLandingSourceGames(rawGames, state);
}

async function fetchPlayerStatsDetailSourceGames(
  state: PlayerStatsDetailFilterState,
  client: PlayerStatsSupabaseClient = supabase
): Promise<PlayerStatsSourceGameRow[]> {
  const rawGames = await fetchPlayerStatsSourceGamesForFilterState(state, client);
  const now = new Date();

  return rawGames.filter((game) => isFinishedPlayerStatsSourceGame(game, now));
}

async function fetchPlayerStatsLandingSourceBundleForGames(args: {
  games: readonly PlayerStatsSourceGameRow[];
  shouldFetchRosterSpots: boolean;
  client?: PlayerStatsSupabaseClient;
}): Promise<PlayerStatsLandingSourceBundle> {
  const client = args.client ?? supabase;
  const games = [...args.games];

  if (games.length === 0) {
    return {
      games: [],
      eventsByGameId: new Map(),
      shiftRowsByGameId: new Map(),
      rosterSpotsByGameId: new Map(),
      ownGoalEventIdsByGameId: new Map(),
    };
  }

  const gameIds = games.map((game) => game.id);
  const gameIdChunks = chunkNumberArray(gameIds, GAME_ID_CHUNK_SIZE);

  const [events, shiftRows, rosterSpots, landingPayloadRows] = await Promise.all([
    fetchSupabaseRowsForGameChunks<PlayerStatsSourceEventRow>({
      gameIdChunks,
      fetchChunkPage: async (gameIdChunk, from, to) =>
        client
          .from("nhl_api_pbp_events")
          .select(PLAYER_STATS_SOURCE_EVENT_SELECT)
          .in("game_id", [...gameIdChunk])
          .order("game_id", { ascending: true })
          .order("sort_order", { ascending: true })
          .order("event_id", { ascending: true })
          .range(from, to),
    }),
    fetchSupabaseRowsForGameChunks<PlayerStatsSourceShiftRow>({
      gameIdChunks,
      fetchChunkPage: async (gameIdChunk, from, to) =>
        client
          .from("nhl_api_shift_rows")
          .select(PLAYER_STATS_SOURCE_SHIFT_SELECT)
          .in("game_id", [...gameIdChunk])
          .order("game_id", { ascending: true })
          .order("period", { ascending: true })
          .order("start_seconds", { ascending: true })
          .range(from, to),
    }),
    args.shouldFetchRosterSpots
      ? fetchSupabaseRowsForGameChunks<PlayerStatsSourceRosterSpotRow>({
          gameIdChunks,
          fetchChunkPage: async (gameIdChunk, from, to) =>
            client
              .from("nhl_api_game_roster_spots")
              .select(PLAYER_STATS_SOURCE_ROSTER_SELECT)
              .in("game_id", [...gameIdChunk])
              .order("game_id", { ascending: true })
              .order("team_id", { ascending: true })
              .order("player_id", { ascending: true })
              .range(from, to),
        })
      : Promise.resolve([]),
    fetchPlayerStatsOfficialLandingPayloadRows({
      gameIds,
      client,
    }),
  ]);

  return {
    games,
    eventsByGameId: groupPlayerStatsSourceRowsByGameId(events),
    shiftRowsByGameId: groupPlayerStatsSourceRowsByGameId(shiftRows),
    rosterSpotsByGameId: groupPlayerStatsSourceRowsByGameId(rosterSpots),
    ownGoalEventIdsByGameId: buildOwnGoalEventIdsByGameId(landingPayloadRows),
  };
}

export async function fetchPlayerStatsLandingSourceBundle(
  state: PlayerStatsLandingFilterState,
  client: PlayerStatsSupabaseClient = supabase
): Promise<PlayerStatsLandingSourceBundle> {
  if (client === supabase && getPlayerStatsPgPool() != null) {
    try {
      return await fetchPlayerStatsLandingSourceBundleViaPg(state);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? "Unknown PG error");
      const isConnectionFailure =
        message.includes("ENOTFOUND") ||
        message.includes("ECONNREFUSED") ||
        message.includes("timeout") ||
        message.includes("connect");

      if (!isConnectionFailure) {
        throw error;
      }

      if (process.env.NODE_ENV !== "test") {
        console.warn("[player-stats] falling back from direct PG to Supabase", {
          reason: message,
        });
      }
    }
  }

  const games = await fetchPlayerStatsLandingSourceGames(state, client);

  return fetchPlayerStatsLandingSourceBundleForGames({
    games,
    shouldFetchRosterSpots: state.primary.statMode === "individual",
    client,
  });
}

async function fetchPlayerStatsLandingSourceBundleViaPg(
  state: PlayerStatsLandingFilterState
): Promise<PlayerStatsLandingSourceBundle> {
  const fromSeasonId = state.primary.seasonRange.fromSeasonId;
  const throughSeasonId = state.primary.seasonRange.throughSeasonId;
  const gameType = resolvePlayerStatsSeasonGameType(state.primary.seasonType);
  const shouldFetchRosterSpots = state.primary.statMode === "individual";
  const gameQueryParts = [
    `select id, "seasonId", "type", "date", "homeTeamId", "awayTeamId"`,
    `from public.games`,
    `where "type" = $1`,
  ];
  const gameParams: unknown[] = [gameType];

  if (fromSeasonId != null) {
    gameParams.push(fromSeasonId);
    gameQueryParts.push(`and "seasonId" >= $${gameParams.length}`);
  }

  if (throughSeasonId != null) {
    gameParams.push(throughSeasonId);
    gameQueryParts.push(`and "seasonId" <= $${gameParams.length}`);
  }

  if (state.expandable.scope.kind === "dateRange") {
    if (state.expandable.scope.startDate != null) {
      gameParams.push(state.expandable.scope.startDate);
      gameQueryParts.push(`and "date" >= $${gameParams.length}`);
    }

    if (state.expandable.scope.endDate != null) {
      gameParams.push(state.expandable.scope.endDate);
      gameQueryParts.push(`and "date" <= $${gameParams.length}`);
    }
  }

  gameQueryParts.push(`order by "date" asc, id asc`);

  const rawGames = await fetchPlayerStatsPgRows<PlayerStatsSourceGameRow>(
    gameQueryParts.join("\n"),
    gameParams
  );

  const games = filterPlayerStatsLandingSourceGames(rawGames ?? [], state);
  if (games.length === 0) {
    return {
      games: [],
      eventsByGameId: new Map(),
      shiftRowsByGameId: new Map(),
      rosterSpotsByGameId: new Map(),
      ownGoalEventIdsByGameId: new Map(),
    };
  }

  const gameIds = games.map((game) => game.id);
  const [events, shiftRows, rosterSpots, landingPayloadRows] = await Promise.all([
    fetchPlayerStatsPgRows<PlayerStatsSourceEventRow>(
      `select ${PLAYER_STATS_PG_SOURCE_EVENT_SELECT}
       from public.nhl_api_pbp_events
       where game_id = any($1::bigint[])
       order by game_id asc, sort_order asc nulls last, event_id asc`,
      [gameIds]
    ),
    fetchPlayerStatsPgRows<PlayerStatsSourceShiftRow>(
      `select ${PLAYER_STATS_PG_SOURCE_SHIFT_SELECT}
       from public.nhl_api_shift_rows
       where game_id = any($1::bigint[])
       order by game_id asc, period asc, start_seconds asc, shift_id asc`,
      [gameIds]
    ),
    shouldFetchRosterSpots
      ? fetchPlayerStatsPgRows<PlayerStatsSourceRosterSpotRow>(
          `select ${PLAYER_STATS_PG_SOURCE_ROSTER_SELECT}
           from public.nhl_api_game_roster_spots
           where game_id = any($1::bigint[])
           order by game_id asc, team_id asc, player_id asc`,
          [gameIds]
        )
      : Promise.resolve([]),
    fetchPlayerStatsOfficialLandingPayloadRows({
      gameIds,
    }),
  ]);

  return {
    games,
    eventsByGameId: groupPlayerStatsSourceRowsByGameId(events),
    shiftRowsByGameId: groupPlayerStatsSourceRowsByGameId(shiftRows),
    rosterSpotsByGameId: groupPlayerStatsSourceRowsByGameId(rosterSpots),
    ownGoalEventIdsByGameId: buildOwnGoalEventIdsByGameId(landingPayloadRows),
  };
}

async function fetchPlayerStatsLandingGamesByIds(
  gameIds: readonly number[],
  client: PlayerStatsSupabaseClient = supabase
): Promise<PlayerStatsSourceGameRow[]> {
  if (gameIds.length === 0) {
    return [];
  }

  return fetchSupabaseRowsForGameChunks<PlayerStatsSourceGameRow>({
    gameIdChunks: chunkNumberArray(gameIds, GAME_ID_CHUNK_SIZE),
    fetchChunkPage: async (gameIdChunk, from, to) =>
      client
        .from("games")
        .select(PLAYER_STATS_SOURCE_GAME_SELECT)
        .in("id", [...gameIdChunk])
        .order("date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
  });
}

async function fetchPlayerStatsSummaryPayloadRows(args: {
  gameIds: readonly number[];
  sourceUrlPrefix: string;
  client?: PlayerStatsSupabaseClient;
}): Promise<PlayerStatsSummaryPayloadRow[]> {
  const client = args.client ?? supabase;
  if (args.gameIds.length === 0) {
    return [];
  }

  if (client === supabase && getPlayerStatsPgPool() != null) {
    try {
      return await fetchPlayerStatsSummaryPayloadRowsViaPg(args);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? "Unknown PG error");
      const isConnectionFailure =
        message.includes("ENOTFOUND") ||
        message.includes("ECONNREFUSED") ||
        message.includes("timeout") ||
        message.includes("connect");

      if (!isConnectionFailure) {
        throw error;
      }

      if (process.env.NODE_ENV !== "test") {
        console.warn("[player-stats] falling back from direct PG summary read to Supabase", {
          reason: message,
        });
      }
    }
  }

  return fetchSupabaseRowsForGameChunks<PlayerStatsSummaryPayloadRow>({
    gameIdChunks: chunkNumberArray(args.gameIds, GAME_ID_CHUNK_SIZE),
    fetchChunkPage: async (gameIdChunk, from, to) =>
      client
        .from("nhl_api_game_payloads_raw")
        .select("game_id,payload,fetched_at,source_url")
        .eq("endpoint", PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT)
        .like("source_url", `${args.sourceUrlPrefix}%`)
        .in("game_id", [...gameIdChunk])
        .order("game_id", { ascending: true })
        .order("fetched_at", { ascending: false })
        .range(from, to),
  });
}

async function fetchPlayerStatsSummaryPayloadRowsViaPg(args: {
  gameIds: readonly number[];
  sourceUrlPrefix: string;
}): Promise<PlayerStatsSummaryPayloadRow[]> {
  return fetchPlayerStatsPgRows<PlayerStatsSummaryPayloadRow>(
    `select game_id, payload, fetched_at, source_url
     from public.nhl_api_game_payloads_raw
     where endpoint = $1
       and source_url like $2
       and game_id = any($3::bigint[])
     order by game_id asc, fetched_at desc`,
    [
      PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT,
      `${args.sourceUrlPrefix}%`,
      args.gameIds,
    ]
  );
}

async function fetchPlayerStatsOfficialLandingPayloadRows(args: {
  gameIds: readonly number[];
  client?: PlayerStatsSupabaseClient;
}): Promise<PlayerStatsSummaryPayloadRow[]> {
  const client = args.client ?? supabase;
  if (args.gameIds.length === 0) {
    return [];
  }

  if (client === supabase && getPlayerStatsPgPool() != null) {
    try {
      return await fetchPlayerStatsPgRows<PlayerStatsSummaryPayloadRow>(
        `select game_id, payload, fetched_at, source_url
         from public.nhl_api_game_payloads_raw
         where endpoint = $1
           and source_url not like 'derived://%'
           and game_id = any($2::bigint[])
         order by game_id asc, fetched_at desc`,
        [PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT, args.gameIds]
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? "Unknown PG error");
      const isConnectionFailure =
        message.includes("ENOTFOUND") ||
        message.includes("ECONNREFUSED") ||
        message.includes("timeout") ||
        message.includes("connect");

      if (!isConnectionFailure) {
        throw error;
      }

      if (process.env.NODE_ENV !== "test") {
        console.warn("[player-stats] falling back from direct PG landing read to Supabase", {
          reason: message,
        });
      }
    }
  }

  const rows = await fetchSupabaseRowsForGameChunks<PlayerStatsSummaryPayloadRow>({
    gameIdChunks: chunkNumberArray(args.gameIds, GAME_ID_CHUNK_SIZE),
    fetchChunkPage: async (gameIdChunk, from, to) =>
      client
        .from("nhl_api_game_payloads_raw")
        .select("game_id,payload,fetched_at,source_url")
        .eq("endpoint", PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT)
        .in("game_id", [...gameIdChunk])
        .order("game_id", { ascending: true })
        .order("fetched_at", { ascending: false })
        .range(from, to),
  });

  return rows.filter((row) => !row.source_url?.startsWith("derived://"));
}

export function buildPlayerStatsLandingParityByGame(
  bundle: PlayerStatsLandingSourceBundle
): PlayerStatsLandingNativeGameParity[] {
  return bundle.games.map((game) => {
    const nativeGame = buildPlayerStatsNativeGameParity({
      game,
      events: bundle.eventsByGameId.get(game.id) ?? [],
      ownGoalEventIds: bundle.ownGoalEventIdsByGameId.get(game.id),
      shiftRows: filterShiftRowsForGame(
        game,
        bundle.shiftRowsByGameId.get(game.id) ?? []
      ),
    });

    return {
      game,
      parity: nativeGame.parity,
      shotFeatures: nativeGame.shotFeatures,
    };
  });
}

function resolveLandingTableFamily(
  state: PlayerStatsLandingFilterState
): PlayerStatsTableFamily {
  if (state.primary.statMode === "individual") {
    return state.primary.displayMode === "rates"
      ? "individualRates"
      : "individualCounts";
  }

  if (state.primary.statMode === "goalies") {
    return state.primary.displayMode === "rates" ? "goalieRates" : "goalieCounts";
  }

  return state.primary.displayMode === "rates" ? "onIceRates" : "onIceCounts";
}

function isSupportedLandingStrength(
  strength: PlayerStatsStrength
): strength is PlayerStatsSupportedStrength {
  return (
    strength === "allStrengths" ||
    strength === "evenStrength" ||
    strength === "fiveOnFive" ||
    strength === "powerPlay" ||
    strength === "penaltyKill"
  );
}

function resolveSkaterSplitKey(
  strength: PlayerStatsSupportedStrength
): PlayerStatsNativeSkaterSplitKey {
  if (strength === "allStrengths") {
    return "all";
  }

  if (strength === "evenStrength") {
    return "ev";
  }

  if (strength === "fiveOnFive") {
    return "fiveOnFive";
  }

  if (strength === "powerPlay") {
    return "pp";
  }

  return "pk";
}

function resolveGoalieSplitKey(
  strength: PlayerStatsSupportedStrength
): PlayerStatsNativeGoalieSplitKey {
  if (strength === "allStrengths") {
    return "all";
  }

  if (strength === "evenStrength") {
    return "ev";
  }

  if (strength === "fiveOnFive") {
    return "fiveOnFive";
  }

  if (strength === "powerPlay") {
    return "pp";
  }

  return "pk";
}

function canUsePlayerStatsSeasonAggregateCache(
  state: PlayerStatsLandingFilterState
): state is PlayerStatsLandingFilterState & {
  primary: PlayerStatsLandingFilterState["primary"] & {
    strength: PlayerStatsSupportedStrength;
    scoreState: "allScores";
    seasonRange: {
      fromSeasonId: number;
      throughSeasonId: number;
    };
  };
} {
  const fromSeasonId = state.primary.seasonRange.fromSeasonId;
  const throughSeasonId = state.primary.seasonRange.throughSeasonId;

  return (
    fromSeasonId != null &&
    throughSeasonId != null &&
    fromSeasonId === throughSeasonId &&
    state.primary.scoreState === "allScores" &&
    isSupportedLandingStrength(state.primary.strength) &&
    state.expandable.teamId == null &&
    state.expandable.venue === "all" &&
    state.expandable.tradeMode === "combine" &&
    state.expandable.scope.kind === "none"
  );
}

function getPlayerStatsSeasonAggregateCacheKey(
  state: PlayerStatsLandingFilterState & {
    primary: PlayerStatsLandingFilterState["primary"] & {
      strength: PlayerStatsSupportedStrength;
      seasonRange: {
        fromSeasonId: number;
        throughSeasonId: number;
      };
    };
  }
): string {
  return [
    state.primary.seasonRange.fromSeasonId,
    state.primary.seasonType,
    state.primary.statMode,
    state.primary.strength,
  ].join(":");
}

function getCachedPlayerStatsSeasonAggregateRows(
  key: string
): PlayerStatsLandingAggregationRow[] | null {
  const cached = playerStatsSeasonAggregateCache.get(key);
  if (!cached) {
    return null;
  }

  if (Date.now() - cached.cachedAt > PLAYER_STATS_SEASON_AGGREGATE_CACHE_TTL_MS) {
    playerStatsSeasonAggregateCache.delete(key);
    return null;
  }

  return cached.rows;
}

function setCachedPlayerStatsSeasonAggregateRows(
  key: string,
  rows: readonly PlayerStatsLandingAggregationRow[]
) {
  playerStatsSeasonAggregateCache.set(key, {
    cachedAt: Date.now(),
    rows: [...rows],
  });
}

export function invalidatePlayerStatsSeasonAggregateCache() {
  playerStatsSeasonAggregateCache.clear();
}

function buildPlayerStatsSeasonAggregateBaseState(
  state: PlayerStatsLandingFilterState & {
    primary: PlayerStatsLandingFilterState["primary"] & {
      strength: PlayerStatsSupportedStrength;
      seasonRange: {
        fromSeasonId: number;
        throughSeasonId: number;
      };
    };
  }
): PlayerStatsLandingFilterState {
  return {
    ...state,
    expandable: {
      ...state.expandable,
      teamId: null,
      positionGroup: null,
      venue: "all",
      minimumToiSeconds: null,
      scope: { kind: "none" },
      tradeMode: "combine",
    },
  };
}

function compareGamesDescending(
  left: Pick<PlayerStatsSourceGameRow, "date" | "id">,
  right: Pick<PlayerStatsSourceGameRow, "date" | "id">
): number {
  if (left.date !== right.date) {
    return right.date.localeCompare(left.date);
  }

  return right.id - left.id;
}

function toPctDecimal(
  numerator: number | null,
  denominator: number | null
): number | null {
  if (numerator == null || denominator == null || denominator <= 0) {
    return null;
  }

  return numerator / denominator;
}

function toPer60(
  numerator: number | null,
  toiSeconds: number | null
): number | null {
  if (numerator == null || toiSeconds == null || toiSeconds <= 0) {
    return null;
  }

  return (numerator * 3600) / toiSeconds;
}

function toGaa(
  goalsAgainst: number,
  toiSeconds: number | null
): number | null {
  if (toiSeconds == null || toiSeconds <= 0) {
    return null;
  }

  return (goalsAgainst * 3600) / toiSeconds;
}

function toAverage(
  total: number,
  count: number
): number | null {
  if (count <= 0) {
    return null;
  }

  return total / count;
}

function addNullable(
  current: number | null,
  delta: number | null
): number | null {
  if (delta == null) {
    return current;
  }

  return (current ?? 0) + delta;
}

function buildFallbackPlayerNamesById(
  bundle: PlayerStatsLandingSourceBundle
): Map<number, string> {
  const namesById = new Map<number, string>();

  for (const shiftRows of bundle.shiftRowsByGameId.values()) {
    for (const shiftRow of shiftRows) {
      const firstName = shiftRow.first_name?.trim() ?? "";
      const lastName = shiftRow.last_name?.trim() ?? "";
      const fullName = `${firstName} ${lastName}`.trim();

      if (fullName && !namesById.has(shiftRow.player_id)) {
        namesById.set(shiftRow.player_id, fullName);
      }
    }
  }

  for (const rosterSpots of bundle.rosterSpotsByGameId.values()) {
    for (const rosterSpot of rosterSpots) {
      const firstName = rosterSpot.first_name?.trim() ?? "";
      const lastName = rosterSpot.last_name?.trim() ?? "";
      const fullName = `${firstName} ${lastName}`.trim();

      if (fullName && !namesById.has(rosterSpot.player_id)) {
        namesById.set(rosterSpot.player_id, fullName);
      }
    }
  }

  return namesById;
}

async function fetchPlayerStatsLandingIdentityMaps(
  bundle: PlayerStatsLandingSourceBundle,
  client: PlayerStatsSupabaseClient = supabase
): Promise<PlayerStatsLandingIdentityMaps> {
  const playerIds = new Set<number>();
  const teamIds = new Set<number>();

  for (const game of bundle.games) {
    teamIds.add(game.homeTeamId);
    teamIds.add(game.awayTeamId);
  }

  for (const shiftRows of bundle.shiftRowsByGameId.values()) {
    for (const shiftRow of shiftRows) {
      playerIds.add(shiftRow.player_id);
      teamIds.add(shiftRow.team_id);
    }
  }

  for (const rosterSpots of bundle.rosterSpotsByGameId.values()) {
    for (const rosterSpot of rosterSpots) {
      playerIds.add(rosterSpot.player_id);
      teamIds.add(rosterSpot.team_id);
    }
  }

  const [playersResult, teamsResult] = await Promise.all([
    playerIds.size > 0
      ? client
          .from("players")
          .select("id,fullName,position")
          .in("id", [...playerIds])
      : Promise.resolve({ data: [], error: null }),
    teamIds.size > 0
      ? client
          .from("teams")
          .select("id,abbreviation")
          .in("id", [...teamIds])
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (playersResult.error) {
    throw playersResult.error;
  }

  if (teamsResult.error) {
    throw teamsResult.error;
  }

  return {
    playersById: new Map((playersResult.data ?? []).map((row) => [row.id, row])),
    teamsById: new Map((teamsResult.data ?? []).map((row) => [row.id, row])),
    fallbackPlayerNamesById: buildFallbackPlayerNamesById(bundle),
  };
}

function resolvePlayerIdentity(
  playerId: number,
  maps: PlayerStatsLandingIdentityMaps,
  mode: PlayerStatsMode
): PlayerStatsLandingPlayerIdentity {
  const player = maps.playersById.get(playerId);
  const playerName =
    player?.fullName ??
    maps.fallbackPlayerNamesById.get(playerId) ??
    `Player ${playerId}`;

  return {
    playerId,
    playerName,
    positionCode: normalizeCanonicalPlayerPositionCode(player?.position, mode),
  };
}

function getTeamAbbrev(
  teamId: number,
  maps: PlayerStatsLandingIdentityMaps,
  shiftTeamAbbrev?: string | null
): string | null {
  return maps.teamsById.get(teamId)?.abbreviation ?? shiftTeamAbbrev ?? null;
}

function resolveOpponentTeamId(
  game: PlayerStatsSourceGameRow,
  teamId: number
): number {
  return game.homeTeamId === teamId ? game.awayTeamId : game.homeTeamId;
}

function resolveIsHome(
  game: PlayerStatsSourceGameRow,
  teamId: number
): boolean {
  return game.homeTeamId === teamId;
}

function matchesGameTeamId(
  game: Pick<PlayerStatsSourceGameRow, "homeTeamId" | "awayTeamId">,
  teamId: number | null | undefined
): teamId is number {
  return teamId === game.homeTeamId || teamId === game.awayTeamId;
}

function filterShiftRowsForGame(
  game: Pick<PlayerStatsSourceGameRow, "homeTeamId" | "awayTeamId">,
  shiftRows: readonly PlayerStatsSourceShiftRow[]
): PlayerStatsSourceShiftRow[] {
  return shiftRows.filter((shiftRow) => matchesGameTeamId(game, shiftRow.team_id));
}

function filterRosterSpotsForGame(
  game: Pick<PlayerStatsSourceGameRow, "homeTeamId" | "awayTeamId">,
  rosterSpots: readonly PlayerStatsSourceRosterSpotRow[]
): PlayerStatsSourceRosterSpotRow[] {
  return rosterSpots.filter((rosterSpot) =>
    matchesGameTeamId(game, rosterSpot.team_id)
  );
}

function isSummaryRowConsistentWithGame(args: {
  game: Pick<PlayerStatsLandingSummaryPayload["game"], "id" | "homeTeamId" | "awayTeamId">;
  row: PlayerStatsLandingSummaryRow;
}): boolean {
  return (
    args.row.gameId === args.game.id &&
    matchesGameTeamId(args.game, args.row.teamId) &&
    matchesGameTeamId(args.game, args.row.opponentTeamId) &&
    args.row.teamId !== args.row.opponentTeamId
  );
}

function getShiftTeamByPlayerId(
  shiftRows: readonly PlayerStatsSourceShiftRow[]
): Map<number, PlayerStatsSourceShiftRow> {
  const shiftByPlayerId = new Map<number, PlayerStatsSourceShiftRow>();

  for (const shiftRow of shiftRows) {
    if (!shiftByPlayerId.has(shiftRow.player_id)) {
      shiftByPlayerId.set(shiftRow.player_id, shiftRow);
    }
  }

  return shiftByPlayerId;
}

function getRosterSpotByPlayerId(
  rosterSpots: readonly PlayerStatsSourceRosterSpotRow[]
): Map<number, PlayerStatsSourceRosterSpotRow> {
  const rosterSpotByPlayerId = new Map<number, PlayerStatsSourceRosterSpotRow>();

  for (const rosterSpot of rosterSpots) {
    if (!rosterSpotByPlayerId.has(rosterSpot.player_id)) {
      rosterSpotByPlayerId.set(rosterSpot.player_id, rosterSpot);
    }
  }

  return rosterSpotByPlayerId;
}

function defaultPbpOnlyIndividualMetrics(): PlayerStatsLandingAggregateMetrics["individual"] {
  return {
    goals: 0,
    totalAssists: 0,
    firstAssists: 0,
    secondAssists: 0,
    shots: 0,
    ixg: null,
    iCf: 0,
    iFf: 0,
    iScf: null,
    iHdcf: null,
    rushAttempts: 0,
    reboundsCreated: 0,
    pim: 0,
    totalPenalties: 0,
    minorPenalties: 0,
    majorPenalties: 0,
    misconductPenalties: 0,
    penaltiesDrawn: 0,
    giveaways: 0,
    takeaways: 0,
    hits: 0,
    hitsTaken: 0,
    shotsBlocked: 0,
    faceoffsWon: 0,
    faceoffsLost: 0,
  };
}

function getPbpOnlyShotDangerBucket(shot: ReturnType<typeof buildShotFeatureRows>[number]) {
  if (shot.shotDistanceFeet == null || shot.shotAngleDegrees == null) {
    return null;
  }

  if (shot.shotDistanceFeet <= 20 && shot.shotAngleDegrees <= 35) {
    return "high" as const;
  }

  if (shot.shotDistanceFeet <= 40 && shot.shotAngleDegrees <= 50) {
    return "medium" as const;
  }

  return "low" as const;
}

function getPbpOnlyApproximateXgValue(
  shot: ReturnType<typeof buildShotFeatureRows>[number]
): number | null {
  const dangerBucket = getPbpOnlyShotDangerBucket(shot);
  if (dangerBucket == null) {
    return null;
  }

  let value =
    dangerBucket === "high" ? 0.18 : dangerBucket === "medium" ? 0.08 : 0.02;
  if (shot.isReboundShot) value += 0.03;
  if (shot.isRushShot) value += 0.02;
  if (shot.crossedRoyalRoad) value += 0.02;
  if (shot.isGoal) value = Math.max(value, 0.25);
  return Math.min(value, 0.95);
}

function matchesPbpOnlyStrengthForTeam(args: {
  strength: PlayerStatsSupportedStrength;
  event: ParsedNhlPbpEvent;
  teamId: number;
  game: Pick<PlayerStatsSourceGameRow, "homeTeamId" | "awayTeamId">;
}): boolean {
  if (args.strength === "allStrengths") {
    return true;
  }

  const parsedSituation = parseSituationCode(args.event.situation_code);
  const teamStrengthState = classifyTeamStrengthState(
    parsedSituation,
    args.teamId,
    args.game.homeTeamId,
    args.game.awayTeamId
  );

  if (args.strength === "evenStrength") {
    return teamStrengthState === "EV";
  }

  if (args.strength === "fiveOnFive") {
    return teamStrengthState === "EV" && args.event.strength_exact === "5v5";
  }

  if (args.strength === "powerPlay") {
    return teamStrengthState === "PP";
  }

  return teamStrengthState === "SH";
}

function addPbpOnlyPlayerMetric(
  metricsByPlayerId: Map<number, PlayerStatsLandingAggregateMetrics["individual"]>,
  playerId: number | null,
  rosterSpotByPlayerId: Map<number, PlayerStatsSourceRosterSpotRow>,
  callback: (metrics: PlayerStatsLandingAggregateMetrics["individual"]) => void
) {
  if (playerId == null || !rosterSpotByPlayerId.has(playerId)) {
    return;
  }

  const metrics =
    metricsByPlayerId.get(playerId) ?? defaultPbpOnlyIndividualMetrics();
  callback(metrics);
  metricsByPlayerId.set(playerId, metrics);
}

function matchesLandingVenue(
  venue: PlayerStatsLandingFilterState["expandable"]["venue"],
  isHome: boolean
): boolean {
  if (venue === "all") {
    return true;
  }

  return venue === "home" ? isHome : !isHome;
}

function buildIndividualContextsForGame(args: {
  state: PlayerStatsLandingFilterState;
  gameParity: PlayerStatsLandingNativeGameParity;
  shiftTeamByPlayerId: Map<number, PlayerStatsSourceShiftRow>;
  identityMaps: PlayerStatsLandingIdentityMaps;
  splitKey: PlayerStatsNativeSkaterSplitKey;
}): PlayerStatsLandingIndividualContext[] {
  const { state, gameParity, shiftTeamByPlayerId, identityMaps, splitKey } = args;
  const onIceByPlayerId = new Map(
    gameParity.parity.skaters[splitKey].countsOi.map((row) => [row.player_id, row])
  );

  return gameParity.parity.skaters[splitKey].counts
    .filter((row) => row.toi > 0)
    .map((row) => {
      const shiftRow = shiftTeamByPlayerId.get(row.player_id);
      if (!shiftRow) {
        return null;
      }

      const identity = resolvePlayerIdentity(
        row.player_id,
        identityMaps,
        state.primary.statMode
      );
      const isHome = resolveIsHome(gameParity.game, shiftRow.team_id);

      if (!matchesLandingVenue(state.expandable.venue, isHome)) {
        return null;
      }

      if (
        state.expandable.teamId != null &&
        shiftRow.team_id !== state.expandable.teamId
      ) {
        return null;
      }

      if (
        !matchesPlayerStatsPositionGroup({
          rawPosition: identity.positionCode,
          positionGroup: state.expandable.positionGroup,
          mode: state.primary.statMode,
        })
      ) {
        return null;
      }

      return {
        kind: "individual",
        ...identity,
        gameId: gameParity.game.id,
        seasonId: gameParity.game.seasonId,
        gameDate: gameParity.game.date,
        teamId: shiftRow.team_id,
        teamAbbrev: getTeamAbbrev(shiftRow.team_id, identityMaps, shiftRow.team_abbrev),
        opponentTeamId: resolveOpponentTeamId(gameParity.game, shiftRow.team_id),
        isHome,
        hasReliableToi: true,
        counts: row,
        onIceCounts: onIceByPlayerId.get(row.player_id) ?? null,
      };
    })
    .filter((row): row is PlayerStatsLandingIndividualContext => row != null);
}

function buildPbpOnlyIndividualContextsForGame(args: {
  state: PlayerStatsLandingFilterState;
  game: PlayerStatsSourceGameRow;
  events: readonly PlayerStatsSourceEventRow[];
  ownGoalEventIds?: ReadonlySet<number>;
  rosterSpotByPlayerId: Map<number, PlayerStatsSourceRosterSpotRow>;
  identityMaps: PlayerStatsLandingIdentityMaps;
  strength: PlayerStatsSupportedStrength;
}): PlayerStatsLandingIndividualContext[] {
  const parsedEvents = buildStoredPbpEventSequence(
    args.events,
    args.game,
    args.ownGoalEventIds
  );
  const shotFeatures = buildShotFeatureRows(
    parsedEvents,
    [],
    args.game.homeTeamId,
    args.game.awayTeamId
  );
  const metricsByPlayerId = new Map<
    number,
    PlayerStatsLandingAggregateMetrics["individual"]
  >();

  for (const event of parsedEvents) {
    const ownerTeamId = event.event_owner_team_id ?? null;
    const opponentTeamId =
      ownerTeamId == null ? null : resolveOpponentTeamId(args.game, ownerTeamId);

    const eventMatchesStrength = (teamId: number | null) =>
      teamId != null &&
      matchesPbpOnlyStrengthForTeam({
        strength: args.strength,
        event,
        teamId,
        game: args.game,
      });

    switch (event.type_desc_key) {
      case "goal":
        addPbpOnlyPlayerMetric(
          metricsByPlayerId,
          event.scoring_player_id ?? null,
          args.rosterSpotByPlayerId,
          (metrics) => {
            if (eventMatchesStrength(ownerTeamId)) {
              metrics.goals += 1;
            }
          }
        );
        addPbpOnlyPlayerMetric(
          metricsByPlayerId,
          event.assist1_player_id ?? null,
          args.rosterSpotByPlayerId,
          (metrics) => {
            if (eventMatchesStrength(ownerTeamId)) {
              metrics.totalAssists += 1;
              metrics.firstAssists += 1;
            }
          }
        );
        addPbpOnlyPlayerMetric(
          metricsByPlayerId,
          event.assist2_player_id ?? null,
          args.rosterSpotByPlayerId,
          (metrics) => {
            if (eventMatchesStrength(ownerTeamId)) {
              metrics.totalAssists += 1;
              metrics.secondAssists += 1;
            }
          }
        );
        break;
      case "penalty":
        addPbpOnlyPlayerMetric(
          metricsByPlayerId,
          event.committed_by_player_id ?? null,
          args.rosterSpotByPlayerId,
          (metrics) => {
            const duration = event.penalty_duration_minutes ?? 0;

            if (!eventMatchesStrength(ownerTeamId)) {
              return;
            }

            metrics.pim += duration;
            metrics.totalPenalties += 1;

            if (duration === 2) {
              metrics.minorPenalties += 1;
            } else if (duration === 5) {
              metrics.majorPenalties += 1;
            } else if (duration >= 10) {
              metrics.misconductPenalties += 1;
            }
          }
        );
        addPbpOnlyPlayerMetric(
          metricsByPlayerId,
          event.drawn_by_player_id ?? null,
          args.rosterSpotByPlayerId,
          (metrics) => {
            if (eventMatchesStrength(opponentTeamId)) {
              metrics.penaltiesDrawn += 1;
            }
          }
        );
        break;
      case "faceoff":
        addPbpOnlyPlayerMetric(
          metricsByPlayerId,
          event.winning_player_id ?? null,
          args.rosterSpotByPlayerId,
          (metrics) => {
            if (eventMatchesStrength(ownerTeamId)) {
              metrics.faceoffsWon += 1;
            }
          }
        );
        addPbpOnlyPlayerMetric(
          metricsByPlayerId,
          event.losing_player_id ?? null,
          args.rosterSpotByPlayerId,
          (metrics) => {
            if (eventMatchesStrength(opponentTeamId)) {
              metrics.faceoffsLost += 1;
            }
          }
        );
        break;
      case "hit":
        addPbpOnlyPlayerMetric(
          metricsByPlayerId,
          event.hitting_player_id ?? null,
          args.rosterSpotByPlayerId,
          (metrics) => {
            if (eventMatchesStrength(ownerTeamId)) {
              metrics.hits += 1;
            }
          }
        );
        addPbpOnlyPlayerMetric(
          metricsByPlayerId,
          event.hittee_player_id ?? null,
          args.rosterSpotByPlayerId,
          (metrics) => {
            if (eventMatchesStrength(opponentTeamId)) {
              metrics.hitsTaken += 1;
            }
          }
        );
        break;
      case "giveaway":
        addPbpOnlyPlayerMetric(
          metricsByPlayerId,
          event.player_id ?? null,
          args.rosterSpotByPlayerId,
          (metrics) => {
            if (eventMatchesStrength(ownerTeamId)) {
              metrics.giveaways += 1;
            }
          }
        );
        break;
      case "takeaway":
        addPbpOnlyPlayerMetric(
          metricsByPlayerId,
          event.player_id ?? null,
          args.rosterSpotByPlayerId,
          (metrics) => {
            if (eventMatchesStrength(ownerTeamId)) {
              metrics.takeaways += 1;
            }
          }
        );
        break;
      case "blocked-shot":
        addPbpOnlyPlayerMetric(
          metricsByPlayerId,
          event.blocking_player_id ?? null,
          args.rosterSpotByPlayerId,
          (metrics) => {
            if (eventMatchesStrength(opponentTeamId)) {
              metrics.shotsBlocked += 1;
            }
          }
        );
        break;
      default:
        break;
    }
  }

  for (const shot of shotFeatures) {
    const playerId = shot.shooterPlayerId;
    if (playerId == null) {
      continue;
    }

    const rosterSpot = args.rosterSpotByPlayerId.get(playerId);
    if (!rosterSpot) {
      continue;
    }

    const event = parsedEvents.find((candidate) => candidate.event_id === shot.eventId);
    if (
      !event ||
      !matchesPbpOnlyStrengthForTeam({
        strength: args.strength,
        event,
        teamId: rosterSpot.team_id,
        game: args.game,
      })
    ) {
      continue;
    }

    const metrics =
      metricsByPlayerId.get(playerId) ?? defaultPbpOnlyIndividualMetrics();
    metrics.shots += shot.isShotOnGoal ? 1 : 0;
    if (!shot.isOwnGoal) {
      metrics.iCf += 1;
      metrics.iFf += shot.isUnblockedShotAttempt ? 1 : 0;
      metrics.ixg = addNullable(metrics.ixg, getPbpOnlyApproximateXgValue(shot));
    }

    const dangerBucket = getPbpOnlyShotDangerBucket(shot);
    if (!shot.isOwnGoal && dangerBucket !== "low") {
      metrics.iScf = addNullable(metrics.iScf, 1);
    }

    if (!shot.isOwnGoal && dangerBucket === "high") {
      metrics.iHdcf = addNullable(metrics.iHdcf, 1);
    }

    metrics.rushAttempts += !shot.isOwnGoal && shot.isRushShot ? 1 : 0;
    metrics.reboundsCreated += !shot.isOwnGoal && shot.createsRebound ? 1 : 0;
    metricsByPlayerId.set(playerId, metrics);
  }

  return [...metricsByPlayerId.entries()]
    .map(([playerId, metrics]) => {
      const rosterSpot = args.rosterSpotByPlayerId.get(playerId);
      if (!rosterSpot) {
        return null;
      }

      const identity = resolvePlayerIdentity(playerId, args.identityMaps, "individual");
      if (
        !matchesPlayerStatsPositionGroup({
          rawPosition: rosterSpot.position_code ?? identity.positionCode,
          positionGroup: args.state.expandable.positionGroup,
          mode: args.state.primary.statMode,
        })
      ) {
        return null;
      }

      const isHome = resolveIsHome(args.game, rosterSpot.team_id);
      if (!matchesLandingVenue(args.state.expandable.venue, isHome)) {
        return null;
      }

      if (
        args.state.expandable.teamId != null &&
        rosterSpot.team_id !== args.state.expandable.teamId
      ) {
        return null;
      }

      return {
        kind: "individual",
        ...identity,
        positionCode: normalizeCanonicalPlayerPositionCode(
          rosterSpot.position_code,
          "individual"
        ),
        gameId: args.game.id,
        seasonId: args.game.seasonId,
        gameDate: args.game.date,
        teamId: rosterSpot.team_id,
        teamAbbrev: getTeamAbbrev(rosterSpot.team_id, args.identityMaps),
        opponentTeamId: resolveOpponentTeamId(args.game, rosterSpot.team_id),
        isHome,
        hasReliableToi: false,
        counts: {
          player_id: playerId,
          season: args.game.seasonId,
          date_scraped: args.game.date,
          gp: 1,
          toi: 0,
          goals: metrics.goals,
          total_assists: metrics.totalAssists,
          first_assists: metrics.firstAssists,
          second_assists: metrics.secondAssists,
          total_points: metrics.goals + metrics.totalAssists,
          shots: metrics.shots,
          ixg: metrics.ixg,
          icf: metrics.iCf,
          iff: metrics.iFf,
          iscfs: metrics.iScf,
          hdcf: metrics.iHdcf,
          rush_attempts: metrics.rushAttempts,
          rebounds_created: metrics.reboundsCreated,
          pim: metrics.pim,
          total_penalties: metrics.totalPenalties,
          minor_penalties: metrics.minorPenalties,
          major_penalties: metrics.majorPenalties,
          misconduct_penalties: metrics.misconductPenalties,
          penalties_drawn: metrics.penaltiesDrawn,
          giveaways: metrics.giveaways,
          takeaways: metrics.takeaways,
          hits: metrics.hits,
          hits_taken: metrics.hitsTaken,
          shots_blocked: metrics.shotsBlocked,
          faceoffs_won: metrics.faceoffsWon,
          faceoffs_lost: metrics.faceoffsLost,
          ipp: null,
        },
        onIceCounts: null,
      } satisfies PlayerStatsLandingIndividualContext;
    })
    .filter((row): row is PlayerStatsLandingIndividualContext => row != null);
}

function buildOnIceContextsForGame(args: {
  state: PlayerStatsLandingFilterState;
  gameParity: PlayerStatsLandingNativeGameParity;
  shiftTeamByPlayerId: Map<number, PlayerStatsSourceShiftRow>;
  identityMaps: PlayerStatsLandingIdentityMaps;
  splitKey: PlayerStatsNativeSkaterSplitKey;
}): PlayerStatsLandingOnIceContext[] {
  const { state, gameParity, shiftTeamByPlayerId, identityMaps, splitKey } = args;

  return gameParity.parity.skaters[splitKey].countsOi
    .filter((row) => row.toi > 0)
    .map((row) => {
      const shiftRow = shiftTeamByPlayerId.get(row.player_id);
      if (!shiftRow) {
        return null;
      }

      const identity = resolvePlayerIdentity(
        row.player_id,
        identityMaps,
        state.primary.statMode
      );
      const isHome = resolveIsHome(gameParity.game, shiftRow.team_id);

      if (!matchesLandingVenue(state.expandable.venue, isHome)) {
        return null;
      }

      if (
        state.expandable.teamId != null &&
        shiftRow.team_id !== state.expandable.teamId
      ) {
        return null;
      }

      if (
        !matchesPlayerStatsPositionGroup({
          rawPosition: identity.positionCode,
          positionGroup: state.expandable.positionGroup,
          mode: state.primary.statMode,
        })
      ) {
        return null;
      }

      return {
        kind: "onIce",
        ...identity,
        gameId: gameParity.game.id,
        seasonId: gameParity.game.seasonId,
        gameDate: gameParity.game.date,
        teamId: shiftRow.team_id,
        teamAbbrev: getTeamAbbrev(shiftRow.team_id, identityMaps, shiftRow.team_abbrev),
        opponentTeamId: resolveOpponentTeamId(gameParity.game, shiftRow.team_id),
        isHome,
        hasReliableToi: true,
        counts: row,
      };
    })
    .filter((row): row is PlayerStatsLandingOnIceContext => row != null);
}

function buildGoalieContextsForGame(args: {
  state: PlayerStatsLandingFilterState;
  gameParity: PlayerStatsLandingNativeGameParity;
  shiftTeamByPlayerId: Map<number, PlayerStatsSourceShiftRow>;
  identityMaps: PlayerStatsLandingIdentityMaps;
  splitKey: PlayerStatsNativeGoalieSplitKey;
}): PlayerStatsLandingGoalieContext[] {
  const { state, gameParity, shiftTeamByPlayerId, identityMaps, splitKey } = args;

  return gameParity.parity.goalies[splitKey].counts
    .filter((row) => row.toi > 0)
    .map((row) => {
      const shiftRow = shiftTeamByPlayerId.get(row.player_id);
      if (!shiftRow) {
        return null;
      }

      const identity = resolvePlayerIdentity(row.player_id, identityMaps, "goalies");
      const isHome = resolveIsHome(gameParity.game, shiftRow.team_id);

      if (!matchesLandingVenue(state.expandable.venue, isHome)) {
        return null;
      }

      if (
        state.expandable.teamId != null &&
        shiftRow.team_id !== state.expandable.teamId
      ) {
        return null;
      }

      return {
        kind: "goalies",
        ...identity,
        positionCode: "G",
        gameId: gameParity.game.id,
        seasonId: gameParity.game.seasonId,
        gameDate: gameParity.game.date,
        teamId: shiftRow.team_id,
        teamAbbrev: getTeamAbbrev(shiftRow.team_id, identityMaps, shiftRow.team_abbrev),
        opponentTeamId: resolveOpponentTeamId(gameParity.game, shiftRow.team_id),
        isHome,
        hasReliableToi: true,
        counts: row,
        shotFeatures: gameParity.shotFeatures,
      };
    })
    .filter((row): row is PlayerStatsLandingGoalieContext => row != null);
}

function buildPlayerStatsLandingContexts(args: {
  state: PlayerStatsLandingFilterState;
  parityByGame: readonly PlayerStatsLandingNativeGameParity[];
  bundle: PlayerStatsLandingSourceBundle;
  identityMaps: PlayerStatsLandingIdentityMaps;
}): PlayerStatsLandingAppearanceContext[] {
  const { state, parityByGame, bundle, identityMaps } = args;

  if (!isSupportedLandingStrength(state.primary.strength)) {
    throw new Error(
      `Native landing aggregation does not yet support strength "${state.primary.strength}".`
    );
  }

  if (state.primary.scoreState !== "allScores") {
    throw new Error(
      `Native landing aggregation does not yet support score state "${state.primary.scoreState}".`
    );
  }

  if (state.primary.statMode === "goalies") {
    const splitKey = resolveGoalieSplitKey(state.primary.strength);

    return parityByGame.flatMap((gameParity) =>
      buildGoalieContextsForGame({
        state,
        gameParity,
        shiftTeamByPlayerId: getShiftTeamByPlayerId(
          filterShiftRowsForGame(
            gameParity.game,
            bundle.shiftRowsByGameId.get(gameParity.game.id) ?? []
          )
        ),
        identityMaps,
        splitKey,
      })
    );
  }

  const splitKey = resolveSkaterSplitKey(state.primary.strength);

  if (state.primary.statMode === "individual") {
    return parityByGame.flatMap((gameParity) => {
      const shiftRows = filterShiftRowsForGame(
        gameParity.game,
        bundle.shiftRowsByGameId.get(gameParity.game.id) ?? []
      );
      const rosterSpots = filterRosterSpotsForGame(
        gameParity.game,
        bundle.rosterSpotsByGameId.get(gameParity.game.id) ?? []
      );

      if (
        state.primary.displayMode === "counts" &&
        shiftRows.length === 0 &&
        rosterSpots.length > 0
      ) {
        return buildPbpOnlyIndividualContextsForGame({
          state,
          game: gameParity.game,
          events: bundle.eventsByGameId.get(gameParity.game.id) ?? [],
          ownGoalEventIds: bundle.ownGoalEventIdsByGameId.get(gameParity.game.id),
          rosterSpotByPlayerId: getRosterSpotByPlayerId(rosterSpots),
          identityMaps,
          strength: state.primary.strength,
        });
      }

      return buildIndividualContextsForGame({
        state,
        gameParity,
        shiftTeamByPlayerId: getShiftTeamByPlayerId(shiftRows),
        identityMaps,
        splitKey,
      });
    });
  }

  return parityByGame.flatMap((gameParity) =>
    buildOnIceContextsForGame({
      state,
      gameParity,
      shiftTeamByPlayerId: getShiftTeamByPlayerId(
        filterShiftRowsForGame(
          gameParity.game,
          bundle.shiftRowsByGameId.get(gameParity.game.id) ?? []
        )
      ),
      identityMaps,
      splitKey,
    })
  );
}

function getGroupingKey(
  state: PlayerStatsLandingFilterState,
  context: PlayerStatsLandingAppearanceContext
): string {
  return state.expandable.tradeMode === "split"
    ? `${context.playerId}:${context.teamId}`
    : `${context.playerId}`;
}

function takeMostRecentContexts(
  contexts: readonly PlayerStatsLandingAppearanceContext[],
  value: number | null
): PlayerStatsLandingAppearanceContext[] {
  if (value == null || value <= 0) {
    return [...contexts];
  }

  return [...contexts]
    .sort((left, right) =>
      compareGamesDescending(
        { date: left.gameDate, id: left.gameId },
        { date: right.gameDate, id: right.gameId }
      )
    )
    .slice(0, value);
}

function getSelectedGamesForTeamContext(args: {
  games: readonly PlayerStatsSourceGameRow[];
  teamId: number;
  venue: PlayerStatsLandingFilterState["expandable"]["venue"];
  limit: number | null;
}): Set<number> {
  const eligibleGames = args.games
    .filter((game) => {
      if (game.homeTeamId !== args.teamId && game.awayTeamId !== args.teamId) {
        return false;
      }

      if (args.venue === "home") {
        return game.homeTeamId === args.teamId;
      }

      if (args.venue === "away") {
        return game.awayTeamId === args.teamId;
      }

      return true;
    })
    .sort(compareGamesDescending);

  return new Set(
    eligibleGames
      .slice(0, args.limit == null || args.limit <= 0 ? eligibleGames.length : args.limit)
      .map((game) => game.id)
  );
}

function applyLandingScopeSelection(args: {
  state: PlayerStatsLandingFilterState;
  bundle: PlayerStatsLandingSourceBundle;
  contexts: readonly PlayerStatsLandingAppearanceContext[];
}): PlayerStatsLandingAppearanceContext[] {
  const { state, bundle, contexts } = args;
  const scope = state.expandable.scope;

  if (scope.kind === "none" || scope.kind === "dateRange") {
    return [...contexts];
  }

  const contextsByGroupingKey = new Map<string, PlayerStatsLandingAppearanceContext[]>();

  for (const context of contexts) {
    const key = getGroupingKey(state, context);
    const existing = contextsByGroupingKey.get(key);
    if (existing) {
      existing.push(context);
      continue;
    }

    contextsByGroupingKey.set(key, [context]);
  }

  if (scope.kind === "gameRange") {
    return [...contextsByGroupingKey.values()].flatMap((groupingContexts) =>
      takeMostRecentContexts(groupingContexts, scope.value)
    );
  }

  return [...contextsByGroupingKey.values()].flatMap((groupingContexts) => {
    const selectedGameIds = new Set<number>();
    const explicitTeamId = state.expandable.teamId;
    const teamIds =
      explicitTeamId != null
        ? [explicitTeamId]
        : [...new Set(groupingContexts.map((context) => context.teamId))];

    for (const teamId of teamIds) {
      const teamGameIds = getSelectedGamesForTeamContext({
        games: bundle.games,
        teamId,
        venue: state.expandable.venue,
        limit: scope.value,
      });

      for (const gameId of teamGameIds) {
        selectedGameIds.add(gameId);
      }
    }

    return groupingContexts.filter((context) => selectedGameIds.has(context.gameId));
  });
}

function defaultAggregateMetrics(): PlayerStatsLandingAggregateMetrics {
  return {
    toiSeconds: 0,
    gamesPlayed: 0,
    onIceGoalsForForIpp: 0,
    hasUnknownToi: false,
    hasUnknownOnIceGoalDenominator: false,
    individual: {
      goals: 0,
      totalAssists: 0,
      firstAssists: 0,
      secondAssists: 0,
      shots: 0,
      ixg: null,
      iCf: 0,
      iFf: 0,
      iScf: null,
      iHdcf: null,
      rushAttempts: 0,
      reboundsCreated: 0,
      pim: 0,
      totalPenalties: 0,
      minorPenalties: 0,
      majorPenalties: 0,
      misconductPenalties: 0,
      penaltiesDrawn: 0,
      giveaways: 0,
      takeaways: 0,
      hits: 0,
      hitsTaken: 0,
      shotsBlocked: 0,
      faceoffsWon: 0,
      faceoffsLost: 0,
    },
    onIce: {
      cf: 0,
      ca: 0,
      ff: 0,
      fa: 0,
      sf: 0,
      sa: 0,
      gf: 0,
      ga: 0,
      xgf: null,
      xga: null,
      scf: null,
      sca: null,
      hdcf: null,
      hdca: null,
      hdgf: null,
      hdga: null,
      mdcf: null,
      mdca: null,
      mdgf: null,
      mdga: null,
      ldcf: null,
    },
    goalies: {
      shotsAgainst: 0,
      saves: 0,
      goalsAgainst: 0,
      xgAgainst: null,
      hdShotsAgainst: 0,
      hdSaves: 0,
      hdGoalsAgainst: 0,
      hdXgAgainst: null,
      mdShotsAgainst: 0,
      mdSaves: 0,
      mdGoalsAgainst: 0,
      mdXgAgainst: null,
      ldShotsAgainst: 0,
      ldSaves: 0,
      ldGoalsAgainst: 0,
      ldXgAgainst: null,
      rushAttemptsAgainst: 0,
      reboundAttemptsAgainst: 0,
      shotDistanceTotal: 0,
      shotDistanceCount: 0,
      goalDistanceTotal: 0,
      goalDistanceCount: 0,
    },
  };
}

function accumulateGoalieShotFeatureBucketMetrics(
  metrics: PlayerStatsLandingAggregateMetrics["goalies"],
  context: PlayerStatsLandingGoalieContext
) {
  for (const shot of context.shotFeatures) {
    if (shot.goalieInNetId !== context.playerId) {
      continue;
    }

    if (!["goal", "shot-on-goal"].includes(shot.shotEventType ?? "")) {
      continue;
    }

    const distance = shot.shotDistanceFeet ?? null;
    const angle = shot.shotAngleDegrees ?? null;
    const dangerBucket =
      distance == null || angle == null
        ? null
        : distance <= 20 && angle <= 35
          ? "high"
          : distance <= 40 && angle <= 50
            ? "medium"
            : "low";
    const xgValue =
      shot.xgValue ??
      (dangerBucket === "high"
        ? shot.isGoal
          ? 0.25
          : 0.18
        : dangerBucket === "medium"
          ? 0.08
          : dangerBucket === "low"
            ? 0.02
            : null);

    if (dangerBucket === "high") {
      metrics.hdGoalsAgainst += shot.isGoal ? 1 : 0;
      metrics.hdXgAgainst = addNullable(metrics.hdXgAgainst, xgValue);
    } else if (dangerBucket === "medium") {
      metrics.mdGoalsAgainst += shot.isGoal ? 1 : 0;
      metrics.mdXgAgainst = addNullable(metrics.mdXgAgainst, xgValue);
    } else if (dangerBucket === "low") {
      metrics.ldGoalsAgainst += shot.isGoal ? 1 : 0;
      metrics.ldXgAgainst = addNullable(metrics.ldXgAgainst, xgValue);
    }
  }
}

function accumulateLandingMetrics(
  metrics: PlayerStatsLandingAggregateMetrics,
  context: PlayerStatsLandingAppearanceContext
) {
  metrics.gamesPlayed += 1;
  if (context.hasReliableToi) {
    metrics.toiSeconds += context.counts.toi;
  } else {
    metrics.hasUnknownToi = true;
  }

  if (context.kind === "individual") {
    metrics.individual.goals += context.counts.goals;
    metrics.individual.totalAssists += context.counts.total_assists;
    metrics.individual.firstAssists += context.counts.first_assists;
    metrics.individual.secondAssists += context.counts.second_assists;
    metrics.individual.shots += context.counts.shots;
    metrics.individual.ixg = addNullable(metrics.individual.ixg, context.counts.ixg);
    metrics.individual.iCf += context.counts.icf;
    metrics.individual.iFf += context.counts.iff;
    metrics.individual.iScf = addNullable(metrics.individual.iScf, context.counts.iscfs);
    metrics.individual.iHdcf = addNullable(metrics.individual.iHdcf, context.counts.hdcf);
    metrics.individual.rushAttempts += context.counts.rush_attempts;
    metrics.individual.reboundsCreated += context.counts.rebounds_created;
    metrics.individual.pim += context.counts.pim;
    metrics.individual.totalPenalties += context.counts.total_penalties;
    metrics.individual.minorPenalties += context.counts.minor_penalties;
    metrics.individual.majorPenalties += context.counts.major_penalties;
    metrics.individual.misconductPenalties += context.counts.misconduct_penalties;
    metrics.individual.penaltiesDrawn += context.counts.penalties_drawn;
    metrics.individual.giveaways += context.counts.giveaways;
    metrics.individual.takeaways += context.counts.takeaways;
    metrics.individual.hits += context.counts.hits;
    metrics.individual.hitsTaken += context.counts.hits_taken;
    metrics.individual.shotsBlocked += context.counts.shots_blocked;
    metrics.individual.faceoffsWon += context.counts.faceoffs_won;
    metrics.individual.faceoffsLost += context.counts.faceoffs_lost;
    if (context.onIceCounts != null) {
      metrics.onIceGoalsForForIpp += context.onIceCounts.gf;
    } else {
      metrics.hasUnknownOnIceGoalDenominator = true;
    }
    return;
  }

  if (context.kind === "onIce") {
    metrics.onIce.cf += context.counts.cf;
    metrics.onIce.ca += context.counts.ca;
    metrics.onIce.ff += context.counts.ff;
    metrics.onIce.fa += context.counts.fa;
    metrics.onIce.sf += context.counts.sf;
    metrics.onIce.sa += context.counts.sa;
    metrics.onIce.gf += context.counts.gf;
    metrics.onIce.ga += context.counts.ga;
    metrics.onIce.xgf = addNullable(metrics.onIce.xgf, context.counts.xgf);
    metrics.onIce.xga = addNullable(metrics.onIce.xga, context.counts.xga);
    metrics.onIce.scf = addNullable(metrics.onIce.scf, context.counts.scf);
    metrics.onIce.sca = addNullable(metrics.onIce.sca, context.counts.sca);
    metrics.onIce.hdcf = addNullable(metrics.onIce.hdcf, context.counts.hdcf);
    metrics.onIce.hdca = addNullable(metrics.onIce.hdca, context.counts.hdca);
    metrics.onIce.hdgf = addNullable(metrics.onIce.hdgf, context.counts.hdgf);
    metrics.onIce.hdga = addNullable(metrics.onIce.hdga, context.counts.hdga);
    metrics.onIce.mdcf = addNullable(metrics.onIce.mdcf, context.counts.mdcf);
    metrics.onIce.mdca = addNullable(metrics.onIce.mdca, context.counts.mdca);
    metrics.onIce.mdgf = addNullable(metrics.onIce.mdgf, context.counts.mdgf);
    metrics.onIce.mdga = addNullable(metrics.onIce.mdga, context.counts.mdga);
    metrics.onIce.ldcf = addNullable(metrics.onIce.ldcf, context.counts.ldcf);
    return;
  }

  metrics.goalies.shotsAgainst += context.counts.shots_against;
  metrics.goalies.saves += context.counts.saves;
  metrics.goalies.goalsAgainst += context.counts.goals_against;
  metrics.goalies.xgAgainst = addNullable(
    metrics.goalies.xgAgainst,
    context.counts.xg_against
  );
  metrics.goalies.hdShotsAgainst += context.counts.hd_shots_against ?? 0;
  metrics.goalies.hdSaves += context.counts.hd_saves ?? 0;
  metrics.goalies.mdShotsAgainst += context.counts.md_shots_against ?? 0;
  metrics.goalies.mdSaves += context.counts.md_saves ?? 0;
  metrics.goalies.mdGoalsAgainst += context.counts.md_goals_against ?? 0;
  metrics.goalies.ldShotsAgainst += context.counts.ld_shots_against ?? 0;
  metrics.goalies.ldSaves += context.counts.ld_saves ?? 0;
  metrics.goalies.ldGoalsAgainst += context.counts.ld_goals_against ?? 0;
  metrics.goalies.rushAttemptsAgainst += context.counts.rush_attempts_against;
  metrics.goalies.reboundAttemptsAgainst += context.counts.rebound_attempts_against;
  if (context.counts.avg_shot_distance != null && context.counts.shots_against > 0) {
    metrics.goalies.shotDistanceTotal +=
      context.counts.avg_shot_distance * context.counts.shots_against;
    metrics.goalies.shotDistanceCount += context.counts.shots_against;
  }
  if (context.counts.avg_goal_distance != null && context.counts.goals_against > 0) {
    metrics.goalies.goalDistanceTotal +=
      context.counts.avg_goal_distance * context.counts.goals_against;
    metrics.goalies.goalDistanceCount += context.counts.goals_against;
  }
  accumulateGoalieShotFeatureBucketMetrics(metrics.goalies, context);
}

const PLAYER_STATS_SUMMARY_SUPPORTED_STRENGTHS: readonly PlayerStatsSupportedStrength[] = [
  "allStrengths",
  "evenStrength",
  "fiveOnFive",
  "powerPlay",
  "penaltyKill",
];

function createPlayerStatsSummaryBuildState(args: {
  game: PlayerStatsSourceGameRow;
  mode: PlayerStatsMode;
  displayMode: PlayerStatsDisplayMode;
  strength: PlayerStatsSupportedStrength;
}): PlayerStatsLandingFilterState {
  return {
    surface: "landing",
    primary: {
      seasonRange: {
        fromSeasonId: args.game.seasonId,
        throughSeasonId: args.game.seasonId,
      },
      seasonType: args.game.type === 3 ? "playoffs" : args.game.type === 1 ? "preSeason" : "regularSeason",
      strength: args.strength,
      scoreState: "allScores",
      statMode: args.mode,
      displayMode: args.displayMode,
    },
    expandable: {
      advancedOpen: false,
      teamId: null,
      positionGroup: null,
      venue: "all",
      minimumToiSeconds: null,
      scope: { kind: "none" },
      tradeMode: "combine",
    },
    view: {
      sort: {
        sortKey: null,
        direction: "desc",
      },
      pagination: {
        page: 1,
        pageSize: 50,
      },
    },
  };
}

function getPlayerStatsSummaryIdentityKey(args: {
  kind: PlayerStatsLandingAppearanceContext["kind"];
  strength: PlayerStatsSupportedStrength;
  playerId: number;
  teamId: number;
}): string {
  return `${args.kind}:${args.strength}:${args.playerId}:${args.teamId}`;
}

function buildPlayerStatsSummaryPartitionSourceUrl(args: {
  gameId: number;
  mode: PlayerStatsMode;
  strength: PlayerStatsSupportedStrength;
}): string {
  return `${PLAYER_STATS_SUMMARY_PARTITION_SOURCE_URL_PREFIX}${args.mode}/${args.strength}/${args.gameId}`;
}

function getPlayerStatsSummaryPartitionPrefix(args: {
  mode: PlayerStatsMode;
  strength: PlayerStatsSupportedStrength;
}): string {
  return `${PLAYER_STATS_SUMMARY_PARTITION_SOURCE_URL_PREFIX}${args.mode}/${args.strength}/`;
}

function createPlayerStatsSummaryRowFromContext(args: {
  context: PlayerStatsLandingAppearanceContext;
  mode: PlayerStatsMode;
  strength: PlayerStatsSupportedStrength;
  supportedDisplayModes: PlayerStatsDisplayMode[];
}): PlayerStatsLandingSummaryRow {
  const metrics = defaultAggregateMetrics();
  accumulateLandingMetrics(metrics, args.context);

  return {
    kind: args.context.kind,
    mode: args.mode,
    strength: args.strength,
    supportedDisplayModes: args.supportedDisplayModes,
    playerId: args.context.playerId,
    playerName: args.context.playerName,
    positionCode: args.context.positionCode,
    gameId: args.context.gameId,
    seasonId: args.context.seasonId,
    gameDate: args.context.gameDate,
    teamId: args.context.teamId,
    teamAbbrev: args.context.teamAbbrev,
    opponentTeamId: args.context.opponentTeamId,
    isHome: args.context.isHome,
    hasReliableToi: args.context.hasReliableToi,
    metrics,
  };
}

function mergeLandingAggregateMetrics(
  target: PlayerStatsLandingAggregateMetrics,
  delta: PlayerStatsLandingAggregateMetrics
) {
  target.toiSeconds += delta.toiSeconds;
  target.gamesPlayed += delta.gamesPlayed;
  target.onIceGoalsForForIpp += delta.onIceGoalsForForIpp;
  target.hasUnknownToi ||= delta.hasUnknownToi;
  target.hasUnknownOnIceGoalDenominator ||= delta.hasUnknownOnIceGoalDenominator;

  target.individual.goals += delta.individual.goals;
  target.individual.totalAssists += delta.individual.totalAssists;
  target.individual.firstAssists += delta.individual.firstAssists;
  target.individual.secondAssists += delta.individual.secondAssists;
  target.individual.shots += delta.individual.shots;
  target.individual.ixg = addNullable(target.individual.ixg, delta.individual.ixg);
  target.individual.iCf += delta.individual.iCf;
  target.individual.iFf += delta.individual.iFf;
  target.individual.iScf = addNullable(target.individual.iScf, delta.individual.iScf);
  target.individual.iHdcf = addNullable(target.individual.iHdcf, delta.individual.iHdcf);
  target.individual.rushAttempts += delta.individual.rushAttempts;
  target.individual.reboundsCreated += delta.individual.reboundsCreated;
  target.individual.pim += delta.individual.pim;
  target.individual.totalPenalties += delta.individual.totalPenalties;
  target.individual.minorPenalties += delta.individual.minorPenalties;
  target.individual.majorPenalties += delta.individual.majorPenalties;
  target.individual.misconductPenalties += delta.individual.misconductPenalties;
  target.individual.penaltiesDrawn += delta.individual.penaltiesDrawn;
  target.individual.giveaways += delta.individual.giveaways;
  target.individual.takeaways += delta.individual.takeaways;
  target.individual.hits += delta.individual.hits;
  target.individual.hitsTaken += delta.individual.hitsTaken;
  target.individual.shotsBlocked += delta.individual.shotsBlocked;
  target.individual.faceoffsWon += delta.individual.faceoffsWon;
  target.individual.faceoffsLost += delta.individual.faceoffsLost;

  target.onIce.cf += delta.onIce.cf;
  target.onIce.ca += delta.onIce.ca;
  target.onIce.ff += delta.onIce.ff;
  target.onIce.fa += delta.onIce.fa;
  target.onIce.sf += delta.onIce.sf;
  target.onIce.sa += delta.onIce.sa;
  target.onIce.gf += delta.onIce.gf;
  target.onIce.ga += delta.onIce.ga;
  target.onIce.xgf = addNullable(target.onIce.xgf, delta.onIce.xgf);
  target.onIce.xga = addNullable(target.onIce.xga, delta.onIce.xga);
  target.onIce.scf = addNullable(target.onIce.scf, delta.onIce.scf);
  target.onIce.sca = addNullable(target.onIce.sca, delta.onIce.sca);
  target.onIce.hdcf = addNullable(target.onIce.hdcf, delta.onIce.hdcf);
  target.onIce.hdca = addNullable(target.onIce.hdca, delta.onIce.hdca);
  target.onIce.hdgf = addNullable(target.onIce.hdgf, delta.onIce.hdgf);
  target.onIce.hdga = addNullable(target.onIce.hdga, delta.onIce.hdga);
  target.onIce.mdcf = addNullable(target.onIce.mdcf, delta.onIce.mdcf);
  target.onIce.mdca = addNullable(target.onIce.mdca, delta.onIce.mdca);
  target.onIce.mdgf = addNullable(target.onIce.mdgf, delta.onIce.mdgf);
  target.onIce.mdga = addNullable(target.onIce.mdga, delta.onIce.mdga);
  target.onIce.ldcf = addNullable(target.onIce.ldcf, delta.onIce.ldcf);

  target.goalies.shotsAgainst += delta.goalies.shotsAgainst;
  target.goalies.saves += delta.goalies.saves;
  target.goalies.goalsAgainst += delta.goalies.goalsAgainst;
  target.goalies.xgAgainst = addNullable(target.goalies.xgAgainst, delta.goalies.xgAgainst);
  target.goalies.hdShotsAgainst += delta.goalies.hdShotsAgainst;
  target.goalies.hdSaves += delta.goalies.hdSaves;
  target.goalies.hdGoalsAgainst += delta.goalies.hdGoalsAgainst;
  target.goalies.hdXgAgainst = addNullable(target.goalies.hdXgAgainst, delta.goalies.hdXgAgainst);
  target.goalies.mdShotsAgainst += delta.goalies.mdShotsAgainst;
  target.goalies.mdSaves += delta.goalies.mdSaves;
  target.goalies.mdGoalsAgainst += delta.goalies.mdGoalsAgainst;
  target.goalies.mdXgAgainst = addNullable(target.goalies.mdXgAgainst, delta.goalies.mdXgAgainst);
  target.goalies.ldShotsAgainst += delta.goalies.ldShotsAgainst;
  target.goalies.ldSaves += delta.goalies.ldSaves;
  target.goalies.ldGoalsAgainst += delta.goalies.ldGoalsAgainst;
  target.goalies.ldXgAgainst = addNullable(target.goalies.ldXgAgainst, delta.goalies.ldXgAgainst);
  target.goalies.rushAttemptsAgainst += delta.goalies.rushAttemptsAgainst;
  target.goalies.reboundAttemptsAgainst += delta.goalies.reboundAttemptsAgainst;
  target.goalies.shotDistanceTotal += delta.goalies.shotDistanceTotal;
  target.goalies.shotDistanceCount += delta.goalies.shotDistanceCount;
  target.goalies.goalDistanceTotal += delta.goalies.goalDistanceTotal;
  target.goalies.goalDistanceCount += delta.goalies.goalDistanceCount;
}

function buildPlayerStatsGameSummaryRows(args: {
  gameParity: PlayerStatsLandingNativeGameParity;
  bundle: PlayerStatsLandingSourceBundle;
  identityMaps: PlayerStatsLandingIdentityMaps;
}): PlayerStatsLandingSummaryRow[] {
  const rows: PlayerStatsLandingSummaryRow[] = [];
  const supportedStrengths = [...PLAYER_STATS_SUMMARY_SUPPORTED_STRENGTHS];
  const singleGameBundle: PlayerStatsLandingSourceBundle = {
    games: [args.gameParity.game],
    eventsByGameId: new Map([
      [
        args.gameParity.game.id,
        args.bundle.eventsByGameId.get(args.gameParity.game.id) ?? [],
      ],
    ]),
    shiftRowsByGameId: new Map([
      [
        args.gameParity.game.id,
        args.bundle.shiftRowsByGameId.get(args.gameParity.game.id) ?? [],
      ],
    ]),
    rosterSpotsByGameId: new Map([
      [
        args.gameParity.game.id,
        args.bundle.rosterSpotsByGameId.get(args.gameParity.game.id) ?? [],
      ],
    ]),
    ownGoalEventIdsByGameId: new Map([
      [
        args.gameParity.game.id,
        args.bundle.ownGoalEventIdsByGameId.get(args.gameParity.game.id) ?? new Set(),
      ],
    ]),
  };

  for (const strength of supportedStrengths) {
    const individualCountsState = createPlayerStatsSummaryBuildState({
      game: args.gameParity.game,
      mode: "individual",
      displayMode: "counts",
      strength,
    });
    const individualRatesState = createPlayerStatsSummaryBuildState({
      game: args.gameParity.game,
      mode: "individual",
      displayMode: "rates",
      strength,
    });
    const individualCountContexts = buildPlayerStatsLandingContexts({
      state: individualCountsState,
      parityByGame: [args.gameParity],
      bundle: singleGameBundle,
      identityMaps: args.identityMaps,
    });
    const individualRateContextKeys = new Set(
      buildPlayerStatsLandingContexts({
        state: individualRatesState,
        parityByGame: [args.gameParity],
        bundle: singleGameBundle,
        identityMaps: args.identityMaps,
      }).map((context) =>
        getPlayerStatsSummaryIdentityKey({
          kind: context.kind,
          strength,
          playerId: context.playerId,
          teamId: context.teamId,
        })
      )
    );

    for (const context of individualCountContexts) {
      const contextKey = getPlayerStatsSummaryIdentityKey({
        kind: context.kind,
        strength,
        playerId: context.playerId,
        teamId: context.teamId,
      });
      rows.push(
        createPlayerStatsSummaryRowFromContext({
          context,
          mode: "individual",
          strength,
          supportedDisplayModes: individualRateContextKeys.has(contextKey)
            ? ["counts", "rates"]
            : ["counts"],
        })
      );
    }

    for (const mode of ["onIce", "goalies"] as const) {
      const modeState = createPlayerStatsSummaryBuildState({
        game: args.gameParity.game,
        mode,
        displayMode: "counts",
        strength,
      });
      const contexts = buildPlayerStatsLandingContexts({
        state: modeState,
        parityByGame: [args.gameParity],
        bundle: singleGameBundle,
        identityMaps: args.identityMaps,
      });

      for (const context of contexts) {
        rows.push(
          createPlayerStatsSummaryRowFromContext({
            context,
            mode,
            strength,
            supportedDisplayModes: ["counts", "rates"],
          })
        );
      }
    }
  }

  return rows;
}

function buildPlayerStatsGameSummaryPayload(args: {
  gameParity: PlayerStatsLandingNativeGameParity;
  bundle: PlayerStatsLandingSourceBundle;
  identityMaps: PlayerStatsLandingIdentityMaps;
}): PlayerStatsLandingSummaryPayload {
  return {
    version: PLAYER_STATS_SUMMARY_VERSION,
    generatedAt: new Date().toISOString(),
    game: {
      id: args.gameParity.game.id,
      seasonId: args.gameParity.game.seasonId,
      date: args.gameParity.game.date,
      homeTeamId: args.gameParity.game.homeTeamId,
      awayTeamId: args.gameParity.game.awayTeamId,
    },
    rows: buildPlayerStatsGameSummaryRows(args),
  };
}

function partitionPlayerStatsLandingSummaryPayload(
  payload: PlayerStatsLandingSummaryPayload
): Array<{
  mode: PlayerStatsMode;
  strength: PlayerStatsSupportedStrength;
  payload: PlayerStatsLandingSummaryPayload;
}> {
  const rowsByPartition = new Map<
    string,
    {
      mode: PlayerStatsMode;
      strength: PlayerStatsSupportedStrength;
      rows: PlayerStatsLandingSummaryRow[];
    }
  >();

  for (const row of payload.rows) {
    const key = `${row.mode}:${row.strength}`;
    const existing = rowsByPartition.get(key);

    if (existing) {
      existing.rows.push(row);
      continue;
    }

    rowsByPartition.set(key, {
      mode: row.mode,
      strength: row.strength,
      rows: [row],
    });
  }

  return [...rowsByPartition.values()].map((partition) => ({
    mode: partition.mode,
    strength: partition.strength,
    payload: {
      ...payload,
      rows: partition.rows,
      },
    }));
}

function buildPlayerStatsGameSummaryPartitionPayloads(args: {
  gameParity: PlayerStatsLandingNativeGameParity;
  bundle: PlayerStatsLandingSourceBundle;
  identityMaps: PlayerStatsLandingIdentityMaps;
}): Array<{
  mode: PlayerStatsMode;
  strength: PlayerStatsSupportedStrength;
  payload: PlayerStatsLandingSummaryPayload;
}> {
  return partitionPlayerStatsLandingSummaryPayload(
    buildPlayerStatsGameSummaryPayload(args)
  );
}

function parsePlayerStatsLandingSummaryPayload(
  payload: unknown
): PlayerStatsLandingSummaryPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<PlayerStatsLandingSummaryPayload>;
  if (
    candidate.version !== PLAYER_STATS_SUMMARY_VERSION ||
    !candidate.game ||
    typeof candidate.game.id !== "number" ||
    !Array.isArray(candidate.rows)
  ) {
    return null;
  }

  return candidate as PlayerStatsLandingSummaryPayload;
}

export function flattenPersistedSummaryRows(
  payloadRows: readonly PlayerStatsSummaryPayloadRow[]
): Map<number, PlayerStatsLandingSummaryPayload> {
  const payloadByGameId = new Map<number, PlayerStatsLandingSummaryPayload>();

  for (const row of payloadRows) {
    if (payloadByGameId.has(row.game_id)) {
      continue;
    }

    const parsedPayload = parsePlayerStatsLandingSummaryPayload(row.payload);
    if (!parsedPayload || parsedPayload.game.id !== row.game_id) {
      continue;
    }

    payloadByGameId.set(row.game_id, {
      ...parsedPayload,
      rows: parsedPayload.rows.filter((payloadRow) =>
        isSummaryRowConsistentWithGame({
          game: parsedPayload.game,
          row: payloadRow,
        })
      ),
    });
  }

  return payloadByGameId;
}

async function buildLiveSummaryRowsForGames(args: {
  games: readonly PlayerStatsSourceGameRow[];
  state: PlayerStatsFilterState;
  client?: PlayerStatsSupabaseClient;
}): Promise<PlayerStatsLandingSummaryRow[]> {
  const client = args.client ?? supabase;
  if (args.games.length === 0) {
    return [];
  }

  const bundle = await fetchPlayerStatsLandingSourceBundleForGames({
    games: args.games,
    shouldFetchRosterSpots: true,
    client,
  });
  const parityByGame = buildPlayerStatsLandingParityByGame(bundle);
  const identityMaps = await fetchPlayerStatsLandingIdentityMaps(bundle, client);
  const supportedStrength = isSupportedLandingStrength(args.state.primary.strength)
    ? args.state.primary.strength
    : null;

  return parityByGame.flatMap((gameParity) =>
    buildPlayerStatsGameSummaryPayload({
      gameParity,
      bundle,
      identityMaps,
    }).rows.filter(
      (row) =>
        row.mode === args.state.primary.statMode &&
        (supportedStrength == null || row.strength === supportedStrength)
    )
  );
}

export async function buildPlayerStatsLandingSummarySnapshotsForGameIds(
  gameIds: readonly number[],
  client: PlayerStatsSupabaseClient = supabase
): Promise<PlayerStatsLandingSummarySnapshotRow[]> {
  const games = await fetchPlayerStatsLandingGamesByIds(gameIds, client);
  if (games.length === 0) {
    return [];
  }

  const bundle = await fetchPlayerStatsLandingSourceBundleForGames({
    games,
    shouldFetchRosterSpots: true,
    client,
  });
  const parityByGame = buildPlayerStatsLandingParityByGame(bundle);
  const identityMaps = await fetchPlayerStatsLandingIdentityMaps(bundle, client);

  return parityByGame.flatMap((gameParity) =>
    buildPlayerStatsGameSummaryPartitionPayloads({
      gameParity,
      bundle,
      identityMaps,
    }).map(({ mode, strength, payload }) => ({
      game_id: gameParity.game.id,
      endpoint: PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT,
      season_id: gameParity.game.seasonId,
      game_date: gameParity.game.date,
      source_url: buildPlayerStatsSummaryPartitionSourceUrl({
        gameId: gameParity.game.id,
        mode,
        strength,
      }),
      payload_hash: sha256Json(payload),
      payload,
      fetched_at: payload.generatedAt,
    }))
  );
}

export function buildPlayerStatsLandingSummarySnapshotsFromPayloadRows(
  payloadRows: readonly PlayerStatsSummaryPayloadRow[]
): PlayerStatsLandingSummarySnapshotRow[] {
  return [...flattenPersistedSummaryRows(payloadRows).values()].flatMap((payload) =>
    partitionPlayerStatsLandingSummaryPayload(payload).map(
      ({ mode, strength, payload: partitionPayload }) => ({
        game_id: payload.game.id,
        endpoint: PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT,
        season_id: payload.game.seasonId,
        game_date: payload.game.date,
        source_url: buildPlayerStatsSummaryPartitionSourceUrl({
          gameId: payload.game.id,
          mode,
          strength,
        }),
        payload_hash: sha256Json(partitionPayload),
        payload: partitionPayload,
        fetched_at: partitionPayload.generatedAt,
      })
    )
  );
}

function createLandingRowFromAggregation(args: {
  state: PlayerStatsLandingFilterState;
  contexts: readonly PlayerStatsLandingAppearanceContext[];
  metrics: PlayerStatsLandingAggregateMetrics;
}): PlayerStatsLandingAggregationRow | null {
  const { state, contexts, metrics } = args;
  const [firstContext] = contexts;

  if (!firstContext) {
    return null;
  }

  const resolvedToiSeconds = metrics.hasUnknownToi ? null : metrics.toiSeconds;

  if (
    state.expandable.minimumToiSeconds != null &&
    (resolvedToiSeconds == null ||
      resolvedToiSeconds < state.expandable.minimumToiSeconds)
  ) {
    return null;
  }

  const teamContexts = [...new Map(
    contexts.map((context) => [
      context.teamId,
      {
        teamId: context.teamId,
        teamAbbrev: context.teamAbbrev ?? "—",
        firstGameDate: context.gameDate,
      },
    ])
  ).values()];
  const tradeDisplay = buildLandingTradeDisplay({
    playerId: firstContext.playerId,
    tradeMode: state.expandable.tradeMode,
    teamContexts,
    splitTeamId: state.expandable.tradeMode === "split" ? firstContext.teamId : null,
  });

  return {
    rowKey: tradeDisplay.rowKey,
    playerId: firstContext.playerId,
    playerName: firstContext.playerName,
    positionCode: firstContext.positionCode,
    teamId: tradeDisplay.teamId,
    teamLabel: tradeDisplay.teamLabel,
    gamesPlayed: metrics.gamesPlayed,
    toiSeconds: resolvedToiSeconds,
    toiPerGameSeconds:
      resolvedToiSeconds != null && metrics.gamesPlayed > 0
        ? resolvedToiSeconds / metrics.gamesPlayed
        : null,
    metrics,
  };
}

function createLandingRowFromSummaryRows(args: {
  state: PlayerStatsLandingFilterState;
  rows: readonly PlayerStatsLandingSummaryRow[];
  metrics: PlayerStatsLandingAggregateMetrics;
}): PlayerStatsLandingAggregationRow | null {
  const [firstRow] = args.rows;

  if (!firstRow) {
    return null;
  }

  const resolvedToiSeconds = args.metrics.hasUnknownToi ? null : args.metrics.toiSeconds;

  if (
    args.state.expandable.minimumToiSeconds != null &&
    (resolvedToiSeconds == null ||
      resolvedToiSeconds < args.state.expandable.minimumToiSeconds)
  ) {
    return null;
  }

  const teamContexts = [
    ...new Map(
      args.rows.map((row) => [
        row.teamId,
        {
          teamId: row.teamId,
          teamAbbrev: row.teamAbbrev ?? "—",
          firstGameDate: row.gameDate,
        },
      ])
    ).values(),
  ];
  const tradeDisplay = buildLandingTradeDisplay({
    playerId: firstRow.playerId,
    tradeMode: args.state.expandable.tradeMode,
    teamContexts,
    splitTeamId:
      args.state.expandable.tradeMode === "split" ? firstRow.teamId : null,
  });

  return {
    rowKey: tradeDisplay.rowKey,
    playerId: firstRow.playerId,
    playerName: firstRow.playerName,
    positionCode: firstRow.positionCode,
    teamId: tradeDisplay.teamId,
    teamLabel: tradeDisplay.teamLabel,
    gamesPlayed: args.metrics.gamesPlayed,
    toiSeconds: resolvedToiSeconds,
    toiPerGameSeconds:
      resolvedToiSeconds != null && args.metrics.gamesPlayed > 0
        ? resolvedToiSeconds / args.metrics.gamesPlayed
        : null,
    metrics: args.metrics,
  };
}

function matchesPlayerStatsSummaryRowForState(
  state: PlayerStatsLandingFilterState,
  row: PlayerStatsLandingSummaryRow
): boolean {
  if (row.mode !== state.primary.statMode) {
    return false;
  }

  if (row.strength !== state.primary.strength) {
    return false;
  }

  if (!row.supportedDisplayModes.includes(state.primary.displayMode)) {
    return false;
  }

  if (
    state.expandable.teamId != null &&
    row.teamId !== state.expandable.teamId
  ) {
    return false;
  }

  if (!matchesLandingVenue(state.expandable.venue, row.isHome)) {
    return false;
  }

  if (
    !matchesPlayerStatsPositionGroup({
      rawPosition: row.positionCode,
      positionGroup: state.expandable.positionGroup,
      mode: state.primary.statMode,
    })
  ) {
    return false;
  }

  return true;
}

function getSummaryGroupingKey(
  state: PlayerStatsLandingFilterState,
  row: PlayerStatsLandingSummaryRow
): string {
  return state.expandable.tradeMode === "split"
    ? `${row.playerId}:${row.teamId}`
    : `${row.playerId}`;
}

function takeMostRecentSummaryRows(
  rows: readonly PlayerStatsLandingSummaryRow[],
  value: number | null
): PlayerStatsLandingSummaryRow[] {
  if (value == null || value <= 0) {
    return [...rows];
  }

  return [...rows]
    .sort((left, right) =>
      compareGamesDescending(
        { date: left.gameDate, id: left.gameId },
        { date: right.gameDate, id: right.gameId }
      )
    )
    .slice(0, value);
}

function applyLandingScopeSelectionToSummaryRows(args: {
  state: PlayerStatsLandingFilterState;
  games: readonly PlayerStatsSourceGameRow[];
  rows: readonly PlayerStatsLandingSummaryRow[];
}): PlayerStatsLandingSummaryRow[] {
  const scope = args.state.expandable.scope;

  if (scope.kind === "none" || scope.kind === "dateRange") {
    return [...args.rows];
  }

  const rowsByGroupingKey = new Map<string, PlayerStatsLandingSummaryRow[]>();

  for (const row of args.rows) {
    const key = getSummaryGroupingKey(args.state, row);
    const existing = rowsByGroupingKey.get(key);
    if (existing) {
      existing.push(row);
      continue;
    }

    rowsByGroupingKey.set(key, [row]);
  }

  if (scope.kind === "gameRange") {
    return [...rowsByGroupingKey.values()].flatMap((groupingRows) =>
      takeMostRecentSummaryRows(groupingRows, scope.value)
    );
  }

  return [...rowsByGroupingKey.values()].flatMap((groupingRows) => {
    const selectedGameIds = new Set<number>();
    const explicitTeamId = args.state.expandable.teamId;
    const teamIds =
      explicitTeamId != null
        ? [explicitTeamId]
        : [...new Set(groupingRows.map((row) => row.teamId))];

    for (const teamId of teamIds) {
      const teamGameIds = getSelectedGamesForTeamContext({
        games: args.games,
        teamId,
        venue: args.state.expandable.venue,
        limit: scope.value,
      });

      for (const gameId of teamGameIds) {
        selectedGameIds.add(gameId);
      }
    }

    return groupingRows.filter((row) => selectedGameIds.has(row.gameId));
  });
}

function buildPlayerStatsLandingAggregationFromSummaryRows(args: {
  state: PlayerStatsLandingFilterState;
  games: readonly PlayerStatsSourceGameRow[];
  rows: readonly PlayerStatsLandingSummaryRow[];
}): PlayerStatsLandingAggregationRow[] {
  const filteredRows = args.rows.filter((row) =>
    matchesPlayerStatsSummaryRowForState(args.state, row)
  );
  const scopedRows = applyLandingScopeSelectionToSummaryRows({
    state: args.state,
    games: args.games,
    rows: filteredRows,
  });
  const grouped = new Map<string, PlayerStatsLandingSummaryRow[]>();

  for (const row of scopedRows) {
    const key = getSummaryGroupingKey(args.state, row);
    const existing = grouped.get(key);
    if (existing) {
      existing.push(row);
      continue;
    }

    grouped.set(key, [row]);
  }

  return [...grouped.values()]
    .map((groupRows) => {
      const metrics = defaultAggregateMetrics();
      const uniqueGameIds = new Set<number>();

      for (const row of groupRows) {
        if (uniqueGameIds.has(row.gameId)) {
          continue;
        }

        uniqueGameIds.add(row.gameId);
        mergeLandingAggregateMetrics(metrics, row.metrics);
      }

      return createLandingRowFromSummaryRows({
        state: args.state,
        rows: groupRows,
        metrics,
      });
    })
    .filter((row): row is PlayerStatsLandingAggregationRow => row != null);
}

export { buildPlayerStatsLandingAggregationFromSummaryRows };

function filterLandingAggregationRowsForState(
  state: PlayerStatsFilterState,
  rows: readonly PlayerStatsLandingAggregationRow[]
): PlayerStatsLandingAggregationRow[] {
  return rows.filter((row) => {
    if (
      !matchesPlayerStatsPositionGroup({
        rawPosition: row.positionCode,
        positionGroup: state.expandable.positionGroup,
        mode: state.primary.statMode,
      })
    ) {
      return false;
    }

    if (
      state.expandable.minimumToiSeconds != null &&
      (row.toiSeconds == null || row.toiSeconds < state.expandable.minimumToiSeconds)
    ) {
      return false;
    }

    return true;
  });
}

function buildLandingApiResultFromAggregationRows(args: {
  state: PlayerStatsLandingFilterState;
  rows: readonly PlayerStatsLandingAggregationRow[];
}): PlayerStatsLandingAggregationResult {
  const family = resolveLandingTableFamily(args.state);
  const apiRows = filterLandingAggregationRowsForState(args.state, args.rows).map((row) =>
    mapLandingAggregationRowToApiRow(row, family, args.state.primary.displayMode)
  );

  const sortedRows = sortLandingApiRows(
    apiRows,
    args.state.view.sort.sortKey,
    args.state.view.sort.direction
  );
  const { page, pageSize } = args.state.view.pagination;
  const totalRows = sortedRows.length;
  const totalPages = totalRows === 0 ? 0 : Math.ceil(totalRows / pageSize);
  const start = Math.max(page - 1, 0) * pageSize;

  return {
    family,
    rows: sortedRows.slice(start, start + pageSize),
    sort: args.state.view.sort,
    pagination: {
      page,
      pageSize,
      totalRows,
      totalPages,
    },
  };
}

export { buildLandingApiResultFromAggregationRows };

async function fetchPlayerStatsSummaryRowsForFilterState(args: {
  games: readonly PlayerStatsSourceGameRow[];
  state: PlayerStatsFilterState;
  client?: PlayerStatsSupabaseClient;
}) {
  const client = args.client ?? supabase;
  const gameIds = args.games.map((game) => game.id);
  const supportedStrength = isSupportedLandingStrength(args.state.primary.strength)
    ? args.state.primary.strength
    : null;
  const partitionSummaryPayloadRows =
    supportedStrength == null
      ? []
      : await fetchPlayerStatsSummaryPayloadRows({
          gameIds,
          sourceUrlPrefix: getPlayerStatsSummaryPartitionPrefix({
            mode: args.state.primary.statMode,
            strength: supportedStrength,
          }),
          client,
        });
  const partitionRowsFetchedAt = Date.now();
  const partitionSummaryPayloads = flattenPersistedSummaryRows(
    partitionSummaryPayloadRows
  );
  const missingPartitionGames = args.games.filter(
    (game) => !partitionSummaryPayloads.has(game.id)
  );
  const legacySummaryPayloadRows =
    missingPartitionGames.length === 0
      ? []
      : await fetchPlayerStatsSummaryPayloadRows({
          gameIds: missingPartitionGames.map((game) => game.id),
          sourceUrlPrefix: PLAYER_STATS_SUMMARY_SOURCE_URL_PREFIX,
          client,
        });
  const summaryRowsFetchedAt = Date.now();
  const legacySummaryPayloads = flattenPersistedSummaryRows(legacySummaryPayloadRows);
  const persistedSummaryPayloads = new Map<number, PlayerStatsLandingSummaryPayload>([
    ...legacySummaryPayloads,
    ...partitionSummaryPayloads,
  ]);
  const persistedSummaryRows = [...persistedSummaryPayloads.values()].flatMap(
    (payload) => payload.rows
  );
  const missingSummaryGames = args.games.filter(
    (game) => !persistedSummaryPayloads.has(game.id)
  );
  const liveSummaryRows = await buildLiveSummaryRowsForGames({
    games: missingSummaryGames,
    state: args.state,
    client,
  });
  const liveSummaryRowsBuiltAt = Date.now();

  return {
    supportedStrength,
    partitionSummaryPayloads,
    legacySummaryPayloads,
    persistedSummaryPayloads,
    persistedSummaryRows,
    missingSummaryGames,
    liveSummaryRows,
    partitionRowsFetchedAt,
    summaryRowsFetchedAt,
    liveSummaryRowsBuiltAt,
  };
}

function formatPlayerStatsSeasonLabel(seasonId: number): string {
  const seasonString = String(seasonId);
  if (!/^\d{8}$/.test(seasonString)) {
    return seasonString;
  }

  return `${seasonString.slice(0, 4)}-${seasonString.slice(6, 8)}`;
}

function matchesPlayerStatsSummaryRowForDetailState(
  playerId: number,
  state: PlayerStatsDetailFilterState,
  row: PlayerStatsLandingSummaryRow
): boolean {
  if (row.playerId !== playerId) {
    return false;
  }

  if (row.mode !== state.primary.statMode) {
    return false;
  }

  if (row.strength !== state.primary.strength) {
    return false;
  }

  if (!row.supportedDisplayModes.includes(state.primary.displayMode)) {
    return false;
  }

  if (
    state.expandable.againstTeamId != null &&
    row.opponentTeamId !== state.expandable.againstTeamId
  ) {
    return false;
  }

  if (!matchesLandingVenue(state.expandable.venue, row.isHome)) {
    return false;
  }

  if (
    !matchesPlayerStatsPositionGroup({
      rawPosition: row.positionCode,
      positionGroup: state.expandable.positionGroup,
      mode: state.primary.statMode,
    })
  ) {
    return false;
  }

  return true;
}

function getDetailGroupingKey(
  state: PlayerStatsDetailFilterState,
  row: PlayerStatsLandingSummaryRow
): string {
  return state.expandable.tradeMode === "split"
    ? `${row.seasonId}:${row.teamId}`
    : `${row.seasonId}`;
}

function buildPlayerStatsDetailAggregationFromSummaryRows(args: {
  playerId: number;
  state: PlayerStatsDetailFilterState;
  games: readonly PlayerStatsSourceGameRow[];
  rows: readonly PlayerStatsLandingSummaryRow[];
}): PlayerStatsDetailAggregationRow[] {
  const filteredRows = args.rows.filter((row) =>
    matchesPlayerStatsSummaryRowForDetailState(args.playerId, args.state, row)
  );
  const scopedRows = applyLandingScopeSelectionToSummaryRows({
    state: args.state,
    games: args.games,
    rows: filteredRows,
  });
  const grouped = new Map<string, PlayerStatsLandingSummaryRow[]>();

  for (const row of scopedRows) {
    const key = getDetailGroupingKey(args.state, row);
    const existing = grouped.get(key);
    if (existing) {
      existing.push(row);
      continue;
    }

    grouped.set(key, [row]);
  }

  return [...grouped.values()]
    .map((groupRows) => {
      const [firstRow] = groupRows;
      if (!firstRow) {
        return null;
      }

      const metrics = defaultAggregateMetrics();
      const uniqueGameIds = new Set<number>();

      for (const row of groupRows) {
        if (uniqueGameIds.has(row.gameId)) {
          continue;
        }

        uniqueGameIds.add(row.gameId);
        mergeLandingAggregateMetrics(metrics, row.metrics);
      }

      const baseRow = createLandingRowFromSummaryRows({
        state: args.state,
        rows: groupRows,
        metrics,
      });

      if (!baseRow) {
        return null;
      }

      return {
        ...baseRow,
        rowKey:
          args.state.expandable.tradeMode === "split"
            ? `detail:seasonTeam:${args.playerId}:${firstRow.seasonId}:${firstRow.teamId}`
            : `detail:season:${args.playerId}:${firstRow.seasonId}`,
        seasonId: firstRow.seasonId,
        seasonLabel: formatPlayerStatsSeasonLabel(firstRow.seasonId),
      };
    })
    .filter((row): row is PlayerStatsDetailAggregationRow => row != null);
}

export { buildPlayerStatsDetailAggregationFromSummaryRows };

function buildDetailApiResultFromAggregationRows(args: {
  playerId: number;
  state: PlayerStatsDetailFilterState;
  rows: readonly PlayerStatsDetailAggregationRow[];
}): PlayerStatsDetailAggregationResult {
  const family = resolveLandingTableFamily(args.state);
  const apiRows = filterLandingAggregationRowsForState(args.state, args.rows).map(
    (row) => ({
      ...mapLandingAggregationRowToApiRow(
        row,
        family,
        args.state.primary.displayMode
      ),
      seasonId: row.seasonId,
      seasonLabel: row.seasonLabel,
    })
  );
  const sortedRows = sortLandingApiRows(
    apiRows,
    args.state.view.sort.sortKey,
    args.state.view.sort.direction
  );
  const { page, pageSize } = args.state.view.pagination;
  const totalRows = sortedRows.length;
  const totalPages = totalRows === 0 ? 0 : Math.ceil(totalRows / pageSize);
  const start = Math.max(page - 1, 0) * pageSize;

  return {
    playerId: args.playerId,
    family,
    rows: sortedRows.slice(start, start + pageSize),
    sort: args.state.view.sort,
    pagination: {
      page,
      pageSize,
      totalRows,
      totalPages,
    },
  };
}

export { buildDetailApiResultFromAggregationRows };

function mapLandingAggregationRowToApiRow(
  row: PlayerStatsLandingAggregationRow,
  family: PlayerStatsTableFamily,
  displayMode: PlayerStatsDisplayMode
): PlayerStatsLandingApiRow {
  const base = {
    rowKey: row.rowKey,
    playerName: row.playerName,
    teamLabel: row.teamLabel,
    positionCode: family === "goalieCounts" || family === "goalieRates" ? null : row.positionCode,
    gamesPlayed: row.gamesPlayed,
    toiSeconds: row.toiSeconds,
    toiPerGameSeconds: row.toiPerGameSeconds,
  } satisfies PlayerStatsLandingApiRow;

  if (family === "individualCounts" || family === "individualRates") {
    const totalPoints = row.metrics.individual.goals + row.metrics.individual.totalAssists;
    const faceoffDenominator =
      row.metrics.individual.faceoffsWon + row.metrics.individual.faceoffsLost;
    const payload = {
      ...base,
      goals: row.metrics.individual.goals,
      totalAssists: row.metrics.individual.totalAssists,
      firstAssists: row.metrics.individual.firstAssists,
      secondAssists: row.metrics.individual.secondAssists,
      totalPoints,
      ipp: row.metrics.hasUnknownOnIceGoalDenominator
        ? null
        : toPctDecimal(totalPoints, row.metrics.onIceGoalsForForIpp),
      shots: row.metrics.individual.shots,
      shootingPct: toPctDecimal(row.metrics.individual.goals, row.metrics.individual.shots),
      ixg: row.metrics.individual.ixg,
      iCf: row.metrics.individual.iCf,
      iFf: row.metrics.individual.iFf,
      iScf: row.metrics.individual.iScf,
      iHdcf: row.metrics.individual.iHdcf,
      rushAttempts: row.metrics.individual.rushAttempts,
      reboundsCreated: row.metrics.individual.reboundsCreated,
      pim: row.metrics.individual.pim,
      totalPenalties: row.metrics.individual.totalPenalties,
      minorPenalties: row.metrics.individual.minorPenalties,
      majorPenalties: row.metrics.individual.majorPenalties,
      misconductPenalties: row.metrics.individual.misconductPenalties,
      penaltiesDrawn: row.metrics.individual.penaltiesDrawn,
      giveaways: row.metrics.individual.giveaways,
      takeaways: row.metrics.individual.takeaways,
      hits: row.metrics.individual.hits,
      hitsTaken: row.metrics.individual.hitsTaken,
      shotsBlocked: row.metrics.individual.shotsBlocked,
      faceoffsWon: row.metrics.individual.faceoffsWon,
      faceoffsLost: row.metrics.individual.faceoffsLost,
      faceoffPct: toPctDecimal(row.metrics.individual.faceoffsWon, faceoffDenominator),
    } satisfies PlayerStatsLandingApiRow;

    if (displayMode === "counts") {
      return payload;
    }

    return {
      ...payload,
      goalsPer60: toPer60(row.metrics.individual.goals, row.toiSeconds),
      totalAssistsPer60: toPer60(row.metrics.individual.totalAssists, row.toiSeconds),
      firstAssistsPer60: toPer60(row.metrics.individual.firstAssists, row.toiSeconds),
      secondAssistsPer60: toPer60(row.metrics.individual.secondAssists, row.toiSeconds),
      totalPointsPer60: toPer60(totalPoints, row.toiSeconds),
      shotsPer60: toPer60(row.metrics.individual.shots, row.toiSeconds),
      ixgPer60: toPer60(row.metrics.individual.ixg, row.toiSeconds),
      iCfPer60: toPer60(row.metrics.individual.iCf, row.toiSeconds),
      iFfPer60: toPer60(row.metrics.individual.iFf, row.toiSeconds),
      iScfPer60: toPer60(row.metrics.individual.iScf, row.toiSeconds),
      iHdcfPer60: toPer60(row.metrics.individual.iHdcf, row.toiSeconds),
      rushAttemptsPer60: toPer60(row.metrics.individual.rushAttempts, row.toiSeconds),
      reboundsCreatedPer60: toPer60(row.metrics.individual.reboundsCreated, row.toiSeconds),
      pimPer60: toPer60(row.metrics.individual.pim, row.toiSeconds),
      totalPenaltiesPer60: toPer60(row.metrics.individual.totalPenalties, row.toiSeconds),
      minorPenaltiesPer60: toPer60(row.metrics.individual.minorPenalties, row.toiSeconds),
      majorPenaltiesPer60: toPer60(row.metrics.individual.majorPenalties, row.toiSeconds),
      misconductPenaltiesPer60: toPer60(
        row.metrics.individual.misconductPenalties,
        row.toiSeconds
      ),
      penaltiesDrawnPer60: toPer60(row.metrics.individual.penaltiesDrawn, row.toiSeconds),
      giveawaysPer60: toPer60(row.metrics.individual.giveaways, row.toiSeconds),
      takeawaysPer60: toPer60(row.metrics.individual.takeaways, row.toiSeconds),
      hitsPer60: toPer60(row.metrics.individual.hits, row.toiSeconds),
      hitsTakenPer60: toPer60(row.metrics.individual.hitsTaken, row.toiSeconds),
      shotsBlockedPer60: toPer60(row.metrics.individual.shotsBlocked, row.toiSeconds),
      faceoffsWonPer60: toPer60(row.metrics.individual.faceoffsWon, row.toiSeconds),
      faceoffsLostPer60: toPer60(row.metrics.individual.faceoffsLost, row.toiSeconds),
    };
  }

  if (family === "onIceCounts" || family === "onIceRates") {
    const payload = {
      ...base,
      cf: row.metrics.onIce.cf,
      ca: row.metrics.onIce.ca,
      cfPct: toPctDecimal(row.metrics.onIce.cf, row.metrics.onIce.cf + row.metrics.onIce.ca),
      ff: row.metrics.onIce.ff,
      fa: row.metrics.onIce.fa,
      ffPct: toPctDecimal(row.metrics.onIce.ff, row.metrics.onIce.ff + row.metrics.onIce.fa),
      sf: row.metrics.onIce.sf,
      sa: row.metrics.onIce.sa,
      sfPct: toPctDecimal(row.metrics.onIce.sf, row.metrics.onIce.sf + row.metrics.onIce.sa),
      gf: row.metrics.onIce.gf,
      ga: row.metrics.onIce.ga,
      gfPct: toPctDecimal(row.metrics.onIce.gf, row.metrics.onIce.gf + row.metrics.onIce.ga),
      xgf: row.metrics.onIce.xgf,
      xga: row.metrics.onIce.xga,
      xgfPct:
        row.metrics.onIce.xgf != null && row.metrics.onIce.xga != null
          ? toPctDecimal(row.metrics.onIce.xgf, row.metrics.onIce.xgf + row.metrics.onIce.xga)
          : null,
      scf: row.metrics.onIce.scf,
      sca: row.metrics.onIce.sca,
      scfPct:
        row.metrics.onIce.scf != null && row.metrics.onIce.sca != null
          ? toPctDecimal(row.metrics.onIce.scf, row.metrics.onIce.scf + row.metrics.onIce.sca)
          : null,
      hdcf: row.metrics.onIce.hdcf,
      hdca: row.metrics.onIce.hdca,
      hdcfPct:
        row.metrics.onIce.hdcf != null && row.metrics.onIce.hdca != null
          ? toPctDecimal(row.metrics.onIce.hdcf, row.metrics.onIce.hdcf + row.metrics.onIce.hdca)
          : null,
      hdgf: row.metrics.onIce.hdgf,
      hdga: row.metrics.onIce.hdga,
      hdgfPct:
        row.metrics.onIce.hdgf != null && row.metrics.onIce.hdga != null
          ? toPctDecimal(row.metrics.onIce.hdgf, row.metrics.onIce.hdgf + row.metrics.onIce.hdga)
          : null,
      mdcf: row.metrics.onIce.mdcf,
      mdca: row.metrics.onIce.mdca,
      mdcfPct:
        row.metrics.onIce.mdcf != null && row.metrics.onIce.mdca != null
          ? toPctDecimal(row.metrics.onIce.mdcf, row.metrics.onIce.mdcf + row.metrics.onIce.mdca)
          : null,
      mdgf: row.metrics.onIce.mdgf,
      mdga: row.metrics.onIce.mdga,
      mdgfPct:
        row.metrics.onIce.mdgf != null && row.metrics.onIce.mdga != null
          ? toPctDecimal(row.metrics.onIce.mdgf, row.metrics.onIce.mdgf + row.metrics.onIce.mdga)
          : null,
      ldcf: row.metrics.onIce.ldcf,
    } satisfies PlayerStatsLandingApiRow;

    if (displayMode === "counts") {
      return payload;
    }

    return {
      ...payload,
      cfPer60: toPer60(row.metrics.onIce.cf, row.toiSeconds),
      caPer60: toPer60(row.metrics.onIce.ca, row.toiSeconds),
      ffPer60: toPer60(row.metrics.onIce.ff, row.toiSeconds),
      faPer60: toPer60(row.metrics.onIce.fa, row.toiSeconds),
      sfPer60: toPer60(row.metrics.onIce.sf, row.toiSeconds),
      saPer60: toPer60(row.metrics.onIce.sa, row.toiSeconds),
      gfPer60: toPer60(row.metrics.onIce.gf, row.toiSeconds),
      gaPer60: toPer60(row.metrics.onIce.ga, row.toiSeconds),
      xgfPer60: toPer60(row.metrics.onIce.xgf, row.toiSeconds),
      xgaPer60: toPer60(row.metrics.onIce.xga, row.toiSeconds),
      scfPer60: toPer60(row.metrics.onIce.scf, row.toiSeconds),
      scaPer60: toPer60(row.metrics.onIce.sca, row.toiSeconds),
      hdcfPer60: toPer60(row.metrics.onIce.hdcf, row.toiSeconds),
      hdcaPer60: toPer60(row.metrics.onIce.hdca, row.toiSeconds),
      hdgfPer60: toPer60(row.metrics.onIce.hdgf, row.toiSeconds),
      hdgaPer60: toPer60(row.metrics.onIce.hdga, row.toiSeconds),
      mdcfPer60: toPer60(row.metrics.onIce.mdcf, row.toiSeconds),
      mdcaPer60: toPer60(row.metrics.onIce.mdca, row.toiSeconds),
      mdgfPer60: toPer60(row.metrics.onIce.mdgf, row.toiSeconds),
      mdgaPer60: toPer60(row.metrics.onIce.mdga, row.toiSeconds),
    };
  }

  const hdGoalsAgainst = row.metrics.goalies.hdGoalsAgainst;
  const mdGoalsAgainst = row.metrics.goalies.mdGoalsAgainst;
  const ldGoalsAgainst = row.metrics.goalies.ldGoalsAgainst;
  const payload = {
    ...base,
    shotsAgainst: row.metrics.goalies.shotsAgainst,
    saves: row.metrics.goalies.saves,
    goalsAgainst: row.metrics.goalies.goalsAgainst,
    savePct: toPctDecimal(row.metrics.goalies.saves, row.metrics.goalies.shotsAgainst),
    gaa: toGaa(row.metrics.goalies.goalsAgainst, row.toiSeconds),
    gsaa:
      row.metrics.goalies.xgAgainst != null
        ? row.metrics.goalies.xgAgainst - row.metrics.goalies.goalsAgainst
        : null,
    xgAgainst: row.metrics.goalies.xgAgainst,
    hdShotsAgainst: row.metrics.goalies.hdShotsAgainst,
    hdSaves: row.metrics.goalies.hdSaves,
    hdGoalsAgainst,
    hdSavePct: toPctDecimal(row.metrics.goalies.hdSaves, row.metrics.goalies.hdShotsAgainst),
    hdGaa: toGaa(hdGoalsAgainst, row.toiSeconds),
    hdGsaa:
      row.metrics.goalies.hdXgAgainst != null
        ? row.metrics.goalies.hdXgAgainst - hdGoalsAgainst
        : null,
    mdShotsAgainst: row.metrics.goalies.mdShotsAgainst,
    mdSaves: row.metrics.goalies.mdSaves,
    mdGoalsAgainst,
    mdSavePct: toPctDecimal(row.metrics.goalies.mdSaves, row.metrics.goalies.mdShotsAgainst),
    mdGaa: toGaa(mdGoalsAgainst, row.toiSeconds),
    mdGsaa:
      row.metrics.goalies.mdXgAgainst != null
        ? row.metrics.goalies.mdXgAgainst - mdGoalsAgainst
        : null,
    ldShotsAgainst: row.metrics.goalies.ldShotsAgainst,
    ldSaves: row.metrics.goalies.ldSaves,
    ldGoalsAgainst,
    ldSavePct: toPctDecimal(row.metrics.goalies.ldSaves, row.metrics.goalies.ldShotsAgainst),
    ldGaa: toGaa(ldGoalsAgainst, row.toiSeconds),
    ldGsaa:
      row.metrics.goalies.ldXgAgainst != null
        ? row.metrics.goalies.ldXgAgainst - ldGoalsAgainst
        : null,
    rushAttemptsAgainst: row.metrics.goalies.rushAttemptsAgainst,
    reboundAttemptsAgainst: row.metrics.goalies.reboundAttemptsAgainst,
    avgShotDistance: toAverage(
      row.metrics.goalies.shotDistanceTotal,
      row.metrics.goalies.shotDistanceCount
    ),
    avgGoalDistance: toAverage(
      row.metrics.goalies.goalDistanceTotal,
      row.metrics.goalies.goalDistanceCount
    ),
  } satisfies PlayerStatsLandingApiRow;

  if (displayMode === "counts") {
    return payload;
  }

  return {
    ...payload,
    shotsAgainstPer60: toPer60(row.metrics.goalies.shotsAgainst, row.toiSeconds),
    savesPer60: toPer60(row.metrics.goalies.saves, row.toiSeconds),
    gsaaPer60: toPer60(
      row.metrics.goalies.xgAgainst != null
        ? row.metrics.goalies.xgAgainst - row.metrics.goalies.goalsAgainst
        : null,
      row.toiSeconds
    ),
    xgAgainstPer60: toPer60(row.metrics.goalies.xgAgainst, row.toiSeconds),
    hdShotsAgainstPer60: toPer60(row.metrics.goalies.hdShotsAgainst, row.toiSeconds),
    hdSavesPer60: toPer60(row.metrics.goalies.hdSaves, row.toiSeconds),
    hdGsaaPer60: toPer60(
      row.metrics.goalies.hdXgAgainst != null
        ? row.metrics.goalies.hdXgAgainst - hdGoalsAgainst
        : null,
      row.toiSeconds
    ),
    mdShotsAgainstPer60: toPer60(row.metrics.goalies.mdShotsAgainst, row.toiSeconds),
    mdSavesPer60: toPer60(row.metrics.goalies.mdSaves, row.toiSeconds),
    mdGsaaPer60: toPer60(
      row.metrics.goalies.mdXgAgainst != null
        ? row.metrics.goalies.mdXgAgainst - mdGoalsAgainst
        : null,
      row.toiSeconds
    ),
    ldShotsAgainstPer60: toPer60(row.metrics.goalies.ldShotsAgainst, row.toiSeconds),
    ldSavesPer60: toPer60(row.metrics.goalies.ldSaves, row.toiSeconds),
    ldGsaaPer60: toPer60(
      row.metrics.goalies.ldXgAgainst != null
        ? row.metrics.goalies.ldXgAgainst - ldGoalsAgainst
        : null,
      row.toiSeconds
    ),
    rushAttemptsAgainstPer60: toPer60(
      row.metrics.goalies.rushAttemptsAgainst,
      row.toiSeconds
    ),
    reboundAttemptsAgainstPer60: toPer60(
      row.metrics.goalies.reboundAttemptsAgainst,
      row.toiSeconds
    ),
  };
}

function compareNullable(
  left: unknown,
  right: unknown
): number {
  if (left == null && right == null) {
    return 0;
  }

  if (left == null) {
    return 1;
  }

  if (right == null) {
    return -1;
  }

  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left).localeCompare(String(right));
}

function sortLandingApiRows(
  rows: readonly PlayerStatsLandingApiRow[],
  sortKey: string | null,
  direction: PlayerStatsSortDirection
): PlayerStatsLandingApiRow[] {
  const resolvedSortKey = sortKey ?? "playerName";

  return [...rows].sort((left, right) => {
    const primary = compareNullable(left[resolvedSortKey], right[resolvedSortKey]);
    if (primary !== 0) {
      return direction === "asc" ? primary : -primary;
    }

    const fallbacks: readonly string[] = [
      "playerName",
      "teamLabel",
      "positionCode",
      "gamesPlayed",
      "toiSeconds",
      "rowKey",
    ];

    for (const fallbackKey of fallbacks) {
      if (fallbackKey === resolvedSortKey) {
        continue;
      }

      const fallback = compareNullable(left[fallbackKey], right[fallbackKey]);
      if (fallback !== 0) {
        return fallback;
      }
    }

    return 0;
  });
}

export function buildPlayerStatsLandingAggregation(args: {
  state: PlayerStatsLandingFilterState;
  bundle: PlayerStatsLandingSourceBundle;
  parityByGame: readonly PlayerStatsLandingNativeGameParity[];
  identityMaps: PlayerStatsLandingIdentityMaps;
}): PlayerStatsLandingAggregationResult {
  const contexts = applyLandingScopeSelection({
    state: args.state,
    bundle: args.bundle,
    contexts: buildPlayerStatsLandingContexts(args),
  });
  const grouped = new Map<string, PlayerStatsLandingAppearanceContext[]>();

  for (const context of contexts) {
    const key = getGroupingKey(args.state, context);
    const existing = grouped.get(key);
    if (existing) {
      existing.push(context);
      continue;
    }

    grouped.set(key, [context]);
  }

  const family = resolveLandingTableFamily(args.state);
  const rows = [...grouped.values()]
    .map((groupContexts) => {
      const metrics = defaultAggregateMetrics();
      const uniqueGameIds = new Set<number>();

      for (const context of groupContexts) {
        if (uniqueGameIds.has(context.gameId)) {
          continue;
        }

        uniqueGameIds.add(context.gameId);
        accumulateLandingMetrics(metrics, context);
      }

      return createLandingRowFromAggregation({
        state: args.state,
        contexts: groupContexts,
        metrics,
      });
    })
    .filter((row): row is PlayerStatsLandingAggregationRow => row != null)
    .map((row) =>
      mapLandingAggregationRowToApiRow(row, family, args.state.primary.displayMode)
    );
  const sortedRows = sortLandingApiRows(
    rows,
    args.state.view.sort.sortKey,
    args.state.view.sort.direction
  );
  const { page, pageSize } = args.state.view.pagination;
  const totalRows = sortedRows.length;
  const totalPages = totalRows === 0 ? 0 : Math.ceil(totalRows / pageSize);
  const start = Math.max(page - 1, 0) * pageSize;

  return {
    family,
    rows: sortedRows.slice(start, start + pageSize),
    sort: args.state.view.sort,
    pagination: {
      page,
      pageSize,
      totalRows,
      totalPages,
    },
  };
}

export async function buildPlayerStatsLandingAggregationFromState(
  state: PlayerStatsLandingFilterState,
  client: PlayerStatsSupabaseClient = supabase
): Promise<PlayerStatsLandingAggregationResult> {
  const startedAt = Date.now();
  const canUseAggregateCache = canUsePlayerStatsSeasonAggregateCache(state);
  const aggregateCacheKey = canUseAggregateCache
    ? getPlayerStatsSeasonAggregateCacheKey(state)
    : null;
  const cachedAggregateRows =
    aggregateCacheKey == null ? null : getCachedPlayerStatsSeasonAggregateRows(aggregateCacheKey);
  const cacheCheckedAt = Date.now();

  if (cachedAggregateRows != null) {
    const result = buildLandingApiResultFromAggregationRows({
      state,
      rows: cachedAggregateRows,
    });

    if (process.env.NODE_ENV !== "test") {
      console.info("[player-stats] landing aggregation timing", {
        gameCount: null,
        partitionSummaryGameCount: null,
        legacySummaryGameCount: null,
        summaryGameCount: null,
        liveSummaryGameCount: null,
        fetchGamesMs: 0,
        fetchPartitionSummaryMs: 0,
        fetchLegacySummaryMs: 0,
        fetchSummaryMs: 0,
        liveSummaryMs: 0,
        aggregateMs: Date.now() - cacheCheckedAt,
        totalMs: Date.now() - startedAt,
        statMode: state.primary.statMode,
        displayMode: state.primary.displayMode,
        strength: state.primary.strength,
        scope: state.expandable.scope.kind,
        cache: "hit",
      });
    }

    return result;
  }

  const games = await fetchPlayerStatsLandingSourceGames(state, client);
  const gamesResolvedAt = Date.now();
  const {
    supportedStrength,
    partitionSummaryPayloads,
    legacySummaryPayloads,
    persistedSummaryPayloads,
    persistedSummaryRows,
    missingSummaryGames,
    liveSummaryRows,
    partitionRowsFetchedAt,
    summaryRowsFetchedAt,
    liveSummaryRowsBuiltAt,
  } = await fetchPlayerStatsSummaryRowsForFilterState({
    games,
    state,
    client,
  });
  const aggregationState =
    canUseAggregateCache && supportedStrength != null
      ? buildPlayerStatsSeasonAggregateBaseState(state)
      : state;
  const aggregationRows = buildPlayerStatsLandingAggregationFromSummaryRows({
    state: aggregationState,
    games,
    rows: [...persistedSummaryRows, ...liveSummaryRows],
  });
  const aggregationRowsBuiltAt = Date.now();

  if (aggregateCacheKey != null) {
    setCachedPlayerStatsSeasonAggregateRows(aggregateCacheKey, aggregationRows);
  }

  const aggregation = buildLandingApiResultFromAggregationRows({
    state,
    rows: aggregationRows,
  });

  if (process.env.NODE_ENV !== "test") {
    console.info("[player-stats] landing aggregation timing", {
      gameCount: games.length,
      partitionSummaryGameCount: partitionSummaryPayloads.size,
      legacySummaryGameCount: legacySummaryPayloads.size,
      summaryGameCount: persistedSummaryPayloads.size,
      liveSummaryGameCount: missingSummaryGames.length,
      fetchGamesMs: gamesResolvedAt - startedAt,
      fetchPartitionSummaryMs: partitionRowsFetchedAt - gamesResolvedAt,
      fetchLegacySummaryMs: summaryRowsFetchedAt - partitionRowsFetchedAt,
      fetchSummaryMs: summaryRowsFetchedAt - gamesResolvedAt,
      liveSummaryMs: liveSummaryRowsBuiltAt - summaryRowsFetchedAt,
      aggregateMs: aggregationRowsBuiltAt - liveSummaryRowsBuiltAt,
      buildApiRowsMs: Date.now() - aggregationRowsBuiltAt,
      totalMs: Date.now() - startedAt,
      statMode: state.primary.statMode,
      displayMode: state.primary.displayMode,
      strength: state.primary.strength,
      scope: state.expandable.scope.kind,
      cache: aggregateCacheKey == null ? "bypass" : "miss",
    });
  }

  return aggregation;
}

export async function buildPlayerStatsDetailAggregationFromState(
  playerId: number,
  state: PlayerStatsDetailFilterState,
  client: PlayerStatsSupabaseClient = supabase
): Promise<PlayerStatsDetailAggregationResult> {
  const startedAt = Date.now();
  const games = await fetchPlayerStatsDetailSourceGames(state, client);
  const gamesResolvedAt = Date.now();
  const {
    partitionSummaryPayloads,
    legacySummaryPayloads,
    persistedSummaryPayloads,
    persistedSummaryRows,
    missingSummaryGames,
    liveSummaryRows,
    partitionRowsFetchedAt,
    summaryRowsFetchedAt,
    liveSummaryRowsBuiltAt,
  } = await fetchPlayerStatsSummaryRowsForFilterState({
    games,
    state,
    client,
  });
  const aggregationRows = buildPlayerStatsDetailAggregationFromSummaryRows({
    playerId,
    state,
    games,
    rows: [...persistedSummaryRows, ...liveSummaryRows],
  });
  const aggregationRowsBuiltAt = Date.now();
  const aggregation = buildDetailApiResultFromAggregationRows({
    playerId,
    state,
    rows: aggregationRows,
  });

  if (process.env.NODE_ENV !== "test") {
    console.info("[player-stats] detail aggregation timing", {
      playerId,
      gameCount: games.length,
      partitionSummaryGameCount: partitionSummaryPayloads.size,
      legacySummaryGameCount: legacySummaryPayloads.size,
      summaryGameCount: persistedSummaryPayloads.size,
      liveSummaryGameCount: missingSummaryGames.length,
      fetchGamesMs: gamesResolvedAt - startedAt,
      fetchPartitionSummaryMs: partitionRowsFetchedAt - gamesResolvedAt,
      fetchLegacySummaryMs: summaryRowsFetchedAt - partitionRowsFetchedAt,
      fetchSummaryMs: summaryRowsFetchedAt - gamesResolvedAt,
      liveSummaryMs: liveSummaryRowsBuiltAt - summaryRowsFetchedAt,
      aggregateMs: aggregationRowsBuiltAt - liveSummaryRowsBuiltAt,
      buildApiRowsMs: Date.now() - aggregationRowsBuiltAt,
      totalMs: Date.now() - startedAt,
      statMode: state.primary.statMode,
      displayMode: state.primary.displayMode,
      strength: state.primary.strength,
      scope: state.expandable.scope.kind,
      againstTeamId: state.expandable.againstTeamId,
    });
  }

  return aggregation;
}
