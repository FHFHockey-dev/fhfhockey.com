import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type QueryCall = [operation: string, ...args: unknown[]];

type QueryTrace = {
  table: string;
  calls: QueryCall[];
};

const { fromMock, queryTraces } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  queryTraces: [] as QueryTrace[],
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
  Radar: ({ data }: { data: { datasets: { data: number[] }[] } }) => (
    <div data-testid="radar-chart">{JSON.stringify(data.datasets[0].data)}</div>
  ),
}));

vi.mock("../../hooks/useCurrentSeason", () => ({
  default: () => ({ seasonId: 20252026 }),
}));

vi.mock("../../lib/supabase", () => ({
  default: { from: fromMock },
}));

import { PlayerRadarChart } from "./PlayerRadarChart";

function installQueryMock(args: {
  playerRow: Record<string, unknown>;
  cohortRows: Record<string, unknown>[];
  filterCohort?: boolean;
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
        return Promise.resolve({ data: args.playerRow, error: null });
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
        return Promise.resolve({ data: rows, error: null }).then(
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
});
