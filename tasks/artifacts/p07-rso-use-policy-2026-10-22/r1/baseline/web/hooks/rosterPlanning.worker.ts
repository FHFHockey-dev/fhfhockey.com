import { planRoster } from "lib/rosterScheduleOptimizer/planning";
import type { PlanIntent, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";

self.onmessage = (event: MessageEvent<{ snapshot: PlanningSnapshot; intent: PlanIntent }>) => {
  try { self.postMessage({ result: planRoster(event.data.snapshot, event.data.intent) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : "Planning failed." }); }
};
