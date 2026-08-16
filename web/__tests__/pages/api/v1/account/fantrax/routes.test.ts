import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class TestFantraxIntegrationError extends Error {
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
    FantraxIntegrationError: TestFantraxIntegrationError,
    requireApiUser: vi.fn(),
    getFantraxConnections: vi.fn(),
    discoverFantraxLeagues: vi.fn(),
    discoverLinkedFantraxLeagues: vi.fn(),
    linkFantraxAccount: vi.fn(),
    updateFantraxConnection: vi.fn(),
    disconnectFantraxAccount: vi.fn(),
    refreshFantrax: vi.fn(),
    applyFantraxSettings: vi.fn(),
  };
});

vi.mock("lib/api/requireApiUser", () => ({
  requireApiUser: mocks.requireApiUser,
}));
vi.mock("lib/integrations/fantrax/server", () => ({
  FantraxIntegrationError: mocks.FantraxIntegrationError,
  getFantraxConnections: mocks.getFantraxConnections,
  discoverFantraxLeagues: mocks.discoverFantraxLeagues,
  discoverLinkedFantraxLeagues: mocks.discoverLinkedFantraxLeagues,
  linkFantraxAccount: mocks.linkFantraxAccount,
  updateFantraxConnection: mocks.updateFantraxConnection,
  disconnectFantraxAccount: mocks.disconnectFantraxAccount,
  refreshFantrax: mocks.refreshFantrax,
  applyFantraxSettings: mocks.applyFantraxSettings,
}));

import applyHandler from "../../../../../../pages/api/v1/account/fantrax/apply-settings";
import connectionHandler from "../../../../../../pages/api/v1/account/fantrax/connections/[accountId]";
import connectionsHandler from "../../../../../../pages/api/v1/account/fantrax/connections";
import discoverHandler from "../../../../../../pages/api/v1/account/fantrax/discover";
import linkHandler from "../../../../../../pages/api/v1/account/fantrax/link";
import refreshHandler from "../../../../../../pages/api/v1/account/fantrax/refresh";

function response() {
  return {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    json(body: any) {
      this.body = body;
      return this;
    },
  } as any;
}

describe("Fantrax account API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: "user-1" });
    mocks.getFantraxConnections.mockResolvedValue({
      apiEnabled: true,
      accounts: [],
    });
    mocks.discoverFantraxLeagues.mockResolvedValue({ leagues: [] });
    mocks.discoverLinkedFantraxLeagues.mockResolvedValue({ leagues: [] });
    mocks.linkFantraxAccount.mockResolvedValue({ accountId: "account-1" });
    mocks.updateFantraxConnection.mockResolvedValue({ accountId: "account-1" });
    mocks.disconnectFantraxAccount.mockResolvedValue({ disconnected: true });
    mocks.refreshFantrax.mockResolvedValue([]);
    mocks.applyFantraxSettings.mockResolvedValue({ user_id: "user-1" });
  });

  it("loads only the authenticated user's sanitized connection state", async () => {
    const res = response();
    await connectionsHandler({ method: "GET", headers: {} } as any, res);

    expect(mocks.getFantraxConnections).toHaveBeenCalledWith({ userId: "user-1" });
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toHaveProperty("secretId");
  });

  it("keeps a pasted Secret ID transient during discovery", async () => {
    const res = response();
    await discoverHandler(
      {
        method: "POST",
        headers: {},
        body: { secretId: "secret", selectedLeagueKeys: ["league-1"] },
      } as any,
      res,
    );

    expect(mocks.discoverFantraxLeagues).toHaveBeenCalledWith({
      userId: "user-1",
      secretId: "secret",
      selectedLeagueKeys: ["league-1"],
    });
    expect(mocks.linkFantraxAccount).not.toHaveBeenCalled();
  });

  it("uses the stored credential for linked-account discovery", async () => {
    const res = response();
    await discoverHandler(
      {
        method: "POST",
        headers: {},
        body: { accountId: "account-1", selectedLeagueKeys: [] },
      } as any,
      res,
    );

    expect(mocks.discoverLinkedFantraxLeagues).toHaveBeenCalledWith({
      userId: "user-1",
      accountId: "account-1",
      selectedLeagueKeys: [],
    });
  });

  it("passes consent, selection, and reconnect target to the atomic link service", async () => {
    const res = response();
    await linkHandler(
      {
        method: "POST",
        headers: {},
        body: {
          secretId: "secret",
          accountLabel: "Keeper leagues",
          selectedLeagueKeys: ["league-1"],
          consentVersion: "fantrax-settings-v1",
          targetAccountId: "legacy-account",
        },
      } as any,
      res,
    );

    expect(mocks.linkFantraxAccount).toHaveBeenCalledWith({
      userId: "user-1",
      secretId: "secret",
      accountLabel: "Keeper leagues",
      selectedLeagueKeys: ["league-1"],
      consentVersion: "fantrax-settings-v1",
      targetAccountId: "legacy-account",
    });
  });

  it("scopes manage, refresh, apply, and disconnect actions to the authenticated user", async () => {
    await connectionHandler(
      {
        method: "PATCH",
        headers: {},
        query: { accountId: "account-1" },
        body: { accountLabel: "Renamed", selectedLeagueKeys: ["league-2"] },
      } as any,
      response(),
    );
    expect(mocks.updateFantraxConnection).toHaveBeenCalledWith({
      userId: "user-1",
      accountId: "account-1",
      accountLabel: "Renamed",
      selectedLeagueKeys: ["league-2"],
    });

    await refreshHandler(
      {
        method: "POST",
        headers: {},
        body: { accountId: "account-1", externalLeagueId: "league-row-1" },
      } as any,
      response(),
    );
    expect(mocks.refreshFantrax).toHaveBeenCalledWith({
      userId: "user-1",
      accountId: "account-1",
      externalLeagueId: "league-row-1",
    });

    await applyHandler(
      {
        method: "POST",
        headers: {},
        body: {
          externalLeagueId: "league-row-1",
          externalTeamId: "team-row-1",
          settingsHash: "hash-1",
          acknowledgeWarnings: true,
        },
      } as any,
      response(),
    );
    expect(mocks.applyFantraxSettings).toHaveBeenCalledWith({
      userId: "user-1",
      externalLeagueId: "league-row-1",
      externalTeamId: "team-row-1",
      settingsHash: "hash-1",
      acknowledgeWarnings: true,
    });

    await connectionHandler(
      {
        method: "DELETE",
        headers: {},
        query: { accountId: "account-1" },
      } as any,
      response(),
    );
    expect(mocks.disconnectFantraxAccount).toHaveBeenCalledWith({
      userId: "user-1",
      accountId: "account-1",
    });
  });

  it("preserves service error codes and retry timing", async () => {
    mocks.refreshFantrax.mockRejectedValue(
      new mocks.FantraxIntegrationError(
        "Refresh cooling down.",
        429,
        "FANTRAX_REFRESH_COOLDOWN",
        120,
      ),
    );
    const res = response();

    await refreshHandler(
      { method: "POST", headers: {}, body: { accountId: "account-1" } } as any,
      res,
    );

    expect(res.statusCode).toBe(429);
    expect(res.headers["Retry-After"]).toBe("120");
    expect(res.body).toMatchObject({ code: "FANTRAX_REFRESH_COOLDOWN" });
  });
});
