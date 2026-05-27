import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PlayerUnderlyingStatsLandingPage from "../../../../pages/underlying-stats/playerStats/index";
import { createDefaultLandingFilterState } from "../../../../lib/underlying-stats/playerStatsFilters";
import { buildPlayerStatsLandingApiPath } from "../../../../lib/underlying-stats/playerStatsQueries";

const routerMock = {
  isReady: true,
  pathname: "/underlying-stats/playerStats",
  query: {} as Record<string, string>,
  replace: vi.fn()
};

vi.mock("next/router", () => ({
  useRouter: () => routerMock
}));

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => children
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  )
}));

vi.mock("components/underlying-stats/PlayerStatsExpandedRowChart", () => ({
  default: ({
    playerId,
    selectedMetricKey,
    variant
  }: {
    playerId: number;
    selectedMetricKey: string;
    variant?: "player" | "goalie";
  }) => (
    <div>
      Expanded chart for player {playerId} using {selectedMetricKey} via{" "}
      {variant ?? "player"}
    </div>
  )
}));

function resolveFamily(statMode: string | null, displayMode: string | null) {
  if (statMode === "individual") {
    return displayMode === "rates" ? "individualRates" : "individualCounts";
  }

  if (statMode === "goalies") {
    return displayMode === "rates" ? "goalieRates" : "goalieCounts";
  }

  return displayMode === "rates" ? "onIceRates" : "onIceCounts";
}

function buildMockLandingRow(family: string) {
  const baseRow = {
    rowKey: `row:${family}`,
    playerId: 8478401,
    playerName: "Test Player",
    teamLabel: "TST",
    gamesPlayed: 12,
    toiSeconds: 987
  };

  if (family === "goalieCounts" || family === "goalieRates") {
    return baseRow;
  }

  return {
    ...baseRow,
    positionCode: "C"
  };
}

function buildMockLandingRows(family: string, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const playerNumber = index + 1;
    const row = buildMockLandingRow(family);

    return {
      ...row,
      rowKey: `row:${family}:${playerNumber}`,
      playerId: 8478400 + playerNumber,
      playerName: `Player ${playerNumber}`
    };
  });
}

function getPlayerLandingFetchCalls() {
  return vi.mocked(fetch).mock.calls.filter(([input]) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    return (
      url.startsWith("/api/v1/underlying-stats/players") ||
      url.startsWith("/api/v1/underlying-stats/goalies")
    );
  });
}

