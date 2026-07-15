import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireApiUserMock,
  getEspnImportStateMock,
  runEspnManualImportMock,
  setEspnActiveTeamMock,
  setEspnDefaultTeamMock,
  EspnImportErrorMock,
} = vi.hoisted(() => {
  class TestEspnImportError extends Error {
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
    getEspnImportStateMock: vi.fn(),
    runEspnManualImportMock: vi.fn(),
    setEspnActiveTeamMock: vi.fn(),
    setEspnDefaultTeamMock: vi.fn(),
    EspnImportErrorMock: TestEspnImportError,
  };
});

vi.mock("lib/api/requireApiUser", () => ({
  requireApiUser: requireApiUserMock,
}));

vi.mock("lib/integrations/espn/manualImport", () => ({
  getEspnImportState: getEspnImportStateMock,
  runEspnManualImport: runEspnManualImportMock,
  setEspnActiveTeam: setEspnActiveTeamMock,
  setEspnDefaultTeam: setEspnDefaultTeamMock,
  EspnImportError: EspnImportErrorMock,
}));

import handler from "../../../../../../pages/api/v1/account/espn/import";

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

describe("/api/v1/account/espn/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
    getEspnImportStateMock.mockResolvedValue({ leagues: [], teams: [] });
    runEspnManualImportMock.mockResolvedValue({
      runId: "run-1",
      leagueCount: 2,
      teamCount: 4,
      cooldownUntil: "2026-07-14T14:00:15.000Z",
      defaultTeamId: "team-1",
    });
    setEspnDefaultTeamMock.mockResolvedValue({ teamId: "team-2" });
    setEspnActiveTeamMock.mockResolvedValue({ teamId: "team-2" });
  });

  it("returns authenticated ESPN state and imports content", async () => {
    const stateRes = createMockRes();
    await handler({ method: "GET", headers: {} } as any, stateRes);
    expect(getEspnImportStateMock).toHaveBeenCalledWith({ userId: "user-1" });
    expect(stateRes.statusCode).toBe(200);

    const importRes = createMockRes();
    await handler(
      {
        method: "POST",
        headers: {},
        body: { format: "json", content: '{"leagues":[]}' },
      } as any,
      importRes,
    );
    expect(runEspnManualImportMock).toHaveBeenCalledWith({
      userId: "user-1",
      format: "json",
      content: '{"leagues":[]}',
    });
    expect(importRes.body).toEqual(
      expect.objectContaining({ success: true, leagueCount: 2, teamCount: 4 }),
    );
  });

  it("updates default/active context and returns cooldown timing", async () => {
    const defaultRes = createMockRes();
    await handler(
      {
        method: "POST",
        headers: {},
        body: { action: "set_default_team", teamId: "team-2" },
      } as any,
      defaultRes,
    );
    expect(setEspnDefaultTeamMock).toHaveBeenCalledWith({
      userId: "user-1",
      teamId: "team-2",
    });
    expect(defaultRes.body.message).toContain("active context");

    const activeRes = createMockRes();
    await handler(
      {
        method: "POST",
        headers: {},
        body: { action: "set_active_team", teamId: "team-3" },
      } as any,
      activeRes,
    );
    expect(setEspnActiveTeamMock).toHaveBeenCalledWith({
      userId: "user-1",
      teamId: "team-3",
    });
    expect(activeRes.body.message).toBe("ESPN active context updated.");

    runEspnManualImportMock.mockRejectedValue(
      new EspnImportErrorMock("ESPN import is cooling down.", 429, 12),
    );
    const cooldownRes = createMockRes();
    await handler(
      { method: "POST", headers: {}, body: { content: "x" } } as any,
      cooldownRes,
    );
    expect(cooldownRes.statusCode).toBe(429);
    expect(cooldownRes.headers["Retry-After"]).toBe("12");
  });

  it("rejects unsupported methods before auth", async () => {
    const res = createMockRes();
    await handler({ method: "DELETE", headers: {} } as any, res);
    expect(res.statusCode).toBe(405);
    expect(requireApiUserMock).not.toHaveBeenCalled();
  });
});
