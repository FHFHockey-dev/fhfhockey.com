import { describe, expect, it, vi } from "vitest";

const requireApiUser = vi.hoisted(() => vi.fn());
const createRefund = vi.hoisted(() => vi.fn());
vi.mock("lib/api/requireApiUser", () => ({ requireApiUser }));
vi.mock("lib/draft-pro/account/refunds", () => ({ createDraftProRefundRequest: createRefund }));

import handler from "./refund-requests";

function response() {
  const res: any = { statusCode: 200, setHeader: vi.fn(), status: vi.fn(function (this: any, code: number) { this.statusCode = code; return this; }), json: vi.fn(function (this: any, body: unknown) { this.body = body; return this; }) };
  return res;
}

const body = { purchaseId: "11111111-1111-4111-8111-111111111111", reason: "other", explanation: "This is a valid refund explanation." };

describe("Draft Pro refund request route", () => {
  it("passes only the verified API user email to the request service", async () => {
    requireApiUser.mockResolvedValue({ id: "user-1", email: "verified@example.com" });
    createRefund.mockResolvedValue({ id: "refund-1" });
    const res = response();
    await handler({ method: "POST", body, headers: {} } as any, res);
    expect(createRefund).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", accountEmail: "verified@example.com" }));
    expect(res.statusCode).toBe(201);
  });

  it("sanitizes unexpected provider failures", async () => {
    requireApiUser.mockResolvedValue({ id: "user-1", email: "verified@example.com" });
    createRefund.mockRejectedValue(Object.assign(new Error("provider token leaked"), { statusCode: 503, code: "provider_error" }));
    const res = response();
    await handler({ method: "POST", body, headers: {} } as any, res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: { code: "refund_request_failed", message: "Refund request could not be submitted." } });
  });
});
