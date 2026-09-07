import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), refreshPatreonAccount: vi.fn() }));
vi.mock("lib/supabase/server", () => ({ default: { from: mocks.from } }));
vi.mock("lib/integrations/patreon/sync", () => ({ refreshPatreonAccount: mocks.refreshPatreonAccount }));

import { loadDraftProAccess } from "./server";

const flags = { checkout: true, recommendations: true, dust: true, blended_csv: true, saved_drafts: true, private_imports: true, scenarios: true, reports: true };

function clientWith(rows: unknown[]) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return { from: vi.fn(() => query) } as any;
}

describe("Draft Pro Patreon source mapping", () => {
  beforeEach(() => vi.clearAllMocks());
  it("does not treat an old or free generic supporter row as a Draft Pro grant", async () => {
    const access = await loadDraftProAccess("user-1", {
      now: new Date("2026-09-07T01:00:00Z"),
      patreonVerificationAvailable: true,
      flags,
      client: clientWith([{ source_provider: "patreon", entitlement_key: "patreon_supporter", source_account_id: "account-1", entitlement_status: "active", effective_from: "2026-09-01T00:00:00Z", effective_to: null, metadata: { verified_at: "2026-09-07T00:30:00Z" } }]),
    });
    expect(access).toMatchObject({ eligible: false, reason: "no_active_grant" });
    expect(mocks.refreshPatreonAccount).not.toHaveBeenCalled();
  });

  it("uses only a server-written paid eligibility marker on the retained membership row", async () => {
    const access = await loadDraftProAccess("user-1", {
      now: new Date("2026-09-07T01:00:00Z"),
      patreonVerificationAvailable: true,
      flags,
      client: clientWith([{ source_provider: "patreon", entitlement_key: "patreon_supporter", source_account_id: "account-1", entitlement_status: "active", effective_from: "2026-09-01T00:00:00Z", effective_to: null, metadata: { draft_pro_eligible: true, connected_account_id: "account-1", verified_at: "2026-09-07T00:30:00Z" } }]),
    });
    expect(access).toMatchObject({ eligible: true, grantingSources: ["patreon"] });
  });

  it("does not authorize a grant from a deleted or replaced account generation", async () => {
    const access = await loadDraftProAccess("user-1", {
      now: new Date("2026-09-07T01:00:00Z"), patreonVerificationAvailable: true, flags,
      client: clientWith([{ source_provider: "patreon", entitlement_key: "patreon_supporter", source_account_id: "account-new", entitlement_status: "active", effective_from: "2026-09-01T00:00:00Z", effective_to: null, metadata: { draft_pro_eligible: true, connected_account_id: "account-old", verified_at: "2026-09-07T00:30:00Z" } }]),
    });
    expect(access.eligible).toBe(false);
  });

  it("reverifies a current retained membership even when its prior marker is false", async () => {
    const row = { source_provider: "patreon", entitlement_key: "patreon_supporter", source_account_id: "account-1", entitlement_status: "inactive", effective_from: "2026-09-01T00:00:00Z", effective_to: "2026-09-06T00:00:00Z", metadata: { draft_pro_eligible: false, connected_account_id: "account-1", verified_at: "2026-09-06T00:00:00Z" } };
    await loadDraftProAccess("user-1", { now: new Date("2026-09-07T01:00:00Z"), patreonVerificationAvailable: true, flags, client: clientWith([row]) });
    expect(mocks.refreshPatreonAccount).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1" }));
  });

  it("retains an active Patreon grant after a refunded Stripe purchase", async () => {
    const access = await loadDraftProAccess("user-1", {
      now: new Date("2026-09-07T01:00:00Z"), patreonVerificationAvailable: true, flags,
      client: clientWith([
        { source_provider: "stripe", entitlement_key: "draft_pro", source_account_id: null, entitlement_status: "inactive", effective_from: "2026-09-01T00:00:00Z", effective_to: "2027-07-01T04:00:00Z", metadata: { payment_state: "refunded" } },
        { source_provider: "patreon", entitlement_key: "patreon_supporter", source_account_id: "account-1", entitlement_status: "active", effective_from: "2026-09-01T00:00:00Z", effective_to: null, metadata: { draft_pro_eligible: true, connected_account_id: "account-1", verified_at: "2026-09-07T00:30:00Z" } },
      ]),
    });
    expect(access).toMatchObject({ eligible: true, grantingSources: ["patreon"] });
  });

  it("keeps a current paid purchase eligible when stale Patreon revalidation fails", async () => {
    mocks.refreshPatreonAccount.mockRejectedValueOnce(new Error("provider unavailable"));
    const access = await loadDraftProAccess("user-1", {
      now: new Date("2026-09-07T01:00:00Z"), patreonVerificationAvailable: true, flags,
      client: clientWith([
        { source_provider: "stripe", entitlement_key: "draft_pro", source_account_id: null, entitlement_status: "active", effective_from: "2026-09-01T00:00:00Z", effective_to: "2027-07-01T04:00:00Z", metadata: {} },
        { source_provider: "patreon", entitlement_key: "patreon_supporter", source_account_id: "account-1", entitlement_status: "active", effective_from: "2026-09-01T00:00:00Z", effective_to: null, metadata: { draft_pro_eligible: true, connected_account_id: "account-1", verified_at: "2026-09-06T00:00:00Z" } },
      ]),
    });
    expect(access).toMatchObject({ eligible: true, grantingSources: ["purchase"] });
  });
});
