import { canEligibilityOccupySlot, normalizeEligibility } from "./eligibility";
import { expandActiveSlots } from "./slots";
import type { BenchDecision, LockedAssignment, PlanEvaluation, PlanIntent, PlanningSnapshot } from "./planningTypes";

type BenchPlacement = Pick<PlanEvaluation, "legal" | "budgetVerified" | "assignments" | "assignmentValue"
  | "projectedValue" | "goalie" | "categoryResults" | "forecastInputs">;
type ParticipationEvidence = NonNullable<NonNullable<BenchDecision["evidence"]>["sources"][number]["participation"]>[number];

export type BenchEvaluationBudget = {
  maxEvaluations: number; evaluated: number; deadline: number;
  workQuotaReached: boolean; timeLimitReached: boolean;
};

/** Count returned-plan rechecks and forced placements against one response budget. */
export function reserveBenchEvaluation(budget: BenchEvaluationBudget): boolean {
  if (budget.deadline !== Infinity && Date.now() >= budget.deadline) {
    budget.timeLimitReached = true;
    return false;
  }
  if (budget.evaluated >= budget.maxEvaluations) {
    budget.workQuotaReached = true;
    return false;
  }
  budget.evaluated++;
  return true;
}

const unchecked = (row: BenchDecision) => !["locked_bench", "locked_capacity", "ineligible"].includes(row.reason);
export function deferBenchDecisions(evaluation: PlanEvaluation): PlanEvaluation {
  if (!evaluation.recommendation?.eligible || evaluation.objective !== "outcome"
    || !evaluation.recommendation.exclusions?.some(unchecked)) return evaluation;
  const limitation = "Bench explanations reached their work or time limit; unchecked start/sit decisions remain unresolved.";
  return { ...evaluation, comparisonEligible: false, limitations: [...evaluation.limitations, limitation],
    recommendation: { ...evaluation.recommendation, eligible: false, mode: "schedule_capacity", explanationStatus: "partial",
      reasons: [...evaluation.recommendation.reasons, limitation], exclusions: evaluation.recommendation.exclusions.map(row =>
        unchecked(row) ? { ...row, reason: "explanation_incomplete", evidence: undefined } : row) } };
}

/** Reuse the actual evaluator with a hypothetical placement. No model generation or
 * search-candidate enrichment occurs here; receipts describe evaluated placements. */
