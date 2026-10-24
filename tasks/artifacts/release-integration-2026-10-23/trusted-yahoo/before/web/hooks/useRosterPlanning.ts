import { useEffect, useRef, useState } from "react";
import type { PlanIntent, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import { planningMonotonicNow, type CurrentPlanningOptions } from "lib/rosterScheduleOptimizer/currentPlanningRead";
import type { RosterPlanningExecution } from "lib/rosterScheduleOptimizer/executionAdapter";
import { requestRosterPlanning } from "./rosterPlanningExecution";

export function useRosterPlanning(snapshot: PlanningSnapshot | null, intent: PlanIntent,
  options: CurrentPlanningOptions = {}, requestedPlayerIds: string[] = []) {
  const [epoch, setEpoch] = useState(0);
  const previousView = useRef<PlanningSnapshot>();
  const key = JSON.stringify([options.allowRead, options.publicContext, options.refreshKey, epoch,
    [...new Set(requestedPlayerIds)].sort(), options.yahooEligibility]);
  const [state, setState] = useState<{ snapshot: PlanningSnapshot; intent: PlanIntent; key: string;
    execution?: RosterPlanningExecution; error?: string } | null>(null);
  useEffect(() => {
    if (!snapshot) return;
    let cancelled = false;
    const [allowRead, publicContext, refreshKey, generation, ids, yahooEligibility] = JSON.parse(key);
    const request = requestRosterPlanning(snapshot, intent, { allowRead: allowRead ?? undefined,
      publicContext: publicContext ?? undefined, refreshKey: JSON.stringify([refreshKey, generation]), yahooEligibility }, ids, previousView.current);
    request.promise.then(execution => { if (!cancelled) {
      if (execution.data) previousView.current = execution.displaySnapshot;
      setState({ snapshot, intent, key, execution });
    } },
      error => { if (!cancelled) setState({ snapshot, intent, key, error: error instanceof Error ? error.message : "Planning failed." }); });
    return () => { cancelled = true; request.release(); };
  }, [snapshot, intent, key]);
  const current = state?.snapshot === snapshot && state?.intent === intent && state?.key === key ? state : null;
  const expiresAt = current?.execution?.expiresAt;
  const monotonicExpiry = current?.execution?.expiresAtMonotonic;
  useEffect(() => {
    if (expiresAt == null) return;
    const remaining = monotonicExpiry == null ? expiresAt - Date.now() : monotonicExpiry - planningMonotonicNow();
    const timer = setTimeout(() => setEpoch(value => value + 1), Math.min(Math.max(0, remaining), 2_147_483_647));
    return () => clearTimeout(timer);
  }, [expiresAt, monotonicExpiry]);
  const expired = monotonicExpiry != null ? monotonicExpiry <= planningMonotonicNow() : expiresAt != null && expiresAt <= Date.now();
  const execution = expired ? undefined : current?.execution;
  return { result: execution?.result ?? null, metrics: execution?.metrics, healthyReserves: execution?.healthyReserves ?? [],
    displaySnapshot: execution?.displaySnapshot ?? null, data: execution?.data ?? null,
    error: current?.error ?? execution?.readError ?? null, loading: Boolean(snapshot && !current) };
}
