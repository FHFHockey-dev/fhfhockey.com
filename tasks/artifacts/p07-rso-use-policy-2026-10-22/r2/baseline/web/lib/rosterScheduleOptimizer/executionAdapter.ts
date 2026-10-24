import { currentRsoUsePolicy } from "../player-forecasts/rsoUsePolicy";
import { resolvePlanningContributions } from "../player-forecasts/planningContributions";
import { candidatePlanMetrics, type CandidatePlanOptions } from "./candidatePlanMetrics";
import { forecastAllows, planRoster, sanitizeForecastInputs } from "./planning";
import { capacityPlanningSnapshot, forecastInputExpiry, withCurrentPlanningRead, type CurrentPlanningOptions } from "./currentPlanningRead";
import type { PlanIntent, PlanningSnapshot } from "./planningTypes";

/** One current read feeds the plan, bounded candidate search and display view. */
export async function executeRosterPlanning(snapshot: PlanningSnapshot, intent: PlanIntent,
  options: CurrentPlanningOptions = {}, candidateOptions: CandidatePlanOptions = {}, signal = new AbortController().signal) {
  return withCurrentPlanningRead(snapshot, options, currentRsoUsePolicy().revision, signal, (input, data, readError) => {
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
      return { result: planRoster(current, intent), metrics: candidatePlanMetrics(current, intent, candidateOptions), displaySnapshot };
    };
    let evaluated = evaluate(input);
    const expiry = forecastInputExpiry(input);
    if (expiry !== null && expiry <= Date.now()) evaluated = evaluate(capacityPlanningSnapshot(input));
    const reviews = currentRsoUsePolicy().reviews.map(review => Date.parse(review.expiresAt)).filter(value => value > Date.now());
    const expiresAt = [expiry, ...reviews].filter((value): value is number => value !== null && value > Date.now());
    return { ...evaluated, data, readError, expiresAt: expiresAt.length ? Math.min(...expiresAt) : null };
  });
}
export type RosterPlanningExecution = Awaited<ReturnType<typeof executeRosterPlanning>>;
