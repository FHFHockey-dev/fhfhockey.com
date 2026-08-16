import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  EspnConnectionLeague,
  EspnDraftState,
} from "lib/integrations/espn/contracts";

const espnAccountRequest = vi.hoisted(() => vi.fn());

vi.mock("hooks/useEspnConnections", () => ({
  espnAccountRequest,
}));

import { useEspnDraftSync } from "./useEspnDraftSync";

const league = {
  id: "league-1",
  connectedAccountId: "account-1",
  externalLeagueKey: "fhl:2026:123456",
  espnLeagueId: "123456",
  name: "Fixture League",
  seasonKey: "2026",
  importedAt: null,
  settings: {
    version: 1,
    mappingVersion: "espn-fhl-v1",
    externalLeagueKey: "fhl:2026:123456",
    espnLeagueId: "123456",
    leagueName: "Fixture League",
    seasonKey: "2026",
    leagueType: "points",
    scoringType: "H2H_POINTS",
    teamCount: 2,
    teams: [],
    skaterScoringCategories: { GOALS: 3 },
    goalieScoringCategories: { WINS_GOALIE: 4 },
    categoryWeights: {},
    rosterConfig: { C: 1, G: 1, bench: 2 },
    draftOrderType: "snake",
    draftOrder: ["1", "2"],
    draftType: "SNAKE",
    liveDraftSupported: true,
    sourceHash: "a".repeat(64),
    fetchedAt: "2026-08-14T12:00:00.000Z",
    diagnostics: { status: "supported", warnings: [], unsupported: [] },
  },
  teams: [
    {
      id: "team-1",
      externalTeamKey: "1",
      name: "My Team",
      abbreviation: null,
      divisionId: null,
      isOwned: true,
    },
  ],
  isDefault: true,
  settingsChanged: false,
  syncStatus: null,
  syncErrorCode: null,
} as EspnConnectionLeague;

const activeState = {
  session: {
    id: "session-1",
    externalLeagueId: "league-1",
    externalTeamId: "team-1",
    status: "active",
    providerStatus: "drafting",
    snapshotVersion: 1,
    lastSnapshotAt: "2026-08-14T12:00:00.000Z",
    nextPollAt: "2026-08-14T12:00:30.000Z",
    lastErrorCode: null,
    lastErrorMessage: null,
  },
  league,
  picks: [],
  poll: { claimed: true, retryAfterSeconds: 30 },
} as EspnDraftState;

describe("useEspnDraftSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    espnAccountRequest.mockImplementation(
      async (path: string, init?: RequestInit) => {
        if (path === "/api/v1/account/espn/draft-sessions" && !init?.method) {
          return { enabled: true, leagues: [league], sessions: [] };
        }
        return activeState;
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it("starts an ordered draft, polls every 30 seconds while visible, and stops manually", async () => {
    const { result } = renderHook(() => useEspnDraftSync(true));
    await waitFor(() => expect(result.current.selectedLeagueId).toBe("league-1"));

    let intervalHandler: (() => void) | null = null;
    const setInterval = vi
      .spyOn(window, "setInterval")
      .mockImplementation((handler, timeout) => {
        if (timeout === 30_000) intervalHandler = handler as () => void;
        return setTimeout(() => undefined, 60_000);
      });
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");

    await act(async () => {
      expect(await result.current.start()).toBe(true);
    });
    expect(espnAccountRequest).toHaveBeenCalledWith(
      "/api/v1/account/espn/draft-sessions",
      {
        method: "POST",
        body: JSON.stringify({
          externalLeagueId: "league-1",
          externalTeamId: "team-1",
        }),
      },
    );
    await waitFor(() => expect(setInterval).toHaveBeenCalled());
    expect(intervalHandler).not.toBeNull();

    await act(async () => {
      intervalHandler?.();
    });
    await waitFor(() =>
      expect(espnAccountRequest).toHaveBeenCalledWith(
        "/api/v1/account/espn/draft-sessions/session-1/poll",
        { method: "POST" },
      ),
    );

    espnAccountRequest.mockResolvedValueOnce({
      ...activeState,
      session: { ...activeState.session, status: "stopped" },
    });
    await act(async () => {
      await result.current.stop();
    });
    expect(result.current.draftState?.session.status).toBe("stopped");
    expect(result.current.draftState?.picks).toEqual([]);
  });

  it("does not poll a hidden dashboard or a reauthentication terminal state", async () => {
    espnAccountRequest.mockImplementation(
      async (path: string, init?: RequestInit) => {
        if (path === "/api/v1/account/espn/draft-sessions" && !init?.method) {
          return { enabled: true, leagues: [league], sessions: [] };
        }
        return {
          ...activeState,
          session: { ...activeState.session, status: "reauth_required" },
        };
      },
    );
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const setInterval = vi.spyOn(window, "setInterval");
    const { result } = renderHook(() => useEspnDraftSync(true));
    await waitFor(() => expect(result.current.selectedLeagueId).toBe("league-1"));

    await act(async () => {
      await result.current.start();
    });
    await waitFor(() =>
      expect(result.current.draftState?.session.status).toBe("reauth_required"),
    );
    expect(setInterval).not.toHaveBeenCalledWith(expect.any(Function), 30_000);
  });
});
