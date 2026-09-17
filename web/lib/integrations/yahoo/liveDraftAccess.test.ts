import { describe, expect, it } from "vitest";

import { resolveDraftProAccess } from "lib/draft-pro/access";
import type { DraftProEntitlement } from "lib/draft-pro/access";
import type { DraftProAccess } from "lib/draft-pro/contracts";

import { assertYahooLiveDraftServerAccess, isConfirmedYahooLiveDraftAccessLoss, isYahooLiveDraftProviderReady } from "./liveDraftAccess";

const userId = "11111111-1111-4111-8111-111111111111";
const environment = { YAHOO_LIVE_DRAFT_ENABLED: "true", YAHOO_LIVE_DRAFT_PROVIDER_VALIDATED: "false", YAHOO_LIVE_DRAFT_ROLLOUT_STAGE: "staff", YAHOO_LIVE_DRAFT_STAFF_USER_IDS: userId };
const flags = { checkout: false, recommendations: false, dust: false, blended_csv: false, saved_drafts: false, private_imports: false, scenarios: false, reports: false, god_view: false, mock_draft_advanced: false };
const eligibleAccess = resolveDraftProAccess({ now: new Date("2026-09-12T00:00:00Z"), userId, flags, patreonVerificationAvailable: true, entitlements: [{ source: "complimentary", status: "active", effectiveFrom: "2026-09-01T00:00:00Z", effectiveTo: "2027-07-01T04:00:00Z" }] });
const assert = (access: DraftProAccess, overrides = {}) => assertYahooLiveDraftServerAccess({ access, environment: { ...environment, ...overrides }, userId });

function accessFor(entitlements: DraftProEntitlement[], override: Partial<Parameters<typeof resolveDraftProAccess>[0]> = {}) {
  return resolveDraftProAccess({ now: new Date("2026-09-12T00:00:00Z"), userId, flags, patreonVerificationAvailable: true, entitlements, ...override });
}

describe("Yahoo live-draft access", () => {
  it("keeps provider readiness exact while allowing the authorized staff rehearsal", () => {
    expect(isYahooLiveDraftProviderReady({})).toBe(false);
    expect(isYahooLiveDraftProviderReady({ YAHOO_LIVE_DRAFT_PROVIDER_VALIDATED: "true" })).toBe(true);
    expect(assert(eligibleAccess)).toBe(eligibleAccess);
  });

  it("requires readiness for broad authenticated rollout without coupling to recommendations", () => {
    expect(eligibleAccess.capabilities).not.toContain("recommendations");
    let error: unknown;
    try { assert(eligibleAccess, { YAHOO_LIVE_DRAFT_ROLLOUT_STAGE: "authenticated" }); } catch (caught) { error = caught; }
    expect(error).toMatchObject({ code: "yahoo_provider_not_ready", statusCode: 503 });
    expect(assert(eligibleAccess, { YAHOO_LIVE_DRAFT_ROLLOUT_STAGE: "authenticated", YAHOO_LIVE_DRAFT_PROVIDER_VALIDATED: "true" })).toBe(eligibleAccess);
  });

  it("only treats confirmed expiry as a permanent access loss", () => {
    const expired = resolveDraftProAccess({ now: new Date("2026-09-12T00:00:00Z"), userId, flags, patreonVerificationAvailable: true, entitlements: [{ source: "complimentary", status: "active", effectiveFrom: "2026-09-01T00:00:00Z", effectiveTo: "2026-09-11T00:00:00Z" }] });
    const stalePatreon = resolveDraftProAccess({ now: new Date("2026-09-12T00:00:00Z"), userId, flags, patreonVerificationAvailable: false, entitlements: [{ source: "patreon", status: "active", effectiveFrom: "2026-09-01T00:00:00Z", effectiveTo: null, verifiedAt: "2026-09-11T00:00:00Z" }] });
    let expiredError: unknown;
    try { assert(expired); } catch (error) { expiredError = error; }
    expect(expiredError).toMatchObject({ code: "yahoo_draft_pro_expired", statusCode: 403 });
    expect(isConfirmedYahooLiveDraftAccessLoss(expiredError)).toBe(true);
    let staleError: unknown;
    try { assert(stalePatreon); } catch (error) { staleError = error; }
    expect(staleError).toMatchObject({ code: "yahoo_draft_pro_verification_unavailable", statusCode: 503 });
  });

  it("denies disabled, off-rollout, and excluded cohorts", () => {
    for (const overrides of [
      { YAHOO_LIVE_DRAFT_ENABLED: "false" },
      { YAHOO_LIVE_DRAFT_ENABLED: undefined },
      { YAHOO_LIVE_DRAFT_ROLLOUT_STAGE: "off" },
      { YAHOO_LIVE_DRAFT_ROLLOUT_STAGE: "staff", YAHOO_LIVE_DRAFT_STAFF_USER_IDS: "22222222-2222-4222-8222-222222222222" },
      { YAHOO_LIVE_DRAFT_ROLLOUT_STAGE: "allowlist", YAHOO_LIVE_DRAFT_STAFF_USER_IDS: "", YAHOO_LIVE_DRAFT_BETA_USER_IDS: "22222222-2222-4222-8222-222222222222" },
    ]) {
      let error: unknown;
      try { assert(eligibleAccess, overrides); } catch (caught) { error = caught; }
      expect(error).toMatchObject({ code: expect.stringMatching(/disabled|forbidden/), statusCode: expect.any(Number) });
    }
  });

  it("permits eligible paid and verified Patreon access without recommendations", () => {
    const paid = accessFor([{ source: "purchase", status: "active", effectiveFrom: "2026-09-01T00:00:00Z", effectiveTo: "2027-07-01T04:00:00Z" }]);
    const patreon = accessFor([{ source: "patreon", status: "active", effectiveFrom: "2026-09-01T00:00:00Z", effectiveTo: null, verifiedAt: "2026-09-12T00:00:00Z" }]);
    expect(assert(paid)).toBe(paid);
    expect(assert(patreon)).toBe(patreon);
    expect(paid.capabilities).not.toContain("recommendations");
  });

  it("denies anonymous and free resolver results", () => {
    const anonymous = accessFor([], { userId: null });
    const free = accessFor([]);
    for (const access of [anonymous, free]) {
      let error: unknown;
      try { assert(access); } catch (caught) { error = caught; }
      expect(error).toMatchObject({ code: "yahoo_draft_pro_access_required", statusCode: 403 });
    }
  });

  it("requires exact readiness for broad authenticated rollout", () => {
    for (const value of ["TRUE", "yes", "1", " true "]) {
      let error: unknown;
      try { assert(eligibleAccess, { YAHOO_LIVE_DRAFT_ROLLOUT_STAGE: "authenticated", YAHOO_LIVE_DRAFT_PROVIDER_VALIDATED: value }); } catch (caught) { error = caught; }
      expect(error).toMatchObject({ code: "yahoo_provider_not_ready", statusCode: 503 });
    }
  });
});
