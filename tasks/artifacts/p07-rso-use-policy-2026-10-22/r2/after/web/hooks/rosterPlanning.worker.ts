import { executeRosterPlanning } from "lib/rosterScheduleOptimizer/executionAdapter";
import type { CurrentPlanningOptions } from "lib/rosterScheduleOptimizer/currentPlanningRead";
import type { CandidatePlanOptions } from "lib/rosterScheduleOptimizer/candidatePlanMetrics";
import type { PlanIntent, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";

self.onmessage = async (event: MessageEvent<{ snapshot: PlanningSnapshot; intent: PlanIntent; options?: CurrentPlanningOptions; candidateOptions?: CandidatePlanOptions }>) => {
  try { self.postMessage(await executeRosterPlanning(event.data.snapshot, event.data.intent, event.data.options, event.data.candidateOptions)); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : "Planning failed." }); }
};
