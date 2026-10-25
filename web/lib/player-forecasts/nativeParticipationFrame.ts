import { timestampMicros } from "../projections/evidenceTime";

export const nativeParticipationWindow = Object.freeze({
  seasonId: 20262027, gameType: 2,
  startInclusive: "2026-07-01T00:00:00Z", endExclusive: "2026-10-13T05:00:00Z",
} as const);
export const nativeParticipationCohortIds = Object.freeze([
  8157, 9005, 9016, 9320, 9396, 9431, 9572, 9711, 9857, 9964, 10012, 10043, 10163, 10164, 10305, 10448, 10648,
]);

export type ParticipationSource = {
  id: string;
  kind: "independent_all_club_schedule" | "dated_roster_membership" | "game_occurrence" | "official_participation_resolution";
  contentHash: string;
  originalAvailableAt: string;
  capturedAt: string;
};

/** Complete means separately reviewed scoped evidence, not authentication by this module. */
export type ParticipationEvidence<T> = {
  status: "complete" | "partial" | "conflicting" | "unknown";
  value: T | null;
  sourceIds: string[];
  review: { id: string; bundleHash: string; reviewedAt: string } | null;
  reasons: string[];
};

export type ParticipationPlayer = { canonicalPlayerId: number; nhlPlayerId: number };
export type ParticipationSchedule = {
  gameId: number; seasonId: number; gameType: number; revisionId: string;
  startAt: string; homeTeamId: number; awayTeamId: number;
  selectionRule: "selected_before_decision_cutoff"; selectedAt: string;
};
export type ParticipationMembership = ParticipationPlayer & {
  scope: "participating_club_roster_listed_organization";
  scopeTeamIds: number[];
  listed: boolean; teamId: number | null;
  validFrom: string; validUntil: string | null;
};
export type ParticipationOccurrence = { gameId: number; occurred: boolean; actualStartAt: string | null };
export type ParticipationLabel = {
  gameId: number; nhlPlayerId: number;
  resolution: "explicit_official_toi" | "explicit_complete_nonappearance";
  toiSeconds: number;
};
export type ParticipationObservation = ParticipationPlayer & {
  gameId: number; revisionId: string;
  membership: ParticipationEvidence<ParticipationMembership>;
  occurrence: ParticipationEvidence<ParticipationOccurrence>;
  label: ParticipationEvidence<ParticipationLabel>;
};
export type NativeParticipationFrameInput = {
  trainingLockedAt: string;
  cohort: ParticipationPlayer[];
  opportunities: { gameId: number; schedule: ParticipationEvidence<ParticipationSchedule> }[];
  universe: ParticipationEvidence<{
    seasonId: number; gameType: number; startInclusive: string; endExclusive: string;
    scope: "independent_all_club_games_cross_frozen_cohort";
    cohort: ParticipationPlayer[]; gameIds: number[]; clubIds: number[];
  }>;
  sources: ParticipationSource[];
  observations: ParticipationObservation[];
};

export type ParticipationDisposition = "P" | "Z" | "U_label" | "U_frame" | "O" | "K";
type Issue = { status: "partial" | "conflicting" | "unknown"; reason: string };
const hash = (value: string) => /^[a-f0-9]{64}$/.test(value);
const id = (value: number) => Number.isSafeInteger(value) && value > 0;
const playerKey = (player: ParticipationPlayer) => `${player.canonicalPlayerId}:${player.nhlPlayerId}`;
const sameSet = (left: (string | number)[], right: (string | number)[]) =>
  left.length === right.length && new Set(left).size === left.length
  && new Set(right).size === right.length && left.every(value => right.includes(value));
const duplicates = <T>(items: T[], key: (item: T) => string | number) => {
  const seen = new Set<string | number>(), repeated = new Set<string | number>();
  for (const item of items) { const value = key(item); if (seen.has(value)) repeated.add(value); seen.add(value); }
  return repeated;
};
const counts = () => ({ C: 0, P: 0, Z: 0, U_label: 0, U_frame: 0, O: 0, K: 0 });