describe("PlayerUnderlyingStatsLandingPage", () => {
  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    window.sessionStorage.clear();
    routerMock.pathname = "/underlying-stats/playerStats";
    routerMock.query = {
      fromSeasonId: "20252026",
      throughSeasonId: "20252026",
      scope: "dateRange",
      startDate: "2025-11-01",
      endDate: "2026-02-01"
    };
    routerMock.replace.mockReset();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: string | URL | Request) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const params = new URL(url, "http://localhost").searchParams;
        const family = resolveFamily(
          params.get("statMode"),
          params.get("displayMode")
        );

        return {
          ok: true,
          json: async () => ({
            family,
            rows: [buildMockLandingRow(family)],
            sort: { sortKey: "xgfPct", direction: "desc" },
            pagination: { page: 1, pageSize: 50, totalRows: 1, totalPages: 1 },
            placeholder: false,
            generatedAt: "2026-03-31T12:00:00.000Z"
          })
        };
      })
    );
  });

  it("blocks invalid date-range state until the user resets the landing filters", async () => {
    routerMock.query = {
      fromSeasonId: "20252026",
      throughSeasonId: "20252026",
      scope: "dateRange",
      endDate: "2026-02-01"
    };

    render(<PlayerUnderlyingStatsLandingPage />);

    await waitFor(() => {
      expect(
        screen.getAllByText("Invalid filter combination").length
      ).toBeGreaterThan(0);
    });

    expect(
      screen.getAllByText("Date Range requires a start date.").length
    ).toBeGreaterThan(0);
    expect(getPlayerLandingFetchCalls()).toHaveLength(0);

    fireEvent.click(
      screen.getByRole("button", { name: "Reset landing filters" })
    );

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalled();
    });

    const latestReplaceCall = routerMock.replace.mock.calls.at(-1);
    expect(latestReplaceCall?.[0]).toMatchObject({
      pathname: "/underlying-stats/playerStats",
      query: expect.objectContaining({
        scope: "none"
      })
    });
    expect(latestReplaceCall?.[0].query).not.toHaveProperty("startDate");
    expect(latestReplaceCall?.[0].query).not.toHaveProperty("endDate");

    await waitFor(() => {
      expect(getPlayerLandingFetchCalls().length).toBeGreaterThan(0);
    });
  });

  it("shows the active scope and clears stale date-range params when switching to # of GP", async () => {
    render(<PlayerUnderlyingStatsLandingPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Scope: Date Range").length).toBeGreaterThan(
        0
      );
    });

    fireEvent.change(screen.getByLabelText("# of GP"), {
      target: { value: "7" }
    });

    await waitFor(() => {
      expect(screen.getByText("Scope: Game Range")).toBeTruthy();
    });

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalled();
    });

    const latestReplaceCall = routerMock.replace.mock.calls.at(-1);
    expect(latestReplaceCall?.[0]).toMatchObject({
      pathname: "/underlying-stats/playerStats",
      query: expect.objectContaining({
        scope: "gameRange"
      })
    });
    expect(latestReplaceCall?.[0].query).not.toHaveProperty("startDate");
    expect(latestReplaceCall?.[0].query).not.toHaveProperty("endDate");
    expect(latestReplaceCall?.[0].query).not.toHaveProperty("byTeamGames");

    await waitFor(() => {
      expect(fetch).toHaveBeenLastCalledWith(
        expect.stringContaining("scope=gameRange"),
        expect.any(Object)
      );
    });

    expect(fetch).toHaveBeenLastCalledWith(
      expect.not.stringContaining("startDate="),
      expect.any(Object)
    );
    expect(fetch).toHaveBeenLastCalledWith(
      expect.not.stringContaining("endDate="),
      expect.any(Object)
    );
  });

  it("surfaces the real no-results empty state when the API responds without rows", async () => {
    routerMock.query = {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          family: "onIceCounts",
          rows: [],
          sort: { sortKey: "xgfPct", direction: "desc" },
          pagination: { page: 1, pageSize: 50, totalRows: 0, totalPages: 0 },
          placeholder: false,
          generatedAt: "2026-03-31T12:00:00.000Z"
        })
      })
    );

    render(<PlayerUnderlyingStatsLandingPage />);

    await waitFor(() => {
      expect(
        screen.getAllByText(
          "No players matched the current filter combination. Widen the scope or reset filters."
        ).length
      ).toBeTruthy();
    });
  });

  it("links each landing player row to the detail route with preserved context", async () => {
    routerMock.query = {
      fromSeasonId: "20252026",
      throughSeasonId: "20252026",
      seasonType: "regularSeason",
      strength: "powerPlay",
      scoreState: "allScores",
      statMode: "individual",
      displayMode: "counts",
      venue: "away",
      tradeMode: "split",
      scope: "dateRange",
      startDate: "2025-11-01",
      endDate: "2026-02-01",
      sortKey: "totalPoints",
      sortDirection: "desc",
      page: "2",
      pageSize: "25"
    };

    render(<PlayerUnderlyingStatsLandingPage />);

    const link = await screen.findByRole("link", { name: "Test Player" });
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByText("16:27")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(link.getAttribute("href")).toBe(
      "/underlying-stats/playerStats/8478401?fromSeasonId=20252026&throughSeasonId=20252026&seasonType=regularSeason&strength=powerPlay&scoreState=allScores&statMode=individual&displayMode=counts&venue=away&tradeMode=split&scope=dateRange&startDate=2025-11-01&endDate=2026-02-01&sortKey=totalPoints&sortDirection=desc&page=1&pageSize=100"
    );
  });

  it("uses goalie-only landing controls and the dedicated goalie API namespace for the goalie variant", async () => {
    routerMock.pathname = "/underlying-stats/goalieStats";
    routerMock.query = {
      fromSeasonId: "20252026",
      throughSeasonId: "20252026",
      seasonType: "regularSeason",
      strength: "fiveOnFive",
      scoreState: "allScores",
      statMode: "goalies",
      displayMode: "counts",
      venue: "all",
      tradeMode: "combine",
      scope: "none",
      sortKey: "savePct",
      sortDirection: "desc",
      page: "1",
      pageSize: "100"
    };

    render(<PlayerUnderlyingStatsLandingPage variant="goalie" />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/underlying-stats/goalies?"),
        expect.any(Object)
      );
    });

    const table = await screen.findByRole("table");

    expect(screen.getByText("Goalie Underlying Stats")).toBeTruthy();
    expect(screen.queryByLabelText("Stat Mode")).toBeNull();
    expect(screen.getByLabelText("# of Goalie GP")).toBeTruthy();
    expect(
      screen.getByPlaceholderText("Last X goalie appearances")
    ).toBeTruthy();
    expect(within(table).getByText("Rank")).toBeTruthy();
    expect(within(table).getByText("xG Against")).toBeTruthy();
    expect(within(table).getByText("HDSV%")).toBeTruthy();
    expect(within(table).getByText("Avg. Shot Distance")).toBeTruthy();

    const rows = within(table).getAllByRole("row");
    expect(
      within(rows[1] as HTMLElement).getAllByRole("cell")[0]?.textContent
    ).toBe("1");

    fireEvent.click(
      screen.getByRole("button", { name: "Show advanced filters" })
    );

    expect(screen.queryByLabelText("Position Group")).toBeNull();
    expect(screen.queryByLabelText("Combine or Split")).toBeNull();
    expect(screen.getByLabelText("Team")).toBeTruthy();
    expect(screen.getByLabelText("Home or Away")).toBeTruthy();
    expect(screen.getByLabelText("Minimum TOI (seconds)")).toBeTruthy();
  });

  it("hydrates remaining goalie rows through the dedicated goalie namespace with goalie-specific progress copy", async () => {
    routerMock.pathname = "/underlying-stats/goalieStats";
    routerMock.query = {
      statMode: "goalies",
      displayMode: "counts"
    };

    let resolveSecondPageFetch: (() => void) | null = null;
    const family = "goalieCounts";
    const initialRows = buildMockLandingRows(family, 100);
    const secondPageRows = buildMockLandingRows(family, 150).slice(100);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((input: string | URL | Request) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const params = new URL(url, "http://localhost").searchParams;
        const page = Number(params.get("page") ?? "1");
        const pageSize = Number(params.get("pageSize"));

        if (page === 2 && pageSize === 100) {
          return new Promise((resolve) => {
            resolveSecondPageFetch = () =>
              resolve({
                ok: true,
                json: async () => ({
                  family,
                  rows: secondPageRows,
                  sort: { sortKey: "savePct", direction: "desc" },
                  pagination: {
                    page: 2,
                    pageSize: 100,
                    totalRows: 150,
                    totalPages: 2
                  },
                  placeholder: false,
                  generatedAt: "2026-03-31T12:00:00.000Z"
                })
              });
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            family,
            rows: initialRows,
            sort: { sortKey: "savePct", direction: "desc" },
            pagination: {
              page: 1,
              pageSize: 100,
              totalRows: 150,
              totalPages: 2
            },
            placeholder: false,
            generatedAt: "2026-03-31T12:00:00.000Z"
          })
        });
      })
    );

    render(<PlayerUnderlyingStatsLandingPage variant="goalie" />);

    await waitFor(() => {
      expect(screen.getByText("Player 100")).toBeTruthy();
    });

    expect(screen.queryByText("Player 150")).toBeNull();
    expect(
      screen.getByText("Loading remaining goalies (100/150)")
    ).toBeTruthy();
    expect(screen.getByText("Loading next 50 goalies (100/150)")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/underlying-stats/goalies?"),
      expect.any(Object)
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("page=2&pageSize=100"),
      expect.any(Object)
    );

    const flushSecondPageFetch = resolveSecondPageFetch as (() => void) | null;
    if (flushSecondPageFetch !== null) {
      flushSecondPageFetch();
    }

    await waitFor(() => {
      expect(screen.getByText("Player 150")).toBeTruthy();
    });
  });

  it("keeps the goalie default sort active while switching between goalie counts and goalie rates", async () => {
    routerMock.pathname = "/underlying-stats/goalieStats";
    routerMock.query = {
      fromSeasonId: "20252026",
      throughSeasonId: "20252026",
      seasonType: "regularSeason",
      strength: "fiveOnFive",
      scoreState: "allScores",
      statMode: "goalies",
      displayMode: "counts",
      venue: "all",
      tradeMode: "combine",
      scope: "none",
      sortKey: "savePct",
      sortDirection: "desc",
      page: "1",
      pageSize: "100"
    };

    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: string | URL | Request) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const params = new URL(url, "http://localhost").searchParams;
        const family = resolveFamily(
          params.get("statMode"),
          params.get("displayMode")
        );

        return {
          ok: true,
          json: async () => ({
            family,
            rows: [buildMockLandingRow(family)],
            sort: { sortKey: "savePct", direction: "desc" },
            pagination: { page: 1, pageSize: 100, totalRows: 1, totalPages: 1 },
            placeholder: false,
            generatedAt: "2026-03-31T12:00:00.000Z"
          })
        };
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<PlayerUnderlyingStatsLandingPage variant="goalie" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sort by SV%" })).toBeTruthy();
    });

    expect(
      screen
        .getByRole("button", { name: "Sort by SV%" })
        .getAttribute("aria-pressed")
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "Sort by Shots Against" })
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Sort by Position" })
    ).toBeNull();

    fireEvent.change(screen.getByLabelText("Display Mode"), {
      target: { value: "rates" }
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Sort by Shots Against/60" })
      ).toBeTruthy();
    });

    expect(
      screen
        .getByRole("button", { name: "Sort by SV%" })
        .getAttribute("aria-pressed")
    ).toBe("true");
    expect(
      screen.queryByRole("button", { name: "Sort by Position" })
    ).toBeNull();

    await waitFor(() => {
      const lastFetchCall = fetchMock.mock.calls.at(-1)?.[0];
      expect(String(lastFetchCall)).toContain(
        "/api/v1/underlying-stats/goalies?"
      );
      expect(String(lastFetchCall)).toContain("displayMode=rates");
      expect(String(lastFetchCall)).toContain("sortKey=savePct");
      expect(String(lastFetchCall)).toContain("sortDirection=desc");
    });
  });

  it("serializes goalie landing filter interactions through the dedicated route and fetch namespace", async () => {
    routerMock.pathname = "/underlying-stats/goalieStats";
    routerMock.query = {
      fromSeasonId: "20252026",
      throughSeasonId: "20252026",
      seasonType: "regularSeason",
      strength: "fiveOnFive",
      scoreState: "allScores",
      statMode: "goalies",
      displayMode: "counts",
      venue: "all",
      tradeMode: "combine",
      scope: "none",
      sortKey: "savePct",
      sortDirection: "desc",
      page: "1",
      pageSize: "100"
    };
    routerMock.replace.mockImplementation(async (nextLocation) => {
      if (nextLocation && typeof nextLocation === "object") {
        if (
          "pathname" in nextLocation &&
          typeof nextLocation.pathname === "string"
        ) {
          routerMock.pathname = nextLocation.pathname;
        }

        if ("query" in nextLocation && nextLocation.query) {
          routerMock.query = nextLocation.query as Record<string, string>;
        }
      }

      return true;
    });

    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: string | URL | Request) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const params = new URL(url, "http://localhost").searchParams;
        const family = resolveFamily(
          params.get("statMode"),
          params.get("displayMode")
        );

        return {
          ok: true,
          json: async () => ({
            family,
            rows: [buildMockLandingRow(family)],
            sort: { sortKey: "savePct", direction: "desc" },
            pagination: { page: 1, pageSize: 100, totalRows: 1, totalPages: 1 },
            placeholder: false,
            generatedAt: "2026-03-31T12:00:00.000Z"
          })
        };
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<PlayerUnderlyingStatsLandingPage variant="goalie" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Season Type")).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText("Season Type"), {
      target: { value: "playoffs" }
    });
    fireEvent.change(screen.getByLabelText("Strength"), {
      target: { value: "powerPlay" }
    });
    fireEvent.change(screen.getByLabelText("Score State"), {
      target: { value: "withinOne" }
    });

    fireEvent.change(screen.getByLabelText("# of Team GP"), {
      target: { value: "5" }
    });

    await waitFor(() => {
      expect(
        routerMock.replace.mock.calls.some(
          ([nextLocation]) =>
            nextLocation?.pathname === "/underlying-stats/goalieStats"
        )
      ).toBe(true);
    });

    await waitFor(() => {
      const lastFetchCall = fetchMock.mock.calls.at(-1)?.[0];
      expect(String(lastFetchCall)).toContain(
        "/api/v1/underlying-stats/goalies?"
      );
      expect(String(lastFetchCall)).toContain("seasonType=playoffs");
      expect(String(lastFetchCall)).toContain("strength=powerPlay");
      expect(String(lastFetchCall)).toContain("scoreState=withinOne");
      expect(String(lastFetchCall)).toContain("scope=byTeamGames");
      expect(String(lastFetchCall)).toContain("byTeamGames=5");
    });
  });

  it("expands a goalie landing row into the inline goalie chart panel without changing the rank order", async () => {
    routerMock.pathname = "/underlying-stats/goalieStats";
    routerMock.query = {
      fromSeasonId: "20252026",
      throughSeasonId: "20252026",
      statMode: "goalies",
      displayMode: "counts"
    };

    render(<PlayerUnderlyingStatsLandingPage variant="goalie" />);

    const expandButton = await screen.findByRole("button", {
      name: "Expand goalie trend chart for Test Player"
    });
    fireEvent.click(expandButton);

    expect(
      screen.getByText(
        "Expanded chart for player 8478401 using gamesPlayed via goalie"
      )
    ).toBeTruthy();

    const rows = screen.getAllByRole("row");
    expect(
      within(rows[1] as HTMLElement).getAllByRole("cell")[0]?.textContent
    ).toBe("1");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Collapse goalie trend chart for Test Player"
      })
    );

    expect(
      screen.queryByText(
        "Expanded chart for player 8478401 using gamesPlayed via goalie"
      )
    ).toBeNull();
  });

  it("renders the first 100 sorted rows immediately and hydrates the remaining rows in the background", async () => {
    routerMock.query = {};

    let resolveSecondPageFetch: (() => void) | null = null;
    const family = "onIceCounts";
    const initialRows = buildMockLandingRows(family, 100);
    const secondPageRows = buildMockLandingRows(family, 150).slice(100);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((input: string | URL | Request) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const params = new URL(url, "http://localhost").searchParams;
        const page = Number(params.get("page") ?? "1");
        const pageSize = Number(params.get("pageSize"));

        if (page === 2 && pageSize === 100) {
          return new Promise((resolve) => {
            resolveSecondPageFetch = () =>
              resolve({
                ok: true,
                json: async () => ({
                  family,
                  rows: secondPageRows,
                  sort: { sortKey: "xgfPct", direction: "desc" },
                  pagination: {
                    page: 2,
                    pageSize: 100,
                    totalRows: 150,
                    totalPages: 2
                  },
                  placeholder: false,
                  generatedAt: "2026-03-31T12:00:00.000Z"
                })
              });
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            family,
            rows: initialRows,
            sort: { sortKey: "xgfPct", direction: "desc" },
            pagination: {
              page: 1,
              pageSize: 100,
              totalRows: 150,
              totalPages: 2
            },
            placeholder: false,
            generatedAt: "2026-03-31T12:00:00.000Z"
          })
        });
      })
    );

    render(<PlayerUnderlyingStatsLandingPage />);

    await waitFor(() => {
      expect(screen.getByText("Player 100")).toBeTruthy();
    });

    expect(screen.queryByText("Player 150")).toBeNull();
    expect(screen.getByText("Loading remaining rows (100/150)")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("page=2&pageSize=100"),
      expect.any(Object)
    );
    expect(screen.queryByRole("button", { name: "Previous" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();

    const flushSecondPageFetch = resolveSecondPageFetch as (() => void) | null;
    if (flushSecondPageFetch !== null) {
      flushSecondPageFetch();
    }

    await waitFor(() => {
      expect(screen.getByText("Player 150")).toBeTruthy();
    });
  });

  it("revalidates a fresh cached first page before hydrating the remaining landing rows", async () => {
    routerMock.query = {};

    const family = "onIceCounts";
    const cachedRows = buildMockLandingRows(family, 100);
    const pageOneRows = buildMockLandingRows(family, 100);
    const pageTwoRows = buildMockLandingRows(family, 200).slice(100, 200);
    const requestPath = buildPlayerStatsLandingApiPath(
      createDefaultLandingFilterState({ pageSize: 100 })
    );

    window.sessionStorage.setItem(
      `player-stats-landing-response:${requestPath}`,
      JSON.stringify({
        cachedAt: Date.now(),
        payload: {
          family,
          rows: cachedRows,
          sort: { sortKey: "xgfPct", direction: "desc" },
          pagination: { page: 1, pageSize: 100, totalRows: 108, totalPages: 2 },
          placeholder: false,
          generatedAt: "2026-03-31T12:00:00.000Z"
        }
      })
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((input: string | URL | Request) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const params = new URL(url, "http://localhost").searchParams;
        const page = Number(params.get("page") ?? "1");

        if (page === 2) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              family,
              rows: pageTwoRows,
              sort: { sortKey: "xgfPct", direction: "desc" },
              pagination: {
                page: 2,
                pageSize: 100,
                totalRows: 908,
                totalPages: 10
              },
              placeholder: false,
              generatedAt: "2026-03-31T12:00:00.000Z"
            })
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            family,
            rows: pageOneRows,
            sort: { sortKey: "xgfPct", direction: "desc" },
            pagination: {
              page: 1,
              pageSize: 100,
              totalRows: 908,
              totalPages: 10
            },
            placeholder: false,
            generatedAt: "2026-03-31T12:00:00.000Z"
          })
        });
      })
    );

    render(<PlayerUnderlyingStatsLandingPage />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("page=1&pageSize=100"),
        expect.any(Object)
      );
    });

    expect(
      screen.getAllByText((content) => content.includes("100/908")).length
    ).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getByText("Player 200")).toBeTruthy();
    });
  });

  it("surfaces query errors with a landing reset action", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: "Server query failed."
        })
      })
    );

    render(<PlayerUnderlyingStatsLandingPage />);

    await waitFor(() => {
      expect(screen.getByText("Query error")).toBeTruthy();
    });

    expect(screen.getAllByText("Server query failed.").length).toBeGreaterThan(
      0
    );
    expect(
      screen.getAllByRole("button", { name: "Reset landing filters" }).length
    ).toBeTruthy();
  });

  it("renders all six landing table families through the shared landing route contract", async () => {
    const cases = [
      {
        query: { statMode: "onIce", displayMode: "counts" },
        expectedHeaders: ["CF", "xGF%", "LDCF"],
        expectsPositionColumn: true
      },
      {
        query: { statMode: "onIce", displayMode: "rates" },
        expectedHeaders: ["CF/60", "xGF/60", "MDCF/60"],
        expectsPositionColumn: true
      },
      {
        query: { statMode: "individual", displayMode: "counts" },
        expectedHeaders: ["Goals", "Total Points", "SH%"],
        expectsPositionColumn: true
      },
      {
        query: { statMode: "individual", displayMode: "rates" },
        expectedHeaders: ["Goals/60", "Total Points/60", "TOI/GP"],
        expectsPositionColumn: true
      },
      {
        query: { statMode: "goalies", displayMode: "counts" },
        expectedHeaders: ["Shots Against", "SV%", "GSAA"],
        expectsPositionColumn: false
      },
      {
        query: { statMode: "goalies", displayMode: "rates" },
        expectedHeaders: ["Shots Against/60", "SV%", "GSAA/60"],
        expectsPositionColumn: false
      }
    ] as const;

    for (const testCase of cases) {
      cleanup();
      routerMock.query = {
        fromSeasonId: "20252026",
        throughSeasonId: "20252026",
        ...testCase.query
      };

      render(<PlayerUnderlyingStatsLandingPage />);

      await waitFor(() => {
        expect(screen.getByRole("table")).toBeTruthy();
      });

      expect(
        screen.getByRole("button", { name: "Sort by Player" })
      ).toBeTruthy();
      expect(screen.getByRole("button", { name: "Sort by Team" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Sort by GP" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Sort by TOI" })).toBeTruthy();

      for (const header of testCase.expectedHeaders) {
        expect(
          screen.getByRole("button", { name: `Sort by ${header}` })
        ).toBeTruthy();
      }

      if (testCase.expectsPositionColumn) {
        expect(
          screen.getByRole("button", { name: "Sort by Position" })
        ).toBeTruthy();
      } else {
        expect(
          screen.queryByRole("button", { name: "Sort by Position" })
        ).toBeNull();
      }
    }
  });

  it("expands a landing row into the inline chart panel without changing the rank order", async () => {
    routerMock.query = {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          family: "onIceCounts",
          rows: buildMockLandingRows("onIceCounts", 2),
          sort: { sortKey: "xgfPct", direction: "desc" },
          pagination: { page: 1, pageSize: 100, totalRows: 2, totalPages: 1 },
          placeholder: false,
          generatedAt: "2026-03-31T12:00:00.000Z"
        })
      })
    );

    render(<PlayerUnderlyingStatsLandingPage />);

    await waitFor(() => {
      expect(screen.getByText("Player 1")).toBeTruthy();
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Expand player trend chart for Player 1"
      })
    );

    expect(
      screen.getByText(
        "Expanded chart for player 8478401 using xgfPct via player"
      )
    ).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Collapse player trend chart for Player 1"
      })
    );

    expect(
      screen.queryByText(
        "Expanded chart for player 8478401 using xgfPct via player"
      )
    ).toBeNull();
  });
});
