import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import { clearClientFetchCache } from "lib/dashboard/clientFetchCache";

const scheduleState = vi.hoisted(() => ({
  rows: [] as any[],
  numGamesPerDay: [12, 12, 12, 12, 7, 12, 6],
  loading: false,
}));

vi.mock("components/GameGrid/utils/useSchedule", () => ({
  default: () => [
    scheduleState.rows,
    scheduleState.numGamesPerDay,
    scheduleState.loading,
  ],
}));

vi.mock("components/TransactionTrends/OwnershipSparkline", () => ({
  default: () => <div data-testid="ownership-sparkline" />,
}));

import TopAddsRail from "./TopAddsRail";

const historicalIdentity = {
  source: { id: 53, abbreviation: "ARI", name: "Arizona Coyotes" },
  canonical: { id: 68, abbreviation: "UTA", name: "Utah Mammoth" },
};

const currentIdentity = {
  source: { id: 1, abbreviation: "NJD", name: "New Jersey Devils" },
  canonical: { id: 1, abbreviation: "NJD", name: "New Jersey Devils" },
};

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  } as Response;
}

function installFetch(
  requestedDateFor: (date: string) => string = (date) => date,
  resolvedSeasonIdFor: (date: string) => number = () => 20232024,
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost");
      if (url.pathname === "/api/v1/forge/players") {
        const date = url.searchParams.get("date") ?? "2024-03-14";
        return jsonResponse({
          asOfDate: date,
          requestedDate: requestedDateFor(date),
          requestedSeasonId: 20232024,
          resolvedSeasonId: resolvedSeasonIdFor(date),
          horizonGames: Number(url.searchParams.get("horizon")),
          data: [
            {
              player_id: 53,
              player_name: "Historical Stream",
              team_name: "Arizona Coyotes",
              teamIdentity: historicalIdentity,
              position: "C",
              pts: 2,
              ppp: 0.5,
              sog: 3,
              hit: 1,
              blk: 1,
              uncertainty: 0.2,
            },
            {
              player_id: 1,
              player_name: "Current Stream",
              team_name: "New Jersey Devils",
              teamIdentity: currentIdentity,
              position: "C",
              pts: 2,
              ppp: 0.5,
              sog: 3,
              hit: 1,
              blk: 1,
              uncertainty: 0.2,
            },
          ],
        });
      }
      if (url.pathname === "/api/v1/transactions/ownership-trends") {
        return jsonResponse({
          success: true,
          selectedPlayers: [
            {
              playerId: 53,
              name: "Historical Stream",
              teamAbbrev: "NJD",
              teamFullName: "New Jersey Devils",
              latest: 40,
              delta: 5,
              sparkline: [],
            },
            {
              playerId: 1,
              name: "Current Stream",
              teamAbbrev: "NJD",
              teamFullName: "New Jersey Devils",
              latest: 40,
              delta: 6,
              sparkline: [],
            },
          ],
          risers: [],
          fallers: [],
        });
      }
      return jsonResponse({});
    }),
  );
}

function historicalRows(gameDate = 20232024) {
  return [
    {
      teamId: 53,
      FRI: {
        id: 1,
        season: gameDate,
        gameType: 2,
        homeTeam: { id: 53 },
        awayTeam: { id: 6 },
      },
      SAT: {
        id: 2,
        season: 20242025,
        gameType: 2,
        homeTeam: { id: 53 },
        awayTeam: { id: 6 },
      },
      SUN: {
        id: 3,
        season: gameDate,
        gameType: 2,
        homeTeam: { id: 6 },
        awayTeam: { id: 53 },
      },
    },
    {
      teamId: 68,
      FRI: {
        id: 4,
        season: gameDate,
        gameType: 2,
        homeTeam: { id: 68 },
        awayTeam: { id: 6 },
      },
    },
    { teamId: 1 },
  ];
}

describe("TopAddsRail historical schedule ownership", () => {
  beforeEach(() => {
    clearClientFetchCache();
    vi.restoreAllMocks();
    scheduleState.rows = historicalRows();
    scheduleState.loading = false;
  });

  afterEach(() => {
    cleanup();
  });

  it("uses canonical UTA schedule context while preserving the historical source display", async () => {
    installFetch();
    render(
      <TopAddsRail date="2024-03-14" position="all" positionLabel="All" />,
    );

    expect(await screen.findByText("Historical Stream")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "This Week" }));

    const historicalCard = await screen.findByRole("link", {
      name: /Historical Stream Arizona Coyotes/,
    });
    await waitFor(() => {
      expect(within(historicalCard).getByText("1")).toBeTruthy();
      expect(within(historicalCard).getByText("2G • 2 off")).toBeTruthy();
    });
    expect(screen.getByText("Schedule included")).toBeTruthy();
    expect(within(historicalCard).queryByText(/New Jersey Devils/)).toBeNull();
  });

  it("fails a stale requested-date season closed with truthful unavailable copy", async () => {
    installFetch(() => "2024-03-13");
    render(
      <TopAddsRail date="2024-03-14" position="all" positionLabel="All" />,
    );

    await screen.findByText(
      "Error: Projection response does not match the selected date and horizon.",
    );
    fireEvent.click(screen.getByRole("button", { name: "This Week" }));

    expect(await screen.findByText("Schedule unavailable")).toBeTruthy();
    expect(
      screen.getByText(
        "Error: Projection response does not match the selected date and horizon.",
      ),
    ).toBeTruthy();
    expect(
      screen.queryByRole("link", {
        name: /Historical Stream Arizona Coyotes/,
      }),
    ).toBeNull();
  });

  it("hides a projection whose source identity belongs to a different resolved season", async () => {
    installFetch(
      (date) => date,
      () => 20242025,
    );
    render(
      <TopAddsRail date="2024-03-14" position="all" positionLabel="All" />,
    );

    expect(await screen.findByText("Current Stream")).toBeTruthy();
    expect(screen.queryByText("Historical Stream")).toBeNull();
  });

  it("masks retained rows until a changed week completes its own loading cycle", async () => {
    installFetch();
    const { rerender } = render(
      <TopAddsRail date="2024-03-14" position="all" positionLabel="All" />,
    );
    await screen.findByText("Historical Stream");
    fireEvent.click(screen.getByRole("button", { name: "This Week" }));
    expect(await screen.findByText("Schedule included")).toBeTruthy();

    rerender(
      <TopAddsRail date="2024-03-21" position="all" positionLabel="All" />,
    );
    expect(await screen.findByText("Loading schedule...")).toBeTruthy();

    scheduleState.loading = true;
    rerender(
      <TopAddsRail date="2024-03-21" position="all" positionLabel="All" />,
    );
    scheduleState.rows = historicalRows();
    scheduleState.loading = false;
    rerender(
      <TopAddsRail date="2024-03-21" position="all" positionLabel="All" />,
    );

    expect(await screen.findByText("Schedule included")).toBeTruthy();
  });
});
