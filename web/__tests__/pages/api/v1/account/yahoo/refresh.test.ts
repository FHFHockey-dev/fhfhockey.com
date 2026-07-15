import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireApiUserMock, runYahooManualRefreshMock, YahooRefreshErrorMock } =
  vi.hoisted(() => {
    class TestYahooRefreshError extends Error {
      constructor(
        message: string,
        public readonly statusCode: number,
        public readonly retryAfterSeconds?: number,
      ) {
        super(message);
      }
    }

    return {
      requireApiUserMock: vi.fn(),
      runYahooManualRefreshMock: vi.fn(),
      YahooRefreshErrorMock: TestYahooRefreshError,
    };
  });

vi.mock("lib/api/requireApiUser", () => ({
  requireApiUser: requireApiUserMock,
}));

vi.mock("lib/integrations/yahoo/oauth", () => ({
  buildYahooCallbackUrl: () =>
    "https://fhfhockey.com/api/v1/account/yahoo/callback",
}));

vi.mock("lib/integrations/yahoo/refresh", () => ({
  runYahooManualRefresh: runYahooManualRefreshMock,
  YahooRefreshError: YahooRefreshErrorMock,
}));

import handler from "../../../../../../pages/api/v1/account/yahoo/refresh";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("/api/v1/account/yahoo/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
    runYahooManualRefreshMock.mockResolvedValue({
      runId: "run-1",
      leagueCount: 2,
      teamCount: 12,
      cooldownUntil: "2026-07-13T06:05:00.000Z",
    });
  });

  it("runs an authenticated refresh and returns bounded summary state", async () => {
    const req: any = { method: "POST", headers: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(runYahooManualRefreshMock).toHaveBeenCalledWith({
      userId: "user-1",
      redirectUri: "https://fhfhockey.com/api/v1/account/yahoo/callback",
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ success: true, leagueCount: 2, teamCount: 12 }),
    );
  });

  it("returns retry timing for an active cooldown", async () => {
    runYahooManualRefreshMock.mockRejectedValue(
      new YahooRefreshErrorMock("Yahoo refresh is cooling down.", 429, 90),
    );
    const req: any = { method: "POST", headers: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(429);
    expect(res.headers["Retry-After"]).toBe("90");
    expect(res.body).toEqual({
      error: "Yahoo refresh is cooling down.",
      retryAfterSeconds: 90,
    });
  });

  it("rejects unsupported methods before auth", async () => {
    const req: any = { method: "GET", headers: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(requireApiUserMock).not.toHaveBeenCalled();
  });
});
