import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TeamUnderlyingStatsLandingRoute from "../../../../pages/underlying-stats/teamStats/index";
import {
  createDefaultTeamLandingFilterState,
  serializeTeamStatsFilterStateToQuery,
} from "../../../../lib/underlying-stats/teamStatsFilters";
import { buildTeamStatsLandingApiPath } from "../../../../lib/underlying-stats/teamStatsLandingApi";

const routerMock = {
  isReady: true,
  pathname: "/underlying-stats/teamStats",
  query: {} as Record<string, string>,
  replace: vi.fn().mockResolvedValue(true),
};

vi.mock("next/router", () => ({
  useRouter: () => routerMock,
}));

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

function createCanonicalQuery(overrides: Record<string, string> = {}) {
  return {
    ...serializeTeamStatsFilterStateToQuery(
      createDefaultTeamLandingFilterState({ currentSeasonId: 20252026 })
    ),
    ...overrides,
  };
}

function getLastElement<T>(items: T[]): T {
  const item = items[items.length - 1];

  if (item == null) {
    throw new Error("Expected at least one matching element.");
  }

  return item;
}

function getFetchCalls() {
  return vi.mocked(fetch).mock.calls;
}

function getTeamLandingFetchCalls() {
  return getFetchCalls().filter(([input]) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    return url.startsWith("/api/v1/underlying-stats/teams");
  });
}

function createStatusSnapshot() {
  return {
    latestSnapshotDate: "2026-04-07",
    rowCount: 1,
    status: "ready",
  };
}

function expectLastTeamLandingFetch(path: string) {
  const calls = getTeamLandingFetchCalls();
  const lastCall = getLastElement(calls);

  expect(lastCall).toEqual([
    path,
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  ]);
}

