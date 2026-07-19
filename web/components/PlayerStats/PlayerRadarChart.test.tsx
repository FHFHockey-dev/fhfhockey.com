import React from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  Radar: () => <div data-testid="radar-chart" />,
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
        return Promise.resolve({ data: args.cohortRows, error: null }).then(
          onFulfilled,
          onRejected,
        );
      },
    };

    return builder;
  });
}

describe("PlayerRadarChart query contract", () => {
  beforeEach(() => {
    fromMock.mockReset();
    queryTraces.length = 0;
  });

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
});
