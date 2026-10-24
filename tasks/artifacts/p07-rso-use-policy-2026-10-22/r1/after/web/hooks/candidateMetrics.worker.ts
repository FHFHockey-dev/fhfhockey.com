import { executeRosterPlanning } from "lib/rosterScheduleOptimizer/executionAdapter";
import type { CandidatePlanOptions } from "lib/rosterScheduleOptimizer/candidatePlanMetrics";
import type { PlanIntent, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";

self.onmessage = async (event: MessageEvent<{ snapshot: PlanningSnapshot; intent: PlanIntent; options?: CandidatePlanOptions }>) => {
  try { self.postMessage(await executeRosterPlanning(event.data.snapshot, event.data.intent, {}, event.data.options)); }
  catch { self.postMessage({ error: "Candidate comparisons could not complete." }); }
};
