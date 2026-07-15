import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireApiUserMock,
  loadYahooTeamRosterMock,
  YahooTeamRosterErrorMock,
} = vi.hoisted(() => {
  class TestYahooTeamRosterError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
    }
  }

  return {
    requireApiUserMock: vi.fn(),
    loadYahooTeamRosterMock: vi.fn(),
    YahooTeamRosterErrorMock: TestYahooTeamRosterError,
  };
});

vi.mock("lib/api/requireApiUser", () => ({
  requireApiUser: requireApiUserMock,
}));

vi.mock("lib/integrations/yahoo/oauth", () => ({
  buildYahooCallbackUrl: () =>
    "https://fhfhockey.com/api/v1/account/yahoo/callback",
}));

vi.mock("lib/integrations/yahoo/teamRoster", () => ({
  loadYahooTeamRoster: loadYahooTeamRosterMock,
  YahooTeamRosterError: YahooTeamRosterErrorMock,
}));

import handler from "../../../../../../pages/api/v1/account/yahoo/team-roster";

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

describe("/api/v1/account/yahoo/team-roster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
    loadYahooTeamRosterMock.mockResolvedValue({
      externalTeamId: "team-2",
      externalTeamKey: "500.l.1.t.2",
      teamName: "League Rival",
      players: [{ player_key: "500.p.1" }],
      rosterSnapshot: {
        players: [{ player_key: "500.p.1" }],
        visibility: "league",
        fetched_at: "2026-07-13T10:20:00.000Z",
      },
      fetchedAt: "2026-07-13T10:20:00.000Z",
      cached: false,
    });
  });

  it("loads one authenticated, owner-scoped Yahoo team roster", async () => {
    const req: any = {
      method: "POST",
      body: { externalTeamId: "team-2" },
      headers: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(loadYahooTeamRosterMock).toHaveBeenCalledWith({
      userId: "user-1",
      externalTeamId: "team-2",
      redirectUri: "https://fhfhockey.com/api/v1/account/yahoo/callback",
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        cached: false,
        externalTeamId: "team-2",
      }),
    );
  });

  it("rejects a missing team id before provider access", async () => {
    const req: any = { method: "POST", body: {}, headers: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(loadYahooTeamRosterMock).not.toHaveBeenCalled();
  });

  it("preserves owner-scope not-found errors", async () => {
    loadYahooTeamRosterMock.mockRejectedValue(
      new YahooTeamRosterErrorMock("Yahoo team was not found.", 404),
    );
    const req: any = {
      method: "POST",
      body: { externalTeamId: "other-user-team" },
      headers: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "Yahoo team was not found." });
  });

  it("rejects unsupported methods before auth", async () => {
    const req: any = { method: "GET", body: {}, headers: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(requireApiUserMock).not.toHaveBeenCalled();
  });
});
