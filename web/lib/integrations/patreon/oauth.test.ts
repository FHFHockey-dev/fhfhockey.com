import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildPatreonAuthorizationUrl,
  createPatreonOAuthState,
  fetchPatreonIdentity,
  normalizePatreonIdentity,
  refreshPatreonTokens,
  sanitizePatreonNextPath,
  verifyPatreonOAuthState,
} from "./oauth";

const request = {
  headers: {
    "x-forwarded-proto": "https",
    "x-forwarded-host": "fhfhockey.com",
  },
} as any;

const identityResponse: any = {
  data: {
    id: "patreon-user-1",
    type: "user",
    attributes: { full_name: "Five Hole Supporter", image_url: null },
    relationships: {
      memberships: {
        data: [
          { id: "member-other", type: "member" },
          { id: "member-fhfh", type: "member" },
        ],
      },
    },
  },
  included: [
    {
      id: "member-other",
      type: "member",
      attributes: {
        patron_status: "active_patron",
        currently_entitled_amount_cents: 9999,
      },
      relationships: {
        campaign: { data: { id: "other-campaign", type: "campaign" } },
      },
    },
    {
      id: "member-fhfh",
      type: "member",
      attributes: {
        patron_status: "active_patron",
        currently_entitled_amount_cents: 500,
        last_charge_status: "Paid",
        pledge_relationship_start: "2026-01-10T00:00:00Z",
      },
      relationships: {
        campaign: { data: { id: "fhfh-campaign", type: "campaign" } },
        currently_entitled_tiers: {
          data: [{ id: "tier-5", type: "tier" }],
        },
      },
    },
    {
      id: "tier-5",
      type: "tier",
      attributes: { title: "Power Play", amount_cents: 500 },
    },
  ],
};

describe("Patreon OAuth v2", () => {
  beforeEach(() => {
    vi.stubEnv("PATREON_CLIENT_ID", "client-id");
    vi.stubEnv("PATREON_CLIENT_SECRET", "client-secret");
    vi.stubEnv("PATREON_CAMPAIGN_ID", "fhfh-campaign");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T15:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("signs bounded account-only state and requests only identity scope", () => {
    const state = createPatreonOAuthState("user-1", "/account?section=patreon");
    expect(verifyPatreonOAuthState(state)).toEqual(
      expect.objectContaining({
        userId: "user-1",
        next: "/account?section=patreon",
      }),
    );
    expect(() => verifyPatreonOAuthState(`${state}tampered`)).toThrow(
      "signature is invalid",
    );
    expect(sanitizePatreonNextPath("https://attacker.invalid")).toBe(
      "/account?section=patreon",
    );
    expect(sanitizePatreonNextPath("/\\attacker.invalid")).toBe(
      "/account?section=patreon",
    );

    const authorizationUrl = new URL(
      buildPatreonAuthorizationUrl(
        request,
        "user-1",
        "/account?section=patreon",
      ),
    );
    expect(authorizationUrl.pathname).toBe("/oauth2/authorize");
    expect(authorizationUrl.searchParams.get("scope")).toBe("identity");
    expect(authorizationUrl.searchParams.get("redirect_uri")).toBe(
      "https://fhfhockey.com/api/v1/account/patreon/callback",
    );
  });

  it("selects only the configured campaign membership and tier metadata", () => {
    const snapshot = normalizePatreonIdentity(
      identityResponse,
      "fhfh-campaign",
    );

    expect(snapshot).toEqual(
      expect.objectContaining({
        providerUserId: "patreon-user-1",
        memberId: "member-fhfh",
        patronStatus: "active_patron",
        currentlyEntitledAmountCents: 500,
        isEligibleSupporter: true,
        tiers: [{ id: "tier-5", title: "Power Play", amountCents: 500 }],
      }),
    );
    expect(snapshot.metadata).toEqual(
      expect.objectContaining({
        campaign_id: "fhfh-campaign",
        tier_feature_mapping: "not_configured",
      }),
    );
  });

  it("fails closed to no entitlement when the configured campaign is absent", () => {
    const snapshot = normalizePatreonIdentity(
      identityResponse,
      "missing-campaign",
    );
    expect(snapshot.memberId).toBeNull();
    expect(snapshot.isEligibleSupporter).toBe(false);
    expect(snapshot.tiers).toEqual([]);
  });

  it("requests explicit v2 fields and accepts rotated refresh tokens", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(identityResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "access-2",
            refresh_token: "refresh-2",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const snapshot = await fetchPatreonIdentity(
      "access-1",
      "fhfh-campaign",
      fetchMock,
    );
    expect(snapshot.memberId).toBe("member-fhfh");
    const identityUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(identityUrl.searchParams.get("include")).toContain(
      "memberships.currently_entitled_tiers",
    );
    expect(identityUrl.searchParams.get("fields[member]")).toContain(
      "patron_status",
    );

    const tokens = await refreshPatreonTokens("refresh-1", fetchMock);
    expect(tokens.refresh_token).toBe("refresh-2");
    expect(String(fetchMock.mock.calls[1][1]?.body)).toContain(
      "grant_type=refresh_token",
    );
  });
});
