import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  tables: {} as Record<string, Array<Record<string, any>>>,
  queries: [] as Array<{
    table: string;
    filters: Array<{ operator: string; column: string; value: any }>;
    range: [number, number] | null;
  }>,
}));

vi.mock("lib/supabase", () => {
  class Query {
    private filters: Array<{
      operator: string;
      column: string;
      value: any;
    }> = [];
    private orders: Array<{ column: string; ascending: boolean }> = [];
    private rowLimit: number | null = null;
    private rowRange: [number, number] | null = null;

    constructor(private readonly table: string) {}

    select() {
      return this;
    }

    eq(column: string, value: any) {
      this.filters.push({ operator: "eq", column, value });
      return this;
    }

    lte(column: string, value: any) {
      this.filters.push({ operator: "lte", column, value });
      return this;
    }

    in(column: string, value: any[]) {
      this.filters.push({ operator: "in", column, value });
      return this;
    }

    order(column: string, options?: { ascending?: boolean }) {
      this.orders.push({
        column,
        ascending: options?.ascending !== false,
      });
      return this;
    }

    limit(value: number) {
      this.rowLimit = value;
      return this;
    }

    range(from: number, to: number) {
      this.rowRange = [from, to];
      return this;
    }

    then<TResult1 = any, TResult2 = never>(
      onfulfilled?:
        | ((value: {
            data: any[];
            error: null;
          }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      let rows = [...(database.tables[this.table] ?? [])];
      for (const filter of this.filters) {
        rows = rows.filter((row) => {
          if (filter.operator === "eq") {
            return row[filter.column] === filter.value;
          }
          if (filter.operator === "lte") {
            return row[filter.column] <= filter.value;
          }
          return filter.value.includes(row[filter.column]);
        });
      }
      for (const order of [...this.orders].reverse()) {
        rows.sort((left, right) => {
          const comparison =
            left[order.column] < right[order.column]
              ? -1
              : left[order.column] > right[order.column]
                ? 1
                : 0;
          return order.ascending ? comparison : -comparison;
        });
      }
      if (this.rowLimit != null) {
        rows = rows.slice(0, this.rowLimit);
      }
      if (this.rowRange) {
        rows = rows.slice(this.rowRange[0], this.rowRange[1] + 1);
      }

      database.queries.push({
        table: this.table,
        filters: this.filters,
        range: this.rowRange,
      });
      return Promise.resolve({ data: rows, error: null }).then(
        onfulfilled,
        onrejected,
      );
    }
  }

  return {
    default: {
      from: (table: string) => new Query(table),
    },
  };
});

vi.mock("lib/NHL/server", () => ({
  getCurrentSeason: vi.fn(async () => ({
    seasonId: 20252026,
  })),
}));

import { fetchStatsData } from "./statsPageFetch";

beforeEach(() => {
  database.queries = [];
  database.tables = {
    wgo_skater_stats_totals: Array.from({ length: 1_001 }, (_, index) => ({
      player_id: index + 1,
      player_name: `Skater ${index + 1}`,
      current_team_abbreviation: "FHFH",
      season: "20252026",
      points: index + 1,
      goals: index + 1,
      pp_points: index + 1,
      blocked_shots: 0,
      shots: 0,
      hits: 0,
    })),
    players: Array.from({ length: 1_001 }, (_, index) => ({
      id: index + 1,
      image_url: `/players/${index + 1}.png`,
      sweater_number: index + 1,
      position: "C",
    })),
    wgo_goalie_stats_totals: [
      {
        goalie_id: 7,
        goalie_name: "Latest Goalie",
        season_id: 20242025,
        wins: 2,
        save_pct: 0.91,
        goals_against_avg: 2.5,
        quality_starts_pct: 0.5,
        games_played: 2,
      },
      {
        goalie_id: 8,
        goalie_name: "Latest Backup",
        season_id: 20242025,
        wins: 1,
        save_pct: 0.9,
        goals_against_avg: 2.8,
        quality_starts_pct: 0.4,
        games_played: 1,
      },
      {
        goalie_id: 9,
        goalie_name: "Older Goalie",
        season_id: 20232024,
        wins: 999,
        save_pct: 0.99,
        goals_against_avg: 1,
        quality_starts_pct: 1,
        games_played: 82,
      },
    ],
    nhl_standings_details: [
      ...Array.from({ length: 1_001 }, (_, index) => ({
        season_id: 20252026,
        date: "2026-04-01",
        team_abbrev: `T${String(index).padStart(4, "0")}`,
        games_played: 0,
      })),
      {
        season_id: 20252026,
        date: "2026-03-31",
        team_abbrev: "OLD",
        games_played: 82,
      },
    ],
  };
});

describe("fetchStatsData", () => {
  it("fully pages leaderboard inputs, chunks identities, and isolates the latest goalie season", async () => {
    const result = await fetchStatsData();

    expect(result.pointsLeaders[0]).toMatchObject({
      player_id: 1_001,
      fullName: "Skater 1001",
      image_url: "/players/1001.png",
    });
    expect(result.goalieSeasonLabel).toBe("2024-25");
    expect(result.goalieLeadersWins.map((goalie) => goalie.fullName)).toEqual([
      "Latest Goalie",
      "Latest Backup",
    ]);

    const playerIdentityQueries = database.queries.filter(
      (query) =>
        query.table === "players" &&
        query.filters.some((filter) => filter.operator === "in"),
    );
    expect(playerIdentityQueries.length).toBeGreaterThan(1);
    expect(
      Math.max(
        ...playerIdentityQueries.map(
          (query) =>
            query.filters.find((filter) => filter.operator === "in")?.value
              .length ?? 0,
        ),
      ),
    ).toBeLessThanOrEqual(200);

    expect(
      database.queries.filter(
        (query) =>
          query.table === "wgo_skater_stats_totals" && query.range != null,
      ),
    ).toHaveLength(2);
    expect(
      database.queries.filter(
        (query) =>
          query.table === "nhl_standings_details" && query.range != null,
      ),
    ).toHaveLength(2);
    expect(
      database.queries.some(
        (query) =>
          query.table === "wgo_goalie_stats_totals" &&
          query.filters.some(
            (filter) =>
              filter.operator === "eq" &&
              filter.column === "season_id" &&
              filter.value === 20242025,
          ),
      ),
    ).toBe(true);
  });
});
