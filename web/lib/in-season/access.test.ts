import { describe, expect, it } from "vitest";
import { resolveInSeasonAccess, type InSeasonGrant } from "./access";

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
