import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const realtime = vi.hoisted(() => {
  const changeHandlers: Array<() => void> = [];
  let statusHandler: ((status: string) => void) | null = null;
  const channel = {
    on: vi.fn(
      (
        _event: string,
        _filter: Record<string, string>,
        handler: () => void,
      ) => {
        changeHandlers.push(handler);
        return channel;
      },
    ),
    subscribe: vi.fn((handler: (status: string) => void) => {
      statusHandler = handler;
      return channel;
    }),
  };
  return {
    changeHandlers,
    channel,
    channelFactory: vi.fn(() => channel),
    getStatusHandler: () => statusHandler,
    removeChannel: vi.fn(async () => undefined),
    reset: () => {
      changeHandlers.splice(0);
      statusHandler = null;
      channel.on.mockClear();
      channel.subscribe.mockClear();
    },
  };
});

const getSession = vi.hoisted(() =>
  vi.fn(async () => ({
    data: { session: { access_token: "test-token" } },
    error: null,
  })),
);

vi.mock("lib/supabase/client", () => ({
  default: {
    auth: { getSession },
    channel: realtime.channelFactory,
    removeChannel: realtime.removeChannel,
  },
}));

import {
  getYahooDraftPollIntervalMs,
  useYahooDraftSync,
} from "./useYahooDraftSync";

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn(async () => body),
  } as unknown as Response;
}

const draftState = {
  session: {
    id: "session-1",
    status: "predraft",
    providerStatus: "predraft",
    snapshotVersion: 1,
  },
  teams: [
    { yahooTeamKey: "team.1", teamName: "First Team", draftPosition: 1 },
  ],
  settings: { teamCount: 1, isSnakeDraft: true },
  picks: [],
};

