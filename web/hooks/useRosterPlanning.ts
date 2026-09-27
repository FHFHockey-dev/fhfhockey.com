import { useEffect, useState } from "react";
import type { PlanIntent, PlanningResult, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";

export function useRosterPlanning(snapshot: PlanningSnapshot | null, intent: PlanIntent) {
  const [result, setResult] = useState<PlanningResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!snapshot) { setResult(null); setError(null); setLoading(false); return; }
    let cancelled = false;
    let worker: Worker | null = null;
    setLoading(true);
    setError(null);
    setResult(null);
    const finish = (message: { result?: PlanningResult; error?: string }) => {
      if (cancelled) return;
      if (message.error) setError(message.error);
      else setResult(message.result ?? null);
      setLoading(false);
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

  return { result, error, loading };
}
