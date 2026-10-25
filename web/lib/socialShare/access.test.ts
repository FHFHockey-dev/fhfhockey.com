import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getUser: vi.fn(), role: vi.fn(), eq: vi.fn(), from: vi.fn() }));
vi.mock("lib/supabase", () => ({ createClientWithToken: vi.fn(() => ({
  auth: { getUser: auth.getUser },
  from: auth.from,
})) }));
vi.mock("lib/supabase/server", () => ({ default: {} }));
const source = vi.hoisted(() => ({ loadScheduleShareSnapshot: vi.fn() }));
vi.mock("lib/socialShare/server", () => ({ ...source, SocialShareRequestError: class extends Error {} }));
import { createClientWithToken } from "lib/supabase";
import handler from "pages/api/v1/social-share/[format]";
import adminOnly from "utils/adminOnlyMiddleware";
import { isSocialShareRole, SOCIAL_SHARE_CACHE_CONTROL } from "./access";
import { SOCIAL_SHARE_FORMATS } from "./types";

function response() {
  return { code: 0, body: null as any, headers: {} as Record<string, string>,
    setHeader(name: string, value: string) { this.headers[name] = value; },
    status(code: number) { this.code = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
}
async function request(overrides: Partial<NextApiRequest> = {}) {
  const res = response();
  await handler({ method: "GET", query: { format: "game-grid" }, headers: { authorization: "Bearer synthetic-token" }, ...overrides } as NextApiRequest, res as unknown as NextApiResponse);
  expect(res.headers["Cache-Control"]).toBe(SOCIAL_SHARE_CACHE_CONTROL);
  expect(res.headers.Vary).toBe("Authorization");
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.getUser.mockResolvedValue({ data: { user: { id: "verified-user", user_metadata: { role: "admin" }, app_metadata: { role: "admin" } } }, error: null });
  auth.role.mockResolvedValue({ data: { role: "social_editor" }, error: null });
  auth.eq.mockReturnValue({ maybeSingle: auth.role });
  auth.from.mockReturnValue({ select: () => ({ eq: auth.eq }) });
  source.loadScheduleShareSnapshot.mockResolvedValue({ state: "ready" });
});

describe("social editor edition boundary", () => {
  it.each(["social_editor", "admin"])("allows exact stored role %s after verifying the token and user id", async role => {
    auth.role.mockResolvedValueOnce({ data: { role }, error: null });
    expect((await request()).code).toBe(200);
    expect(createClientWithToken).toHaveBeenCalledWith("synthetic-token");
    expect(auth.getUser).toHaveBeenCalledWith("synthetic-token");
    expect(auth.from).toHaveBeenCalledWith("users");
    expect(auth.eq).toHaveBeenCalledWith("user_id", "verified-user");
    expect(auth.role.mock.invocationCallOrder[0]).toBeLessThan(source.loadScheduleShareSnapshot.mock.invocationCallOrder[0]);
  });

  it.each([undefined, "", "Bearer", "Bearer a b", "Basic synthetic-token", ["Bearer synthetic-token"]])("rejects malformed or absent credentials %j before reads", async authorization => {
    expect((await request({ headers: { authorization } as NextApiRequest["headers"] })).code).toBe(401);
    expect(auth.getUser).not.toHaveBeenCalled();
    expect(source.loadScheduleShareSnapshot).not.toHaveBeenCalled();
  });

  it("rejects duplicate authorization headers", async () => {
    expect((await request({ rawHeaders: ["Authorization", "Bearer synthetic-token", "authorization", "Bearer other"] })).code).toBe(401);
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it.each([{ data: { user: null }, error: null }, { data: { user: { id: "forged-user" } }, error: { message: "expired" } }])("rejects invalid/expired sessions before role and edition reads", async result => {
    auth.getUser.mockResolvedValueOnce(result);
    expect((await request()).code).toBe(401);
    expect(auth.from).not.toHaveBeenCalled();
    expect(source.loadScheduleShareSnapshot).not.toHaveBeenCalled();
  });

  it.each([null, "basic", "developer", "social-editor", "ADMIN", "social_editor ", ["social_editor"]])("denies missing or unapproved stored role %j despite metadata claims", async role => {
    auth.role.mockResolvedValueOnce({ data: role === null ? null : { role }, error: null });
    expect((await request()).code).toBe(403);
    expect(source.loadScheduleShareSnapshot).not.toHaveBeenCalled();
    expect(isSocialShareRole(role)).toBe(false);
  });

  it.each(["returned", "rejected"])("fails closed on %s role lookup errors, including duplicate rows", async mode => {
    const error = new Error("private duplicate/database detail");
    if (mode === "returned") auth.role.mockResolvedValueOnce({ data: { role: "admin" }, error });
    else auth.role.mockRejectedValueOnce(error);
    const res = await request();
    expect(res.code).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain("private");
    expect(source.loadScheduleShareSnapshot).not.toHaveBeenCalled();
  });

  it("fails closed on Auth service failure", async () => {
    auth.getUser.mockRejectedValueOnce(new Error("private auth detail"));
    expect((await request()).code).toBe(503);
    expect(source.loadScheduleShareSnapshot).not.toHaveBeenCalled();
  });

  it("allows only the five existing GET formats, without granting mutations or future routes", async () => {
    for (const format of SOCIAL_SHARE_FORMATS) expect((await request({ query: { format } })).code).toBe(200);
    source.loadScheduleShareSnapshot.mockClear();
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "HEAD"]) expect((await request({ method })).code).toBe(405);
    expect((await request({ query: { format: "publish" } })).code).toBe(404);
    expect((await request({ query: { format: "game-grid", action: "publish" } })).code).toBe(400);
    expect(source.loadScheduleShareSnapshot).not.toHaveBeenCalled();
  });

  it("keeps source failures private and uncached", async () => {
    source.loadScheduleShareSnapshot.mockRejectedValueOnce(new Error("private source detail"));
    const res = await request();
    expect(res.code).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain("private");
  });

  it("does not turn a social editor into an administrator", async () => {
    const adminHandler = vi.fn();
    const res = response();
    await adminOnly(adminHandler)({ method: "GET", headers: { authorization: "Bearer synthetic-token" } } as any, res as unknown as NextApiResponse);
    expect(res.code).toBe(403);
    expect(adminHandler).not.toHaveBeenCalled();
  });
});
