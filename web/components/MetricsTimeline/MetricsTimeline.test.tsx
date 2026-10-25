import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  errors: {} as Record<string, string>,
  queries: [] as Array<{ table: string; filters: Array<[string, unknown]> }>,
}));

vi.mock("lib/supabase", () => ({
  default: {
    from: (table: string) => {
      const filters: Array<[string, unknown]> = [];
      let columns: string[] = [];
      const query = {
        select: (selection: string) => {
          columns = selection.split(",").map((column) => column.trim());
          return query;
        },
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          return query;
        },
        order: () => query,
        then: (resolve: (result: unknown) => void) => {
          fixture.queries.push({ table, filters });
          const error = fixture.errors[table];
          return Promise.resolve({
            data: error ? null : (fixture.rows[table] ?? [])
              .filter((row) => filters.every(([column, value]) => row[column] === value))
              .map((row) => Object.fromEntries(columns.map((column) => [column, row[column]]))),
            error: error ? { message: error } : null,
          }).then(resolve);
        },
      };
      return query;
    },
  },
}));

vi.mock("recharts", () => {
  const Container = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const Empty = () => null;
  return {
    ResponsiveContainer: Container,
    LineChart: ({ data, children }: { data: unknown; children?: React.ReactNode }) => (
      <div><pre data-testid="chart-data">{JSON.stringify(data)}</pre>{children}</div>
    ),
    Line: ({ connectNulls }: { connectNulls?: boolean }) => <span data-testid="connect-nulls">{String(!!connectNulls)}</span>,
    CartesianGrid: Empty, Legend: Empty, ReferenceLine: Empty, Tooltip: Empty, XAxis: Empty, YAxis: Empty,
  };
});

import MetricsTimeline from "./MetricsTimeline";

const wgo = {
  team_id: 10, season_id: 20252026, date: "2026-01-10", points: 2, games_played: 1,
  goals_for_per_game: 4, goals_against_per_game: 2, power_play_pct: 0.25, shots_for_per_game: 30,
};
const xg = {
  team_id: 10, season_id: 20252026, game_id: 2025020001, game_date: "2026-01-10",
  xg_for: 2.9, xg_against: 2.3, source_model_approved: true, source_prediction_type: "shot_goal",
};

beforeEach(() => {
  fixture.rows = { wgo_team_stats: [wgo], nhl_xg_team_game_aggregates: [] };
  fixture.errors = {};
  fixture.queries = [];
});
afterEach(cleanup);

async function load() {
  render(<MetricsTimeline teamId="10" teamAbbrev="TOR" seasonId="20252026" />);
  await waitFor(() => expect(screen.queryByText("Loading performance timeline...")).toBeNull());
}

describe("MetricsTimeline source admission", () => {
  it("never retries without approval when only unapproved xG exists", async () => {
    fixture.rows.nhl_xg_team_game_aggregates = [{ ...xg, xg_for: 9, source_model_approved: false }];
    await load();
    expect(screen.getAllByText("100.0%").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Select Metric:"), { target: { value: "xgf" } });
    expect(screen.queryAllByText("9.00")).toHaveLength(0);
    expect(fixture.queries.filter((query) => query.table === "nhl_xg_team_game_aggregates")).toHaveLength(1);
  });

  it("retains WGO categories when the xG query fails", async () => {
    fixture.errors.nhl_xg_team_game_aggregates = "synthetic failure";
    await load();
    expect(screen.getByText("Performance Timeline")).toBeTruthy();
    expect(screen.getAllByText("100.0%").length).toBeGreaterThan(0);
    expect(screen.getByText("Expected goals could not be loaded.")).toBeTruthy();
  });

  it("keeps source errors visible when the other source is empty", async () => {
    fixture.rows.wgo_team_stats = [];
    fixture.errors.nhl_xg_team_game_aggregates = "synthetic failure";
    await load();
    expect(screen.getByText("No Data Available")).toBeTruthy();
    expect(screen.getByText("Expected goals could not be loaded.")).toBeTruthy();
  });

  it("shows a loading error when neither source can be read", async () => {
    fixture.errors = { wgo_team_stats: "synthetic failure", nhl_xg_team_game_aggregates: "synthetic failure" };
    await load();
    expect(screen.getByText("Error Loading Timeline")).toBeTruthy();
    expect(screen.queryByText("No Data Available")).toBeNull();
  });

  it("retains approved per-game xG when WGO fails or has no matching date", async () => {
    fixture.errors.wgo_team_stats = "synthetic failure";
    fixture.rows.nhl_xg_team_game_aggregates = [xg];
    await load();
    fireEvent.change(screen.getByLabelText("Select Metric:"), { target: { value: "xgf" } });
    expect(screen.getAllByText("2.90").length).toBeGreaterThan(0);
    expect(screen.getByText("WGO metrics could not be loaded.")).toBeTruthy();
  });

  it("keeps an independently valid xGA when xGF is missing", async () => {
    fixture.rows.nhl_xg_team_game_aggregates = [{ ...xg, xg_for: null }];
    await load();
    fireEvent.change(screen.getByLabelText("Select Metric:"), { target: { value: "xga" } });
    expect(screen.getAllByText("2.30").length).toBeGreaterThan(0);
  });

  it("preserves source dates and null gaps between approved observations", async () => {
    fixture.rows.wgo_team_stats = [wgo, { ...wgo, date: "2026-01-11" }, { ...wgo, date: "2026-01-12" }];
    fixture.rows.nhl_xg_team_game_aggregates = [
      xg,
      { ...xg, game_id: 2025020002, game_date: "2026-01-11", source_model_approved: false },
      { ...xg, game_id: 2025020003, game_date: "2026-01-12" },
    ];
    await load();
    fireEvent.change(screen.getByLabelText("Select Metric:"), { target: { value: "xgf" } });
    const data = JSON.parse(screen.getByTestId("chart-data").textContent ?? "[]");
    expect(data.map((row: { date: string; xgf: number | null }) => [row.date, row.xgf])).toEqual([
      ["2026-01-10", 2.9], ["2026-01-11", null], ["2026-01-12", 2.9],
    ]);
    expect(screen.getByTestId("connect-nulls").textContent).toBe("false");
  });

  it("identifies multi-game WGO samples as observations rather than games", async () => {
    fixture.rows.wgo_team_stats = [{ ...wgo, points: 40, games_played: 30 }];
    await load();
    expect(screen.getByText("1 observation with data")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "WGO sample (games)" })).toBeTruthy();
    expect(screen.queryByText("Best Game")).toBeNull();
  });
});
