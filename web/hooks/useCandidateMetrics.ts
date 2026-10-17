import { useEffect, useMemo, useState } from "react";
import type { candidatePlanMetrics } from "lib/rosterScheduleOptimizer/candidatePlanMetrics";
import type { PlanIntent, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";

type Metrics = ReturnType<typeof candidatePlanMetrics>;
export function useCandidateMetrics(snapshot: PlanningSnapshot | null, intent: PlanIntent, requestedPlayerIds: string[] = []) {
  // Compare with the original roster, independently of selected transactions and display count.
  const key = JSON.stringify([intent.excludedPlayerIds, intent.protectedPlayerIds,
    intent.goalieCoverage, intent.goalieWindow, intent.goalieSplit, [...new Set(requestedPlayerIds)].sort()]);
  const calculationIntent = useMemo<PlanIntent>(() => {
    const [excludedPlayerIds, protectedPlayerIds, goalieCoverage, goalieWindow, goalieSplit] = JSON.parse(key);
    return { excludedPlayerIds, protectedPlayerIds, goalieCoverage, goalieWindow, goalieSplit, steps: [], revision: 0, alternativeCount: 5 };
  }, [key]);
  const [state, setState] = useState<{ snapshot: PlanningSnapshot; key: string; metrics?: Metrics; error?: string } | null>(null);
  useEffect(() => {
    if (!snapshot) return;
    let cancelled = false;
    let worker: Worker | null = null;
    const fail = () => {
      worker?.terminate(); worker = null;
      if (!cancelled) setState({ snapshot, key, error: "Candidate comparisons unavailable. Retry after reviewing the inputs." });
    };
    try {
      if (typeof Worker === "undefined") { fail(); return; }
      worker = new Worker(new URL("./candidateMetrics.worker.ts", import.meta.url));
      worker.onmessage = (event: MessageEvent<{ metrics?: Metrics; error?: string }>) => {
        worker?.terminate(); worker = null;
        if (!cancelled) setState({ snapshot, key, ...event.data });
      };
      worker.onerror = fail;
      const requested: string[] = JSON.parse(key)[5];
      worker.postMessage(requested.length ? { snapshot, intent: calculationIntent, options: { requestedPlayerIds: requested } }
        : { snapshot, intent: calculationIntent });
    } catch { fail(); }
    return () => { cancelled = true; worker?.terminate(); };
  }, [snapshot, key, calculationIntent]);
  // Invalidate synchronously, before effects: previous-account/range scores never render.
  const current = state?.snapshot === snapshot && state?.key === key ? state : null;
  return { metrics: current?.metrics, error: current?.error, loading: Boolean(snapshot && !current) };
}
