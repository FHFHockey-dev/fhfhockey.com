import { createHash } from "node:crypto";
import type { BoardAssertion, BoardConflict, DailyBoardEvidence } from "./dailyBoardEvidence";
import { timestampMicros } from "./evidenceTime";
import { skaterParticipationFromEvidence } from "./starterBoardScoring";

export type PrivateParticipationTarget = {
  canonicalPlayerId: number; nhlPlayerId: number; teamId: number;
  gameId: number; seasonId: number; gameStartsAt: string;
};

/** Original accepted source/child receipts, supplied by their owner. This module
 * neither acquires sources nor interprets raw text as a confirmed appearance. */
export type PrivateParticipationSource = {
  sourceId: string; sourceKey: string; sourceUrl: string;
  originalBody: string; bodySha256: string; parserVersion: string;
  publishedAt: string | null; receivedAt: string | null;
  createdAt: string | null; acceptedAt: string | null; accepted: boolean;
  expiresAt: string | null; authoritativeValidUntil: string | null;
};
export type PrivateParticipationFact = {
  evidenceId: string; canonicalPlayerId: number; seasonId: number;
  gameId: number; teamId: number; source: PrivateParticipationSource;
  assignment: {
    id: string; snapshotId: string; playerId: number;
    unitType: string; unitNumber: number | null; status: string; createdAt: string | null;
  };
};
export type PrivateParticipationConflict = {
  row: BoardConflict;
  /** Exact observations involved in this retained conflict; never inferred. */
  evidenceIds: string[];
  source: PrivateParticipationSource;
};
export type PrivateParticipationIntake = {
  target: PrivateParticipationTarget; cutoffAt: string; evaluatedAt: string;
  evidenceObservedThroughAt: string;
  facts: PrivateParticipationFact[]; conflicts: PrivateParticipationConflict[];
};

const nonempty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const positiveId = (value: number) => Number.isSafeInteger(value) && value > 0;
const time = (value: string | null | undefined) => typeof value === "string" ? timestampMicros(value) : null;

