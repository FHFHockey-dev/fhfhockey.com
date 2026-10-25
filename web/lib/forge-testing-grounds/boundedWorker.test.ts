// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { runBoundedStep, type StepExecutor } from "./boundedWorker";
import { MemoryExperimentRunStore } from "./memoryRunStore";
import { contentHash, parsePlan, type ExperimentPlan, type JsonValue, type StepResult } from "./runnerContracts";

const OWNER = "10000000-0000-4000-8000-000000000001";
const OTHER = "10000000-0000-4000-8000-000000000002";
const WORKER = "20000000-0000-4000-8000-000000000001";
const RESTART = "20000000-0000-4000-8000-000000000002";
const T = 1_000;
const ref = (letter: string) => ({ versionId: OWNER, contentHash: letter.repeat(64) });
const done = (payload: JsonValue = 0): StepResult => ({ kind: "completed", payload, outcomeStatus: "settled" });
function plan(): ExperimentPlan {
  return {
    version: "forge-testing-grounds-run-v1", baseline: ref("a"), candidate: ref("b"),
    inputManifest: { ...ref("c"), historyClass: "synthetic", knowledgeCutoffMs: 500,
      snapshots: [{ ...ref("d"), availableAtMs: 400, capturedAtMs: 450 }] },
    preflightReportHash: "e".repeat(64), chronologyContractHash: "f".repeat(64), evaluationContractHash: "0".repeat(64),
    work: [{ phase: "evaluation", key: "paired-fixture" }],
    reveal: { rule: "owner_after_completion_and_time", notBeforeMs: 2_000 },
    limits: { maxUnits: 10, stepTimeoutMs: 20, leaseMs: 100, maxRunMs: 10_000,
      maxExecutionsPerUnit: 10, maxFailuresPerUnit: 2, retryDelayMs: 5,
      maxOutputBytes: 1_000, maxCheckpointBytes: 1_000, maxStoredBytes: 100_000 },
  };
}
async function setup(value = plan(), capacity = { maxQueuedRuns: 4, maxConcurrentLeases: 1 }) {
  const store = new MemoryExperimentRunStore(capacity);
  const { runId, planHash } = await store.accept(OWNER, "request-1", value, T);
  return { store, runId, planHash };
}
afterEach(() => vi.useRealTimers());

