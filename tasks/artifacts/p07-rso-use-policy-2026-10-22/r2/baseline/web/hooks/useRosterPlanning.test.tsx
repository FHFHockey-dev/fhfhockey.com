import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { PlanIntent, PlanningResult, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import { defaultWorkspace } from "lib/rosterScheduleOptimizer/workspace";
import { useRosterPlanning } from "./useRosterPlanning";

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