describe("useYahooDraftSync", () => {
  beforeEach(() => {
    realtime.reset();
    realtime.channelFactory.mockClear();
    realtime.removeChannel.mockClear();
    getSession.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("subscribes before the resumed GET and refetches after Realtime events", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url === "/api/v1/account/yahoo/draft-sessions") {
        return response({
          enabled: true,
          leagues: [{ externalLeagueId: "league-1", leagueName: "League" }],
          ranking: null,
        });
      }
      if (url.endsWith("/poll")) return response(draftState);
      return response(draftState);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result, unmount } = renderHook(() => useYahooDraftSync(true));
    await waitFor(() => expect(result.current.enabled).toBe(true));
    calls.splice(0);

    act(() => result.current.resumeSession("session-1", "league-1"));
    await waitFor(() => expect(realtime.channel.subscribe).toHaveBeenCalled());
    expect(calls).toHaveLength(0);

    act(() => realtime.getStatusHandler()?.("SUBSCRIBED"));
    await waitFor(() => expect(result.current.draftState?.session.id).toBe("session-1"));
    expect(calls[0]?.url).toBe(
      "/api/v1/account/yahoo/draft-sessions/session-1",
    );
    expect(
      (calls[0]?.init?.headers as Record<string, string>).Authorization,
    ).toBe("Bearer test-token");
    expect(realtime.channel.on).toHaveBeenNthCalledWith(
      1,
      "postgres_changes",
      expect.objectContaining({
        table: "yahoo_draft_sessions",
        filter: "id=eq.session-1",
      }),
      expect.any(Function),
    );
    expect(realtime.channel.on).toHaveBeenNthCalledWith(
      2,
      "postgres_changes",
      expect.objectContaining({
        table: "yahoo_draft_picks",
        filter: "session_id=eq.session-1",
      }),
      expect.any(Function),
    );

    act(() => realtime.changeHandlers[1]?.());
    await waitFor(
      () =>
        expect(
          calls.filter((call) => call.url.endsWith("/session-1")),
        ).toHaveLength(2),
    );

    await act(async () => result.current.refreshDraft());
    expect(calls.at(-1)?.url).toBe(
      "/api/v1/account/yahoo/draft-sessions/session-1/poll",
    );
    expect(calls.at(-1)?.init?.method).toBe("POST");

    unmount();
    expect(realtime.removeChannel).toHaveBeenCalledWith(realtime.channel);
  });

  it("keeps a server-disabled feature inaccessible without surfacing an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response(
          { code: "yahoo_live_draft_disabled", error: "Disabled" },
          503,
        ),
      ),
    );
    const { result } = renderHook(() => useYahooDraftSync(true));
    await waitFor(() => expect(result.current.requestState).toBe("ready"));
    expect(result.current.enabled).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("falls back to HTTP when the Realtime channel cannot subscribe", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      if (String(input) === "/api/v1/account/yahoo/draft-sessions") {
        return response({
          enabled: true,
          leagues: [{ externalLeagueId: "league-1", leagueName: "League" }],
          ranking: null,
        });
      }
      return response(draftState);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useYahooDraftSync(true));
    await waitFor(() => expect(result.current.enabled).toBe(true));
    act(() => result.current.resumeSession("session-1", "league-1"));
    await waitFor(() => expect(realtime.channel.subscribe).toHaveBeenCalled());
    act(() => realtime.getStatusHandler()?.("CHANNEL_ERROR"));
    await waitFor(() => expect(result.current.draftState?.session.id).toBe("session-1"));
  });

  it("clears a restored session only when its authoritative GET is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/v1/account/yahoo/draft-sessions") {
          return response({
            enabled: true,
            leagues: [
              { externalLeagueId: "league-1", leagueName: "League" },
            ],
            ranking: null,
          });
        }
        return response({ error: "Session not found." }, 404);
      }),
    );

    const { result } = renderHook(() => useYahooDraftSync(true));
    await waitFor(() => expect(result.current.enabled).toBe(true));
    act(() => result.current.resumeSession("missing-session", "league-1"));
    await waitFor(() => expect(realtime.channel.subscribe).toHaveBeenCalled());
    act(() => realtime.getStatusHandler()?.("SUBSCRIBED"));
    await waitFor(() => expect(result.current.terminalSessionMissing).toBe(true));
    expect(result.current.sessionId).toBeNull();
    expect(result.current.error).toContain("Session not found");
  });

  it("uses the approved live, predraft, hidden, and terminal polling cadence", () => {
    expect(
      getYahooDraftPollIntervalMs({
        status: "active",
        providerStatus: "drafting",
        visible: true,
      }),
    ).toBe(30_000);
    expect(
      getYahooDraftPollIntervalMs({
        status: "active",
        providerStatus: "predraft",
        visible: true,
      }),
    ).toBe(30_000);
    expect(
      getYahooDraftPollIntervalMs({
        status: "predraft",
        providerStatus: "predraft",
        visible: true,
      }),
    ).toBe(120_000);
    expect(
      getYahooDraftPollIntervalMs({
        status: "active",
        providerStatus: "drafting",
        visible: false,
      }),
    ).toBe(120_000);
    expect(
      getYahooDraftPollIntervalMs({
        status: "reauth_required",
        providerStatus: "unknown",
        visible: true,
      }),
    ).toBeNull();
  });

  it("resumes an existing eligible league session without POSTing a restart", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        if (String(input) === "/api/v1/account/yahoo/draft-sessions") {
          return response({
            enabled: true,
            leagues: [
              {
                externalLeagueId: "league-1",
                leagueName: "League",
                session: { id: "session-1", status: "active" },
              },
            ],
            ranking: null,
          });
        }
        return response(draftState);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useYahooDraftSync(true));
    await waitFor(() => expect(result.current.enabled).toBe(true));
    let started = false;
    await act(async () => {
      started = await result.current.start("league-1");
    });
    expect(started).toBe(true);
    expect(result.current.sessionId).toBe("session-1");
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === "POST"),
    ).toHaveLength(0);
  });

  it("keeps unsupported leagues visible but refuses to start them", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        if (String(input) === "/api/v1/account/yahoo/draft-sessions") {
          return response({
            enabled: true,
            leagues: [
              {
                externalLeagueId: "salary-league",
                leagueName: "Salary League",
                supported: false,
                unsupportedReason: "yahoo_salary_cap_unsupported",
              },
            ],
            ranking: null,
          });
        }
        return response(draftState);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useYahooDraftSync(true));
    await waitFor(() => expect(result.current.leagues).toHaveLength(1));
    let started = true;
    await act(async () => {
      started = await result.current.start("salary-league");
    });
    expect(started).toBe(false);
    expect(result.current.error).toBe(
      "Salary-cap Yahoo drafts are not supported by live sync.",
    );
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === "POST"),
    ).toHaveLength(0);
  });
});
