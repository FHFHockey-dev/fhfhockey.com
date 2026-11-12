import { evaluateNormalizedEventInclusion } from "./nhlEventInclusion";
import type { ParsedNhlPbpEvent } from "./nhlPlayByPlayParser";

export type NhlMissReasonBucket =
  | "short-of-net"
  | "wide"
  | "high-and-wide"
  | "post"
  | "crossbar"
  | "over-net"
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

// v2: exact NHL reason strings (W1-1 M-XG-054). v1 matched substrings, so
// "short" became "short-side" and "above-crossbar" became "crossbar".
const DEFAULT_MISS_REASON_VERSION = 2;

/** Exact NHL missed-shot reasons. Anything else is "other". */
const NHL_MISS_REASON_BUCKETS: Record<string, NhlMissReasonBucket> = {
  short: "short-of-net",
  "wide-left": "wide",
  "wide-right": "wide",
  "wide-of-net": "wide",
  "high-and-wide-left": "high-and-wide",
  "high-and-wide-right": "high-and-wide",
  "hit-left-post": "post",
  "hit-right-post": "post",
  "hit-crossbar": "crossbar",
  "above-crossbar": "over-net",
};

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
  return NHL_MISS_REASON_BUCKETS[normalized] ?? "other";
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
  // No NHL miss reason says "short side" ("short" means the puck fell short
  // of the net), so this flag cannot be derived from the reason.
  const isShortSideMiss = false;

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
