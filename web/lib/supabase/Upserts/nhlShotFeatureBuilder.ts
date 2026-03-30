import type { Database } from "../database-generated.types";
import {
  OFFENSIVE_NET_X,
  OFFENSIVE_NET_Y,
  normalizeCoordinatesToAttackingDirection,
} from "./nhlCoordinates";
import { buildContextualFeatureContexts } from "./nhlContextualFeatures";
import { evaluateNormalizedEventInclusion } from "./nhlEventInclusion";
import { buildFlurryContexts } from "./nhlFlurries";
import { buildMissReasonContexts } from "./nhlMissReasons";
import type { ParsedNhlPbpEvent } from "./nhlPlayByPlayParser";
import { buildPriorEventContexts } from "./nhlPriorEventContext";
import { buildReboundContexts } from "./nhlRebounds";
import { buildRushContexts } from "./nhlRush";

type ShiftRow = Database["public"]["Tables"]["nhl_api_shift_rows"]["Row"];

export const NHL_SHOT_FEATURE_VERSION = 1;

export type NhlShotFeatureRow = {
  featureVersion: number;
  gameId: number;
  seasonId: number | null;
  gameDate: string | null;
  eventId: number;
  eventIndex: number;
  sortOrder: number | null;
  periodNumber: number | null;
  periodType: string | null;
  gameSecondsElapsed: number | null;
  periodSecondsElapsed: number | null;
  eventOwnerTeamId: number | null;
  eventOwnerSide: "home" | "away" | null;
  strengthState: string | null;
  strengthExact: string | null;
  shotEventType: string | null;
  isGoal: boolean;
  isShotOnGoal: boolean;
  isMissedShot: boolean;
  isBlockedShot: boolean;
  isUnblockedShotAttempt: boolean;
  shooterPlayerId: number | null;
  shootingPlayerId: number | null;
  scoringPlayerId: number | null;
  goalieInNetId: number | null;
  shotType: string | null;
  zoneCode: string | null;
  rawX: number | null;
  rawY: number | null;
  normalizedX: number | null;
  normalizedY: number | null;
  shotDistanceFeet: number | null;
  shotAngleDegrees: number | null;
  previousEventId: number | null;
  previousEventTypeDescKey: string | null;
  previousEventTeamId: number | null;
  previousEventSameTeam: boolean | null;
  timeSincePreviousEventSeconds: number | null;
  distanceFromPreviousEvent: number | null;
  isReboundShot: boolean;
  reboundSourceEventId: number | null;
  reboundSourceTypeDescKey: string | null;
  reboundTimeDeltaSeconds: number | null;
  reboundDistanceFromSource: number | null;
  createsRebound: boolean;
  isRushShot: boolean;
  rushSourceEventId: number | null;
  rushSourceTypeDescKey: string | null;
  rushTimeSinceSourceSeconds: number | null;
  rushSourceTeamRelativeZoneCode: string | null;
  isFlurryShot: boolean;
  flurrySequenceId: string | null;
  flurryShotIndex: number | null;
  flurryShotCount: number | null;
  flurrySequenceStartEventId: number | null;
  flurrySequenceEndEventId: number | null;
  missReasonRaw: string | null;
  missReasonBucket: string | null;
  isShortSideMiss: boolean;
  ownerPowerPlayAgeSeconds: number | null;
  opponentPowerPlayAgeSeconds: number | null;
  shooterShiftAgeSeconds: number | null;
  ownerAverageShiftAgeSeconds: number | null;
  ownerMaxShiftAgeSeconds: number | null;
  opponentAverageShiftAgeSeconds: number | null;
  opponentMaxShiftAgeSeconds: number | null;
  eastWestMovementFeet: number | null;
  northSouthMovementFeet: number | null;
  crossedRoyalRoad: boolean | null;
  isPenaltyShotEvent: boolean;
  isShootoutEvent: boolean;
  isDelayedPenaltyEvent: boolean;
  isEmptyNetEvent: boolean;
  isOvertimeEvent: boolean;
  hasRareManpower: boolean;
};

