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
export function goalieParticipationFromReceipt(receipt: GoalieParticipationReceipt | FrozenWindowGoalieParticipationReceipt | FrozenWindowGoalieStartReceipt,
  allowedUses: NonNullable<ContributionParticipation["allowedUses"]>): ContributionParticipation | null {
  if (receipt.probability === null) return null;
  return { ...receipt.scope, basis: receipt.event === "official_starter" ? "start" : "appearance", probability: receipt.probability,
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


export const FROZEN_WINDOW_GOALIE_START_METHOD = "goalie-frozen-window-start-frequency-v1" as const;
export type FrozenWindowGoalieStartInput = Omit<FrozenWindowGoalieParticipationInput, "version" | "history"> & {
  version: "goalie-frozen-window-start-input-v1";
  history: Omit<FrozenWindowGoalieParticipationInput["history"], "games"> & {
    /** Actual appearance labels remain separate. Starter flags are never converted into TOI labels. */
    games: Array<FrozenWindowGoalieParticipationInput["history"]["games"][number] & {
      officialStarter: boolean | null; starterEvidence: ParticipationEvidence | null;
    }>;
  };
};
export type FrozenWindowGoalieStartReceipt = Omit<FrozenWindowGoalieParticipationReceipt, "version" | "methodVersion" | "event"> & {
  version: "modeled-goalie-frozen-window-start-v1";
  methodVersion: typeof FROZEN_WINDOW_GOALIE_START_METHOD; event: "official_starter";
};

/** Distinct empirical starter event over the same validated eligible opportunities.
 * Requires real resolved appearance labels too; no fake TOI adapter is used. */
export function buildFrozenWindowGoalieStartReceipt(input: FrozenWindowGoalieStartInput,
  issuance: { issuedAt: string; expiresAt: string }): FrozenWindowGoalieStartReceipt {
  if (input?.version !== "goalie-frozen-window-start-input-v1" || input.playerClass !== "goalie") {
    throw new Error("Invalid frozen-window goalie start input.");
  }
  const receipt = buildFrozenWindowGoalieParticipationReceipt({ ...input, version: "goalie-frozen-window-participation-input-v1" },
    { issuedAt: issuance.issuedAt, expiresAt: issuance.expiresAt });
  const identities = new Map<string, string>();
  const evidence = [input.scheduleEvidence, input.rosterEvidence, input.history.scheduleEvidence,
    ...(input.targetEligibility?.evidence ? [input.targetEligibility.evidence] : []),
    ...input.history.games.flatMap(game => [game.eligibility?.evidence, game.outcomeEvidence, game.starterEvidence].filter((row): row is ParticipationEvidence => !!row))];
  for (const row of evidence) {
    if (!row || typeof row.id !== "string" || !row.id.trim() || !/^[a-f0-9]{64}$/.test(row.hash)
      || !Number.isFinite(time(row.availableAt)) || !Number.isFinite(time(row.capturedAt))
      || time(row.availableAt) > time(input.cutoffAt) || time(row.capturedAt) > time(input.cutoffAt)
      || identities.has(row.id) && identities.get(row.id) !== row.hash) throw new Error("Invalid or conflicting start-label evidence.");
    identities.set(row.id, row.hash);
  }
  for (const game of input.history.games) {
    if (game.officialStarter != null && typeof game.officialStarter !== "boolean") throw new Error("Invalid explicit starter label.");
    if (game.starterEvidence && (time(game.starterEvidence.availableAt) < time(game.scheduledAt)
      || time(game.starterEvidence.capturedAt) < time(game.scheduledAt))) throw new Error("Historical starter evidence predates its game.");
  }
  const selected = input.history.games.filter(game => receipt.selectedGameIds.includes(game.gameId));
  const reasons = [...receipt.reasons];
  if (selected.some(game => game.officialStarter == null || !game.starterEvidence)) reasons.push("unresolved_official_starter_label");
  const numerator = selected.filter(game => game.officialStarter === true).length;
  return { ...receipt, version: "modeled-goalie-frozen-window-start-v1", methodVersion: FROZEN_WINDOW_GOALIE_START_METHOD,
    event: "official_starter", inputHash: playerForecastSourcePayloadHash(input),
    evidenceHashes: [...new Set([...receipt.evidenceHashes, ...evidence.map(row => row.hash)])].sort(),
    numerator, probability: reasons.length ? null : numerator / receipt.denominator, reasons: [...new Set(reasons)],
    limitations: ["Experimental frozen Sep29–Oct12 America/New_York eligible-opportunity official starter frequency; calibration unavailable.",
      "Uses original explicit boolean starter labels over the same independently complete dated-eligibility frame, including nonstarts.",
      "Additional real appearance evidence is required by the reused frame validator; unknown appearance or starter labels withhold this estimate.",
      "A nonstart can be a positive-minute relief appearance; this start model never changes appearance-conditioned W, SV, GA, SA, minutes or SO means.",
      "Original source clocks remain unchanged; no omitted later game, missing row or bench status becomes a negative.",
      "Assumes fresh cutoff eligibility continues; no injury, role, opponent or future roster-change adjustment.",
      "Finite endpoint frequencies zero and one are uncalibrated model estimates, not confirmed starts or credited minimum progress."] };
}
