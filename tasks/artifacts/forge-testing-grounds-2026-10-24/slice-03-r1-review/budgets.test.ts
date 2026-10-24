import { describe, expect, it } from "../../../../web/node_modules/vitest/dist/index.js";
import { MemoryExperimentRunStore } from "../../../../web/lib/forge-testing-grounds/memoryRunStore";
import { contentHash, parsePlan, type ExperimentPlan } from "../../../../web/lib/forge-testing-grounds/runnerContracts";
const OWNER = "55555555-5555-4555-8555-555555555551";
const A = "66666666-6666-4666-8666-666666666661";
const B = "66666666-6666-4666-8666-666666666662";
const C = "66666666-6666-4666-8666-666666666663";
const T = 20_000;
const ref = (s: string) => ({ versionId: OWNER, contentHash: s.repeat(64) });
function plan(E = 2, W?: number): ExperimentPlan {
  return { version: "forge-testing-grounds-run-v1", baseline: ref("a"), candidate: ref("b"),
    inputManifest: { ...ref("c"), historyClass: "synthetic", knowledgeCutoffMs: 900, snapshots: [{ ...ref("d"), availableAtMs: 800, capturedAtMs: 850 }] },
    preflightReportHash: "e".repeat(64), chronologyContractHash: "f".repeat(64), evaluationContractHash: "0".repeat(64),
    work: [{ phase: "evaluation", key: "availability" }], reveal: { rule: "owner_after_completion_and_time", notBeforeMs: T + 900 },
    limits: { maxUnits: 5, stepTimeoutMs: 10, leaseMs: 50, maxRunMs: 1_000, maxExecutionsPerUnit: E, maxFailuresPerUnit: Math.min(2, E), retryDelayMs: 2,
      ...(W === undefined ? {} : { maxOutcomeChecksPerUnit: W }), maxOutputBytes: 2_000, maxCheckpointBytes: 2_000, maxStoredBytes: 100_000 } };
}
async function setup(p = plan()) {
  const store = new MemoryExperimentRunStore({ maxQueuedRuns: 2, maxConcurrentLeases: 1 });
  const { runId } = await store.accept(OWNER, "review-r1", p, T); return { store, runId };
}

