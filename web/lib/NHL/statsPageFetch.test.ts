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

import { getCurrentSeason } from "lib/NHL/server";
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
  it("P02: missing goalie ratios never enter numerical rankings; observed zero remains", async () => {
    database.tables.wgo_goalie_stats_totals = [
      { goalie_id: 991, goalie_name: "Missing", season_id: 20252026, games_played: 10, wins: 3,
        goals_against_avg: null, save_pct: null, quality_starts_pct: null },
      { goalie_id: 992, goalie_name: "Observed", season_id: 20252026, games_played: 10, wins: 2,
        goals_against_avg: 2, save_pct: 0.92, quality_starts_pct: 0.5 },
      { goalie_id: 993, goalie_name: "Zero", season_id: 20252026, games_played: 1, wins: 0,
        goals_against_avg: 0, save_pct: 0, quality_starts_pct: 0 }
    ];
    const result = await fetchStatsData();
    expect(result.goalieLeadersGAA.map((goalie) => goalie.goalie_id)).toEqual([993, 992]);
    expect(result.goalieLeadersSavePct.map((goalie) => goalie.goalie_id)).toEqual([992, 993]);
    expect(result.goalieLeadersQS.map((goalie) => goalie.goalie_id)).toEqual([992, 993]);
    expect(result.goalieLeadersWins.find((goalie) => goalie.goalie_id === 991)).toMatchObject({
      goals_against_avg: null, save_pct: null, quality_starts_pct: null
    });
  });

  it.each([undefined, "", " ", false, NaN, Infinity, -1])(
    "P02: invalid goalie ratio %s is unavailable rather than zero",
    async (invalid) => {
      database.tables.wgo_goalie_stats_totals = [{
        goalie_id: 991, goalie_name: "Invalid", season_id: 20252026, games_played: 10,
        wins: 1, goals_against_avg: invalid, save_pct: invalid, quality_starts_pct: invalid
      }];
      const result = await fetchStatsData();
      expect(result.goalieLeadersGAA).toEqual([]);
      expect(result.goalieLeadersSavePct).toEqual([]);
      expect(result.goalieLeadersQS).toEqual([]);
    }
  );

  it("P02: ratio rankings require played games and fractions no larger than one", async () => {
    database.tables.wgo_goalie_stats_totals = [
      { goalie_id: 991, goalie_name: "No exposure", season_id: 20252026, games_played: 0,
        goals_against_avg: 0, save_pct: 0, quality_starts_pct: 0 },
      { goalie_id: 992, goalie_name: "Invalid fraction", season_id: 20252026, games_played: 10,
        goals_against_avg: 2, save_pct: 1.1, quality_starts_pct: 1.1 }
    ];
    const result = await fetchStatsData();
    expect(result.goalieLeadersGAA.map((goalie) => goalie.goalie_id)).toEqual([992]);
    expect(result.goalieLeadersSavePct).toEqual([]);
    expect(result.goalieLeadersQS).toEqual([]);
  });

  it("ranks the full season within each position before taking five, including NHL wing codes", async () => {
    database.tables.wgo_skater_stats_totals = database.tables.wgo_skater_stats_totals.map((row) => ({
      ...row,
      hits: row.player_id,
    }));
    database.tables.players = database.tables.players.map((player) => ({
      ...player,
      position: player.id <= 6 ? "D" : player.id === 7 ? "L" : player.id === 8 ? "LW" : player.id === 9 ? "R" : player.id === 10 ? "RW" : player.id === 11 ? null : "C",
    }));
    const result = await fetchStatsData();

    expect(result.pointsLeaders.map((player) => player.player_id)).toEqual([1001, 1000, 999, 998, 997]);
    for (const metric of ["pointsLeaders", "goalsLeaders", "pppLeaders", "bshLeaders"] as const) {
      expect(result.skaterLeadersByPosition.D?.[metric].map((player) => player.player_id)).toEqual([6, 5, 4, 3, 2]);
      expect(result.skaterLeadersByPosition.LW?.[metric].map((player) => player.player_id)).toEqual([8, 7]);
      expect(result.skaterLeadersByPosition.RW?.[metric].map((player) => player.player_id)).toEqual([10, 9]);
      expect(result.skaterLeadersByPosition.C?.[metric]).toHaveLength(5);
    }
  });

  it("uses a season supplied by the caller instead of looking it up again", async () => {
    vi.mocked(getCurrentSeason).mockClear();
    const result = await fetchStatsData({ seasonId: 20252026 } as any);
    expect(getCurrentSeason).not.toHaveBeenCalled();
    expect(result.pointsLeaders[0]?.player_id).toBe(1_001);
  });

  it("leaves missing positions empty instead of reusing the overall leaders", async () => {
    const result = await fetchStatsData();
    expect(result.skaterLeadersByPosition.D).toEqual({
      pointsLeaders: [], goalsLeaders: [], pppLeaders: [], bshLeaders: [],
    });
  });

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
