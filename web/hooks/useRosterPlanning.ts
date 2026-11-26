import { useCallback, useEffect, useRef, useState } from "react";
import type { PlanIntent, PlanStep, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import { planningMonotonicNow, type CurrentPlanningOptions } from "lib/rosterScheduleOptimizer/currentPlanningRead";
import type { RosterPlanningExecution } from "lib/rosterScheduleOptimizer/executionAdapter";
import { requestRosterPlanning } from "./rosterPlanningExecution";

const STAND_IN_LEAD_MS = 30_000;

const dropsOneOf = (steps: PlanStep[], ids: ReadonlySet<string>) =>
  steps.some(step => (step.type === "drop" && ids.has(step.playerId)) || (!!step.dropPlayerId && ids.has(step.dropPlayerId)));
/** Protect and Unprotect change only which players may be dropped. Until the quiet re-plan they start settles, the
 * previous plan stays on screen (TJ, 2026-11-23): same snapshot and read, an intent equal apart from the protected
 * list, and no selected move dropping a newly protected player (that one re-plans as before). */
export function protectionOnlyChange(previous: PlanIntent, next: PlanIntent): boolean {
  const before = new Set(previous.protectedPlayerIds), after = new Set(next.protectedPlayerIds);
  if (before.size === after.size && [...after].every(id => before.has(id))) return false;
  const rest = (intent: PlanIntent) => JSON.stringify({ ...intent, revision: 0, protectedPlayerIds: [] });
  return rest(previous) === rest(next) && !dropsOneOf(next.steps, new Set([...after].filter(id => !before.has(id))));
}
/** The retained plan without any suggestion that drops a now-protected player; the re-plan brings their replacements. */
export function withoutProtectedDrops(execution: RosterPlanningExecution, protectedIds: readonly string[]): RosterPlanningExecution {
  const ids = new Set(protectedIds);
  if (!ids.size) return execution;
  const allowed = <T extends { steps?: PlanStep[] }>(rows: T[] | undefined) => rows?.filter(row => !dropsOneOf(row.steps ?? [], ids));
  const { result, metrics } = execution;
  const streaming = result?.streaming && { ...result.streaming, chains: allowed(result.streaming.chains) ?? [],
    ...("alternatives" in result.streaming ? { alternatives: allowed(result.streaming.alternatives as Array<{ steps?: PlanStep[] }>) } : {}) };
  return { ...execution,
    result: result && { ...result, alternatives: allowed(result.alternatives) ?? [], ...(streaming ? { streaming } : {}) },
    metrics: metrics && { ...metrics, candidates: metrics.candidates?.map(row => ({ ...row, plans: allowed(row.plans) ?? [],
      ...(row.alternatives ? { alternatives: allowed(row.alternatives) } : {}) })) } };
}
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
  // The last settled plan, kept only to bridge a protection-only edit (see protectionOnlyChange).
  const settled = useRef<{ snapshot: PlanningSnapshot; intent: PlanIntent; key: string; execution: RosterPlanningExecution } | null>(null);
  if (current?.execution) settled.current = { snapshot: current.snapshot, intent: current.intent, key: current.key, execution: current.execution };
  else if (current?.error || !snapshot) settled.current = null;
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
  const live = !lapsed(current?.execution) ? current?.execution : standIn && !lapsed(standIn) ? standIn : undefined;
  const kept = !current && snapshot && settled.current && settled.current.key === key && settled.current.snapshot.id === snapshot.id
    && !lapsed(settled.current.execution) && protectionOnlyChange(settled.current.intent, intent) ? settled.current.execution : undefined;
  const execution = live ?? (kept && withoutProtectedDrops(kept, intent.protectedPlayerIds));
  return { result: execution?.result ?? null, metrics: execution?.metrics, healthyReserves: execution?.healthyReserves ?? [],
    displaySnapshot: execution?.displaySnapshot ?? null, data: execution?.data ?? null,
    error: current?.error ?? execution?.readError ?? null, loading: Boolean(snapshot && !current && !kept),
    /** True while a protection-only edit shows the previous plan and its quiet re-plan runs. */
    retained: Boolean(kept && !live) };
}
