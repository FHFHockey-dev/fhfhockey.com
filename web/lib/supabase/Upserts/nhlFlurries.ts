import { evaluateNormalizedEventInclusion } from "./nhlEventInclusion";
import type { ParsedNhlPbpEvent } from "./nhlPlayByPlayParser";

export const DEFAULT_FLURRY_GAP_SECONDS = 5;

const UNIVERSAL_FLURRY_BREAK_TYPES = new Set([
  "stoppage",
  "penalty",
  "delayed-penalty",
  "faceoff",
  "period-start",
  "period-end",
  "game-end",
  "shootout-complete",
]);

type FlurryBuildOptions = {
  flurryGapSeconds?: number;
};

type FlurrySequence = {
  gameId: number;
  periodNumber: number | null;
  teamId: number;
  sequenceId: string;
  eventIds: number[];
  startEventId: number;
  endEventId: number;
  startGameSeconds: number;
  endGameSeconds: number;
};

export type NhlFlurryContext = {
  gameId: number;
  eventId: number;
  isFlurryShot: boolean;
  flurrySequenceId: string | null;
  flurryShotIndex: number | null;
  flurryShotCount: number | null;
  flurrySequenceStartEventId: number | null;
  flurrySequenceEndEventId: number | null;
  flurrySequenceDurationSeconds: number | null;
  flurryGapSeconds: number;
  isFlurrySequenceStarter: boolean;
  isFlurrySequenceFinisher: boolean;
};

type ActiveFlurrySequence = {
  gameId: number;
  periodNumber: number | null;
  teamId: number;
  eventIds: number[];
  startEventId: number;
  lastEventId: number;
  startGameSeconds: number;
  lastGameSeconds: number;
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

function isShotFeatureEligible(event: ParsedNhlPbpEvent): boolean {
  if (!event.is_shot_like) return false;
  return evaluateNormalizedEventInclusion(event).includeInShotFeatures;
}

function createSequenceId(sequence: ActiveFlurrySequence): string {
  return [
    sequence.gameId,
    sequence.periodNumber ?? 0,
    sequence.teamId,
    sequence.startEventId,
  ].join(":");
}

function finalizeSequence(
  activeSequence: ActiveFlurrySequence | null,
  completedSequences: FlurrySequence[]
): ActiveFlurrySequence | null {
  if (activeSequence == null) return null;

  completedSequences.push({
    gameId: activeSequence.gameId,
    periodNumber: activeSequence.periodNumber,
    teamId: activeSequence.teamId,
    sequenceId: createSequenceId(activeSequence),
    eventIds: [...activeSequence.eventIds],
    startEventId: activeSequence.startEventId,
    endEventId: activeSequence.lastEventId,
    startGameSeconds: activeSequence.startGameSeconds,
    endGameSeconds: activeSequence.lastGameSeconds,
  });

  return null;
}

function breaksActiveFlurrySequence(
  event: ParsedNhlPbpEvent,
  activeSequence: ActiveFlurrySequence
): boolean {
  if (event.game_id !== activeSequence.gameId) return true;
  if (event.period_number !== activeSequence.periodNumber) return true;

  if (
    event.type_desc_key != null &&
    UNIVERSAL_FLURRY_BREAK_TYPES.has(event.type_desc_key)
  ) {
    return true;
  }

  if (event.type_desc_key === "takeaway") {
    return event.event_owner_team_id !== activeSequence.teamId;
  }

  if (event.type_desc_key === "giveaway") {
    return event.event_owner_team_id === activeSequence.teamId;
  }

  if (event.event_owner_team_id != null && event.is_shot_like) {
    return event.event_owner_team_id !== activeSequence.teamId;
  }

  return false;
}

export function buildFlurryContexts(
  events: ParsedNhlPbpEvent[],
  options: FlurryBuildOptions = {}
): NhlFlurryContext[] {
  const flurryGapSeconds =
    options.flurryGapSeconds ?? DEFAULT_FLURRY_GAP_SECONDS;
  const sorted = sortEvents(events);
  const completedSequences: FlurrySequence[] = [];
  let activeSequence: ActiveFlurrySequence | null = null;

  for (const event of sorted) {
    if (
      activeSequence != null &&
      breaksActiveFlurrySequence(event, activeSequence)
    ) {
      activeSequence = finalizeSequence(activeSequence, completedSequences);
    }

    if (
      !isShotFeatureEligible(event) ||
      event.event_owner_team_id == null ||
      event.game_seconds_elapsed == null
    ) {
      continue;
    }

    if (activeSequence == null) {
      activeSequence = {
        gameId: event.game_id,
        periodNumber: event.period_number ?? null,
        teamId: event.event_owner_team_id,
        eventIds: [event.event_id],
        startEventId: event.event_id,
        lastEventId: event.event_id,
        startGameSeconds: event.game_seconds_elapsed,
        lastGameSeconds: event.game_seconds_elapsed,
      };
      continue;
    }

    const sameGame = activeSequence.gameId === event.game_id;
    const samePeriod = activeSequence.periodNumber === event.period_number;
    const sameTeam = activeSequence.teamId === event.event_owner_team_id;
    const withinGap =
      event.game_seconds_elapsed - activeSequence.lastGameSeconds <=
      flurryGapSeconds;

    if (sameGame && samePeriod && sameTeam && withinGap) {
      activeSequence.eventIds.push(event.event_id);
      activeSequence.lastEventId = event.event_id;
      activeSequence.lastGameSeconds = event.game_seconds_elapsed;
      continue;
    }

    activeSequence = finalizeSequence(activeSequence, completedSequences);
    activeSequence = {
      gameId: event.game_id,
      periodNumber: event.period_number ?? null,
      teamId: event.event_owner_team_id,
      eventIds: [event.event_id],
      startEventId: event.event_id,
      lastEventId: event.event_id,
      startGameSeconds: event.game_seconds_elapsed,
      lastGameSeconds: event.game_seconds_elapsed,
    };
  }

  finalizeSequence(activeSequence, completedSequences);

  const sequenceByEventId = new Map<
    number,
    FlurrySequence & { shotIndex: number }
  >();

  for (const sequence of completedSequences) {
    if (sequence.eventIds.length < 2) continue;

    sequence.eventIds.forEach((eventId, index) => {
      sequenceByEventId.set(eventId, {
        ...sequence,
        shotIndex: index + 1,
      });
    });
  }

  return sorted.map((event) => {
    const sequence = sequenceByEventId.get(event.event_id);

    return {
      gameId: event.game_id,
      eventId: event.event_id,
      isFlurryShot: sequence != null,
      flurrySequenceId: sequence?.sequenceId ?? null,
      flurryShotIndex: sequence?.shotIndex ?? null,
      flurryShotCount: sequence?.eventIds.length ?? null,
      flurrySequenceStartEventId: sequence?.startEventId ?? null,
      flurrySequenceEndEventId: sequence?.endEventId ?? null,
      flurrySequenceDurationSeconds:
        sequence != null
          ? sequence.endGameSeconds - sequence.startGameSeconds
          : null,
      flurryGapSeconds,
      isFlurrySequenceStarter:
        sequence != null && sequence.startEventId === event.event_id,
      isFlurrySequenceFinisher:
        sequence != null && sequence.endEventId === event.event_id,
    };
  });
}
