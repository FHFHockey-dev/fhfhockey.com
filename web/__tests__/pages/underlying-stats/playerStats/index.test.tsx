import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PlayerUnderlyingStatsLandingPage from "../../../../pages/underlying-stats/playerStats/index";
import { createDefaultLandingFilterState } from "../../../../lib/underlying-stats/playerStatsFilters";
import { buildPlayerStatsLandingApiPath } from "../../../../lib/underlying-stats/playerStatsQueries";

const routerMock = {
  isReady: true,
  pathname: "/underlying-stats/playerStats",
  query: {} as Record<string, string>,
  replace: vi.fn(),
};

vi.mock("next/router", () => ({
  useRouter: () => routerMock,
}));

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("components/underlying-stats/PlayerStatsExpandedRowChart", () => ({
  default: ({
    playerId,
    selectedMetricKey,
  }: {
    playerId: number;
    selectedMetricKey: string;
  }) => (
    <div>
      Expanded chart for player {playerId} using {selectedMetricKey}
    </div>
  ),
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
    toiSeconds: 987,
  };

  if (family === "goalieCounts" || family === "goalieRates") {
    return baseRow;
  }

  return {
    ...baseRow,
    positionCode: "C",
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
      playerName: `Player ${playerNumber}`,
    };
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
    routerMock.query = {
      fromSeasonId: "20252026",
      throughSeasonId: "20252026",
      scope: "dateRange",
      startDate: "2025-11-01",
      endDate: "2026-02-01",
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
            generatedAt: "2026-03-31T12:00:00.000Z",
          }),
        };
      })
    );
  });

  it("blocks invalid date-range state until the user resets the landing filters", async () => {
    routerMock.query = {
      fromSeasonId: "20252026",
      throughSeasonId: "20252026",
      scope: "dateRange",
      endDate: "2026-02-01",
    };

    render(<PlayerUnderlyingStatsLandingPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Invalid filter combination").length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText("Date Range requires a start date.").length).toBeGreaterThan(0);
    expect(fetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Reset landing filters" }));

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalled();
    });

    const latestReplaceCall = routerMock.replace.mock.calls.at(-1);
    expect(latestReplaceCall?.[0]).toMatchObject({
      pathname: "/underlying-stats/playerStats",
      query: expect.objectContaining({
        scope: "none",
      }),
    });
    expect(latestReplaceCall?.[0].query).not.toHaveProperty("startDate");
    expect(latestReplaceCall?.[0].query).not.toHaveProperty("endDate");

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
  });

  it("shows the active scope and clears stale date-range params when switching to # of GP", async () => {
    render(<PlayerUnderlyingStatsLandingPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Scope: Date Range").length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByLabelText("# of GP"), {
      target: { value: "7" },
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
        scope: "gameRange",
      }),
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
          generatedAt: "2026-03-31T12:00:00.000Z",
        }),
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
      pageSize: "25",
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
                  pagination: { page: 2, pageSize: 100, totalRows: 150, totalPages: 2 },
                  placeholder: false,
                  generatedAt: "2026-03-31T12:00:00.000Z",
                }),
              });
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            family,
            rows: initialRows,
            sort: { sortKey: "xgfPct", direction: "desc" },
            pagination: { page: 1, pageSize: 100, totalRows: 150, totalPages: 2 },
            placeholder: false,
            generatedAt: "2026-03-31T12:00:00.000Z",
          }),
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

    const flushSecondPageFetch: (() => void) | null = resolveSecondPageFetch;
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
          generatedAt: "2026-03-31T12:00:00.000Z",
        },
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
              pagination: { page: 2, pageSize: 100, totalRows: 908, totalPages: 10 },
              placeholder: false,
              generatedAt: "2026-03-31T12:00:00.000Z",
            }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            family,
            rows: pageOneRows,
            sort: { sortKey: "xgfPct", direction: "desc" },
            pagination: { page: 1, pageSize: 100, totalRows: 908, totalPages: 10 },
            placeholder: false,
            generatedAt: "2026-03-31T12:00:00.000Z",
          }),
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
          error: "Server query failed.",
        }),
      })
    );

    render(<PlayerUnderlyingStatsLandingPage />);

    await waitFor(() => {
      expect(screen.getByText("Query error")).toBeTruthy();
    });

    expect(screen.getAllByText("Server query failed.").length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Reset landing filters" }).length
    ).toBeTruthy();
  });

  it("renders all six landing table families through the shared landing route contract", async () => {
    const cases = [
      {
        query: { statMode: "onIce", displayMode: "counts" },
        expectedHeaders: ["CF", "xGF%", "LDCF"],
        expectsPositionColumn: true,
      },
      {
        query: { statMode: "onIce", displayMode: "rates" },
        expectedHeaders: ["CF/60", "xGF/60", "MDCF/60"],
        expectsPositionColumn: true,
      },
      {
        query: { statMode: "individual", displayMode: "counts" },
        expectedHeaders: ["Goals", "Total Points", "SH%"],
        expectsPositionColumn: true,
      },
      {
        query: { statMode: "individual", displayMode: "rates" },
        expectedHeaders: ["Goals/60", "Total Points/60", "TOI/GP"],
        expectsPositionColumn: true,
      },
      {
        query: { statMode: "goalies", displayMode: "counts" },
        expectedHeaders: ["Shots Against", "SV%", "GSAA"],
        expectsPositionColumn: false,
      },
      {
        query: { statMode: "goalies", displayMode: "rates" },
        expectedHeaders: ["Shots Against/60", "SV%", "GSAA/60"],
        expectsPositionColumn: false,
      },
    ] as const;

    for (const testCase of cases) {
      cleanup();
      routerMock.query = {
        fromSeasonId: "20252026",
        throughSeasonId: "20252026",
        ...testCase.query,
      };

      render(<PlayerUnderlyingStatsLandingPage />);

      await waitFor(() => {
        expect(screen.getByRole("table")).toBeTruthy();
      });

      expect(screen.getByRole("button", { name: "Sort by Player" })).toBeTruthy();
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
          generatedAt: "2026-03-31T12:00:00.000Z",
        }),
      })
    );

    render(<PlayerUnderlyingStatsLandingPage />);

    await waitFor(() => {
      expect(screen.getByText("Player 1")).toBeTruthy();
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Expand trend chart for Player 1",
      })
    );

    expect(
      screen.getByText("Expanded chart for player 8478401 using xgfPct")
    ).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Collapse trend chart for Player 1",
      })
    );

    expect(
      screen.queryByText("Expanded chart for player 8478401 using xgfPct")
    ).toBeNull();
  });
});
