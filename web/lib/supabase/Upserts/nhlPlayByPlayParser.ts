import type { Database } from "../database-generated.types";
import {
  buildStrengthContext,
  parseSituationCode,
} from "./nhlStrengthState";

const SHOT_LIKE_TYPES = new Set([
  "goal",
  "shot-on-goal",
  "missed-shot",
  "blocked-shot",
  "failed-shot-attempt",
]);

const DEFAULT_REGULATION_PERIOD_SECONDS = 20 * 60;
const DEFAULT_REGULAR_SEASON_OT_SECONDS = 5 * 60;

type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

type NhlApiPbpEventInsert =
  Database["public"]["Tables"]["nhl_api_pbp_events"]["Insert"] & {
    raw_event?: JsonValue | null;
    details?: JsonValue | null;
  };

type RawEventJson = JsonValue | null;
type DetailsJson = JsonValue | null;

type LocalizedName = {
  default?: string | null;
};

export type NhlPlayByPlayDetails = {
  eventOwnerTeamId?: number | string | null;
  losingPlayerId?: number | string | null;
  winningPlayerId?: number | string | null;
  shootingPlayerId?: number | string | null;
  scoringPlayerId?: number | string | null;
  goalieInNetId?: number | string | null;
  blockingPlayerId?: number | string | null;
  hittingPlayerId?: number | string | null;
  hitteePlayerId?: number | string | null;
  committedByPlayerId?: number | string | null;
  drawnByPlayerId?: number | string | null;
  servedByPlayerId?: number | string | null;
  playerId?: number | string | null;
  assist1PlayerId?: number | string | null;
  assist2PlayerId?: number | string | null;
  shotType?: string | null;
  typeCode?: number | string | null;
  descKey?: string | null;
  duration?: number | string | null;
  reason?: string | null;
  secondaryReason?: string | null;
  xCoord?: number | string | null;
  yCoord?: number | string | null;
  zoneCode?: string | null;
  homeScore?: number | string | null;
  awayScore?: number | string | null;
  homeSOG?: number | string | null;
  awaySOG?: number | string | null;
  [key: string]: unknown;
};

export type NhlPlayByPlayEvent = {
  eventId?: number | string | null;
  sortOrder?: number | string | null;
  periodDescriptor?: {
    number?: number | string | null;
    periodType?: string | null;
  } | null;
  timeInPeriod?: string | null;
  timeRemaining?: string | null;
  situationCode?: string | null;
  homeTeamDefendingSide?: string | null;
  typeCode?: number | string | null;
  typeDescKey?: string | null;
  details?: NhlPlayByPlayDetails | null;
  [key: string]: unknown;
};

export type NhlPlayByPlayGame = {
  id: number | string;
  season?: number | string | null;
  gameDate?: string | null;
  homeTeam: {
    id: number | string;
    abbrev?: string | null;
    name?: LocalizedName | null;
  };
  awayTeam: {
    id: number | string;
    abbrev?: string | null;
    name?: LocalizedName | null;
  };
  plays?: NhlPlayByPlayEvent[] | null;
};

type OrderedEvent = {
  play: NhlPlayByPlayEvent;
  eventId: number;
  sortOrder: number | null;
  orderKey: number;
  originalIndex: number;
};

export type ParsedNhlPbpEvent = NhlApiPbpEventInsert & {
  raw_event: RawEventJson;
  details: DetailsJson;
  event_owner_side: "home" | "away" | null;
  event_index: number;
  period_duration_seconds: number | null;
  game_seconds_elapsed: number | null;
  previous_event_id: number | null;
  previous_event_sort_order: number | null;
  previous_event_type_desc_key: string | null;
  next_event_id: number | null;
  next_event_sort_order: number | null;
  next_event_type_desc_key: string | null;
  seconds_since_previous_event: number | null;
};

export function parseClockToSeconds(clock: string | null | undefined): number | null {
  if (typeof clock !== "string") return null;
  const [minutes, seconds] = clock.trim().split(":").map(Number);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return minutes * 60 + seconds;
}

function toNullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toNullableInteger(value: unknown): number | null {
  const num = toNullableNumber(value);
  return num == null ? null : Math.trunc(num);
}

function toNullableString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function defaultPeriodDurationSeconds(periodType: string | null): number | null {
  const normalized = periodType?.trim().toUpperCase() ?? null;
  if (!normalized) return DEFAULT_REGULATION_PERIOD_SECONDS;
  if (normalized.includes("SHOOTOUT")) return 0;
  if (
    normalized.includes("OT") ||
    normalized.includes("OVERTIME") ||
    normalized === "SO"
  ) {
    return DEFAULT_REGULAR_SEASON_OT_SECONDS;
  }
  return DEFAULT_REGULATION_PERIOD_SECONDS;
}

