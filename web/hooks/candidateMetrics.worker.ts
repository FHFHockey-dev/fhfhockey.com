import { candidateMetrics } from "lib/rosterScheduleOptimizer/planning";
import type { PlanIntent, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";

self.onmessage = (event: MessageEvent<{ snapshot: PlanningSnapshot; intent: PlanIntent }>) => {
  try { self.postMessage({ metrics: candidateMetrics(event.data.snapshot, event.data.intent) }); }
  catch { self.postMessage({ error: "Candidate comparisons could not complete." }); }
};
