import { beforeEach, describe, expect, it, vi } from "vitest";

const { assertPredictionsSkoPrerequisitesMock, authGetUserMock, issue } =
  vi.hoisted(() => ({
    assertPredictionsSkoPrerequisitesMock: vi.fn(),
    authGetUserMock: vi.fn(),
    issue: {
      code: "missing_player_stats_unified",
      message:
        "Missing prerequisite data in player_stats_unified for sKO prediction refresh.",
      detail:
        "No eligible player_stats_unified rows were found between 2025-11-21 and 2026-03-21.",
      action:
        "Refresh player_stats_unified before running /api/v1/ml/update-predictions-sko.",
    } as const,
  }));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (routeHandler: unknown) => routeHandler,
}));

vi.mock("lib/supabase", () => ({
  createClientWithToken: () => ({
    auth: { getUser: authGetUserMock },
  }),
}));

vi.mock("../../../../../lib/ml/predictionsSkoDependencyChecks", async () => {
  const actual = await vi.importActual<
    typeof import("../../../../../lib/ml/predictionsSkoDependencyChecks")
  >("../../../../../lib/ml/predictionsSkoDependencyChecks");
  return {
    ...actual,
    assertPredictionsSkoPrerequisites: assertPredictionsSkoPrerequisitesMock,
  };
});

vi.mock("../../../../../lib/supabase/server", () => ({
  default: {},
}));

import handler from "../../../../../pages/api/v1/ml/update-predictions-sko";
import { PredictionsSkoDependencyError } from "../../../../../lib/ml/predictionsSkoDependencyChecks";

function createMockRes() {
  return {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
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

describe("/api/v1/ml/update-predictions-sko", () => {
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
    "rejects unauthenticated %s mutations before dependency or write work",
    async (method, authorization) => {
      const req: any = {
        method,
        headers: authorization ? { authorization } : {},
        query: {},
        body: {},
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({
        message: "Invalid bearer token",
        success: false,
      });
      expect(assertPredictionsSkoPrerequisitesMock).not.toHaveBeenCalled();
    },
  );

  it("returns a structured prerequisite failure when player_stats_unified is unavailable", async () => {
    assertPredictionsSkoPrerequisitesMock.mockRejectedValue(
      new PredictionsSkoDependencyError(issue),
    );

    const req: any = {
      method: "GET",
      headers: {
        authorization: "Bearer current-secret",
      },
      query: {
        asOfDate: "2026-03-21",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(424);
    expect(res.body.success).toBe(false);
    expect(res.body.prerequisite).toEqual(issue);
    expect(res.body.dependencyError.message).toBe(issue.message);
  });
});
