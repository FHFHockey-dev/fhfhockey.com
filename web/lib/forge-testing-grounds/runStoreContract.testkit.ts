import { describe, expect, it } from "vitest";
import type { ExperimentPlan, JsonValue } from "./runnerContracts";
import { MAX_LISTED_RUNS, runProgressSchema, type ExperimentRunStore } from "./runStore";

const OWNER = "40000000-0000-4000-8000-000000000001";
const OTHER = "40000000-0000-4000-8000-000000000002";
const WORKER = "50000000-0000-4000-8000-000000000001";
const LATE_WORKER = "50000000-0000-4000-8000-000000000002";
const T = 1_000;
const ref = (letter: string) => ({ versionId: OWNER, contentHash: letter.repeat(64) });

export function contractPlan(historyClass: ExperimentPlan["inputManifest"]["historyClass"] = "synthetic"): ExperimentPlan {
  return {
    version: "forge-testing-grounds-run-v1", baseline: ref("a"), candidate: ref("b"),
    inputManifest: { ...ref("c"), historyClass, knowledgeCutoffMs: 500, snapshots: [{ ...ref("d"), availableAtMs: 400, capturedAtMs: 450 }] },
    preflightReportHash: "e".repeat(64), chronologyContractHash: "f".repeat(64), evaluationContractHash: "0".repeat(64),
    work: [{ phase: "prediction", key: "contract-predictions" }, { phase: "evaluation", key: "contract-paired" }],
    reveal: { rule: "owner_after_completion_and_time", notBeforeMs: 2_000 },
    limits: { maxUnits: 10, stepTimeoutMs: 20, leaseMs: 100, maxRunMs: 10_000, maxExecutionsPerUnit: 3, maxFailuresPerUnit: 2,
      retryDelayMs: 5, maxOutputBytes: 1_000, maxCheckpointBytes: 1_000, maxStoredBytes: 100_000 },
  };
}
const done = (payload: JsonValue) => ({ kind: "completed" as const, payload, outcomeStatus: "settled" as const });

/**
 * Test-only kit (`.testkit.ts`: imports Vitest, so never import it from app code).
 * Behavior every ExperimentRunStore must share, asserted only through the
 * interface. A future durable adapter registers here with a fresh, isolated,
 * synthetic-only instance per test (never a shared or production database), and
 * must throw RunnerError codes for rejections. Each factory must allow at least
 * two queued runs and one concurrent lease.
 */
