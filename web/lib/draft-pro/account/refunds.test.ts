import { describe, expect, it, vi } from "vitest";

const resendSend = vi.hoisted(() => vi.fn());
vi.mock("resend", () => ({ Resend: vi.fn(() => ({ emails: { send: resendSend } })) }));

import { createDraftProRefundRequest, retryDraftProRefundEmails } from "./refunds";

function query(result: unknown) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
  };
  return builder;
}

function clientFor({ purchase, inserted, insertError = null, existing }: { purchase: unknown; inserted?: unknown; insertError?: unknown; existing?: unknown }) {
  const purchaseQuery = query({ data: purchase, error: null });
  const insertQuery: any = {
    insert: vi.fn(() => insertQuery),
    select: vi.fn(() => insertQuery),
    single: vi.fn(async () => ({ data: inserted, error: insertError })),
    maybeSingle: vi.fn(async () => ({ data: existing, error: null })),
    update: vi.fn(() => insertQuery),
    eq: vi.fn(() => insertQuery),
    in: vi.fn(() => insertQuery),
  };
  const updateQuery: any = { update: vi.fn(() => updateQuery), eq: vi.fn(() => updateQuery) };
  return {
    from: vi.fn((table: string) => table === "draft_pro_purchases" ? purchaseQuery : table === "draft_pro_refund_requests" ? insertQuery : updateQuery),
    updateQuery,
  } as any;
}

const input = {
  purchaseId: "11111111-1111-4111-8111-111111111111",
  reason: "technical_issue" as const,
  explanation: "The account panel could not load my saved draft.",
};
const purchase = { id: input.purchaseId, user_id: "user-1", status: "active", activated_at: "2026-09-05T00:00:00.000Z" };

describe("Draft Pro refund requests", () => {
  it("rejects a purchase owned by another user", async () => {
    await expect(createDraftProRefundRequest({ userId: "user-2", accountEmail: "user@example.com", input, client: clientFor({ purchase: { ...purchase, user_id: "user-1" } }) })).rejects.toMatchObject({ statusCode: 404, code: "purchase_not_found" });
  });

  it("enforces the 168-hour deadline from activation", async () => {
    await expect(createDraftProRefundRequest({ userId: "user-1", accountEmail: "user@example.com", input, now: new Date("2026-09-12T00:00:01.000Z"), client: clientFor({ purchase }) })).rejects.toMatchObject({ statusCode: 422, code: "refund_window_closed" });
  });

  it("returns a conflict for the unique open-request race", async () => {
    await expect(createDraftProRefundRequest({ userId: "user-1", accountEmail: "user@example.com", input, client: clientFor({ purchase, insertError: { code: "23505", message: "duplicate" } }) })).rejects.toMatchObject({ statusCode: 409, code: "refund_request_exists" });
  });

  it("returns the owned open request idempotently after a unique race", async () => {
    const result = await createDraftProRefundRequest({ userId: "user-1", accountEmail: "user@example.com", input, client: clientFor({ purchase, insertError: { code: "23505", message: "duplicate" }, existing: { id: "refund-existing", status: "open", email_status: "failed" } }) });
    expect(result).toMatchObject({ id: "refund-existing", duplicate: true, emailStatus: "failed" });
  });

  it("retains the request when email delivery fails", async () => {
    const client = clientFor({ purchase, inserted: { id: "refund-1", status: "open", email_status: "pending" } });
    const mailer = vi.fn().mockRejectedValue(new Error("mailer unavailable"));
    const result = await createDraftProRefundRequest({ userId: "user-1", accountEmail: "user@example.com", input, client, mailer });
    expect(result).toMatchObject({ id: "refund-1", emailStatus: "failed" });
    expect(mailer).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "draft-pro-refund-refund-1", html: expect.stringContaining("user@example.com") }));
    expect(client.from.mock.results[1]?.value.update).toHaveBeenCalledWith(expect.objectContaining({ email_status: "failed" }));
  });

  it("retries failed email with server-resolved account context", async () => {
    const pending: any = { select: vi.fn(() => pending), in: vi.fn(() => pending), eq: vi.fn(() => pending), order: vi.fn(() => pending), limit: vi.fn(async () => ({ data: [{ id: "refund-2", user_id: "user-1", purchase_id: input.purchaseId, reason: input.reason, explanation: input.explanation, improvement_notes: null, used_during_live_draft: null, email_attempts: 1 }], error: null })) };
    const purchaseQuery: any = { select: vi.fn(() => purchaseQuery), eq: vi.fn(() => purchaseQuery), maybeSingle: vi.fn(async () => ({ data: { activated_at: purchase.activated_at }, error: null })) };
    const updateQuery: any = { update: vi.fn(() => updateQuery), eq: vi.fn(() => updateQuery) };
    let refundCalls = 0;
    const client = { from: vi.fn((table: string) => table === "draft_pro_refund_requests" ? (++refundCalls === 1 ? pending : updateQuery) : purchaseQuery) } as any;
    const mailer = vi.fn().mockResolvedValue({ id: "email-2" });
    const result = await retryDraftProRefundEmails({ client, mailer, accountEmailResolver: async () => "user@example.com", limit: 1 });
    expect(result).toMatchObject({ attempted: 1, sent: 1, failed: 0 });
    expect(mailer).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "draft-pro-refund-refund-2", html: expect.stringContaining("user@example.com") }));
    expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({ email_status: "sent", email_attempts: 2 }));
  });

  it("passes the request idempotency key through Resend options", async () => {
    const originalKey = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = "test-resend-key";
    resendSend.mockResolvedValue({ data: { id: "email-3" }, error: null });
    const client = clientFor({ purchase, inserted: { id: "refund-3", status: "open", email_status: "pending" } });
    await createDraftProRefundRequest({ userId: "user-1", accountEmail: "user@example.com", input, client });
    expect(resendSend).toHaveBeenCalledWith(expect.objectContaining({ subject: "FHFH Draft Pro refund request refund-3" }), { idempotencyKey: "draft-pro-refund-refund-3" });
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
    resendSend.mockReset();
  });
});
