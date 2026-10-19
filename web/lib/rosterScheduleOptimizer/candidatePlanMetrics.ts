import { contributionLedger } from "./contributionLedger";
import { normalizeEligibility } from "./eligibility";
import { candidateAcquisitionSteps, candidateHorizonPoints, evaluatePlan } from "./planning";
import { expandActiveSlots } from "./slots";
import type { PlanEvaluation, PlanIntent, PlanningSnapshot, PlanStep } from "./planningTypes";

export type CandidatePlan = {
  objective: "agp" | "outcome"; steps: PlanStep[];
  netAGP: number | null; netPoints: number | null;
  /** Expected goalie starts added against the original roster; null when a start probability is missing. */
  netGoalieStarts?: number | null;
  categoryComparisonVerified?: boolean;
  dropped: Array<{ playerId: string; lostAGP: number | null; lostPoints: number | null }>;
  displacedPlayerIds: string[];
};
export type CandidateComparison = { playerId: string; plans: CandidatePlan[]; complete: boolean };
export type CandidateDiagnostic = {
  playerId: string;
  status: "filtered" | "not_selected" | "no_proposals" | "rejected" | "partial" | "evaluated";
  stopReason: "filtered" | "candidate_limit" | "exhausted" | "proposal_limit" | "evaluation_limit";
  generated: number; skipped: number; evaluated: number; illegal: number; unverifiedBudget: number; retained: number;
  reasons: string[];
};
export type CandidatePlanOptions = { maxCandidates?: number; maxEvaluations?: number; maxProposalsPerCandidate?: number;
  /** Manager-requested comparisons lead the bounded set; checks and caps are unchanged. */
  requestedPlayerIds?: string[] };

const number = (value: number | null) => value ?? -Infinity;
const dropped = (plan: CandidatePlan) => plan.steps.some(step => step.dropPlayerId);
export function compareCandidatePlans(a: CandidatePlan, b: CandidatePlan, sort: "points" | "schedule") {
  const primary = sort === "points" ? number(b.netPoints) - number(a.netPoints) : number(b.netAGP) - number(a.netAGP);
  if (primary && !Number.isNaN(primary)) return primary;
  const secondary = sort === "points" ? number(b.netAGP) - number(a.netAGP) : number(b.netPoints) - number(a.netPoints);
  if (secondary && !Number.isNaN(secondary)) return secondary;
  return Number(dropped(a)) - Number(dropped(b)) || a.steps.length - b.steps.length
    || a.steps.map(step => step.id).join("|").localeCompare(b.steps.map(step => step.id).join("|"));
}
export function candidatePlanForSort(plans: CandidatePlan[], sort: "points" | "schedule") {
  return [...plans].sort((a, b) => compareCandidatePlans(a, b, sort))[0];
}

