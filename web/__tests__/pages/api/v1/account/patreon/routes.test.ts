import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class TestPatreonApiError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
      public readonly retryAfterSeconds?: number,
    ) {
      super(message);
    }
  }
  return {
    TestPatreonApiError,
    requireApiUser: vi.fn(),
    getPatreonState: vi.fn(),
    refreshPatreonAccount: vi.fn(),
    disconnectPatreonAccount: vi.fn(),
    connectPatreonAccount: vi.fn(),
    buildPatreonAuthorizationUrl: vi.fn(),
    sanitizePatreonNextPath: vi.fn(),
    verifyPatreonOAuthState: vi.fn(),
    exchangePatreonAuthorizationCode: vi.fn(),
    buildPatreonAccountRedirect: vi.fn(),
  };
});

vi.mock("lib/api/requireApiUser", () => ({
  requireApiUser: mocks.requireApiUser,
}));
vi.mock("lib/integrations/patreon/config", () => ({
  PATREON_CONNECT_DEFAULT_NEXT: "/account?section=patreon",
  isPatreonConfigured: () => true,
}));
vi.mock("lib/integrations/patreon/sync", () => ({
  getPatreonState: mocks.getPatreonState,
  refreshPatreonAccount: mocks.refreshPatreonAccount,
  disconnectPatreonAccount: mocks.disconnectPatreonAccount,
  connectPatreonAccount: mocks.connectPatreonAccount,
}));
vi.mock("lib/integrations/patreon/oauth", () => ({
  PatreonApiError: mocks.TestPatreonApiError,
  buildPatreonAuthorizationUrl: mocks.buildPatreonAuthorizationUrl,
  sanitizePatreonNextPath: mocks.sanitizePatreonNextPath,
  verifyPatreonOAuthState: mocks.verifyPatreonOAuthState,
  exchangePatreonAuthorizationCode: mocks.exchangePatreonAuthorizationCode,
  buildPatreonAccountRedirect: mocks.buildPatreonAccountRedirect,
}));

import statusHandler from "../../../../../../pages/api/v1/account/patreon";
import connectHandler from "../../../../../../pages/api/v1/account/patreon/connect";
import callbackHandler from "../../../../../../pages/api/v1/account/patreon/callback";
import refreshHandler from "../../../../../../pages/api/v1/account/patreon/refresh";
import disconnectHandler from "../../../../../../pages/api/v1/account/patreon/disconnect";

function response() {
  return {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, string>,
    redirectTarget: "",
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
    redirect(target: string) {
      this.redirectTarget = target;
      return this;
    },
  } as any;
}

