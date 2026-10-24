import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  errors: {} as Record<string, string>,
  rejected: {} as Record<string, boolean>,
  queries: [] as Array<{ table: string; filters: Array<[string, unknown]> }>,
}));

vi.mock("lib/supabase", () => ({
  default: {
    from: (table: string) => {
      const filters: Array<[string, unknown]> = [];
      let columns: string[] = [];
      const orders: Array<[string, boolean]> = [];
      const query = {
        select: (selection: string) => {
          columns = selection.split(",").map((column) => column.trim());
          return query;
        },
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          return query;
        },
        order: (field: string, options: { ascending: boolean }) => { orders.push([field, options.ascending]); return query; },
        then: (resolve: (result: unknown) => void, reject: (reason: unknown) => void) => {
          fixture.queries.push({ table, filters });
          if (fixture.rejected[table]) return Promise.reject(new Error("private rejected query")).then(resolve, reject);
          const error = fixture.errors[table];
          return Promise.resolve({
            data: error ? null : (fixture.rows[table] ?? [])
              .filter((row) => filters.every(([column, value]) => row[column] === value))
              .sort((left, right) => {
                for (const [field, ascending] of orders) {
                  const a = left[field] as string; const b = right[field] as string;
                  if (a !== b) return (a < b ? -1 : 1) * (ascending ? 1 : -1);
                }
                return 0;
              })
              .map((row) => Object.fromEntries(columns.map((column) => [column, row[column]]))),
            error: error ? { message: error } : null,
          }).then(resolve, reject);
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

import MetricsTimeline from "components/MetricsTimeline/MetricsTimeline";

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
  fixture.rejected = {};
  fixture.queries = [];
});
afterEach(cleanup);

async function load() {
  render(<MetricsTimeline teamId="10" teamAbbrev="TOR" seasonId="20252026" />);
  await waitFor(() => expect(screen.queryByText("Loading performance timeline...")).toBeNull());
}

describe("independent timeline approval and partial-source checks", () => {
  const select = (value: string) => fireEvent.change(screen.getByLabelText("Select Metric:"), { target: { value } });
  const data = () => JSON.parse(screen.getByTestId("chart-data").textContent!);
  it("applies approval/type/team/season filters before preferred same-game version selection", async () => {
    fixture.rows.wgo_team_stats = [];
    fixture.rows.nhl_xg_team_game_aggregates = [
      { ...xg, feature_version: "1", updated_at: "2026-01-11T00:00:00Z", xg_for: 4, xg_against: 8 },
      { ...xg, feature_version: "2", updated_at: "2026-01-12T00:00:00Z", xg_for: null, xg_against: 0 },
      { ...xg, feature_version: "9", xg_for: 99, source_model_approved: false },
      { ...xg, feature_version: "9", xg_for: 98, source_prediction_type: "rebound" },
      { ...xg, team_id: 22, game_date: "2026-01-11", xg_for: 97 },
      { ...xg, season_id: 20242025, game_date: "2026-01-11", xg_for: 96 },
      { ...xg, game_id: 2025020002, game_date: "2026-01-12", xg_for: 3, xg_against: 2 }
    ];
    await load(); select("xga");
    expect(data().map((r: any) => [r.date, r.xgGameId, r.xgf, r.xga, r.pointPct])).toEqual([
      ["2026-01-10", 2025020001, null, 0, null], ["2026-01-12", 2025020002, 3, 2, null]
    ]);
    expect(fixture.queries.filter(q => q.table === "nhl_xg_team_game_aggregates")).toHaveLength(1);
  });

  it.each(["wgo_team_stats", "nhl_xg_team_game_aggregates"])("preserves the other source when %s rejects its promise", async (table) => {
    fixture.rejected[table] = true;
    fixture.rows.nhl_xg_team_game_aggregates = [{ ...xg, xg_for: 0 }];
    await load();
    expect(screen.queryByText("Error Loading Timeline")).toBeNull();
    if (table === "wgo_team_stats") {
      select("xgf"); expect(screen.getAllByText("0.00").length).toBeGreaterThan(0);
      expect(screen.getByText("WGO metrics could not be loaded.")).toBeTruthy();
    } else {
      expect(screen.getAllByText("100.0%").length).toBeGreaterThan(0);
      expect(screen.getByText("Expected goals could not be loaded.")).toBeTruthy();
    }
    expect(screen.queryByText("private rejected query")).toBeNull();
  });

  it("withholds an ambiguous same-date xG slot without losing valid WGO sample or date", async () => {
    fixture.rows.wgo_team_stats = [{ ...wgo, date: "2026-01-11", games_played: 30, points: 40 }];
    fixture.rows.nhl_xg_team_game_aggregates = [
      xg,
      { ...xg, game_date: "2026-01-11", game_id: 2025020002 },
      { ...xg, game_date: "2026-01-11", game_id: 2025020003 },
      { ...xg, game_date: "2026-01-12", game_id: 2025020004 }
    ];
    await load(); select("xgf");
    expect(data()[1]).toMatchObject({ date: "2026-01-11", wgoGamesPlayed: 30, pointPct: 40/60, xgf: null, xga: null, xgGameId: null });
    expect(screen.getByTestId("connect-nulls").textContent).toBe("false");
  });

  it("uses five available observations for the delta, preserving zero and intervening null dates", async () => {
    fixture.rows.wgo_team_stats = [{ ...wgo, date: "2026-01-04" }];
    fixture.rows.nhl_xg_team_game_aggregates = [1, 2, 3, 5, 6, 7].map((day, index) => ({ ...xg, game_date: `2026-01-0${day}`, game_id: 2025020010 + index, xg_for: index }));
    await load(); select("xgf");
    expect(screen.getByText("6 observations with data")).toBeTruthy();
    expect(screen.getByText("Change vs 5 available observations ago")).toBeTruthy();
    expect(screen.getByText("+5.00")).toBeTruthy();
    expect(data().map((r: any) => r.xgf)).toEqual([0, 1, 2, null, 3, 4, 5]);
    expect(screen.getByRole("columnheader", { name: "WGO sample (games)" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "xGF (game)" })).toBeTruthy();
  });
});
