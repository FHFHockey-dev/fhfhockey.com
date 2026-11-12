import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useSWRMock = vi.hoisted(() => vi.fn());

vi.mock("swr", () => ({ default: useSWRMock }));
vi.mock("next/router", () => ({
  useRouter: () => ({ isReady: true, query: { gameId: "2026020001" } }),
}));
vi.mock("next/head", () => ({ default: () => null }));
vi.mock("components/StatsPage/PlayerSearchBar", () => ({
  default: () => null,
}));

import GameStatsPage from "pages/stats/game/[gameId]";

const PREDICTIONS_NOTICE =
  "FHFH predictions unavailable while the model is developed and validated.";

const rightRail = {
  seasonSeries: [
    {
      id: 2026020001,
      gameDate: "2026-10-12",
      gameState: "FUT",
      awayTeam: { id: 6, abbrev: "BOS" },
      homeTeam: { id: 3, abbrev: "NYR" },
    },
  ],
};

function schedule(homeProviderId: number) {
  return {
    gameWeek: [
      {
        games: [
          {
            id: 2026020001,
            gameState: "FUT",
            startTimeUTC: "2026-10-12T23:00:00Z",
            awayTeam: { odds: [{ providerId: 9, value: "+120" }] },
            homeTeam: { odds: [{ providerId: homeProviderId, value: "-135" }] },
          },
        ],
      },
    ],
    oddsPartners: [
      { partnerId: 8, name: "Sportradar Book" },
      { partnerId: 9, name: "DraftKings" },
    ],
    fhfhFetchedAt: "2026-10-12T22:15:00.000Z",
  };
}

function mockResponses(scheduleData: unknown) {
  useSWRMock.mockImplementation((key: string | null) => {
    if (key?.includes("/right-rail")) return { data: rightRail };
    if (key?.includes("/boxscore")) return { error: new Error("not started") };
    if (key?.includes("/schedule/date/")) return { data: scheduleData };
    return {};
  });
}

describe("/stats/game/[gameId] market odds", () => {
  beforeEach(() => useSWRMock.mockReset());
  afterEach(cleanup);

  it("labels a same-book market probability and states FHFH predictions are unavailable", () => {
    mockResponses(schedule(9));
    render(<GameStatsPage />);

    expect(screen.getByText(PREDICTIONS_NOTICE)).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Market win probability" }),
    ).toBeTruthy();
    expect(screen.queryByText("Implied Win Probability")).toBeNull();
    expect(
      screen.getByText(/^De-vigged sportsbook odds · DraftKings · as of .+/),
    ).toBeTruthy();
    expect(screen.getByText("BOS 44%")).toBeTruthy();
    expect(screen.getByText("NYR 56%")).toBeTruthy();
  });

  it("shows the unavailable state when the sides come from different sportsbooks", () => {
    mockResponses(schedule(8));
    render(<GameStatsPage />);

    expect(screen.getByText("Market odds unavailable.")).toBeTruthy();
    expect(screen.queryByText(/^BOS \d+%$/)).toBeNull();
    expect(screen.getByText(PREDICTIONS_NOTICE)).toBeTruthy();
  });
});
