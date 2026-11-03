// @vitest-environment node
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { MemoryExperimentRunStore } from "lib/forge-testing-grounds/memoryRunStore";
import { createRunStoreReadAdapter } from "lib/forge-testing-grounds/runStore";
import { contractPlan } from "lib/forge-testing-grounds/runStoreContract.testkit";
const OWNER = "40000000-0000-4000-8000-000000000001", OTHER = "40000000-0000-4000-8000-000000000002";
describe("C7 R28 manifest", () => {
  it("M1 genuine plan returned and hash-bound; tampered, extra-field, other-run and other-owner manifests refused", async () => {
    const store = new MemoryExperimentRunStore({ maxQueuedRuns: 4, maxConcurrentLeases: 1 });
    const a = await store.accept(OWNER, "k-a", contractPlan(), 1000), b = await store.accept(OWNER, "k-b", { ...contractPlan(), candidate: { ...contractPlan().candidate, contentHash: "9".repeat(64) } }, 1000);
    const read = async (s: any, owner = OWNER, run = a.runId) => { try { return { ok: await createRunStoreReadAdapter(s).readOperational(owner, run, "manifest" as any) }; } catch (e: any) { return { error: e.code ?? String(e) }; } };
    const wrap = (manifest: (o: string, r: string) => Promise<unknown>) => new Proxy(store, { get: (t, k) => k === "manifest" ? manifest : (t as any)[k]?.bind?.(t) ?? (t as any)[k] });
    const out: Record<string, unknown> = {};
    const genuine: any = await read(store); out.genuine = { keys: Object.keys(genuine.ok ?? {}), planHashMatches: genuine.ok?.planHash === a.planHash };
    out.tampered = await read(wrap(async () => ({ ...contractPlan(), candidate: { ...contractPlan().candidate, contentHash: "8".repeat(64) } })));
    out.extraField = await read(wrap(async () => ({ ...contractPlan(), injected: "x" })));
    out.otherRunsPlan = await read(wrap(async (o, r) => store.manifest(o, b.runId)));
    out.otherOwner = await read(store, OTHER);
    if (process.env.C7_R28_OUT) writeFileSync(process.env.C7_R28_OUT, JSON.stringify(out, null, 2));
    expect(genuine.ok.planHash).toBe(a.planHash); expect(out.tampered).toEqual({ error: "invalid_projection" }); expect(out.extraField).toEqual({ error: "invalid_projection" });
    expect(out.otherRunsPlan).toEqual({ error: "invalid_projection" }); expect((out.otherOwner as any).error).toBe("run_not_found");
  });
});
