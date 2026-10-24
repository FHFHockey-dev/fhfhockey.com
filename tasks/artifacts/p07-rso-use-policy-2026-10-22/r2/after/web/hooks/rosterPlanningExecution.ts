import type { CurrentPlanningOptions } from "lib/rosterScheduleOptimizer/currentPlanningRead";
import type { RosterPlanningExecution } from "lib/rosterScheduleOptimizer/executionAdapter";
import type { PlanIntent, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";

type Execution = { promise: Promise<RosterPlanningExecution>; users: number; cancel: () => void };
const generations = new WeakMap<PlanningSnapshot, Map<string, Execution>>();

/** Both hooks share one worker/read for identical current input generations.
 * No response or authority is accepted from snapshots or worker request options. */
export function requestRosterPlanning(snapshot: PlanningSnapshot, intent: PlanIntent,
  options: CurrentPlanningOptions, requestedPlayerIds: string[] = [], previousView?: PlanningSnapshot) {
  const ids = [...new Set(requestedPlayerIds)].sort();
  const key = JSON.stringify([intent, options, ids]);
  const entries = generations.get(snapshot) ?? new Map<string, Execution>();
  generations.set(snapshot, entries);
  let execution = entries.get(key);
  if (!execution) {
    const sameRange = previousView && (["seasonId", "startDate", "endDate", "timeZone", "provider", "leagueId", "teamId"] as const)
      .every(field => previousView.context[field] === snapshot.context[field]);
    // Retain schedule capacity across a failed subsequent read. This carries no
    // forecast authority; the adapter replaces/clears the whole numeric graph.
    const input = options.publicContext && sameRange ? { ...snapshot,
      players: [...new Map([...previousView!.players, ...snapshot.players].map(row => [row.id, row])).values()],
      games: previousView!.games, evidence: { ...previousView!.evidence, ...snapshot.evidence } } : snapshot;
    const controller = new AbortController();
    let worker: Worker | null = null;
    const promise = new Promise<RosterPlanningExecution>((resolve, reject) => {
      if (typeof Worker !== "undefined") {
        try {
          worker = new Worker(new URL("./rosterPlanning.worker.ts", import.meta.url));
          worker.onmessage = (event: MessageEvent<RosterPlanningExecution & { error?: string }>) => {
            worker?.terminate(); worker = null;
            if (!controller.signal.aborted) event.data.error ? reject(new Error(event.data.error)) : resolve(event.data);
          };
          worker.onerror = () => { worker?.terminate(); worker = null; reject(new Error("Planning worker could not complete. Retry after reviewing the inputs.")); };
          worker.postMessage({ snapshot: input, intent, options, candidateOptions: { requestedPlayerIds: ids } });
        } catch (error) { reject(error); }
      } else {
        import("lib/rosterScheduleOptimizer/executionAdapter").then(({ executeRosterPlanning }) =>
          executeRosterPlanning(input, intent, options, { requestedPlayerIds: ids }, controller.signal)).then(resolve, reject);
      }
    });
    execution = { promise, users: 0, cancel: () => { controller.abort(); worker?.terminate(); worker = null; } };
    entries.set(key, execution);
  }
  execution.users++;
  const current = execution;
  let released = false;
  return { promise: current.promise, release: () => {
    if (released) return; released = true;
    if (--current.users === 0) { current.cancel(); entries.delete(key); }
  } };
}
