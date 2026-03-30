import { evaluateNormalizedEventInclusion } from "./nhlEventInclusion";
import type { ParsedNhlPbpEvent } from "./nhlPlayByPlayParser";

export type NhlMissReasonBucket =
  | "short-side"
  | "wide"
  | "post"
  | "crossbar"
  | "over-net"
  | "blocked-like"
  | "other"
  | "unknown";

export type NhlMissReasonContext = {
  gameId: number;
  eventId: number;
  missReasonRaw: string | null;
  missReasonBucket: NhlMissReasonBucket | null;
  isMissedShotEvent: boolean;
  isShortSideMiss: boolean;
  includeInParityMissCounts: boolean;
  includeInSequenceContext: boolean;
  includeInXgShotFeatures: boolean;
  excludeFromXgForMissReason: boolean;
  missReasonVersion: number;
};

const DEFAULT_MISS_REASON_VERSION = 1;

function normalizeReason(reason: string | null): string | null {
  if (reason == null) return null;
  const normalized = reason.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function classifyMissReasonBucket(
  reason: string | null
): NhlMissReasonBucket {
  const normalized = normalizeReason(reason);

  if (normalized == null) return "unknown";
  if (normalized.includes("short")) return "short-side";
  if (normalized.includes("wide")) return "wide";
  if (normalized.includes("crossbar")) return "crossbar";
  if (normalized.includes("post")) return "post";
  if (normalized.includes("over")) return "over-net";
  if (normalized.includes("blocked")) return "blocked-like";
  return "other";
}

export function buildMissReasonContext(
  event: Pick<ParsedNhlPbpEvent, "game_id" | "event_id" | "type_desc_key" | "reason" | "secondary_reason" | "is_shot_like"> &
    ParsedNhlPbpEvent,
  options: {
    missReasonVersion?: number;
  } = {}
): NhlMissReasonContext {
  const missReasonVersion =
    options.missReasonVersion ?? DEFAULT_MISS_REASON_VERSION;
  const isMissedShotEvent = event.type_desc_key === "missed-shot";
  const normalizedInclusion = evaluateNormalizedEventInclusion(event);
  const missReasonRaw = normalizeReason(
    event.reason ?? event.secondary_reason ?? null
  );
  const missReasonBucket = isMissedShotEvent
    ? classifyMissReasonBucket(missReasonRaw)
    : null;
  const isShortSideMiss = missReasonBucket === "short-side";

  return {
    gameId: event.game_id,
    eventId: event.event_id,
    missReasonRaw,
    missReasonBucket,
    isMissedShotEvent,
    isShortSideMiss,
    includeInParityMissCounts:
      isMissedShotEvent && normalizedInclusion.includeInParity,
    includeInSequenceContext:
      isMissedShotEvent && normalizedInclusion.includeInShotFeatures,
    includeInXgShotFeatures:
      isMissedShotEvent && normalizedInclusion.includeInShotFeatures,
    excludeFromXgForMissReason: false,
    missReasonVersion,
  };
}

export function buildMissReasonContexts(
  events: ParsedNhlPbpEvent[],
  options: {
    missReasonVersion?: number;
  } = {}
): NhlMissReasonContext[] {
  return events.map((event) => buildMissReasonContext(event, options));
}