function derivePeriodDurationSeconds(play: NhlPlayByPlayEvent): number | null {
  const elapsed = parseClockToSeconds(play.timeInPeriod);
  const remaining = parseClockToSeconds(play.timeRemaining);
  if (elapsed == null || remaining == null) return null;
  return elapsed + remaining;
}

function getOrderedEvents(game: NhlPlayByPlayGame): OrderedEvent[] {
  return (game.plays ?? [])
    .map((play, originalIndex) => {
      const eventId = toNullableInteger(play.eventId);
      if (eventId == null) return null;

      const sortOrder = toNullableInteger(play.sortOrder);

      return {
        play,
        eventId,
        sortOrder,
        orderKey: sortOrder ?? eventId,
        originalIndex,
      };
    })
    .filter((play): play is OrderedEvent => play !== null)
    .sort((left, right) => {
      if (left.orderKey !== right.orderKey) return left.orderKey - right.orderKey;
      if (left.eventId !== right.eventId) return left.eventId - right.eventId;
      return left.originalIndex - right.originalIndex;
    });
}

function buildPeriodDurations(orderedEvents: OrderedEvent[]): Map<number, number> {
  const durations = new Map<number, number>();

  for (const { play } of orderedEvents) {
    const periodNumber = toNullableInteger(play.periodDescriptor?.number);
    if (periodNumber == null) continue;

    const inferred = derivePeriodDurationSeconds(play);
    const fallback = defaultPeriodDurationSeconds(
      toNullableString(play.periodDescriptor?.periodType)
    );
    const candidate = inferred ?? fallback;
    if (candidate == null) continue;

    const existing = durations.get(periodNumber);
    durations.set(periodNumber, Math.max(existing ?? 0, candidate));
  }

  return durations;
}

function cumulativeSecondsBeforePeriod(
  periodNumber: number | null,
  orderedEvents: OrderedEvent[],
  periodDurations: Map<number, number>
): number | null {
  if (periodNumber == null || periodNumber <= 1) return 0;

  let total = 0;
  for (let current = 1; current < periodNumber; current += 1) {
    const duration = periodDurations.get(current);
    if (duration != null) {
      total += duration;
      continue;
    }

    const representative = orderedEvents.find(
      ({ play }) => toNullableInteger(play.periodDescriptor?.number) === current
    );
    const fallback = defaultPeriodDurationSeconds(
      toNullableString(representative?.play.periodDescriptor?.periodType)
    );
    if (fallback == null) return null;
    total += fallback;
  }

  return total;
}

