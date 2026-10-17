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
  const scope = input?.scope, cutoff = time(input?.cutoffAt), issued = time(issuance.issuedAt), expiry = time(issuance.expiresAt);
  const season = String(scope?.seasonId);
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
    || time(input.history.windowStartAt) !== cutoff - 60 * DAY) throw new Error("Invalid modeled participation scope or issuance.");
  const evidence = [input.scheduleEvidence, input.rosterEvidence, input.history.scheduleEvidence];
  for (const game of input.history.games) {
    if (!positiveId(game.gameId) || game.gameId === scope.gameId || game.teamId !== scope.teamId
      || !Number.isFinite(time(game.scheduledAt)) || time(game.scheduledAt) < cutoff - 60 * DAY
      || time(game.scheduledAt) >= cutoff || !label(game.occurred) || !label(game.eligible)
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

export function participationFromReceipt(receipt: SkaterParticipationReceipt,
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
