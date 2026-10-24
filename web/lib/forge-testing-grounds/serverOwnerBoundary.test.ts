// @vitest-environment node
import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authorizeTestingGroundsOwner } from "./serverOwnerBoundary";

const auth = vi.hoisted(() => ({ getUser: vi.fn(), createClientWithToken: vi.fn() }));
vi.mock("lib/supabase", () => ({ createClientWithToken: auth.createClientWithToken }));
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
function request(authorization: unknown = "Bearer fixture-token") {
  return { headers: { authorization, host: "localhost:3000" }, rawHeaders: [],
    body: { userId: owner, role: "admin" }, query: { ownerUserId: owner, role: "admin" } } as unknown as NextApiRequest;
}
function response() {
  return { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as NextApiResponse;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected external request"); }));
  auth.createClientWithToken.mockReturnValue({ auth: { getUser: auth.getUser } });
  auth.getUser.mockResolvedValue({ data: { user: { id: owner, email: "private-marker" } }, error: null });
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });

describe("verified Testing Grounds owner boundary", () => {
  it.each([undefined, null, "", "not-a-uuid", ` ${owner}`, "00000000-0000-0000-0000-000000000000"])("denies invalid owner configuration %s before the provider", async configured => {
    const res = response();
    expect(await authorizeTestingGroundsOwner(request(), res, { ownerUserId: configured })).toBeNull();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(auth.createClientWithToken).not.toHaveBeenCalled();
  });
  it.each([undefined, "", "fixture-token", "Bearer ", "Bearer fixture-token ", "Bearer a,b", "Bearer a\nb", ["Bearer a", "Bearer b"]])("rejects malformed bearer %s without verifying claims", async header => {
    const req = request(); req.headers.authorization = header as string;
    const res = response();
    expect(await authorizeTestingGroundsOwner(req, res, { ownerUserId: owner })).toBeNull();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(auth.createClientWithToken).not.toHaveBeenCalled();
  });
  it("rejects duplicate raw authorization headers", async () => {
    const req = request(); req.rawHeaders = ["Authorization", "Bearer a", "authorization", "Bearer b"];
    const res = response(); await authorizeTestingGroundsOwner(req, res, { ownerUserId: owner });
    expect(res.status).toHaveBeenCalledWith(401); expect(auth.getUser).not.toHaveBeenCalled();
  });
  it("calls the existing real helper with the token and keeps only verified owner identity", async () => {
    const req = request(); const res = response();
    expect(await authorizeTestingGroundsOwner(req, res, { ownerUserId: owner })).toEqual({ allowed: true, ownerUserId: owner });
    expect(auth.createClientWithToken).toHaveBeenCalledWith("fixture-token");
    expect(auth.getUser).toHaveBeenCalledWith("fixture-token");
    expect(res.json).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store, max-age=0");
  });
  it("does not grant another verified admin, forged fields, cron or localhost authority", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: other, role: "admin" } }, error: null });
    const req = request("Bearer cron-secret"); req.headers["x-forwarded-host"] = "localhost";
    const res = response(); expect(await authorizeTestingGroundsOwner(req, res, { ownerUserId: owner })).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "forbidden" });
  });
  it("re-verifies each request; an expired or revoked token does not retain previous access", async () => {
    await authorizeTestingGroundsOwner(request(), response(), { ownerUserId: owner });
    auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error("private-token-marker") });
    const res = response(); expect(await authorizeTestingGroundsOwner(request(), res, { ownerUserId: owner })).toBeNull();
    expect(auth.getUser).toHaveBeenCalledTimes(2); expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "unauthenticated" });
  });
  it("redacts thrown provider failures", async () => {
    auth.getUser.mockRejectedValue(new Error("private-token-marker"));
    const res = response(); await authorizeTestingGroundsOwner(request(), res, { ownerUserId: owner });
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: "verification_unavailable" });
  });
});
