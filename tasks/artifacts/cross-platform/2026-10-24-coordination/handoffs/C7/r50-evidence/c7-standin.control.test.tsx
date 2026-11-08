import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlanIntent, PlanningResult, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import { defaultWorkspace } from "lib/rosterScheduleOptimizer/workspace";
import { useRosterPlanning } from "hooks/useRosterPlanning";
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
describe("C7 R50 controls", () => {
  const publicPlan = { ...plan, objective: "public" } as unknown as PlanningResult;
  const start = (principal = "manager") => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-22T12:00:00Z")); vi.stubGlobal("Worker", MockWorker);
    return renderHook(({ who }: { who: string }) => useRosterPlanning(snapshot, intent, { yahooPrincipalId: who }), { initialProps: { who: principal } });
  };
  it("C1 frozen/throttled tab: both timers overdue at once, the stand-in cannot land, so the page blanks and re-reads Yahoo", async () => {
    const { result } = start();
    await act(async () => MockWorker.instances[0].onmessage?.({ data: { result: plan, data: {}, privateLapsesFirst: true, expiresAt: Date.now() + 120_000 } }));
    await act(async () => { await vi.advanceTimersByTimeAsync(130_000); });
    expect(MockWorker.instances).toHaveLength(3);
    expect(MockWorker.instances[1].postMessage.mock.calls[0][0].options.yahooPrincipalId).toBeNull();
    expect(MockWorker.instances[1].terminate).toHaveBeenCalled();
    expect(MockWorker.instances[2].postMessage.mock.calls[0][0].options.yahooPrincipalId).toBe("manager");
    expect(result.current.result).toBeNull(); expect(result.current.loading).toBe(true);
  });
  it("C2 account switch while the stand-in is on screen: the first render drops it, the new account reads its own plan", async () => {
    const { result, rerender } = start();
    await act(async () => MockWorker.instances[0].onmessage?.({ data: { result: plan, data: {}, privateLapsesFirst: true, expiresAt: Date.now() + 1000 } }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => MockWorker.instances[1].onmessage?.({ data: { result: publicPlan, data: {}, expiresAt: null } }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current.result).toBe(publicPlan);
    rerender({ who: "other" });
    expect(result.current.result).toBeNull(); expect(result.current.loading).toBe(true);
    expect(MockWorker.instances.at(-1)!.postMessage.mock.calls[0][0].options.yahooPrincipalId).toBe("other");
  });
  it("C3 account switch while the stand-in read is in flight: the late answer is ignored", async () => {
    const { result, rerender } = start();
    await act(async () => MockWorker.instances[0].onmessage?.({ data: { result: plan, data: {}, privateLapsesFirst: true, expiresAt: Date.now() + 1000 } }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const standInWorker = MockWorker.instances[1];
    rerender({ who: "other" });
    expect(standInWorker.terminate).toHaveBeenCalled();
    await act(async () => standInWorker.onmessage?.({ data: { result: publicPlan, data: {}, expiresAt: null } }));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(result.current.result).not.toBe(publicPlan);
  });
  it("C4 a stand-in that is already expired is never shown", async () => {
    const { result } = start();
    await act(async () => MockWorker.instances[0].onmessage?.({ data: { result: plan, data: {}, privateLapsesFirst: true, expiresAt: Date.now() + 1000 } }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => MockWorker.instances[1].onmessage?.({ data: { result: publicPlan, data: {}, expiresAt: Date.now() - 1 } }));
    const seen: unknown[] = [];
    for (let i = 0; i < 4; i += 1) { await act(async () => { await vi.advanceTimersByTimeAsync(400); }); seen.push(result.current.result); }
    expect(seen).not.toContain(publicPlan);
  });
  it("C5 after a switch, the old account's stand-in never covers the new account's lapse (its own stand-in read failed)", async () => {
    const { result, rerender } = start();
    await act(async () => MockWorker.instances[0].onmessage?.({ data: { result: plan, data: {}, privateLapsesFirst: true, expiresAt: Date.now() + 1000 } }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => MockWorker.instances[1].onmessage?.({ data: { result: publicPlan, data: {}, expiresAt: null } }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current.result).toBe(publicPlan);
    rerender({ who: "other" });
    const otherPlan = { ...plan, objective: "other" } as unknown as PlanningResult;
    const w = MockWorker.instances.at(-1)!;
    await act(async () => w.onmessage?.({ data: { result: otherPlan, data: {}, privateLapsesFirst: true, expiresAt: Date.now() + 1000 } }));
    expect(result.current.result).toBe(otherPlan);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => MockWorker.instances.at(-1)!.onerror?.());
    const seen: unknown[] = [];
    for (let i = 0; i < 4; i += 1) { await act(async () => { await vi.advanceTimersByTimeAsync(400); }); seen.push(result.current.result); }
    expect(seen).not.toContain(publicPlan);
  });
});
