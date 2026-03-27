import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  verifyYahooOAuthStateMock,
  exchangeYahooAuthorizationCodeMock,
  buildYahooCallbackUrlMock,
  buildYahooAccountRedirectMock,
  syncYahooDiscoveryMock,
  maybeSingleMock,
  insertSingleMock,
} = vi.hoisted(() => ({
  verifyYahooOAuthStateMock: vi.fn(),
  exchangeYahooAuthorizationCodeMock: vi.fn(),
  buildYahooCallbackUrlMock: vi.fn(),
  buildYahooAccountRedirectMock: vi.fn(),
  syncYahooDiscoveryMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  insertSingleMock: vi.fn(),
}));

vi.mock("lib/integrations/yahoo/oauth", () => ({
  verifyYahooOAuthState: verifyYahooOAuthStateMock,
  exchangeYahooAuthorizationCode: exchangeYahooAuthorizationCodeMock,
  buildYahooCallbackUrl: buildYahooCallbackUrlMock,
  buildYahooAccountRedirect: buildYahooAccountRedirectMock,
}));

vi.mock("lib/integrations/yahoo/discovery", () => ({
  syncYahooDiscovery: syncYahooDiscoveryMock,
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: (table: string) => {
      if (table !== "connected_accounts") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: () => ({
          eq: (_field: string, _value: string) => ({
            eq: (_nextField: string, _nextValue: string) => ({
              maybeSingle: maybeSingleMock,
            }),
          }),
        }),
        insert: (_payload: any) => ({
          select: () => ({
            single: insertSingleMock,
          }),
        }),
        update: () => ({
          eq: () => ({
            select: () => ({
              single: insertSingleMock,
            }),
          }),
        }),
      };
    },
  },
}));

import handler from "../../../../../../pages/api/v1/account/yahoo/callback";

function createMockRes() {
  const res: any = {
    redirectedTo: null as string | null,
    redirect(location: string) {
      this.redirectedTo = location;
      return this;
    },
    setHeader() {},
    status() {
      return this;
    },
    json() {
      return this;
    },
  };

  return res;
}

describe("/api/v1/account/yahoo/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyYahooOAuthStateMock.mockReturnValue({
      userId: "user-1",
      next: "/account?section=connected-accounts",
    });
    exchangeYahooAuthorizationCodeMock.mockResolvedValue({
      access_token: "access-token",
      refresh_token: "refresh-token",
      token_type: "bearer",
      xoauth_yahoo_guid: "guid-123",
    });
    buildYahooCallbackUrlMock.mockReturnValue("http://localhost:3000/api/v1/account/yahoo/callback");
    buildYahooAccountRedirectMock.mockImplementation(
      (_next: string, status: string, message: string) =>
        `/account?section=connected-accounts&yahoo_status=${status}&yahoo_message=${encodeURIComponent(message)}`
    );
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: null,
    });
    insertSingleMock.mockResolvedValue({
      data: {
        id: "yahoo-account-1",
        user_id: "user-1",
        provider: "yahoo",
        provider_user_id: "guid-123",
        account_label: "Yahoo Fantasy",
        status: "syncing",
        scopes: [],
        metadata: {},
        last_synced_at: null,
        created_at: "2026-03-27T12:00:00.000Z",
        updated_at: "2026-03-27T12:00:00.000Z",
      },
      error: null,
    });
    syncYahooDiscoveryMock.mockResolvedValue({
      leagueCount: 2,
      teamCount: 3,
      defaultExternalLeagueId: "league-1",
      defaultExternalTeamId: "team-1",
    });
  });

  it("creates a yahoo account row and redirects with success state", async () => {
    const req: any = {
      method: "GET",
      query: {
        code: "auth-code",
        state: "signed-state",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(exchangeYahooAuthorizationCodeMock).toHaveBeenCalledWith(req, "auth-code");
    expect(syncYahooDiscoveryMock).toHaveBeenCalled();
    expect(res.redirectedTo).toContain("yahoo_status=connected");
  });
});
