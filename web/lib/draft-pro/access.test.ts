import { describe, expect, it } from "vitest";
import { requireDraftProCapability, resolveDraftProAccess } from "./access";
import { draftProAccessFixtures } from "./access.fixtures";
import { createDraftProRefundRequestSchema, saveDraftProDraftSchema } from "./contracts";

describe("Draft Pro access contracts", () => {
  it("gates God View independently for purchases, Patreon and expired access", () => {
    const fixture = draftProAccessFixtures.purchase;
    expect(resolveDraftProAccess(fixture).capabilities).toContain("god_view");
    expect(resolveDraftProAccess({ ...fixture, flags: { ...fixture.flags, god_view: false } }).capabilities).not.toContain("god_view");
    expect(resolveDraftProAccess({ ...fixture, now: new Date("2027-07-02T00:00:00Z") }).capabilities).not.toContain("god_view");
    expect(resolveDraftProAccess({ ...draftProAccessFixtures.stalePatreon, now: new Date("2026-09-07T00:30:00Z") }).capabilities).toContain("god_view");
  });
  it("denies anonymous and free accounts", () => {
    expect(resolveDraftProAccess(draftProAccessFixtures.unauthenticated).reason).toBe("authentication_required");
    expect(resolveDraftProAccess({ ...draftProAccessFixtures.purchase, entitlements: [] })).toMatchObject({ eligible: false, reason: "no_active_grant" });
  });
  it("allows an unexpired purchase even when Patreon verification is unavailable", () => {
    const access = resolveDraftProAccess({ ...draftProAccessFixtures.purchase, patreonVerificationAvailable: false });
    expect(access.eligible).toBe(true);
    expect(access.grantingSources).toEqual(["purchase"]);
    expect(requireDraftProCapability(access, "saved_drafts")).toBeNull();
  });
  it("fails closed for a stale Patreon-only grant", () => {
    const access = resolveDraftProAccess(draftProAccessFixtures.stalePatreon);
    expect(access).toMatchObject({ eligible: false, reason: "verification_unavailable", capabilities: [] });
  });
  it("rejects future grants and gives disabled features a stable reason", () => {
    const access = resolveDraftProAccess({ ...draftProAccessFixtures.purchase, entitlements: [{ source: "purchase", status: "active", effectiveFrom: "2026-10-01T00:00:00Z", effectiveTo: "2027-07-01T04:00:00Z" }] });
    expect(access.reason).toBe("no_active_grant");
    const disabled = resolveDraftProAccess({ ...draftProAccessFixtures.purchase, flags: { checkout: false, recommendations: false, dust: false, blended_csv: false, saved_drafts: false, private_imports: false, scenarios: false, god_view: false, reports: false } });
    expect(disabled.reason).toBe("feature_disabled");
    expect(requireDraftProCapability(disabled, "dust")).toMatchObject({ reason: "feature_disabled" });
    const partiallyDisabled = resolveDraftProAccess({ ...draftProAccessFixtures.purchase, flags: { ...draftProAccessFixtures.purchase.flags, dust: false } });
    expect(partiallyDisabled.reason).toBe("eligible");
    expect(requireDraftProCapability(partiallyDisabled, "dust")).toMatchObject({ reason: "feature_disabled" });
  });
  it("fails closed for invalid purchase dates, expiry, refunds, and future Patreon verification", () => {
    const purchase = draftProAccessFixtures.purchase;
    const deniedPurchases = [
      { source: "purchase" as const, status: "active" as const, effectiveFrom: "2026-09-01T00:00:00Z", effectiveTo: null },
      { source: "purchase" as const, status: "active" as const, effectiveFrom: "2026-09-01T00:00:00Z", effectiveTo: "not-a-date" },
      { source: "purchase" as const, status: "active" as const, effectiveFrom: "2026-09-01T00:00:00Z", effectiveTo: "2027-07-02T00:00:00Z" },
      { source: "purchase" as const, status: "refunded" as const, effectiveFrom: "2026-09-01T00:00:00Z", effectiveTo: "2027-07-01T04:00:00Z" },
    ];
    for (const entitlement of deniedPurchases) {
      expect(resolveDraftProAccess({ ...purchase, entitlements: [entitlement] }).eligible).toBe(false);
    }
    const futureVerification = resolveDraftProAccess({ ...purchase, entitlements: [{ source: "patreon", status: "active", effectiveFrom: "2026-09-01T00:00:00Z", effectiveTo: null, verifiedAt: "2026-09-07T02:01:00Z" }] });
    expect(futureVerification).toMatchObject({ eligible: false, reason: "verification_unavailable" });
  });
  it("denies expired and refunded grants", () => {
    const expired = resolveDraftProAccess({ ...draftProAccessFixtures.purchase, entitlements: [{ source: "purchase", status: "active", effectiveFrom: "2026-08-01T00:00:00Z", effectiveTo: "2026-09-01T00:00:00Z" }] });
    const refunded = resolveDraftProAccess({ ...draftProAccessFixtures.purchase, entitlements: [{ source: "purchase", status: "refunded", effectiveFrom: "2026-08-01T00:00:00Z", effectiveTo: "2027-07-01T04:00:00Z" }] });
    expect(expired).toMatchObject({ eligible: false, reason: "expired" });
    expect(refunded).toMatchObject({ eligible: false, reason: "expired" });
  });
  it("uses a fixed Patreon verification deadline and describes dual-source expiry", () => {
    const access = resolveDraftProAccess({ ...draftProAccessFixtures.purchase, now: new Date("2026-09-07T01:00:00Z"), entitlements: [draftProAccessFixtures.purchase.entitlements[0], { source: "patreon", status: "active", effectiveFrom: "2026-09-01T00:00:00Z", effectiveTo: null, verifiedAt: "2026-09-07T00:30:00Z" }] });
    expect(access).toMatchObject({ expiresAt: null, nextVerificationAt: "2026-09-07T01:30:00.000Z" });
  });
  it("accepts the exact one-hour verification boundary and cuts purchases off in July", () => {
    const boundary = resolveDraftProAccess({ ...draftProAccessFixtures.purchase, now: new Date("2026-09-07T01:00:00Z"), entitlements: [{ source: "patreon", status: "active", effectiveFrom: "2026-09-01T00:00:00Z", effectiveTo: null, verifiedAt: "2026-09-07T00:00:00Z" }] });
    const afterSeason = resolveDraftProAccess({ ...draftProAccessFixtures.purchase, now: new Date("2027-07-01T04:00:00Z") });
    expect(boundary).toMatchObject({ eligible: true, nextVerificationAt: "2026-09-07T01:00:00.000Z" });
    expect(afterSeason.eligible).toBe(false);
  });
  it("keeps a season-bounded complimentary grant independent of refunded or stale providers", () => {
    const access = resolveDraftProAccess({ ...draftProAccessFixtures.purchase, patreonVerificationAvailable: false, entitlements: [
      { source: "purchase", status: "refunded", effectiveFrom: "2026-09-01T00:00:00Z", effectiveTo: "2027-07-01T04:00:00Z" },
      { source: "patreon", status: "active", effectiveFrom: "2026-09-01T00:00:00Z", effectiveTo: null, verifiedAt: "2026-09-01T00:00:00Z" },
      { source: "complimentary", status: "active", effectiveFrom: "2026-09-01T00:00:00Z", effectiveTo: "2027-07-01T04:00:00Z" },
    ] });
    expect(access).toMatchObject({ eligible: true, grantingSources: ["complimentary"], expiresAt: "2027-07-01T04:00:00.000Z" });
    const overlong = resolveDraftProAccess({ ...draftProAccessFixtures.purchase, entitlements: [{ source: "complimentary", status: "active", effectiveFrom: "2026-09-01T00:00:00Z", effectiveTo: "2027-07-01T04:00:01Z" }] });
    expect(overlong.eligible).toBe(false);
  });
  it("bounds refund and snapshot inputs", () => {
    expect(createDraftProRefundRequestSchema.safeParse({ purchaseId: "00000000-0000-4000-8000-000000000001", reason: "Changed my mind", explanation: "too short" }).success).toBe(false);
    expect(saveDraftProDraftSchema.safeParse({ name: "My draft", snapshot: { picks: Array.from({ length: 501 }, () => ({})) } }).success).toBe(false);
  });
});
