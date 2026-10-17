import { buildSkaterParticipationReceipt, type DatedParticipationEligibility, type ParticipationEvidence,
  type RosterObservationSkaterParticipationInput, type RosterObservationSkaterParticipationReceipt,
  type SkaterParticipationInput } from "./modeledSkaterParticipation";
import type { RosterObservationGoalieParticipationInput, RosterObservationGoalieParticipationReceipt,
  RosterObservationGoalieStartInput, RosterObservationGoalieStartReceipt } from "./modeledGoalieParticipation";
import { rosterObservationReasons, ROSTER_CONTINUATION_ASSUMPTION } from "./targetRosterObservation";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";
import { timestampMicros } from "../projections/evidenceTime";
import { localDate, zonedMidnight } from "../rosterScheduleOptimizer/planningDates";

/** Approved v2 participation (TJ 2026-10-17): the roster-observation appearance-frequency estimator,
 * label, eligibility, staleness, evidence and conflict rules, unchanged, over the 14 America/New_York
 * calendar days before the cutoff's local date (half-open, local midnight to local midnight) instead
 * of the frozen Sep29–Oct13 frame. Earlier method versions and their bundles are untouched. */
export const ROLLING_PARTICIPATION_WINDOW = Object.freeze({ days: 14, timeZone: "America/New_York" } as const);
export const ROLLING_WINDOW_SKATER_PARTICIPATION_METHOD = "skater-rolling-14d-appearance-frequency-v1" as const;
export const ROLLING_WINDOW_GOALIE_PARTICIPATION_METHOD = "goalie-rolling-14d-appearance-frequency-v1" as const;
export const ROLLING_WINDOW_GOALIE_START_METHOD = "goalie-rolling-14d-start-frequency-v1" as const;

export type RollingWindowSkaterParticipationInput = Omit<RosterObservationSkaterParticipationInput, "version"> & {
  version: "skater-rolling-14d-participation-input-v1";
};
export type RollingWindowGoalieParticipationInput = Omit<RosterObservationGoalieParticipationInput, "version"> & {
  version: "goalie-rolling-14d-participation-input-v1";
};
export type RollingWindowGoalieStartInput = Omit<RosterObservationGoalieStartInput, "version"> & {
  version: "goalie-rolling-14d-start-input-v1";
};
export type RollingWindowSkaterParticipationReceipt = Omit<RosterObservationSkaterParticipationReceipt, "version" | "methodVersion"> & {
  version: "modeled-skater-rolling-14d-participation-v1"; methodVersion: typeof ROLLING_WINDOW_SKATER_PARTICIPATION_METHOD;
};
export type RollingWindowGoalieParticipationReceipt = Omit<RosterObservationGoalieParticipationReceipt, "version" | "methodVersion"> & {
  version: "modeled-goalie-rolling-14d-participation-v1"; methodVersion: typeof ROLLING_WINDOW_GOALIE_PARTICIPATION_METHOD;
};
export type RollingWindowGoalieStartReceipt = Omit<RosterObservationGoalieStartReceipt, "version" | "methodVersion"> & {
  version: "modeled-goalie-rolling-14d-start-v1"; methodVersion: typeof ROLLING_WINDOW_GOALIE_START_METHOD;
};
type Issuance = { issuedAt: string; expiresAt: string };
type AppearanceInput = RollingWindowSkaterParticipationInput | RollingWindowGoalieParticipationInput | RollingWindowGoalieStartInput;

const DAY = 86400000000;
const time = (value: string) => { const parsed = timestampMicros(value); return parsed === null ? NaN : Number(parsed); };
const label = (value: unknown) => value === null || typeof value === "boolean";
const shiftDate = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const isoMicros = (micros: bigint) => {
  const thousand = BigInt(1000);
  return `${new Date(Number(micros / thousand)).toISOString().slice(0, -1)}${String(micros % thousand).padStart(3, "0")}Z`;
};

/** The 14 local dates before the cutoff's America/New_York date, as a half-open instant window.
 * Across a daylight-saving change the window is 14 local days (335 or 337 hours), not 336 hours. */
export function rollingParticipationWindow(cutoffAt: string) {
  if (timestampMicros(cutoffAt) === null) throw new Error("Invalid rolling participation cutoff.");
  const { days, timeZone } = ROLLING_PARTICIPATION_WINDOW, endDate = localDate(cutoffAt, timeZone);
  const dates = Array.from({ length: days }, (_, index) => shiftDate(endDate, index - days));
  return { startAt: zonedMidnight(dates[0], timeZone), endAt: zonedMidnight(endDate, timeZone), dates, timeZone };
}

/** Same steps as the roster-observation frozen-window kernel, with the frame check replaced by the
 * rolling window. The exported finite estimator runs under its default 60-day frame, a superset of
 * the 14-day window enforced here first, so selection, labels, staleness and reasons are unchanged. */