describe("TeamUnderlyingStatsLandingRoute", () => {
  beforeEach(() => {
    routerMock.isReady = true;
    routerMock.pathname = "/underlying-stats/teamStats";
    routerMock.query = {};
    routerMock.replace.mockClear();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: string | URL | Request) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        if (url.startsWith("/api/v1/underlying-stats/route-status")) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              status: {
                teamRatings: createStatusSnapshot(),
                skaterOffenseRatings: createStatusSnapshot(),
                skaterDefenseRatings: createStatusSnapshot(),
                goalieRatings: createStatusSnapshot(),
                gamePredictions: createStatusSnapshot(),
                playerPredictions: createStatusSnapshot(),
                modelMarketFlags: createStatusSnapshot(),
              },
            }),
          };
        }

        const params = new URL(url, "http://localhost").searchParams;
        const displayMode = params.get("displayMode") ?? "counts";
        const family = displayMode === "rates" ? "rates" : "counts";

        return {
          ok: true,
          json: async () => ({
            family,
            rows: [
              {
                rowKey: `landing:team:${family}:1`,
                rank: 1,
                teamId: 1,
                teamLabel: "FLA",
                gamesPlayed: 10,
                points: 12,
                xgfPct: 0.554,
                pdo: 101.2,
                xgfPer60: 2.45,
              },
            ],
            sort:
              family === "rates"
                ? { sortKey: "xgfPct", direction: "desc" }
                : { sortKey: "points", direction: "desc" },
            pagination: { page: 1, pageSize: 50, totalRows: 1, totalPages: 1 },
            placeholder: false,
            generatedAt: "2026-04-07T12:00:00.000Z",
          }),
        };
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("canonicalizes the team landing route before rendering the live page", async () => {
    render(<TeamUnderlyingStatsLandingRoute />);

    expect(screen.getByText("Loading team underlying stats...")).toBeTruthy();

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith(
        {
          pathname: "/underlying-stats/teamStats",
          query: expect.objectContaining({
            fromSeasonId: "20252026",
            throughSeasonId: "20252026",
            seasonType: "regularSeason",
            strength: "fiveOnFive",
            scoreState: "allScores",
            displayMode: "counts",
            venue: "all",
            scope: "none",
            sortKey: "points",
            sortDirection: "desc",
            page: "1",
            pageSize: "50",
          }),
        },
        undefined,
        { shallow: true }
      );
    });

    expect(getTeamLandingFetchCalls()).toHaveLength(0);
  });

  it("loads the default team landing API and renders returned rows", async () => {
    const defaultState = createDefaultTeamLandingFilterState({ currentSeasonId: 20252026 });
    routerMock.query = createCanonicalQuery();

    render(<TeamUnderlyingStatsLandingRoute />);

    await waitFor(() => {
      expectLastTeamLandingFetch(buildTeamStatsLandingApiPath(defaultState));
    });

    expect(
      screen.getByRole("heading", { name: "Team Table Explorer" })
    ).toBeTruthy();
    expect(screen.getByText("FLA")).toBeTruthy();
    expect(screen.getByText("Showing 1 of 1 teams.")).toBeTruthy();
    expect(screen.getByText("Points")).toBeTruthy();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("switches to rates mode, rewrites the canonical query, and refetches from the rates API path", async () => {
    routerMock.query = createCanonicalQuery();

    render(<TeamUnderlyingStatsLandingRoute />);

    await waitFor(() => {
      expect(getTeamLandingFetchCalls()).toHaveLength(1);
    });

    fireEvent.change(screen.getAllByLabelText("Display mode")[0], {
      target: { value: "rates" },
    });

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith(
        {
          pathname: "/underlying-stats/teamStats",
          query: expect.objectContaining({
            displayMode: "rates",
            sortKey: "xgfPct",
            sortDirection: "desc",
            page: "1",
          }),
        },
        undefined,
        { shallow: true }
      );
    });

    const ratesState = createDefaultTeamLandingFilterState({ currentSeasonId: 20252026 });
    ratesState.primary.displayMode = "rates";
    ratesState.view.sort = { sortKey: "xgfPct", direction: "desc" };

    await waitFor(() => {
      expectLastTeamLandingFetch(buildTeamStatsLandingApiPath(ratesState));
    });

    expect(screen.getByText("xGF/60")).toBeTruthy();
    expect(screen.getByText("2.45")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sort by TOI/GP" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Sort by Points" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Sort by PDO" }).length).toBeGreaterThan(0);
  });

  it("shows team-specific advanced filters and hides player-only controls", async () => {
    routerMock.query = createCanonicalQuery();

    render(<TeamUnderlyingStatsLandingRoute />);

    await waitFor(() => {
      expect(getTeamLandingFetchCalls()).toHaveLength(1);
    });

    fireEvent.click(
      getLastElement(screen.getAllByRole("button", { name: "Show advanced filters" }))
    );

    expect(screen.getByLabelText("Team")).toBeTruthy();
    expect(screen.getByLabelText("Opponent")).toBeTruthy();
    expect(screen.getByLabelText("Home or Away")).toBeTruthy();
    expect(screen.getByLabelText("Minimum TOI")).toBeTruthy();
    expect(screen.queryByLabelText("Position Group")).toBeNull();
  });

  it("renders the full team table surface and updates sort state from table headers", async () => {
    routerMock.query = createCanonicalQuery();

    render(<TeamUnderlyingStatsLandingRoute />);

    await waitFor(() => {
      expect(getTeamLandingFetchCalls()).toHaveLength(1);
    });

    expect(getLastElement(screen.getAllByRole("button", { name: "Sort by Team" }))).toBeTruthy();
    expect(getLastElement(screen.getAllByRole("button", { name: "Sort by GP" }))).toBeTruthy();
    expect(getLastElement(screen.getAllByRole("button", { name: "Sort by TOI" }))).toBeTruthy();
    expect(getLastElement(screen.getAllByRole("button", { name: "Sort by Points" }))).toBeTruthy();
    expect(getLastElement(screen.getAllByRole("button", { name: "Sort by PDO" }))).toBeTruthy();

    fireEvent.click(
      getLastElement(screen.getAllByRole("button", { name: "Sort by Team" }))
    );

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith(
        {
          pathname: "/underlying-stats/teamStats",
          query: expect.objectContaining({
            sortKey: "teamLabel",
            sortDirection: "desc",
            page: "1",
          }),
        },
        undefined,
        { shallow: true }
      );
    });

  });
});