export function describeRunStoreContract(name: string, createStore: () => ExperimentRunStore | Promise<ExperimentRunStore>) {
  async function accepted(historyClass?: ExperimentPlan["inputManifest"]["historyClass"]) {
    const store = await createStore();
    const reply = await store.accept(OWNER, "contract-1", contractPlan(historyClass), T);
    return { store, runId: reply.runId, reply };
  }
  async function complete(store: ExperimentRunStore, runId: string, at = T, tag?: string) {
    for (const step of [0, 1]) {
      const work = await store.claim(OWNER, runId, WORKER, at);
      expect(work).not.toBeNull();
      expect(await store.finish(work!.lease, done(tag === undefined ? { contractStep: step } : { contractStep: step, tag }), at)).toBe("accepted");
    }
  }
  const valid = async (store: ExperimentRunStore, runId: string) => {
    const parsed = runProgressSchema.safeParse(await store.progress(OWNER, runId));
    expect(parsed.success).toBe(true);
    return parsed.data!;
  };

  describe(`ExperimentRunStore contract: ${name}`, () => {
    it("accepts idempotently per owner and reports its own storage mode", async () => {
      const { store, runId, reply } = await accepted();
      expect(reply).toMatchObject({ replayed: false, storageMode: store.storageMode });
      expect(await store.accept(OWNER, "contract-1", contractPlan(), T)).toEqual({ ...reply, replayed: true });
      const changed = contractPlan(); changed.candidate.contentHash = "9".repeat(64);
      await expect(store.accept(OWNER, "contract-1", changed, T)).rejects.toThrow("idempotency_conflict");
      await expect(store.accept(OWNER, "contract-2", { ...contractPlan(), undeclared: true }, T)).rejects.toThrow("invalid_plan");
      expect((await store.accept(OTHER, "contract-1", contractPlan(), T)).runId).not.toBe(runId);
      expect(await valid(store, runId)).toMatchObject({ state: "queued", lastEvent: "accepted", storageMode: store.storageMode });
    });

    it("scopes every owner operation and listing to the stored owner", async () => {
      const { store, runId } = await accepted();
      for (const attempt of [store.progress(OTHER, runId), store.claim(OTHER, runId, WORKER, T), store.cancel(OTHER, runId, T),
        store.results(OTHER, runId), store.reveal(OTHER, runId, 5_000)]) await expect(attempt).rejects.toThrow("run_not_found");
      expect(await store.list(OTHER)).toEqual([]);
      expect((await store.list(OWNER)).map(run => run.runId)).toEqual([runId]);
    });

    it("lists newest first as strict projections, capped at MAX_LISTED_RUNS", async () => {
      const store = await createStore();
      const ids: string[] = [];
      for (let index = 0; index <= MAX_LISTED_RUNS; index++) {
        const { runId } = await store.accept(OWNER, `contract-list-${index}`, contractPlan(), T + index);
        await store.cancel(OWNER, runId, T + index); ids.push(runId);
      }
      const listed = await store.list(OWNER);
      expect(listed.map(run => run.runId)).toEqual(ids.reverse().slice(0, MAX_LISTED_RUNS));
      expect(listed.every(run => runProgressSchema.safeParse(run).success)).toBe(true);
    });

    it("fences leases and accepts each logical output once", async () => {
      const { store, runId } = await accepted();
      const work = (await store.claim(OWNER, runId, WORKER, T))!;
      expect(await store.claim(OWNER, runId, LATE_WORKER, T + 50)).toBeNull();
      expect(await valid(store, runId)).toMatchObject({ state: "running", lastEvent: "step_claimed" });
      const expired = T + 100;
      const retaken = (await store.claim(OWNER, runId, LATE_WORKER, expired))!;
      expect(retaken.lease.fence).toBeGreaterThan(work.lease.fence);
      expect(await store.finish(work.lease, done(1), expired)).toBe("stale");
      expect(await store.finish(retaken.lease, done(1), expired)).toBe("accepted");
      expect(await store.finish(retaken.lease, done(1), expired)).toBe("already_accepted");
      await expect(store.finish(retaken.lease, done(2), expired)).rejects.toThrow("output_conflict");
      expect((await valid(store, runId)).stages.map(stage => stage.successful)).toEqual([1, 0]);
    });

    it("keeps waiting for outcomes out of completed coverage", async () => {
      const { store, runId } = await accepted();
      const prediction = (await store.claim(OWNER, runId, WORKER, T))!;
      await expect(store.finish(prediction.lease, { kind: "pending_outcomes" }, T)).rejects.toThrow("invalid_pending_phase");
      expect(await store.finish(prediction.lease, done(0), T)).toBe("accepted");
      const evaluation = (await store.claim(OWNER, runId, WORKER, T))!;
      expect(await store.finish(evaluation.lease, { kind: "pending_outcomes" }, T)).toBe("pending_outcomes");
      expect((await valid(store, runId)).stages[1]).toMatchObject({ successful: 0, failed: 0, pending: 1, percent: 0 });
    });

    it("seals results until the planned synthetic reveal", async () => {
      const { store, runId } = await accepted();
      await complete(store, runId);
      expect(await valid(store, runId)).toMatchObject({ state: "completed_awaiting_reveal", lastEvent: "completed_sealed" });
      expect(await store.results(OWNER, runId)).toEqual({ status: "sealed" });
      expect(await store.reveal(OWNER, runId, 1_999)).toBe(false);
      expect(await store.results(OWNER, runId)).toEqual({ status: "sealed" });
      expect(await store.reveal(OWNER, runId, 2_000)).toBe(true);
      expect(await valid(store, runId)).toMatchObject({ state: "completed_revealed", lastEvent: "planned_reveal" });
      const results = await store.results(OWNER, runId);
      expect(results.status === "revealed" && results.outputs.map(output => output.payload)).toEqual([{ contractStep: 0 }, { contractStep: 1 }]);
    });

    it("binds revealed results to their own run, even for identical plans", async () => {
      const store = await createStore();
      const runs = await Promise.all(["contract-a", "contract-b"].map(key => store.accept(OWNER, key, contractPlan(), T)));
      for (const [index, { runId }] of runs.entries()) {
        await complete(store, runId, T, `run-${index}`);
        expect(await store.reveal(OWNER, runId, 2_000)).toBe(true);
      }
      for (const [index, { runId }] of runs.entries()) {
        const results = await store.results(OWNER, runId);
        expect(results.status === "revealed" && results.outputs.map(output => output.payload))
          .toEqual([{ contractStep: 0, tag: `run-${index}` }, { contractStep: 1, tag: `run-${index}` }]);
      }
    });

    it("never reveals non-synthetic history from a date and completion alone", async () => {
      for (const historyClass of ["reconstructed_history_diagnostic", "original_snapshot"] as const) {
        const store = await createStore();
        const plan = contractPlan(historyClass);
        const { runId } = await store.accept(OWNER, "contract-real", plan, T);
        await complete(store, runId);
        expect(await store.reveal(OWNER, runId, 9_000)).toBe(false);
        expect(await store.results(OWNER, runId)).toEqual({ status: "sealed" });
      }
    });

    it("cancels at the next checkpoint and rejects late work afterwards", async () => {
      const { store, runId } = await accepted();
      const work = (await store.claim(OWNER, runId, WORKER, T))!;
      expect(await store.cancel(OWNER, runId, T + 1)).toMatchObject({ state: "cancellation_requested" });
      expect(await store.finish(work.lease, done(0), T + 2)).toBe("cancelled");
      expect(await valid(store, runId)).toMatchObject({ state: "cancelled", lastEvent: "cancelled_at_checkpoint" });
      expect(await store.finish(work.lease, done(0), T + 3)).toBe("stale");
      expect(await store.claim(OWNER, runId, LATE_WORKER, T + 4)).toBeNull();
      expect((await valid(store, runId)).stages.map(stage => stage.successful)).toEqual([0, 0]);
    });
  });
}