describe("inert experiment acceptance and contracts", () => {
  it("detaches and freezes the manifest, with canonical hash and owner-scoped idempotent acceptance", async () => {
    const input = plan(), { store, runId, planHash } = await setup(input);
    const replies = await Promise.all(Array.from({ length: 4 }, () => store.accept(OWNER, "request-1", plan(), T)));
    expect(replies.every(reply => reply.storageMode === "memory_reference")).toBe(true);
    expect(replies.every(reply => reply.runId === runId && reply.replayed)).toBe(true);
    expect(contentHash({ a: 1, b: 2 })).toBe(contentHash({ b: 2, a: 1 }));
    input.candidate.contentHash = "9".repeat(64);
    await expect(store.accept(OWNER, "request-1", input, T)).rejects.toThrow("idempotency_conflict");
    const work = (await store.claim(OWNER, runId, WORKER, T))!;
    expect(work.lease.planHash).toBe(planHash);
    expect(work.plan.candidate.contentHash).toBe("b".repeat(64));
    expect(() => { work.plan.work[0].key = "mutated"; }).toThrow();
    expect((await store.accept(OTHER, "request-1", plan(), T)).runId).not.toBe(runId);
    await expect(store.progress(OTHER, runId)).rejects.toThrow("run_not_found");
    await expect(store.claim(OTHER, runId, RESTART, T)).rejects.toThrow("run_not_found");
    await expect(store.cancel(OTHER, runId, T)).rejects.toThrow("run_not_found");
    await expect(store.results(OTHER, runId)).rejects.toThrow("run_not_found");
    await expect(store.reveal(OTHER, runId, 2_000)).rejects.toThrow("run_not_found");
  });

  it("rejects incomplete, reordered, duplicate, future-available or over-budget plans", () => {
    const bad: unknown[] = [{ ...plan(), undeclared: true }, { ...plan(), baseline: undefined }];
    const duplicate = plan(); duplicate.work.push(duplicate.work[0]); bad.push(duplicate);
    const reordered = plan(); reordered.work.push({ phase: "history", key: "history" }); bad.push(reordered);
    const late = plan(); late.inputManifest.snapshots[0].availableAtMs = 501; bad.push(late);
    const original = plan(); original.inputManifest.historyClass = "original_snapshot";
    original.inputManifest.snapshots[0].capturedAtMs = 501; bad.push(original);
    const unknown = plan(); unknown.inputManifest.historyClass = "original_snapshot";
    unknown.inputManifest.snapshots[0].availableAtMs = null; bad.push(unknown);
    const invalidBudget = plan(); invalidBudget.limits.stepTimeoutMs = invalidBudget.limits.leaseMs; bad.push(invalidBudget);
    const tooMany = plan(); tooMany.limits.maxUnits = 0; bad.push(tooMany);
    for (const input of bad) expect(() => parsePlan(input)).toThrow("invalid_plan");
    const diagnostic = plan(); diagnostic.inputManifest.historyClass = "reconstructed_history_diagnostic";
    diagnostic.inputManifest.snapshots[0].capturedAtMs = 900; diagnostic.inputManifest.snapshots[0].availableAtMs = null;
    expect(parsePlan(diagnostic).inputManifest.historyClass).toBe("reconstructed_history_diagnostic");
  });

  it("caps active queue, global leases, clock and run deadline without executing extra work", async () => {
    const { store, runId } = await setup(plan(), { maxQueuedRuns: 2, maxConcurrentLeases: 1 });
    const second = await store.accept(OWNER, "second", plan(), T);
    await expect(store.accept(OWNER, "third", plan(), T)).rejects.toThrow("queue_capacity");
    const work = (await store.claim(OWNER, runId, WORKER, T))!;
    expect(await store.claim(OWNER, runId, RESTART, T)).toBeNull();
    expect(await store.claim(OWNER, second.runId, RESTART, T)).toBeNull();
    await expect(store.finish(work.lease, done(), T - 1)).rejects.toThrow("clock_before_state");
    await store.finish(work.lease, done(), T + 1);
    expect(await store.claim(OWNER, second.runId, RESTART, T + 1)).not.toBeNull();
    expect(await store.claim(OWNER, second.runId, RESTART, T + 10_000)).toBeNull();
    expect((await store.progress(OWNER, second.runId)).lastEvent).toBe("run_deadline");
    await expect(store.accept(OWNER, "overflow", plan(), Number.MAX_SAFE_INTEGER)).rejects.toThrow("invalid_clock");
  });
});

