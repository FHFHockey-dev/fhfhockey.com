// @vitest-environment node
import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestingGroundsRoutes, type OwnerReadStore } from "./ownerRoutes";
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
