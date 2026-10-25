import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  auditInsertMock,
  authGetUserMock,
  authMaybeSingleMock,
  createClientMock,
  serviceFromMock,
  yahooGamesUserMock,
  replayCoverageMock,
} = vi.hoisted(() => ({
  auditInsertMock: vi.fn(),
  authGetUserMock: vi.fn(),
  authMaybeSingleMock: vi.fn(),
  createClientMock: vi.fn(),
  serviceFromMock: vi.fn(),
  yahooGamesUserMock: vi.fn(),
  replayCoverageMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

vi.mock("yahoo-fantasy", () => ({
  default: class YahooFantasyMock {
    games = { user: yahooGamesUserMock };
    setUserToken = vi.fn();
    setRefreshToken = vi.fn();
  },
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: serviceFromMock,
  },
}));

vi.mock("lib/supabase", () => ({
  createClientWithToken: vi.fn(() => ({
    auth: {
      getUser: authGetUserMock,
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: authMaybeSingleMock,
        })),
      })),
    })),
  })),
}));

vi.mock("lib/NHL/server", () => ({
  getCurrentSeason: vi.fn(),
}));

vi.mock("lib/cors-fetch", () => ({
  default: vi.fn(),
}));

vi.mock("lib/supabase/utils/updateAllGoalies", () => ({
  updateAllGoaliesStats: vi.fn(),
}));

// Mock the NHL boundary so this test never imports the fenced projection fetch helper.
vi.mock("lib/NHL/pptReplayCoverage", () => ({
  fetchPptReplayCoverageForGame: replayCoverageMock,
}));

import replayCoverageHandler from "../../../../../pages/api/v1/db/audit-nhl-ppt-replay-coverage";
import seasonHandler from "../../../../../pages/api/v1/db/update-season-stats";
import wgoHandler from "../../../../../pages/api/v1/db/update-wgo-goalies";
import refreshYahooHandler from "../../../../../pages/api/v1/db/manual-refresh-yahoo-token";
import updateYahooPlayersHandler from "../../../../../pages/api/v1/db/update-yahoo-players";
import updateYahooWeeksHandler from "../../../../../pages/api/v1/db/update-yahoo-weeks";

const originalCronSecret = process.env.CRON_SECRET;
const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function createMockRes() {
  return {
    body: null as unknown,
    headersSent: false,
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
  } as any;
}

const protectedRoutes = [
  {
    name: "season stats",
    handler: seasonHandler,
    query: { seasonId: "invalid" },
    url: "/api/v1/db/update-season-stats?seasonId=invalid",
  },
  {
    name: "WGO goalies",
    handler: wgoHandler,
    query: {},
    url: "/api/v1/db/update-wgo-goalies",
  },
] as const;

const yahooProtectedRoutes = [
  {
    name: "Yahoo token refresh",
    handler: refreshYahooHandler,
    query: {},
    url: "/api/v1/db/manual-refresh-yahoo-token",
  },
  {
    name: "Yahoo players",
    handler: updateYahooPlayersHandler,
    query: { gameId: "465" },
    url: "/api/v1/db/update-yahoo-players?gameId=465",
  },
  {
    name: "Yahoo weeks",
    handler: updateYahooWeeksHandler,
    query: { game_key: "nhl" },
    url: "/api/v1/db/update-yahoo-weeks?game_key=nhl",
  },
] as const;

function createReq(
  route: (typeof protectedRoutes)[number],
  authorization?: string,
) {
  return {
    headers: {
      authorization,
      host: "fhfhockey.com",
    },
    method: "GET",
    query: route.query,
    url: route.url,
  } as any;
}

