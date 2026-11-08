// @vitest-environment node
// C7 control for TG S06: what the read adapter can and cannot check about a store it doesn't own.
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { createRunStoreReadAdapter } from "lib/forge-testing-grounds/runStore";
const RUN = "11111111-1111-4111-8111-111111111111", OTHER = "22222222-2222-4222-8222-222222222222", H = "a".repeat(64), U = "b".repeat(64);
const progress = (runId: string, extra: Record<string, unknown> = {}) => ({ runId, planHash: H, storageMode: "memory_reference", state: "completed_revealed", revision: 3, createdAtMs: 1, finishedAtMs: 2, heartbeatAtMs: null, notBeforeMs: 0, lastEvent: undefined as any, stages: [] as any[], ...extra });
describe("C7 TG adapter", () => {
  it("T1 records adapter behaviour for poisoned store outputs", async () => {
    const { RUN_EVENTS, RUN_PHASES } = await import("lib/forge-testing-grounds/runnerContracts") as any;
    const base = (runId: string, extra = {}) => ({ ...progress(runId, extra), lastEvent: RUN_EVENTS?.[0] ?? "accepted", stages: [{ phase: (RUN_PHASES ?? ["collection"])[0], total: 1, successful: 1, failed: 0, pending: 0, skipped: 0, percent: (RUN_PHASES ?? ["x"])[0] === "fitting" ? null : 100 }] });
    const store = (p: any, r: any, l: any[] = []) => ({ storageMode: "memory_reference", progress: async () => p, results: async () => r, list: async () => l } as any);
    const out: Record<string, unknown> = {};
    const tryIt = async (k: string, f: () => Promise<unknown>) => { try { out[k] = { ok: await f() }; } catch (e: any) { out[k] = { error: e.code ?? String(e) }; } };
    await tryIt("valid", () => createRunStoreReadAdapter(store(base(RUN), { status: "revealed", outputs: [{ unitId: U, payload: { v: 1 } }] })).readSealed("me", RUN, "results" as any));
    await tryIt("extraField", () => createRunStoreReadAdapter(store(base(RUN, { secret: "x" }), null)).readOperational("me", RUN, "progress" as any));
    await tryIt("otherRunProgress", () => createRunStoreReadAdapter(store(base(OTHER), null)).readOperational("me", RUN, "progress" as any));
    // Results carry no run or plan identity, so another run's revealed outputs can't be told apart at this seam.
    await tryIt("resultsWithoutRunBinding", () => createRunStoreReadAdapter(store(base(RUN), { status: "revealed", outputs: [{ unitId: U, payload: { fromRun: OTHER } }] })).readSealed("me", RUN, "results" as any));
    await tryIt("sealedResults", () => createRunStoreReadAdapter(store(base(RUN), { status: "sealed" })).readSealed("me", RUN, "results" as any));
    await tryIt("notRevealedState", () => createRunStoreReadAdapter(store(base(RUN, { state: "running", finishedAtMs: null }), { status: "revealed", outputs: [] })).readSealed("me", RUN, "results" as any));
    if (process.env.C7_TG_OUT) writeFileSync(process.env.C7_TG_OUT, JSON.stringify(out, null, 2));
    expect((out.extraField as any).error).toBe("invalid_projection"); expect((out.otherRunProgress as any).error).toBe("invalid_projection");
    expect((out.sealedResults as any).error).toBe("results_sealed"); expect((out.notRevealedState as any).error).toBe("results_sealed");
  });
});