/** One acquisition with its necessary reserve/drop, not an unbounded sequence search. */
export function candidatePlanMetrics(snapshot: PlanningSnapshot, intent: PlanIntent, options: CandidatePlanOptions = {}) {
  const bounded = (value: number | undefined, fallback: number, cap: number) =>
    Number.isFinite(value) ? Math.max(0, Math.min(cap, Math.floor(value!))) : fallback;
  const maxCandidates = bounded(options.maxCandidates, 40, 40);
  const maxEvaluations = Math.max(2, bounded(options.maxEvaluations, 160, 240));
  const maxProposals = bounded(options.maxProposalsPerCandidate, 12, 24);
  const originalIntent = { ...intent, steps: [] };
  const agpBaseline = evaluatePlan(snapshot, originalIntent, "agp", [], false);
  const outcomeBaseline = evaluatePlan(snapshot, originalIntent, "outcome", [], false);
  const baseline = snapshot.rules.scoring.mode === "points" && outcomeBaseline.comparisonEligible
    ? outcomeBaseline : agpBaseline;
  const baselineLedger = contributionLedger(snapshot, baseline, originalIntent);
  // Only a league goalie minimum that the original roster may miss boosts goalie candidates.
  // Unknown progress counts as zero credited starts; leagues without a minimum get no boost.
  const required = snapshot.rules.goalieMinimum.required ?? 0;
  const goalieBoost = required > 0 && baseline.goalie.minimumSatisfied !== true && (baseline.goalie.expectedStarts == null
    || (snapshot.rules.goalieMinimum.credited ?? 0) + baseline.goalie.expectedStarts < required);
  const capacity = expandActiveSlots(snapshot.rules.rosterSlots);
  const vacant = snapshot.roster.filter(row => !["IR", "IR+", "NA"].includes(row.position)).length
    < capacity.activeSlots.length + capacity.benchCapacity;
  const owned = new Set(snapshot.roster.map(row => row.playerId));
  const scheduledTeams = new Set<string | null>(snapshot.games.filter(game => game.status === "scheduled"
    && game.date >= snapshot.context.startDate && game.date <= snapshot.context.endDate).map(game => game.teamAbbreviation));
  const inputs = [...new Map(snapshot.players.map(player => [player.id, player])).values()].map(player => {
    const positions = normalizeEligibility(player.eligiblePositions);
    const reasons = [owned.has(player.id) && "Player is already on the original roster.",
      intent.excludedPlayerIds.includes(player.id) && "Player is excluded from suggestions.",
      player.eligibilityVerified !== true && "League positional eligibility is unverified.",
      !positions.valid && "League positions are unsupported.",
      positions.playerClass !== player.playerClass && "Positions do not match the player's skater/goalie class.",
      !["free_agent", "manager_available", "waivers"].includes(player.availability) && "League availability is not verified for acquisition.",
      !scheduledTeams.has(player.teamAbbreviation) && "No scheduled team game is in the selected range."]
      .filter((reason): reason is string => typeof reason === "string");
    return { player, reasons };
  }).sort((a, b) => a.player.id.localeCompare(b.player.id));
  const horizonPoints = candidateHorizonPoints(snapshot);
  const gameCount = (team: string | null) => snapshot.games.filter(game => game.teamAbbreviation === team
    && game.status === "scheduled" && game.date >= snapshot.context.startDate && game.date <= snapshot.context.endDate
    && (!game.startsAt || Date.parse(game.startsAt) >= Date.parse(snapshot.context.asOf))).length;
  // A shortlist is a heuristic, not a claim of optimality. Prefer supported
  // horizon value, then opportunities, retaining stable IDs only as a tie break.
  const eligible = inputs.filter(input => !input.reasons.length).map(input => input.player).sort((a, b) => {
    const left = horizonPoints.get(a.id), right = horizonPoints.get(b.id);
    if (left != null || right != null) {
      if (left == null) return 1;
      if (right == null) return -1;
      if (left !== right) return right - left;
    }
    return gameCount(b.teamAbbreviation) - gameCount(a.teamAbbreviation) || a.id.localeCompare(b.id);
  });
  const requested = new Set(options.requestedPlayerIds ?? []);
  // A boost reserves a quarter of the bounded set for the leading goalie candidates.
  const boosted = new Set(goalieBoost ? eligible.filter(player => player.playerClass === "goalie" && !requested.has(player.id))
    .slice(0, Math.ceil(maxCandidates / 4)).map(player => player.id) : []);
  const selected = [...eligible.filter(player => requested.has(player.id)), ...eligible.filter(player => boosted.has(player.id)),
    ...eligible.filter(player => !requested.has(player.id) && !boosted.has(player.id))].slice(0, maxCandidates);
  const diagnostics: CandidateDiagnostic[] = inputs.map(({ player, reasons }) => ({ playerId: player.id,
    status: reasons.length ? "filtered" : "not_selected", stopReason: reasons.length ? "filtered" : "candidate_limit",
    generated: 0, skipped: 0, evaluated: 0, illegal: 0, unverifiedBudget: 0, retained: 0,
    reasons: reasons.length ? reasons : ["Outside the bounded candidate evaluation set."] }));
  const diagnosticById = new Map(diagnostics.map(row => [row.playerId, row]));
  const states = selected.map(player => diagnosticById.get(player.id)!);
  for (const state of states) state.reasons = [];
  const addReasons = (state: CandidateDiagnostic, reasons: string[]) => {
    state.reasons = [...new Set([...state.reasons, ...reasons])].slice(0, 8);
  };
  const comparisons: CandidateComparison[] = selected.map(player => ({ playerId: player.id, plans: [], complete: false }));
  const dropOrder = new Map([...baselineLedger.values()].sort((a, b) => {
    const left = snapshot.rules.scoring.mode === "points" ? a.projectedPoints : a.activeGames;
    const right = snapshot.rules.scoring.mode === "points" ? b.projectedPoints : b.activeGames;
    if (left != null || right != null) {
      if (left == null) return 1;
      if (right == null) return -1;
      if (left !== right) return left - right;
    }
    return a.playerId.localeCompare(b.playerId);
  }).map((row, index) => [row.playerId, index]));
  const iterators = selected.map(player => candidateAcquisitionSteps(snapshot, originalIntent, player, dropOrder));
  const proposals = selected.map(() => 0);
  const finished = selected.map(() => false);
  let evaluated = 2;
  const objectives = outcomeBaseline.comparisonEligible ? ["agp", "outcome"] as const : ["agp"] as const;
  const rosterCoverageKnown = snapshot.roster.every(row => snapshot.players.some(player => player.id === row.playerId && player.teamAbbreviation));
  const scheduleKnown = baseline.legal && rosterCoverageKnown && !snapshot.rules.unsupported.length && snapshot.evidence.schedule?.completeness === "complete";
  const retain = (index: number, evaluation: PlanEvaluation) => {
    const state = states[index];
    state.evaluated++;
    if (!evaluation.legal) state.illegal++;
    if (!evaluation.budgetVerified) state.unverifiedBudget++;
    if (!evaluation.legal || !evaluation.budgetVerified) addReasons(state, evaluation.limitations);
    if (!evaluation.legal || !evaluation.budgetVerified) return;
    const pointsKnown = scheduleKnown && snapshot.rules.scoring.mode === "points" && baseline.comparisonEligible && evaluation.comparisonEligible
      && baseline.projectedValue != null && evaluation.projectedValue != null
      && Number.isFinite(baseline.projectedValue) && Number.isFinite(evaluation.projectedValue)
      && Number.isFinite(evaluation.projectedValue - baseline.projectedValue);
    const categoryComparisonVerified = snapshot.rules.scoring.mode === "categories" && scheduleKnown
      && baseline.budgetVerified && baseline.comparisonEligible === true && evaluation.comparisonEligible === true
      && !!baseline.forecastManifestId && baseline.forecastManifestId === evaluation.forecastManifestId
      && snapshot.rules.scoring.categories.length > 0 && snapshot.rules.scoring.categories.every(category => {
        const before = baseline.categoryResults.find(row => row.key === category.key);
        const after = evaluation.categoryResults.find(row => row.key === category.key);
        return !!before && !!after && Number.isFinite(before.own) && Number.isFinite(after.own)
          && Number.isFinite(before.opponent) && before.opponent === after.opponent
          && before.result !== "unknown" && after.result !== "unknown";
      });
    const plan: CandidatePlan = { objective: evaluation.objective, steps: evaluation.steps,
      ...(snapshot.rules.scoring.mode === "categories" ? { categoryComparisonVerified } : {}),
      netAGP: scheduleKnown ? evaluation.activeGames - baseline.activeGames : null,
      netPoints: pointsKnown ? evaluation.projectedValue! - baseline.projectedValue! : null,
      netGoalieStarts: evaluation.goalie.expectedStarts != null && baseline.goalie.expectedStarts != null
        ? evaluation.goalie.expectedStarts - baseline.goalie.expectedStarts : null,
      dropped: [], displacedPlayerIds: [...new Set(baseline.assignments.filter(row => !evaluation.assignments.some(next =>
        next.date === row.date && next.gameId === row.gameId && next.playerId === row.playerId && next.slotId === row.slotId)).map(row => row.playerId))].sort() };
    const rows = comparisons[index].plans;
    const dominates = (a: CandidatePlan, b: CandidatePlan) => a.netAGP != null && b.netAGP != null
      && a.netPoints != null && b.netPoints != null && a.netAGP >= b.netAGP && a.netPoints >= b.netPoints
      && (a.netAGP > b.netAGP || a.netPoints > b.netPoints || compareCandidatePlans(a, b, "points") <= 0);
    if (rows.some(row => dominates(row, plan))) return;
    const after = contributionLedger(snapshot, evaluation, originalIntent);
    plan.dropped = evaluation.steps.flatMap(step => step.dropPlayerId ? [step.dropPlayerId] : []).map(playerId => {
      const before = baselineLedger.get(playerId), retained = after.get(playerId);
      return { playerId, lostAGP: before?.activeGames != null && retained?.activeGames != null ? before.activeGames - retained.activeGames : null,
        lostPoints: before?.projectedPoints != null && retained?.projectedPoints != null ? before.projectedPoints - retained.projectedPoints : null };
    });
    comparisons[index].plans = [...rows.filter(row => !dominates(plan, row)), plan];
  };
  // Round-robin work lets every selected candidate reach its first legal swap before expanding.
  while (evaluated + objectives.length <= maxEvaluations && finished.some(value => !value)) {
    for (let index = 0; index < selected.length; index++) {
      if (finished[index] || evaluated + objectives.length > maxEvaluations) continue;
      let next = iterators[index].next();
      if (!next.done) states[index].generated++;
      // A full roster cannot use an add-only proposal. Reserve prerequisites still compete before drops.
      while (!next.done && !vacant && next.value.length === 1 && !next.value[0].dropPlayerId) {
        states[index].skipped++;
        next = iterators[index].next();
        if (!next.done) states[index].generated++;
      }
      if (next.done) { finished[index] = true; comparisons[index].complete = true; continue; }
      if (proposals[index] >= maxProposals) { finished[index] = true; continue; }
      proposals[index]++;
      for (const objective of objectives) {
        retain(index, evaluatePlan(snapshot, originalIntent, objective, next.value, false)); evaluated++;
      }
      if (proposals[index] >= maxProposals) finished[index] = true;
    }
  }
  for (let index = 0; index < selected.length; index++) {
    const state = states[index], comparison = comparisons[index];
    state.retained = comparison.plans.length;
    state.stopReason = comparison.complete ? "exhausted" : proposals[index] >= maxProposals ? "proposal_limit" : "evaluation_limit";
    state.status = !comparison.complete ? "partial" : state.retained ? "evaluated" : !state.generated ? "no_proposals" : "rejected";
    if (!comparison.complete) addReasons(state, [state.stopReason === "proposal_limit"
      ? "Candidate proposal limit reached; other times or drops may be unevaluated."
      : "Evaluation limit reached; other candidate options may remain unevaluated."]);
    if (!state.generated && comparison.complete) addReasons(state, [snapshot.rules.acquisitionTiming === "unknown"
      ? "Acquisition effective timing is unverified."
      : selected[index].availability === "waivers" && !Number.isFinite(Date.parse(selected[index].waiverClearsAt ?? ""))
        ? "Waiver clearance time is unverified."
        : "No timed acquisition proposal reaches this candidate's games; review the planning cutoff and effective timing."]);
    if (state.generated === state.skipped && state.generated > 0) addReasons(state, ["The full roster has no generated capacity-preserving drop or reserve option."]);
    if (state.retained && !scheduleKnown) addReasons(state, [
      ...(!baseline.legal ? ["The original roster baseline fails legal lineup or roster checks."] : []),
      ...(!rosterCoverageKnown ? ["Owned-player team membership is unknown; lost contributions and net gains are indeterminate."] : []),
      ...snapshot.rules.unsupported,
      ...(snapshot.evidence.schedule?.completeness !== "complete" ? ["Planning schedule coverage is incomplete or unknown."] : []),
    ]);
  }
  const representative = comparisons.map(row => ({ playerId: row.playerId, plan: candidatePlanForSort(row.plans, "points") }));
  const activePoints = representative.map(({ playerId, plan }): [string, number | null] => [playerId, plan?.netPoints ?? null]);
  return { candidates: comparisons, diagnostics, points: activePoints, activePoints, goalieBoost,
    activeGames: representative.map(({ playerId, plan }): [string, number | null] => [playerId, plan?.netAGP ?? null]),
    baseline: { objective: baseline.objective, activeGames: baseline.activeGames,
      projectedPoints: snapshot.rules.scoring.mode === "points" && baseline.comparisonEligible ? baseline.projectedValue : null },
    search: { evaluated, maxEvaluations, candidates: selected.length, eligibleCandidates: eligible.length, maxCandidates,
      maxProposalsPerCandidate: maxProposals, complete: selected.length === eligible.length && comparisons.every(row => row.complete) } };
}
