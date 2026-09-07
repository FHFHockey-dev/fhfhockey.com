import { describe, expect, it, vi } from "vitest";

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
  it("does not treat an old or free generic supporter row as a Draft Pro grant", async () => {
    const access = await loadDraftProAccess("user-1", {
      now: new Date("2026-09-07T01:00:00Z"),
      patreonVerificationAvailable: true,
      flags,
      client: clientWith([{ source_provider: "patreon", entitlement_key: "patreon_supporter", entitlement_status: "active", effective_from: "2026-09-01T00:00:00Z", effective_to: null, metadata: { verified_at: "2026-09-07T00:30:00Z" } }]),
    });
    expect(access).toMatchObject({ eligible: false, reason: "no_active_grant" });
    expect(mocks.refreshPatreonAccount).not.toHaveBeenCalled();
  });

  it("uses only a server-written paid eligibility marker on the retained membership row", async () => {
    const access = await loadDraftProAccess("user-1", {
      now: new Date("2026-09-07T01:00:00Z"),
      patreonVerificationAvailable: true,
      flags,
      client: clientWith([{ source_provider: "patreon", entitlement_key: "patreon_supporter", entitlement_status: "active", effective_from: "2026-09-01T00:00:00Z", effective_to: null, metadata: { draft_pro_eligible: true, verified_at: "2026-09-07T00:30:00Z" } }]),
    });
    expect(access).toMatchObject({ eligible: true, grantingSources: ["patreon"] });
  });
});
