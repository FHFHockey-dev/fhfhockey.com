import { afterEach, describe, expect, it, vi } from "../../../../web/node_modules/vitest/dist/index.js";
import { MemoryExperimentRunStore } from "../../../../web/lib/forge-testing-grounds/memoryRunStore";
import { runBoundedStep, type StepExecutor } from "../../../../web/lib/forge-testing-grounds/boundedWorker";
import { type ExperimentPlan, type StepResult } from "../../../../web/lib/forge-testing-grounds/runnerContracts";

const OWNER = "33333333-3333-4333-8333-333333333331";
const OTHER = "33333333-3333-4333-8333-333333333332";
const A = "44444444-4444-4444-8444-444444444441";
const B = "44444444-4444-4444-8444-444444444442";
const C = "44444444-4444-4444-8444-444444444443";
const T = 10_000;
const ref = (s: string) => ({ versionId: OWNER, contentHash: s.repeat(64) });
const completed = (payload: unknown = 0): StepResult => ({ kind: "completed", payload, outcomeStatus: "settled" }) as StepResult;
function plan(): ExperimentPlan {
  return {
    version: "forge-testing-grounds-run-v1", baseline: ref("a"), candidate: ref("b"),
    inputManifest: { ...ref("c"), historyClass: "synthetic", knowledgeCutoffMs: 900,
      snapshots: [{ ...ref("d"), availableAtMs: 800, capturedAtMs: 850 }] },
    preflightReportHash: "e".repeat(64), chronologyContractHash: "f".repeat(64), evaluationContractHash: "0".repeat(64),
    work: [{ phase: "evaluation", key: "review_eval" }], reveal: { rule: "owner_after_completion_and_time", notBeforeMs: T + 500 },
    limits: { maxUnits: 8, stepTimeoutMs: 10, leaseMs: 50, maxRunMs: 1_000,
      maxExecutionsPerUnit: 4, maxFailuresPerUnit: 2, retryDelayMs: 2,
      maxOutputBytes: 2_000, maxCheckpointBytes: 2_000, maxStoredBytes: 100_000 },
  };
}
async function setup(input = plan()) {
  const store = new MemoryExperimentRunStore({ maxQueuedRuns: 3, maxConcurrentLeases: 1 });
  const accepted = await store.accept(OWNER, "independent", input, T);
  return { store, runId: accepted.runId };
}
afterEach(() => vi.useRealTimers());

