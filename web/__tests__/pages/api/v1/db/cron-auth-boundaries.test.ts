import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  auditInsertMock,
  authGetUserMock,
  authMaybeSingleMock,
  createClientMock,
  serviceFromMock,
} = vi.hoisted(() => ({
  auditInsertMock: vi.fn(),
  authGetUserMock: vi.fn(),
  authMaybeSingleMock: vi.fn(),
  createClientMock: vi.fn(),
  serviceFromMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
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
        maybeSingle: authMaybeSingleMock,
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

import seasonHandler from "../../../../../pages/api/v1/db/update-season-stats";
import wgoHandler from "../../../../../pages/api/v1/db/update-wgo-goalies";

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
        message: "Invalid access token",
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
    expect(auditInsertMock).toHaveBeenCalledTimes(1);
  });

  it("allows an authenticated admin into both route handlers", async () => {
    authGetUserMock.mockResolvedValue({ error: null });
    authMaybeSingleMock.mockResolvedValue({ data: { role: "admin" } });

    for (const route of protectedRoutes) {
      const res = createMockRes();

      await route.handler(createReq(route, "Bearer admin-access-token"), res);

      expect(res.statusCode, route.name).toBe(400);
    }

    expect(authGetUserMock).toHaveBeenCalledTimes(2);
    expect(authMaybeSingleMock).toHaveBeenCalledTimes(2);
    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(auditInsertMock).toHaveBeenCalledTimes(1);
  });
});
