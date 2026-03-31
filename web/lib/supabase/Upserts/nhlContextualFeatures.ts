import type { Database } from "../database-generated.types";
import { evaluateNormalizedEventInclusion } from "./nhlEventInclusion";
import { buildOnIceAttributionForEvent } from "./nhlOnIceAttribution";
import type { ParsedNhlPbpEvent } from "./nhlPlayByPlayParser";
import { buildPriorEventContexts } from "./nhlPriorEventContext";
import {
  classifyTeamStrengthState,
  parseSituationCode,
} from "./nhlStrengthState";
import {
  buildShiftStints,
  normalizeShiftIntervals,
  type NhlShiftInterval,
} from "./nhlShiftStints";

type ShiftRow = Database["public"]["Tables"]["nhl_api_shift_rows"]["Row"];

export type NhlContextualFeatureContext = {
  gameId: number;
  eventId: number;
  ownerPowerPlayAgeSeconds: number | null;
  opponentPowerPlayAgeSeconds: number | null;
  homePowerPlayAgeSeconds: number | null;
  awayPowerPlayAgeSeconds: number | null;
  shooterShiftAgeSeconds: number | null;
  shooterPreviousShiftGapSeconds: number | null;
  shooterPreviousShiftDurationSeconds: number | null;
  ownerAverageShiftAgeSeconds: number | null;
  ownerMaxShiftAgeSeconds: number | null;
  ownerAveragePreviousShiftGapSeconds: number | null;
  ownerAveragePreviousShiftDurationSeconds: number | null;
  opponentAverageShiftAgeSeconds: number | null;
  opponentMaxShiftAgeSeconds: number | null;
  opponentAveragePreviousShiftGapSeconds: number | null;
  opponentAveragePreviousShiftDurationSeconds: number | null;
  eastWestMovementFeet: number | null;
  northSouthMovementFeet: number | null;
  crossedRoyalRoad: boolean | null;
};

type PowerPlayAgeState = {
  state: "EV" | "PP" | "SH" | "EN" | null;
  strengthExact: string | null;
  segmentStartSeconds: number | null;
};

function getEventOrder(event: ParsedNhlPbpEvent): number {
  return event.sort_order ?? event.event_id;
}

function sortEvents(events: ParsedNhlPbpEvent[]): ParsedNhlPbpEvent[] {
  return [...events].sort((left, right) => {
    if (left.game_id !== right.game_id) return left.game_id - right.game_id;
    const leftOrder = getEventOrder(left);
    const rightOrder = getEventOrder(right);
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.event_id - right.event_id;
  });
}

function buildIntervalIndex(
  shiftRows: ShiftRow[]
): Map<string, NhlShiftInterval[]> {
  const index = new Map<string, NhlShiftInterval[]>();

  for (const interval of normalizeShiftIntervals(shiftRows)) {
    const key = `${interval.gameId}:${interval.period}:${interval.playerId}`;
    const existing = index.get(key);
    if (existing) {
      existing.push(interval);
    } else {
      index.set(key, [interval]);
    }
  }

  return index;
}

function buildPlayerHistoryIndex(
  shiftRows: ShiftRow[]
): Map<string, NhlShiftInterval[]> {
  const index = new Map<string, NhlShiftInterval[]>();

  for (const interval of normalizeShiftIntervals(shiftRows)) {
    const key = `${interval.gameId}:${interval.playerId}`;
    const existing = index.get(key);
    if (existing) {
      existing.push(interval);
    } else {
      index.set(key, [interval]);
    }
  }

  for (const intervals of index.values()) {
    intervals.sort((left, right) => {
      if (left.period !== right.period) return left.period - right.period;
      if (left.startSecond !== right.startSecond) return left.startSecond - right.startSecond;
      if (left.endSecond !== right.endSecond) return left.endSecond - right.endSecond;
      return left.shiftId - right.shiftId;
    });
  }

  return index;
}

