import {
  OFFENSIVE_NET_X,
  OFFENSIVE_NET_Y,
  normalizeCoordinatesToAttackingDirection,
} from "../supabase/Upserts/nhlCoordinates";
import { evaluateNormalizedEventInclusion } from "../supabase/Upserts/nhlEventInclusion";
import type { ParsedNhlPbpEvent } from "../supabase/Upserts/nhlPlayByPlayParser";
import { buildPossessionChainContexts } from "../supabase/Upserts/nhlPossessionChains";
import { DEFAULT_REBOUND_WINDOW_SECONDS } from "../supabase/Upserts/nhlRebounds";

const REBOUND_SOURCE_TYPES = new Set(["shot-on-goal", "missed-shot", "blocked-shot"]);
const UNBLOCKED_TARGET_TYPES = new Set(["goal", "shot-on-goal", "missed-shot"]);
const POSSESSION_TERMINATION_TYPES = new Set([
  "stoppage",
  "faceoff",
  "period-end",
  "game-end",
  "penalty",
  "delayed-penalty",
]);

export type RichReboundTermination =
  | "next_attempt"
  | "goalie_freeze_covered_puck"
  | "opponent_control"
  | "possession_break"
  | "stoppage"
  | "window_expired"
  | "period_or_game_end";

export type RichReboundLabel = {
  gameId: number;
  sourceEventId: number;
  sourceTypeDescKey: string;
  sourceTeamId: number;
  sourceGoalieInNetId: number | null;
  windowSeconds: number;
  possessionSequenceId: string;
  termination: RichReboundTermination;
  nextAttemptEventId: number | null;
  nextAttemptTypeDescKey: string | null;
  nextAttemptDeltaSeconds: number | null;
  samePossessionVerified: boolean;
  reboundCreated: 0 | 1;
  conditionalHighDanger: 0 | 1 | null;
  goalieFreezeCoveredPuck: 0 | 1 | null;
  conditionalNextAttemptGoal: 0 | 1 | null;
  nextAttemptShotDistanceFeet: number | null;
  nextAttemptShotAngleDegrees: number | null;
  labelVersion: "rebound_rich_labels_v1";
};

function eventOrder(event: ParsedNhlPbpEvent): number {
  return event.sort_order ?? event.event_id;
}

function sortEvents(events: ParsedNhlPbpEvent[]): ParsedNhlPbpEvent[] {
  return [...events].sort((left, right) => {
    if (left.game_id !== right.game_id) return left.game_id - right.game_id;
    const orderDelta = eventOrder(left) - eventOrder(right);
    return orderDelta !== 0 ? orderDelta : left.event_id - right.event_id;
  });
}

function secondsBetween(source: ParsedNhlPbpEvent, target: ParsedNhlPbpEvent): number | null {
  const sourceSeconds =
    source.game_seconds_elapsed ?? source.period_seconds_elapsed ?? null;
  const targetSeconds =
    target.game_seconds_elapsed ?? target.period_seconds_elapsed ?? null;
  if (sourceSeconds == null || targetSeconds == null) return null;
  const delta = targetSeconds - sourceSeconds;
  return Number.isFinite(delta) ? delta : null;
}

function eligibleSource(event: ParsedNhlPbpEvent): boolean {
  return (
    event.type_desc_key != null &&
    REBOUND_SOURCE_TYPES.has(event.type_desc_key) &&
    evaluateNormalizedEventInclusion(event).includeInShotFeatures &&
    event.event_owner_team_id != null
  );
}

function eligibleAttempt(event: ParsedNhlPbpEvent): boolean {
  return event.is_shot_like === true && evaluateNormalizedEventInclusion(event).includeInShotFeatures;
}

function shotGeometry(event: ParsedNhlPbpEvent): {
  distance: number | null;
  angle: number | null;
} {
  const normalized = normalizeCoordinatesToAttackingDirection(
    event.x_coord,
    event.y_coord,
    {
      homeTeamDefendingSide:
        event.home_team_defending_side === "left" ||
        event.home_team_defending_side === "right"
          ? event.home_team_defending_side
          : null,
      teamSide: event.event_owner_side,
    }
  );
  if (normalized.normalizedX == null || normalized.normalizedY == null) {
    return { distance: null, angle: null };
  }
  const deltaX = Math.abs(OFFENSIVE_NET_X - normalized.normalizedX);
  const deltaY = Math.abs(OFFENSIVE_NET_Y - normalized.normalizedY);
  return {
    distance: Math.sqrt(deltaX * deltaX + deltaY * deltaY),
    angle: (Math.atan2(deltaY, deltaX) * 180) / Math.PI,
  };
}

