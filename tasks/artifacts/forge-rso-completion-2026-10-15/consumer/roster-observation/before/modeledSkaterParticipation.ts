import { playerForecastSourcePayloadHash } from "./sourceSnapshot";
import type { ContributionGame, ContributionParticipation } from "./contributions";
import { timestampMicros } from "../projections/evidenceTime";

export const SKATER_PARTICIPATION_METHOD = "skater-participation-frequency-v1" as const;
const DAY = 86400000000;
export type ParticipationEvidence = { id: string; hash: string; availableAt: string; capturedAt: string };
export type SkaterParticipationInput = {
  version: "skater-participation-input-v1";
  scope: ContributionGame;
  cutoffAt: string;
  scheduleEvidence: ParticipationEvidence;
  rosterEvidence: ParticipationEvidence;
  history: {
    /** Complete independently captured current-club regular-season schedule, not appearance rows. */
    complete: boolean; windowStartAt: string; scheduleEvidence: ParticipationEvidence;
    games: Array<{
      gameId: number; teamId: number; scheduledAt: string;
      occurred: boolean | null; eligible: boolean | null;
      positiveMinutes: boolean | null;
      resolution: "positive_toi" | "explicit_zero_toi" | "complete_official_nonappearance" | null;
      eligibilityEvidence: ParticipationEvidence | null;
      outcomeEvidence: ParticipationEvidence | null;
    }>;
  };
};
export type SkaterParticipationReceipt = {
  version: "modeled-skater-participation-v1";
  methodVersion: typeof SKATER_PARTICIPATION_METHOD;
  scope: ContributionGame; cutoffAt: string; issuedAt: string; expiresAt: string;
  inputHash: string; evidenceHashes: string[];
  probability: number | null; numerator: number; denominator: number; selectedGameIds: number[];
  probabilityStatus: "uncalibrated_model"; calibration: "unavailable"; event: "positive_minutes";
  reasons: string[]; limitations: string[];
};
const time = (value: string) => { const parsed = timestampMicros(value); return parsed === null ? NaN : Number(parsed); };
const positiveId = (value: number) => Number.isSafeInteger(value) && value > 0;
const nonempty = (value: string) => typeof value === "string" && value.trim().length > 0;
const hash = (value: string) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const label = (value: unknown) => value === null || typeof value === "boolean";

/** Pure finite baseline. Source authenticity/completeness must be reviewed before release.
 * No outcome acquisition, fitting, private research input, or participation confirmation. */
export function buildSkaterParticipationReceipt(input: SkaterParticipationInput,
  issuance: { issuedAt: string; expiresAt: string }): SkaterParticipationReceipt {
  return buildSkaterParticipationKernel(input, issuance);
}

