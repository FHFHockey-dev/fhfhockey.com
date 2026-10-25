import type { PlanIntent, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import type { CurrentPlanningOptions } from "lib/rosterScheduleOptimizer/currentPlanningRead";
import { useRosterPlanning } from "./useRosterPlanning";

/** Same current-read generation as the plan; new requested candidates are a new
 * bounded calculation and never reuse a saved forecast graph. */
export function useCandidateMetrics(snapshot: PlanningSnapshot | null, intent: PlanIntent, requestedPlayerIds: string[] = [],
  options: CurrentPlanningOptions = {}) {
  const { metrics, error, loading } = useRosterPlanning(snapshot, intent, options, requestedPlayerIds);
  return { metrics, error: error ?? undefined, loading };
}