function rollingAppearanceKernel(input: AppearanceInput, issuance: Issuance) {
  const window = rollingParticipationWindow(input?.cutoffAt);
  const start = time(window.startAt), end = time(window.endAt);
  if (!input.scope || !input.history || !Array.isArray(input.history.games)
    || time(input.history.windowStartAt) !== start || time(input.history.windowEndAt) !== end) {
    throw new Error("Invalid rolling 14-day participation window.");
  }
  for (const game of input.history.games) {
    if (!Number.isFinite(time(game?.scheduledAt)) || time(game.scheduledAt) < start || time(game.scheduledAt) >= end) {
      throw new Error("Invalid participation history opportunity.");
    }
  }
  const reasons = rosterObservationReasons(input.targetRosterObservation, input.scope, input.cutoffAt);
  const target = input.targetRosterObservation?.evidence ?? null;
  const eligibleAt = (row: DatedParticipationEligibility | null, at: string): boolean | null => {
    if (!row) return null;
    if (row.playerId !== input.scope.playerId || row.nhlPlayerId !== input.scope.nhlPlayerId
      || row.teamId !== input.scope.teamId || !label(row.eligible)
      || !Number.isFinite(time(row.effectiveFrom)) || !Number.isFinite(time(row.effectiveUntil))
      || time(row.effectiveFrom) >= time(row.effectiveUntil)) throw new Error("Invalid rolling-window eligibility identity or interval.");
    return row.evidence && time(at) >= time(row.effectiveFrom) && time(at) < time(row.effectiveUntil) ? row.eligible : null;
  };
  const kernelInput: SkaterParticipationInput = { version: "skater-participation-input-v1", scope: input.scope,
    cutoffAt: input.cutoffAt, scheduleEvidence: input.scheduleEvidence, rosterEvidence: input.rosterEvidence,
    history: { complete: input.history.complete, scheduleEvidence: input.history.scheduleEvidence,
      windowStartAt: isoMicros(timestampMicros(input.cutoffAt)! - BigInt(60 * DAY)),
      games: input.history.games.map(game => ({ ...game, eligible: eligibleAt(game.eligibility, game.scheduledAt),
        eligibilityEvidence: game.eligibility?.evidence ?? null })) } };
  const receipt = buildSkaterParticipationReceipt(kernelInput, { issuedAt: issuance.issuedAt, expiresAt: issuance.expiresAt });
  // The estimator validated every other evidence row; the target observation joins the same identity check.
  if (target && [input.scheduleEvidence, input.rosterEvidence, input.history.scheduleEvidence,
    ...input.history.games.flatMap(game => [game.eligibility?.evidence, game.outcomeEvidence])]
    .some(source => source?.id === target.id && source.hash !== target.hash)) throw new Error("Conflicting participation evidence identity.");
  const allReasons = [...new Set([...receipt.reasons, ...reasons])];
  const { version: _version, methodVersion: _method, ...rest } = receipt;
  return { ...rest, historyStartAt: input.history.windowStartAt, historyEndAt: input.history.windowEndAt,
    evidenceHashes: [...new Set([...receipt.evidenceHashes, ...(target ? [target.hash] : [])])].sort(),
    probability: allReasons.length ? null : receipt.probability, reasons: allReasons,
    continuationAssumptionVersion: ROSTER_CONTINUATION_ASSUMPTION };
}

const WINDOW_LIMITATIONS = [
  "History is the 14 America/New_York calendar days before the cutoff's local date, half-open at local midnight; it moves with every cutoff.",
  "Games on the cutoff's own local date or later are not observed and are never negatives; across a daylight-saving change the window is 14 local days.",
  "Requires a complete independently observed 14-day club schedule, game-instant listed eligibility and explicit positive or zero-minute labels; unlisted or unread games stay unknown and withhold the estimate.",
  "Uses at most 20 eligible games; the latest eligible game must be within 14 days of cutoff.",
];
const OBSERVATION_LIMITATIONS = [
  "Target listing is a fresh official season-roster observation used only under an explicit current-state continuation proxy; it is not legal eligibility or future lineup confirmation.",
  "No known conflict is not evidence of health or availability; unknown conflict state is retained, and known conflicts withhold this model.",
  "No target effective interval is invented. Historical dated eligibility and missing labels remain unchanged.",
  "No injury, role, opponent or future roster-change adjustment.",
];
const SKATER_LIMITATIONS = Object.freeze([
  "Experimental rolling 14-day eligible-opportunity appearance frequency; calibration unavailable.",
  ...WINDOW_LIMITATIONS, ...OBSERVATION_LIMITATIONS,
  "Finite endpoint frequencies zero and one are model estimates, never confirmation of future absence or appearance.",
  "Positive-minute conditioning excludes penalty-only zero-minute PIM; no all-appearance PIM claim.",
]);
const GOALIE_APPEARANCE_LIMITATIONS = Object.freeze([
  "Experimental rolling 14-day eligible-opportunity goalie appearance frequency; calibration unavailable.",
  ...WINDOW_LIMITATIONS, ...OBSERVATION_LIMITATIONS,
  "Finite endpoint frequencies zero and one are model estimates, never confirmation of future absence or appearance.",
  "Goalie positive minutes include relief; an eligible nonstarter remains an opportunity, never an inferred nonappearance.",
  "This is an appearance probability only; no start probability or confirmed lineup is supplied.",
]);
const GOALIE_START_LIMITATIONS = Object.freeze([
  "Experimental rolling 14-day eligible-opportunity official starter frequency; calibration unavailable.",
  ...WINDOW_LIMITATIONS,
  "Uses original explicit boolean starter labels over the same eligible opportunities, including nonstarts; unknown appearance or starter labels withhold this estimate.",
  "A nonstart can be a positive-minute relief appearance; this start model never changes appearance-conditioned W, SV, GA, SA, minutes or SO means.",
  "Target official season-roster observation is only an explicit continuation proxy, not legal eligibility or a confirmed future start.",
  "No known conflict does not prove health; known conflicts withhold the model, and no effective interval is invented.",
  "No injury, role, opponent or future roster-change adjustment.",
  "Finite endpoint frequencies zero and one are uncalibrated model estimates, not confirmed starts or credited minimum progress.",
]);