export function explainBenchDecisions(args: {
  snapshot: PlanningSnapshot;
  intent: PlanIntent;
  evaluation: PlanEvaluation;
  scopeForDate: (date: string) => { dates: string[]; locks: LockedAssignment[] };
  evaluateForced: (placement: { date: string; playerId: string; slotId?: string }) => BenchPlacement;
  budget?: BenchEvaluationBudget;
  pointsCoverageTarget?: number | null;
}): PlanEvaluation {
  const { snapshot, intent, evaluation, scopeForDate, evaluateForced } = args;
  if (!evaluation.recommendation) return evaluation;
  const slots = expandActiveSlots(snapshot.rules.rosterSlots).activeSlots;
  const players = new Map(snapshot.players.map(player => [player.id, player]));
  const gameDates = new Map(snapshot.games.map(game => [game.id, game.date]));
  const placements = new Map<string, BenchPlacement>();
  const budget = args.budget ?? { maxEvaluations: 250, evaluated: 0, deadline: Infinity,
    workQuotaReached: false, timeLimitReached: false };
  let unresolved = false, partial = false;
  const compareCoverage = (left: BenchPlacement, right: BenchPlacement) => {
    if (intent.goalieCoverage !== "cover") return 0;
    if (args.pointsCoverageTarget != null && left.goalie.projected !== null && right.goalie.projected !== null) {
      return Math.min(args.pointsCoverageTarget, left.goalie.projected) - Math.min(args.pointsCoverageTarget, right.goalie.projected);
    }
    return left.goalie.risk === right.goalie.risk ? 0 : left.goalie.risk ? -1 : 1;
  };
  const exclusions = evaluation.recommendation.exclusions?.map((row): BenchDecision => {
    const player = players.get(row.playerId)!;
    const { dates, locks } = scopeForDate(row.date);
    if (locks.some(lock => lock.playerId === row.playerId && lock.slotId === null)) return { ...row, reason: "locked_bench" };
    const eligible = slots.filter(slot => canEligibilityOccupySlot(normalizeEligibility(player.eligiblePositions), slot.type));
    if (!eligible.length) return { ...row, reason: "ineligible" };
    const open = eligible.filter(slot => !locks.some(lock => lock.slotId === slot.id));
    if (!open.length) return { ...row, reason: "locked_capacity" };
    if (!evaluation.recommendation?.eligible || evaluation.objective !== "outcome") return row;
    const scoreBasis = snapshot.rules.scoring.mode === "points" ? "points_assignment"
      : evaluation.projectedValue !== null ? "category_outcomes" : "category_assignment";
    const score = (plan: BenchPlacement) => scoreBasis === "category_outcomes" ? plan.projectedValue : plan.assignmentValue;
    const selectedScore = score(evaluation);
    if (selectedScore == null || !Number.isFinite(selectedScore)) return row;
    let best: BenchPlacement | undefined;
    // The additive skater matcher finds the best eligible placement in one pass.
    // Other profiles compare bounded legal placements with the full evaluator.
    const placementsToCheck = snapshot.rules.scoring.mode === "points" && player.playerClass === "skater"
      ? [undefined] : open.map(slot => slot.id);
    for (const slotId of placementsToCheck) {
      const key = `${dates[0]}:${dates.at(-1)}:${row.playerId}:${slotId ?? "best"}`;
      if (!placements.has(key)) {
        if (!reserveBenchEvaluation(budget)) {
          unresolved = partial = true;
          return { ...row, reason: "explanation_incomplete", evidence: undefined };
        }
        placements.set(key, evaluateForced({ date: row.date, playerId: row.playerId, slotId }));
      }
      const candidate = placements.get(key)!;
      const value = score(candidate);
      if (!candidate.legal || !candidate.budgetVerified || value == null || !Number.isFinite(value)
        || !candidate.assignments.some(assignment => assignment.date === row.date && assignment.playerId === row.playerId)) continue;
      const coveragePriority = best ? compareCoverage(candidate, best) : 0;
      if (!best || coveragePriority > 0 || coveragePriority === 0 && value > score(best)!) best = candidate;
    }
    if (!best) { unresolved = true; return { ...row, reason: "decision_unresolved" }; }
    const withPlayerScore = score(best)!;
    const minimumPriority = compareCoverage(evaluation, best) > 0;
    const coverageImproves = compareCoverage(evaluation, best) < 0;
    const improves = coverageImproves || !minimumPriority && withPlayerScore > selectedScore + 1e-8;
    if (improves) unresolved = true;
    const reason = improves ? "decision_unresolved" : minimumPriority ? "minimum_priority"
      : scoreBasis === "category_outcomes" || scoreBasis === "category_assignment" ? "category_tradeoff"
        : Math.abs(withPlayerScore - selectedScore) <= 1e-8 ? "equal_lineup_value"
          : row.value !== null && row.value < 0 ? "negative_value" : "lower_lineup_value";
    const selectedBySlot = new Map(evaluation.assignments.filter(item => dates.includes(item.date)).map(item => [`${item.date}:${item.slotId}`, item]));
    const forcedBySlot = new Map(best.assignments.filter(item => dates.includes(item.date)).map(item => [`${item.date}:${item.slotId}`, item]));
    const slotChanges = [...new Set([...selectedBySlot.keys(), ...forcedBySlot.keys()])].sort().flatMap(key => {
      const selected = selectedBySlot.get(key), forced = forcedBySlot.get(key), assignment = selected ?? forced!;
      return selected?.playerId === forced?.playerId ? [] : [{ date: assignment.date, slotId: assignment.slotId,
        selectedPlayerId: selected?.playerId ?? null, withPlayerId: forced?.playerId ?? null }];
    });
    const affected = new Set([row.playerId, ...slotChanges.flatMap(item => [item.selectedPlayerId, item.withPlayerId].filter((id): id is string => id !== null))]);
    const sources = new Map<string, { kinds: Set<string>; revisionIds: Set<string>;
      participation: Map<string, ParticipationEvidence> }>();
    for (const forecast of [...(evaluation.forecastInputs ?? []), ...(best.forecastInputs ?? [])]) {
      if (!affected.has(forecast.playerId) || !dates.includes(gameDates.get(forecast.gameId)!)) continue;
      const source = sources.get(forecast.playerId) ?? { kinds: new Set<string>(), revisionIds: new Set<string>(), participation: new Map() };
      if (forecast.sourceKind) source.kinds.add(forecast.sourceKind);
      source.revisionIds.add(forecast.revisionId);
      const goalie = players.get(forecast.playerId)?.playerClass === "goalie";
      source.participation.set(forecast.gameId, { gameId: forecast.gameId, basis: goalie ? "start" : "appearance",
        probability: goalie ? forecast.startProbability : forecast.appearanceProbability ?? null,
        confirmed: goalie && forecast.confirmedStart });
      sources.set(forecast.playerId, source);
    }
    return { ...row, reason, evidence: { startDate: dates[0], endDate: dates.at(-1)!, lineupMode: snapshot.rules.lineupMode,
      scoreBasis, selectedScore, withPlayerScore, manifestId: evaluation.forecastManifestId ?? snapshot.id, slotChanges,
      categories: evaluation.categoryResults.map(category => {
        const other = best!.categoryResults.find(item => item.key === category.key);
        return { key: category.key, selected: category.own, withPlayer: other?.own ?? null, opponent: category.opponent,
          selectedResult: category.result, withPlayerResult: other?.result ?? "unknown" };
      }), goalie: snapshot.rules.goalieMinimum.required === null ? undefined : {
        counts: snapshot.rules.goalieMinimum.counts, credited: evaluation.goalie.credited, required: evaluation.goalie.required,
        selectedProjected: evaluation.goalie.projected, withPlayerProjected: best.goalie.projected,
      }, sources: [...sources].sort(([a], [b]) => a.localeCompare(b)).map(([playerId, source]) => ({ playerId,
        kinds: [...source.kinds].sort(), revisionIds: [...source.revisionIds].sort(),
        participation: [...source.participation.values()].sort((a, b) => a.gameId.localeCompare(b.gameId)) })) } };
  });
  const limitation = partial ? "Bench explanations reached their work or time limit; unchecked start/sit decisions remain unresolved."
    : "A legal bench-player placement could not support the selected scoring decision; start/sit needs review.";
  return { ...evaluation, comparisonEligible: unresolved ? false : evaluation.comparisonEligible,
    limitations: unresolved ? [...evaluation.limitations, limitation] : evaluation.limitations,
    recommendation: { ...evaluation.recommendation, exclusions,
      explanationStatus: partial ? "partial" : "complete",
      eligible: evaluation.recommendation.eligible && !unresolved,
      mode: unresolved ? "schedule_capacity" : evaluation.recommendation.mode,
      reasons: unresolved ? [...evaluation.recommendation.reasons, limitation] : evaluation.recommendation.reasons } };
}
