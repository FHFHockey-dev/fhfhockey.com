import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireApiUserMock,
  getFantraxImportStateMock,
  runFantraxManualImportMock,
  setFantraxActiveTeamMock,
  setFantraxDefaultTeamMock,
  FantraxImportErrorMock,
} = vi.hoisted(() => {
  class TestFantraxImportError extends Error {
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
    getFantraxImportStateMock: vi.fn(),
    runFantraxManualImportMock: vi.fn(),
    setFantraxActiveTeamMock: vi.fn(),
    setFantraxDefaultTeamMock: vi.fn(),
    FantraxImportErrorMock: TestFantraxImportError,
  };
});

vi.mock("lib/api/requireApiUser", () => ({
  requireApiUser: requireApiUserMock,
}));

vi.mock("lib/integrations/fantrax/manualImport", () => ({
  getFantraxImportState: getFantraxImportStateMock,
  runFantraxManualImport: runFantraxManualImportMock,
  setFantraxActiveTeam: setFantraxActiveTeamMock,
  setFantraxDefaultTeam: setFantraxDefaultTeamMock,
  FantraxImportError: FantraxImportErrorMock,
}));

import handler from "../../../../../../pages/api/v1/account/fantrax/import";

function createMockRes() {
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
    json(payload: any) {
      this.body = payload;
      return this;
    },
  } as any;
}

describe("/api/v1/account/fantrax/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
    getFantraxImportStateMock.mockResolvedValue({ leagues: [], teams: [] });
    runFantraxManualImportMock.mockResolvedValue({
      runId: "run-1",
      leagueCount: 2,
      teamCount: 4,
      cooldownUntil: "2026-07-14T14:00:15.000Z",
      defaultTeamId: "team-1",
    });
    setFantraxDefaultTeamMock.mockResolvedValue({ teamId: "team-2" });
    setFantraxActiveTeamMock.mockResolvedValue({ teamId: "team-2" });
  });

  it("returns owner-scoped import state", async () => {
    const res = createMockRes();
    await handler({ method: "GET", headers: {} } as any, res);

    expect(getFantraxImportStateMock).toHaveBeenCalledWith({
      userId: "user-1",
    });
    expect(res.statusCode).toBe(200);
  });

  it("imports authenticated CSV or JSON content", async () => {
    const res = createMockRes();
    await handler(
      {
        method: "POST",
        headers: {},
        body: { format: "csv", content: "league_name,team_name" },
      } as any,
      res,
    );

    expect(runFantraxManualImportMock).toHaveBeenCalledWith({
      userId: "user-1",
      format: "csv",
      content: "league_name,team_name",
    });
    expect(res.body).toEqual(
      expect.objectContaining({ success: true, leagueCount: 2, teamCount: 4 }),
    );
  });

  it("sets a verified owner team as the default", async () => {
    const res = createMockRes();
    await handler(
      {
        method: "POST",
        headers: {},
        body: { action: "set_default_team", teamId: "team-2" },
      } as any,
      res,
    );

    expect(setFantraxDefaultTeamMock).toHaveBeenCalledWith({
      userId: "user-1",
      teamId: "team-2",
    });
    expect(res.statusCode).toBe(200);
  });

  it("switches active context independently of the default", async () => {
    const res = createMockRes();
    await handler(
      {
        method: "POST",
        headers: {},
        body: { action: "set_active_team", teamId: "team-2" },
      } as any,
      res,
    );

    expect(setFantraxActiveTeamMock).toHaveBeenCalledWith({
      userId: "user-1",
      teamId: "team-2",
    });
    expect(res.statusCode).toBe(200);
  });

  it("returns cooldown timing and rejects unsupported methods before auth", async () => {
    runFantraxManualImportMock.mockRejectedValue(
      new FantraxImportErrorMock("Fantrax import is cooling down.", 429, 12),
    );
    const cooldownRes = createMockRes();
    await handler(
      { method: "POST", headers: {}, body: { content: "x" } } as any,
      cooldownRes,
    );
    expect(cooldownRes.statusCode).toBe(429);
    expect(cooldownRes.headers["Retry-After"]).toBe("12");

    const methodRes = createMockRes();
    await handler({ method: "DELETE", headers: {} } as any, methodRes);
    expect(methodRes.statusCode).toBe(405);
    expect(requireApiUserMock).toHaveBeenCalledTimes(1);
  });
});
