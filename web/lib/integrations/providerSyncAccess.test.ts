import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveInSeasonAccess, type InSeasonGrant } from "lib/in-season/access";
import { isMonthlyFailureGraceActive, monthlyFailureWindow, purchasedCoverageAfterCancellation, seasonPassCoverage } from "lib/in-season/commerce";
import { resolveDraftProAccess, type DraftProEntitlement } from "lib/draft-pro/access";
import { isProviderSyncPremiumEnforced, loadProviderSyncAccess, requireProviderSyncAccess } from "./providerSyncAccessServer";
import { providerSyncAccessMessage } from "./providerSyncAccess";

const mocks = vi.hoisted(() => ({ season: vi.fn(), draft: vi.fn() }));
vi.mock("lib/in-season/server", () => ({ loadInSeasonAccess: mocks.season }));
vi.mock("lib/draft-pro/server", () => ({ loadDraftProAccess: mocks.draft }));
const now = new Date("2026-10-21T12:00:00Z");
const flags = { checkout: false, recommendations: false, dust: false, blended_csv: false, saved_drafts: false, private_imports: false, scenarios: false, reports: false, god_view: false, mock_draft_advanced: false };
const paid: InSeasonGrant = { source: "purchase", reference: "verified-purchase", status: "active", effectiveFrom: "2026-10-01T04:00:00Z", effectiveTo: "2026-11-01T04:00:00Z" };
function season(grants: InSeasonGrant[]) { mocks.season.mockResolvedValue(resolveInSeasonAccess(grants, now)); }
function draft(grants: DraftProEntitlement[]) { mocks.draft.mockResolvedValue(resolveDraftProAccess({ now, userId: "owner", entitlements: grants, flags, patreonVerificationAvailable: true })); }
beforeEach(() => { vi.stubEnv("PROVIDER_SYNC_PREMIUM_ENFORCEMENT_ENABLED", "true"); vi.useFakeTimers(); vi.setSystemTime(now); vi.resetAllMocks(); season([]); draft([]); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("shared provider sync entitlement", () => {
  it("rejects anonymous callers before any entitlement lookup", async () => {
    await expect(requireProviderSyncAccess(null)).rejects.toMatchObject({ statusCode: 401, code: "authentication_required" });
    expect(mocks.season).not.toHaveBeenCalled(); expect(mocks.draft).not.toHaveBeenCalled();
  });
  it("rejects a free account with the season-pass upsell", async () => {
    await expect(requireProviderSyncAccess("owner")).rejects.toMatchObject({ statusCode: 403, message: expect.stringContaining("$24.99 season pass ending July 1, 2027") });
    expect(mocks.season).toHaveBeenCalledWith("owner"); expect(mocks.draft).toHaveBeenCalledWith("owner", expect.any(Object));
  });
  it.each(["monthly", "season", "grandfather", "supporter"])("allows a verified %s grant", async (kind) => {
    const grant = kind === "season" ? { ...paid, ...seasonPassCoverage(new Date(paid.effectiveFrom!)) }
      : kind === "grandfather" ? { ...paid, source: "grandfather" as const }
      : kind === "supporter" ? { ...paid, source: "patreon" as const, effectiveTo: null, verifiedAt: now.toISOString() } : paid;
    season([grant]);
    expect(await requireProviderSyncAccess("owner")).toMatchObject({ eligible: true, expiresAt: grant.effectiveTo ? new Date(grant.effectiveTo).toISOString() : null });
    expect(mocks.draft).not.toHaveBeenCalled();
  });
  it("retains an independently valid legacy Draft Pro grant without changing feature flags", async () => {
    draft([{ source: "purchase", status: "active", effectiveFrom: paid.effectiveFrom, effectiveTo: "2027-07-01T04:00:00Z" }]);
    expect(await requireProviderSyncAccess("owner")).toMatchObject({ eligible: true });
  });
  it("honors immediate cancellation and the exclusive season cutoff", async () => {
    const coverage = purchasedCoverageAfterCancellation(new Date(paid.effectiveFrom!), new Date(paid.effectiveTo!), now)!;
    season([{ ...paid, ...coverage }]);
    await expect(requireProviderSyncAccess("owner")).rejects.toMatchObject({ statusCode: 403, code: "expired" });
    mocks.season.mockResolvedValue(resolveInSeasonAccess([{ ...paid, ...seasonPassCoverage(new Date(paid.effectiveFrom!)) }], new Date("2027-07-01T04:00:00Z")));
    await expect(requireProviderSyncAccess("owner")).rejects.toMatchObject({ statusCode: 403, code: "expired" });
  });
  it("accepts only explicitly granted, bounded payment grace", async () => {
    const failure = new Date("2026-10-20T12:00:00Z");
    expect(isMonthlyFailureGraceActive(failure, now, 1)).toBe(true);
    season([{ ...paid, effectiveTo: monthlyFailureWindow(failure).graceEndsAt }]);
    expect((await requireProviderSyncAccess("owner")).eligible).toBe(true);
    expect(isMonthlyFailureGraceActive(failure, now, 3)).toBe(false);
    season([{ ...paid, status: "revoked" }]);
    await expect(requireProviderSyncAccess("owner")).rejects.toMatchObject({ statusCode: 403 });
    mocks.season.mockResolvedValue(resolveInSeasonAccess([{ ...paid, effectiveTo: monthlyFailureWindow(failure).graceEndsAt }], new Date("2026-10-22T12:00:00Z")));
    await expect(requireProviderSyncAccess("owner")).rejects.toMatchObject({ code: "expired" });
  });
  it.each(["stale", "failed", "unknown"])("fails closed with a transient error for %s verification", async (kind) => {
    if (kind === "stale") season([{ ...paid, source: "patreon", verifiedAt: "2026-10-20T00:00:00Z" }]);
    else if (kind === "failed") mocks.season.mockRejectedValue(new Error("private database detail"));
    else mocks.season.mockResolvedValue(undefined);
    await expect(requireProviderSyncAccess("owner")).rejects.toMatchObject({ statusCode: 503, code: "verification_unavailable" });
    expect(await loadProviderSyncAccess("owner")).toMatchObject({ eligible: false });
  });
  it("keeps an independent verified grant when the other source is unavailable", async () => {
    mocks.season.mockRejectedValue(new Error("unavailable"));
    draft([{ source: "patreon", status: "active", effectiveFrom: paid.effectiveFrom, effectiveTo: null, verifiedAt: now.toISOString() }]);
    expect((await requireProviderSyncAccess("owner")).eligible).toBe(true);
  });
  it("distinguishes client sign-in, loading, upgrade and unavailable states", () => {
    expect(providerSyncAccessMessage("idle", null)).toContain("Sign in");
    expect(providerSyncAccessMessage("loading", null)).toContain("Checking");
    expect(providerSyncAccessMessage("ready", null)).toContain("season pass");
    expect(providerSyncAccessMessage("error", null)).toContain("could not be verified");
  });
});


describe("paid sync rollout", () => {
  it.each([undefined, "false", "TRUE", "1", " true "])("keeps enforcement off for %s", async value => {
    vi.stubEnv("PROVIDER_SYNC_PREMIUM_ENFORCEMENT_ENABLED", value);
    expect(isProviderSyncPremiumEnforced()).toBe(false);
    mocks.season.mockRejectedValue(new Error("billing unavailable"));
    expect(await requireProviderSyncAccess("owner")).toEqual({ eligible: true, reason: "rollout_free", expiresAt: null, nextVerificationAt: null });
    expect(mocks.season).not.toHaveBeenCalled(); expect(mocks.draft).not.toHaveBeenCalled();
    await expect(requireProviderSyncAccess(null)).rejects.toMatchObject({ statusCode: 401 });
  });
  it.each(["free", "paid", "legacy", "unavailable"])("keeps %s billing entitlement truthful while sync is free", async kind => {
    vi.stubEnv("PROVIDER_SYNC_PREMIUM_ENFORCEMENT_ENABLED", undefined);
    if (kind === "paid") season([paid]);
    if (kind === "legacy") draft([{ source: "purchase", status: "active", effectiveFrom: paid.effectiveFrom, effectiveTo: paid.effectiveTo }]);
    if (kind === "unavailable") mocks.season.mockRejectedValue(new Error("offline"));
    expect((await requireProviderSyncAccess("owner")).reason).toBe("rollout_free");
    expect(await loadProviderSyncAccess("owner", { entitlementOnly: true })).toMatchObject({ eligible: ["paid", "legacy"].includes(kind), reason: kind === "unavailable" ? "verification_unavailable" : kind === "free" ? "no_active_grant" : "eligible" });
  });
});