function buildSkaterParticipationKernel(input: SkaterParticipationInput,
  issuance: { issuedAt: string; expiresAt: string },
  frame?: { start: number; end: number; additionalEvidence: ParticipationEvidence[] }): SkaterParticipationReceipt {
  const scope = input?.scope, cutoff = time(input?.cutoffAt), issued = time(issuance.issuedAt), expiry = time(issuance.expiresAt);
  const season = String(scope?.seasonId);
  const historyStart = frame?.start ?? cutoff - 60 * DAY, historyEnd = frame?.end ?? cutoff;
  if (input?.version !== "skater-participation-input-v1" || !scope
    || ![scope.playerId, scope.nhlPlayerId, scope.teamId, scope.gameId].every(positiveId)
    || !/^\d{8}$/.test(season) || Number(season.slice(4)) !== Number(season.slice(0, 4)) + 1
    || !nonempty(scope.scheduleRevision) || !nonempty(scope.rosterRevision)
    || !Number.isFinite(cutoff) || !Number.isFinite(issued) || !Number.isFinite(expiry)
    || cutoff > issued || issued - cutoff > DAY || issued >= time(scope.scheduledAt)
    || !Number.isFinite(time(scope.scheduledAt)) || expiry <= issued || expiry > issued + DAY
    || time(scope.scheduledAt) < time(`${season.slice(0, 4)}-07-01T00:00:00Z`)
    || time(scope.scheduledAt) >= time(`${season.slice(4)}-07-01T00:00:00Z`)
    || expiry > time(scope.scheduledAt)
    || !input.history || typeof input.history.complete !== "boolean"
    || !Array.isArray(input.history.games) || input.history.games.length > 64
    || time(input.history.windowStartAt) !== historyStart) throw new Error("Invalid modeled participation scope or issuance.");
  const evidence = [input.scheduleEvidence, input.rosterEvidence, input.history.scheduleEvidence, ...(frame?.additionalEvidence ?? [])];
  for (const game of input.history.games) {
    if (!positiveId(game.gameId) || game.gameId === scope.gameId || game.teamId !== scope.teamId
      || !Number.isFinite(time(game.scheduledAt)) || time(game.scheduledAt) < historyStart
      || time(game.scheduledAt) >= historyEnd || !label(game.occurred) || !label(game.eligible)
      || time(game.scheduledAt) < time(`${season.slice(0, 4)}-07-01T00:00:00Z`)
      || !label(game.positiveMinutes)
      || ![null, "positive_toi", "explicit_zero_toi", "complete_official_nonappearance"].includes(game.resolution)) {
      throw new Error("Invalid participation history opportunity.");
    }
    if (game.positiveMinutes === true && (game.occurred === false || game.eligible === false)) {
      throw new Error("Conflicting participation history labels.");
    }
    if (game.outcomeEvidence && (time(game.outcomeEvidence.availableAt) < time(game.scheduledAt)
      || time(game.outcomeEvidence.capturedAt) < time(game.scheduledAt))) {
      throw new Error("Historical outcome evidence predates its game.");
    }
    if (game.eligibilityEvidence) evidence.push(game.eligibilityEvidence);
    if (game.outcomeEvidence) evidence.push(game.outcomeEvidence);
  }
  if (new Set(input.history.games.map(game => game.gameId)).size !== input.history.games.length) {
    throw new Error("Duplicate participation history opportunity.");
  }
  for (const source of evidence) if (!source || !nonempty(source.id) || !hash(source.hash)
    || !Number.isFinite(time(source.availableAt)) || !Number.isFinite(time(source.capturedAt))
    || time(source.availableAt) > cutoff || time(source.capturedAt) > cutoff) {
    throw new Error("Invalid or future participation evidence.");
  }
  const identities = new Map<string, string>();
  for (const source of evidence) {
    const previous = identities.get(source.id);
    if (previous && previous !== source.hash) throw new Error("Conflicting participation evidence identity.");
    identities.set(source.id, source.hash);
  }
  const reasons: string[] = [];
  if (!input.history.complete) reasons.push("incomplete_opportunity_frame");
  if ([input.scheduleEvidence, input.rosterEvidence, input.history.scheduleEvidence]
    .some(source => cutoff - time(source.capturedAt) > DAY)) reasons.push("stale_scope_evidence");
  if (input.history.games.some(game => game.occurred === null
    || game.occurred && (game.eligible === null || !game.eligibilityEvidence))) reasons.push("unknown_eligibility_or_occurrence");
  const selected = input.history.games.filter(game => game.occurred && game.eligible)
    .sort((a, b) => time(b.scheduledAt) - time(a.scheduledAt) || b.gameId - a.gameId).slice(0, 20);
  if (!selected.length) reasons.push("no_eligible_history");
  if (selected.length && cutoff - time(selected[0].scheduledAt) > 14 * DAY) reasons.push("stale_eligible_history");
  if (selected.some(game => !game.outcomeEvidence || game.positiveMinutes === null
    || game.positiveMinutes && game.resolution !== "positive_toi"
    || game.positiveMinutes === false && !["explicit_zero_toi", "complete_official_nonappearance"].includes(game.resolution ?? ""))) {
    reasons.push("unresolved_participation_label");
  }
  const numerator = selected.filter(game => game.positiveMinutes === true).length;
  return {
    version: "modeled-skater-participation-v1", methodVersion: SKATER_PARTICIPATION_METHOD,
    scope: { ...scope }, cutoffAt: input.cutoffAt, ...issuance,
    inputHash: playerForecastSourcePayloadHash(input), evidenceHashes: [...new Set(evidence.map(source => source.hash))].sort(),
    probability: reasons.length ? null : numerator / selected.length,
    numerator, denominator: selected.length, selectedGameIds: selected.map(game => game.gameId),
    probabilityStatus: "uncalibrated_model", calibration: "unavailable", event: "positive_minutes", reasons,
    limitations: ["Experimental current-club eligible-opportunity frequency; calibration unavailable.",
      "Uses at most 20 eligible games within 60 days; eligible history must include a game within 14 days.",
      "Estimates positive minutes given the scheduled game occurs; not dressing, official credit, or lineup confirmation.",
      "No injury, role, opponent or future roster-change adjustment; endpoint estimates are not confirmed absence or appearance.",
      "Positive-minute conditioning excludes penalty-only zero-minute PIM; no all-appearance PIM claim."],
  };
}

