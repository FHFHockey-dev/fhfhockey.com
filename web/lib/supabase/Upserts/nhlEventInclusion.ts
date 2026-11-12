import type { ParsedNhlPbpEvent } from "./nhlPlayByPlayParser";
import {
  classifyTeamManpower,
  isPenaltyShotSituation,
  parseSituationCode,
} from "./nhlStrengthState";

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
// The feed files penalty-shot infractions as e.g. "ps-hooking-on-breakaway".
const PENALTY_SHOT_DESC_KEY_PATTERN = /^ps-/i;
const SHOOTOUT_PATTERN = /shootout/i;

type InclusionInput = {
  type_desc_key?: string | null | undefined;
  period_type?: string | null | undefined;
  period_number?: number | null | undefined;
  strength_state?: string | null | undefined;
  strength_exact?: string | null | undefined;
  situation_code?: string | null | undefined;
  event_owner_side?: "home" | "away" | null | undefined;
  reason?: string | null | undefined;
  secondary_reason?: string | null | undefined;
  penalty_desc_key?: string | null | undefined;
  raw_event?: unknown;
};

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
  const normalizedPeriodType = normalizeText(event.period_type)?.toUpperCase() ?? null;
  return (
    SHOOTOUT_PATTERN.test(event.type_desc_key ?? "") ||
    SHOOTOUT_PATTERN.test(event.period_type ?? "") ||
    normalizedPeriodType === "SO"
  );
}

/**
 * A penalty-shot attempt or infraction outside the shootout (W1-2 D7): the
 * situation code has a side with no skaters (`1010`, `0101`), the infraction's
 * desc key starts with "ps-", or a text field names a penalty shot.
 */
export function isPenaltyShotEvent(event: InclusionInput): boolean {
  if (!isShootoutEvent(event) && isPenaltyShotSituation(parseSituationCode(event.situation_code))) {
    return true;
  }
  return extractPenaltyShotTexts(event).some(
    (value) =>
      PENALTY_SHOT_PATTERN.test(value) || PENALTY_SHOT_DESC_KEY_PATTERN.test(value)
  );
}

/**
 * The event's owner is attacking an empty net (decisions 7, 84). A shot by a
 * team whose own goalie is pulled is not an empty-net event. Uses the
 * situation code when the owner is known; otherwise the stored label.
 */
export function isAttackingEmptyNetEvent(event: InclusionInput): boolean {
  const situation = parseSituationCode(event.situation_code);
  if (situation && event.event_owner_side) {
    return classifyTeamManpower(situation, event.event_owner_side)?.opponentNetEmpty === true;
  }
  return event.strength_state === "EN" && !isPenaltyShotSituation(situation);
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
  const emptyNet = !penaltyShot && isAttackingEmptyNetEvent(event);
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
