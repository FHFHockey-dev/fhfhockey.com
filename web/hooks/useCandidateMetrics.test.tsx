import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import { useCandidateMetrics } from "./useCandidateMetrics";
import { useRosterPlanning } from "./useRosterPlanning";
import { defaultWorkspace } from "lib/rosterScheduleOptimizer/workspace";

class MockWorker {
  static instances: MockWorker[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn(); terminate = vi.fn();
  constructor() { MockWorker.instances.push(this); }
  finish(value: number) { this.onmessage?.({ data: { result: { snapshotId: "one" },
    metrics: { points: [["c", value]], activePoints: [["c", value]], activeGames: [["c", 0]] }, expiresAt: null } }); }
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); MockWorker.instances = []; });
const snapshot = { id: "one" } as PlanningSnapshot;
const intent = defaultWorkspace().intent;

it("coalesces plan and candidate work into one generation and refreshes changed intent", async () => {
  vi.stubGlobal("Worker", MockWorker);
  const { result, rerender, unmount } = renderHook(({ data, selected }) => ({
    plan: useRosterPlanning(data, selected), candidates: useCandidateMetrics(data, selected),
  }), { initialProps: { data: snapshot, selected: intent } });
  expect(MockWorker.instances).toHaveLength(1);
  const first = MockWorker.instances[0]; expect(first.postMessage).toHaveBeenCalledOnce();
  expect(first.postMessage.mock.calls[0][0]).toMatchObject({ snapshot, intent, candidateOptions: { requestedPlayerIds: [] } });
  await act(async () => first.finish(16));
  expect(result.current.candidates.metrics?.activePoints).toEqual([["c", 16]]);
  expect(result.current.plan.result?.snapshotId).toBe("one");
  // Strict permission refresh per later quantitative generation supersedes old
  // reuse across selected-intent changes; there is no invented revocation TTL.
  rerender({ data: snapshot, selected: { ...intent, revision: 20, alternativeCount: 20 } });
  expect(MockWorker.instances).toHaveLength(2);
  expect(result.current.plan.result).toBeNull(); expect(result.current.candidates.metrics).toBeUndefined();
  await act(async () => first.finish(99));
  expect(result.current.candidates.metrics).toBeUndefined();
  const second = MockWorker.instances[1];
  await act(async () => second.finish(20));
  expect(result.current.candidates.metrics?.activePoints).toEqual([["c", 20]]);
  rerender({ data: { ...snapshot, id: "other-account" }, selected: intent });
  expect(result.current.candidates.metrics).toBeUndefined();
  expect(MockWorker.instances).toHaveLength(3);
  unmount(); expect(MockWorker.instances[2].terminate).toHaveBeenCalledOnce();
});
it("reports an obsolete worker failure without restoring older candidate results", async () => {
  vi.stubGlobal("Worker", MockWorker);
  const { result } = renderHook(() => useCandidateMetrics(snapshot, intent));
  await act(async () => MockWorker.instances[0].onerror?.());
  expect(result.current.error).toContain("could not complete");
  expect(result.current.metrics).toBeUndefined(); expect(result.current.loading).toBe(false);
});
it("forwards distinct requested candidates as a new bounded generation", async () => {
  vi.stubGlobal("Worker", MockWorker);
  const { result, rerender, unmount } = renderHook(({ ids }: { ids: string[] }) => useCandidateMetrics(snapshot, intent, ids),
    { initialProps: { ids: [] as string[] } });
  await act(async () => MockWorker.instances[0].finish(1));
  expect(result.current.metrics?.activePoints).toEqual([["c", 1]]);
  rerender({ ids: ["z", "c", "z"] });
  expect(result.current.metrics).toBeUndefined();
  expect(MockWorker.instances[1].postMessage.mock.calls[0][0]).toMatchObject({ snapshot, intent,
    candidateOptions: { requestedPlayerIds: ["c", "z"] } });
  rerender({ ids: ["c", "z"] }); expect(MockWorker.instances).toHaveLength(2);
  unmount();
});
