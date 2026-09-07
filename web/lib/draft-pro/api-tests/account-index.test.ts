import { describe, expect, it, vi } from "vitest";

const requireApiUser = vi.hoisted(() => vi.fn());
const loadAccount = vi.hoisted(() => vi.fn());
vi.mock("lib/api/requireApiUser", () => ({ requireApiUser }));
vi.mock("lib/draft-pro/account", () => ({ loadDraftProAccount: loadAccount }));

import handler from "../../../pages/api/v1/account/draft-pro";

function response() {
  const res: any = { statusCode: 200, setHeader: vi.fn(), status: vi.fn(function (this: any, code: number) { this.statusCode = code; return this; }), json: vi.fn(function (this: any, body: unknown) { this.body = body; return this; }) };
  return res;
}

describe("Draft Pro account route", () => {
  it("loads only the authenticated account", async () => {
    requireApiUser.mockResolvedValue({ id: "user-1" });
    loadAccount.mockResolvedValue({ purchases: [], savedDrafts: [] });
    const res = response();
    await handler({ method: "GET", headers: {} } as any, res);
    expect(loadAccount).toHaveBeenCalledWith({ userId: "user-1" });
    expect(res.statusCode).toBe(200);
  });

  it("sanitizes account/provider errors", async () => {
    requireApiUser.mockResolvedValue({ id: "user-1" });
    loadAccount.mockRejectedValue(new Error("provider secret"));
    const res = response();
    await handler({ method: "GET", headers: {} } as any, res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: { code: "account_unavailable", message: "Draft Pro account details are unavailable." } });
  });
});
