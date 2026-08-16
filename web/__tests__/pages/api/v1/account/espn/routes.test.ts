import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextApiResponse } from "next";

const mocks = vi.hoisted(() => {
  class TestEspnIntegrationError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
      public readonly code: string,
      public readonly retryAfterSeconds: number | null = null,
    ) {
      super(message);
    }
  }
  return {
    EspnIntegrationError: TestEspnIntegrationError,
    requireApiUser: vi.fn(),
    getEspnConnections: vi.fn(),
    linkEspnAccount: vi.fn(),
    updateEspnConnection: vi.fn(),
    disconnectEspnAccount: vi.fn(),
    addEspnLeague: vi.fn(),
    deleteEspnLeague: vi.fn(),
    refreshEspnLeague: vi.fn(),
    applyEspnSettings: vi.fn(),
  };
});

vi.mock("lib/api/requireApiUser", () => ({
  requireApiUser: mocks.requireApiUser,
}));

vi.mock("lib/integrations/espn/server", () => ({
  EspnIntegrationError: mocks.EspnIntegrationError,
  getEspnConnections: mocks.getEspnConnections,
  linkEspnAccount: mocks.linkEspnAccount,
  updateEspnConnection: mocks.updateEspnConnection,
  disconnectEspnAccount: mocks.disconnectEspnAccount,
  addEspnLeague: mocks.addEspnLeague,
  deleteEspnLeague: mocks.deleteEspnLeague,
  refreshEspnLeague: mocks.refreshEspnLeague,
  applyEspnSettings: mocks.applyEspnSettings,
}));

import applyHandler from "../../../../../../pages/api/v1/account/espn/apply-settings";
import connectionHandler from "../../../../../../pages/api/v1/account/espn/connections/[accountId]";
import addLeagueHandler from "../../../../../../pages/api/v1/account/espn/connections/[accountId]/leagues";
import deleteLeagueHandler from "../../../../../../pages/api/v1/account/espn/connections/[accountId]/leagues/[leagueId]";
import connectionsHandler from "../../../../../../pages/api/v1/account/espn/connections";
import linkHandler from "../../../../../../pages/api/v1/account/espn/link";
import refreshHandler from "../../../../../../pages/api/v1/account/espn/refresh";

type TestResponse = NextApiResponse & {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
};

function response(): TestResponse {
  const result = {
    statusCode: 200,
    body: null as unknown,
    headers: {} as Record<string, string>,
  } as unknown as TestResponse;
  result.status = ((code: number) => {
    result.statusCode = code;
    return result;
  }) as TestResponse["status"];
  result.setHeader = ((name: string, value: string) => {
    result.headers[name] = value;
  }) as TestResponse["setHeader"];
  result.json = ((body: unknown) => {
    result.body = body;
    return result;
  }) as TestResponse["json"];
  return result;
}

