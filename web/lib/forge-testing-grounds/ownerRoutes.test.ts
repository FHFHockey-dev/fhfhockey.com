// @vitest-environment node
import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestingGroundsRoutes, type OwnerReadStore } from "./ownerRoutes";
import { runBoundedStep } from "./boundedWorker";
import { MemoryExperimentRunStore } from "./memoryRunStore";
import { createRunStoreReadAdapter, type ExperimentRunStore, type RunProgress } from "./runStore";
import type { ExperimentPlan } from "./runnerContracts";
import accessRoute from "../../pages/api/v1/forge/testing-grounds/access";
import collectionRoute from "../../pages/api/v1/forge/testing-grounds/runs";
import runRoute from "../../pages/api/v1/forge/testing-grounds/runs/[runId]/[operation]";
const ownerId = "11111111-1111-4111-8111-111111111111";
const origin = "http://localhost:3000";
const operations = ["progress", "health", "manifest", "logs", "results", "export", "cancel", "retry", "reveal"];
const store = {
  listOwned: vi.fn(), findOwned: vi.fn(), readOperational: vi.fn(), authorizeSealedRead: vi.fn(), readSealed: vi.fn(),
} satisfies OwnerReadStore;
function request(operation?: string, method = "GET") {
  return { method, headers: { origin, "content-type": "application/json" },
    query: { runId: "run-1", operation, ownerUserId: "forged", revealed: "true" },
    body: { revealed: true, role: "admin" } } as unknown as NextApiRequest;
}
function response() {
  return { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as NextApiResponse;
}
const granted = vi.fn(async () => ({ allowed: true as const, ownerUserId: ownerId }));
beforeEach(() => {
  vi.clearAllMocks();
  store.findOwned.mockResolvedValue({ ownerUserId: ownerId, runId: "run-1" });
  store.authorizeSealedRead.mockResolvedValue(false);
  store.readOperational.mockResolvedValue({ sample: "operational" });
  store.readSealed.mockResolvedValue({ sample: "revealed" });
  store.listOwned.mockResolvedValue([]);
});

describe("inactive owner routes and artifact boundaries", () => {
  it.each(["access", "list", "launch", ...operations])("denied %s cannot touch any store", async operation => {
    const deny = vi.fn(async (_req: NextApiRequest, res: NextApiResponse) => { res.status(403).json({ error: "forbidden" }); return null; });
    const routes = createTestingGroundsRoutes({ authorize: deny, store, trustedOrigin: origin });
    const method = ["launch", "cancel", "retry", "reveal"].includes(operation) ? "POST" : "GET";
    const handler = operation === "access" ? routes.access : ["list", "launch"].includes(operation) ? routes.collection : routes.run;
    const res = response(); await handler(request(operation, method), res);
    expect(deny).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(403);
    for (const call of Object.values(store)) expect(call).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store, max-age=0");
    expect(res.setHeader).not.toHaveBeenCalledWith("Access-Control-Allow-Origin", expect.anything());
  });
  it("exports only real fail-closed wrappers with no default store", async () => {
    // Missing owner configuration is scoped to this test; no actual identity is read.
    vi.stubEnv("FORGE_TESTING_GROUNDS_OWNER_USER_ID", "");
    try {
      for (const handler of [accessRoute, collectionRoute, runRoute]) {
        const res = response(); await handler(request("progress"), res);
        expect(res.status).toHaveBeenCalledWith(503);
        expect(res.json).toHaveBeenCalledWith({ error: "owner_not_configured" });
      }
    } finally { vi.unstubAllEnvs(); }
  });
  it("returns the minimal access capability and keeps collection/artifact execution unavailable", async () => {
    const routes = createTestingGroundsRoutes({ authorize: granted });
    const res = response(); await routes.access(request(), res);
    expect(res.json).toHaveBeenCalledWith({ access: "owner", workspace: "synthetic_preview", execution: "disabled" });
    for (const handler of [routes.collection, routes.run]) {
      const denied = response(); await handler(request("progress"), denied);
      expect(denied.json).toHaveBeenCalledWith({ error: "runner_not_connected" });
    }
  });
  it.each([null, { ownerUserId: "another-owner", runId: "run-1" }, { ownerUserId: ownerId, runId: "other-run" }])("withholds absent or mismatched resources: %j", async resource => {
    store.findOwned.mockResolvedValue(resource);
    const res = response(); await createTestingGroundsRoutes({ authorize: granted, store }).run(request("results"), res);
    expect(store.findOwned).toHaveBeenCalledWith(ownerId, "run-1");
    expect(res.json).toHaveBeenCalledWith({ error: "not_found" });
    expect(store.readSealed).not.toHaveBeenCalled(); expect(store.authorizeSealedRead).not.toHaveBeenCalled();
  });
  it.each(["running", "pending_outcomes", "cancelled", "failed", "completed_awaiting_reveal"])("seals all payload channels in %s despite client reveal flags", async state => {
    const routes = createTestingGroundsRoutes({ authorize: granted, store });
    for (const operation of ["logs", "results", "export"]) {
      const req = request(operation); req.body.state = state;
      const res = response(); await routes.run(req, res);
      expect(res.json).toHaveBeenCalledWith({ error: "results_sealed" });
    }
    expect(store.readSealed).not.toHaveBeenCalled(); expect(store.readOperational).not.toHaveBeenCalled();
  });
  it("requires separate trusted reveal authority for each sealed read", async () => {
    store.authorizeSealedRead.mockResolvedValue(true);
    const routes = createTestingGroundsRoutes({ authorize: granted, store });
    await routes.run(request("export"), response());
    expect(store.readSealed).toHaveBeenCalledWith(ownerId, "run-1", "export");
    store.authorizeSealedRead.mockResolvedValue(false);
    await routes.run(request("export"), response());
    expect(store.readSealed).toHaveBeenCalledTimes(1);
  });
  it("scopes history and operational reads to the verified owner", async () => {
    const routes = createTestingGroundsRoutes({ authorize: granted, store });
    await routes.collection(request(), response());
    expect(store.listOwned).toHaveBeenCalledWith(ownerId);
    for (const operation of ["progress", "health", "manifest"]) await routes.run(request(operation), response());
    expect(store.readOperational.mock.calls.map(args => args.slice(0, 2))).toEqual(Array(3).fill([ownerId, "run-1"]));
    expect(store.readSealed).not.toHaveBeenCalled();
  });
  it.each(["claim", "finish", "checkpoint", "toString", "", ["results", "export"]])("rejects unknown/ambiguous operation %s", async operation => {
    const req = request(); req.query.operation = operation;
    const res = response(); await createTestingGroundsRoutes({ authorize: granted, store }).run(req, res);
    expect(res.status).toHaveBeenCalledWith(404); expect(store.findOwned).not.toHaveBeenCalled();
  });
  it("rejects wrong methods and unsafe mutation requests, and never activates valid ones", async () => {
    const routes = createTestingGroundsRoutes({ authorize: granted, store, trustedOrigin: origin });
    for (const op of ["cancel", "retry", "reveal"]) {
      const get = response(); await routes.run(request(op), get); expect(get.status).toHaveBeenCalledWith(405);
      const post = response(); await routes.run(request(op, "POST"), post); expect(post.json).toHaveBeenCalledWith({ error: "runner_not_connected" });
    }
    for (const headers of [{ origin: "https://other.invalid" }, { origin: undefined }, { "sec-fetch-site": "cross-site" }, { "content-type": "text/plain" }]) {
      const req = request(undefined, "POST"); Object.assign(req.headers, headers);
      const res = response(); await routes.collection(req, res);
      expect(res.status).toHaveBeenCalledWith("content-type" in headers ? 415 : 403);
    }
    for (const trustedOrigin of [undefined, `${origin}/`, "null", "file:///tmp"]) {
      const res = response(); await createTestingGroundsRoutes({ authorize: granted, store, trustedOrigin }).collection(request(undefined, "POST"), res);
      expect(res.json).toHaveBeenCalledWith({ error: "mutation_not_configured" });
    }
    const res = response(); await routes.collection(request(undefined, "POST"), res);
    expect(res.json).toHaveBeenCalledWith({ error: "runner_not_connected" });
    for (const call of Object.values(store)) expect(call).not.toHaveBeenCalled();
  });
  it("redacts storage failures", async () => {
    store.findOwned.mockRejectedValueOnce(new Error("private-outcome-marker"));
    const res = response(); await createTestingGroundsRoutes({ authorize: granted, store }).run(request("progress"), res);
    expect(res.json).toHaveBeenCalledWith({ error: "testing_grounds_unavailable" });
  });
});

describe("validated run-store read adapter over the synthetic memory reference", () => {
  const OTHER = "11111111-1111-4111-8111-111111111112";
  const WORKER = "20000000-0000-4000-8000-000000000001";
  const ref = (letter: string) => ({ versionId: ownerId, contentHash: letter.repeat(64) });
  const plan = (historyClass: "synthetic" | "reconstructed_history_diagnostic" = "synthetic"): ExperimentPlan => ({
    version: "forge-testing-grounds-run-v1", baseline: ref("a"), candidate: ref("b"),
    inputManifest: { ...ref("c"), historyClass, knowledgeCutoffMs: 500, snapshots: [{ ...ref("d"), availableAtMs: 400, capturedAtMs: 450 }] },
    preflightReportHash: "e".repeat(64), chronologyContractHash: "f".repeat(64), evaluationContractHash: "0".repeat(64),
    work: [{ phase: "prediction", key: "synthetic-predictions" }, { phase: "evaluation", key: "synthetic-paired" }],
    reveal: { rule: "owner_after_completion_and_time", notBeforeMs: 2_000 },
    limits: { maxUnits: 10, stepTimeoutMs: 20, leaseMs: 100, maxRunMs: 10_000, maxExecutionsPerUnit: 3, maxFailuresPerUnit: 2,
      retryDelayMs: 5, maxOutputBytes: 1_000, maxCheckpointBytes: 1_000, maxStoredBytes: 100_000 },
  });
  async function accepted(historyClass?: "reconstructed_history_diagnostic") {
    const memory = new MemoryExperimentRunStore({ maxQueuedRuns: 4, maxConcurrentLeases: 1 });
    const { runId } = await memory.accept(ownerId, "request-1", plan(historyClass), 1_000);
    return { memory, runId };
  }
  async function complete(memory: ExperimentRunStore, runId: string) {
    for (const step of [0, 1]) {
      const reply = await runBoundedStep({ store: memory, ownerUserId: ownerId, runId, workerId: WORKER, now: () => 1_000,
        execute: async () => ({ kind: "completed", payload: { syntheticStep: step }, outcomeStatus: "settled" }) });
      expect(reply.status).toBe("accepted");
    }
  }
  async function call(store: ExperimentRunStore, runId: string | undefined, operation?: string, owner = ownerId, method = "GET") {
    const routes = createTestingGroundsRoutes({ authorize: async () => ({ allowed: true as const, ownerUserId: owner }),
      store: createRunStoreReadAdapter(store), trustedOrigin: origin });
    const req = request(operation, method); req.query.runId = runId;
    const res = response(); await (runId === undefined ? routes.collection : routes.run)(req, res);
    // A failed awaited read follows an already-evaluated status(200); the last call is the response.
    return { status: vi.mocked(res.status).mock.lastCall?.[0], body: vi.mocked(res.json).mock.lastCall?.[0] };
  }
  const unavailable = { status: 503, body: { error: "testing_grounds_unavailable" } };
  const sealed = { status: 403, body: { error: "results_sealed" } };

  it("lists and reads strict progress, keeps results sealed until synthetic reveal, and fabricates no other channel", async () => {
    const { memory, runId } = await accepted();
    const listed = await call(memory, undefined);
    expect(listed).toEqual({ status: 200, body: { runs: [await memory.progress(ownerId, runId)] } });
    expect(listed.body.runs[0]).toMatchObject({ state: "queued", storageMode: "memory_reference", lastEvent: "accepted" });
    for (const operation of ["results", "logs", "export"]) expect(await call(memory, runId, operation)).toEqual(sealed);
    await complete(memory, runId);
    const progress = await call(memory, runId, "progress");
    expect(progress.status).toBe(200);
    expect(progress.body).toMatchObject({ state: "completed_awaiting_reveal", lastEvent: "completed_sealed" });
    expect(progress.body.stages.map((stage: RunProgress["stages"][number]) => stage.percent)).toEqual([100, 100]);
    expect(JSON.stringify(progress.body)).not.toContain("syntheticStep");
    for (const operation of ["results", "logs", "export"]) expect(await call(memory, runId, operation)).toEqual(sealed);
    for (const operation of ["health", "manifest"]) expect(await call(memory, runId, operation)).toEqual(unavailable);
    expect(await memory.reveal(ownerId, runId, 2_000)).toBe(true);
    const results = await call(memory, runId, "results");
    expect(results.status).toBe(200);
    expect(results.body.status).toBe("revealed");
    expect(results.body.outputs.map((output: { payload: unknown }) => output.payload)).toEqual([{ syntheticStep: 0 }, { syntheticStep: 1 }]);
    for (const operation of ["logs", "export"]) expect(await call(memory, runId, operation)).toEqual(unavailable);
  });
  it("hides other owners' and unknown runs, and lists only the verified owner's runs", async () => {
    const { memory, runId } = await accepted();
    await memory.accept(OTHER, "request-1", plan(), 1_000);
    expect(await call(memory, runId, "progress", OTHER)).toEqual({ status: 404, body: { error: "not_found" } });
    expect(await call(memory, "30000000-0000-4000-8000-000000000003", "progress")).toEqual({ status: 404, body: { error: "not_found" } });
    const listed = await call(memory, undefined, undefined, OTHER);
    expect(listed.body.runs).toHaveLength(1);
    expect(listed.body.runs[0].runId).not.toBe(runId);
  });
  it("keeps completed real-history results sealed", async () => {
    const { memory, runId } = await accepted("reconstructed_history_diagnostic");
    await complete(memory, runId);
    expect(await memory.reveal(ownerId, runId, 5_000)).toBe(false);
    expect(await call(memory, runId, "results")).toEqual(sealed);
  });
  it.each<[string, (progress: RunProgress) => unknown]>([
    ["an unknown field", progress => ({ ...progress, unsafeAdapterMarker: "SYNTHETIC_OUTCOME" })],
    ["free-form event text", progress => ({ ...progress, lastEvent: "SYNTHETIC_OUTCOME" })],
    ["inflated successful work", progress => ({ ...progress, stages: progress.stages.map(stage => ({ ...stage, successful: stage.total })) })],
    ["a rounded-up percentage", progress => ({ ...progress, stages: progress.stages.map(stage => ({ ...stage, percent: 100 })) })],
    ["a claimed durable mode", progress => ({ ...progress, storageMode: "durable" })],
    ["an unfinished terminal state", progress => ({ ...progress, state: "completed_awaiting_reveal" })],
    ["a repeated stage", progress => ({ ...progress, stages: progress.stages.slice(0, 1).concat(progress.stages) })],
  ])("refuses a store projection with %s and reflects none of it", async (_label, poison) => {
    const { memory, runId } = await accepted();
    const store = Object.assign(Object.create(memory), {
      progress: async (owner: string, id: string) => poison(await memory.progress(owner, id)),
      list: async (owner: string) => Promise.all((await memory.list(owner)).map(poison)),
    }) as ExperimentRunStore;
    for (const reply of [await call(store, runId, "progress"), await call(store, undefined)]) {
      expect(reply).toEqual(unavailable);
      expect(JSON.stringify(reply)).not.toContain("SYNTHETIC_OUTCOME");
    }
  });
  it("refuses a per-run projection for another run and a listing that repeats a run", async () => {
    const { memory, runId } = await accepted();
    const store = Object.assign(Object.create(memory), {
      progress: async (owner: string, id: string) => ({ ...(await memory.progress(owner, id)), runId: "30000000-0000-4000-8000-000000000003" }),
      list: async (owner: string) => [...await memory.list(owner), ...await memory.list(owner)],
    }) as ExperimentRunStore;
    expect(await call(store, runId, "progress")).toEqual(unavailable);
    expect(await call(store, undefined)).toEqual(unavailable);
  });
  it("requires the results channel and the projection to agree before any sealed read", async () => {
    const { memory, runId } = await accepted();
    await complete(memory, runId);
    const early = Object.assign(Object.create(memory), {
      results: async () => ({ status: "revealed", outputs: [] }),
    }) as ExperimentRunStore;
    expect(await call(early, runId, "results")).toEqual(sealed);
    await memory.reveal(ownerId, runId, 2_000);
    const padded = Object.assign(Object.create(memory), {
      results: async (owner: string, id: string) => ({ ...(await memory.results(owner, id)), leakedOutcome: "SYNTHETIC_OUTCOME" }),
    }) as ExperimentRunStore;
    expect(await call(padded, runId, "results")).toEqual(sealed);
  });
  it("installing the adapter activates no mutation", async () => {
    const { memory, runId } = await accepted();
    const spies = (["accept", "claim", "finish", "cancel", "reveal"] as const).map(name => vi.spyOn(memory, name));
    for (const operation of ["cancel", "retry", "reveal"]) {
      expect(await call(memory, runId, operation, ownerId, "POST")).toEqual({ status: 503, body: { error: "runner_not_connected" } });
    }
    expect(await call(memory, undefined, undefined, ownerId, "POST")).toEqual({ status: 503, body: { error: "runner_not_connected" } });
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});