function findActiveInterval(
  intervalIndex: Map<string, NhlShiftInterval[]>,
  event: ParsedNhlPbpEvent,
  playerId: number | null
): NhlShiftInterval | null {
  if (
    playerId == null ||
    event.period_number == null ||
    event.period_seconds_elapsed == null
  ) {
    return null;
  }

  const key = `${event.game_id}:${event.period_number}:${playerId}`;
  const intervals = intervalIndex.get(key) ?? [];

  return (
    intervals.find(
      (interval) =>
        interval.startSecond <= event.period_seconds_elapsed! &&
        event.period_seconds_elapsed! < interval.endSecond
    ) ?? null
  );
}

function computePlayerShiftAgeSeconds(
  intervalIndex: Map<string, NhlShiftInterval[]>,
  event: ParsedNhlPbpEvent,
  playerId: number | null
): number | null {
  if (playerId == null || event.period_seconds_elapsed == null) return null;
  const interval = findActiveInterval(intervalIndex, event, playerId);
  if (!interval) return null;
  return event.period_seconds_elapsed - interval.startSecond;
}

function findPreviousInterval(
  playerHistoryIndex: Map<string, NhlShiftInterval[]>,
  event: ParsedNhlPbpEvent,
  playerId: number | null,
  currentInterval: NhlShiftInterval | null
): NhlShiftInterval | null {
  if (playerId == null || currentInterval == null) {
    return null;
  }

  const key = `${event.game_id}:${playerId}`;
  const intervals = playerHistoryIndex.get(key) ?? [];

  for (let index = intervals.length - 1; index >= 0; index -= 1) {
    const candidate = intervals[index];
    const endsBeforeCurrent =
      candidate.period < currentInterval.period ||
      (candidate.period === currentInterval.period &&
        candidate.endSecond <= currentInterval.startSecond);
    if (!endsBeforeCurrent) continue;

    return candidate;
  }

  return null;
}

function computePlayerPreviousShiftGapSeconds(
  intervalIndex: Map<string, NhlShiftInterval[]>,
  playerHistoryIndex: Map<string, NhlShiftInterval[]>,
  event: ParsedNhlPbpEvent,
  playerId: number | null
): number | null {
  const currentInterval = findActiveInterval(intervalIndex, event, playerId);
  const previousInterval = findPreviousInterval(
    playerHistoryIndex,
    event,
    playerId,
    currentInterval
  );

  if (
    currentInterval == null ||
    previousInterval == null ||
    previousInterval.period !== currentInterval.period
  ) {
    return null;
  }

  return currentInterval.startSecond - previousInterval.endSecond;
}

function computePlayerPreviousShiftDurationSeconds(
  intervalIndex: Map<string, NhlShiftInterval[]>,
  playerHistoryIndex: Map<string, NhlShiftInterval[]>,
  event: ParsedNhlPbpEvent,
  playerId: number | null
): number | null {
  const currentInterval = findActiveInterval(intervalIndex, event, playerId);
  const previousInterval = findPreviousInterval(
    playerHistoryIndex,
    event,
    playerId,
    currentInterval
  );

  if (
    currentInterval == null ||
    previousInterval == null ||
    previousInterval.period !== currentInterval.period
  ) {
    return null;
  }

  return previousInterval.durationSeconds;
}

function computeShiftAgeStats(
  intervalIndex: Map<string, NhlShiftInterval[]>,
  event: ParsedNhlPbpEvent,
  playerIds: number[]
): { average: number | null; max: number | null } {
  const ages = playerIds
    .map((playerId) => computePlayerShiftAgeSeconds(intervalIndex, event, playerId))
    .filter((age): age is number => age != null);

  if (ages.length === 0) {
    return { average: null, max: null };
  }

  const total = ages.reduce((sum, age) => sum + age, 0);

  return {
    average: total / ages.length,
    max: Math.max(...ages),
  };
}

