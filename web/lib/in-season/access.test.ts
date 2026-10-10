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
  function clientWith(user: Record<string, unknown> | null, error: unknown = null, grants: unknown[] = [], sources: Record<string, { data?: unknown[]; error?: unknown; rejection?: Error; failureFrom?: number }> = {}) {
    const from = vi.fn((table: string) => {
      let bounds: [number, number] | null = null;
      const query: any = {
        select: () => query, eq: () => query, order: () => query,
        range: (start: number, end: number) => { bounds = [start, end]; return query; },
        then: (resolve: (result: unknown) => unknown, reject: (reason: unknown) => unknown) => {
          const source = sources[table] ?? {};
          const failed = source.failureFrom === undefined || (bounds?.[0] ?? 0) >= source.failureFrom;
          if (source.rejection && failed) return Promise.reject(source.rejection).then(resolve, reject);
          const rows = source.data ?? (table === "in_season_grants" ? grants : []);
          return Promise.resolve({ data: bounds ? rows.slice(bounds[0], bounds[1] + 1) : rows.slice(0, 500), error: failed ? source.error ?? null : null }).then(resolve, reject);
        },
      };
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

  const paid = { source: "purchase", source_reference: "purchase-1", status: "active", effective_from: "2026-09-01T00:00:00Z", effective_to: "2027-07-01T00:00:00Z" };
  const patron = { source_provider: "patreon", entitlement_key: "patreon_supporter", entitlement_status: "active", source_account_id: "patreon-1", source_reference: "membership-1", effective_from: "2026-09-01T00:00:00Z", effective_to: null, metadata: { connected_account_id: "patreon-1", draft_pro_eligible: true, verified_at: "2026-09-26T11:30:00Z" } };

  it.each(["error", "rejection"] as const)("retains a verified purchase when the Patreon query returns %s", async (kind) => {
    const failure = new Error("Patreon query unavailable");
    const client = clientWith(null, null, [paid], { user_entitlements: { [kind]: failure, data: [patron] } });
    expect(await loadInSeasonAccess("member", { now, client })).toMatchObject({ eligible: true, grantingSources: ["purchase"] });
  });

  it.each(["error", "rejection"] as const)("retains freshly verified Patreon when the seasonal grant query returns %s", async (kind) => {
    const failure = new Error("Seasonal query unavailable");
    const client = clientWith(null, null, [], { in_season_grants: { [kind]: failure, data: [paid] }, user_entitlements: { data: [patron] } });
    expect(await loadInSeasonAccess("member", { now, client })).toMatchObject({ eligible: true, grantingSources: ["patreon"] });
  });

  it("reports unverified access when an unavailable source has no independently valid grant", async () => {
    const failure = new Error("Seasonal query unavailable");
    const client = clientWith(null, null, [], { in_season_grants: { error: failure, data: [paid] }, user_entitlements: { data: [{ ...patron, entitlement_status: "revoked" }] } });
    await expect(loadInSeasonAccess("member", { now, client })).rejects.toThrow("Seasonal query unavailable");
  });

  it.each(["in_season_grants", "user_entitlements"])("reads later pages of %s before resolving independent access", async (table) => {
    const inactive = table === "in_season_grants" ? { ...paid, status: "revoked" } : { ...patron, entitlement_status: "revoked" };
    const active = table === "in_season_grants" ? paid : patron;
    const client = clientWith(null, null, [], { [table]: { data: [...Array.from({ length: 500 }, () => inactive), active] } });
    expect(await loadInSeasonAccess("member", { now, client })).toMatchObject({ eligible: true, grantingSources: [table === "in_season_grants" ? "purchase" : "patreon"] });
    expect(client.from.mock.calls.filter(([name]: [string]) => name === table)).toHaveLength(2);
  });

  it.each(["in_season_grants", "user_entitlements"])("discards incomplete %s pages while preserving another verified source", async (table) => {
    const active = table === "in_season_grants" ? paid : patron;
    const client = clientWith(null, null, [paid], {
      user_entitlements: { data: [patron] },
      [table]: { data: Array.from({ length: 501 }, () => active), error: new Error("Later page unavailable"), failureFrom: 500 },
    });
    expect(await loadInSeasonAccess("member", { now, client })).toMatchObject({ eligible: true, grantingSources: [table === "in_season_grants" ? "patreon" : "purchase"] });
  });
});