describe("ESPN account API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: "user-1" });
    mocks.getEspnConnections.mockResolvedValue({
      apiEnabled: true,
      accounts: [],
    });
    mocks.linkEspnAccount.mockResolvedValue({
      accountId: "account-1",
      externalLeagueId: "league-1",
    });
    mocks.updateEspnConnection.mockResolvedValue({ accountId: "account-1" });
    mocks.disconnectEspnAccount.mockResolvedValue({ disconnected: true });
    mocks.addEspnLeague.mockResolvedValue({ externalLeagueId: "league-2" });
    mocks.deleteEspnLeague.mockResolvedValue({ deleted: true });
    mocks.refreshEspnLeague.mockResolvedValue({ skipped: false, changed: true });
    mocks.applyEspnSettings.mockResolvedValue({ user_id: "user-1" });
  });

  it("returns only the authenticated user's sanitized connection model", async () => {
    const res = response();
    await connectionsHandler({ method: "GET", headers: {} } as never, res);

    expect(mocks.getEspnConnections).toHaveBeenCalledWith({ userId: "user-1" });
    expect(res.statusCode).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain("espn_s2");
    expect(JSON.stringify(res.body)).not.toContain("swid");
  });

  it("passes transient credentials and consent to the atomic link service", async () => {
    const res = response();
    await linkHandler(
      {
        method: "POST",
        headers: {},
        body: {
          accountLabel: "Hockey leagues",
          swid: "{00000000-0000-0000-0000-000000000001}",
          espnS2: "redacted-secret",
          leagueRef: "123456",
          season: "2026",
          consentVersion: "espn-fantasy-private-beta-v1",
        },
      } as never,
      res,
    );

    expect(mocks.linkEspnAccount).toHaveBeenCalledWith({
      userId: "user-1",
      accountLabel: "Hockey leagues",
      swid: "{00000000-0000-0000-0000-000000000001}",
      espnS2: "redacted-secret",
      leagueRef: "123456",
      season: "2026",
      consentVersion: "espn-fantasy-private-beta-v1",
      targetAccountId: undefined,
    });
    expect(res.body).toEqual(
      expect.objectContaining({ success: true, accountId: "account-1" }),
    );
    expect(JSON.stringify(res.body)).not.toContain("redacted-secret");
  });

  it("owner-scopes update, disconnect, league, refresh, and apply operations", async () => {
    await connectionHandler(
      {
        method: "PATCH",
        headers: {},
        query: { accountId: "account-1" },
        body: { accountLabel: "Renamed", swid: "new-swid", espnS2: "new-s2" },
      } as never,
      response(),
    );
    expect(mocks.updateEspnConnection).toHaveBeenCalledWith({
      userId: "user-1",
      accountId: "account-1",
      accountLabel: "Renamed",
      swid: "new-swid",
      espnS2: "new-s2",
    });

    await addLeagueHandler(
      {
        method: "POST",
        headers: {},
        query: { accountId: "account-1" },
        body: { leagueRef: "123456", season: 2025 },
      } as never,
      response(),
    );
    expect(mocks.addEspnLeague).toHaveBeenCalledWith({
      userId: "user-1",
      accountId: "account-1",
      leagueRef: "123456",
      season: 2025,
    });

    await deleteLeagueHandler(
      {
        method: "DELETE",
        headers: {},
        query: { accountId: "account-1", leagueId: "league-2" },
      } as never,
      response(),
    );
    expect(mocks.deleteEspnLeague).toHaveBeenCalledWith({
      userId: "user-1",
      accountId: "account-1",
      externalLeagueId: "league-2",
    });

    await refreshHandler(
      {
        method: "POST",
        headers: {},
        body: { externalLeagueId: "league-1" },
      } as never,
      response(),
    );
    expect(mocks.refreshEspnLeague).toHaveBeenCalledWith({
      userId: "user-1",
      externalLeagueId: "league-1",
    });

    await applyHandler(
      {
        method: "POST",
        headers: {},
        body: {
          externalLeagueId: "league-1",
          externalTeamId: "team-1",
          settingsHash: "hash-1",
          acknowledgeWarnings: true,
        },
      } as never,
      response(),
    );
    expect(mocks.applyEspnSettings).toHaveBeenCalledWith({
      userId: "user-1",
      externalLeagueId: "league-1",
      externalTeamId: "team-1",
      settingsHash: "hash-1",
      acknowledgeWarnings: true,
    });

    await connectionHandler(
      {
        method: "DELETE",
        headers: {},
        query: { accountId: "account-1" },
      } as never,
      response(),
    );
    expect(mocks.disconnectEspnAccount).toHaveBeenCalledWith({
      userId: "user-1",
      accountId: "account-1",
    });
  });

  it("preserves cooldown codes and Retry-After without exposing diagnostics", async () => {
    mocks.refreshEspnLeague.mockRejectedValue(
      new mocks.EspnIntegrationError(
        "This ESPN league was refreshed recently.",
        429,
        "ESPN_REFRESH_COOLDOWN",
        120,
      ),
    );
    const res = response();

    await refreshHandler(
      { method: "POST", headers: {}, body: { externalLeagueId: "league-1" } } as never,
      res,
    );

    expect(res.statusCode).toBe(429);
    expect(res.headers["Retry-After"]).toBe("120");
    expect(res.body).toEqual({
      error: "This ESPN league was refreshed recently.",
      code: "ESPN_REFRESH_COOLDOWN",
      retryAfterSeconds: 120,
    });
  });

  it("stops before service access when authentication fails", async () => {
    mocks.requireApiUser.mockResolvedValue(null);
    await linkHandler(
      { method: "POST", headers: {}, body: {} } as never,
      response(),
    );
    expect(mocks.linkEspnAccount).not.toHaveBeenCalled();
  });
});
