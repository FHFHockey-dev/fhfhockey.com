import type { GoalieMembershipStint, GoalieStintWorkloadInput } from "./stintWorkload";
import { timestampMicros } from "../evidenceTime";

/** Normalized authoritative records, supplied by a separately reconciled producer, not fetched here. */
export type MembershipEvent = {
  evidenceId: string;
  source: "official_transaction" | "official_eligibility" | "roster_snapshot" | "appearance";
  sourceRecordId: string;
  sourceRevision: string;
  goalieId: number;
  fromTeam: string | null;
  toTeam: string | null;
  /** Exact effective instant, never the publication time or first appearance; null means uncertain. */
  effectiveAt: string | null;
  recordedAt: string;
};

export type MembershipCoverage = {
  evidenceId: string;
  sourceRecordId: string;
  sourceRevision: string;
  goalieId: number;
  seasonId: number;
  fromAt: string;
  throughAt: string;
  recordedAt: string;
  /** Producer attestation that membership, including no-team gaps, is reconciled over this interval. */
  complete: boolean;
};

export type MembershipStintClaim = {
  stintId: string;
  team: string;
  enteredBy: string;
  /** Ongoing is an affirmative claim covered by the coverage receipt, not a missing departure. */
  end: { kind: "departed"; exitedBy: string } | { kind: "ongoing" } | { kind: "unknown" };
};

export type GoalieMembershipLineageInput = {
  goalieId: number;
  scope: GoalieStintWorkloadInput["scope"];
  observedAt: string;
  coverage: MembershipCoverage | null;
  events: MembershipEvent[];
  stints: MembershipStintClaim[];
};

const unique = (values: string[]) => [...new Set(values)].sort();
function instant(value: string | null): number | null {
  const micros = value === null ? null : timestampMicros(value);
  // Existing workload arithmetic uses milliseconds. Never round a boundary across puck drop.
  return micros === null || micros % BigInt(1000) !== BigInt(0) ? null : Number(micros / BigInt(1000));
}
const nonempty = (value: string) => value.trim().length > 0;
const teamValid = (team: string | null) => team === null || /^[A-Z]{2,3}$/.test(team);

/**
 * Validates lineage rather than manufacturing membership from appearances/current roster.
 * This establishes internal contract consistency only: source authenticity and completeness
 * must be independently established by the producer. No as-issued or live-data claim is made.
 */
