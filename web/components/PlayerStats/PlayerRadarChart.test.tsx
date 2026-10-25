import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type QueryCall = [operation: string, ...args: unknown[]];

type QueryTrace = {
  table: string;
  calls: QueryCall[];
};

const { fromMock, queryTraces, chartState, currentSeasonMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  queryTraces: [] as QueryTrace[],
  chartState: { current: null as any },
  currentSeasonMock: vi.fn(() => ({ seasonId: 20252026 })),
}));

vi.mock("chart.js", () => ({
  Chart: { register: vi.fn() },
  RadialLinearScale: {},
  PointElement: {},
  LineElement: {},
  Filler: {},
  Tooltip: {},
  Legend: {},
}));

vi.mock("react-chartjs-2", () => ({
  Radar: (props: any) => {
    chartState.current = props;
    return <div data-testid="radar-chart">{JSON.stringify(props.data.datasets[0].data)}</div>;
  },
}));

vi.mock("../../hooks/useCurrentSeason", () => ({
  default: currentSeasonMock,
}));

vi.mock("../../lib/supabase", () => ({
  default: { from: fromMock },
}));

import { PlayerRadarChart } from "./PlayerRadarChart";

type QueryResult = { data: any; error: unknown };

function installQueryMock(args: {
  playerRow: Record<string, unknown> | null;
  cohortRows: Record<string, unknown>[];
  filterCohort?: boolean;
  playerResult?: Promise<QueryResult>;
  playerError?: unknown;
  cohortResults?: Record<string, QueryResult | Promise<QueryResult>>;
}) {
  fromMock.mockImplementation((table: string) => {
    const trace: QueryTrace = { table, calls: [] };
    queryTraces.push(trace);

    const builder: any = {
      select(...selectArgs: unknown[]) {
        trace.calls.push(["select", ...selectArgs]);
        return builder;
      },
      eq(...eqArgs: unknown[]) {
        trace.calls.push(["eq", ...eqArgs]);
        return builder;
      },
      not(...notArgs: unknown[]) {
        trace.calls.push(["not", ...notArgs]);
        return builder;
      },
      in(...inArgs: unknown[]) {
        trace.calls.push(["in", ...inArgs]);
        return builder;
      },
      single() {
        trace.calls.push(["single"]);
        return args.playerResult ?? Promise.resolve({ data: args.playerRow, error: args.playerError ?? null });
      },
      then(
        onFulfilled: (value: unknown) => unknown,
        onRejected?: () => unknown,
      ) {
        const rows = args.filterCohort
          ? args.cohortRows.filter((row) =>
              trace.calls.every(([operation, key, value]) => {
                if (operation === "eq") return row[key as string] === value;
                if (operation === "in") {
                  return (value as unknown[]).includes(row[key as string]);
                }
                return true;
              }),
            )
          : args.cohortRows;
        const stat = trace.calls.find(([operation]) => operation === "select")?.[1] as string;
        return Promise.resolve(args.cohortResults?.[stat] ?? { data: rows, error: null }).then(
          onFulfilled,
          onRejected,
        );
      },
    };

    return builder;
  });
}

