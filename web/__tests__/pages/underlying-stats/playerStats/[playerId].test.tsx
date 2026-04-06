import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PlayerUnderlyingStatsDetailPage from "../../../../pages/underlying-stats/playerStats/[playerId]";

const routerMock = {
  isReady: true,
  pathname: "/underlying-stats/playerStats/[playerId]",
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

describe("PlayerUnderlyingStatsDetailPage", () => {
  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    window.sessionStorage.clear();
    routerMock.query = {
      playerId: "8478401",
      fromSeasonId: "20252026",
      throughSeasonId: "20252026",
      seasonType: "regularSeason",
      strength: "powerPlay",
      statMode: "individual",
      displayMode: "counts",
      againstTeamId: "6",
    };
    routerMock.replace.mockReset();
    routerMock.replace.mockImplementation(async (next) => {
      if (
        next &&
        typeof next === "object" &&
        "query" in next &&
        next.query &&
        typeof next.query === "object"
      ) {
        routerMock.query = next.query as Record<string, string>;
      }

      return true;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          playerId: 8478401,
          family: "individualCounts",
          rows: [
            {
              rowKey: "detail:season:8478401:20252026",
              seasonId: 20252026,
              seasonLabel: "2025-26",
              playerName: "Pavel Zacha",
              teamLabel: "BOS",
              positionCode: "C",
              gamesPlayed: 72,
              toiSeconds: 73440,
              totalPoints: 60,
            },
          ],
          sort: { sortKey: "totalPoints", direction: "desc" },
          pagination: { page: 1, pageSize: 50, totalRows: 1, totalPages: 1 },
          placeholder: false,
          generatedAt: "2026-04-02T00:00:00.000Z",
        }),
      })
    );
  });

  it("hydrates the detail shell from route and renders live season rows", async () => {
    render(<PlayerUnderlyingStatsDetailPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Player 8478401").length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    expect(screen.getAllByText("Against: BOS").length).toBeGreaterThan(0);
    expect(screen.getByText("2025-26 · Pavel Zacha")).toBeTruthy();
    expect(screen.getByText("72")).toBeTruthy();
    expect(
      screen.queryByText(
        "The detail route shell is live, but season-level player log aggregation is still pending implementation."
      )
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show advanced filters" }));
    expect(screen.getByLabelText("Against Specific Team")).toBeTruthy();
  });

  it("shows an invalid-player warning when the route parameter is not numeric", async () => {
    routerMock.query = {
      playerId: "not-a-player",
    };

    render(<PlayerUnderlyingStatsDetailPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Invalid player route").length).toBeGreaterThan(0);
    });

    expect(
      screen.getAllByText(
        "A numeric playerId is required in the detail route before the season-log query can run."
      ).length
    ).toBeGreaterThan(0);
  });

  it("shows a loading state while the detail query is in flight", async () => {
    let resolveFetch: ((value: unknown) => void) | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          })
      )
    );

    render(<PlayerUnderlyingStatsDetailPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Loading player detail underlying stats...").length).toBeGreaterThan(0);
    });

    const flushFetch:
      | ((value: {
          ok: boolean;
          json: () => Promise<unknown>;
        }) => void)
      | null = resolveFetch;
    if (flushFetch !== null) {
      flushFetch({
        ok: true,
        json: async () => ({
          playerId: 8478401,
          family: "individualCounts",
          rows: [],
          sort: { sortKey: "totalPoints", direction: "desc" },
          pagination: { page: 1, pageSize: 50, totalRows: 0, totalPages: 0 },
          placeholder: false,
          generatedAt: "2026-04-02T00:00:00.000Z",
        }),
      });
    }
  });

  it("shows the no-data empty state when the detail API returns no rows", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          playerId: 8478401,
          family: "individualCounts",
          rows: [],
          sort: { sortKey: "totalPoints", direction: "desc" },
          pagination: { page: 1, pageSize: 50, totalRows: 0, totalPages: 0 },
          placeholder: false,
          generatedAt: "2026-04-02T00:00:00.000Z",
        }),
      })
    );

    render(<PlayerUnderlyingStatsDetailPage />);

    await waitFor(() => {
      expect(
        screen.getAllByText(
          "No season rows matched the current detail filter combination."
        ).length
      ).toBeGreaterThan(0);
    });
  });

  it("shows the error state when the detail API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: "Unable to load player detail underlying stats from the server.",
        }),
      })
    );

    render(<PlayerUnderlyingStatsDetailPage />);

    await waitFor(() => {
      expect(
        screen.getAllByText(
          "Unable to load player detail underlying stats from the server."
        ).length
      ).toBeGreaterThan(0);
    });
  });

  it("reuses the shared table family, formatting, and pagination behavior on the detail page", async () => {
    routerMock.query = {
      playerId: "8475883",
      fromSeasonId: "20252026",
      throughSeasonId: "20252026",
      seasonType: "regularSeason",
      strength: "allStrengths",
      statMode: "goalies",
      displayMode: "rates",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          playerId: 8475883,
          family: "goalieRates",
          rows: [
            {
              rowKey: "detail:season:8475883:20252026",
              seasonId: 20252026,
              seasonLabel: "2025-26",
              playerName: "Igor Shesterkin",
              teamLabel: "NYR",
              gamesPlayed: 55,
              toiSeconds: 118800,
              toiPerGameSeconds: 2160,
              shotsAgainstPer60: 28.44,
              savesPer60: 26.48,
              savePct: 0.931,
              gaa: 1.96,
              gsaaPer60: 0.24,
              xgAgainstPer60: 2.2,
              hdShotsAgainstPer60: 5.15,
              hdSavesPer60: 4.74,
              hdSavePct: 0.921,
              hdGaa: 0.41,
              hdGsaaPer60: 0.12,
              mdShotsAgainstPer60: 10.11,
              mdSavesPer60: 9.31,
              mdSavePct: 0.921,
              mdGaa: 0.8,
              mdGsaaPer60: 0.04,
              ldShotsAgainstPer60: 13.18,
              ldSavesPer60: 12.43,
              ldSavePct: 0.943,
              ldGaa: 0.75,
              ldGsaaPer60: 0.08,
              rushAttemptsAgainstPer60: 1.12,
              reboundAttemptsAgainstPer60: 2.03,
              avgShotDistance: 31.4,
              avgGoalDistance: 18.9,
            },
          ],
          sort: { sortKey: "savePct", direction: "desc" },
          pagination: { page: 1, pageSize: 1, totalRows: 2, totalPages: 2 },
          placeholder: false,
          generatedAt: "2026-04-02T00:00:00.000Z",
        }),
      })
    );

    render(<PlayerUnderlyingStatsDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("2025-26 · Igor Shesterkin")).toBeTruthy();
    });

    expect(screen.getByText("TOI/GP")).toBeTruthy();
    expect(screen.queryByText("Position")).toBeNull();
    expect(screen.getAllByText("93.1%").length).toBeGreaterThan(0);
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
  });

  it("renders season-log rows across multiple seasons from the detail API payload", async () => {
    routerMock.query = {
      playerId: "8478401",
      fromSeasonId: "20242025",
      throughSeasonId: "20252026",
      seasonType: "regularSeason",
      strength: "allStrengths",
      statMode: "individual",
      displayMode: "counts",
      tradeMode: "combine",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          playerId: 8478401,
          family: "individualCounts",
          rows: [
            {
              rowKey: "detail:season:8478401:20252026",
              seasonId: 20252026,
              seasonLabel: "2025-26",
              playerName: "Pavel Zacha",
              teamLabel: "BOS",
              positionCode: "C",
              gamesPlayed: 72,
              toiSeconds: 73440,
              totalPoints: 60,
            },
            {
              rowKey: "detail:season:8478401:20242025",
              seasonId: 20242025,
              seasonLabel: "2024-25",
              playerName: "Pavel Zacha",
              teamLabel: "BOS",
              positionCode: "C",
              gamesPlayed: 78,
              toiSeconds: 74100,
              totalPoints: 59,
            },
          ],
          sort: { sortKey: "totalPoints", direction: "desc" },
          pagination: { page: 1, pageSize: 50, totalRows: 2, totalPages: 1 },
          placeholder: false,
          generatedAt: "2026-04-02T00:00:00.000Z",
        }),
      })
    );

    render(<PlayerUnderlyingStatsDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole("table")).toBeTruthy();
    });

    expect(screen.getByText("2025-26 · Pavel Zacha")).toBeTruthy();
    expect(screen.getByText("2024-25 · Pavel Zacha")).toBeTruthy();
    expect(screen.getByText("60")).toBeTruthy();
    expect(screen.getByText("59")).toBeTruthy();
    expect(screen.getAllByText("BOS").length).toBeGreaterThan(0);
  });

  it("preserves carried query context and keeps detail sorting and pagination in sync", async () => {
    routerMock.query = {
      playerId: "8478401",
      fromSeasonId: "20242025",
      throughSeasonId: "20252026",
      seasonType: "regularSeason",
      strength: "powerPlay",
      scoreState: "allScores",
      statMode: "individual",
      displayMode: "counts",
      againstTeamId: "6",
      minimumToiSeconds: "600",
      scope: "dateRange",
      startDate: "2025-11-01",
      endDate: "2026-02-01",
      sortKey: "totalPoints",
      sortDirection: "desc",
      page: "1",
      pageSize: "1",
    };

    const fetchMock = vi.fn().mockImplementation(async (input: string | URL | Request) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const params = new URL(url, "http://localhost").searchParams;
      const page = Number(params.get("page") ?? "1");
      const sortDirection = params.get("sortDirection") ?? "desc";

      return {
        ok: true,
        json: async () => ({
          playerId: 8478401,
          family: "individualCounts",
          rows: [
            {
              rowKey: `detail:season:8478401:2025202${page}`,
              seasonId: page === 1 ? 20252026 : 20242025,
              seasonLabel: page === 1 ? "2025-26" : "2024-25",
              playerName: "Pavel Zacha",
              teamLabel: "BOS",
              positionCode: "C",
              gamesPlayed: page === 1 ? 72 : 68,
              toiSeconds: 73440,
              totalPoints: sortDirection === "asc" ? 40 : 60,
            },
          ],
          sort: { sortKey: "totalPoints", direction: sortDirection },
          pagination: { page, pageSize: 1, totalRows: 2, totalPages: 2 },
          placeholder: false,
          generatedAt: "2026-04-02T00:00:00.000Z",
        }),
      };
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<PlayerUnderlyingStatsDetailPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const firstRequest = fetchMock.mock.calls[0]?.[0];
    expect(String(firstRequest)).toContain("againstTeamId=6");
    expect(String(firstRequest)).toContain("minimumToiSeconds=600");
    expect(String(firstRequest)).toContain("scope=dateRange");
    expect(String(firstRequest)).toContain("startDate=2025-11-01");
    expect(String(firstRequest)).toContain("endDate=2026-02-01");
    expect(String(firstRequest)).not.toContain("teamId=");

    fireEvent.click(screen.getByRole("button", { name: "Sort by Total Points" }));

    await waitFor(() => {
      const latestReplaceCall = routerMock.replace.mock.calls.at(-1);
      expect(latestReplaceCall?.[0]).toMatchObject({
        pathname: "/underlying-stats/playerStats/[playerId]",
        query: expect.objectContaining({
          playerId: "8478401",
          againstTeamId: "6",
          sortKey: "totalPoints",
          sortDirection: "asc",
          page: "1",
        }),
      });
    });

    await waitFor(() => {
      const lastFetchCall = fetchMock.mock.calls.at(-1)?.[0];
      expect(String(lastFetchCall)).toContain("sortDirection=asc");
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      const lastFetchCall = fetchMock.mock.calls.at(-1)?.[0];
      expect(String(lastFetchCall)).toContain("page=2");
    });

    await waitFor(() => {
      expect(screen.getByText("Page 2 of 2")).toBeTruthy();
    });
  });
});
