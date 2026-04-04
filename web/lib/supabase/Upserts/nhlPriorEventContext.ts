import { normalizeCoordinatesToAttackingDirection } from "./nhlCoordinates";
import type { ParsedNhlPbpEvent } from "./nhlPlayByPlayParser";

export type NhlPriorEventContext = {
  gameId: number;
  eventId: number;
  previousEventId: number | null;
  previousEventSortOrder: number | null;
  previousEventTypeDescKey: string | null;
  previousEventTeamId: number | null;
  previousEventSameTeam: boolean | null;
  previousEventPeriodNumber: number | null;
  timeSincePreviousEventSeconds: number | null;
  distanceFromPreviousEvent: number | null;
  currentNormalizedX: number | null;
  currentNormalizedY: number | null;
  previousNormalizedX: number | null;
  previousNormalizedY: number | null;
};

function computeDistance(
  startX: number | null,
  startY: number | null,
  endX: number | null,
  endY: number | null
): number | null {
  if (
    startX == null ||
    startY == null ||
    endX == null ||
    endY == null
  ) {
    return null;
  }

  const deltaX = endX - startX;
  const deltaY = endY - startY;
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

function sortEvents(events: ParsedNhlPbpEvent[]): ParsedNhlPbpEvent[] {
  return [...events].sort((left, right) => {
    if (left.game_id !== right.game_id) return left.game_id - right.game_id;
    const leftOrder = left.sort_order ?? left.event_id;
    const rightOrder = right.sort_order ?? right.event_id;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.event_id - right.event_id;
  });
}

export function buildPriorEventContexts(
  events: ParsedNhlPbpEvent[]
): NhlPriorEventContext[] {
  const sorted = sortEvents(events);
  const contexts: NhlPriorEventContext[] = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const event = sorted[index];
    const previous =
      index > 0 && sorted[index - 1].game_id === event.game_id
        ? sorted[index - 1]
        : null;

    const currentNormalized = normalizeCoordinatesToAttackingDirection(
      event.x_coord,
      event.y_coord,
      {
        homeTeamDefendingSide: event.home_team_defending_side as
          | "left"
          | "right"
          | null,
        teamSide: event.event_owner_side ?? null,
      }
    );

    const previousNormalized = previous
      ? normalizeCoordinatesToAttackingDirection(previous.x_coord, previous.y_coord, {
          homeTeamDefendingSide: previous.home_team_defending_side as
            | "left"
            | "right"
            | null,
          teamSide: previous.event_owner_side ?? null,
        })
      : null;

    contexts.push({
      gameId: event.game_id,
      eventId: event.event_id,
      previousEventId: previous?.event_id ?? null,
      previousEventSortOrder: previous?.sort_order ?? null,
      previousEventTypeDescKey: previous?.type_desc_key ?? null,
      previousEventTeamId: previous?.event_owner_team_id ?? null,
      previousEventSameTeam:
        previous == null ||
        previous.event_owner_team_id == null ||
        event.event_owner_team_id == null
          ? null
          : previous.event_owner_team_id === event.event_owner_team_id,
      previousEventPeriodNumber: previous?.period_number ?? null,
      timeSincePreviousEventSeconds: event.seconds_since_previous_event ?? null,
      distanceFromPreviousEvent: previous
        ? computeDistance(
            previous.x_coord ?? null,
            previous.y_coord ?? null,
            event.x_coord ?? null,
            event.y_coord ?? null
          )
        : null,
      currentNormalizedX: currentNormalized.normalizedX,
      currentNormalizedY: currentNormalized.normalizedY,
      previousNormalizedX: previousNormalized?.normalizedX ?? null,
      previousNormalizedY: previousNormalized?.normalizedY ?? null,
    });
  }

  return contexts;
}
