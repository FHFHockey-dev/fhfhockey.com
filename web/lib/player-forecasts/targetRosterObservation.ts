import { createHash } from "node:crypto";
import { timestampMicros } from "../projections/evidenceTime";
import type { ContributionGame } from "./contributions";
import type { ParticipationEvidence } from "./modeledSkaterParticipation";

export const ROSTER_CONTINUATION_ASSUMPTION = "fresh-official-season-roster-continuation-v1" as const;
export type TargetRosterObservation = {
  playerId: number; nhlPlayerId: number; teamId: number; seasonId: number;
  listed: boolean | null; sourceKind: "official_season_roster";
  evidence: ParticipationEvidence;
  knownConflict: boolean | null;
  continuationAssumptionVersion: typeof ROSTER_CONTINUATION_ASSUMPTION;
};
const time = (value: string) => timestampMicros(value);

/** Observation is a labeled continuation proxy, never a legally effective interval. */
export function rosterObservationReasons(observation: TargetRosterObservation | null, scope: ContributionGame,
  cutoffAt: string): string[] {
  if (!observation) return ["missing_target_roster_observation"];
  const evidence = observation.evidence, cutoff = time(cutoffAt), observed = time(evidence?.availableAt), captured = time(evidence?.capturedAt);
  if (observation.playerId !== scope.playerId || observation.nhlPlayerId !== scope.nhlPlayerId
    || observation.teamId !== scope.teamId || observation.seasonId !== scope.seasonId
    || observation.sourceKind !== "official_season_roster" || observation.continuationAssumptionVersion !== ROSTER_CONTINUATION_ASSUMPTION
    || ![true, false, null].includes(observation.listed) || ![true, false, null].includes(observation.knownConflict)) {
    throw new Error("Invalid target roster observation identity or assumption.");
  }
  if (!evidence || typeof evidence.id !== "string" || !evidence.id.trim() || !/^[a-f0-9]{64}$/.test(evidence.hash)
    || cutoff === null || observed === null || captured === null || observed > captured || captured > cutoff) {
    throw new Error("Invalid target roster observation evidence or clock.");
  }
  const reasons: string[] = [];
  if (cutoff - captured > BigInt(24 * 60 * 60 * 1_000_000)) reasons.push("stale_target_roster_observation");
  if (observation.listed !== true) reasons.push(observation.listed === false ? "not_listed_in_target_roster_observation" : "unknown_target_roster_observation");
  if (observation.knownConflict === true) reasons.push("known_current_roster_conflict");
  return reasons;
}

/** Offline original-byte verification; this does not turn a season roster into legal eligibility. */
export function targetRosterObservationFromReceipt(input: {
  playerId: number; nhlPlayerId: number; teamId: number; seasonId: number; teamAbbreviation: string;
  knownConflict: boolean | null; cutoffAt: string;
  receipt: { url: string; capturedAt: string; bodySha256: string; rawBody: string };
}): TargetRosterObservation {
  const { receipt } = input, captured = time(receipt?.capturedAt), cutoff = time(input.cutoffAt);
  const season = String(input.seasonId);
  if (![input.playerId, input.nhlPlayerId, input.teamId].every(value => Number.isSafeInteger(value) && value > 0)
    || !/^\d{8}$/.test(season) || Number(season.slice(0, 4)) + 1 !== Number(season.slice(4))
    || !/^[A-Z]{2,4}$/.test(input.teamAbbreviation) || ![true, false, null].includes(input.knownConflict)
    || receipt?.url !== `https://api-web.nhle.com/v1/roster/${input.teamAbbreviation}/${input.seasonId}`
    || typeof receipt.rawBody !== "string" || !receipt.rawBody.length || Buffer.byteLength(receipt.rawBody) > 1024 * 1024
    || !/^[a-f0-9]{64}$/.test(receipt.bodySha256) || createHash("sha256").update(receipt.rawBody, "utf8").digest("hex") !== receipt.bodySha256
    || captured === null || cutoff === null || captured > cutoff) throw new Error("Invalid original official roster receipt scope, hash or clock.");
  const body = JSON.parse(receipt.rawBody);
  if (!body || typeof body !== "object" || Array.isArray(body)
    || body.teamId != null && body.teamId !== input.teamId
    || body.teamAbbrev != null && body.teamAbbrev !== input.teamAbbreviation
    || body.season != null && Number(body.season) !== input.seasonId
    || body.seasonId != null && Number(body.seasonId) !== input.seasonId) throw new Error("Official roster payload conflicts with declared club/season.");
  const ids: number[] = [];
  for (const group of ["forwards", "defensemen", "goalies"]) {
    const rows = body[group];
    if (!Array.isArray(rows) || rows.length > 100) throw new Error("Official roster population is incomplete or unbounded.");
    for (const row of rows) {
      if (!row || !Number.isSafeInteger(row.id) || row.id <= 0 || ids.includes(row.id)) throw new Error("Official roster identity is missing or conflicting.");
      ids.push(row.id);
    }
  }
  if (!ids.length || ids.length > 100) throw new Error("Official roster population is empty or unbounded.");
  return { playerId: input.playerId, nhlPlayerId: input.nhlPlayerId, teamId: input.teamId, seasonId: input.seasonId,
    listed: ids.includes(input.nhlPlayerId), sourceKind: "official_season_roster", knownConflict: input.knownConflict,
    continuationAssumptionVersion: ROSTER_CONTINUATION_ASSUMPTION,
    evidence: { id: `http:${receipt.bodySha256}`, hash: receipt.bodySha256,
      availableAt: receipt.capturedAt, capturedAt: receipt.capturedAt } };
}
