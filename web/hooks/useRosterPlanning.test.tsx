import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlanIntent, PlanningResult, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import { defaultWorkspace } from "lib/rosterScheduleOptimizer/workspace";
import { useRosterPlanning } from "./useRosterPlanning";
import { planningMonotonicNow } from "lib/rosterScheduleOptimizer/currentPlanningRead";

class MockWorker {
  static instances: MockWorker[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { MockWorker.instances.push(this); }
  finish(result: PlanningResult) { this.onmessage?.({ data: { result } }); }
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); MockWorker.instances = []; });
const snapshot = { id: "revision-one" } as PlanningSnapshot;
const intent = defaultWorkspace().intent;
const plan = { snapshotId: snapshot.id, intentRevision: intent.revision } as PlanningResult;

it("hides previous results in the first render after revision, range, account or intent changes", async () => {
  vi.stubGlobal("Worker", MockWorker);
  const observed: ReturnType<typeof useRosterPlanning>[] = [];
  const { result, rerender } = renderHook(({ data, selected }: { data: PlanningSnapshot | null; selected: PlanIntent }) => {
    const state = useRosterPlanning(data, selected); observed.push(state); return state;
  }, { initialProps: { data: snapshot as PlanningSnapshot | null, selected: intent } });
  const first = MockWorker.instances[0];
  await act(async () => first.finish(plan));
  expect(result.current.result).toBe(plan);
  expect(first.terminate).toHaveBeenCalledOnce();
  rerender({ data: snapshot, selected: intent });
  expect(MockWorker.instances).toHaveLength(1);
  for (const { data, selected } of [
    { data: { ...snapshot, id: "revision-two" }, selected: intent },
    { data: { ...snapshot, context: { startDate: "2026-10-07" } } as PlanningSnapshot, selected: intent },
    { data: { ...snapshot, id: "other-account" }, selected: intent },
    { data: snapshot, selected: intent },
    { data: snapshot, selected: { ...intent, revision: intent.revision + 1 } },
  ]) {
    const count = observed.length;
    rerender({ data, selected });
    expect(observed[count]).toMatchObject({ result: null, error: null, loading: true });
    await act(async () => first.finish(plan));
    expect(result.current.result).toBeNull();
    const current = MockWorker.instances.at(-1)!;
    await act(async () => current.finish({ ...plan, snapshotId: data.id, intentRevision: selected.revision }));
    expect(result.current.result?.snapshotId).toBe(data.id);
  }
  const count = observed.length;
  rerender({ data: null, selected: intent });
  expect(observed[count]).toMatchObject({ result: null, error: null, loading: false });
});

it("clears obsolete errors immediately and cancels an unfinished worker", async () => {
  vi.stubGlobal("Worker", MockWorker);
  const observed: ReturnType<typeof useRosterPlanning>[] = [];
  const { result, rerender, unmount } = renderHook(({ selected }) => {
    const state = useRosterPlanning(snapshot, selected); observed.push(state); return state;
  }, { initialProps: { selected: intent } });
  await act(async () => MockWorker.instances[0].onerror?.());
  expect(result.current.error).toContain("could not complete");
  expect(result.current.loading).toBe(false);
  const count = observed.length;
  rerender({ selected: { ...intent, revision: intent.revision + 1 } });
  expect(observed[count]).toMatchObject({ result: null, error: null, loading: true });
  const unfinished = MockWorker.instances[1];
  unmount();
  expect(unfinished.terminate).toHaveBeenCalledOnce();
  await act(async () => unfinished.finish(plan));
});


it("withdraws expired results and starts exactly one new generation", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-22T12:00:00Z")); vi.stubGlobal("Worker", MockWorker);
  const { result } = renderHook(() => useRosterPlanning(snapshot, intent));
  await act(async () => MockWorker.instances[0].onmessage?.({ data: { result: plan, expiresAt: Date.now() + 1000 } }));
  expect(result.current.result).toBe(plan);
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(result.current.result).toBeNull(); expect(result.current.displaySnapshot).toBeNull();
  expect(MockWorker.instances).toHaveLength(2);
  await act(async () => MockWorker.instances[0].finish(plan));
  expect(result.current.result).toBeNull();
});