function sourceProblems(source: PrivateParticipationSource, cutoff: bigint): string[] {
  const problems: string[] = [];
  if (!source || ![source.sourceId, source.sourceKey, source.sourceUrl, source.parserVersion].every(nonempty)
    || !/^https?:\/\//.test(source.sourceUrl)) return ["missing_source_identity"];
  if (!nonempty(source.originalBody) || !/^[a-f0-9]{64}$/.test(source.bodySha256)
    || createHash("sha256").update(source.originalBody, "utf8").digest("hex") !== source.bodySha256) problems.push("source_body_hash_mismatch");
  const clocks = [source.publishedAt, source.receivedAt, source.createdAt, source.acceptedAt].map(time);
  if (clocks.some(value => value === null)) problems.push("missing_or_invalid_source_clock");
  else {
    const [published, received, created, accepted] = clocks as bigint[];
    if (clocks.some(value => value! > cutoff)) problems.push("source_not_known_by_cutoff");
    if (published > received || received > created || created > accepted) problems.push("source_clock_order_invalid");
  }
  if (source.accepted !== true) problems.push("source_not_accepted");
  return problems;
}

function assertion(fact: PrivateParticipationFact): BoardAssertion | null {
  const child = fact.assignment, source = fact.source;
  const base = { gameId: fact.gameId, teamId: fact.teamId, playerId: child.playerId,
    evidenceId: fact.evidenceId, sourceKey: source.sourceKey, sourceUrl: source.sourceUrl,
    publishedAt: source.publishedAt!, receivedAt: source.receivedAt! };
  if (["forward_line", "defense_pair"].includes(child.unitType) && Number.isSafeInteger(child.unitNumber) && child.unitNumber! > 0) {
    return { ...base, dimension: "ev", value: `${child.unitType === "forward_line" ? "L" : "D"}${child.unitNumber}`,
      confirmed: child.status === "confirmed" };
  }
  if (child.unitType === "scratch" || child.unitType === "injury") {
    const out = child.status === "ruled_out" && (child.unitType === "scratch" || source.parserVersion === "line-source-v2");
    return { ...base, dimension: "availability", value: out ? "out"
      : child.unitType === "injury" && source.parserVersion === "line-source-v2" && child.status === "confirmed" ? "return" : "uncertain",
    confirmed: out || child.unitType === "injury" && source.parserVersion === "line-source-v2" && child.status === "confirmed" };
  }
  return null; // PP, roster membership and omitted players never establish appearance.
}

/** Private evidence-policy scenario only. It cannot create a GameForecast,
 * calibrated p_play, issued context, public admission or current absence-of-news claim. */
export function validatePrivateParticipationScenario(input: PrivateParticipationIntake) {
  const { target, cutoffAt, evaluatedAt, evidenceObservedThroughAt, facts, conflicts } = input;
  const cutoff = time(cutoffAt), evaluation = time(evaluatedAt), observed = time(evidenceObservedThroughAt), start = time(target.gameStartsAt);
  const problems: string[] = [];
  const selected = new Set<string>();
  const removed = new Set<string>();
  const validity: Array<{ evidenceId: string; validUntil: string }> = [];
  if (![target.canonicalPlayerId, target.nhlPlayerId, target.teamId, target.gameId, target.seasonId].every(positiveId)) problems.push("invalid_target_identity");
  if (cutoff === null || evaluation === null || observed === null || start === null
    || cutoff > observed || observed > evaluation || cutoff > evaluation || evaluation >= start) problems.push("invalid_scenario_clock_scope");
  if (!Array.isArray(facts) || !Array.isArray(conflicts)) problems.push("invalid_evidence_collection");
  else if (cutoff !== null && evaluation !== null && start !== null) {
    const childIds = new Set<string>();
    for (const fact of facts) {
      if (fact.canonicalPlayerId !== target.canonicalPlayerId || fact.seasonId !== target.seasonId
        || fact.gameId !== target.gameId || fact.teamId !== target.teamId || fact.assignment.playerId !== target.nhlPlayerId) problems.push("evidence_identity_mismatch");
      if (!nonempty(fact.evidenceId) || !nonempty(fact.assignment.id) || fact.assignment.snapshotId !== fact.evidenceId
        || childIds.has(fact.assignment.id)) problems.push("invalid_child_assignment_binding");
      childIds.add(fact.assignment.id);
      problems.push(...sourceProblems(fact.source, cutoff));
      const childAt = time(fact.assignment.createdAt), parentAt = time(fact.source.createdAt);
      if (childAt === null || parentAt === null || childAt < parentAt || childAt > cutoff) problems.push("child_not_known_by_cutoff");
    }
    const ids = new Set(facts.map(fact => fact.evidenceId));
    const reviewKeys = new Set<string>();
    for (const conflict of conflicts) {
      const row = conflict.row;
      if (row.game_id !== target.gameId || row.team_id !== target.teamId
        || row.player_id !== null && row.player_id !== target.nhlPlayerId || row.conflict_type !== "lineup") problems.push("conflict_identity_mismatch");
      const key = row.conflict_key ?? row.id;
      // Multiple versions need an owner's explicit disposition, never a favorable pick.
      if (!nonempty(key) || reviewKeys.has(key)) problems.push("conflict_version_unresolved");
      reviewKeys.add(key);
      problems.push(...sourceProblems(conflict.source, cutoff));
      checkValidity(conflict.source, row.id, evaluation);
      if ([row.detected_at, row.created_at].some(value => time(value) === null || time(value)! > cutoff)) problems.push("conflict_not_known_by_cutoff");
      if (!Array.isArray(conflict.evidenceIds) || !conflict.evidenceIds.length
        || new Set(conflict.evidenceIds).size !== conflict.evidenceIds.length || conflict.evidenceIds.some(id => !ids.has(id))) {
        problems.push("conflict_evidence_binding_missing"); continue;
      }
      const resolutions = row.player_forecast_conflict_resolutions;
      if (!Array.isArray(resolutions) || resolutions.length !== 1) { problems.push("conflict_resolution_missing_or_ambiguous"); continue; }
      const resolution = resolutions[0];
      if (resolution.action !== "select_observation" || !resolution.selected_observation_id
        || !conflict.evidenceIds.includes(resolution.selected_observation_id)
        || [resolution.resolved_at, resolution.created_at].some(value => time(value) === null || time(value)! > cutoff)
        || time(resolution.resolved_at)! < time(row.detected_at)!
        || time(resolution.created_at)! < time(resolution.resolved_at)!
        || time(resolution.created_at)! < time(row.created_at)!
        || time(conflict.source.acceptedAt)! < time(resolution.created_at)!) {
        problems.push("conflict_resolution_not_applicable"); continue;
      }
      selected.add(resolution.selected_observation_id);
      for (const id of conflict.evidenceIds) if (id !== resolution.selected_observation_id) removed.add(id);
    }
    if ([...selected].some(id => removed.has(id))) problems.push("contradictory_supersession_receipts");
    const active = facts.filter(fact => !removed.has(fact.evidenceId));
    const assertions: BoardAssertion[] = [];
    for (const fact of active) {
      const candidate = assertion(fact);
      if (!candidate) continue;
      if (candidate.dimension === "ev" && !candidate.confirmed || candidate.value === "uncertain") problems.push("participation_applicability_uncertain");
      checkValidity(fact.source, fact.evidenceId, evaluation);
      assertions.push(candidate);
    }
    if (assertions.some(item => item.dimension === "availability" && item.value === "out")
      && assertions.some(item => item.dimension === "availability" && item.value === "return")) problems.push("exclusion_return_supersession_unresolved");
    const evidence: DailyBoardEvidence = { informationCutoffAt: cutoffAt, assertions, conflicts: [] };
    const reduced = skaterParticipationFromEvidence(evidence, { gameId: target.gameId, teamId: target.teamId, playerId: target.nhlPlayerId });
    if (!reduced) problems.push("confirmed_participation_missing_or_conflicting");
    return result(problems.length ? null : reduced, evidence);
  }
  return result(null, { informationCutoffAt: cutoffAt, assertions: [], conflicts: [] });

  function checkValidity(source: PrivateParticipationSource, evidenceId: string, evaluationAt: bigint) {
    const limits = [source.expiresAt, source.authoritativeValidUntil].filter(value => value !== null);
    if (!limits.length || limits.some(value => time(value) === null)) { problems.push("source_validity_unknown"); return; }
    const earliest = [...limits, target.gameStartsAt].reduce((a, b) => time(a)! <= time(b)! ? a : b);
    validity.push({ evidenceId, validUntil: earliest });
    if (time(earliest)! <= evaluationAt) problems.push("source_expired_at_evaluation");
  }

  function result(reduced: ReturnType<typeof skaterParticipationFromEvidence>, evidence: DailyBoardEvidence) {
    return {
      version: "private-participation-scenario-v1" as const,
      classification: "private_confirmed_participation_as_of_cutoff_scenario" as const,
      status: reduced ? "READY" as const : "BLOCKED" as const,
      target, cutoffAt, evaluatedAt, evidenceObservedThroughAt,
      evidencePolicy: "confirmed_evidence_0_or_1_not_calibrated_p_play" as const,
      indicator: reduced ? reduced.probability as 0 | 1 : null,
      appearanceProbability: null, calibratedProbability: false as const,
      sourceValidity: validity, evidenceIds: reduced?.evidenceIds ?? [],
      blockReasons: [...new Set(problems)], validatedEvidence: reduced ? evidence : null,
      retainedFacts: facts, retainedConflicts: conflicts,
      currentAbsenceOfNewsVerified: false as const,
      notReleasedGameForecast: true as const, publicAdmissionAllowed: false as const,
      limitation: "Applies only to supplied accepted receipts through evidenceObservedThroughAt; dressing/game occurrence and predictive quality remain uncalibrated.",
    };
  }
}
