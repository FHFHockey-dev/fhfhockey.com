// @vitest-environment node
import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authorizeTestingGroundsOwner } from "../../../../web/lib/forge-testing-grounds/serverOwnerBoundary";
import { createTestingGroundsRoutes, type OwnerReadStore } from "../../../../web/lib/forge-testing-grounds/ownerRoutes";
const auth = vi.hoisted(() => ({ getUser: vi.fn(), factory: vi.fn() }));
vi.mock("lib/supabase", () => ({ createClientWithToken: auth.factory }));
const OWNER = "88888888-8888-4888-8888-888888888881", OTHER = "88888888-8888-4888-8888-888888888882";
const origin = "http://localhost:3000";
function req(operation = "progress", method = "GET"): NextApiRequest {
  return { method, headers: { authorization: "Bearer synthetic-token", origin, "content-type": "application/json" }, rawHeaders: [],
    query: { operation, runId: "review-run", owner: OWNER, revealed: "true", state: "completed_revealed" }, body: { role: "admin", revealed: true } } as unknown as NextApiRequest;
}
function res() { return { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as NextApiResponse; }
const authorize = (request: NextApiRequest, response: NextApiResponse) => authorizeTestingGroundsOwner(request, response, { ownerUserId: OWNER });
function adapter() {
  return { listOwned: vi.fn().mockResolvedValue([]), findOwned: vi.fn().mockResolvedValue({ ownerUserId: OWNER, runId: "review-run" }),
    readOperational: vi.fn().mockResolvedValue({ operational: true }), authorizeSealedRead: vi.fn().mockResolvedValue(false), readSealed: vi.fn(),
    claim: vi.fn(), finish: vi.fn(), cancel: vi.fn(), retry: vi.fn(), reveal: vi.fn() } satisfies OwnerReadStore & Record<string, unknown>;
}
beforeEach(() => {
  vi.clearAllMocks(); auth.factory.mockReturnValue({ auth: { getUser: auth.getUser } });
  auth.getUser.mockResolvedValue({ data: { user: { id: OWNER, email: "SYNTHETIC_PRIVATE_EMAIL" } }, error: null });
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Offline test forbids network"); }));
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });

describe("Independent offline server boundary controls", () => {
  it("denies normalized malformed/duplicate credentials before provider construction, without reflecting raw headers", async () => {
    for (const authorization of [null, ["Bearer a", "Bearer b"], "Bearer a\tb", "Bearer a\r\nSYNTHETIC_SECRET", "Bearer a,b", "Bearer a b"]) {
      const request = req(); request.headers.authorization = authorization as string; const response = res();
      expect(await authorize(request, response)).toBeNull(); expect(response.status).toHaveBeenCalledWith(401); expect(auth.factory).not.toHaveBeenCalled();
      expect(JSON.stringify(vi.mocked(response.json).mock.calls)).not.toContain("SYNTHETIC_SECRET");
    }
    const duplicate = req(); duplicate.rawHeaders = ["aUtHoRiZaTiOn", "Bearer a", "AUTHORIZATION", "Bearer b"];
    const response = res(); expect(await authorize(duplicate, response)).toBeNull(); expect(response.status).toHaveBeenCalledWith(401); expect(auth.factory).not.toHaveBeenCalled();
  });
  it("normalizes verifier construction/errors/malformed identities to generic denials, with no cached previous allow", async () => {
    expect(await authorize(req(), res())).toEqual({ allowed: true, ownerUserId: OWNER });
    for (const value of [{ data: { user: { id: OTHER, role: "admin" } }, error: null }, { data: { user: { id: "SYNTHETIC_SECRET" } }, error: null },
      { data: { user: null }, error: new Error("SYNTHETIC_SECRET") }, { data: null, error: null }]) {
      auth.getUser.mockResolvedValue(value); const response = res(); expect(await authorize(req(), response)).toBeNull();
      expect(JSON.stringify(vi.mocked(response.json).mock.calls)).not.toContain("SYNTHETIC_SECRET");
    }
    auth.factory.mockImplementation(() => { throw new Error("SYNTHETIC_SECRET"); }); const response = res();
    expect(await authorize(req(), response)).toBeNull(); expect(response.json).toHaveBeenCalledWith({ error: "verification_unavailable" });
  });
  it("uses actual mocked-helper owner verification but never calls a runner/store mutation even for valid action requests", async () => {
    const store = adapter(), routes = createTestingGroundsRoutes({ authorize, store, trustedOrigin: origin });
    const responses = [];
    for (const operation of ["launch", "cancel", "retry", "reveal"]) {
      const response = res(); responses.push(response); await (operation === "launch" ? routes.collection : routes.run)(req(operation, "POST"), response);
      expect(response.json).toHaveBeenCalledWith({ error: "runner_not_connected" });
      expect(response.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store, max-age=0");
    }
    expect(auth.getUser).toHaveBeenCalledTimes(4); for (const call of Object.values(store)) expect(call).not.toHaveBeenCalled();
  });
  it("rejects ambiguous resource IDs/ownership and requires a literal trusted true for every sealed channel", async () => {
    const store = adapter(), routes = createTestingGroundsRoutes({ authorize, store });
    for (const runId of [undefined, ["a", "b"], "../review-run", "x".repeat(129)]) {
      const request = req("results"); request.query.runId = runId; const response = res(); await routes.run(request, response);
      expect(response.json).toHaveBeenCalledWith({ error: "not_found" });
    }
    expect(store.findOwned).not.toHaveBeenCalled(); store.findOwned.mockResolvedValueOnce({ ownerUserId: OTHER, runId: "review-run" });
    await routes.run(req("results"), res()); expect(store.readSealed).not.toHaveBeenCalled(); expect(store.authorizeSealedRead).not.toHaveBeenCalled();
    for (const permission of [false, null, "true", 1, {}]) for (const operation of ["logs", "results", "export"]) {
      store.authorizeSealedRead.mockResolvedValue(permission); const response = res(); await routes.run(req(operation), response);
      expect(response.json).toHaveBeenCalledWith({ error: "results_sealed" });
    }
    expect(store.readSealed).not.toHaveBeenCalled();
  });
  it("redacts adapter errors while demonstrating that future operational payload validation belongs to the currently unwired adapter", async () => {
    const store = adapter(), routes = createTestingGroundsRoutes({ authorize, store });
    store.authorizeSealedRead.mockRejectedValueOnce(new Error("SYNTHETIC_PRIVATE_OUTCOME")); const denied = res(); await routes.run(req("results"), denied);
    expect(denied.json).toHaveBeenCalledWith({ error: "testing_grounds_unavailable" }); expect(store.readSealed).not.toHaveBeenCalled();
    // An intentionally unsafe trusted adapter is observable here. Default exported
    // routes have no adapter; this is a limit of the seam, not real data acceptance.
    store.readOperational.mockResolvedValueOnce({ unsafeAdapterMarker: "SYNTHETIC_OUTCOME" }); const reply = res(); await routes.run(req("progress"), reply);
    expect(reply.json).toHaveBeenCalledWith({ unsafeAdapterMarker: "SYNTHETIC_OUTCOME" });
  });
});
