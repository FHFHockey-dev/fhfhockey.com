import { beforeEach, describe, expect, it, vi } from "vitest";

const { authGetUserMock, getCurrentSeasonMock } = vi.hoisted(() => ({
  authGetUserMock: vi.fn(),
  getCurrentSeasonMock: vi.fn(),
}));

vi.mock("../../../../../lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: unknown) => handler,
}));

vi.mock("../../../../../lib/NHL/server", () => ({
  getCurrentSeason: getCurrentSeasonMock,
}));

vi.mock("lib/supabase", () => ({
  createClientWithToken: () => ({
    auth: { getUser: authGetUserMock },
  }),
}));

import handler from "../../../../../pages/api/v1/db/update-sko-stats";

function createMockRes() {
  return {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, unknown>,
    setHeader(name: string, value: unknown) {
      this.headers[name] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  } as any;
}

describe("/api/v1/db/update-sko-stats route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "current-secret";
    authGetUserMock.mockResolvedValue({
      error: { message: "Invalid bearer token" },
    });
  });

  it.each([
    ["GET", undefined],
    ["POST", "Bearer stale-secret"],
  ])(
    "rejects unauthenticated %s mutations before source or write work",
    async (method, authorization) => {
      const req: any = {
        method,
        headers: authorization ? { authorization } : {},
        query: {},
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({
        message: "Invalid bearer token",
        success: false,
      });
      expect(getCurrentSeasonMock).not.toHaveBeenCalled();
    },
  );

  it("admits current cron credentials before rejecting unsupported methods", async () => {
    const req: any = {
      method: "PUT",
      headers: { authorization: "Bearer current-secret" },
      query: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toEqual(["GET", "POST"]);
    expect(res.body).toEqual({
      message: "Method PUT Not Allowed",
      success: false,
    });
    expect(getCurrentSeasonMock).not.toHaveBeenCalled();
  });

  it("returns a structured dependency error instead of leaking html", async () => {
    getCurrentSeasonMock.mockRejectedValue(
      new Error(
        "<!DOCTYPE html><html><body>Error code 520 from supabase.co</body></html>",
      ),
    );

    const req: any = {
      method: "GET",
      headers: { authorization: "Bearer current-secret" },
      query: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain(
      "Failed to process request. Reason: Upstream dependency returned an HTML error page",
    );
    expect(res.body.dependencyError).toMatchObject({
      kind: "dependency_error",
      classification: "html_upstream_response",
      source: "supabase_or_proxy",
      htmlLike: true,
    });
  });
});
