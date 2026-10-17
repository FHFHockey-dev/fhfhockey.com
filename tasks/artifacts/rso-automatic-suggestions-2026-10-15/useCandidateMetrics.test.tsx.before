import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { PlanIntent, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import { useCandidateMetrics } from "./useCandidateMetrics";
import { defaultWorkspace } from "lib/rosterScheduleOptimizer/workspace";

class MockWorker {
  static instances: MockWorker[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { MockWorker.instances.push(this); }
  finish(value: number) { this.onmessage?.({ data: { metrics: { points: [["c", value]], activePoints: [["c", value]], activeGames: [["c", 0]] } } }); }
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); MockWorker.instances = []; });
const snapshot = { id: "one" } as PlanningSnapshot;
const intent = defaultWorkspace().intent;
it("delegates without synchronous fallback, reuses irrelevant-intent work, and cancels stale results", () => {
  vi.stubGlobal("Worker", MockWorker);
  const { result, rerender, unmount } = renderHook(({ data, plan }: { data: PlanningSnapshot | null; plan: PlanIntent }) => useCandidateMetrics(data, plan),
    { initialProps: { data: snapshot as PlanningSnapshot | null, plan: intent } });
  const first = MockWorker.instances[0];
  expect(first.postMessage).toHaveBeenCalledOnce();
  expect(result.current.loading).toBe(true);
  rerender({ data: snapshot, plan: { ...intent, revision: 20, alternativeCount: 20, steps: [{ id: "s" } as PlanIntent["steps"][number]] } });
  expect(MockWorker.instances).toHaveLength(1);
  const changed = { ...snapshot, id: "other-account" };
  rerender({ data: changed, plan: intent });
  expect(first.terminate).toHaveBeenCalledOnce();
  act(() => first.finish(99));
  expect(result.current.metrics).toBeUndefined();
  const second = MockWorker.instances[1];
  act(() => second.finish(16));
  expect(result.current.metrics?.activePoints).toEqual([["c", 16]]);
  rerender({ data: changed, plan: { ...intent, excludedPlayerIds: ["c"] } });
  expect(result.current.metrics).toBeUndefined();
  expect(second.terminate).toHaveBeenCalledOnce();
  rerender({ data: null, plan: intent });
  expect(result.current.loading).toBe(false);
  expect(result.current.metrics).toBeUndefined();
  unmount();
  expect(MockWorker.instances[2].terminate).toHaveBeenCalledOnce();
});
it("reports Worker failure or absence without evaluating on the main thread", () => {
  vi.stubGlobal("Worker", MockWorker);
  const { result, unmount } = renderHook(() => useCandidateMetrics(snapshot, intent));
  act(() => MockWorker.instances[0].onerror?.());
  expect(result.current.error).toContain("unavailable");
  expect(result.current.loading).toBe(false);
  unmount();
  vi.stubGlobal("Worker", undefined);
  const unavailable = renderHook(() => useCandidateMetrics(snapshot, intent));
  expect(unavailable.result.current.error).toContain("unavailable");
  expect(MockWorker.instances).toHaveLength(1);
});
