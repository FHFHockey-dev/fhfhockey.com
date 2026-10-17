import type { ContributionParticipation } from "./contributions";
import { buildSkaterParticipationReceipt, type ParticipationEvidence, type SkaterParticipationInput,
  type SkaterParticipationReceipt, buildFrozenWindowSkaterParticipationReceipt,
  type FrozenWindowSkaterParticipationInput, type FrozenWindowSkaterParticipationReceipt } from "./modeledSkaterParticipation";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";
import { timestampMicros } from "../projections/evidenceTime";

export const GOALIE_PARTICIPATION_METHOD = "goalie-appearance-frequency-v1" as const;
export type GoalieEligibility = {
  playerId: number; nhlPlayerId: number; teamId: number;
  eligible: boolean | null;
  /** Explicit source-supported half-open interval; capture time is not an effective date. */
  effectiveFrom: string; effectiveUntil: string; evidence: ParticipationEvidence;
};
type Opportunity = Omit<SkaterParticipationInput["history"]["games"][number], "eligible" | "eligibilityEvidence"> & {
  eligibility: GoalieEligibility | null;
};
export type GoalieParticipationInput = Omit<SkaterParticipationInput, "version" | "history"> & {
  version: "goalie-participation-input-v1"; playerClass: "goalie";
  targetEligibility: GoalieEligibility | null;
  history: Omit<SkaterParticipationInput["history"], "games"> & { games: Opportunity[] };
};
export type GoalieParticipationReceipt = Omit<SkaterParticipationReceipt, "version" | "methodVersion"> & {
  version: "modeled-goalie-participation-v1"; methodVersion: typeof GOALIE_PARTICIPATION_METHOD;
};
const time = (value: string) => { const parsed = timestampMicros(value); return parsed === null ? NaN : Number(parsed); };

/** Reuses the finite opportunity validator, never starter probabilities. Authentic
 * complete frames and dated labels still require independent publication review. */
export function buildGoalieParticipationReceipt(input: GoalieParticipationInput,
  issuance: { issuedAt: string; expiresAt: string }): GoalieParticipationReceipt {
  if (input?.version !== "goalie-participation-input-v1" || input.playerClass !== "goalie"
    || !input.scope || !Array.isArray(input.history?.games)) throw new Error("Invalid goalie participation input.");
  const reasons: string[] = [], additionalEvidence: ParticipationEvidence[] = [];
  function eligibility(row: GoalieEligibility | null, at: string): boolean | null {
    if (!row) return null;
    if (row.playerId !== input.scope.playerId || row.nhlPlayerId !== input.scope.nhlPlayerId
      || row.teamId !== input.scope.teamId || ![true, false, null].includes(row.eligible)
      || !Number.isFinite(time(row.effectiveFrom)) || !Number.isFinite(time(row.effectiveUntil))
      || time(row.effectiveFrom) >= time(row.effectiveUntil)) throw new Error("Invalid goalie eligibility identity or dates.");
    // Reuse all evidence identity/hash/cutoff checks by passing the target evidence
    // through the existing roster evidence slot below.
    if (row.evidence) additionalEvidence.push(row.evidence);
    if (!row.evidence || time(at) < time(row.effectiveFrom) || time(at) >= time(row.effectiveUntil)) return null;
    return row.eligible;
  }
  const targetEligible = eligibility(input.targetEligibility, input.cutoffAt);
  if (targetEligible !== true) reasons.push("unknown_or_ineligible_target");
  if (input.targetEligibility?.evidence
    && time(input.cutoffAt) - time(input.targetEligibility.evidence.capturedAt) > 86400000000) reasons.push("stale_target_eligibility");
  const kernelInput: SkaterParticipationInput = { ...input, version: "skater-participation-input-v1",
    history: { ...input.history, games: input.history.games.map(game => {
      const eligible = eligibility(game.eligibility, game.scheduledAt);
      if (game.occurred === true && eligible === null) reasons.push("unknown_dated_eligibility");
      return { ...game, eligible, eligibilityEvidence: game.eligibility?.evidence ?? null };
    }) } };
  const receipt = buildSkaterParticipationReceipt(kernelInput, issuance);
  if (input.targetEligibility?.evidence) buildSkaterParticipationReceipt({ ...kernelInput, rosterEvidence: input.targetEligibility.evidence }, issuance);
  const evidenceIdentities = new Map<string, string>();
  for (const source of [input.scheduleEvidence, input.rosterEvidence, input.history.scheduleEvidence, ...additionalEvidence,
    ...input.history.games.flatMap(game => game.outcomeEvidence ? [game.outcomeEvidence] : [])]) {
    if (evidenceIdentities.has(source.id) && evidenceIdentities.get(source.id) !== source.hash) throw new Error("Conflicting participation evidence identity.");
    evidenceIdentities.set(source.id, source.hash);
  }
  const combinedEvidence = [...new Set([...receipt.evidenceHashes, ...additionalEvidence.map(source => source.hash)])].sort();
  const allReasons = [...new Set([...receipt.reasons, ...reasons])];
  return { ...receipt, version: "modeled-goalie-participation-v1", methodVersion: GOALIE_PARTICIPATION_METHOD,
    inputHash: playerForecastSourcePayloadHash(input), evidenceHashes: combinedEvidence,
    probability: allReasons.length ? null : receipt.probability, reasons: allReasons,
    limitations: ["Experimental current-club eligible-opportunity goalie appearance frequency; calibration unavailable.",
      "Positive minutes include relief appearances; this is not a start probability or a confirmed lineup.",
      "Uses at most 20 eligible opportunities within a complete 60-day club frame; latest eligible game must be within 14 days.",
      "Explicit dated eligibility and positive, zero or verified nonappearance labels are required; missing rows are unknown.",
      "Assumes observed eligibility at cutoff continues; no injury, role, opponent or future roster-change adjustment.",
      "Source completeness requires independent release review; this is not future eligibility confirmation."] };
}