export function participationFromReceipt(receipt: SkaterParticipationReceipt | FrozenWindowSkaterParticipationReceipt,
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


export const FROZEN_WINDOW_SKATER_PARTICIPATION_METHOD = "skater-frozen-window-appearance-frequency-v1" as const;
export type DatedParticipationEligibility = {
  playerId: number; nhlPlayerId: number; teamId: number; eligible: boolean | null;
  effectiveFrom: string; effectiveUntil: string; evidence: ParticipationEvidence;
};
export type FrozenWindowSkaterParticipationInput = Omit<SkaterParticipationInput, "version" | "history"> & {
  version: "skater-frozen-window-participation-input-v1"; playerClass: "skater";
  targetEligibility: DatedParticipationEligibility | null;
  history: Omit<SkaterParticipationInput["history"], "games"> & {
    /** Frozen approved Sep29–Oct12 America/New_York games, half-open; never a fabricated current frame. */
    windowEndAt: string;
    games: Array<Omit<SkaterParticipationInput["history"]["games"][number], "eligible" | "eligibilityEvidence"> & {
      eligibility: DatedParticipationEligibility | null;
    }>;
  };
};
export type FrozenWindowSkaterParticipationReceipt = Omit<SkaterParticipationReceipt, "version" | "methodVersion"> & {
  version: "modeled-skater-frozen-window-participation-v1";
  methodVersion: typeof FROZEN_WINDOW_SKATER_PARTICIPATION_METHOD;
  historyStartAt: string; historyEndAt: string;
};

/** Explicit frozen-history baseline; actual capture/cutoff clocks are never backdated. */
export function buildFrozenWindowSkaterParticipationReceipt(input: FrozenWindowSkaterParticipationInput,
  issuance: { issuedAt: string; expiresAt: string }): FrozenWindowSkaterParticipationReceipt {
  const cutoff = time(input?.cutoffAt), start = time(input?.history?.windowStartAt), end = time(input?.history?.windowEndAt);
  const year = String(input?.scope?.seasonId).slice(0, 4);
  if (input?.version !== "skater-frozen-window-participation-input-v1" || input.playerClass !== "skater"
    || !input.scope || !Array.isArray(input.history?.games)
    || !Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(cutoff)
    || start !== time(`${year}-09-29T04:00:00Z`) || end !== time(`${year}-10-13T04:00:00Z`)
    || end - start !== 14 * DAY || cutoff < end || cutoff - end > 14 * DAY) {
    throw new Error("Invalid frozen 14-day participation frame or lag.");
  }
  const additionalEvidence: ParticipationEvidence[] = [], reasons: string[] = [];
  const eligibleAt = (row: DatedParticipationEligibility | null, at: string): boolean | null => {
    if (!row) return null;
    if (row.playerId !== input.scope.playerId || row.nhlPlayerId !== input.scope.nhlPlayerId
      || row.teamId !== input.scope.teamId || !label(row.eligible)
      || !Number.isFinite(time(row.effectiveFrom)) || !Number.isFinite(time(row.effectiveUntil))
      || time(row.effectiveFrom) >= time(row.effectiveUntil)) throw new Error("Invalid frozen-window eligibility identity or interval.");
    if (row.evidence) additionalEvidence.push(row.evidence);
    return row.evidence && time(at) >= time(row.effectiveFrom) && time(at) < time(row.effectiveUntil) ? row.eligible : null;
  };
  if (eligibleAt(input.targetEligibility, input.cutoffAt) !== true) reasons.push("unknown_or_ineligible_target");
  if (input.targetEligibility?.evidence && cutoff - time(input.targetEligibility.evidence.capturedAt) > DAY) reasons.push("stale_target_eligibility");
  const mapped: SkaterParticipationInput = { ...input, version: "skater-participation-input-v1",
    history: { ...input.history, games: input.history.games.map(game => ({ ...game,
      eligible: eligibleAt(game.eligibility, game.scheduledAt), eligibilityEvidence: game.eligibility?.evidence ?? null })) } };
  const receipt = buildSkaterParticipationKernel(mapped, issuance, { start, end, additionalEvidence });
  const allReasons = [...new Set([...receipt.reasons, ...reasons])];
  return { ...receipt, version: "modeled-skater-frozen-window-participation-v1", methodVersion: FROZEN_WINDOW_SKATER_PARTICIPATION_METHOD,
    historyStartAt: input.history.windowStartAt, historyEndAt: input.history.windowEndAt,
    inputHash: playerForecastSourcePayloadHash(input), probability: allReasons.length ? null : receipt.probability, reasons: allReasons,
    limitations: ["Experimental frozen Sep29–Oct12 America/New_York eligible-opportunity appearance frequency; calibration unavailable.",
      "Historical frame ends independently of the actual current capture/cutoff; omitted later games are not observed negatives.",
      "Requires complete independently supported 14-day club schedule, dated eligibility and explicit positive, zero or official nonappearance labels.",
      "Frozen history may lag cutoff by at most 14 days; latest eligible game must also be within 14 days of cutoff.",
      "Assumes freshly observed eligibility at cutoff continues; no injury, role, opponent or future roster adjustment.",
      "Finite endpoint frequencies zero and one are model estimates, never confirmation of future absence or appearance.",
      "Positive-minute conditioning excludes penalty-only zero-minute PIM; no all-appearance PIM claim."] };
}
