import type { NextApiResponse } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class TestEspnIntegrationError extends Error {
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
    EspnIntegrationError: TestEspnIntegrationError,
    requireApiUser: vi.fn(),
    listEspnDraftLeagues: vi.fn(),
    startEspnDraftSession: vi.fn(),
    getEspnDraftState: vi.fn(),
    pollEspnDraftSession: vi.fn(),
    stopEspnDraftSession: vi.fn(),
  };
});

vi.mock("lib/api/requireApiUser", () => ({
  requireApiUser: mocks.requireApiUser,
}));
vi.mock("lib/integrations/espn/server", () => ({
  EspnIntegrationError: mocks.EspnIntegrationError,
}));
vi.mock("lib/integrations/espn/liveDraftServer", () => ({
  listEspnDraftLeagues: mocks.listEspnDraftLeagues,
  startEspnDraftSession: mocks.startEspnDraftSession,
  getEspnDraftState: mocks.getEspnDraftState,
  pollEspnDraftSession: mocks.pollEspnDraftSession,
  stopEspnDraftSession: mocks.stopEspnDraftSession,
}));

import sessionHandler from "../../../../../../pages/api/v1/account/espn/draft-sessions/[sessionId]";
import pollHandler from "../../../../../../pages/api/v1/account/espn/draft-sessions/[sessionId]/poll";
import stopHandler from "../../../../../../pages/api/v1/account/espn/draft-sessions/[sessionId]/stop";
import sessionsHandler from "../../../../../../pages/api/v1/account/espn/draft-sessions";

type TestResponse = NextApiResponse & {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
};

function response(): TestResponse {
  const result = {
    statusCode: 200,
    body: null as unknown,
    headers: {} as Record<string, string>,
  } as unknown as TestResponse;
  result.status = ((code: number) => {
    result.statusCode = code;
    return result;
  }) as TestResponse["status"];
  result.setHeader = ((name: string, value: string) => {
    result.headers[name] = value;
  }) as TestResponse["setHeader"];
  result.json = ((body: unknown) => {
    result.body = body;
    return result;
  }) as TestResponse["json"];
  return result;
}

describe("ESPN live-draft API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: "user-1" });
    mocks.listEspnDraftLeagues.mockResolvedValue({ enabled: true, leagues: [] });
    const state = { session: { id: "session-1", status: "active" }, picks: [] };
    mocks.startEspnDraftSession.mockResolvedValue(state);
    mocks.getEspnDraftState.mockResolvedValue(state);
    mocks.pollEspnDraftSession.mockResolvedValue(state);
    mocks.stopEspnDraftSession.mockResolvedValue({
      ...state,
      session: { id: "session-1", status: "stopped" },
    });
  });

  it("lists and starts only within the authenticated user's scope", async () => {
    await sessionsHandler({ method: "GET", headers: {} } as never, response());
    expect(mocks.listEspnDraftLeagues).toHaveBeenCalledWith({ userId: "user-1" });

    const startResponse = response();
    await sessionsHandler(
      {
        method: "POST",
        headers: {},
        body: { externalLeagueId: "league-1", externalTeamId: "team-1" },
      } as never,
      startResponse,
    );
    expect(mocks.startEspnDraftSession).toHaveBeenCalledWith({
      userId: "user-1",
      externalLeagueId: "league-1",
      externalTeamId: "team-1",
    });
    expect(startResponse.statusCode).toBe(200);
  });

  it("owner-scopes state, poll, and stop with the same session shape", async () => {
    const request = {
      headers: {},
      query: { sessionId: "session-1" },
    };
    await sessionHandler({ ...request, method: "GET" } as never, response());
    await pollHandler({ ...request, method: "POST" } as never, response());
    const stopped = response();
    await stopHandler({ ...request, method: "POST" } as never, stopped);

    const scoped = { userId: "user-1", sessionId: "session-1" };
    expect(mocks.getEspnDraftState).toHaveBeenCalledWith(scoped);
    expect(mocks.pollEspnDraftSession).toHaveBeenCalledWith(scoped);
    expect(mocks.stopEspnDraftSession).toHaveBeenCalledWith(scoped);
    expect(stopped.body).toEqual(
      expect.objectContaining({ session: { id: "session-1", status: "stopped" } }),
    );
  });

  it("rejects missing session IDs and unsupported methods before provider work", async () => {
    const missing = response();
    await pollHandler(
      { method: "POST", headers: {}, query: {} } as never,
      missing,
    );
    expect(missing.statusCode).toBe(400);
    expect(missing.body).toEqual(
      expect.objectContaining({ code: "ESPN_DRAFT_REQUEST_INVALID" }),
    );
    expect(mocks.pollEspnDraftSession).not.toHaveBeenCalled();

    const method = response();
    await sessionsHandler({ method: "DELETE", headers: {} } as never, method);
    expect(method.statusCode).toBe(405);
    expect(method.headers.Allow).toBe("GET, POST");
  });
});
