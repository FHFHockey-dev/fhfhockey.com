import { evaluateNormalizedEventInclusion } from "./nhlEventInclusion";
import type { ParsedNhlPbpEvent } from "./nhlPlayByPlayParser";
import { buildReboundContexts } from "./nhlRebounds";

export const DEFAULT_RUSH_WINDOW_SECONDS = 10;

const UNIVERSAL_RUSH_BREAK_TYPES = new Set([
  "stoppage",
  "penalty",
  "delayed-penalty",
  "period-start",
  "period-end",
  "game-end",
  "shootout-complete",
]);

type RushBuildOptions = {
  rushWindowSeconds?: number;
};

export type NhlRushContext = {
  gameId: number;
  eventId: number;
  isRushShot: boolean;
  rushSourceEventId: number | null;
  rushSourceTypeDescKey: string | null;
  rushSourceTeamId: number | null;
  rushSourceZoneCode: string | null;
  rushSourceTeamRelativeZoneCode: string | null;
  rushTimeSinceSourceSeconds: number | null;
  rushEventsSinceSource: number | null;
  rushWindowSeconds: number;
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

function invertZoneCode(zoneCode: string | null): string | null {
  if (zoneCode === "O") return "D";
  if (zoneCode === "D") return "O";
  return zoneCode;
}

function getTeamRelativeZoneCode(
  event: ParsedNhlPbpEvent,
  teamId: number
): string | null {
  if (event.zone_code == null) return null;
  if (event.event_owner_team_id == null) return null;
  if (event.event_owner_team_id === teamId) return event.zone_code;
  return invertZoneCode(event.zone_code);
}

function isQualifyingRushSource(
  event: ParsedNhlPbpEvent,
  currentTeamId: number
): boolean {
  if (event.type_desc_key == null) return false;

  if (event.type_desc_key === "takeaway") {
    return event.event_owner_team_id === currentTeamId;
  }

  if (event.type_desc_key === "faceoff") {
    return event.event_owner_team_id === currentTeamId;
  }

  if (event.type_desc_key === "giveaway") {
    return (
      event.event_owner_team_id != null &&
      event.event_owner_team_id !== currentTeamId
    );
  }

  if (event.type_desc_key === "blocked-shot") {
    return (
      event.event_owner_team_id != null &&
      event.event_owner_team_id !== currentTeamId
    );
  }

  return false;
}

function isHardRushBreak(
  event: ParsedNhlPbpEvent,
  currentTeamId: number
): boolean {
  if (event.type_desc_key != null && UNIVERSAL_RUSH_BREAK_TYPES.has(event.type_desc_key)) {
    return true;
  }

  if (event.is_shot_like || event.is_goal) {
    return true;
  }

  if (event.type_desc_key === "takeaway") {
    return event.event_owner_team_id !== currentTeamId;
  }

  if (event.type_desc_key === "faceoff") {
    return event.event_owner_team_id !== currentTeamId;
  }

  if (event.type_desc_key === "giveaway") {
    return event.event_owner_team_id === currentTeamId;
  }

  return false;
}

export function buildRushContexts(
  events: ParsedNhlPbpEvent[],
  options: RushBuildOptions = {}
): NhlRushContext[] {
  const rushWindowSeconds =
    options.rushWindowSeconds ?? DEFAULT_RUSH_WINDOW_SECONDS;
  const sorted = sortEvents(events);
  const reboundContexts = buildReboundContexts(sorted);
  const reboundByEventId = new Map(
    reboundContexts.map((context) => [context.eventId, context])
  );

  return sorted.map((event, index) => {
    const reboundContext = reboundByEventId.get(event.event_id);

    if (
      !isShotFeatureEligible(event) ||
      event.event_owner_team_id == null ||
      reboundContext?.isReboundShot
    ) {
      return {
        gameId: event.game_id,
        eventId: event.event_id,
        isRushShot: false,
        rushSourceEventId: null,
        rushSourceTypeDescKey: null,
        rushSourceTeamId: null,
        rushSourceZoneCode: null,
        rushSourceTeamRelativeZoneCode: null,
        rushTimeSinceSourceSeconds: null,
        rushEventsSinceSource: null,
        rushWindowSeconds,
      };
    }

    const currentTime = event.game_seconds_elapsed;
    const currentTeamId = event.event_owner_team_id;

    if (currentTime == null) {
      return {
        gameId: event.game_id,
        eventId: event.event_id,
        isRushShot: false,
        rushSourceEventId: null,
        rushSourceTypeDescKey: null,
        rushSourceTeamId: null,
        rushSourceZoneCode: null,
        rushSourceTeamRelativeZoneCode: null,
        rushTimeSinceSourceSeconds: null,
        rushEventsSinceSource: null,
        rushWindowSeconds,
      };
    }

    for (let scanIndex = index - 1; scanIndex >= 0; scanIndex -= 1) {
      const candidate = sorted[scanIndex];

      if (candidate.game_id !== event.game_id) break;
      if (candidate.period_number !== event.period_number) break;
      if (candidate.game_seconds_elapsed == null) break;

      const deltaSeconds = currentTime - candidate.game_seconds_elapsed;

      if (deltaSeconds <= 0) continue;
      if (deltaSeconds > rushWindowSeconds) break;

      if (isQualifyingRushSource(candidate, currentTeamId)) {
        const teamRelativeZoneCode = getTeamRelativeZoneCode(candidate, currentTeamId);

        if (teamRelativeZoneCode === "D" || teamRelativeZoneCode === "N") {
          return {
            gameId: event.game_id,
            eventId: event.event_id,
            isRushShot: true,
            rushSourceEventId: candidate.event_id,
            rushSourceTypeDescKey: candidate.type_desc_key ?? null,
            rushSourceTeamId: currentTeamId,
            rushSourceZoneCode: candidate.zone_code ?? null,
            rushSourceTeamRelativeZoneCode: teamRelativeZoneCode,
            rushTimeSinceSourceSeconds: deltaSeconds,
            rushEventsSinceSource: index - scanIndex - 1,
            rushWindowSeconds,
          };
        }

        break;
      }

      if (isHardRushBreak(candidate, currentTeamId)) {
        break;
      }
    }

    return {
      gameId: event.game_id,
      eventId: event.event_id,
      isRushShot: false,
      rushSourceEventId: null,
      rushSourceTypeDescKey: null,
      rushSourceTeamId: null,
      rushSourceZoneCode: null,
      rushSourceTeamRelativeZoneCode: null,
      rushTimeSinceSourceSeconds: null,
      rushEventsSinceSource: null,
      rushWindowSeconds,
    };
  });
}