describe("Patreon account API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: "user-1" });
    mocks.getPatreonState.mockResolvedValue({
      account: null,
      entitlement: null,
      latestRun: null,
    });
    mocks.sanitizePatreonNextPath.mockReturnValue("/account?section=patreon");
    mocks.buildPatreonAuthorizationUrl.mockReturnValue(
      "https://www.patreon.com/oauth2/authorize?state=signed",
    );
    mocks.verifyPatreonOAuthState.mockReturnValue({
      userId: "user-1",
      next: "/account?section=patreon",
    });
    mocks.exchangePatreonAuthorizationCode.mockResolvedValue({
      access_token: "access",
      refresh_token: "refresh",
    });
    mocks.connectPatreonAccount.mockResolvedValue({
      snapshot: { isEligibleSupporter: true },
    });
    mocks.buildPatreonAccountRedirect.mockImplementation(
      (_next: string, status: string) => `/account?patreon_status=${status}`,
    );
    mocks.refreshPatreonAccount.mockResolvedValue({
      snapshot: { isEligibleSupporter: true },
      cooldownUntil: "2026-07-14T15:01:00Z",
    });
    mocks.disconnectPatreonAccount.mockResolvedValue({ disconnected: true });
  });

  it("returns owner state and starts signed account-settings OAuth", async () => {
    const statusRes = response();
    await statusHandler({ method: "GET", headers: {} } as any, statusRes);
    expect(mocks.getPatreonState).toHaveBeenCalledWith("user-1");
    expect(statusRes.body.configured).toBe(true);

    const connectRes = response();
    await connectHandler(
      {
        method: "POST",
        headers: {},
        body: { next: "/account?section=patreon" },
      } as any,
      connectRes,
    );
    expect(connectRes.body.authorizationUrl).toContain("patreon.com");
    expect(mocks.buildPatreonAuthorizationUrl).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "/account?section=patreon",
    );
  });

  it("completes callback materialization and returns cooldown errors", async () => {
    const callbackRes = response();
    await callbackHandler(
      { method: "GET", query: { code: "code", state: "signed" } } as any,
      callbackRes,
    );
    expect(mocks.connectPatreonAccount).toHaveBeenCalledWith({
      userId: "user-1",
      token: expect.objectContaining({ access_token: "access" }),
    });
    expect(callbackRes.redirectTarget).toContain("patreon_status=connected");

    mocks.refreshPatreonAccount.mockRejectedValue(
      new mocks.TestPatreonApiError("Cooling down", 429, 12),
    );
    const refreshRes = response();
    await refreshHandler({ method: "POST", headers: {} } as any, refreshRes);
    expect(refreshRes.statusCode).toBe(429);
    expect(refreshRes.headers["Retry-After"]).toBe("12");
  });

  it("disconnects only through an authenticated POST route", async () => {
    const res = response();
    await disconnectHandler({ method: "POST", headers: {} } as any, res);
    expect(mocks.disconnectPatreonAccount).toHaveBeenCalledWith("user-1");
    expect(res.body).toEqual(
      expect.objectContaining({ success: true, disconnected: true }),
    );

    const methodRes = response();
    await disconnectHandler(
      { method: "DELETE", headers: {} } as any,
      methodRes,
    );
    expect(methodRes.statusCode).toBe(405);
  });

  it("keeps dependency details out of every Patreon route response", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const leak = () => new Error("relation private.connected_account_tokens denied Bearer secret");

    mocks.getPatreonState.mockRejectedValueOnce(leak());
    const statusRes = response();
    await statusHandler({ method: "GET", headers: {} } as any, statusRes);
    expect(statusRes.body).toEqual({
      error: "Patreon account state could not be loaded.",
      code: "PATREON_STATE_UNAVAILABLE",
    });

    mocks.buildPatreonAuthorizationUrl.mockImplementationOnce(() => {
      throw new Error("PATREON_CLIENT_SECRET is not configured");
    });
    const connectRes = response();
    await connectHandler({ method: "POST", body: {}, headers: {} } as any, connectRes);
    expect(connectRes.body).toEqual({
      error: "Patreon authorization could not be started.",
      code: "PATREON_CONNECT_UNAVAILABLE",
    });

    mocks.disconnectPatreonAccount.mockRejectedValueOnce(leak());
    const disconnectRes = response();
    await disconnectHandler({ method: "POST", headers: {} } as any, disconnectRes);
    expect(disconnectRes.body).toEqual({
      error: "Patreon could not be disconnected.",
      code: "PATREON_DISCONNECT_UNAVAILABLE",
    });

    for (const [failure, status] of [
      [leak(), 500],
      [new mocks.TestPatreonApiError("Upstream relation private.connected_account_tokens denied Bearer secret", 502), 502],
    ] as const) {
      mocks.refreshPatreonAccount.mockRejectedValueOnce(failure);
      const refreshRes = response();
      await refreshHandler({ method: "POST", headers: {} } as any, refreshRes);
      expect(refreshRes.statusCode).toBe(status);
      expect(refreshRes.body).toEqual({
        error: "Patreon membership could not be refreshed.",
        code: "PATREON_REFRESH_UNAVAILABLE",
      });
    }

    for (const res of [statusRes, connectRes, disconnectRes]) {
      expect(res.statusCode).toBe(500);
      expect(JSON.stringify(res.body)).not.toMatch(/secret/i);
    }
    consoleError.mockRestore();
  });

  it("puts only Patreon's own client-error text in the callback redirect", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.buildPatreonAccountRedirect.mockImplementation(
      (_next: string, status: string, message: string) =>
        `/account?patreon_status=${status}&patreon_message=${encodeURIComponent(message)}`,
    );

    mocks.connectPatreonAccount.mockRejectedValueOnce(
      new Error("duplicate key value violates unique constraint relation private.connected_account_tokens denied Bearer secret"),
    );
    const dbRes = response();
    await callbackHandler(
      { method: "GET", query: { code: "code", state: "signed" } } as any,
      dbRes,
    );
    expect(decodeURIComponent(dbRes.redirectTarget)).toContain(
      "Patreon connection could not be completed.",
    );
    expect(dbRes.redirectTarget).not.toMatch(/secret|duplicate/i);

    mocks.verifyPatreonOAuthState.mockImplementationOnce(() => {
      throw new mocks.TestPatreonApiError("Patreon OAuth state has expired.", 400);
    });
    const stateRes = response();
    await callbackHandler(
      { method: "GET", query: { code: "code", state: "old" } } as any,
      stateRes,
    );
    expect(decodeURIComponent(stateRes.redirectTarget)).toContain(
      "Patreon OAuth state has expired.",
    );
    consoleError.mockRestore();
  });
});