describe("Independent slice03 logical runner boundaries", () => {
  it("fences a taken-over lease at expiry and preserves the newer checkpoint against all delayed result forms", async () => {
    const { store, runId } = await setup(); const old = (await store.claim(OWNER, runId, A, T))!;
    const current = (await store.claim(OWNER, runId, B, T + 50))!;
    expect(current.lease.fence).toBeGreaterThan(old.lease.fence);
    await store.finish(current.lease, { kind: "checkpoint", payload: { offset: 7 } }, T + 51);
    const before = await store.progress(OWNER, runId);
    for (const result of [completed("obsolete"), { kind: "checkpoint", payload: { offset: 99 } }, { kind: "failed", code: "executor_failed" }, { kind: "pending_outcomes" }] as StepResult[]) {
      expect(await store.finish(old.lease, result, T + 52)).toBe("stale");
      expect(await store.progress(OWNER, runId)).toEqual(before);
    }
    expect((await store.claim(OWNER, runId, C, T + 52))!.checkpoint).toEqual({ offset: 7 });
  });
  it("atomically accepts one conflicting logical completion and never double-counts lost acknowledgements", async () => {
    const { store, runId } = await setup(); const work = (await store.claim(OWNER, runId, A, T))!;
    const race = await Promise.allSettled([store.finish(work.lease, completed(0), T + 1), store.finish(work.lease, completed(1), T + 1)]);
    expect(race[0]).toEqual({ status: "fulfilled", value: "accepted" }); expect(race[1].status).toBe("rejected");
    const before = await store.progress(OWNER, runId);
    expect(before.stages[0]).toMatchObject({ successful: 1, failed: 0, pending: 0 });
    expect(await store.finish(work.lease, completed(0), T + 2)).toBe("already_accepted");
    expect(await store.progress(OWNER, runId)).toEqual(before); expect(await store.results(OWNER, runId)).toEqual({ status: "sealed" });
  });
  it("rejects invalid or oversized completions without partial progress and preserves the valid lease for one acceptance", async () => {
    const { store, runId } = await setup(); const work = (await store.claim(OWNER, runId, A, T))!;
    const before = await store.progress(OWNER, runId);
    for (const result of [completed(NaN), completed("x".repeat(2_001)), { kind: "completed", payload: 0, outcomeStatus: "not_applicable" }, { kind: "completed", payload: 0, outcomeStatus: "settled", privateError: "SECRET" }]) {
      await expect(store.finish(work.lease, result as StepResult, T + 1)).rejects.toThrow();
      expect(await store.progress(OWNER, runId)).toEqual(before);
    }
    expect(await store.finish(work.lease, completed(0), T + 1)).toBe("accepted");
  });
  it("resumes the last accepted detached checkpoint after another worker crashes and rejects its late checkpoint", async () => {
    const { store, runId } = await setup(); const first = (await store.claim(OWNER, runId, A, T))!;
    const point = { offset: 4, input: "SEALED_CHECKPOINT" }; await store.finish(first.lease, { kind: "checkpoint", payload: point }, T + 1); point.offset = 88;
    const crashed = (await store.claim(OWNER, runId, B, T + 1))!;
    const resumed = (await store.claim(OWNER, runId, C, T + 51))!;
    expect(resumed.lease.unitId).toBe(first.lease.unitId); expect(resumed.checkpoint).toEqual({ offset: 4, input: "SEALED_CHECKPOINT" });
    expect(Object.isFrozen(resumed.checkpoint)).toBe(true);
    expect(await store.finish(crashed.lease, { kind: "checkpoint", payload: { offset: 999 } }, T + 52)).toBe("stale");
    expect(await store.finish(resumed.lease, completed({ answer: 6 }), T + 52)).toBe("accepted");
    expect(JSON.stringify(await store.progress(OWNER, runId))).not.toContain("SEALED_CHECKPOINT");
  });
  it("cancels an active later unit without discarding accepted-prefix accounting or reviving on old acknowledgements", async () => {
    const input = plan(); input.work.unshift({ phase: "prediction", key: "prefix" });
    const { store, runId } = await setup(input); const first = (await store.claim(OWNER, runId, A, T))!;
    await store.finish(first.lease, completed("SEALED_PREFIX"), T + 1);
    const second = (await store.claim(OWNER, runId, B, T + 2))!;
    expect((await store.cancel(OWNER, runId, T + 3)).state).toBe("cancellation_requested");
    expect(await store.finish(second.lease, { kind: "checkpoint", payload: "LATE" }, T + 4)).toBe("cancelled");
    const before = await store.progress(OWNER, runId);
    expect(before.stages).toMatchObject([{ successful: 1, pending: 0 }, { successful: 0, failed: 0, pending: 1 }]);
    expect(await store.finish(first.lease, completed("SEALED_PREFIX"), T + 5)).toBe("already_accepted");
    expect(await store.progress(OWNER, runId)).toEqual(before); expect(await store.claim(OWNER, runId, C, T + 100)).toBeNull();
    expect(await store.reveal(OWNER, runId, T + 600)).toBe(false); expect(await store.results(OWNER, runId)).toEqual({ status: "sealed" });
  });
  it("detaches configuration/limits and prevents an active manifest from changing under its idempotency key", async () => {
    const input = plan(); const { store, runId } = await setup(input);
    input.limits.leaseMs = 100; input.inputManifest.snapshots[0].contentHash = "9".repeat(64); input.work[0].key = "changed";
    await expect(store.accept(OWNER, "independent", input, T)).rejects.toThrow("idempotency_conflict");
    const work = (await store.claim(OWNER, runId, A, T))!;
    expect(work.plan.limits.leaseMs).toBe(50); expect(work.plan.work[0].key).toBe("review_eval");
    expect(work.plan.inputManifest.snapshots[0].contentHash).toBe("d".repeat(64));
    expect(() => { work.plan.limits.maxExecutionsPerUnit = 999; }).toThrow();
  });
  it("seals every payload until owner/time completion and denies real-history reveal even after the same conditions", async () => {
    for (const historyClass of ["synthetic", "original_snapshot", "reconstructed_history_diagnostic"] as const) {
      const input = plan(); input.inputManifest.historyClass = historyClass;
      const { store, runId } = await setup(input); const work = (await store.claim(OWNER, runId, A, T))!;
      await store.finish(work.lease, completed({ performance: "SEALED_OUTPUT", value: 0 }), T + 1);
      expect(JSON.stringify(await store.progress(OWNER, runId))).not.toMatch(/SEALED_OUTPUT|performance|payload/);
      expect(await store.results(OWNER, runId)).toEqual({ status: "sealed" });
      await expect(store.results(OTHER, runId)).rejects.toThrow("run_not_found");
      await expect(store.reveal(OTHER, runId, T + 600)).rejects.toThrow("run_not_found");
      expect(await store.reveal(OWNER, runId, T + 499)).toBe(false);
      expect(await store.reveal(OWNER, runId, T + 500)).toBe(historyClass === "synthetic");
      expect((await store.results(OWNER, runId)).status).toBe(historyClass === "synthetic" ? "revealed" : "sealed");
    }
  });
  it("discards an old worker's promise after takeover and a newer accepted output without rewriting progress", async () => {
    vi.useFakeTimers(); vi.setSystemTime(T); const { store, runId } = await setup();
    let resolve!: (value: StepResult) => void; const execute: StepExecutor = async () => new Promise(r => { resolve = r; });
    const running = runBoundedStep({ store, runId, ownerUserId: OWNER, workerId: A, now: Date.now, execute });
    await vi.advanceTimersByTimeAsync(0); vi.setSystemTime(T + 50);
    const takeover = (await store.claim(OWNER, runId, B, T + 50))!;
    await store.finish(takeover.lease, completed("NEW_CURRENT"), T + 51); vi.setSystemTime(T + 51);
    const before = await store.progress(OWNER, runId); resolve(completed("OLD_SECRET"));
    expect((await running).status).toBe("stale"); expect(await store.progress(OWNER, runId)).toEqual(before);
  });
  it("preserves pending outcome accounting when the run deadline stops an otherwise pending evaluation", async () => {
    const input = plan(); input.limits.maxRunMs = 100;
    const { store, runId } = await setup(input); const work = (await store.claim(OWNER, runId, A, T))!;
    await store.finish(work.lease, { kind: "pending_outcomes" }, T + 1);
    expect(await store.claim(OWNER, runId, B, T + 100)).toBeNull();
    expect((await store.progress(OWNER, runId)).stages[0]).toMatchObject({ successful: 0, failed: 0, pending: 1 });
  });
  it("does not relabel unavailable future outcomes as failed when repeated pending checks exhaust execution budget [S03-R1]", async () => {
    const input = plan(); input.limits.maxExecutionsPerUnit = 2; input.limits.maxFailuresPerUnit = 1;
    const { store, runId } = await setup(input);
    for (let i = 0; i < 2; i++) {
      const work = (await store.claim(OWNER, runId, A, T + i * 2))!;
      expect(await store.finish(work.lease, { kind: "pending_outcomes" }, T + i * 2)).toBe("pending_outcomes");
    }
    expect(await store.claim(OWNER, runId, B, T + 4)).toBeNull();
    expect((await store.progress(OWNER, runId)).stages[0]).toMatchObject({ successful: 0, failed: 0, pending: 1 });
    expect(await store.results(OWNER, runId)).toEqual({ status: "sealed" });
  });
});
