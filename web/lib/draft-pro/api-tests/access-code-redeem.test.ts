import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());
vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: auth }));
vi.mock("lib/supabase/server", () => ({ default: { rpc } }));
import handler from "../../../pages/api/v1/account/draft-pro/access-codes/redeem";

function response() { const value: any = { statusCode: 200, setHeader: vi.fn() }; value.status = vi.fn((code: number) => { value.statusCode = code; return value; }); value.json = vi.fn((body: unknown) => { value.body = body; return value; }); return value; }
const request = (body: unknown = { code: "A".repeat(32) }) => ({ method: "POST", headers: {}, body } as any);

describe("Draft Pro access-code redemption route", () => {
  beforeEach(() => { vi.clearAllMocks(); auth.mockResolvedValue({ id: "user-1" }); });
  it("requires authentication", async () => { auth.mockResolvedValue(null); await handler(request(), response()); expect(rpc).not.toHaveBeenCalled(); });
  it("rejects malformed input generically", async () => { const res = response(); await handler(request({ code: "short" }), res); expect(res.statusCode).toBe(400); expect(res.body).toEqual({ error: "Code could not be redeemed." }); });
  it.each([["invalid", 400], ["rate_limited", 429], ["redeemed", 200]])("maps %s without leaking code state", async (status, expected) => { rpc.mockResolvedValue({ data: status, error: null }); const res = response(); await handler(request(), res); expect(res.statusCode).toBe(expected); expect(res.body).toEqual(expected === 200 ? { redeemed: true } : { error: "Code could not be redeemed." }); expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store"); if (expected === 429) expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "60"); expect(rpc).toHaveBeenCalledWith("redeem_draft_pro_access_code", { p_user_id: "user-1", p_code: "A".repeat(32) }); });
});
