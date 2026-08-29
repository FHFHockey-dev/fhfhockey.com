import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const swrState = vi.hoisted(() => ({
  data: null as any,
  error: null as Error | null,
  isLoading: false,
  mutate: vi.fn(),
}));

const routerState = vi.hoisted(() => ({
  router: {
    isReady: true,
    pathname: "/start-chart",
    query: {} as Record<string, string | string[]>,
    replace: vi.fn(),
  },
}));

const readySourceStatus = {
  overall: "ready",
  projection: {
    state: "ready",
    affectsRanking: true,
    date: "2026-02-07",
    updatedAt: "2026-02-07T12:00:00Z",
    runId: "run-1234567890",
    modelVersion: "skater-baseline-v1",
    inputVersion: "full_selected_scope_through_end_date_v1",
  },
  teamRatings: {
    state: "ready",
    affectsRanking: false,
    date: "2026-02-07",
    requestedDate: "2026-02-07",
    resolvedDate: "2026-02-07",
  },
  ctpi: {
    state: "ready",
    affectsRanking: false,
    date: "2026-02-06",
    throughDate: "2026-02-06",
    formulaVersion: "ctpi-formula-v1",
    inputVersion: "ctpi-one-game-input-v2",
    trustedRows: 64,
    untrustedRows: 0,
  },
  goalies: {
    state: "ready",
    affectsRanking: true,
    date: "2026-02-07",
    expectedTeams: 4,
    coveredTeams: 4,
    freshTeams: 4,
    staleTeams: 0,
  },
  ownership: {
    state: "ready",
    affectsRanking: false,
    date: "2026-02-07",
    mappedPlayers: 2,
    unmappedPlayers: 0,
    playersWithAsOf: 2,
    playersMissingAsOf: 0,
    oldestAsOfDate: "2026-02-07",
    latestAsOfDate: "2026-02-07",
  },
  gamesRemaining: {
    state: "ready",
    affectsRanking: false,
    date: "2026-02-07",
  },
  degradedReasons: [],
};

const buildApiData = () => ({
  dateUsed: "2026-02-07",
  date: "2026-02-07",
  requestedDate: "2026-02-07",
  resolvedDate: "2026-02-07",
  fallbackApplied: false,
  serving: {
    mode: "exact",
    message: null,
  },
  projectionRunId: "run-1234567890",
  projections: 0,
  players: [],
  ctpi: [],
  games: [],
  sourceStatus: readySourceStatus,
  coverage: {
    slateGames: 0,
    slateTeams: 0,
    projectionRows: 0,
    renderedRows: 0,
    goalieTeamsExpected: 0,
    goalieTeamsCovered: 0,
    yahooMappedPlayers: 0,
    yahooUnmappedPlayers: 0,
  },
  fantasyScoringContract: {
    version: "fixture-scoring-v9",
    label: "Fixture scoring",
    weights: {
      goals: 4,
      assists: 3,
      powerPlayPoints: 2,
      shotsOnGoal: 0.33,
      hits: 0.44,
      blockedShots: 0.55,
    },
  },
});