export function parseNhlPlayByPlayEvents(
  game: NhlPlayByPlayGame,
  options: {
    sourcePlayByPlayHash: string;
    parserVersion?: number;
    strengthVersion?: number;
    now?: string;
  }
): ParsedNhlPbpEvent[] {
  const parserVersion = options.parserVersion ?? 1;
  const strengthVersion = options.strengthVersion ?? 1;
  const now = options.now ?? new Date().toISOString();
  const seasonId = toNullableInteger(game.season);
  const gameId = toNullableInteger(game.id);
  const homeTeamId = toNullableInteger(game.homeTeam.id);
  const awayTeamId = toNullableInteger(game.awayTeam.id);

  if (gameId == null) {
    throw new Error("Cannot parse NHL play-by-play without a numeric game id");
  }
  if (homeTeamId == null || awayTeamId == null) {
    throw new Error("Cannot parse NHL play-by-play without numeric home and away team ids");
  }

  const orderedEvents = getOrderedEvents(game);
  const periodDurations = buildPeriodDurations(orderedEvents);

  return orderedEvents.map(({ play, eventId, sortOrder }, eventIndex) => {
    const previous = eventIndex > 0 ? orderedEvents[eventIndex - 1] : null;
    const next = eventIndex < orderedEvents.length - 1 ? orderedEvents[eventIndex + 1] : null;
    const details = (play.details ?? {}) as NhlPlayByPlayDetails;
    const typeDescKey = toNullableString(play.typeDescKey);
    const periodNumber = toNullableInteger(play.periodDescriptor?.number);
    const periodType = toNullableString(play.periodDescriptor?.periodType);
    const periodSecondsElapsed = parseClockToSeconds(play.timeInPeriod);
    const timeRemainingSeconds = parseClockToSeconds(play.timeRemaining);
    const periodDurationSeconds = derivePeriodDurationSeconds(play);
    const cumulativeBefore = cumulativeSecondsBeforePeriod(
      periodNumber,
      orderedEvents,
      periodDurations
    );
    const gameSecondsElapsed =
      cumulativeBefore == null || periodSecondsElapsed == null
        ? null
        : cumulativeBefore + periodSecondsElapsed;
    const parsedSituation = parseSituationCode(play.situationCode);
    const ownerTeamId = toNullableInteger(details.eventOwnerTeamId);
    const strength = buildStrengthContext(
      parsedSituation,
      ownerTeamId,
      homeTeamId,
      awayTeamId
    );

    const previousPeriodNumber = previous
      ? toNullableInteger(previous.play.periodDescriptor?.number)
      : null;
    const previousPeriodElapsed = previous
      ? parseClockToSeconds(previous.play.timeInPeriod)
      : null;
    const previousCumulativeBefore = previous
      ? cumulativeSecondsBeforePeriod(previousPeriodNumber, orderedEvents, periodDurations)
      : null;
    const previousGameSecondsElapsed =
      previousCumulativeBefore == null || previousPeriodElapsed == null
        ? null
        : previousCumulativeBefore + previousPeriodElapsed;

    return {
      game_id: gameId,
      season_id: seasonId,
      game_date: toNullableString(game.gameDate),
      source_play_by_play_hash: options.sourcePlayByPlayHash,
      parser_version: parserVersion,
      strength_version: strengthVersion,
      event_id: eventId,
      sort_order: sortOrder,
      period_number: periodNumber,
      period_type: periodType,
      time_in_period: toNullableString(play.timeInPeriod),
      time_remaining: toNullableString(play.timeRemaining),
      period_seconds_elapsed: periodSecondsElapsed,
      time_remaining_seconds: timeRemainingSeconds,
      situation_code: parsedSituation?.raw ?? toNullableString(play.situationCode),
      away_goalie: parsedSituation?.awayGoalie ?? null,
      away_skaters: parsedSituation?.awaySkaters ?? null,
      home_skaters: parsedSituation?.homeSkaters ?? null,
      home_goalie: parsedSituation?.homeGoalie ?? null,
      strength_exact: strength.strengthExact,
      strength_state: strength.strengthState,
      home_team_defending_side: toNullableString(play.homeTeamDefendingSide),
      type_code: toNullableInteger(play.typeCode),
      type_desc_key: typeDescKey,
      event_owner_team_id: ownerTeamId,
      event_owner_side: strength.eventOwnerSide,
      is_shot_like: typeDescKey != null && SHOT_LIKE_TYPES.has(typeDescKey),
      is_goal: typeDescKey === "goal",
      is_penalty: typeDescKey === "penalty",
      raw_event: play as RawEventJson,
      details: details as DetailsJson,
      losing_player_id: toNullableInteger(details.losingPlayerId),
      winning_player_id: toNullableInteger(details.winningPlayerId),
      shooting_player_id: toNullableInteger(details.shootingPlayerId),
      scoring_player_id: toNullableInteger(details.scoringPlayerId),
      goalie_in_net_id: toNullableInteger(details.goalieInNetId),
      blocking_player_id: toNullableInteger(details.blockingPlayerId),
      hitting_player_id: toNullableInteger(details.hittingPlayerId),
      hittee_player_id: toNullableInteger(details.hitteePlayerId),
      committed_by_player_id: toNullableInteger(details.committedByPlayerId),
      drawn_by_player_id: toNullableInteger(details.drawnByPlayerId),
      served_by_player_id: toNullableInteger(details.servedByPlayerId),
      player_id: toNullableInteger(details.playerId),
      assist1_player_id: toNullableInteger(details.assist1PlayerId),
      assist2_player_id: toNullableInteger(details.assist2PlayerId),
      shot_type: toNullableString(details.shotType),
      penalty_type_code: toNullableString(details.typeCode),
      penalty_desc_key: toNullableString(details.descKey),
      penalty_duration_minutes: toNullableInteger(details.duration),
      reason: toNullableString(details.reason),
      secondary_reason: toNullableString(details.secondaryReason),
      x_coord: toNullableNumber(details.xCoord),
      y_coord: toNullableNumber(details.yCoord),
      zone_code: toNullableString(details.zoneCode),
      home_score: toNullableInteger(details.homeScore),
      away_score: toNullableInteger(details.awayScore),
      home_sog: toNullableInteger(details.homeSOG),
      away_sog: toNullableInteger(details.awaySOG),
      updated_at: now,
      event_index: eventIndex,
      period_duration_seconds: periodDurationSeconds,
      game_seconds_elapsed: gameSecondsElapsed,
      previous_event_id: previous?.eventId ?? null,
      previous_event_sort_order: previous?.sortOrder ?? null,
      previous_event_type_desc_key: previous
        ? toNullableString(previous.play.typeDescKey)
        : null,
      next_event_id: next?.eventId ?? null,
      next_event_sort_order: next?.sortOrder ?? null,
      next_event_type_desc_key: next ? toNullableString(next.play.typeDescKey) : null,
      seconds_since_previous_event:
        gameSecondsElapsed == null || previousGameSecondsElapsed == null
          ? null
          : gameSecondsElapsed - previousGameSecondsElapsed,
    };
  });
}
