import { useEffect, useState } from "react";
import type { PlanIntent, PlanningResult, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";

export function useRosterPlanning(snapshot: PlanningSnapshot | null, intent: PlanIntent) {
  const [state, setState] = useState<{ snapshot: PlanningSnapshot; intent: PlanIntent;
    result?: PlanningResult; error?: string } | null>(null);

  useEffect(() => {
    if (!snapshot) return;
    let cancelled = false;
    let worker: Worker | null = null;
    const finish = (message: { result?: PlanningResult; error?: string }) => {
      if (cancelled) return;
      worker?.terminate(); worker = null;
      setState({ snapshot, intent, ...message });
    };
    if (typeof Worker !== "undefined") {
      try {
        worker = new Worker(new URL("./rosterPlanning.worker.ts", import.meta.url));
        worker.onmessage = (event: MessageEvent<{ result?: PlanningResult; error?: string }>) => finish(event.data);
        worker.onerror = () => finish({ error: "Planning worker could not complete. Retry after reviewing the inputs." });
        worker.postMessage({ snapshot, intent });
      } catch (cause) {
        finish({ error: cause instanceof Error ? cause.message : "Planning worker could not start." });
      }
    } else {
      import("lib/rosterScheduleOptimizer/planning")
        .then(({ planRoster }) => finish({ result: planRoster(snapshot, intent) }))
        .catch((cause: unknown) => finish({ error: cause instanceof Error ? cause.message : "Planning failed." }));
    }
    return () => { cancelled = true; worker?.terminate(); };
  }, [snapshot, intent]);

  // Invalidate during render so old revision/account/range results never flash.
  const current = state?.snapshot === snapshot && state?.intent === intent ? state : null;
  return { result: current?.result ?? null, error: current?.error ?? null, loading: Boolean(snapshot && !current) };
}