export function resolveGoalieMembershipLineage(input: GoalieMembershipLineageInput) {
  const from = instant(input.scope.fromAt), through = instant(input.scope.throughAt), observed = timestampMicros(input.observedAt);
  if (from === null || through === null || observed === null || from >= through || BigInt(through) * BigInt(1000) > observed
    || !Number.isSafeInteger(input.goalieId) || input.goalieId <= 0
    || !Number.isSafeInteger(input.scope.seasonId) || input.scope.seasonId <= 0
    || !Number.isSafeInteger(input.scope.gameType) || input.scope.gameType <= 0) throw new Error("Invalid membership scope.");
  if (new Set(input.events.map(e => e.evidenceId)).size !== input.events.length
    || new Set(input.stints.map(s => s.stintId)).size !== input.stints.length) throw new Error("Duplicate membership identity.");

  const coverage = input.coverage;
  const coverageFrom = coverage && instant(coverage.fromAt), coverageThrough = coverage && instant(coverage.throughAt);
  const coverageRecorded = coverage && timestampMicros(coverage.recordedAt);
  const coverageValid = coverage !== null && coverage.complete && coverage.goalieId === input.goalieId
    && coverage.seasonId === input.scope.seasonId && [coverage.evidenceId, coverage.sourceRecordId, coverage.sourceRevision].every(nonempty)
    && coverageFrom !== null && coverageThrough !== null && coverageRecorded !== null
    && coverageFrom <= from && coverageThrough >= through && BigInt(coverageThrough) * BigInt(1000) <= coverageRecorded && coverageRecorded <= observed
    && !input.events.some(e => e.evidenceId === coverage.evidenceId);
  const reasons: string[] = coverageValid ? [] : ["membership_coverage_unproven"];
  const sourceKeys = input.events.map(e => JSON.stringify([e.source, e.sourceRecordId, e.sourceRevision]));
  const duplicateSourceKeys = new Set(sourceKeys.filter((key, i) => sourceKeys.indexOf(key) !== i));
  if (duplicateSourceKeys.size) reasons.push("membership_source_record_duplicate");
  const eventById = new Map(input.events.map(event => [event.evidenceId, event]));
  const eventReasons = (id: string, team: string, direction: "enter" | "exit") => {
    const event = eventById.get(id);
    if (!event) return ["membership_event_missing"];
    const time = instant(event.effectiveAt), recorded = timestampMicros(event.recordedAt);
    return [
      ...(duplicateSourceKeys.has(JSON.stringify([event.source, event.sourceRecordId, event.sourceRevision])) ? ["membership_source_record_duplicate"] : []),
      ...(!["official_transaction", "official_eligibility"].includes(event.source) ? ["membership_source_not_authoritative"] : []),
      ...(![event.evidenceId, event.sourceRecordId, event.sourceRevision].every(nonempty) ? ["membership_source_revision_missing"] : []),
      ...(event.goalieId !== input.goalieId || !teamValid(event.fromTeam) || !teamValid(event.toTeam)
        || event.fromTeam === event.toTeam || (direction === "enter" ? event.toTeam : event.fromTeam) !== team ? ["membership_event_identity_mismatch"] : []),
      ...(time === null ? ["membership_effective_time_unknown"] : []),
      ...(recorded === null || recorded > observed || time !== null
        && (BigInt(time) * BigInt(1000) > observed || recorded !== null && BigInt(time) * BigInt(1000) > recorded)
        ? ["membership_event_clock_invalid"] : [])
    ];
  };

  const episodes = input.stints.map(claim => {
    const entry = eventById.get(claim.enteredBy);
    const exit = claim.end.kind === "departed" ? eventById.get(claim.end.exitedBy) : undefined;
    const issues = [
      ...(!nonempty(claim.stintId) || !teamValid(claim.team) ? ["membership_stint_identity_invalid"] : []),
      ...eventReasons(claim.enteredBy, claim.team, "enter"),
      ...(claim.end.kind === "departed" ? eventReasons(claim.end.exitedBy, claim.team, "exit") : []),
      ...(claim.end.kind === "unknown" ? ["membership_end_unknown"] : []),
      ...(claim.end.kind === "ongoing" && !coverageValid ? ["ongoing_membership_unproven"] : [])
    ];
    const start = instant(entry?.effectiveAt ?? null), end = instant(exit?.effectiveAt ?? null);
    if (start !== null && end !== null && start >= end) issues.push("membership_interval_invalid");
    return { claim, issues, start, end, evidenceIds: unique([claim.enteredBy, ...(claim.end.kind === "departed" ? [claim.end.exitedBy] : [])]) };
  });

  // Every supplied transition before the cutoff must be represented on both sides, including
  // trades before the lookback that establish membership within it. Do not drop the destination.
  for (const event of input.events) {
    const time = instant(event.effectiveAt);
    if (time !== null && time >= through) continue;
    if (event.fromTeam !== null && !episodes.some(e => e.claim.team === event.fromTeam && e.claim.end.kind === "departed" && e.claim.end.exitedBy === event.evidenceId)
      || event.toTeam !== null && !episodes.some(e => e.claim.team === event.toTeam && e.claim.enteredBy === event.evidenceId)) {
      reasons.push("membership_event_unassigned");
    }
  }
  for (let i = 0; i < episodes.length; i++) {
    const a = episodes[i];
    for (const b of episodes.slice(i + 1)) {
      if (a.start !== null && b.start !== null && a.issues.length === 0 && b.issues.length === 0
        && a.start < (b.end ?? Infinity) && b.start < (a.end ?? Infinity)) {
        reasons.push("membership_intervals_overlap");
      }
    }
  }
  const overlap = reasons.includes("membership_intervals_overlap");
  const stints = episodes.map(({ claim, issues, start, end, evidenceIds }) => {
    const known = issues.length === 0 && !overlap;
    return {
      stintId: claim.stintId, team: claim.team,
      fromAt: start === null ? null : new Date(start).toISOString(),
      untilAt: end === null ? null : new Date(end).toISOString(),
      boundaryStatus: known ? "verified" as const : "unknown" as const,
      evidenceIds, reasons: unique([...issues, ...(overlap ? ["membership_intervals_overlap"] : [])]),
      endKind: claim.end.kind
    };
  }).sort((a, b) => (a.fromAt ?? "~").localeCompare(b.fromAt ?? "~") || a.stintId.localeCompare(b.stintId));
  const allReasons = unique([...reasons, ...stints.flatMap(s => s.reasons)]);
  return {
    contract: "goalie-membership-lineage-v1" as const,
    goalieId: input.goalieId, scope: { ...input.scope }, observedAt: input.observedAt,
    basis: "current_recorded_history" as const,
    complete: allReasons.length === 0,
    reasons: allReasons,
    stints,
    evidenceIds: unique([...(coverage ? [coverage.evidenceId] : []), ...input.events.map(e => e.evidenceId)]),
    // Preserve immutable source coordinates and both clocks for later persistence/consumer audits.
    coverage: coverage ? { ...coverage } : null,
    events: input.events.map(e => ({ ...e })).sort((a, b) => a.evidenceId.localeCompare(b.evidenceId))
  };
}

export function membershipWorkloadFields(lineage: ReturnType<typeof resolveGoalieMembershipLineage>) {
  return {
    membershipComplete: lineage.complete,
    membershipEvidenceIds: lineage.evidenceIds,
    stints: lineage.stints.map((s): GoalieMembershipStint => ({
      stintId: s.stintId, team: s.team, fromAt: s.fromAt, untilAt: s.untilAt,
      boundaryStatus: s.boundaryStatus, evidenceIds: s.evidenceIds
    }))
  };
}