/** Pure historical frame accounting. No probabilities, acquisition, fitting or issuance. */
export function validateNativeParticipationFrame(input: NativeParticipationFrameInput) {
  const lock = timestampMicros(input.trainingLockedAt);
  const repeatedSources = duplicates(input.sources, source => source.id);
  const sources = new Map(input.sources.map(source => [source.id, source]));
  const check = <T>(evidence: ParticipationEvidence<T>, kind: ParticipationSource["kind"]): Issue | null => {
    if (evidence.status === "conflicting") return { status: "conflicting", reason: "conflicting_evidence" };
    if (evidence.status === "partial") return { status: "partial", reason: "partial_evidence" };
    if (evidence.status !== "complete" || evidence.value === null) return { status: "unknown", reason: "incomplete_evidence" };
    const review = evidence.review, reviewed = review && timestampMicros(review.reviewedAt);
    if (lock === null || !review?.id.trim() || !hash(review.bundleHash) || reviewed == null || reviewed > lock
      || !evidence.sourceIds.length || new Set(evidence.sourceIds).size !== evidence.sourceIds.length) {
      return { status: "unknown", reason: "missing_valid_review_or_training_clock" };
    }
    for (const sourceId of evidence.sourceIds) {
      if (repeatedSources.has(sourceId)) return { status: "conflicting", reason: "duplicate_source_id" };
      const source = sources.get(sourceId);
      const available = source && timestampMicros(source.originalAvailableAt), captured = source && timestampMicros(source.capturedAt);
      if (!source || !source.id.trim() || source.kind !== kind || !hash(source.contentHash)
        || available == null || captured == null || available > captured || captured > reviewed || captured > lock) {
        return { status: "unknown", reason: "missing_or_unavailable_original_source" };
      }
    }
    return null;
  };
  const frameIssues: Issue[] = [];
  const universeIssue = check(input.universe, "independent_all_club_schedule");
  if (universeIssue) frameIssues.push({ ...universeIssue, reason: `universe:${universeIssue.reason}` });
  const universe = input.universe.value;
  if (!universe || universe.scope !== "independent_all_club_games_cross_frozen_cohort"
    || universe.seasonId !== nativeParticipationWindow.seasonId || universe.gameType !== nativeParticipationWindow.gameType
    || timestampMicros(universe.startInclusive) !== timestampMicros(nativeParticipationWindow.startInclusive)
    || timestampMicros(universe.endExclusive) !== timestampMicros(nativeParticipationWindow.endExclusive)
    || !sameSet(universe.cohort.map(playerKey), input.cohort.map(playerKey))
    || !sameSet(input.cohort.map(player => player.canonicalPlayerId), [...nativeParticipationCohortIds])
    || !sameSet(universe.gameIds, input.opportunities.map(game => game.gameId))
    || !universe.clubIds.length || universe.clubIds.some(team => !id(team))
    || new Set(universe.clubIds).size !== universe.clubIds.length) {
    frameIssues.push({ status: "unknown", reason: "universe_scope_or_enumeration_unproved" });
  }
  const repeatedCanonical = duplicates(input.cohort, player => player.canonicalPlayerId);
  const repeatedNhl = duplicates(input.cohort, player => player.nhlPlayerId);
  const repeatedGames = duplicates(input.opportunities, game => game.gameId);
  if (!input.cohort.length) frameIssues.push({ status: "unknown", reason: "empty_cohort" });
  if (repeatedCanonical.size || repeatedNhl.size || repeatedGames.size) {
    frameIssues.push({ status: "conflicting", reason: "duplicate_identity_or_game_revision" });
  }
  const unmatchedObservations = input.observations.filter(observation =>
    !input.cohort.some(player => playerKey(player) === playerKey(observation))
    || !input.opportunities.some(game => game.gameId === observation.gameId));
  if (unmatchedObservations.length) frameIssues.push({ status: "conflicting", reason: "observations_outside_declared_universe" });

  // Occurrence and actual start belong to the game/revision, not an individual player.
  const occurrenceFacts = new Map<string, Set<string>>();
  for (const observation of input.observations) {
    if (check(observation.occurrence, "game_occurrence")
      || !input.cohort.some(player => playerKey(player) === playerKey(observation))
      || !input.opportunities.some(game => game.gameId === observation.gameId
        && game.schedule.value?.revisionId === observation.revisionId)) continue;
    const occurrence = observation.occurrence.value!;
    if (occurrence.gameId !== observation.gameId) continue;
    const actualStart = occurrence.actualStartAt === null ? null : timestampMicros(occurrence.actualStartAt);
    let fact: string;
    if (occurrence.occurred === false && occurrence.actualStartAt === null) fact = "did_not_occur";
    else if (occurrence.occurred === true && actualStart !== null && lock !== null && actualStart <= lock
      && observation.occurrence.sourceIds.every(sourceId => timestampMicros(sources.get(sourceId)!.originalAvailableAt)! >= actualStart)) {
      fact = `occurred:${actualStart}`;
    } else continue;
    const key = `${observation.gameId}:${observation.revisionId}`;
    const facts = occurrenceFacts.get(key) ?? new Set<string>();
    facts.add(fact); occurrenceFacts.set(key, facts);
  }
  const conflictingOccurrences = new Set([...occurrenceFacts].filter(([, facts]) => facts.size > 1).map(([key]) => key));
  for (const key of conflictingOccurrences) frameIssues.push({ status: "conflicting", reason: `game_occurrence_conflict:${key}` });

  const candidates = input.opportunities.flatMap((opportunity, opportunityIndex) => input.cohort.map((player, cohortIndex) => {
    const observations = input.observations.filter(row => row.canonicalPlayerId === player.canonicalPlayerId && row.gameId === opportunity.gameId);
    const reasons: string[] = [];
    let evidenceStatus: "complete" | "partial" | "conflicting" | "unknown" = "complete";
    let decisionCutoffMicros: string | null = null;
    const finish = (disposition: ParticipationDisposition, issue?: Issue) => {
      if (issue) { reasons.push(issue.reason); evidenceStatus = issue.status; }
      return { ...player, gameId: opportunity.gameId, opportunityIndex, cohortIndex, disposition, evidenceStatus,
        reasons, decisionCutoffMicros, schedule: opportunity.schedule, observations };
    };
    if (!id(player.canonicalPlayerId) || !id(player.nhlPlayerId) || !id(opportunity.gameId)
      || repeatedCanonical.has(player.canonicalPlayerId) || repeatedNhl.has(player.nhlPlayerId) || repeatedGames.has(opportunity.gameId)
      || observations.length > 1) return finish("U_frame", { status: "conflicting", reason: "identity_game_or_observation_conflict" });
    const scheduleIssue = check(opportunity.schedule, "independent_all_club_schedule");
    if (scheduleIssue) return finish("U_frame", scheduleIssue);
    const schedule = opportunity.schedule.value!;
    const start = timestampMicros(schedule.startAt), selected = timestampMicros(schedule.selectedAt);
    const first = timestampMicros(nativeParticipationWindow.startInclusive)!, last = timestampMicros(nativeParticipationWindow.endExclusive)!;
    if (start === null || selected === null || start < first || start >= last || schedule.gameId !== opportunity.gameId
      || schedule.seasonId !== nativeParticipationWindow.seasonId || schedule.gameType !== nativeParticipationWindow.gameType
      || !schedule.revisionId.trim() || schedule.selectionRule !== "selected_before_decision_cutoff"
      || !id(schedule.homeTeamId) || !id(schedule.awayTeamId) || schedule.homeTeamId === schedule.awayTeamId
      || !universe?.clubIds.includes(schedule.homeTeamId) || !universe.clubIds.includes(schedule.awayTeamId)) {
      return finish("U_frame", { status: "unknown", reason: "unproved_schedule_binding_or_window" });
    }
    const decision = start - BigInt(60 * 60 * 1_000_000);
    decisionCutoffMicros = decision.toString();
    if (selected > decision) return finish("U_frame", { status: "conflicting", reason: "schedule_revision_selected_after_decision" });
    if (conflictingOccurrences.has(`${opportunity.gameId}:${schedule.revisionId}`)) {
      return finish("U_frame", { status: "conflicting", reason: "game_occurrence_conflict" });
    }
    const observation = observations[0];
    if (!observation) return finish("U_frame", { status: "unknown", reason: "missing_membership_and_outcome_observation" });
    if (observation.nhlPlayerId !== player.nhlPlayerId || observation.revisionId !== schedule.revisionId) {
      return finish("U_frame", { status: "conflicting", reason: "observation_identity_or_revision_mismatch" });
    }
    const occurrenceIssue = check(observation.occurrence, "game_occurrence");
    const occurrence = observation.occurrence.value;
    if (!occurrenceIssue && occurrence?.gameId !== opportunity.gameId) {
      return finish("U_frame", { status: "conflicting", reason: "occurrence_game_mismatch" });
    }
    if (!occurrenceIssue && occurrence && occurrence.occurred === false) {
      if (occurrence.actualStartAt !== null) return finish("U_frame", { status: "conflicting", reason: "nonoccurrence_has_actual_start" });
      if (!check(observation.label, "official_participation_resolution")) {
        return finish("U_frame", { status: "conflicting", reason: "nonoccurrence_conflicts_with_participation_resolution" });
      }
      return finish("K");
    }
    const membershipIssue = check(observation.membership, "dated_roster_membership");
    if (membershipIssue) return finish("U_frame", membershipIssue);
    const membership = observation.membership.value!;
    const from = timestampMicros(membership.validFrom), until = membership.validUntil === null ? null : timestampMicros(membership.validUntil);
    if (playerKey(membership) !== playerKey(player)) {
      return finish("U_frame", { status: "conflicting", reason: "membership_identity_mismatch" });
    }
    if (membership.scope !== "participating_club_roster_listed_organization"
      || !sameSet(membership.scopeTeamIds, [schedule.homeTeamId, schedule.awayTeamId])
      || from === null || from > decision || membership.validUntil !== null && (until === null || until <= decision)
      || typeof membership.listed !== "boolean" || membership.listed && !id(membership.teamId!)
      || !membership.listed && membership.teamId !== null) {
      return finish("U_frame", { status: "unknown", reason: "membership_not_proved_at_decision" });
    }
    if (!membership.listed || ![schedule.homeTeamId, schedule.awayTeamId].includes(membership.teamId!)) return finish("O");
    if (occurrenceIssue) return finish("U_frame", occurrenceIssue);
    const actualStart = occurrence?.actualStartAt ? timestampMicros(occurrence.actualStartAt) : null;
    if (occurrence?.occurred !== true || actualStart === null || actualStart > lock!) {
      return finish("U_frame", { status: "unknown", reason: "game_occurrence_unproved" });
    }
    if (observation.occurrence.sourceIds.some(sourceId => timestampMicros(sources.get(sourceId)!.originalAvailableAt)! < actualStart)) {
      return finish("U_frame", { status: "conflicting", reason: "occurrence_evidence_available_before_actual_start" });
    }
    const labelIssue = check(observation.label, "official_participation_resolution");
    if (labelIssue) return finish("U_label", labelIssue);
    const label = observation.label.value!;
    if (label.gameId !== opportunity.gameId || label.nhlPlayerId !== player.nhlPlayerId
      || !Number.isSafeInteger(label.toiSeconds) || label.toiSeconds < 0
      || !["explicit_official_toi", "explicit_complete_nonappearance"].includes(label.resolution)
      || label.resolution === "explicit_complete_nonappearance" && label.toiSeconds !== 0) {
      return finish("U_label", { status: "conflicting", reason: "invalid_or_mismatched_participation_resolution" });
    }
    if (observation.label.sourceIds.some(sourceId => timestampMicros(sources.get(sourceId)!.originalAvailableAt)! < actualStart)) {
      return finish("U_label", { status: "conflicting", reason: "final_label_available_before_actual_start" });
    }
    return finish(label.toiSeconds > 0 ? "P" : "Z");
  }));

  const account = (rows: typeof candidates) => {
    const result = counts();
    for (const row of rows) { result.C++; result[row.disposition]++; }
    const admitted = !frameIssues.length && !result.U_frame && !result.U_label && result.P + result.Z > 0;
    return { counts: result, admittedCounts: admitted ? { X: result.P, N: result.P + result.Z } : null };
  };
  const accounting = account(candidates);
  const status = frameIssues.some(issue => issue.status === "conflicting") || candidates.some(row => row.evidenceStatus === "conflicting")
    ? "conflicting" : frameIssues.length || accounting.counts.U_frame || accounting.counts.U_label
      ? frameIssues.some(issue => issue.status === "partial") || candidates.some(row =>
        row.evidenceStatus === "partial" || ["P", "Z", "O", "K"].includes(row.disposition)) ? "partial" : "unknown" : "complete";
  return { version: "native-participation-frame-v1" as const, classification: "private_historical_frame_accounting" as const,
    status, trainingLockedAt: input.trainingLockedAt, window: nativeParticipationWindow, universe: input.universe,
    sources: input.sources, candidates, unmatchedObservations, frameIssues, ...accounting,
    perPlayer: input.cohort.map(player => ({ ...player, ...account(candidates.filter(row => playerKey(row) === playerKey(player))) })),
    forecastIssued: false as const, qualificationEligible: false as const,
    limitations: ["Scoped evidence review and source authenticity are prerequisites supplied externally; this pure validator cannot prove them.",
      "Retrospective labels and membership truth do not establish historical pregame feature availability.",
      "Counts do not produce probabilities, confirm participation, establish future kernel transfer or authorize issuance."] };
}