function classifyHighDanger(distance: number | null, angle: number | null): 0 | 1 | null {
  if (distance == null || angle == null) return null;
  return distance <= 20 && angle <= 35 ? 1 : 0;
}

export function buildRichReboundLabels(
  events: ParsedNhlPbpEvent[],
  options: { windowSeconds?: number } = {}
): RichReboundLabel[] {
  const windowSeconds = options.windowSeconds ?? DEFAULT_REBOUND_WINDOW_SECONDS;
  const sorted = sortEvents(events);
  const possessionByEvent = new Map(
    buildPossessionChainContexts(sorted).map((context) => [context.eventId, context])
  );
  const labels: RichReboundLabel[] = [];

  for (let sourceIndex = 0; sourceIndex < sorted.length; sourceIndex += 1) {
    const source = sorted[sourceIndex]!;
    if (!eligibleSource(source)) continue;
    const sourceTeamId = source.event_owner_team_id!;
    const sourcePossession = possessionByEvent.get(source.event_id)?.possessionSequenceId ?? null;
    if (!sourcePossession) continue;

    let termination: RichReboundTermination = "window_expired";
    let target: ParsedNhlPbpEvent | null = null;
    let targetDelta: number | null = null;

    for (let targetIndex = sourceIndex + 1; targetIndex < sorted.length; targetIndex += 1) {
      const candidate = sorted[targetIndex]!;
      if (candidate.game_id !== source.game_id || candidate.period_number !== source.period_number) {
        termination = "period_or_game_end";
        break;
      }
      const delta = secondsBetween(source, candidate);
      if (delta == null || delta <= 0) continue;
      if (delta > windowSeconds) break;

      if (candidate.type_desc_key === "stoppage") {
        termination =
          source.type_desc_key === "shot-on-goal"
            ? "goalie_freeze_covered_puck"
            : "stoppage";
        targetDelta = delta;
        break;
      }
      if (POSSESSION_TERMINATION_TYPES.has(candidate.type_desc_key ?? "")) {
        termination = "possession_break";
        targetDelta = delta;
        break;
      }
      if (
        candidate.event_owner_team_id != null &&
        candidate.event_owner_team_id !== sourceTeamId
      ) {
        termination = "opponent_control";
        targetDelta = delta;
        break;
      }
      const candidatePossession =
        possessionByEvent.get(candidate.event_id)?.possessionSequenceId ?? null;
      if (candidatePossession !== sourcePossession) {
        termination = "possession_break";
        targetDelta = delta;
        break;
      }
      if (eligibleAttempt(candidate)) {
        target = candidate;
        targetDelta = delta;
        termination = "next_attempt";
        break;
      }
    }

    const geometry = target ? shotGeometry(target) : { distance: null, angle: null };
    const isUnblockedTarget =
      target?.type_desc_key != null && UNBLOCKED_TARGET_TYPES.has(target.type_desc_key);
    labels.push({
      gameId: source.game_id,
      sourceEventId: source.event_id,
      sourceTypeDescKey: source.type_desc_key!,
      sourceTeamId,
      sourceGoalieInNetId: source.goalie_in_net_id ?? null,
      windowSeconds,
      possessionSequenceId: sourcePossession,
      termination,
      nextAttemptEventId: target?.event_id ?? null,
      nextAttemptTypeDescKey: target?.type_desc_key ?? null,
      nextAttemptDeltaSeconds: targetDelta,
      samePossessionVerified: target != null,
      reboundCreated: target != null ? 1 : 0,
      conditionalHighDanger: target
        ? classifyHighDanger(geometry.distance, geometry.angle)
        : null,
      goalieFreezeCoveredPuck:
        source.type_desc_key === "shot-on-goal"
          ? termination === "goalie_freeze_covered_puck"
            ? 1
            : 0
          : null,
      conditionalNextAttemptGoal: isUnblockedTarget
        ? target?.type_desc_key === "goal"
          ? 1
          : 0
        : null,
      nextAttemptShotDistanceFeet: geometry.distance,
      nextAttemptShotAngleDegrees: geometry.angle,
      labelVersion: "rebound_rich_labels_v1",
    });
  }

  return labels;
}
