import { currentRsoUsePolicy, resolveRsoTargetUse } from "../player-forecasts/rsoUsePolicy";
import { resolvePlanningContributions } from "../player-forecasts/planningContributions";
import { candidatePlanMetrics, type CandidatePlanOptions } from "./candidatePlanMetrics";
import { forecastAllows, planRoster, sanitizeForecastInputs } from "./planning";
import { capacityPlanningSnapshot, currentPlanningTime, forecastInputExpiry, planningMonotonicNow, withCurrentPlanningRead, type CurrentPlanningOptions } from "./currentPlanningRead";
import { healthyReserves } from "./healthyReserves";
import type { PlanIntent, PlanningSnapshot } from "./planningTypes";

/** One current read feeds the plan, bounded candidate search and display view. */
export async function executeRosterPlanning(snapshot: PlanningSnapshot, intent: PlanIntent,
  options: CurrentPlanningOptions = {}, candidateOptions: CandidatePlanOptions = {}, signal = new AbortController().signal) {
  return withCurrentPlanningRead(snapshot, options, currentRsoUsePolicy().revision, signal, (input, data, readError) => {
    const policy = currentRsoUsePolicy(), startedAt = new Date(currentPlanningTime()).toISOString();
    const reviewIds = new Set(input.forecasts.flatMap(row => Object.values(row.rsoTargetBindings ?? {})
      .map(binding => resolveRsoTargetUse(binding, startedAt, policy).reviewId)).filter(Boolean));
    // Capture applicable deadlines before computation. An expired deadline must
    // invalidate the result, not disappear from a future-only list afterward.
    const deadlines = [forecastInputExpiry(input), ...policy.reviews.filter(review => reviewIds.has(review.id))
      .map(review => Date.parse(review.expiresAt))].filter((value): value is number => value !== null && Number.isFinite(value));
    const deadline = deadlines.length ? Math.min(...deadlines) : null;
    const evaluate = (current: PlanningSnapshot) => {
      const resolved = resolvePlanningContributions(sanitizeForecastInputs(current), { consumer: "rso" });
      const displaySnapshot = { ...resolved, forecasts: resolved.forecasts.map(row => {
        const numeric = Object.keys(row.stats).some(key => ["assignment", "totals", "comparison"]
          .some(use => forecastAllows(row, key, use as "assignment" | "totals" | "comparison")));
        const independentStart = row.startParticipation?.model && row.startParticipation.allowedUses
          && Object.values(row.startParticipation.allowedUses).some(Boolean);
        return { ...row, stats: Object.fromEntries(Object.entries(row.stats).map(([key, value]) =>
          [key, forecastAllows(row, key, "totals") ? value : null])),
        ...(!numeric && !independentStart ? { startProbability: null, appearanceProbability: null,
          confirmedStart: false, startParticipation: undefined } : {}) };
      }) };
      return { result: planRoster(current, intent), metrics: candidatePlanMetrics(current, intent, candidateOptions), displaySnapshot,
        healthyReserves: healthyReserves(current, intent) };
    };
    let evaluated = evaluate(input);
    const publishedMonotonic = planningMonotonicNow(), publishedServer = currentPlanningTime();
    let remaining = deadline === null ? null : deadline - publishedServer;
    if (remaining !== null && remaining <= 0) {
      evaluated = evaluate(capacityPlanningSnapshot(input)); remaining = null;
    }
    return { ...evaluated, data, readError,
      expiresAt: remaining === null ? null : Date.now() + remaining,
      expiresAtMonotonic: remaining === null ? null : publishedMonotonic + remaining };
  });
}
export type RosterPlanningExecution = Awaited<ReturnType<typeof executeRosterPlanning>>;
