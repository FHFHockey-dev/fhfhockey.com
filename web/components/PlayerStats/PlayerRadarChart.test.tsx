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

  // Goalie stats come from WGO all-situation rows; the player's own row (goalie_id 1)
  // is left out of the cohort read and added once.
  function renderGoalieMetric(stat: string, value: unknown, peerValues: unknown[], ownRowInCohort = true) {
    installQueryMock({
      playerRow: { goalie_id: 1, [stat]: value },
      cohortRows: [
        ...(ownRowInCohort ? [{ goalie_id: 1, [stat]: value }] : []),
        ...peerValues.map((entry, index) => ({ goalie_id: 100 + index, [stat]: entry })),
      ],
    });
    render(
      <PlayerRadarChart
        player={{ id: 1, fullName: "Goalie", position: "G" }}
        gameLog={[{ date: "2026-01-01", games_played: 1, [stat]: value }]}
        selectedStats={[stat]}
        isGoalie
        seasonId={20252026}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "How rankings are calculated" }));
  }

  function chartPercentiles() {
    return JSON.parse(screen.getByTestId("radar-chart").textContent || "[]");
  }

  it("uses the goalie view with goalie_id and numeric season_id only", async () => {
    installQueryMock({
      playerRow: { goalie_id: 8478048, save_pct: 0.915 },
      cohortRows: [{ goalie_id: 2, save_pct: 0.9 }, { goalie_id: 8478048, save_pct: 0.915 }],
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
    fireEvent.click(screen.getByRole("button", { name: "How rankings are calculated" }));

    await waitFor(() => expect(screen.getByText("1st / 2")).toBeTruthy());
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
          ["select", "goalie_id,save_pct"],
          ["not", "save_pct", "is", null],
          ["eq", "season_id", 20252026],
        ],
      },
    ]);
    // Mid-rank in a cohort of two: one below, (1 + 0.5) / 2 = 75.
    expect(chartPercentiles()).toEqual([75]);
    expect(screen.getAllByText(/All situations · 2025-26 regular season/).length).toBeGreaterThan(0);
  });

  // Decision 90: mid-rank percentile = (peers below + half of everyone tied, the
  // player included) / cohort size. Competition rank = better peers + 1.
  it.each([
    ["goals_against_avg", 2, [3, 4], 83, "1st / 3"],
    ["goals_against_avg", 3, [2, 4], 50, "2nd / 3"],
    ["goals_against_avg", 4, [2, 3], 17, "3rd / 3"],
    ["save_pct", 0.92, [0.9, 0.91], 83, "1st / 3"],
    ["wins", 0.4, [0.5, 0.6], 17, "3rd / 3"],
  ])("ranks %s=%s against %j with the mid-rank percentile %s and rank %s", async (stat, value, peers, percentile, rank) => {
    renderGoalieMetric(stat as string, value, peers as number[]);

    await waitFor(() => expect(screen.getByText(rank as string)).toBeTruthy());
    expect(chartPercentiles()).toEqual([percentile]);
  });

  it.each([
    // [2 (player), 2, 2, 3]: 1 below, 3 tied → (1 + 1.5) / 4 = 62.5.
    ["goals_against_avg", [2, 2, 3], 63, "1st / 4"],
    // All tied: (0 + 1.5) / 3 = 50.
    ["goals_against_avg", [2, 2], 50, "1st / 3"],
    // The player alone is the cohort median.
    ["goals_against_avg", [], 50, "1st / 1"],
  ])("gives tied players the shared mid-rank for %s with peers %j", async (stat, peers, percentile, rank) => {
    renderGoalieMetric(stat, 2, peers);

    await waitFor(() => expect(screen.getByText(rank)).toBeTruthy());
    expect(chartPercentiles()).toEqual([percentile]);
  });

  it("counts the player once, so the rank never exceeds the cohort size", async () => {
    // His own row is missing from the cohort read; before the fix this ranked 3rd of 2.
    renderGoalieMetric("goals_against_avg", 5, [3, 4], false);
    await waitFor(() => expect(screen.getByText("3rd / 3")).toBeTruthy());
    expect(screen.queryByText("3rd / 2")).toBeNull();
    expect(chartPercentiles()).toEqual([17]);
  });

  it("does not double-count the player's own cohort row", async () => {
    renderGoalieMetric("goals_against_avg", 2, [3, 4], true);
    await waitFor(() => expect(screen.getByText("1st / 3")).toBeTruthy());
    expect(screen.queryByText("1st / 4")).toBeNull();
  });

  it("excludes missing/non-finite peers, retaining zero and numeric strings", async () => {
    renderGoalieMetric("goals_against_avg", "3", [0, 2, "3", 4, null, undefined, "", " ", NaN, Infinity, "invalid"]);

    // Cohort [3 (player), 0, 2, 3, 4]: lower is better, 1 below, 2 tied → (1 + 1) / 5 = 40.
    await waitFor(() => expect(screen.getByText("3rd / 5")).toBeTruthy());
    expect(chartPercentiles()).toEqual([40]);
  });

  it.each([null, undefined, "", " ", NaN, Infinity])(
    "does not rank a missing/non-finite player value (%s) as zero",
    async (value) => {
      renderGoalieMetric("goals_against_avg", value, [0, 2, 3], false);

      await waitFor(() => expect(screen.queryByText("Calculating...")).toBeNull());
      expect(queryTraces).toHaveLength(1);
      expect(screen.queryByText(/^\d+(st|nd|rd|th) \/ \d+$/)).toBeNull();
    },
  );

  const scopeProps = {
    player: { id: 1, fullName: "Historical Goalie", position: "G" },
    gameLog: [{ date: "2024-01-01", games_played: 1, save_pct: 0.5 }],
    selectedStats: ["save_pct"],
    isGoalie: true,
    seasonId: 20232024,
  };

  it("uses the selected season for both the goalie and peers", async () => {
    installQueryMock({
      playerRow: { goalie_id: 1, save_pct: 0.915 },
      cohortRows: [
        { goalie_id: 2, save_pct: 0.9, season_id: 20232024 },
        { goalie_id: 1, save_pct: 0.915, season_id: 20232024 },
        { goalie_id: 3, save_pct: 0.99, season_id: 20252026 },
      ],
      filterCohort: true,
    });
    render(<PlayerRadarChart {...scopeProps} />);
    fireEvent.click(screen.getByRole("button", { name: "How rankings are calculated" }));

    await waitFor(() => expect(screen.getByText("1st / 2")).toBeTruthy());
    expect(chartPercentiles()).toEqual([75]);
    expect(queryTraces.every(({ calls }) => calls.some((call) => JSON.stringify(call) === JSON.stringify(["eq", "season_id", 20232024])))).toBe(true);
    expect(currentSeasonMock).not.toHaveBeenCalled();
    const tooltip = chartState.current.options.plugins.tooltip.callbacks.label({ dataIndex: 0, parsed: { r: 75 } });
    expect(tooltip).toContain("Value: 0.915");
    expect(tooltip).toContain("Scope: All situations · 2023-24 regular season · Full season");
    expect(screen.queryByText("0.500")).toBeNull();
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

  it.each(["error", "reject"] as const)("leaves only the failed metric unavailable after a %s", async (failure) => {
    installQueryMock({
      playerRow: { goalie_id: 1, save_pct: 0.915, saves: 25, wins: 0.5 },
      cohortRows: [],
      cohortResults: {
        "goalie_id,save_pct": { data: [{ goalie_id: 2, save_pct: 0.9 }], error: null },
        "goalie_id,saves": failure === "reject"
          ? Promise.reject(new Error("internal query detail"))
          : { data: null, error: { message: "internal query detail" } },
        "goalie_id,wins": { data: [{ goalie_id: 2, wins: 0.4 }, { goalie_id: 3, wins: 0.6 }], error: null },
      },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<PlayerRadarChart {...scopeProps} selectedStats={["save_pct", "saves", "wins"]} />);
    fireEvent.click(screen.getByRole("button", { name: "How rankings are calculated" }));

    await waitFor(() => expect(screen.queryByText("Calculating...")).toBeNull());
    expect(chartPercentiles()).toEqual([75, null, 50]);
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(screen.queryByText(/internal query detail/)).toBeNull();
    const tooltip = chartState.current.options.plugins.tooltip.callbacks.label({ dataIndex: 1, parsed: { r: null } });
    expect(tooltip).toContain("Percentile: Unavailable");
    errorSpy.mockRestore();
  });

  it.each([null, { goalie_id: 1, save_pct: null }])("shows unavailable rankings when the selected-season goalie row is missing (%j)", async (playerRow) => {
    installQueryMock({ playerRow, cohortRows: [{ goalie_id: 2, save_pct: 0.9 }] });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<PlayerRadarChart {...scopeProps} />);
    fireEvent.click(screen.getByRole("button", { name: "How rankings are calculated" }));

    await waitFor(() => expect(screen.queryByText("Calculating...")).toBeNull());
    expect(screen.queryByTestId("radar-chart")).toBeNull();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(screen.queryByText("Loading...")).toBeNull();
    expect(fromMock).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it("clears empirical rankings immediately when changing to an unsupported scope and reloads on return", async () => {
    installQueryMock({ playerRow: { goalie_id: 1, save_pct: 0.915 }, cohortRows: [{ goalie_id: 2, save_pct: 0.9 }] });
    const { rerender } = render(<PlayerRadarChart {...scopeProps} />);
    await waitFor(() => expect(chartPercentiles()).toEqual([75]));

    rerender(<PlayerRadarChart {...scopeProps} timeFrame="last10" />);
    expect(screen.queryByTestId("radar-chart")).toBeNull();
    expect(queryTraces).toHaveLength(2);
    rerender(<PlayerRadarChart {...scopeProps} />);
    await waitFor(() => expect(queryTraces).toHaveLength(4));
    await waitFor(() => expect(chartPercentiles()).toEqual([75]));
  });

  it("ignores an older season's late cohort result after a new comparison completes", async () => {
    let resolveOld!: (result: QueryResult) => void;
    installQueryMock({
      playerRow: { goalie_id: 1, save_pct: 0.9 },
      cohortRows: [],
      cohortResults: { "goalie_id,save_pct": new Promise((resolve) => { resolveOld = resolve; }) },
    });
    const { rerender } = render(<PlayerRadarChart {...scopeProps} />);
    await waitFor(() => expect(queryTraces).toHaveLength(2));

    installQueryMock({
      playerRow: { goalie_id: 1, save_pct: 0.92 },
      cohortRows: [{ goalie_id: 2, save_pct: 0.9 }, { goalie_id: 3, save_pct: 0.91 }],
    });
    rerender(<PlayerRadarChart {...scopeProps} seasonId={20242025} />);
    await waitFor(() => expect(chartPercentiles()).toEqual([83]));
    expect(chartState.current.data.averages.save_pct).toBe(0.92);
    await act(async () => { resolveOld({ data: [{ goalie_id: 2, save_pct: 0.95 }], error: null }); });

    expect(chartPercentiles()).toEqual([83]);
    expect(chartState.current.data.averages.save_pct).toBe(0.92);
  });

  it("does not start old cohort requests after a scope change cancels a pending player read", async () => {
    let resolveOld!: (result: QueryResult) => void;
    installQueryMock({ playerRow: null, cohortRows: [], playerResult: new Promise((resolve) => { resolveOld = resolve; }) });
    const { rerender } = render(<PlayerRadarChart {...scopeProps} />);
    expect(queryTraces).toHaveLength(1);
    rerender(<PlayerRadarChart {...scopeProps} showPlayoffData />);
    await act(async () => { resolveOld({ data: { goalie_id: 1, save_pct: 0.915 }, error: null }); });

    expect(queryTraces).toHaveLength(1);
    expect(screen.getByText(/Rankings unavailable for playoffs/)).toBeTruthy();
    expect(screen.queryByTestId("radar-chart")).toBeNull();
  });

  describe("skater 5v5 season comparison (decision 15)", () => {
    const nstProps = {
      player: { id: 1, fullName: "Skater", position: "C" },
      gameLog: [{ date: "2026-10-01", games_played: 1, points: 1 }],
      isGoalie: false,
      seasonId: 20262027,
    };
    const centers = { data: [{ player_id: 1 }, { player_id: 2 }, { player_id: 3 }], error: null };

    it("reads the player's value and the cohort from the 5v5 views and labels the radar 5v5", async () => {
      installQueryMock({
        playerRow: null,
        cohortRows: [],
        cohortResults: {
          "player_id,goals_per_60,toi_seconds": {
            data: [
              { player_id: 1, goals_per_60: 1.2, toi_seconds: 36000 },
              { player_id: 2, goals_per_60: 0.8, toi_seconds: 36000 },
              { player_id: 3, goals_per_60: 1.6, toi_seconds: 36000 },
            ],
            error: null,
          },
          player_id: centers,
        },
      });
      render(<PlayerRadarChart {...nstProps} selectedStats={["goals_per_60"]} />);
      fireEvent.click(screen.getByRole("button", { name: "How rankings are calculated" }));

      await waitFor(() => expect(screen.getByText("2nd / 3")).toBeTruthy());
      expect(chartPercentiles()).toEqual([50]);
      expect(queryTraces.map((trace) => trace.table).sort()).toEqual([
        "nst_seasonlong_5v5_rates",
        "wgo_skater_stats_per_game",
      ]);
      expect(queryTraces.some((trace) => trace.table.includes("_as_"))).toBe(false);
      expect(screen.getAllByText(/5v5 · 2026-27 regular season · Full season/).length).toBeGreaterThan(0);
    });

    it.each([
      ["pim_per_60", "player_id,pim_per_60,toi_seconds", (v: number) => ({ pim_per_60: v, toi_seconds: 7200 })],
      ["hdca_per_60", "player_id,hdca,toi_seconds_oi", (v: number) => ({ hdca: v, toi_seconds_oi: 3600 })],
    ])("ranks %s lower-is-better with the mid-rank", async (stat, select, row) => {
      installQueryMock({
        playerRow: null,
        cohortRows: [],
        cohortResults: {
          [select]: { data: [1, 2, 3].map((v) => ({ player_id: v, ...row(v) })), error: null },
          player_id: centers,
        },
      });
      render(<PlayerRadarChart {...nstProps} selectedStats={[stat]} />);
      fireEvent.click(screen.getByRole("button", { name: "How rankings are calculated" }));

      await waitFor(() => expect(screen.getByText("1st / 3")).toBeTruthy());
      expect(chartPercentiles()).toEqual([83]);
      const nstTrace = queryTraces.find((trace) => trace.table.startsWith("nst_"))!;
      expect(nstTrace.calls).toContainEqual(["eq", "season", 20262027]);
    });

    it("derives cf_pct from on-ice counts and ranks only same-position skaters", async () => {
      installQueryMock({
        playerRow: null,
        cohortRows: [],
        cohortResults: {
          "player_id,cf,ca": {
            data: [
              { player_id: 1, cf: 60, ca: 40 }, // 60%
              { player_id: 2, cf: 50, ca: 50 }, // 50%
              { player_id: 3, cf: 70, ca: 30 }, // 70%, a defenseman: excluded
            ],
            error: null,
          },
          player_id: { data: [{ player_id: 1 }, { player_id: 2 }], error: null },
        },
      });
      render(<PlayerRadarChart {...nstProps} selectedStats={["cf_pct"]} />);
      fireEvent.click(screen.getByRole("button", { name: "How rankings are calculated" }));

      await waitFor(() => expect(screen.getByText("1st / 2")).toBeTruthy());
      expect(chartPercentiles()).toEqual([75]);
      expect(chartState.current.data.averages.cf_pct).toBeCloseTo(60);
      const positionTrace = queryTraces.filter((trace) => trace.table === "wgo_skater_stats_per_game").at(-1)!;
      expect(positionTrace.calls).toContainEqual(["in", "position_code", ["C"]]);
    });

    it("ranks a player missing from the position list within N, never N+1 of N", async () => {
      installQueryMock({
        playerRow: null,
        cohortRows: [],
        cohortResults: {
          "player_id,cf,ca": {
            data: [
              { player_id: 1, cf: 40, ca: 60 }, // 40%, the player
              { player_id: 2, cf: 50, ca: 50 },
              { player_id: 3, cf: 70, ca: 30 },
            ],
            error: null,
          },
          // The position read does not list the player himself.
          player_id: { data: [{ player_id: 2 }, { player_id: 3 }], error: null },
        },
      });
      render(<PlayerRadarChart {...nstProps} selectedStats={["cf_pct"]} />);
      fireEvent.click(screen.getByRole("button", { name: "How rankings are calculated" }));

      await waitFor(() => expect(screen.getByText("3rd / 3")).toBeTruthy());
      expect(screen.queryByText("3rd / 2")).toBeNull();
      expect(chartPercentiles()).toEqual([17]);
    });

    it("leaves a player below the cohort's 5v5 minimum unranked and says why", async () => {
      installQueryMock({
        playerRow: null,
        cohortRows: [],
        cohortResults: {
          "player_id,goals_per_60,toi_seconds": {
            data: [
              { player_id: 1, goals_per_60: 6, toi_seconds: 600 }, // 10 min: below the 60-min floor
              { player_id: 2, goals_per_60: 0.8, toi_seconds: 36000 },
              { player_id: 3, goals_per_60: 1.6, toi_seconds: 36000 },
            ],
            error: null,
          },
          player_id: centers,
        },
      });
      render(<PlayerRadarChart {...nstProps} selectedStats={["goals_per_60"]} />);

      await waitFor(() => expect(screen.queryByText("Calculating...")).toBeNull());
      expect(screen.queryByText(/1st \/ 3/)).toBeNull();
      expect(screen.getByText(/Below the cohort sample minimum, so unranked: .*needs 60 min of 5v5 ice time/)).toBeTruthy();
    });

    it("measures HDCF/60 on-ice, as NST names it", async () => {
      installQueryMock({
        playerRow: null,
        cohortRows: [],
        cohortResults: {
          "player_id,hdcf,toi_seconds_oi": {
            data: [
              { player_id: 1, hdcf: 72, toi_seconds_oi: 18000 }, // 14.4 per 60
              { player_id: 2, hdcf: 30, toi_seconds_oi: 18000 },
            ],
            error: null,
          },
          player_id: centers,
        },
      });
      render(<PlayerRadarChart {...nstProps} selectedStats={["hdcf_per_60"]} />);

      await waitFor(() => expect(chartPercentiles()).toEqual([75]));
      expect(chartState.current.data.averages.hdcf_per_60).toBeCloseTo(14.4, 6);
    });

    it("never ranks all-situation WGO skater stats on the 5v5 radar", async () => {
      installQueryMock({ playerRow: { player_id: 1, points: 1.25 }, cohortRows: [{ points: 1 }] });
      render(<PlayerRadarChart {...nstProps} selectedStats={["points"]} />);

      await waitFor(() => expect(screen.queryByText("Calculating rankings...")).toBeNull());
      expect(queryTraces).toHaveLength(0);
      expect(screen.getByText(/No 5v5 comparison data for/)).toBeTruthy();
    });

    it("shows no 5v5 comparison data when the NST read fails", async () => {
      installQueryMock({
        playerRow: null,
        cohortRows: [],
        cohortResults: {
          "player_id,cf,ca": { data: null, error: { message: "relation does not exist" } },
          player_id: { data: [{ player_id: 1 }], error: null },
        },
      });
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      render(<PlayerRadarChart {...nstProps} selectedStats={["cf_pct"]} />);

      await waitFor(() => expect(screen.queryByText("Calculating...")).toBeNull());
      expect(screen.getByText(/No 5v5 comparison data for/)).toBeTruthy();
      expect(chartState.current?.data?.averages?.cf_pct).toBeUndefined();
      errorSpy.mockRestore();
    });
  });
});