describe("atomic logical outputs, restart and sealed projections", () => {
  it("executes exactly one unit per invocation with real stage denominators and no fitting percentage", async () => {
    const input = plan(); input.work = [
      { phase: "history", key: "history" }, { phase: "fitting", key: "fit" },
      { phase: "prediction", key: "predict" }, { phase: "evaluation", key: "evaluate" },
    ];
    const { store, runId } = await setup(input);
    const execute = vi.fn<StepExecutor>(async () => done({ quality: 0.999, secret: "sealed-marker" }));
    for (let index = 0; index < input.work.length; index++) {
      const reply = await runBoundedStep({ store, runId, ownerUserId: OWNER, workerId: WORKER, now: () => T + index, execute });
      expect(reply.status).toBe("accepted");
      expect(execute).toHaveBeenCalledTimes(index + 1);
      const progress = await store.progress(OWNER, runId);
      expect(progress.storageMode).toBe("memory_reference");
      expect(progress.stages.map(stage => stage.total)).toEqual([1, 1, 1, 1]);
      expect(progress.stages.reduce((sum, stage) => sum + stage.successful, 0)).toBe(index + 1);
      expect(progress.stages[1].percent).toBeNull();
      expect(JSON.stringify(progress)).not.toMatch(/quality|sealed-marker|0\.999|payload|checkpoint/);
      expect(await store.results(OWNER, runId)).toEqual({ status: "sealed" });
    }
    expect(await store.reveal(OWNER, runId, 1_999)).toBe(false);
    expect(await store.reveal(OWNER, runId, 2_000)).toBe(true);
    const results = await store.results(OWNER, runId);
    expect(results.status).toBe("revealed");
    if (results.status === "revealed") expect(results.outputs).toHaveLength(4);
    expect((await runBoundedStep({ store, runId, ownerUserId: OWNER, workerId: WORKER, now: () => 2_000, execute })).status).toBe("not_claimed");
    expect(execute).toHaveBeenCalledTimes(4);
  });

  it("accepts lost-ack retries once, rejects conflicting results and preserves zero", async () => {
    const { store, runId } = await setup();
    const work = (await store.claim(OWNER, runId, WORKER, T))!;
    expect(await store.finish(work.lease, done(0), T)).toBe("accepted");
    const before = await store.progress(OWNER, runId);
    expect(await store.finish(work.lease, done(0), T + 1)).toBe("already_accepted");
    await expect(store.finish(work.lease, done(1), T + 1)).rejects.toThrow("output_conflict");
    expect(await store.progress(OWNER, runId)).toEqual(before);
    await store.reveal(OWNER, runId, 2_000);
    expect(await store.results(OWNER, runId)).toEqual({ status: "revealed", outputs: [{ unitId: work.lease.unitId, payload: 0 }] });
  });

  it("fences a crashed worker and its late checkpoint/result after lease expiry", async () => {
    const { store, runId } = await setup();
    const first = (await store.claim(OWNER, runId, WORKER, T))!;
    expect(await store.finish(first.lease, done(1), T + 100)).toBe("stale");
    const resumed = (await store.claim(OWNER, runId, RESTART, T + 100))!;
    expect(resumed.lease.unitId).toBe(first.lease.unitId);
    expect(resumed.lease.fence).toBeGreaterThan(first.lease.fence);
    expect(await store.finish(first.lease, { kind: "checkpoint", payload: { offset: 99 } }, T + 101)).toBe("stale");
    expect(await store.finish(first.lease, done(1), T + 101)).toBe("stale");
    expect(await store.finish(resumed.lease, done(2), T + 101)).toBe("accepted");
    expect((await store.progress(OWNER, runId)).stages[0]).toMatchObject({ successful: 1, failed: 0, pending: 0 });
  });

  it("resumes an immutable checkpoint with the same unit and matches uninterrupted fixture results", async () => {
    const { store, runId } = await setup();
    const first = (await store.claim(OWNER, runId, WORKER, T))!;
    const checkpoint = { offset: 0, sum: 0, privateInput: "sealed-input" };
    expect(await store.finish(first.lease, { kind: "checkpoint", payload: checkpoint }, T)).toBe("checkpointed");
    checkpoint.offset = 999;
    expect((await store.progress(OWNER, runId)).stages[0]).toMatchObject({ successful: 0, pending: 1, percent: 0 });
    expect(JSON.stringify(await store.progress(OWNER, runId))).not.toContain("sealed-input");
    const restarted = (await store.claim(OWNER, runId, RESTART, T))!;
    expect(restarted.checkpoint).toEqual({ offset: 0, sum: 0, privateInput: "sealed-input" });
    expect(restarted.lease.unitId).toBe(first.lease.unitId);
    expect(Object.isFrozen(restarted.checkpoint)).toBe(true);
    await store.finish(restarted.lease, done({ sum: 6 }), T);
    await store.reveal(OWNER, runId, 2_000);
    const uninterrupted = await setup();
    const other = (await uninterrupted.store.claim(OWNER, uninterrupted.runId, WORKER, T))!;
    await uninterrupted.store.finish(other.lease, done({ sum: 6 }), T);
    await uninterrupted.store.reveal(OWNER, uninterrupted.runId, 2_000);
    expect(await store.results(OWNER, runId)).toEqual(await uninterrupted.store.results(OWNER, uninterrupted.runId));
  });

  it("withholds pending outcomes, rejects false completion, and refuses real-history time-only reveals", async () => {
    const input = plan(); input.inputManifest.historyClass = "original_snapshot";
    const { store, runId } = await setup(input);
    const work = (await store.claim(OWNER, runId, WORKER, T))!;
    await expect(store.finish(work.lease, { kind: "completed", payload: 1, outcomeStatus: "not_applicable" }, T)).rejects.toThrow("outcomes_not_settled");
    expect(await store.finish(work.lease, { kind: "pending_outcomes" }, T)).toBe("pending_outcomes");
    expect((await store.progress(OWNER, runId)).stages[0]).toMatchObject({ failed: 0, pending: 1 });
    expect(await store.reveal(OWNER, runId, T)).toBe(false);
    expect(await store.claim(OWNER, runId, WORKER, T + 4)).toBeNull();
    const ready = (await store.claim(OWNER, runId, WORKER, T + 5))!;
    await store.finish(ready.lease, done(1), T + 5);
    expect(await store.reveal(OWNER, runId, 2_000)).toBe(false);
    expect(await store.results(OWNER, runId)).toEqual({ status: "sealed" });
  });
});

