import { useCallback, useEffect, useRef, useState } from "react";
import type { PlanIntent, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import { planningMonotonicNow, type CurrentPlanningOptions } from "lib/rosterScheduleOptimizer/currentPlanningRead";
import type { RosterPlanningExecution } from "lib/rosterScheduleOptimizer/executionAdapter";
import { requestRosterPlanning } from "./rosterPlanningExecution";

const STAND_IN_LEAD_MS = 30_000;

function useDeadline(expiresAt: number | null | undefined, monotonic: number | null | undefined, onLapse: () => void) {
  useEffect(() => {
    if (expiresAt == null) return;
    const remaining = monotonic == null ? expiresAt - Date.now() : monotonic - planningMonotonicNow();
    const timer = setTimeout(onLapse, Math.min(Math.max(0, remaining), 2_147_483_647));
    return () => clearTimeout(timer);
  }, [expiresAt, monotonic, onLapse]);
}

export function useRosterPlanning(snapshot: PlanningSnapshot | null, intent: PlanIntent,
  options: CurrentPlanningOptions = {}, requestedPlayerIds: string[] = []) {
  const [epoch, setEpoch] = useState(0);
  const previousView = useRef<PlanningSnapshot>();
  const key = JSON.stringify([options.allowRead, options.publicContext, options.refreshKey, epoch,
    [...new Set(requestedPlayerIds)].sort(), options.yahooEligibility, options.yahooPrincipalId]);
  const [state, setState] = useState<{ snapshot: PlanningSnapshot; intent: PlanIntent; key: string;
    execution?: RosterPlanningExecution; error?: string } | null>(null);
  // A Yahoo plan's private confirmations lapse within two minutes. The same generation read
  // from public inputs only stands in once they do, so the page never blanks to re-read Yahoo.
  const [fallback, setFallback] = useState<{ snapshot: PlanningSnapshot; intent: PlanIntent; key: string; execution: RosterPlanningExecution } | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!snapshot) return;
    let cancelled = false;
    const [allowRead, publicContext, refreshKey, generation, ids, yahooEligibility, yahooPrincipalId] = JSON.parse(key);
    const request = requestRosterPlanning(snapshot, intent, { allowRead: allowRead ?? undefined,
      publicContext: publicContext ?? undefined, refreshKey: JSON.stringify([refreshKey, generation]), yahooEligibility, yahooPrincipalId }, ids, previousView.current);
    request.promise.then(execution => { if (!cancelled) {
      if (execution.data) previousView.current = execution.displaySnapshot;
      setState({ snapshot, intent, key, execution });
    } },
      error => { if (!cancelled) setState({ snapshot, intent, key, error: error instanceof Error ? error.message : "Planning failed." }); });
    return () => { cancelled = true; request.release(); };
  }, [snapshot, intent, key]);
  const current = state?.snapshot === snapshot && state?.intent === intent && state?.key === key ? state : null;
  const privateRead = Boolean(options.yahooPrincipalId) && options.allowRead !== false;
  const published = privateRead && current?.execution?.data && current.execution.privateLapsesFirst && current.execution.expiresAt != null ? current.execution : null;
  useEffect(() => {
    if (!snapshot || !published) return;
    let cancelled = false, release = () => {};
    // Read only near the deadline, so plan edits inside the window cost no extra read.
    const remaining = published.expiresAtMonotonic == null ? published.expiresAt! - Date.now() : published.expiresAtMonotonic - planningMonotonicNow();
    const timer = setTimeout(() => {
      const [allowRead, publicContext, refreshKey, generation, ids, yahooEligibility] = JSON.parse(key);
      const request = requestRosterPlanning(snapshot, intent, { allowRead: allowRead ?? undefined,
        publicContext: publicContext ?? undefined, refreshKey: JSON.stringify([refreshKey, generation]), yahooEligibility, yahooPrincipalId: null }, ids);
      release = request.release;
      request.promise.then(execution => { if (!cancelled && execution.data) setFallback({ snapshot, intent, key, execution }); }, () => undefined);
    }, Math.min(Math.max(0, remaining - STAND_IN_LEAD_MS), 2_147_483_647));
    return () => { cancelled = true; clearTimeout(timer); release(); };
  }, [snapshot, intent, key, published]);
  const standIn = fallback?.snapshot === snapshot && fallback?.intent === intent && fallback?.key === key ? fallback.execution : undefined;
  const lapsed = (run?: RosterPlanningExecution) => run?.expiresAtMonotonic != null ? run.expiresAtMonotonic <= planningMonotonicNow()
    : run?.expiresAt != null && run.expiresAt <= Date.now();
  const replan = useCallback(() => setEpoch(value => value + 1), []);
  const rerender = useCallback(() => setTick(value => value + 1), []);
  // Re-plan once nothing current is left (the plan, or its public stand-in after it); switch to the stand-in when the plan lapses.
  const last = standIn ?? current?.execution;
  useDeadline(last?.expiresAt, last?.expiresAtMonotonic, replan);
  useDeadline(standIn ? current?.execution?.expiresAt : null, current?.execution?.expiresAtMonotonic, rerender);
  const execution = !lapsed(current?.execution) ? current?.execution : standIn && !lapsed(standIn) ? standIn : undefined;
  return { result: execution?.result ?? null, metrics: execution?.metrics, healthyReserves: execution?.healthyReserves ?? [],
    displaySnapshot: execution?.displaySnapshot ?? null, data: execution?.data ?? null,
    error: current?.error ?? execution?.readError ?? null, loading: Boolean(snapshot && !current) };
}
