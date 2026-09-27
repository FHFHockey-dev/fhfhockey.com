import { describe, expect, it, vi } from "vitest";
import { IN_SEASON_CAPABILITIES, resolveInSeasonAccess, type InSeasonGrant } from "./access";

vi.mock("lib/supabase/server", () => ({ default: {} }));
vi.mock("lib/integrations/patreon/sync", () => ({ refreshPatreonAccount: vi.fn() }));

import { loadInSeasonAccess } from "./server";

const now = new Date("2026-09-26T12:00:00Z");
const grant = (source: InSeasonGrant["source"], overrides: Partial<InSeasonGrant> = {}): InSeasonGrant => ({ source, reference: `${source}:one`, status: "active", effectiveFrom: "2026-09-01T00:00:00Z", effectiveTo: "2027-07-01T00:00:00Z", ...overrides });

describe("in-season grants", () => {
  it("unions independent active sources without letting an expired grant revoke another", () => {
    const access = resolveInSeasonAccess([grant("purchase", { effectiveTo: "2026-09-25T00:00:00Z" }), grant("common_preview")], now);
    expect(access.grantingSources).toEqual(["common_preview"]);
    expect(access.capabilities).toContain("rso_account_save");
  });
  it("rejects malformed, future, revoked and stale Patreon grants", () => {
    expect(resolveInSeasonAccess([grant("purchase", { effectiveFrom: "broken" }), grant("purchase", { effectiveFrom: "2026-02-31T00:00:00Z" }), grant("purchase", { effectiveTo: null }), grant("grandfather", { effectiveFrom: "2026-10-01T00:00:00Z" }), grant("common_preview", { status: "revoked" }), grant("patreon", { verifiedAt: "2026-09-26T10:00:00Z" })], now).eligible).toBe(false);
  });
  it("accepts freshly verified Patreon while other grants remain independent", () => {
    const access = resolveInSeasonAccess([grant("patreon", { verifiedAt: "2026-09-26T11:30:00Z", effectiveTo: null }), grant("purchase", { status: "revoked" })], now);
    expect(access.grantingSources).toEqual(["patreon"]);
    expect(access.expiresAt).toBeNull();
  });
});

describe("verified owner testing access", () => {
  function clientWith(user: Record<string, unknown> | null, error: unknown = null, grants: unknown[] = []) {
    const from = vi.fn((table: string) => {
      const query: any = { select: () => query, eq: () => query, then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: table === "in_season_grants" ? grants : [], error: null }).then(resolve) };
      return query;
    });
    return { auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user }, error }) } }, from } as any;
  }

  it.each(["timbranson515@gmail.com", "fiveholefantasyhockey@gmail.com"])("allows %s without a subscription or a seasonal grant", async (email) => {
    const client = clientWith({ id: "owner", email, email_confirmed_at: "2026-09-01" });
    const access = await loadInSeasonAccess("owner", { now, client });
    expect(access).toEqual({ eligible: true, capabilities: [...IN_SEASON_CAPABILITIES], grantingSources: ["owner_testing"], expiresAt: null, reason: "eligible" });
    expect(client.auth.admin.getUserById).toHaveBeenCalledWith("owner");
    expect(client.from).not.toHaveBeenCalled();
  });

  it.each([
    { id: "owner", email: "timbranson515@gmail.com", email_confirmed_at: null },
    { id: "other", email: "timbranson515@gmail.com", email_confirmed_at: "2026-09-01" },
    { id: "owner", email: "other@example.com", email_confirmed_at: "2026-09-01", user_metadata: { email: "timbranson515@gmail.com", owner: true } },
    null,
  ])("does not grant testing access to an unverified or mismatched identity", async (user) => {
    expect((await loadInSeasonAccess("owner", { now, client: clientWith(user) })).eligible).toBe(false);
  });

  it("fails closed for owner lookup errors without revoking an independent paid grant", async () => {
    const user = { id: "owner", email: "timbranson515@gmail.com", email_confirmed_at: "2026-09-01" };
    const error = new Error("Auth lookup unavailable");
    expect((await loadInSeasonAccess("owner", { now, client: clientWith(user, error) })).eligible).toBe(false);
    const client = clientWith(user, error, [{ source: "purchase", source_reference: "purchase-1", status: "active", effective_from: "2026-09-01T00:00:00Z", effective_to: "2027-07-01T00:00:00Z" }]);
    expect(await loadInSeasonAccess("owner", { now, client })).toMatchObject({ eligible: true, grantingSources: ["purchase"] });
  });
});
