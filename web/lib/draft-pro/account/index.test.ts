import { describe, expect, it, vi } from "vitest";

const loadAccess = vi.hoisted(() => vi.fn());
vi.mock("../server", () => ({ loadDraftProAccess: loadAccess }));
vi.mock("../features", () => ({ getDraftProFeatureFlags: () => ({ checkout: false, recommendations: false, dust: false, blended_csv: false, saved_drafts: false, private_imports: false, scenarios: false, reports: false }) }));

import { loadDraftProAccount } from "./index";

function result(data: unknown) {
  const query: any = { select: vi.fn(() => query), eq: vi.fn(() => query), order: vi.fn(async () => ({ data, error: null })) };
  return query;
}

describe("loadDraftProAccount", () => {
  it("returns owned summaries without metadata or draft payloads", async () => {
    loadAccess.mockResolvedValue({ eligible: false, providerReadiness: { stripe: false, patreon: false, yahoo: false } });
    const client = {
      from: vi.fn((table: string) => ({
        draft_pro_purchases: result([{ id: "purchase-1", season: "draft_pro_2026_27", status: "active", activated_at: "2026-09-01T00:00:00.000Z", expires_at: "2027-07-01T04:00:00.000Z", amount_cents: 599, currency: "usd", metadata: { receipt_url: "https://receipt.example/1", secret: "never-return" } }]),
        draft_pro_refund_requests: result([{ id: "refund-old", purchase_id: "purchase-1", reason: "other", status: "resolved", submitted_at: "2026-09-01T00:00:00.000Z", email_status: "sent" }]),
        draft_pro_drafts: result([{ id: "draft-1", name: "Retained work", status: "archived", updated_at: "2026-09-02T00:00:00.000Z" }]),
        draft_pro_private_imports: result([{ id: "import-1", name: "Private CSV", draft_id: "draft-1", byte_size: 22, updated_at: "2026-09-02T00:00:00.000Z" }]),
      } as Record<string, unknown>)[table]),
    } as any;
    const account = await loadDraftProAccount({ client, userId: "user-1", now: new Date("2026-09-02T00:00:00.000Z") });
    expect(account.purchases[0]).toEqual(expect.objectContaining({ id: "purchase-1", receiptUrl: "https://receipt.example/1", refundEligibility: expect.objectContaining({ eligible: true }) }));
    expect(JSON.stringify(account)).not.toContain("never-return");
    expect(account.savedDrafts).toEqual([{ id: "draft-1", name: "Retained work", status: "archived", updatedAt: "2026-09-02T00:00:00.000Z" }]);
  });

  it("does not open a refund window before activation or for an open request", async () => {
    loadAccess.mockResolvedValue({ eligible: true, providerReadiness: { stripe: true, patreon: true, yahoo: false } });
    const client = {
      from: vi.fn((table: string) => ({
        draft_pro_purchases: result([{ id: "future", season: "draft_pro_2026_27", status: "active", activated_at: "2026-09-03T00:00:00.000Z", expires_at: "2027-07-01T04:00:00.000Z", amount_cents: 599, currency: "usd", metadata: {} }, { id: "open", season: "draft_pro_2026_27", status: "active", activated_at: "2026-09-01T00:00:00.000Z", expires_at: "2027-07-01T04:00:00.000Z", amount_cents: 599, currency: "usd", metadata: {} }]),
        draft_pro_refund_requests: result([{ id: "refund-open", purchase_id: "open", reason: "other", status: "open", submitted_at: "2026-09-01T00:00:00.000Z", email_status: "pending" }]),
        draft_pro_drafts: result([]),
        draft_pro_private_imports: result([]),
      } as Record<string, unknown>)[table]),
    } as any;
    const account = await loadDraftProAccount({ client, userId: "user-1", now: new Date("2026-09-02T00:00:00.000Z") });
    expect(account.purchases.map((purchase) => purchase.refundEligibility.reason)).toEqual(["purchase_ineligible", "request_open"]);
  });
});