describe("cancellation and bounded failure", () => {
  it("cancels queued work immediately and active work at a safe boundary without accepting its late output", async () => {
    const queued = await setup();
    expect((await queued.store.cancel(OWNER, queued.runId, T)).state).toBe("cancelled");
    expect(await queued.store.claim(OWNER, queued.runId, WORKER, T)).toBeNull();
    const { store, runId } = await setup(), work = (await store.claim(OWNER, runId, WORKER, T))!;
    expect((await store.cancel(OWNER, runId, T)).state).toBe("cancellation_requested");
    expect(await store.claim(OWNER, runId, RESTART, T)).toBeNull();
    expect(await store.finish(work.lease, done("discard"), T)).toBe("cancelled");
    expect(await store.finish(work.lease, done("discard"), T)).toBe("stale");
    expect((await store.progress(OWNER, runId)).stages[0].successful).toBe(0);
    expect(await store.reveal(OWNER, runId, 2_000)).toBe(false);
    expect(await store.results(OWNER, runId)).toEqual({ status: "sealed" });
  });

  it("finalizes an abandoned cancellation when the lease expires without restarting computation", async () => {
    const { store, runId } = await setup();
    await store.claim(OWNER, runId, WORKER, T);
    await store.cancel(OWNER, runId, T);
    expect(await store.claim(OWNER, runId, RESTART, T + 100)).toBeNull();
    expect((await store.progress(OWNER, runId)).state).toBe("cancelled");
  });

  it("bounds retries and checkpoint-only or crash loops without inflating successful units", async () => {
    const { store, runId } = await setup();
    for (let attempt = 0; attempt < 2; attempt++) {
      const work = (await store.claim(OWNER, runId, WORKER, T + attempt * 5))!;
      expect(await store.finish(work.lease, { kind: "failed", code: "executor_failed" }, T + attempt * 5)).toBe(attempt ? "failed" : "retry_queued");
    }
    expect((await store.progress(OWNER, runId)).stages[0]).toMatchObject({ successful: 0, failed: 1, pending: 0 });
    const input = plan(); input.limits.maxExecutionsPerUnit = 2;
    const loop = await setup(input);
    const first = (await loop.store.claim(OWNER, loop.runId, WORKER, T))!;
    await loop.store.finish(first.lease, { kind: "checkpoint", payload: null }, T);
    await loop.store.claim(OWNER, loop.runId, WORKER, T); // Worker crash: no acknowledgement.
    expect(await loop.store.claim(OWNER, loop.runId, RESTART, T + 100)).toBeNull();
    expect((await loop.store.progress(OWNER, loop.runId)).lastEvent).toBe("execution_budget");
  });

  it("rejects malformed/oversized payloads without partial writes and enforces aggregate storage", async () => {
    const { store, runId } = await setup(), work = (await store.claim(OWNER, runId, WORKER, T))!;
    for (const value of [{ kind: "completed", payload: 0 }, { kind: "unknown" }, { kind: "failed", code: "secret-provider-error" }, done(NaN)]) {
      await expect(store.finish(work.lease, value as StepResult, T)).rejects.toThrow("invalid_step_result");
    }
    await expect(store.finish(work.lease, done("x".repeat(1_001)), T)).rejects.toThrow("invalid_or_oversized_payload");
    expect((await store.progress(OWNER, runId)).stages[0].successful).toBe(0);
    await store.finish(work.lease, done(0), T);
    const input = plan(); input.limits.maxStoredBytes = 1_800;
    const limited = await setup(input), claimed = (await limited.store.claim(OWNER, limited.runId, WORKER, T))!;
    expect(await limited.store.finish(claimed.lease, done("x".repeat(990)), T)).toBe("failed");
    expect((await limited.store.progress(OWNER, limited.runId)).lastEvent).toBe("storage_limit");
    expect(await limited.store.results(OWNER, limited.runId)).toEqual({ status: "sealed" });
  });

  it("aborts at the step timeout and ignores late executor resolution", async () => {
    vi.useFakeTimers(); vi.setSystemTime(T);
    const { store, runId } = await setup();
    let signal: AbortSignal | undefined, resolveLate: ((value: StepResult) => void) | undefined;
    const execute: StepExecutor = async (_, received) => { signal = received; return new Promise(resolve => { resolveLate = resolve; }); };
    const running = runBoundedStep({ store, runId, ownerUserId: OWNER, workerId: WORKER, now: Date.now, execute });
    await vi.advanceTimersByTimeAsync(20);
    expect((await running).status).toBe("retry_queued");
    expect(signal?.aborted).toBe(true);
    const before = await store.progress(OWNER, runId);
    resolveLate!(done("late-secret")); await Promise.resolve(); await Promise.resolve();
    expect(await store.progress(OWNER, runId)).toEqual(before);
    expect(await store.results(OWNER, runId)).toEqual({ status: "sealed" });
  });

  it("redacts executor exceptions and malformed returns into a bounded generic failure", async () => {
    const { store, runId } = await setup();
    for (let attempt = 0; attempt < 2; attempt++) {
      const execute: StepExecutor = attempt === 0 ? async () => { throw new Error("private-stack-and-input"); }
        : async () => ({ kind: "failed", code: "private-provider-error" } as unknown as StepResult);
      expect((await runBoundedStep({ store, runId, ownerUserId: OWNER, workerId: WORKER, now: () => T + attempt * 5, execute })).status).toBe(attempt ? "failed" : "retry_queued");
    }
    expect(JSON.stringify(await store.progress(OWNER, runId))).not.toMatch(/private|provider|stack/);
  });

  it("does not call an executor when its claim has already expired before dispatch", async () => {
    const { store, runId } = await setup();
    const now = vi.fn().mockReturnValueOnce(T).mockReturnValue(T + 100);
    const execute = vi.fn<StepExecutor>(async () => done());
    expect((await runBoundedStep({ store, runId, ownerUserId: OWNER, workerId: WORKER, now, execute })).status).toBe("stale");
    expect(execute).not.toHaveBeenCalled();
  });

  it("discards an over-time result even if an executor blocks the timer callback", async () => {
    const { store, runId } = await setup();
    let time = T;
    const execute: StepExecutor = async () => { time += 21; return done("late-sync-result"); };
    expect((await runBoundedStep({ store, runId, ownerUserId: OWNER, workerId: WORKER, now: () => time, execute })).status).toBe("retry_queued");
    expect((await store.progress(OWNER, runId)).stages[0].successful).toBe(0);
  });

  it("keeps legacy manifest hashes and a separate bounded outcome-check allowance", async () => {
    const legacy = plan();
    expect(contentHash(parsePlan(legacy))).toBe(contentHash(legacy));
    expect(parsePlan(legacy).limits).not.toHaveProperty("maxOutcomeChecksPerUnit");
    for (const limit of [0, -1, 1.5, Infinity]) expect(() => parsePlan({ ...legacy, limits: { ...legacy.limits, maxOutcomeChecksPerUnit: limit } })).toThrow("invalid_plan");
    const input = plan(); input.limits.maxExecutionsPerUnit = 1; input.limits.maxFailuresPerUnit = 1; input.limits.maxOutcomeChecksPerUnit = 3;
    const { store, runId } = await setup(input);
    for (let attempt = 0; attempt < 2; attempt++) {
      const work = (await store.claim(OWNER, runId, WORKER, T + attempt * 5))!;
      expect(await store.finish(work.lease, { kind: "pending_outcomes" }, T + attempt * 5)).toBe("pending_outcomes");
      const before = await store.progress(OWNER, runId);
      expect(await store.finish(work.lease, { kind: "pending_outcomes" }, T + attempt * 5)).toBe("stale");
      expect(await store.progress(OWNER, runId)).toEqual(before);
      expect(await store.claim(OWNER, runId, RESTART, T + attempt * 5 + 4)).toBeNull();
    }
    const ready = (await store.claim(OWNER, runId, RESTART, T + 10))!;
    expect(await store.finish(ready.lease, done(0), T + 10)).toBe("accepted");
    expect((await store.progress(OWNER, runId)).stages[0]).toMatchObject({ successful: 1, failed: 0, pending: 0 });
  });

  it("stops at the independent outcome-check cap without failed coverage or fictional completion", async () => {
    const input = plan(); input.limits.maxOutcomeChecksPerUnit = 2;
    const { store, runId } = await setup(input);
    for (let attempt = 0; attempt < 2; attempt++) {
      const work = (await store.claim(OWNER, runId, WORKER, T + attempt * 5))!;
      await store.finish(work.lease, { kind: "pending_outcomes" }, T + attempt * 5);
    }
    expect(await store.claim(OWNER, runId, RESTART, T + 10)).toBeNull();
    const stopped = await store.progress(OWNER, runId);
    expect(stopped).toMatchObject({ state: "failed", lastEvent: "outcome_check_budget" });
    expect(stopped.stages[0]).toMatchObject({ successful: 0, failed: 0, pending: 1, percent: 0 });
    expect(await store.claim(OWNER, runId, RESTART, T + 11)).toBeNull();
    expect(await store.progress(OWNER, runId)).toEqual(stopped);
    expect(await store.reveal(OWNER, runId, 2_000)).toBe(false);
    expect(await store.results(OWNER, runId)).toEqual({ status: "sealed" });
  });

  it("does not let a pending check erase genuine retry exhaustion or prevent waiting cancellation", async () => {
    const input = plan(); input.limits.maxExecutionsPerUnit = 2; input.limits.maxOutcomeChecksPerUnit = 2;
    const { store, runId } = await setup(input);
    const failed = (await store.claim(OWNER, runId, WORKER, T))!;
    expect(await store.finish(failed.lease, { kind: "failed", code: "executor_failed" }, T)).toBe("retry_queued");
    const pending = (await store.claim(OWNER, runId, WORKER, T + 5))!;
    await store.finish(pending.lease, { kind: "pending_outcomes" }, T + 5);
    const retry = (await store.claim(OWNER, runId, RESTART, T + 10))!;
    expect(await store.finish(retry.lease, { kind: "failed", code: "executor_failed" }, T + 10)).toBe("failed");
    expect((await store.progress(OWNER, runId)).lastEvent).toBe("retry_budget");
    expect((await store.progress(OWNER, runId)).stages[0]).toMatchObject({ successful: 0, failed: 1, pending: 0 });
    const waiting = await setup(input), check = (await waiting.store.claim(OWNER, waiting.runId, WORKER, T))!;
    await waiting.store.finish(check.lease, { kind: "pending_outcomes" }, T);
    expect((await waiting.store.cancel(OWNER, waiting.runId, T)).state).toBe("cancelled");
    expect(await waiting.store.claim(OWNER, waiting.runId, RESTART, T + 5)).toBeNull();
    expect((await waiting.store.progress(OWNER, waiting.runId)).stages[0]).toMatchObject({ failed: 0, pending: 1 });
  });
});