function normalizeShotType(shotType: string | null): string | null {
  if (shotType == null) return null;
  const normalized = shotType.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

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

function getPrimaryShooterId(event: ParsedNhlPbpEvent): number | null {
  return event.shooting_player_id ?? event.scoring_player_id ?? null;
}

export function buildShotFeatureRows(
  events: ParsedNhlPbpEvent[],
  shiftRows: ShiftRow[],
  homeTeamId: number,
  awayTeamId: number,
  options: {
    featureVersion?: number;
  } = {}
): NhlShotFeatureRow[] {
  const featureVersion = options.featureVersion ?? NHL_SHOT_FEATURE_VERSION;

  const priorContexts = buildPriorEventContexts(events);
  const priorByEventId = new Map(
    priorContexts.map((context) => [context.eventId, context])
  );
  const reboundContexts = buildReboundContexts(events);
  const reboundByEventId = new Map(
    reboundContexts.map((context) => [context.eventId, context])
  );
  const rushContexts = buildRushContexts(events);
  const rushByEventId = new Map(
    rushContexts.map((context) => [context.eventId, context])
  );
  const flurryContexts = buildFlurryContexts(events);
  const flurryByEventId = new Map(
    flurryContexts.map((context) => [context.eventId, context])
  );
  const missReasonContexts = buildMissReasonContexts(events);
  const missReasonByEventId = new Map(
    missReasonContexts.map((context) => [context.eventId, context])
  );
  const contextualFeatures = buildContextualFeatureContexts(
    events,
    shiftRows,
    homeTeamId,
    awayTeamId
  );
  const contextualByEventId = new Map(
    contextualFeatures.map((context) => [context.eventId, context])
  );

  return events
    .filter((event) => {
      const inclusion = evaluateNormalizedEventInclusion(event);
      return event.is_shot_like && inclusion.includeInShotFeatures;
    })
    .map((event) => {
      const inclusion = evaluateNormalizedEventInclusion(event);
      const prior = priorByEventId.get(event.event_id);
      const rebound = reboundByEventId.get(event.event_id);
      const rush = rushByEventId.get(event.event_id);
      const flurry = flurryByEventId.get(event.event_id);
      const missReason = missReasonByEventId.get(event.event_id);
      const contextual = contextualByEventId.get(event.event_id);
      const normalized = normalizeCoordinatesToAttackingDirection(
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

      return {
        featureVersion,
        gameId: event.game_id,
        seasonId: event.season_id ?? null,
        gameDate: event.game_date ?? null,
        eventId: event.event_id,
        eventIndex: event.event_index,
        sortOrder: event.sort_order ?? null,
        periodNumber: event.period_number ?? null,
        periodType: event.period_type ?? null,
        gameSecondsElapsed: event.game_seconds_elapsed ?? null,
        periodSecondsElapsed: event.period_seconds_elapsed ?? null,
        eventOwnerTeamId: event.event_owner_team_id ?? null,
        eventOwnerSide:
          event.event_owner_side === "home" || event.event_owner_side === "away"
            ? event.event_owner_side
            : null,
        strengthState: event.strength_state ?? null,
        strengthExact: event.strength_exact ?? null,
        shotEventType: event.type_desc_key ?? null,
        isGoal: event.type_desc_key === "goal",
        isShotOnGoal:
          event.type_desc_key === "goal" || event.type_desc_key === "shot-on-goal",
        isMissedShot: event.type_desc_key === "missed-shot",
        isBlockedShot: event.type_desc_key === "blocked-shot",
        isUnblockedShotAttempt: event.type_desc_key !== "blocked-shot",
        shooterPlayerId: getPrimaryShooterId(event),
        shootingPlayerId: event.shooting_player_id ?? null,
        scoringPlayerId: event.scoring_player_id ?? null,
        goalieInNetId: event.goalie_in_net_id ?? null,
        shotType: normalizeShotType(event.shot_type ?? null),
        zoneCode: event.zone_code ?? null,
        rawX: event.x_coord ?? null,
        rawY: event.y_coord ?? null,
        normalizedX: normalized.normalizedX,
        normalizedY: normalized.normalizedY,
        shotDistanceFeet: computeShotDistanceFeet(
          normalized.normalizedX,
          normalized.normalizedY
        ),
        shotAngleDegrees: computeShotAngleDegrees(
          normalized.normalizedX,
          normalized.normalizedY
        ),
        previousEventId: prior?.previousEventId ?? null,
        previousEventTypeDescKey: prior?.previousEventTypeDescKey ?? null,
        previousEventTeamId: prior?.previousEventTeamId ?? null,
        previousEventSameTeam: prior?.previousEventSameTeam ?? null,
        timeSincePreviousEventSeconds: prior?.timeSincePreviousEventSeconds ?? null,
        distanceFromPreviousEvent: prior?.distanceFromPreviousEvent ?? null,
        isReboundShot: rebound?.isReboundShot ?? false,
        reboundSourceEventId: rebound?.reboundSourceEventId ?? null,
        reboundSourceTypeDescKey: rebound?.reboundSourceTypeDescKey ?? null,
        reboundTimeDeltaSeconds: rebound?.reboundTimeDeltaSeconds ?? null,
        reboundDistanceFromSource: rebound?.reboundDistanceFromSource ?? null,
        createsRebound: rebound?.createsRebound ?? false,
        isRushShot: rush?.isRushShot ?? false,
        rushSourceEventId: rush?.rushSourceEventId ?? null,
        rushSourceTypeDescKey: rush?.rushSourceTypeDescKey ?? null,
        rushTimeSinceSourceSeconds: rush?.rushTimeSinceSourceSeconds ?? null,
        rushSourceTeamRelativeZoneCode:
          rush?.rushSourceTeamRelativeZoneCode ?? null,
        isFlurryShot: flurry?.isFlurryShot ?? false,
        flurrySequenceId: flurry?.flurrySequenceId ?? null,
        flurryShotIndex: flurry?.flurryShotIndex ?? null,
        flurryShotCount: flurry?.flurryShotCount ?? null,
        flurrySequenceStartEventId: flurry?.flurrySequenceStartEventId ?? null,
        flurrySequenceEndEventId: flurry?.flurrySequenceEndEventId ?? null,
        missReasonRaw: missReason?.missReasonRaw ?? null,
        missReasonBucket: missReason?.missReasonBucket ?? null,
        isShortSideMiss: missReason?.isShortSideMiss ?? false,
        ownerPowerPlayAgeSeconds: contextual?.ownerPowerPlayAgeSeconds ?? null,
        opponentPowerPlayAgeSeconds:
          contextual?.opponentPowerPlayAgeSeconds ?? null,
        shooterShiftAgeSeconds: contextual?.shooterShiftAgeSeconds ?? null,
        ownerAverageShiftAgeSeconds:
          contextual?.ownerAverageShiftAgeSeconds ?? null,
        ownerMaxShiftAgeSeconds: contextual?.ownerMaxShiftAgeSeconds ?? null,
        opponentAverageShiftAgeSeconds:
          contextual?.opponentAverageShiftAgeSeconds ?? null,
        opponentMaxShiftAgeSeconds:
          contextual?.opponentMaxShiftAgeSeconds ?? null,
        eastWestMovementFeet: contextual?.eastWestMovementFeet ?? null,
        northSouthMovementFeet: contextual?.northSouthMovementFeet ?? null,
        crossedRoyalRoad: contextual?.crossedRoyalRoad ?? null,
        isPenaltyShotEvent: inclusion.isPenaltyShotEvent,
        isShootoutEvent: inclusion.isShootoutEvent,
        isDelayedPenaltyEvent: inclusion.isDelayedPenaltyEvent,
        isEmptyNetEvent: inclusion.isEmptyNetEvent,
        isOvertimeEvent: inclusion.isOvertimeEvent,
        hasRareManpower: inclusion.hasRareManpower,
      };
    });
}