describe("PlayerRadarChart", () => {
  beforeEach(() => {
    fromMock.mockReset();
    queryTraces.length = 0;
    chartState.current = null;
    currentSeasonMock.mockClear();
  });

  afterEach(cleanup);

  function renderMetric(stat: string, value: unknown, cohortValues: unknown[]) {
    const isGoalie = stat === "goals_against_avg" || stat === "save_pct";
    installQueryMock({
      playerRow: { [stat]: value },
      cohortRows: cohortValues.map((entry) => ({ [stat]: entry })),
    });
    render(
      <PlayerRadarChart
        player={{ id: 1, fullName: "Player", position: isGoalie ? "G" : "C" }}
        gameLog={[{ date: "2026-01-01", games_played: 1, [stat]: value }]}
        selectedStats={[stat]}
        isGoalie={isGoalie}
        seasonId={20252026}
      />,
    );
    fireEvent.click(screen.getByTitle("Show calculation methods"));
  }

  function chartPercentiles() {
    return JSON.parse(screen.getByTestId("radar-chart").textContent || "[]");
  }

  it("uses the skater view with player_id, text season, and position_code", async () => {
    installQueryMock({
      playerRow: { player_id: 8478402, points: 1.1 },
      cohortRows: [{ points: 0.8 }, { points: 1.1 }],
    });

    render(
      <PlayerRadarChart
        player={{ id: 8478402, fullName: "Skater", position: "C" }}
        gameLog={[{ date: "2026-01-01", games_played: 1, points: 1 }]}
        selectedStats={["points"]}
        isGoalie={false}
        seasonId={20252026}
      />,
    );

    await waitFor(() => expect(queryTraces).toHaveLength(2));

    expect(queryTraces).toEqual([
      {
        table: "wgo_skater_stats_per_game",
        calls: [
          ["select", "*"],
          ["eq", "player_id", 8478402],
          ["eq", "season", "20252026"],
          ["single"],
        ],
      },
      {
        table: "wgo_skater_stats_per_game",
        calls: [
          ["select", "points"],
          ["not", "points", "is", null],
          ["eq", "season", "20252026"],
          ["in", "position_code", ["C"]],
        ],
      },
    ]);
  });

  it("starts every stat's league read before any of them returns", async () => {
    let releaseGoals!: () => void;
    const goalsResult = new Promise<QueryResult>((resolve) => {
      releaseGoals = () =>
        resolve({ data: [{ goals: 0.2 }, { goals: 0.5 }], error: null });
    });
    installQueryMock({
      playerRow: { player_id: 8478402, points: 1.1, goals: 0.5, assists: 0.6 },
      cohortRows: [{ points: 0.8, assists: 0.4 }],
      cohortResults: { goals: goalsResult },
    });

    render(
      <PlayerRadarChart
        player={{ id: 8478402, fullName: "Skater", position: "C" }}
        gameLog={[{ date: "2026-01-01", games_played: 1, points: 1 }]}
        selectedStats={["points", "goals", "assists"]}
        isGoalie={false}
        seasonId={20252026}
      />,
    );

    // The player row plus all three stat reads are issued while goals is
    // still pending, so the stat reads run in parallel.
    await waitFor(() => expect(queryTraces).toHaveLength(4));
    expect(
      queryTraces.slice(1).map((trace) => trace.calls[0]?.[1]),
    ).toEqual(["points", "goals", "assists"]);

    releaseGoals();
    await waitFor(() =>
      expect(screen.queryByText("Calculating rankings...")).toBeNull(),
    );
  });

  it("uses the goalie view with goalie_id and numeric season_id only", async () => {
    installQueryMock({
      playerRow: { goalie_id: 8478048, save_pct: 0.915 },
      cohortRows: [{ save_pct: 0.9 }, { save_pct: 0.915 }],
    });

    render(
      <PlayerRadarChart
        player={{ id: 8478048, fullName: "Goalie", position: "G" }}
        gameLog={[{ date: "2026-01-01", games_played: 1, save_pct: 0.915 }]}
        selectedStats={["save_pct"]}
        isGoalie
        seasonId={20252026}
      />,
    );

    await waitFor(() => expect(queryTraces).toHaveLength(2));

    expect(queryTraces).toEqual([
      {
        table: "wgo_goalie_stats_per_game",
        calls: [
          ["select", "*"],
          ["eq", "goalie_id", 8478048],
          ["eq", "season_id", 20252026],
          ["single"],
        ],
      },
      {
        table: "wgo_goalie_stats_per_game",
        calls: [
          ["select", "save_pct"],
          ["not", "save_pct", "is", null],
          ["eq", "season_id", 20252026],
        ],
      },
    ]);
  });

  it.each([
    ["goals_against_avg", 2, 67, "1st"],
    ["goals_against_avg", 3, 33, "2nd"],
    ["goals_against_avg", 4, 0, "3rd"],
    ["points", 2, 0, "3rd"],
    ["points", 3, 33, "2nd"],
    ["points", 4, 67, "1st"],
  ])("ranks %s=%s with favorable percentile %s and rank %s", async (stat, value, percentile, rank) => {
    renderMetric(stat as string, value, [2, 3, 4]);

    await waitFor(() => expect(screen.getByText(`${rank} / 3`)).toBeTruthy());
    expect(chartPercentiles()).toEqual([percentile]);
  });

  it.each(["giveaways", "penalties", "penalty_minutes", "hdca_per_60", "pim_per_60"])(
    "honors the existing lower-is-better definition for %s",
    async (stat) => {
      renderMetric(stat, 1, [1, 2, 3]);

      await waitFor(() => expect(screen.getByText("1st / 3")).toBeTruthy());
      expect(chartPercentiles()).toEqual([67]);
    },
  );

  it("keeps save percentage higher-is-better", async () => {
    renderMetric("save_pct", 0.92, [0.9, 0.91, 0.92]);

    await waitFor(() => expect(screen.getByText("1st / 3")).toBeTruthy());
    expect(chartPercentiles()).toEqual([67]);
  });

  it.each([
    ["goals_against_avg", [2, 2, 2, 3], 25, "1st / 4"],
    ["points", [1, 2, 2, 2], 25, "1st / 4"],
    ["goals_against_avg", [2, 2, 2], 0, "1st / 3"],
    ["points", [2, 2, 2], 0, "1st / 3"],
    ["goals_against_avg", [2], 0, "1st / 1"],
    ["points", [2], 0, "1st / 1"],
  ])("preserves strict worse-peer percentiles and tied ranks for %s in %j", async (stat, values, percentile, rank) => {
    renderMetric(stat, 2, values);

    await waitFor(() => expect(screen.getByText(rank)).toBeTruthy());
    expect(chartPercentiles()).toEqual([percentile]);
  });

  it.each([
    ["goals_against_avg", 25, "3rd / 4"],
    ["points", 50, "2nd / 4"],
  ])("excludes missing/non-finite %s peers, retaining zero and numeric strings", async (stat, percentile, rank) => {
    renderMetric(stat as string, "3", [0, 2, "3", 4, null, undefined, "", " ", NaN, Infinity, "invalid"]);

    await waitFor(() => expect(screen.queryByText("Calculating...")).toBeNull());
    expect(screen.getByText(rank as string)).toBeTruthy();
    expect(chartPercentiles()).toEqual([percentile]);
  });

  it.each([null, undefined, "", " ", NaN, Infinity])(
    "does not rank a missing/non-finite player value (%s) as zero",
    async (value) => {
      renderMetric("goals_against_avg", value, [0, 2, 3]);

      await waitFor(() => expect(screen.queryByText("Calculating...")).toBeNull());
      expect(queryTraces).toHaveLength(1);
      expect(screen.queryByText(/^\d+(st|nd|rd|th) \/ \d+$/)).toBeNull();
    },
  );

  it("does not produce an empirical rank for an empty cohort", async () => {
    renderMetric("goals_against_avg", 2, []);

    await waitFor(() => expect(screen.queryByText("Calculating...")).toBeNull());
    expect(queryTraces).toHaveLength(2);
    expect(screen.queryByText(/^\d+(st|nd|rd|th) \/ \d+$/)).toBeNull();
  });

  it("recalculates within position, category, and league peers for the queried season", async () => {
    installQueryMock({
      playerRow: { points: 2 },
      cohortRows: [
        { season: "20252026", position_code: "LW", points: 1 },
        { season: "20252026", position_code: "LW", points: 2 },
        { season: "20252026", position_code: "C", points: 3 },
        { season: "20252026", position_code: "RW", points: 4 },
        { season: "20252026", position_code: "D", points: 5 },
        { season: "20242025", position_code: "LW", points: 100 },
      ],
      filterCohort: true,
    });
    render(
      <PlayerRadarChart
        player={{ id: 1, fullName: "Player", position: "L" }}
        gameLog={[{ date: "2026-01-01", games_played: 1, points: 2 }]}
        selectedStats={["points"]}
        isGoalie={false}
        seasonId={20252026}
      />,
    );
    fireEvent.click(screen.getByTitle("Show calculation methods"));

    await waitFor(() => expect(screen.getByText("1st / 2")).toBeTruthy());
    expect(chartPercentiles()).toEqual([50]);
    expect(queryTraces[1].calls).toContainEqual(["in", "position_code", ["LW"]]);

    fireEvent.click(screen.getByRole("button", { name: "Forwards" }));
    await waitFor(() => expect(screen.getByText("3rd / 4")).toBeTruthy());
    expect(chartPercentiles()).toEqual([25]);
    expect(queryTraces[3].calls).toContainEqual(["in", "position_code", ["C", "LW", "RW"]]);

    fireEvent.click(screen.getByRole("button", { name: "League" }));
    await waitFor(() => expect(screen.getByText("4th / 5")).toBeTruthy());
    expect(chartPercentiles()).toEqual([20]);
    expect(queryTraces[5].calls.some(([operation]) => operation === "in")).toBe(false);
  });

  const scopeProps = {
    player: { id: 1, fullName: "Historical Player", position: "C" },
    gameLog: [{ date: "2024-01-01", games_played: 1, points: 9 }],
    selectedStats: ["points"],
    isGoalie: false,
    seasonId: 20232024,
  };

  it.each([false, true])("uses the selected season for both player and peers (goalie=%s)", async (isGoalie) => {
    const stat = isGoalie ? "save_pct" : "points";
    const value = isGoalie ? 0.915 : 1.25;
    const seasonField = isGoalie ? "season_id" : "season";
    const seasonValue = isGoalie ? 20232024 : "20232024";
    installQueryMock({
      playerRow: { [stat]: value },
      cohortRows: [
        { [stat]: value / 2, [seasonField]: seasonValue, position_code: "C" },
        { [stat]: value, [seasonField]: seasonValue, position_code: "C" },
        { [stat]: 100, [seasonField]: isGoalie ? 20252026 : "20252026", position_code: "C" },
      ],
      filterCohort: true,
    });
    render(<PlayerRadarChart {...scopeProps} player={{ ...scopeProps.player, position: isGoalie ? "G" : "C" }} selectedStats={[stat]} isGoalie={isGoalie} />);
    fireEvent.click(screen.getByTitle("Show calculation methods"));

    await waitFor(() => expect(screen.getByText("1st / 2")).toBeTruthy());
    expect(chartPercentiles()).toEqual([50]);
    expect(queryTraces.every(({ calls }) => calls.some((call) => JSON.stringify(call) === JSON.stringify(["eq", seasonField, seasonValue])))).toBe(true);
    expect(currentSeasonMock).not.toHaveBeenCalled();
    expect(screen.getAllByText(/2023-24 regular season/).length).toBeGreaterThan(0);
    const tooltip = chartState.current.options.plugins.tooltip.callbacks.label({ dataIndex: 0, parsed: { r: 50 } });
    expect(tooltip).toContain(`Value: ${isGoalie ? "0.915" : "1.25"}`);
    expect(tooltip).toContain("Scope: 2023-24 regular season · Full season");
    expect(chartState.current.data.averages[stat]).toBe(value);
    expect(screen.queryByText("9.00")).toBeNull();
  });

  it.each(["last10", "last20", "last30", "custom"] as const)("withholds rankings for the unsupported %s window", async (timeFrame) => {
    render(<PlayerRadarChart {...scopeProps} timeFrame={timeFrame} />);

    expect(screen.getByText(/Rankings unavailable for the selected game window/)).toBeTruthy();
    expect(screen.queryByTestId("radar-chart")).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
    expect(currentSeasonMock).not.toHaveBeenCalled();
  });

  it("withholds playoff rankings even when the playoff log is empty", () => {
    render(<PlayerRadarChart {...scopeProps} showPlayoffData playoffGameLog={[]} />);

    expect(screen.getByText(/Rankings unavailable for playoffs/)).toBeTruthy();
    expect(screen.queryByTestId("radar-chart")).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it.each([undefined, null, "", 2024, NaN, Infinity, "20232025"])("does not guess a comparison season for %s", (seasonId) => {
    render(<PlayerRadarChart {...scopeProps} seasonId={seasonId} />);

    expect(screen.getByText(/Rankings unavailable because no valid season is selected/)).toBeTruthy();
    expect(fromMock).not.toHaveBeenCalled();
    expect(currentSeasonMock).not.toHaveBeenCalled();
  });

  it("withholds comparisons when the caller used fallback game logs", () => {
    render(<PlayerRadarChart {...scopeProps} usedGameLogFallback />);

    expect(screen.getByText(/Rankings unavailable for fallback game logs/)).toBeTruthy();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it.each(["error", "empty", "reject"] as const)("leaves a missing comparison unavailable after a partial metric %s", async (failure) => {
    installQueryMock({
      playerRow: { points: 1.25, shots: 3.5, hits: 2 },
      cohortRows: [{ points: 1 }, { points: 1.25 }],
      cohortResults: {
        shots: failure === "reject"
          ? Promise.reject(new Error("internal query detail"))
          : { data: failure === "empty" ? [] : null, error: failure === "error" ? { message: "internal query detail" } : null },
        hits: { data: [{ hits: 0 }, { hits: 1 }, { hits: 2 }], error: null },
      },
    });
    render(<PlayerRadarChart {...scopeProps} selectedStats={["points", "shots", "hits"]} />);
    fireEvent.click(screen.getByTitle("Show calculation methods"));

    await waitFor(() => expect(screen.queryByText("Calculating...")).toBeNull());
    expect(chartPercentiles()).toEqual([50, null, 67]);
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(screen.queryByText("Loading...")).toBeNull();
    expect(screen.queryByText(/simplified|Est\.|internal query detail/)).toBeNull();
    const tooltip = chartState.current.options.plugins.tooltip.callbacks.label({ dataIndex: 1, parsed: { r: null } });
    expect(tooltip).toContain("Value: 3.50");
    expect(tooltip).toContain("Percentile: Unavailable");
  });

  it("does not borrow strength-specific game-log metrics missing from the season comparison source", async () => {
    installQueryMock({ playerRow: { points: 1.25 }, cohortRows: [{ points: 1 }, { points: 1.25 }] });
    render(<PlayerRadarChart {...scopeProps} selectedStats={["points", "ixg_per_60"]} gameLog={[{ ...scopeProps.gameLog[0], ixg_per_60: 99 }]} />);

    await waitFor(() => expect(screen.queryByText("Calculating...")).toBeNull());
    expect(chartPercentiles()).toEqual([50, null]);
    expect(queryTraces).toHaveLength(2);
    expect(chartState.current.data.averages.ixg_per_60).toBeUndefined();
    expect(screen.queryByText("99.00")).toBeNull();
  });

  it.each([null, { points: null }])("shows unavailable rankings when the selected-season player row is missing (%j)", async (playerRow) => {
    installQueryMock({ playerRow, cohortRows: [{ points: 1 }, { points: 2 }] });
    render(<PlayerRadarChart {...scopeProps} />);
    fireEvent.click(screen.getByTitle("Show calculation methods"));

    await waitFor(() => expect(screen.queryByText("Calculating...")).toBeNull());
    expect(screen.queryByTestId("radar-chart")).toBeNull();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(screen.queryByText("Loading...")).toBeNull();
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it("clears empirical rankings immediately when changing to an unsupported scope and reloads on return", async () => {
    installQueryMock({ playerRow: { points: 1.25 }, cohortRows: [{ points: 1 }, { points: 1.25 }] });
    const { rerender } = render(<PlayerRadarChart {...scopeProps} />);
    await waitFor(() => expect(chartPercentiles()).toEqual([50]));

    rerender(<PlayerRadarChart {...scopeProps} timeFrame="last10" />);
    expect(screen.queryByTestId("radar-chart")).toBeNull();
    expect(queryTraces).toHaveLength(2);
    rerender(<PlayerRadarChart {...scopeProps} />);
    await waitFor(() => expect(queryTraces).toHaveLength(4));
    await waitFor(() => expect(chartPercentiles()).toEqual([50]));
  });

  it("ignores an older season's late cohort result after a new comparison completes", async () => {
    let resolveOld!: (result: QueryResult) => void;
    installQueryMock({ playerRow: { points: 1.25 }, cohortRows: [], cohortResults: { points: new Promise((resolve) => { resolveOld = resolve; }) } });
    const { rerender } = render(<PlayerRadarChart {...scopeProps} />);
    await waitFor(() => expect(queryTraces).toHaveLength(2));

    installQueryMock({ playerRow: { points: 5 }, cohortRows: [{ points: 2 }, { points: 4 }, { points: 5 }] });
    rerender(<PlayerRadarChart {...scopeProps} seasonId={20242025} />);
    await waitFor(() => expect(chartPercentiles()).toEqual([67]));
    expect(chartState.current.data.averages.points).toBe(5);
    await act(async () => { resolveOld({ data: [{ points: 1.25 }, { points: 2 }], error: null }); });

    expect(chartPercentiles()).toEqual([67]);
    expect(chartState.current.data.averages.points).toBe(5);
  });

  it("does not start old cohort requests after a scope change cancels a pending player read", async () => {
    let resolveOld!: (result: QueryResult) => void;
    installQueryMock({ playerRow: null, cohortRows: [], playerResult: new Promise((resolve) => { resolveOld = resolve; }) });
    const { rerender } = render(<PlayerRadarChart {...scopeProps} />);
    expect(queryTraces).toHaveLength(1);
    rerender(<PlayerRadarChart {...scopeProps} showPlayoffData />);
    await act(async () => { resolveOld({ data: { points: 1.25 }, error: null }); });

    expect(queryTraces).toHaveLength(1);
    expect(screen.getByText(/Rankings unavailable for playoffs/)).toBeTruthy();
    expect(screen.queryByTestId("radar-chart")).toBeNull();
  });
});
