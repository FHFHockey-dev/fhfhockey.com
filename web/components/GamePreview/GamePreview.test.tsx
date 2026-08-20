import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useSWRMock = vi.hoisted(() => vi.fn());

vi.mock("swr", () => ({
  default: useSWRMock,
}));

import GamePreview from "./GamePreview";

const gameContext = {
  gameDate: "2026-10-12",
  awayTeam: { id: 6, abbrev: "BOS" },
  homeTeam: { id: 3, abbrev: "NYR" },
};

const completeRightRail = {
  seasonSeries: [
    {
      id: 2026020001,
      gameDate: "2026-10-12",
      gameState: "FUT",
      awayTeam: { id: 6, abbrev: "BOS" },
      homeTeam: { id: 3, abbrev: "NYR" },
    },
    {
      id: 2025020001,
      gameDate: "2026-01-14",
      gameState: "FINAL",
      awayTeam: { id: 6, abbrev: "BOS", score: 4 },
      homeTeam: { id: 3, abbrev: "NYR", score: 2 },
    },
  ],
  teamSeasonStats: {
    awayTeam: {
      ppPctg: 0.247,
      pkPctg: 0.811,
      goalsForPerGamePlayed: 3.42,
      goalsAgainstPerGamePlayed: 2.71,
    },
    homeTeam: {
      ppPctg: 0.193,
      pkPctg: 0.814,
      goalsForPerGamePlayed: 3.08,
      goalsAgainstPerGamePlayed: 2.89,
    },
  },
};

const completeSchedule = {
  gameWeek: [
    {
      games: [
        {
          id: 2026020001,
          awayTeam: { odds: [{ providerId: 9, value: "+120" }] },
          homeTeam: { odds: [{ providerId: 9, value: "-135" }] },
        },
      ],
    },
  ],
};

function mockResponses(
  rightRail: { data?: unknown; error?: Error },
  schedule: { data?: unknown; error?: Error } = {},
) {
  useSWRMock.mockImplementation((key: string | null) => {
    if (key?.includes("/right-rail")) return rightRail;
    if (key?.includes("/schedule/date/")) return schedule;
    return {};
  });
}

describe("GamePreview data states", () => {
  beforeEach(() => {
    useSWRMock.mockReset();
  });

  afterEach(cleanup);

  it("renders complete real odds and team metrics without mock analytics", () => {
    mockResponses(
      { data: completeRightRail },
      { data: completeSchedule },
    );

    render(<GamePreview gameId="2026020001" gameContext={gameContext} />);

    expect(screen.getByText("BOS 44%")).toBeTruthy();
    expect(screen.getByText("NYR 56%")).toBeTruthy();
    expect(screen.getAllByText("3.42").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3.08").length).toBeGreaterThan(0);
    expect(screen.getByText("24.7%")).toBeTruthy();
    expect(screen.getByText("81.4%")).toBeTruthy();
    expect(screen.getByText("BOS 4 - 2 NYR")).toBeTruthy();
    expect(
      screen.getByText(
        "Starting goalie data is not provided by this preview source.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Away Starter")).toBeNull();
    expect(screen.queryByText("Fetching player trends from FHFH Database...")).toBeNull();
    expect(screen.queryByText("BOS 42%")).toBeNull();
    expect(screen.queryByText("NYR 58%")).toBeNull();
  });

  it("preserves partial real metrics and marks each missing field unavailable", () => {
    mockResponses(
      {
        data: {
          seasonSeries: [completeRightRail.seasonSeries[0]],
          teamSeasonStats: {
            awayTeam: { goalsForPerGamePlayed: 2.91 },
            homeTeam: {},
          },
        },
      },
      { data: { gameWeek: [{ games: [{ id: 2026020001 }] }] } },
    );

    render(<GamePreview gameId="2026020001" gameContext={gameContext} />);

    expect(
      screen.getByText("Market odds are unavailable for this game."),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Partial team statistics; unavailable fields are shown as —.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("2.91")).toBeTruthy();
    expect(screen.getAllByLabelText("Unavailable")).toHaveLength(5);
    expect(screen.queryByText("3.10")).toBeNull();
    expect(screen.queryByText("3.30")).toBeNull();
    expect(screen.queryByText("21.0%")).toBeNull();
    expect(screen.queryByText("22.0%")).toBeNull();
    expect(screen.queryByText("74.0%")).toBeNull();
    expect(screen.queryByText("82.0%")).toBeNull();
  });

  it("renders explicit unavailable states when loaded payloads contain no data", () => {
    mockResponses({ data: {} });

    render(<GamePreview gameId="2026020001" />);

    expect(
      screen.getByText("Market odds are unavailable for this game."),
    ).toBeTruthy();
    expect(
      screen.getByText("Team statistics are unavailable for this game."),
    ).toBeTruthy();
    expect(
      screen.getByText("Head-to-head data is unavailable for this game."),
    ).toBeTruthy();
    expect(screen.queryByText("First meeting of the season.")).toBeNull();
  });

  it("surfaces right-rail and schedule source errors", () => {
    mockResponses(
      { error: new Error("right rail failed") },
      { error: new Error("schedule failed") },
    );

    render(<GamePreview gameId="2026020001" gameContext={gameContext} />);

    expect(screen.getByText("Market odds could not be loaded.")).toBeTruthy();
    expect(screen.getByText("Team statistics could not be loaded.")).toBeTruthy();
    expect(screen.getByText("Recent meetings could not be loaded.")).toBeTruthy();
    expect(screen.getAllByRole("alert")).toHaveLength(3);
  });

  it("distinguishes loading from unavailable data", () => {
    mockResponses({});

    render(<GamePreview gameId="2026020001" />);

    expect(screen.getByText("Loading market odds…")).toBeTruthy();
    expect(screen.getByText("Loading team statistics…")).toBeTruthy();
    expect(screen.getByText("Loading recent meetings…")).toBeTruthy();
  });
});
