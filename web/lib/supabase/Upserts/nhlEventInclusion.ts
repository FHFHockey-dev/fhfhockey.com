import type { ParsedNhlPbpEvent } from "./nhlPlayByPlayParser";

type ExclusionReason = "shootout" | "penalty-shot";

export type NormalizedEventInclusion = {
  includeInNormalizedLayer: true;
  includeInParity: boolean;
  includeInOnIceParity: boolean;
  includeInShotFeatures: boolean;
  exclusionReason: ExclusionReason | null;
  isShootoutEvent: boolean;
  isPenaltyShotEvent: boolean;
  isDelayedPenaltyEvent: boolean;
  isEmptyNetEvent: boolean;
  isOvertimeEvent: boolean;
  hasRareManpower: boolean;
};

const COMMON_MANPOWER_STATES = new Set([
  "3v3",
  "4v3",
  "3v4",
  "4v4",
  "5v3",
  "3v5",
  "5v4",
  "4v5",
  "5v5",
  "6v5",
  "5v6",
]);

const PENALTY_SHOT_PATTERN = /penalty[- ]shot/i;
const SHOOTOUT_PATTERN = /shootout/i;

type InclusionInput = Pick<
  ParsedNhlPbpEvent,
  | "type_desc_key"
  | "period_type"
  | "period_number"
  | "strength_state"
  | "strength_exact"
  | "reason"
  | "secondary_reason"
  | "penalty_desc_key"
  | "raw_event"
>;

function normalizeText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function extractPenaltyShotTexts(event: InclusionInput): string[] {
  const rawEvent = event.raw_event as
    | {
        typeDescKey?: unknown;
        reason?: unknown;
        secondaryReason?: unknown;
        periodType?: unknown;
        details?: {
          descKey?: unknown;
          reason?: unknown;
          secondaryReason?: unknown;
        } | null;
      }
    | null
    | undefined;

  return [
    event.type_desc_key,
    event.reason,
    event.secondary_reason,
    event.penalty_desc_key,
    rawEvent?.typeDescKey,
    rawEvent?.reason,
    rawEvent?.secondaryReason,
    rawEvent?.details?.descKey,
    rawEvent?.details?.reason,
    rawEvent?.details?.secondaryReason,
  ]
    .map(normalizeText)
    .filter((value): value is string => value !== null);
}

export function isShootoutEvent(event: InclusionInput): boolean {
  return (
    SHOOTOUT_PATTERN.test(event.type_desc_key ?? "") ||
    SHOOTOUT_PATTERN.test(event.period_type ?? "")
  );
}

export function isPenaltyShotEvent(event: InclusionInput): boolean {
  return extractPenaltyShotTexts(event).some((value) =>
    PENALTY_SHOT_PATTERN.test(value)
  );
}

export function hasRareManpower(event: InclusionInput): boolean {
  if (!event.strength_exact) return false;
  return !COMMON_MANPOWER_STATES.has(event.strength_exact);
}

export function evaluateNormalizedEventInclusion(
  event: InclusionInput
): NormalizedEventInclusion {
  const shootout = isShootoutEvent(event);
  const penaltyShot = isPenaltyShotEvent(event);
  const delayedPenalty = event.type_desc_key === "delayed-penalty";
  const emptyNet = event.strength_state === "EN";
  const overtime =
    !shootout &&
    ((event.period_number ?? 0) > 3 ||
      /ot|overtime/i.test(event.period_type ?? ""));
  const rareManpower = hasRareManpower(event);
  const exclusionReason: ExclusionReason | null = shootout
    ? "shootout"
    : penaltyShot
      ? "penalty-shot"
      : null;
  const includeInParity = exclusionReason === null;

  return {
    includeInNormalizedLayer: true,
    includeInParity,
    includeInOnIceParity: includeInParity,
    includeInShotFeatures: includeInParity && !delayedPenalty,
    exclusionReason,
    isShootoutEvent: shootout,
    isPenaltyShotEvent: penaltyShot,
    isDelayedPenaltyEvent: delayedPenalty,
    isEmptyNetEvent: emptyNet,
    isOvertimeEvent: overtime,
    hasRareManpower: rareManpower,
  };
}