function computeAverageMetricForPlayers(
  playerIds: number[],
  getMetric: (playerId: number) => number | null
): number | null {
  const values = playerIds
    .map((playerId) => getMetric(playerId))
    .filter((value): value is number => value != null);

  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getPrimaryShooterId(event: ParsedNhlPbpEvent): number | null {
  return event.shooting_player_id ?? event.scoring_player_id ?? null;
}

function computeCrossedRoyalRoad(
  previousNormalizedY: number | null,
  currentNormalizedY: number | null,
  previousNormalizedX: number | null,
  currentNormalizedX: number | null
): boolean | null {
  if (
    previousNormalizedY == null ||
    currentNormalizedY == null ||
    previousNormalizedX == null ||
    currentNormalizedX == null
  ) {
    return null;
  }

  const isOffensiveEnough =
    Math.min(previousNormalizedX, currentNormalizedX) >= 25;
  if (!isOffensiveEnough) return false;

  return (
    previousNormalizedY !== 0 &&
    currentNormalizedY !== 0 &&
    Math.sign(previousNormalizedY) !== Math.sign(currentNormalizedY)
  );
}

export function buildContextualFeatureContexts(
  events: ParsedNhlPbpEvent[],
  shiftRows: ShiftRow[],
  homeTeamId: number,
  awayTeamId: number
): NhlContextualFeatureContext[] {
  const sorted = sortEvents(events);
  const priorContexts = buildPriorEventContexts(sorted);
  const priorContextByEventId = new Map(
    priorContexts.map((context) => [context.eventId, context])
  );
  const stints = buildShiftStints(shiftRows);
  const intervalIndex = buildIntervalIndex(shiftRows);
  const playerHistoryIndex = buildPlayerHistoryIndex(shiftRows);
  const powerPlayStateByTeamKey = new Map<string, PowerPlayAgeState>();

  return sorted.map((event) => {
    const priorContext = priorContextByEventId.get(event.event_id) ?? null;
    const parsedSituation = parseSituationCode(event.situation_code);
    const homeStrengthState = classifyTeamStrengthState(
      parsedSituation,
      homeTeamId,
      homeTeamId,
      awayTeamId
    );
    const awayStrengthState = classifyTeamStrengthState(
      parsedSituation,
      awayTeamId,
      homeTeamId,
      awayTeamId
    );

    const eventTime = event.game_seconds_elapsed ?? null;

    const teamPowerPlayAge = (teamId: number, state: typeof homeStrengthState) => {
      const key = `${event.game_id}:${teamId}`;
      const previous = powerPlayStateByTeamKey.get(key) ?? {
        state: null,
        strengthExact: null,
        segmentStartSeconds: null,
      };

      let segmentStartSeconds: number | null = previous.segmentStartSeconds;
      if (state === "PP" && eventTime != null) {
        const continuing =
          previous.state === "PP" &&
          previous.strengthExact === event.strength_exact &&
          previous.segmentStartSeconds != null;
        segmentStartSeconds = continuing ? previous.segmentStartSeconds : eventTime;
      } else {
        segmentStartSeconds = null;
      }

      powerPlayStateByTeamKey.set(key, {
        state,
        strengthExact: event.strength_exact ?? null,
        segmentStartSeconds,
      });

      if (state !== "PP" || eventTime == null || segmentStartSeconds == null) {
        return null;
      }

      return eventTime - segmentStartSeconds;
    };

    const homePowerPlayAgeSeconds = teamPowerPlayAge(homeTeamId, homeStrengthState);
    const awayPowerPlayAgeSeconds = teamPowerPlayAge(awayTeamId, awayStrengthState);

    const onIce = buildOnIceAttributionForEvent(event, stints, homeTeamId, awayTeamId);
    const ownerShiftStats = computeShiftAgeStats(intervalIndex, event, onIce.ownerPlayerIds);
    const opponentShiftStats = computeShiftAgeStats(
      intervalIndex,
      event,
      onIce.opponentPlayerIds
    );

    const shooterShiftAgeSeconds = computePlayerShiftAgeSeconds(
      intervalIndex,
      event,
      getPrimaryShooterId(event)
    );
    const shooterPreviousShiftGapSeconds = computePlayerPreviousShiftGapSeconds(
      intervalIndex,
      playerHistoryIndex,
      event,
      getPrimaryShooterId(event)
    );
    const shooterPreviousShiftDurationSeconds =
      computePlayerPreviousShiftDurationSeconds(
        intervalIndex,
        playerHistoryIndex,
        event,
        getPrimaryShooterId(event)
      );
    const ownerAveragePreviousShiftGapSeconds = computeAverageMetricForPlayers(
      onIce.ownerPlayerIds,
      (playerId) =>
        computePlayerPreviousShiftGapSeconds(
          intervalIndex,
          playerHistoryIndex,
          event,
          playerId
        )
    );
    const ownerAveragePreviousShiftDurationSeconds = computeAverageMetricForPlayers(
      onIce.ownerPlayerIds,
      (playerId) =>
        computePlayerPreviousShiftDurationSeconds(
          intervalIndex,
          playerHistoryIndex,
          event,
          playerId
        )
    );
    const opponentAveragePreviousShiftGapSeconds = computeAverageMetricForPlayers(
      onIce.opponentPlayerIds,
      (playerId) =>
        computePlayerPreviousShiftGapSeconds(
          intervalIndex,
          playerHistoryIndex,
          event,
          playerId
        )
    );
    const opponentAveragePreviousShiftDurationSeconds =
      computeAverageMetricForPlayers(onIce.opponentPlayerIds, (playerId) =>
        computePlayerPreviousShiftDurationSeconds(
          intervalIndex,
          playerHistoryIndex,
          event,
          playerId
        )
      );

    const sameTeamMovementEligible =
      evaluateNormalizedEventInclusion(event).includeInShotFeatures &&
      priorContext?.previousEventSameTeam === true;

    const eastWestMovementFeet = sameTeamMovementEligible
      ? priorContext.currentNormalizedY != null &&
        priorContext.previousNormalizedY != null
        ? Math.abs(
            priorContext.currentNormalizedY - priorContext.previousNormalizedY
          )
        : null
      : null;

    const northSouthMovementFeet = sameTeamMovementEligible
      ? priorContext.currentNormalizedX != null &&
        priorContext.previousNormalizedX != null
        ? priorContext.currentNormalizedX - priorContext.previousNormalizedX
        : null
      : null;

    const crossedRoyalRoad = sameTeamMovementEligible
      ? computeCrossedRoyalRoad(
          priorContext?.previousNormalizedY ?? null,
          priorContext?.currentNormalizedY ?? null,
          priorContext?.previousNormalizedX ?? null,
          priorContext?.currentNormalizedX ?? null
        )
      : null;

    return {
      gameId: event.game_id,
      eventId: event.event_id,
      ownerPowerPlayAgeSeconds:
        event.event_owner_team_id === homeTeamId
          ? homePowerPlayAgeSeconds
          : event.event_owner_team_id === awayTeamId
            ? awayPowerPlayAgeSeconds
            : null,
      opponentPowerPlayAgeSeconds:
        event.event_owner_team_id === homeTeamId
          ? awayPowerPlayAgeSeconds
          : event.event_owner_team_id === awayTeamId
            ? homePowerPlayAgeSeconds
            : null,
      homePowerPlayAgeSeconds,
      awayPowerPlayAgeSeconds,
      shooterShiftAgeSeconds,
      shooterPreviousShiftGapSeconds,
      shooterPreviousShiftDurationSeconds,
      ownerAverageShiftAgeSeconds: ownerShiftStats.average,
      ownerMaxShiftAgeSeconds: ownerShiftStats.max,
      ownerAveragePreviousShiftGapSeconds,
      ownerAveragePreviousShiftDurationSeconds,
      opponentAverageShiftAgeSeconds: opponentShiftStats.average,
      opponentMaxShiftAgeSeconds: opponentShiftStats.max,
      opponentAveragePreviousShiftGapSeconds,
      opponentAveragePreviousShiftDurationSeconds,
      eastWestMovementFeet,
      northSouthMovementFeet,
      crossedRoyalRoad,
    };
  });
}