describe("Independent correction budgets [S03-r1-review]", () => {
  it("preserves omitted-field hashes and validates an explicit frozen independent cap", () => {
    const legacy = plan(); const parsed = parsePlan(legacy);
    expect(parsed.limits).not.toHaveProperty("maxOutcomeChecksPerUnit"); expect(contentHash(parsed)).toBe(contentHash(legacy));
    const explicit = parsePlan(plan(2, 3)); expect(explicit.limits.maxOutcomeChecksPerUnit).toBe(3);
    expect(contentHash(explicit)).not.toBe(contentHash(parsed)); expect(Object.isFrozen(explicit.limits)).toBe(true);
    for (const W of [0, -1, 1.25, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, null, "3", false]) {
      expect(() => parsePlan({ ...legacy, limits: { ...legacy.limits, maxOutcomeChecksPerUnit: W } })).toThrow("invalid_plan");
    }
  });
  it("stops a finite independent waiting allowance without failed coverage, result reveal or revival", async () => {
    const p = plan(1, 3); const { store, runId } = await setup(p); let claims = 0;
    for (let i = 0; i < 3; i++) {
      const work = (await store.claim(OWNER, runId, A, T + i * 2))!; claims++;
      expect(await store.finish(work.lease, { kind: "pending_outcomes" }, T + i * 2)).toBe("pending_outcomes");
    }
    expect(await store.claim(OWNER, runId, B, T + 6)).toBeNull();
    const stopped = await store.progress(OWNER, runId);
    expect(stopped).toMatchObject({ state: "failed", lastEvent: "outcome_check_budget", stages: [{ successful: 0, failed: 0, pending: 1, percent: 0 }] });
    expect(claims).toBeLessThanOrEqual(p.limits.maxExecutionsPerUnit + p.limits.maxOutcomeChecksPerUnit!);
    expect(await store.claim(OWNER, runId, C, T + 8)).toBeNull(); expect(await store.progress(OWNER, runId)).toEqual(stopped);
    expect(await store.reveal(OWNER, runId, T + 900)).toBe(false); expect(await store.results(OWNER, runId)).toEqual({ status: "sealed" });
  });
  it("does not double-charge/refund duplicate pending acknowledgements and retains computation for completion", async () => {
    const { store, runId } = await setup(plan(1, 2)); const first = (await store.claim(OWNER, runId, A, T))!;
    await store.finish(first.lease, { kind: "pending_outcomes" }, T); const before = await store.progress(OWNER, runId);
    expect(await store.finish(first.lease, { kind: "pending_outcomes" }, T)).toBe("stale"); expect(await store.progress(OWNER, runId)).toEqual(before);
    const ready = (await store.claim(OWNER, runId, B, T + 2))!; expect(ready).not.toBeNull();
    expect(await store.finish(first.lease, { kind: "pending_outcomes" }, T + 2)).toBe("stale");
    expect(await store.finish(ready.lease, { kind: "completed", payload: 0, outcomeStatus: "settled" }, T + 2)).toBe("accepted");
    expect((await store.progress(OWNER, runId)).stages[0]).toMatchObject({ successful: 1, failed: 0, pending: 0 });
  });
  it("never refunds expired/stale pending replies so genuine crash attempts still exhaust computation", async () => {
    const { store, runId } = await setup(plan(2, 3)); const crashed = (await store.claim(OWNER, runId, A, T))!;
    const valid = (await store.claim(OWNER, runId, B, T + 50))!;
    expect(await store.finish(valid.lease, { kind: "pending_outcomes" }, T + 50)).toBe("pending_outcomes");
    const secondCrash = (await store.claim(OWNER, runId, C, T + 52))!; expect(secondCrash).not.toBeNull();
    const before = await store.progress(OWNER, runId);
    expect(await store.finish(crashed.lease, { kind: "pending_outcomes" }, T + 53)).toBe("stale"); expect(await store.progress(OWNER, runId)).toEqual(before);
    expect(await store.claim(OWNER, runId, B, T + 102)).toBeNull();
    expect(await store.progress(OWNER, runId)).toMatchObject({ state: "failed", lastEvent: "execution_budget", stages: [{ successful: 0, failed: 1, pending: 0 }] });
  });
  it("does not refund invalid-phase acknowledgements or reset genuine failure exhaustion", async () => {
    const p = plan(1, 2); p.work.unshift({ phase: "prediction", key: "compute" });
    const invalid = await setup(p); const work = (await invalid.store.claim(OWNER, invalid.runId, A, T))!;
    await expect(invalid.store.finish(work.lease, { kind: "pending_outcomes" }, T)).rejects.toThrow("invalid_pending_phase");
    expect(await invalid.store.claim(OWNER, invalid.runId, B, T + 50)).toBeNull();
    expect((await invalid.store.progress(OWNER, invalid.runId)).lastEvent).toBe("execution_budget");
    const genuine = await setup(plan(2, 3));
    for (const [at, result] of [[T, { kind: "failed", code: "executor_failed" }], [T + 2, { kind: "pending_outcomes" }], [T + 4, { kind: "failed", code: "executor_failed" }]] as const) {
      const claimed = (await genuine.store.claim(OWNER, genuine.runId, A, at))!;
      await genuine.store.finish(claimed.lease, result, at);
    }
    expect(await genuine.store.progress(OWNER, genuine.runId)).toMatchObject({ state: "failed", lastEvent: "retry_budget", stages: [{ failed: 1, pending: 0 }] });
  });
  it("cancels an active availability check before transferring its charge and keeps unresolved work pending", async () => {
    const { store, runId } = await setup(plan(1, 3)); const first = (await store.claim(OWNER, runId, A, T))!;
    await store.finish(first.lease, { kind: "pending_outcomes" }, T);
    const active = (await store.claim(OWNER, runId, B, T + 2))!; await store.cancel(OWNER, runId, T + 3);
    expect(await store.finish(active.lease, { kind: "pending_outcomes" }, T + 4)).toBe("cancelled");
    const cancelled = await store.progress(OWNER, runId);
    expect(cancelled).toMatchObject({ state: "cancelled", stages: [{ successful: 0, failed: 0, pending: 1, percent: 0 }] });
    expect(await store.finish(first.lease, { kind: "pending_outcomes" }, T + 5)).toBe("stale");
    expect(await store.claim(OWNER, runId, C, T + 6)).toBeNull(); expect(await store.progress(OWNER, runId)).toEqual(cancelled);
  });
});