/** Call only after exact bundle release admission, never as automatic publication. */
export function goalieParticipationFromReceipt(receipt: GoalieParticipationReceipt | FrozenWindowGoalieParticipationReceipt,
  allowedUses: NonNullable<ContributionParticipation["allowedUses"]>): ContributionParticipation | null {
  if (receipt.probability === null) return null;
  return { ...receipt.scope, basis: "appearance", probability: receipt.probability,
    revisionId: `participation:${playerForecastSourcePayloadHash(receipt)}`, released: true, allowedUses: { ...allowedUses },
    cutoffAt: receipt.cutoffAt, issuedAt: receipt.issuedAt, expiresAt: receipt.expiresAt,
    model: { version: receipt.methodVersion, event: receipt.event, probabilityStatus: receipt.probabilityStatus,
      calibration: receipt.calibration, inputHash: receipt.inputHash, evidenceHashes: [...receipt.evidenceHashes],
      numerator: receipt.numerator, denominator: receipt.denominator, selectedGameIds: [...receipt.selectedGameIds],
      limitations: [...receipt.limitations] } };
}


export const FROZEN_WINDOW_GOALIE_PARTICIPATION_METHOD = "goalie-frozen-window-appearance-frequency-v1" as const;
export type FrozenWindowGoalieParticipationInput = Omit<FrozenWindowSkaterParticipationInput, "version" | "playerClass"> & {
  version: "goalie-frozen-window-participation-input-v1"; playerClass: "goalie";
};
export type FrozenWindowGoalieParticipationReceipt = Omit<FrozenWindowSkaterParticipationReceipt, "version" | "methodVersion"> & {
  version: "modeled-goalie-frozen-window-participation-v1";
  methodVersion: typeof FROZEN_WINDOW_GOALIE_PARTICIPATION_METHOD;
};
export function buildFrozenWindowGoalieParticipationReceipt(input: FrozenWindowGoalieParticipationInput,
  issuance: { issuedAt: string; expiresAt: string }): FrozenWindowGoalieParticipationReceipt {
  if (input?.version !== "goalie-frozen-window-participation-input-v1" || input.playerClass !== "goalie") {
    throw new Error("Invalid frozen-window goalie participation input.");
  }
  const receipt = buildFrozenWindowSkaterParticipationReceipt({ ...input,
    version: "skater-frozen-window-participation-input-v1", playerClass: "skater" }, issuance);
  return { ...receipt, version: "modeled-goalie-frozen-window-participation-v1", methodVersion: FROZEN_WINDOW_GOALIE_PARTICIPATION_METHOD,
    inputHash: playerForecastSourcePayloadHash(input), limitations: [...receipt.limitations,
      "Goalie positive minutes include relief; an eligible nonstarter remains an opportunity, never an inferred nonappearance.",
      "This is an appearance probability only; no start probability or confirmed lineup is supplied."] };
}
