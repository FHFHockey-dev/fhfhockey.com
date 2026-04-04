import type { ParsedNhlPbpEvent } from "./nhlPlayByPlayParser";

export type NhlPossessionChainContext = {
  gameId: number;
  eventId: number;
  possessionSequenceId: string | null;
  possessionEventCount: number | null;
  possessionDurationSeconds: number | null;
  possessionStartEventId: number | null;
  possessionStartTypeDescKey: string | null;
  possessionStartZoneCode: string | null;
  possessionRegainedFromOpponent: boolean | null;
  possessionRegainEventTypeDescKey: string | null;
  possessionEnteredOffensiveZone: boolean | null;
};

type ActiveChain = {
  sequenceNumber: number;
  ownerTeamId: number;
  gameId: number;
  periodNumber: number | null;
  startEventId: number;
  startTypeDescKey: string | null;
  startZoneCode: string | null;
  startGameSeconds: number | null;
  eventCount: number;
  priorNonOffensiveZoneSeen: boolean;
  regainedFromOpponent: boolean;
  regainEventTypeDescKey: string | null;
};

const HARD_CHAIN_BREAK_TYPES = new Set([
  "stoppage",
  "period-start",
  "period-end",
  "game-start",
  "game-end",
  "delayed-penalty",
  "penalty",
]);

function sortEvents(events: ParsedNhlPbpEvent[]): ParsedNhlPbpEvent[] {
  return [...events].sort((left, right) => {
    if (left.game_id !== right.game_id) return left.game_id - right.game_id;
    const leftOrder = left.sort_order ?? left.event_id;
    const rightOrder = right.sort_order ?? right.event_id;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.event_id - right.event_id;
  });
}

function normalizeZoneCode(zoneCode: string | null | undefined): string | null {
  if (typeof zoneCode !== "string") return null;
  const normalized = zoneCode.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function isNonOffensiveZone(zoneCode: string | null | undefined): boolean {
  const normalized = normalizeZoneCode(zoneCode);
  return normalized === "N" || normalized === "D";
}

function shouldStartNewChain(
  event: ParsedNhlPbpEvent,
  previous: ParsedNhlPbpEvent | null,
  activeChain: ActiveChain | null
): {
  startNew: boolean;
  regainedFromOpponent: boolean;
  regainEventTypeDescKey: string | null;
} {
  if (event.event_owner_team_id == null) {
    return {
      startNew: true,
      regainedFromOpponent: false,
      regainEventTypeDescKey: null,
    };
  }

  if (activeChain == null) {
    return {
      startNew: true,
      regainedFromOpponent: false,
      regainEventTypeDescKey: null,
    };
  }

  if (
    activeChain.gameId !== event.game_id ||
    activeChain.periodNumber !== (event.period_number ?? null)
  ) {
    return {
      startNew: true,
      regainedFromOpponent: false,
      regainEventTypeDescKey: null,
    };
  }

  if (previous == null || previous.event_owner_team_id == null) {
    return {
      startNew: true,
      regainedFromOpponent: false,
      regainEventTypeDescKey: previous?.type_desc_key ?? null,
    };
  }

  if (event.type_desc_key === "faceoff") {
    return {
      startNew: true,
      regainedFromOpponent: false,
      regainEventTypeDescKey: previous.type_desc_key ?? null,
    };
  }

  if (HARD_CHAIN_BREAK_TYPES.has(previous.type_desc_key ?? "")) {
    return {
      startNew: true,
      regainedFromOpponent: false,
      regainEventTypeDescKey: previous.type_desc_key ?? null,
    };
  }

  if (previous.event_owner_team_id !== event.event_owner_team_id) {
    return {
      startNew: true,
      regainedFromOpponent: true,
      regainEventTypeDescKey: previous.type_desc_key ?? null,
    };
  }

  return {
    startNew: false,
    regainedFromOpponent: false,
    regainEventTypeDescKey: null,
  };
}

export function buildPossessionChainContexts(
  events: ParsedNhlPbpEvent[]
): NhlPossessionChainContext[] {
  const sorted = sortEvents(events);
  const contexts: NhlPossessionChainContext[] = [];

  let activeChain: ActiveChain | null = null;
  let previous: ParsedNhlPbpEvent | null = null;
  let currentGameId: number | null = null;
  let sequenceCounter = 0;

  for (const event of sorted) {
    if (currentGameId !== event.game_id) {
      currentGameId = event.game_id;
      sequenceCounter = 0;
      activeChain = null;
      previous = null;
    }

    const ownerTeamId = event.event_owner_team_id ?? null;
    if (ownerTeamId == null) {
      contexts.push({
        gameId: event.game_id,
        eventId: event.event_id,
        possessionSequenceId: null,
        possessionEventCount: null,
        possessionDurationSeconds: null,
        possessionStartEventId: null,
        possessionStartTypeDescKey: null,
        possessionStartZoneCode: null,
        possessionRegainedFromOpponent: null,
        possessionRegainEventTypeDescKey: null,
        possessionEnteredOffensiveZone: null,
      });
      activeChain = null;
      previous = event;
      continue;
    }

    const decision = shouldStartNewChain(event, previous, activeChain);
    if (decision.startNew || activeChain == null) {
      sequenceCounter += 1;
      activeChain = {
        sequenceNumber: sequenceCounter,
        ownerTeamId,
        gameId: event.game_id,
        periodNumber: event.period_number ?? null,
        startEventId: event.event_id,
        startTypeDescKey: event.type_desc_key ?? null,
        startZoneCode: event.zone_code ?? null,
        startGameSeconds: event.game_seconds_elapsed ?? null,
        eventCount: 0,
        priorNonOffensiveZoneSeen: false,
        regainedFromOpponent: decision.regainedFromOpponent,
        regainEventTypeDescKey: decision.regainEventTypeDescKey,
      };
    }

    activeChain.eventCount += 1;
    const enteredOffensiveZone =
      normalizeZoneCode(event.zone_code ?? null) === "O" &&
      activeChain.priorNonOffensiveZoneSeen;

    contexts.push({
      gameId: event.game_id,
      eventId: event.event_id,
      possessionSequenceId: `${event.game_id}:${ownerTeamId}:${activeChain.sequenceNumber}`,
      possessionEventCount: activeChain.eventCount,
      possessionDurationSeconds:
        event.game_seconds_elapsed == null || activeChain.startGameSeconds == null
          ? null
          : Math.max(0, event.game_seconds_elapsed - activeChain.startGameSeconds),
      possessionStartEventId: activeChain.startEventId,
      possessionStartTypeDescKey: activeChain.startTypeDescKey,
      possessionStartZoneCode: activeChain.startZoneCode ?? null,
      possessionRegainedFromOpponent: activeChain.regainedFromOpponent,
      possessionRegainEventTypeDescKey: activeChain.regainEventTypeDescKey,
      possessionEnteredOffensiveZone: enteredOffensiveZone,
    });

    if (isNonOffensiveZone(event.zone_code ?? null)) {
      activeChain.priorNonOffensiveZoneSeen = true;
    }

    previous = event;
  }

  return contexts;
}
