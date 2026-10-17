import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, radarMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  radarMock: vi.fn((_props: Record<string, unknown>) => null),
}));
vi.mock("lib/supabase", () => ({ default: { from: fromMock } }));
vi.mock("next/router", () => ({
  useRouter: () => ({ query: { playerId: "123" } }),
}));
vi.mock("next-seo", () => ({ NextSeo: () => null }));
vi.mock("components/StatsPage/PlayerSearchBar", () => ({ default: () => null }));
vi.mock("components/PlayerStats/PlayerRadarChart", () => ({ PlayerRadarChart: radarMock }));
vi.mock("components/PlayerStats/PlayerContextualStats", () => ({ PlayerContextualStats: () => null }));
vi.mock("components/PlayerStats/PlayerPerformanceHeatmap", () => ({ PlayerPerformanceHeatmap: () => null }));

import PlayerStatsPage, { getServerSideProps } from "pages/stats/player/[playerId]";

describe("player stats route", () => {
  beforeEach(() => {
    fromMock.mockReset();
    radarMock.mockClear();
  });
  afterEach(cleanup);

  it("returns 404 for invalid IDs without querying players", async () => {
    for (const playerId of ["abc", "0", "01", "9007199254740992"]) {
      await expect(getServerSideProps({ query: { playerId } } as any)).resolves.toEqual({ notFound: true });
    }
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the player row is absent", async () => {
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    });

    await expect(getServerSideProps({ query: { playerId: "123" } } as any)).resolves.toEqual({ notFound: true });
    expect(fromMock).toHaveBeenCalledWith("players");
  });

  it("propagates a database failure instead of returning 404", async () => {
    const error = new Error("database unavailable");
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error }) }) }),
    });

    await expect(getServerSideProps({ query: { playerId: "123" } } as any)).rejects.toThrow(error);
  });

  it("passes the server-resolved historical season and selected window to the radar", () => {
    render(React.createElement(PlayerStatsPage, {
      player: { id: 123, fullName: "Historical Skater", position: "C" },
      gameLog: [{ date: "2024-01-01", games_played: 1, points: 2 }],
      playoffGameLog: [],
      seasonTotals: [],
      isGoalie: false,
      availableSeasons: [20232024],
      availableSeasonsFormatted: [],
      mostRecentSeason: 20232024,
    } as any));

    expect(radarMock.mock.lastCall?.[0]).toMatchObject({
      seasonId: 20232024,
      timeFrame: "season",
      usedGameLogFallback: false,
    });
    fireEvent.click(screen.getByRole("button", { name: "Last 10" }));
    expect(radarMock.mock.lastCall?.[0]).toMatchObject({
      seasonId: 20232024,
      timeFrame: "last10",
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("preserves unavailable season and fallback-log context instead of guessing a comparison season", () => {
    render(React.createElement(PlayerStatsPage, {
      player: { id: 123, fullName: "Fallback Skater", position: "C" },
      gameLog: [{ date: "2024-01-01", games_played: 1, points: 2 }],
      playoffGameLog: [],
      seasonTotals: [],
      isGoalie: false,
      availableSeasons: [],
      availableSeasonsFormatted: [],
      mostRecentSeason: null,
      usedGameLogFallback: true,
    } as any));

    expect(radarMock.mock.lastCall?.[0]).toMatchObject({
      seasonId: null,
      timeFrame: "season",
      usedGameLogFallback: true,
    });
    expect(fromMock).not.toHaveBeenCalled();
  });
});
