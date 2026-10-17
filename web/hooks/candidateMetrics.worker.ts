import { candidatePlanMetrics } from "lib/rosterScheduleOptimizer/candidatePlanMetrics";
import type { CandidatePlanOptions } from "lib/rosterScheduleOptimizer/candidatePlanMetrics";
import type { PlanIntent, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";

self.onmessage = (event: MessageEvent<{ snapshot: PlanningSnapshot; intent: PlanIntent; options?: CandidatePlanOptions }>) => {
  try { self.postMessage({ metrics: candidatePlanMetrics(event.data.snapshot, event.data.intent, event.data.options) }); }
  catch { self.postMessage({ error: "Candidate comparisons could not complete." }); }
};