describe("season and WGO cron authorization boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.CRON_SECRET = "configured-test-secret";

    authGetUserMock.mockResolvedValue({
      error: { message: "Invalid access token" },
    });
    authMaybeSingleMock.mockResolvedValue({ data: null });
    createClientMock.mockReturnValue({});
    auditInsertMock.mockResolvedValue({ error: null });
    serviceFromMock.mockImplementation((table: string) => {
      if (table === "cron_job_audit") {
        return { insert: auditInsertMock };
      }
      throw new Error(`Unexpected service-role table: ${table}`);
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    restoreEnv("CRON_SECRET", originalCronSecret);
    restoreEnv("SUPABASE_SERVICE_ROLE_KEY", originalServiceRoleKey);
  });

  it("rejects unauthenticated requests before either workload runs", async () => {
    for (const route of protectedRoutes) {
      const res = createMockRes();

      await route.handler(createReq(route), res);

      expect(res.statusCode, route.name).toBe(401);
      expect(res.body, route.name).toEqual({
        message: "Unauthorized.",
        success: false,
      });
    }

    expect(createClientMock).not.toHaveBeenCalled();
    expect(auditInsertMock).not.toHaveBeenCalled();
  });

  it("rejects missing, blank, and whitespace-only cron configuration", async () => {
    const scenarios = [
      { authorization: "Bearer undefined", secret: undefined },
      { authorization: "Bearer ", secret: "" },
      { authorization: "Bearer    ", secret: "   " },
    ];

    for (const scenario of scenarios) {
      restoreEnv("CRON_SECRET", scenario.secret);
      for (const route of protectedRoutes) {
        const res = createMockRes();

        await route.handler(createReq(route, scenario.authorization), res);

        expect(res.statusCode, `${route.name}: ${scenario.authorization}`).toBe(
          401,
        );
        expect(res.body, route.name).toMatchObject({ success: false });
      }
    }

    expect(createClientMock).not.toHaveBeenCalled();
    expect(auditInsertMock).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated Yahoo maintenance requests before provider or database work", async () => {
    for (const route of yahooProtectedRoutes) {
      const res = createMockRes();

      await route.handler(createReq(route as any), res);

      expect(res.statusCode, route.name).toBe(401);
      expect(res.body, route.name).toEqual({
        message: "Unauthorized.",
        success: false,
      });
    }

    expect(createClientMock).not.toHaveBeenCalled();
    expect(auditInsertMock).toHaveBeenCalledTimes(3);
  });

  it("redacts Yahoo provider failures from the manual refresh response and audit", async () => {
    const credentials = {
      id: 1,
      consumer_key: "configured-consumer",
      consumer_secret: "configured-secret",
      access_token: "configured-access",
      refresh_token: "configured-refresh",
    };
    createClientMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: credentials, error: null }),
        })),
      })),
    });
    yahooGamesUserMock.mockRejectedValue(
      new Error("provider failure with sensitive-fragment"),
    );
    const route = yahooProtectedRoutes[0];
    const res = createMockRes();

    await route.handler(
      createReq(route as any, "Bearer configured-test-secret"),
      res,
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      success: false,
      retries: 0,
      rateLimitEvents: 0,
      error: "Yahoo token refresh failed",
    });
    expect(JSON.stringify(auditInsertMock.mock.calls)).not.toContain(
      "sensitive-fragment",
    );
  });

  it("fails closed and redacts missing global Yahoo configuration across every active route", async () => {
    createClientMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "database detail with sensitive-fragment" },
          }),
        })),
      })),
    });

    for (const route of yahooProtectedRoutes) {
      const res = createMockRes();

      await route.handler(
        createReq(route as any, "Bearer configured-test-secret"),
        res,
      );

      expect(res.statusCode, route.name).toBe(500);
      expect(JSON.stringify(res.body), route.name).not.toContain(
        "sensitive-fragment",
      );
    }
  });

  it("allows the exact configured cron bearer into both route handlers", async () => {
    for (const route of protectedRoutes) {
      const res = createMockRes();

      await route.handler(
        createReq(route, "Bearer configured-test-secret"),
        res,
      );

      expect(res.statusCode, route.name).toBe(400);
    }

    expect(authGetUserMock).not.toHaveBeenCalled();
    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(auditInsertMock).toHaveBeenCalledTimes(2);
  });

  it("allows an authenticated admin into both route handlers", async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: { id: "admin-user-id" } },
      error: null,
    });
    authMaybeSingleMock.mockResolvedValue({ data: { role: "admin" } });

    for (const route of protectedRoutes) {
      const res = createMockRes();

      await route.handler(createReq(route, "Bearer admin-access-token"), res);

      expect(res.statusCode, route.name).toBe(400);
    }

    expect(authGetUserMock).toHaveBeenCalledTimes(2);
    expect(authMaybeSingleMock).toHaveBeenCalledTimes(2);
    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(auditInsertMock).toHaveBeenCalledTimes(2);
  });
});


