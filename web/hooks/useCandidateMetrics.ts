import { useEffect, useMemo, useState } from "react";
import type { candidateMetrics } from "lib/rosterScheduleOptimizer/planning";
import type { PlanIntent, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";

type Metrics = ReturnType<typeof candidateMetrics>;
export function useCandidateMetrics(snapshot: PlanningSnapshot | null, intent: PlanIntent) {
  // Candidate hypotheticals ignore transactions, alternative count and revision.
  const key = JSON.stringify([intent.excludedPlayerIds, intent.protectedPlayerIds,
    intent.goalieCoverage, intent.goalieWindow, intent.goalieSplit]);
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
      worker.postMessage({ snapshot, intent: calculationIntent });
    } catch { fail(); }
    return () => { cancelled = true; worker?.terminate(); };
  }, [snapshot, key, calculationIntent]);
  // Invalidate synchronously, before effects: previous-account/range scores never render.
  const current = state?.snapshot === snapshot && state?.key === key ? state : null;
  return { metrics: current?.metrics, error: current?.error, loading: Boolean(snapshot && !current) };
}
