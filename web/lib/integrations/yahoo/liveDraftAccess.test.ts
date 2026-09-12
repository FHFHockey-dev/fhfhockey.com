import { describe, expect, it } from "vitest";

import { resolveDraftProAccess } from "lib/draft-pro/access";
import type { DraftProAccess } from "lib/draft-pro/contracts";

import { assertYahooLiveDraftServerAccess, isConfirmedYahooLiveDraftAccessLoss, isYahooLiveDraftProviderReady } from "./liveDraftAccess";

const userId = "11111111-1111-4111-8111-111111111111";
const environment = { YAHOO_LIVE_DRAFT_ENABLED: "true", YAHOO_LIVE_DRAFT_PROVIDER_VALIDATED: "false", YAHOO_LIVE_DRAFT_ROLLOUT_STAGE: "staff", YAHOO_LIVE_DRAFT_STAFF_USER_IDS: userId };
const flags = { checkout: false, recommendations: false, dust: false, blended_csv: false, saved_drafts: false, private_imports: false, scenarios: false, reports: false, god_view: false };
const eligibleAccess = resolveDraftProAccess({ now: new Date("2026-09-12T00:00:00Z"), userId, flags, patreonVerificationAvailable: true, entitlements: [{ source: "complimentary", status: "active", effectiveFrom: "2026-09-01T00:00:00Z", effectiveTo: "2027-07-01T04:00:00Z" }] });
const assert = (access: DraftProAccess, overrides = {}) => assertYahooLiveDraftServerAccess({ access, environment: { ...environment, ...overrides }, userId });

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
});