it("uses the monotonic publication deadline when the device wall clock moves backward", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-22T12:00:00Z")); vi.stubGlobal("Worker", MockWorker);
  const { result } = renderHook(() => useRosterPlanning(snapshot, intent));
  await act(async () => MockWorker.instances[0].onmessage?.({ data: { result: plan,
    expiresAt: Date.now() + 1000, expiresAtMonotonic: planningMonotonicNow() + 1000 } }));
  vi.setSystemTime(new Date("2026-10-22T11:00:00Z"));
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(result.current.result).toBeNull(); expect(MockWorker.instances).toHaveLength(2);
});

describe("Yahoo confirmations lapse (TJ tab return, 2026-10-26)", () => {
  const yahoo = { yahooPrincipalId: "manager" };
  const publicPlan = { ...plan, objective: "public" } as unknown as PlanningResult;
  const start = () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-22T12:00:00Z")); vi.stubGlobal("Worker", MockWorker);
    const observed: ReturnType<typeof useRosterPlanning>[] = [];
    const view = renderHook(() => { const state = useRosterPlanning(snapshot, intent, yahoo); observed.push(state); return state; });
    return { ...view, observed };
  };
  it("keeps the plan on screen from public inputs when its Yahoo confirmations lapse, without a new Yahoo read", async () => {
    const { result, observed } = start();
    await act(async () => MockWorker.instances[0].onmessage?.({ data: { result: plan, data: {}, privateLapsesFirst: true, expiresAt: Date.now() + 1000 } }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.result).toBe(plan);
    // The stand-in reads public inputs only.
    expect(MockWorker.instances).toHaveLength(2);
    expect(MockWorker.instances[1].postMessage.mock.calls[0][0].options.yahooPrincipalId).toBeNull();
    expect(MockWorker.instances[0].postMessage.mock.calls[0][0].options.yahooPrincipalId).toBe("manager");
    await act(async () => MockWorker.instances[1].onmessage?.({ data: { result: publicPlan, data: {}, expiresAt: null } }));
    expect(result.current.result).toBe(plan);
    const seen = observed.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current.result).toBe(publicPlan);
    expect(observed.slice(seen).every(state => state.result !== null && !state.loading)).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60_000); });
    expect(MockWorker.instances).toHaveLength(2);
    expect(result.current.result).toBe(publicPlan);
  });
  it("prepares the public stand-in only in the last 30 seconds before the Yahoo deadline", async () => {
    const { result } = start();
    await act(async () => MockWorker.instances[0].onmessage?.({ data: { result: plan, data: {}, privateLapsesFirst: true, expiresAt: Date.now() + 120_000 } }));
    expect(MockWorker.instances).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(89_000); });
    expect(MockWorker.instances).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(MockWorker.instances).toHaveLength(2);
    await act(async () => MockWorker.instances[1].onmessage?.({ data: { result: publicPlan, data: {}, expiresAt: null } }));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(result.current.result).toBe(publicPlan);
  });
  it("re-plans once the public stand-in lapses too", async () => {
    const { result } = start();
    await act(async () => MockWorker.instances[0].onmessage?.({ data: { result: plan, data: {}, privateLapsesFirst: true, expiresAt: Date.now() + 1000 } }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => MockWorker.instances[1].onmessage?.({ data: { result: publicPlan, data: {}, expiresAt: Date.now() + 5000 } }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current.result).toBe(publicPlan);
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(result.current.result).toBeNull(); expect(result.current.loading).toBe(true);
    expect(MockWorker.instances).toHaveLength(3);
    expect(MockWorker.instances[2].postMessage.mock.calls[0][0].options.yahooPrincipalId).toBe("manager");
  });
  it("reads no stand-in when a public input ends the plan first", async () => {
    const { result } = start();
    await act(async () => MockWorker.instances[0].onmessage?.({ data: { result: plan, data: {}, privateLapsesFirst: false, expiresAt: Date.now() + 1000 } }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current.result).toBeNull();
    expect(MockWorker.instances).toHaveLength(2);
    expect(MockWorker.instances[1].postMessage.mock.calls[0][0].options.yahooPrincipalId).toBe("manager");
  });
  it("still withdraws an expired plan when no public stand-in is ready", async () => {
    const { result } = start();
    await act(async () => MockWorker.instances[0].onmessage?.({ data: { result: plan, data: {}, privateLapsesFirst: true, expiresAt: Date.now() + 1000 } }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => MockWorker.instances[1].onerror?.());
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current.result).toBeNull(); expect(result.current.displaySnapshot).toBeNull();
    expect(MockWorker.instances).toHaveLength(3);
  });
});
