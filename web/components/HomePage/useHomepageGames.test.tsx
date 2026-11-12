import { act, renderHook, waitFor } from "@testing-library/react";
import moment from "moment";
import { afterEach, describe, expect, it, vi } from "vitest";

import Fetch from "lib/cors-fetch";
import { useHomepageGames } from "./useHomepageGames";

vi.mock("lib/cors-fetch", () => ({ default: vi.fn() }));

describe("useHomepageGames", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("preserves selected-date navigation and exposes schedule errors", async () => {
    const today = moment().format("YYYY-MM-DD");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: "Schedule temporarily unavailable." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useHomepageGames({
        initialGames: [{ id: 1 }],
        nextGameDate: today,
      }),
    );

    expect(result.current.currentDate).toBe(today);
    expect(result.current.gamesHeaderText).toBe("Today's");

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe("Schedule temporarily unavailable.");
    });

    expect(fetchMock).toHaveBeenCalledWith(`/api/v1/games?date=${today}`);

    act(() => result.current.changeDate(1));

    expect(result.current.currentDate).toBe(
      moment(today).add(1, "day").format("YYYY-MM-DD"),
    );
    expect(result.current.gamesHeaderText).toBe("Tomorrow's");
  });

  // W3-3 D5 / rule 23: official live SOG replaces the stored pair only as a
  // pair; one official side never sits beside one stored side.
  it.each([
    ["only the home side is official", { homeTeam: { sog: 30 }, awayTeam: {} }, { home: 24, away: 20 }],
    ["both sides are official", { homeTeam: { sog: 31 }, awayTeam: { sog: 29 } }, { home: 31, away: 29 }],
  ])("overlays live SOG as a pair when %s", async (_label, landing, expected) => {
    const today = moment().format("YYYY-MM-DD");
    const storedAt = new Date().toISOString();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          {
            id: 7,
            gameState: "LIVE",
            homeTeam: { abbrev: "BOS" },
            awayTeam: { abbrev: "NYR" },
            analytics: {
              gameId: 7,
              homeShotsOnGoal: 24,
              awayShotsOnGoal: 20,
              shotsUpdatedAt: storedAt,
            },
          },
        ],
      }),
    );
    vi.mocked(Fetch).mockImplementation((async (url: string) => ({
      json: async () => (url.includes("/landing") ? landing : { standings: [] }),
    })) as any);

    const { result } = renderHook(() =>
      useHomepageGames({ initialGames: [], nextGameDate: today }),
    );

    await waitFor(() => expect(result.current.games).toHaveLength(1));
    const analytics = result.current.games[0].analytics;
    expect(analytics.homeShotsOnGoal).toBe(expected.home);
    expect(analytics.awayShotsOnGoal).toBe(expected.away);
  });
});