const player = (overrides: Record<string, unknown> = {}) => ({
  row_key: "run-123:1001:8478402:1",
  game_id: 1001,
  player_id: 8478402,
  name: "Nick Suzuki",
  positions: ["C"],
  ownership: 25,
  percent_ownership: 25,
  ownership_as_of_date: "2026-02-07",
  opponent_team_id: 10,
  opponent_abbrev: "TOR",
  team_id: 8,
  team_abbrev: "MTL",
  proj_fantasy_points: 4.2,
  proj_goals: 0.6,
  proj_assists: 0.6,
  proj_shots: 3.5,
  proj_pp_points: 0.3,
  proj_hits: 0.6,
  proj_blocks: 0.4,
  proj_pim: 0.1,
  proj_toi_minutes: 19.2,
  matchup_grade: 62,
  start_probability: null,
  projected_gsaa: null,
  confirmed_status: null,
  games_remaining_week: 3,
  position_ranks: { C: 1 },
  context: {
    es_role: "L1",
    unit_tier: "PP1",
    pp_share: 0.62,
    role_probability: 0.8,
    role_continuity: 0.75,
    opponent_defense_edge: 0.12,
    goalie_goal_rate_multiplier: 1.04,
    goalie_starter_certainty: 0.72,
    rest_delta: 1,
    trend_effect: "applied",
    projection_low: 2.1,
    projection_high: 6.4,
    flags: [],
  },
  ...overrides,
});

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("next/image", () => ({
  default: ({
    alt = "",
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

vi.mock("next/router", () => ({
  useRouter: () => routerState.router,
}));

vi.mock("swr", () => ({
  default: () => ({
    data: swrState.data,
    error: swrState.error,
    isLoading: swrState.isLoading,
    mutate: swrState.mutate,
  }),
}));

vi.mock("recharts", () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Line: () => null,
  ReferenceLine: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

import StartChartPage from "../../pages/start-chart";

describe("StartChartPage", () => {
  beforeEach(() => {
    swrState.data = buildApiData();
    swrState.error = null;
    swrState.isLoading = false;
    routerState.router.query = {};
    routerState.router.replace.mockImplementation(async (location: any) => {
      routerState.router.query = location.query ?? {};
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(routerState.router.query)) {
        if (typeof value === "string") params.set(key, value);
      }
      window.history.replaceState(
        {},
        "",
        `${routerState.router.pathname}${params.size ? `?${params}` : ""}`,
      );
      return true;
    });
    window.history.replaceState({}, "", "/start-chart");
  });

  afterEach(() => {
    cleanup();
    swrState.mutate.mockClear();
    routerState.router.replace.mockClear();
  });

  it("displays the versioned fantasy scoring formula supplied by the API", () => {
    render(<StartChartPage />);

    expect(
      screen.getByText(
        /Fixture scoring \[fixture-scoring-v9\] \(G=4, A=3, PPP=2, SOG=0\.33, HIT=0\.44, BLK=0\.55\)/,
      ),
    ).toBeTruthy();
  });

  it("rebrands CTPI as plain-language recent team form", () => {
    swrState.data = {
      ...buildApiData(),
      ctpi: [
        { date: "2026-02-05", MTL: 48, TOR: 52 },
        { date: "2026-02-06", MTL: 55, TOR: 45 },
      ],
      games: [
        {
          id: 1001,
          date: "2026-02-07",
          startTime: null,
          homeTeamId: 10,
          awayTeamId: 8,
          homeAbbrev: "TOR",
          awayAbbrev: "MTL",
          homeGoalies: [],
          awayGoalies: [],
        },
      ],
    };

    render(<StartChartPage />);

    expect(
      screen.getByRole("heading", { name: "Recent Team Form" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /How each team has been playing lately, compared with the league\. It combines recent offense, defense, goaltending, and special teams in one score\./,
      ),
    ).toBeTruthy();
    expect(screen.getByText("Context only — not a game prediction or ranking input"))
      .toBeTruthy();
    expect(
      screen.getByRole("img", { name: /Recent team form for TOR, MTL/ }),
    ).toBeTruthy();
    const legend = screen.getByRole("list", {
      name: "Latest team form by team",
    });
    expect(legend.textContent).toContain("TOR45Below league average");
    expect(legend.textContent).toContain("MTL55Above league average");
    expect(screen.queryByText("CTPI Pulse")).toBeNull();
  });

  it("explains why untrusted legacy team-form history is unavailable", () => {
    const message =
      "Recent team form is temporarily unavailable while its historical game data is being verified. It is hidden rather than show a misleading score.";
    swrState.data = {
      ...buildApiData(),
      sourceStatus: {
        ...readySourceStatus,
        ctpi: {
          ...readySourceStatus.ctpi,
          state: "missing",
          date: null,
          throughDate: null,
          trustedRows: 0,
          untrustedRows: 64,
          message,
        },
      },
    };

    render(<StartChartPage />);

    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.getByText("Data through Unavailable")).toBeTruthy();
  });

  it("syncs date and position through the router while preserving workflow context", async () => {
    routerState.router.query = { date: "2026-02-07", mode: "week" };
    swrState.data = {
      ...buildApiData(),
      projections: 2,
      players: [
        player(),
        player({
          row_key: "run-123:1002:8478402:1",
          game_id: 1002,
          team_id: 52,
          team_abbrev: "WPG",
          opponent_team_id: 21,
          opponent_abbrev: "COL",
          proj_fantasy_points: 3.2,
          position_ranks: { C: 2 },
        }),
      ],
      ctpi: [
        { date: "2026-02-06", MTL: 55, TOR: 61, WPG: 58, COL: 64 },
      ],
      games: [
        {
          id: 1001,
          date: "2026-02-07",
          startTime: "2026-02-08T00:00:00Z",
          homeTeamId: 10,
          awayTeamId: 8,
          homeAbbrev: "TOR",
          awayAbbrev: "MTL",
          homeGoalies: [
            {
              player_id: 9001,
              name: "Home Goalie",
              start_probability: 0.72,
              projected_gsaa_per_60: 0.1,
              confirmed_status: false,
              source_updated_at: "2026-02-07T14:00:00Z",
              source_confidence: "high",
              is_stale: false,
            },
          ],
          awayGoalies: [],
        },
        {
          id: 1002,
          date: "2026-02-07",
          startTime: null,
          homeTeamId: 52,
          awayTeamId: 21,
          homeAbbrev: "WPG",
          awayAbbrev: "COL",
          homeGoalies: [],
          awayGoalies: [],
        },
      ],
    };

    render(<StartChartPage />);

    expect(screen.getByText("#1 Nick Suzuki")).toBeTruthy();
    const gameFilter = screen.getByRole("button", {
      name: /MTL at TOR; apply game filter/,
    });
    fireEvent.click(gameFilter);
    expect(screen.queryByText("WPG vs COL")).toBeNull();
    const teamHref = screen.getByRole("link", { name: "MTL" }).getAttribute("href");
    expect(teamHref).toContain("/forge/team/MTL");
    expect(teamHref).toContain("date=2026-02-07");
    expect(teamHref).toContain("resolvedDate=2026-02-07");
    expect(teamHref).toContain("position=C");
    expect(teamHref).toContain("mode=week");
    expect(screen.getByText("Opp G Home Goalie · projected 72%")).toBeTruthy();
    expect(screen.getAllByText("NHL PTS range 2.10–6.40")).toHaveLength(1);
    expect(screen.getAllByText(/7:00 PM EST/)).toHaveLength(2);

    fireEvent.keyDown(screen.getByRole("tab", { name: /^C 1$/ }), {
      key: "ArrowRight",
    });
    expect(routerState.router.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ position: "LW" }),
      }),
      undefined,
      { shallow: true },
    );

    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-02-08" },
    });
    await waitFor(() =>
      expect(routerState.router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({ date: "2026-02-08" }),
        }),
        undefined,
        { shallow: true },
      ),
    );

    const href = screen
      .getByRole("link", { name: /FORGE Command Center/ })
      .getAttribute("href");
    expect(href).toContain("date=2026-02-08");
    expect(href).toContain("resolvedDate=2026-02-07");
    expect(href).toContain("position=LW");
    expect(href).toContain("mode=week");
    expect(
      screen.getByRole("img", { name: /Recent team form/ }),
    ).toBeTruthy();
  });

  it("reconciles date, position, and team when router history changes", async () => {
    swrState.data = {
      ...buildApiData(),
      projections: 2,
      players: [
        player(),
        player({
          row_key: "run-123:1002:8478403:1",
          game_id: 1002,
          player_id: 8478403,
          name: "RW Fixture",
          positions: ["RW"],
          team_id: 52,
          team_abbrev: "WPG",
          opponent_team_id: 21,
          opponent_abbrev: "COL",
          position_ranks: { RW: 1 },
        }),
      ],
      games: [
        {
          id: 1001,
          date: "2026-02-07",
          startTime: null,
          homeTeamId: 10,
          awayTeamId: 8,
          homeAbbrev: "TOR",
          awayAbbrev: "MTL",
          homeGoalies: [],
          awayGoalies: [],
        },
        {
          id: 1002,
          date: "2026-02-07",
          startTime: null,
          homeTeamId: 52,
          awayTeamId: 21,
          homeAbbrev: "WPG",
          awayAbbrev: "COL",
          homeGoalies: [],
          awayGoalies: [],
        },
      ],
    };
    routerState.router.query = {
      date: "2026-02-07",
      position: "C",
      team: "MTL",
    };
    const view = render(<StartChartPage />);

    await waitFor(() => {
      expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe(
        "2026-02-07",
      );
      expect((screen.getByLabelText("Team") as HTMLSelectElement).value).toBe(
        "MTL",
      );
    });

    routerState.router.query = {
      date: "2026-02-08",
      position: "RW",
      team: "WPG",
    };
    view.rerender(<StartChartPage />);

    await waitFor(() => {
      expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe(
        "2026-02-08",
      );
      expect((screen.getByLabelText("Team") as HTMLSelectElement).value).toBe(
        "WPG",
      );
      expect(screen.getByRole("tab", { name: /^RW 1$/ }).getAttribute("aria-selected")).toBe(
        "true",
      );
    });
  });

  it("selects the first populated position when the query position is invalid", async () => {
    routerState.router.query = {
      date: "2026-02-07",
      position: "F",
    };
    swrState.data = {
      ...buildApiData(),
      projections: 1,
      players: [
        player({
          positions: ["RW"],
          position_ranks: { RW: 1 },
        }),
      ],
    };

    render(<StartChartPage />);

    await waitFor(() =>
      expect(
        screen.getByRole("tab", { name: /^RW 1$/ }).getAttribute("aria-selected"),
      ).toBe("true"),
    );
  });

  it("labels the first visible goalie candidate and treats null probability as unavailable", () => {
    swrState.data = {
      ...buildApiData(),
      games: [
        {
          id: 1001,
          date: "2026-02-07",
          startTime: null,
          homeTeamId: 10,
          awayTeamId: 8,
          homeAbbrev: "TOR",
          awayAbbrev: "MTL",
          homeGoalies: Array.from({ length: 6 }, (_, index) => ({
            player_id: 9001 + index,
            name: index === 0 ? "Goalie One" : `Goalie ${index + 1}`,
            start_probability: 0.1,
            projected_gsaa_per_60: null,
            confirmed_status: false,
            source_updated_at: "2026-02-07T14:00:00Z",
            source_confidence: "medium",
            is_stale: false,
          })),
          awayGoalies: [
            {
              player_id: 9100,
              name: "Unknown Goalie",
              start_probability: null,
              projected_gsaa_per_60: null,
              confirmed_status: null,
              source_updated_at: null,
              source_confidence: null,
              is_stale: false,
            },
          ],
        },
      ],
    };

    render(<StartChartPage />);

    expect(screen.getByText("One 17%")).toBeTruthy();
    expect(screen.getByText("Goalie TBD")).toBeTruthy();
  });

  it("never treats unknown ownership as zero when a numeric filter is active", () => {
    swrState.data = {
      ...buildApiData(),
      projections: 2,
      players: [
        player(),
        player({
          row_key: "run-123:1001:99:1",
          player_id: 99,
          name: "Unknown Ownership",
          ownership: null,
          percent_ownership: null,
          ownership_as_of_date: null,
          position_ranks: { C: 2 },
        }),
      ],
    };
    render(<StartChartPage />);

    expect(screen.getByText(/Unknown Ownership/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("All ownership"), {
      target: { value: "50" },
    });
    expect(screen.queryByText(/Unknown Ownership/)).toBeNull();
    expect(screen.getByText(/1 player was excluded/)).toBeTruthy();
  });

  it("counts unknown ownership only inside the active non-ownership filters", () => {
    swrState.data = {
      ...buildApiData(),
      projections: 3,
      players: [
        player({
          ownership: null,
          percent_ownership: null,
          ownership_as_of_date: null,
        }),
        player({
          row_key: "run-123:1002:99:1",
          game_id: 1002,
          player_id: 99,
          name: "Other Unknown",
          team_id: 52,
          team_abbrev: "WPG",
          ownership: null,
          percent_ownership: null,
          ownership_as_of_date: null,
          position_ranks: { C: 2 },
        }),
        player({
          row_key: "run-123:1001:100:1",
          player_id: 100,
          name: "Known Player",
          position_ranks: { C: 3 },
        }),
      ],
      games: [
        {
          id: 1001,
          date: "2026-02-07",
          startTime: null,
          homeTeamId: 10,
          awayTeamId: 8,
          homeAbbrev: "TOR",
          awayAbbrev: "MTL",
          homeGoalies: [],
          awayGoalies: [],
        },
        {
          id: 1002,
          date: "2026-02-07",
          startTime: null,
          homeTeamId: 21,
          awayTeamId: 52,
          homeAbbrev: "COL",
          awayAbbrev: "WPG",
          homeGoalies: [],
          awayGoalies: [],
        },
      ],
    };
    render(<StartChartPage />);

    fireEvent.change(screen.getByLabelText("Team"), {
      target: { value: "MTL" },
    });
    fireEvent.change(screen.getByLabelText("All ownership"), {
      target: { value: "50" },
    });

    expect(screen.getByText(/1 player was excluded/)).toBeTruthy();
    expect(screen.queryByText(/2 players were excluded/)).toBeNull();
  });

  it("renders explicit fallback and degraded source messaging", () => {
    swrState.data = {
      ...buildApiData(),
      requestedDate: "2026-02-08",
      resolvedDate: "2026-02-07",
      fallbackApplied: true,
      serving: {
        mode: "fallback",
        message: "Serving the nearest available date.",
        ageDays: 1,
      },
      sourceStatus: {
        ...readySourceStatus,
        overall: "degraded",
        projection: {
          ...readySourceStatus.projection,
          state: "partial",
          message: "Projection provenance is unverified.",
        },
        degradedReasons: ["missing_goalie_coverage"],
      },
    };
    render(<StartChartPage />);

    expect(screen.getByText("Showing 2026-02-07, not 2026-02-08.")).toBeTruthy();
    expect(
      screen.getByText(
        "This is the nearest earlier slate with projections (1 day old). Use it as historical reference, not today's recommendation. Projection provenance is unverified.",
      ),
    ).toBeTruthy();
  });

  it("shows null projection values as unavailable rather than zero", () => {
    swrState.data = {
      ...buildApiData(),
      projections: 1,
      players: [
        player({
          proj_fantasy_points: null,
          proj_goals: null,
          proj_assists: null,
          proj_shots: null,
          proj_pp_points: null,
          proj_hits: null,
          proj_blocks: null,
          proj_pim: null,
          proj_toi_minutes: null,
          games_remaining_week: null,
        }),
      ],
    };
    render(<StartChartPage />);

    expect(screen.getByText("Weekly volume unavailable")).toBeTruthy();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.queryByText("0 Games Remaining")).toBeNull();
  });

  it("renders loading and fetch-error retry states explicitly", () => {
    swrState.data = null;
    swrState.isLoading = true;
    const view = render(<StartChartPage />);

    expect(screen.getAllByText("Loading projections…")).toHaveLength(5);

    swrState.isLoading = false;
    swrState.error = new Error("fixture request failed");
    view.rerender(<StartChartPage />);
    expect(screen.getByRole("alert").textContent).toContain(
      "Starter Board is unavailable.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(swrState.mutate).toHaveBeenCalledTimes(1);
  });

  it("distinguishes no-games and partial-projection empty states", () => {
    swrState.data = {
      ...buildApiData(),
      serving: {
        mode: "no_games",
        message: "No eligible same-season slate exists.",
      },
    };
    const view = render(<StartChartPage />);

    expect(screen.getByText("No games found.")).toBeTruthy();
    expect(screen.getByText("No eligible same-season slate exists.")).toBeTruthy();

    swrState.data = {
      ...buildApiData(),
      serving: {
        mode: "partial",
        message: "Canonical rows are still pending.",
      },
      games: [
        {
          id: 1001,
          date: "2026-02-07",
          startTime: null,
          homeTeamId: 10,
          awayTeamId: 8,
          homeAbbrev: "TOR",
          awayAbbrev: "MTL",
          homeGoalies: [],
          awayGoalies: [],
        },
      ],
    };
    view.rerender(<StartChartPage />);

    expect(
      screen.getByText("This slate has incomplete source coverage."),
    ).toBeTruthy();
    expect(screen.getByText("No player projections found.")).toBeTruthy();
    expect(screen.getAllByText("Goalie TBD")).toHaveLength(2);
  });

  it("loads 25 more rows and resets the position limit when filters change", () => {
    swrState.data = {
      ...buildApiData(),
      projections: 30,
      players: Array.from({ length: 30 }, (_, index) =>
        player({
          row_key: `run-123:1001:${index + 1}:1`,
          player_id: index + 1,
          name: `C Player ${index + 1}`,
          proj_fantasy_points: 6 - index / 100,
          position_ranks: { C: index + 1 },
        }),
      ),
    };
    render(<StartChartPage />);

    expect(screen.queryByText("#30 C Player 30")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Load 25 more C" }));
    expect(screen.getByText("#30 C Player 30")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Player"), {
      target: { value: "no match" },
    });
    fireEvent.change(screen.getByLabelText("Player"), {
      target: { value: "" },
    });
    expect(screen.queryByText("#30 C Player 30")).toBeNull();
    expect(screen.getByRole("button", { name: "Load 25 more C" })).toBeTruthy();
  });
});
