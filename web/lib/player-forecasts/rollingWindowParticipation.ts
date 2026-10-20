import { buildDatedWindowSkaterKernel, type RosterObservationSkaterParticipationInput,
  type RosterObservationSkaterParticipationReceipt } from "./modeledSkaterParticipation";
import { buildGoalieStartKernel, type RosterObservationGoalieParticipationInput, type RosterObservationGoalieParticipationReceipt,
  type RosterObservationGoalieStartInput, type RosterObservationGoalieStartReceipt } from "./modeledGoalieParticipation";
import { ROSTER_CONTINUATION_ASSUMPTION } from "./targetRosterObservation";
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

const time = (value: string) => { const parsed = timestampMicros(value); return parsed === null ? NaN : Number(parsed); };
const shiftDate = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

/** The 14 local dates before the cutoff's America/New_York date, as a half-open instant window.
 * Across a daylight-saving change the window is 14 local days (335 or 337 hours), not 336 hours. */
export function rollingParticipationWindow(cutoffAt: string) {
  if (timestampMicros(cutoffAt) === null) throw new Error("Invalid rolling participation cutoff.");
  const { days, timeZone } = ROLLING_PARTICIPATION_WINDOW, endDate = localDate(cutoffAt, timeZone);
  const dates = Array.from({ length: days }, (_, index) => shiftDate(endDate, index - days));
  return { startAt: zonedMidnight(dates[0], timeZone), endAt: zonedMidnight(endDate, timeZone), dates, timeZone };
}

/** The roster-observation frozen-window kernel with only its frame check replaced by the rolling window. */
function rollingAppearanceKernel(input: AppearanceInput, issuance: Issuance) {
  const window = rollingParticipationWindow(input?.cutoffAt);
  const start = time(window.startAt), end = time(window.endAt);
  if (!input.history || time(input.history.windowStartAt) !== start || time(input.history.windowEndAt) !== end) {
    throw new Error("Invalid rolling 14-day participation window.");
  }
  const { version: _version, methodVersion: _method, ...receipt } = buildDatedWindowSkaterKernel({ ...input,
    version: "skater-frozen-window-participation-input-v1", playerClass: "skater", targetEligibility: null },
    { issuedAt: issuance.issuedAt, expiresAt: issuance.expiresAt }, { start, end }, { value: input.targetRosterObservation });
  return { ...receipt, continuationAssumptionVersion: ROSTER_CONTINUATION_ASSUMPTION };
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
 * through the same start kernel as the roster-observation start method. */
export function buildRollingWindowGoalieStartReceipt(input: RollingWindowGoalieStartInput,
  issuance: Issuance): RollingWindowGoalieStartReceipt {
  if (input?.version !== "goalie-rolling-14d-start-input-v1" || input.playerClass !== "goalie") {
    throw new Error("Invalid rolling-window goalie start input.");
  }
  const { version: _version, methodVersion: _method, ...receipt } = buildGoalieStartKernel({ ...input,
    version: "goalie-frozen-window-start-input-v1", targetEligibility: null }, rollingAppearanceKernel(input, issuance),
    input.targetRosterObservation?.evidence);
  return { ...receipt, version: "modeled-goalie-rolling-14d-start-v1", methodVersion: ROLLING_WINDOW_GOALIE_START_METHOD,
    inputHash: playerForecastSourcePayloadHash(input), continuationAssumptionVersion: ROSTER_CONTINUATION_ASSUMPTION,
    limitations: [...GOALIE_START_LIMITATIONS] };
}
