import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PlayerUnderlyingStatsLandingPage from "./index";

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

    expect(
      screen.getAllByText("Date Range requires a start date.").length
    ).toBeTruthy();
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

  it("shows the active scope and clears stale date-range params when switching to game range", async () => {
    render(<PlayerUnderlyingStatsLandingPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Scope: Date Range").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "Show advanced filters" }));
    fireEvent.change(screen.getByLabelText("Scope"), {
      target: { value: "gameRange" },
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
      "/underlying-stats/playerStats/8478401?fromSeasonId=20252026&throughSeasonId=20252026&seasonType=regularSeason&strength=powerPlay&scoreState=allScores&statMode=individual&displayMode=counts&venue=away&tradeMode=split&scope=dateRange&startDate=2025-11-01&endDate=2026-02-01&sortKey=totalPoints&sortDirection=desc&page=1&pageSize=25"
    );
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
});