describe("NHL replay operator admission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CRON_SECRET", "synthetic-cron-secret");
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden in operator test"); }));
    authGetUserMock.mockResolvedValue({ data: { user: { id: "synthetic-admin" } }, error: null });
    authMaybeSingleMock.mockResolvedValue({ data: { role: "admin" } });
    serviceFromMock.mockImplementation(() => { throw new Error("Unexpected privileged database operation"); });
    replayCoverageMock.mockImplementation(async (gameId: number) => ({
      gameId,
      gameState: "OFF",
      playCount: 3,
      replayEventCount: 0,
      nonGoalReplayEventCount: 0,
      replayEventTypes: {},
      events: [],
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function request(authorization?: string, query: Record<string, string> = {}, method = "GET") {
    return { method, headers: { authorization }, query } as any;
  }

  function response() {
    const res = createMockRes();
    res.headers = {};
    res.setHeader = (name: string, value: unknown) => { res.headers[name] = value; return res; };
    return res;
  }

  it.each([
    { authorization: undefined, status: 401 },
    { authorization: "Bearer invalid-token", status: 401 },
    { authorization: "Bearer member-token", status: 403 },
  ])("denies $authorization before privileged selection or NHL fan-out", async ({ authorization, status }) => {
    if (status === 401) authGetUserMock.mockResolvedValue({ data: { user: null }, error: new Error("invalid token") });
    else authMaybeSingleMock.mockResolvedValue({ data: { role: "member" } });
    // Omit gameIds to exercise the guarded path that would first select games.
    const res = response();
    await replayCoverageHandler(request(authorization), res);
    expect(res.statusCode).toBe(status);
    expect(res.body).toEqual({ success: false, message: status === 401 ? "Unauthorized." : "You are not an Admin." });
    expect(serviceFromMock).not.toHaveBeenCalled();
    expect(replayCoverageMock).not.toHaveBeenCalled();
    expect(auditInsertMock).not.toHaveBeenCalled();
  });

  it.each(["Bearer synthetic-cron-secret", "Bearer admin-token"])("keeps admitted explicit-ID diagnostics bounded for %s", async (authorization) => {
    const res = response();
    await replayCoverageHandler(request(authorization, { gameIds: "1,2,3", limit: "2", seasonId: "20252026" }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true, seasonId: 20252026, gameTypes: [2, 3],
      requestedGames: 2, processedGames: 2, failedGames: 0,
      counts: { totalPlayCount: 6, replayEventCount: 0, gamesWithReplayUrls: 0 },
      samples: [], errors: [],
    });
    expect(replayCoverageMock.mock.calls).toEqual([[1], [2]]);
    expect(serviceFromMock).not.toHaveBeenCalled();
    expect(auditInsertMock).not.toHaveBeenCalled();
  });

  it("retains the admitted 250-game maximum with synthetic provider replies", async () => {
    const res = response();
    await replayCoverageHandler(request("Bearer synthetic-cron-secret", {
      gameIds: Array.from({ length: 251 }, (_, index) => index + 1).join(","), limit: "999",
    }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ requestedGames: 250, processedGames: 250, failedGames: 0 });
    expect(replayCoverageMock).toHaveBeenCalledTimes(250);
    expect(replayCoverageMock).toHaveBeenLastCalledWith(250);
  });

  it("keeps admitted database selection and its diagnostic limits", async () => {
    const chain: any = {};
    for (const method of ["select", "eq", "in", "order", "range", "gte", "lte"]) {
      chain[method] = vi.fn(() => chain);
    }
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({
      data: [{ id: 21, date: "2026-10-01", type: 2 }, { id: 22, date: "2026-10-02", type: 2 }], error: null,
    }).then(resolve);
    serviceFromMock.mockReturnValue(chain);
    const res = response();
    await replayCoverageHandler(request("Bearer synthetic-cron-secret", {
      seasonId: "20262027", startDate: "2026-10-01", endDate: "2026-10-02", limit: "1",
    }), res);
    expect(res.statusCode).toBe(200);
    expect(serviceFromMock).toHaveBeenCalledExactlyOnceWith("games");
    expect(chain.eq).toHaveBeenCalledWith("seasonId", 20262027);
    expect(chain.gte).toHaveBeenCalledWith("date", "2026-10-01");
    expect(chain.lte).toHaveBeenCalledWith("date", "2026-10-02");
    expect(replayCoverageMock.mock.calls).toEqual([[21]]);
    expect(res.body).toMatchObject({ requestedGames: 1, processedGames: 1 });
  });

  it("preserves partial diagnostic errors after admission", async () => {
    replayCoverageMock.mockRejectedValueOnce(new Error("synthetic unavailable game"));
    const res = response();
    await replayCoverageHandler(request("Bearer synthetic-cron-secret", { gameIds: "1,2", limit: "2" }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true, requestedGames: 2, processedGames: 1, failedGames: 1,
      errors: [{ gameId: 1, error: "synthetic unavailable game" }],
    });
    expect(JSON.stringify(res.body)).not.toContain("synthetic-cron-secret");
  });

  it("retains admitted GET-only method behavior before selection or provider work", async () => {
    const res = response();
    await replayCoverageHandler(request("Bearer synthetic-cron-secret", {}, "POST"), res);
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("GET");
    expect(res.body).toEqual({ success: false, error: "Method not allowed." });
    expect(serviceFromMock).not.toHaveBeenCalled();
    expect(replayCoverageMock).not.toHaveBeenCalled();
    expect(auditInsertMock).not.toHaveBeenCalled();
  });
});