export function buildRollingWindowSkaterParticipationReceipt(input: RollingWindowSkaterParticipationInput,
  issuance: Issuance): RollingWindowSkaterParticipationReceipt {
  if (input?.version !== "skater-rolling-14d-participation-input-v1" || input.playerClass !== "skater") {
    throw new Error("Invalid rolling-window skater participation input.");
  }
  return { ...rollingAppearanceKernel(input, issuance), version: "modeled-skater-rolling-14d-participation-v1",
    methodVersion: ROLLING_WINDOW_SKATER_PARTICIPATION_METHOD, inputHash: playerForecastSourcePayloadHash(input),
    limitations: [...SKATER_LIMITATIONS] };
}

export function buildRollingWindowGoalieParticipationReceipt(input: RollingWindowGoalieParticipationInput,
  issuance: Issuance): RollingWindowGoalieParticipationReceipt {
  if (input?.version !== "goalie-rolling-14d-participation-input-v1" || input.playerClass !== "goalie") {
    throw new Error("Invalid rolling-window goalie participation input.");
  }
  return { ...rollingAppearanceKernel(input, issuance), version: "modeled-goalie-rolling-14d-participation-v1",
    methodVersion: ROLLING_WINDOW_GOALIE_PARTICIPATION_METHOD, inputHash: playerForecastSourcePayloadHash(input),
    limitations: [...GOALIE_APPEARANCE_LIMITATIONS] };
}

/** Distinct official-starter event over the appearance receipt's selected eligible opportunities,
 * with the same start-label evidence rules as the roster-observation start method. */
export function buildRollingWindowGoalieStartReceipt(input: RollingWindowGoalieStartInput,
  issuance: Issuance): RollingWindowGoalieStartReceipt {
  if (input?.version !== "goalie-rolling-14d-start-input-v1" || input.playerClass !== "goalie") {
    throw new Error("Invalid rolling-window goalie start input.");
  }
  const appearance = rollingAppearanceKernel(input, issuance), cutoff = time(input.cutoffAt);
  const identities = new Map<string, string>();
  const evidence = [input.scheduleEvidence, input.rosterEvidence, input.history.scheduleEvidence,
    ...(input.targetRosterObservation?.evidence ? [input.targetRosterObservation.evidence] : []),
    ...input.history.games.flatMap(game => [game.eligibility?.evidence, game.outcomeEvidence, game.starterEvidence]
      .filter((row): row is ParticipationEvidence => !!row))];
  for (const row of evidence) {
    if (!row || typeof row.id !== "string" || !row.id.trim() || !/^[a-f0-9]{64}$/.test(row.hash)
      || !Number.isFinite(time(row.availableAt)) || !Number.isFinite(time(row.capturedAt))
      || time(row.availableAt) > cutoff || time(row.capturedAt) > cutoff
      || identities.has(row.id) && identities.get(row.id) !== row.hash) throw new Error("Invalid or conflicting start-label evidence.");
    identities.set(row.id, row.hash);
  }
  for (const game of input.history.games) {
    if (game.officialStarter != null && typeof game.officialStarter !== "boolean") throw new Error("Invalid explicit starter label.");
    if (game.starterEvidence && (time(game.starterEvidence.availableAt) < time(game.scheduledAt)
      || time(game.starterEvidence.capturedAt) < time(game.scheduledAt))) throw new Error("Historical starter evidence predates its game.");
  }
  const selected = input.history.games.filter(game => appearance.selectedGameIds.includes(game.gameId));
  const reasons = [...appearance.reasons];
  if (selected.some(game => game.officialStarter == null || !game.starterEvidence)) reasons.push("unresolved_official_starter_label");
  const numerator = selected.filter(game => game.officialStarter === true).length;
  return { ...appearance, version: "modeled-goalie-rolling-14d-start-v1", methodVersion: ROLLING_WINDOW_GOALIE_START_METHOD,
    event: "official_starter", inputHash: playerForecastSourcePayloadHash(input),
    evidenceHashes: [...new Set([...appearance.evidenceHashes, ...evidence.map(row => row.hash)])].sort(),
    numerator, probability: reasons.length ? null : numerator / appearance.denominator, reasons: [...new Set(reasons)],
    limitations: [...GOALIE_START_LIMITATIONS] };
}
