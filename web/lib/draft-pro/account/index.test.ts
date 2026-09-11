import { describe, expect, it, vi } from "vitest";

const loadAccess = vi.hoisted(() => vi.fn());
const stripeConfigured = vi.hoisted(() => vi.fn(() => false));
const patreonConfigured = vi.hoisted(() => vi.fn(() => false));
vi.mock("../server", () => ({ loadDraftProAccess: loadAccess }));
vi.mock("../features", () => ({ getDraftProFeatureFlags: () => ({ checkout: false, recommendations: false, dust: false, blended_csv: false, saved_drafts: false, private_imports: false, scenarios: false, god_view: false, reports: false }) }));
vi.mock("lib/integrations/stripe/config", () => ({ isStripeConfigured: stripeConfigured }));
vi.mock("lib/integrations/patreon/config", () => ({ isPatreonConfigured: patreonConfigured }));

import { getDraftProCheckoutAvailability, loadDraftProAccount } from "./index";

function result(data: unknown, error: unknown = null) {
  const ordered: any = { data, error, limit: vi.fn(async () => ({ data, error })) };
  const query: any = { select: vi.fn(() => query), eq: vi.fn(() => query), in: vi.fn(() => query), not: vi.fn(() => query), order: vi.fn(() => ordered) };
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
        draft_pro_provider_events: result([]),
      } as Record<string, unknown>)[table]),
    } as any;
    const account = await loadDraftProAccount({ client, userId: "user-1", now: new Date("2026-09-02T00:00:00.000Z") });
    expect(account.purchases[0]).toEqual(expect.objectContaining({ id: "purchase-1", receiptUrl: "https://receipt.example/1", refundEligibility: expect.objectContaining({ eligible: true }) }));
    expect(JSON.stringify(account)).not.toContain("never-return");
    expect(account.availableFeatures).toEqual([]);
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
        draft_pro_provider_events: result([]),
      } as Record<string, unknown>)[table]),
    } as any;
    const account = await loadDraftProAccount({ client, userId: "user-1", now: new Date("2026-09-02T00:00:00.000Z") });
    expect(account.purchases.map((purchase) => purchase.refundEligibility.reason)).toEqual(["purchase_ineligible", "request_open"]);
  });

  it("uses the newest valid receipt from a matching Stripe provider event", async () => {
    loadAccess.mockResolvedValue({ eligible: false, providerReadiness: { stripe: false, patreon: false, yahoo: false } });
    const events = result([
      { provider: "stripe", user_id: "user-1", purchase_id: "purchase-1", receipt_url: "https://receipt.example/newest", provider_occurred_at: "2026-09-02T00:00:00.000Z" },
      { provider: "stripe", user_id: "user-1", purchase_id: "purchase-1", receipt_url: "https://receipt.example/older", provider_occurred_at: "2026-09-01T00:00:00.000Z" },
      { provider: "stripe", user_id: "other-user", purchase_id: "purchase-1", receipt_url: "https://receipt.example/wrong-user" },
      { provider: "stripe", user_id: "user-1", purchase_id: "other-purchase", receipt_url: "https://receipt.example/wrong-purchase" },
    ]);
    const client = { from: vi.fn((table: string) => ({
      draft_pro_purchases: result([{ id: "purchase-1", season: "draft_pro_2026_27", status: "active", activated_at: "2026-09-01T00:00:00.000Z", expires_at: "2027-07-01T04:00:00.000Z", amount_cents: 599, currency: "usd", metadata: {} }]),
      draft_pro_refund_requests: result([]), draft_pro_drafts: result([]), draft_pro_private_imports: result([]), draft_pro_provider_events: events,
    } as Record<string, unknown>)[table]) } as any;
    const account = await loadDraftProAccount({ client, userId: "user-1" });
    expect(account.purchases[0].receiptUrl).toBe("https://receipt.example/newest");
    expect(events.eq).toHaveBeenCalledWith("provider", "stripe");
    expect(events.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(events.in).toHaveBeenCalledWith("purchase_id", ["purchase-1"]);
    expect(events.not).toHaveBeenCalledWith("payload->>receipt_url", "is", null);
    expect(events.order.mock.results[0].value.limit).toHaveBeenCalledWith(100);
  });

  it("continues when the optional receipt history query fails", async () => {
    loadAccess.mockResolvedValue({ eligible: false, providerReadiness: { stripe: false, patreon: false, yahoo: false } });
    const client = { from: vi.fn((table: string) => ({
      draft_pro_purchases: result([{ id: "purchase-1", season: "draft_pro_2026_27", status: "active", activated_at: "2026-09-01T00:00:00.000Z", expires_at: "2027-07-01T04:00:00.000Z", amount_cents: 599, currency: "usd", metadata: {} }]),
      draft_pro_refund_requests: result([]), draft_pro_drafts: result([]), draft_pro_private_imports: result([]), draft_pro_provider_events: result(null, new Error("optional query failed")),
    } as Record<string, unknown>)[table]) } as any;
    await expect(loadDraftProAccount({ client, userId: "user-1" })).resolves.toMatchObject({ purchases: [expect.objectContaining({ receiptUrl: null })] });
  });
});

describe("Draft Pro checkout availability", () => {
  const beforeExpiry = new Date("2027-06-30T23:59:59.000Z");
  const afterExpiry = new Date("2027-07-01T04:00:00.000Z");
  const configured = { checkoutEnabled: true, stripeConfigured: true, siteUrlConfigured: true };

  it("is available only when flag, configuration, site URL, and time allow it", () => {
    expect(getDraftProCheckoutAvailability({ ...configured, now: beforeExpiry, eligible: false })).toEqual({ available: true, reason: "available" });
  });

  it.each([
    ["flag off", { checkoutEnabled: false }, "checkout_disabled"],
    ["Stripe unconfigured", { stripeConfigured: false }, "stripe_not_configured"],
    ["site URL missing", { siteUrlConfigured: false }, "site_url_not_configured"],
    ["already entitled", { eligible: true }, "already_eligible"],
    ["pass expired", {}, "pass_expired"],
  ])("returns a stable reason for %s", (_label, overrides, reason) => {
    expect(getDraftProCheckoutAvailability({ ...configured, now: reason === "pass_expired" ? afterExpiry : beforeExpiry, eligible: false, ...overrides })).toEqual({ available: false, reason });
  });
});
