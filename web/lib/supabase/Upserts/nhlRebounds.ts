import { evaluateNormalizedEventInclusion } from "./nhlEventInclusion";
import type { ParsedNhlPbpEvent } from "./nhlPlayByPlayParser";
import { buildPriorEventContexts } from "./nhlPriorEventContext";
import { OFFENSIVE_NET_X, OFFENSIVE_NET_Y } from "./nhlCoordinates";

export const DEFAULT_REBOUND_WINDOW_SECONDS = 3;

const REBOUND_SOURCE_TYPES = new Set([
  "shot-on-goal",
  "missed-shot",
  "blocked-shot",
]);

type ReboundBuildOptions = {
  reboundWindowSeconds?: number;
};

export type NhlReboundContext = {
  gameId: number;
  eventId: number;
  isReboundShot: boolean;
  reboundSourceEventId: number | null;
  reboundSourceTypeDescKey: string | null;
  reboundSourceTeamId: number | null;
  reboundTimeDeltaSeconds: number | null;
  reboundDistanceFromSource: number | null;
  reboundLateralDisplacementFeet: number | null;
  reboundDistanceDeltaFeet: number | null;
  reboundAngleChangeDegrees: number | null;
  reboundWindowSeconds: number;
  createsRebound: boolean;
  reboundTargetEventId: number | null;
  reboundTargetTypeDescKey: string | null;
};

function computeShotDistanceFeet(
  normalizedX: number | null,
  normalizedY: number | null
): number | null {
  if (normalizedX == null || normalizedY == null) return null;
  const deltaX = OFFENSIVE_NET_X - normalizedX;
  const deltaY = OFFENSIVE_NET_Y - normalizedY;
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

function computeShotAngleDegrees(
  normalizedX: number | null,
  normalizedY: number | null
): number | null {
  if (normalizedX == null || normalizedY == null) return null;
  const deltaX = Math.abs(OFFENSIVE_NET_X - normalizedX);
  const deltaY = Math.abs(OFFENSIVE_NET_Y - normalizedY);
  return (Math.atan2(deltaY, deltaX) * 180) / Math.PI;
}

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

function isEligibleReboundSource(event: ParsedNhlPbpEvent): boolean {
  if (!isShotFeatureEligible(event)) return false;
  if (event.type_desc_key == null) return false;
  return REBOUND_SOURCE_TYPES.has(event.type_desc_key);
}

function isEligibleReboundShot(event: ParsedNhlPbpEvent): boolean {
  return isShotFeatureEligible(event);
}

export function buildReboundContexts(
  events: ParsedNhlPbpEvent[],
  options: ReboundBuildOptions = {}
): NhlReboundContext[] {
  const reboundWindowSeconds =
    options.reboundWindowSeconds ?? DEFAULT_REBOUND_WINDOW_SECONDS;
  const sorted = sortEvents(events);
  const priorContexts = buildPriorEventContexts(sorted);
  const contextByEventId = new Map(
    priorContexts.map((context) => [context.eventId, context])
  );

  const reboundTargetsBySourceEventId = new Map<number, ParsedNhlPbpEvent>();

  const reboundContexts = sorted.map((event, index) => {
    const previous =
      index > 0 && sorted[index - 1].game_id === event.game_id
        ? sorted[index - 1]
        : null;
    const priorContext = contextByEventId.get(event.event_id) ?? null;

    const sameSequence =
      previous != null &&
      priorContext != null &&
      previous.period_number === event.period_number &&
      priorContext.previousEventSameTeam === true &&
      priorContext.timeSincePreviousEventSeconds != null &&
      priorContext.timeSincePreviousEventSeconds > 0 &&
      priorContext.timeSincePreviousEventSeconds <= reboundWindowSeconds;

    const isReboundShot =
      previous != null &&
      sameSequence &&
      isEligibleReboundSource(previous) &&
      isEligibleReboundShot(event);

    if (isReboundShot) {
      reboundTargetsBySourceEventId.set(previous.event_id, event);
    }

    return {
      gameId: event.game_id,
      eventId: event.event_id,
      isReboundShot,
      reboundSourceEventId: isReboundShot ? previous?.event_id ?? null : null,
      reboundSourceTypeDescKey: isReboundShot
        ? previous?.type_desc_key ?? null
        : null,
      reboundSourceTeamId: isReboundShot
        ? previous?.event_owner_team_id ?? null
        : null,
      reboundTimeDeltaSeconds: isReboundShot
        ? priorContext?.timeSincePreviousEventSeconds ?? null
        : null,
      reboundDistanceFromSource: isReboundShot
        ? priorContext?.distanceFromPreviousEvent ?? null
        : null,
      reboundLateralDisplacementFeet: isReboundShot
        ? priorContext?.currentNormalizedY != null &&
          priorContext.previousNormalizedY != null
          ? Math.abs(
              priorContext.currentNormalizedY - priorContext.previousNormalizedY
            )
          : null
        : null,
      reboundDistanceDeltaFeet: isReboundShot
        ? (() => {
            const currentDistance = computeShotDistanceFeet(
              priorContext?.currentNormalizedX ?? null,
              priorContext?.currentNormalizedY ?? null
            );
            const sourceDistance = computeShotDistanceFeet(
              priorContext?.previousNormalizedX ?? null,
              priorContext?.previousNormalizedY ?? null
            );
            if (currentDistance == null || sourceDistance == null) return null;
            return currentDistance - sourceDistance;
          })()
        : null,
      reboundAngleChangeDegrees: isReboundShot
        ? (() => {
            const currentAngle = computeShotAngleDegrees(
              priorContext?.currentNormalizedX ?? null,
              priorContext?.currentNormalizedY ?? null
            );
            const sourceAngle = computeShotAngleDegrees(
              priorContext?.previousNormalizedX ?? null,
              priorContext?.previousNormalizedY ?? null
            );
            if (currentAngle == null || sourceAngle == null) return null;
            return Math.abs(currentAngle - sourceAngle);
          })()
        : null,
      reboundWindowSeconds,
      createsRebound: false,
      reboundTargetEventId: null,
      reboundTargetTypeDescKey: null,
    };
  });

  return reboundContexts.map((context) => {
    const reboundTarget = reboundTargetsBySourceEventId.get(context.eventId);

    return {
      ...context,
      createsRebound: reboundTarget != null,
      reboundTargetEventId: reboundTarget?.event_id ?? null,
      reboundTargetTypeDescKey: reboundTarget?.type_desc_key ?? null,
    };
  });
}
