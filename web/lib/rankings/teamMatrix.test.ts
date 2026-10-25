import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabaseFromMock, rangeCalls, pagingFixture } = vi.hoisted(() => {
  type QueryState = {
    table: string;
    from?: number;
    to?: number;
    orders: Array<{ key: string; ascending: boolean }>;
  };
  const rangeCalls: QueryState[] = [];
  const pagingFixture = {
    rows: {} as Record<string, Record<string, any>[]>,
    omitOrder: null as string | null,
  };

  function resolvePage(state: QueryState) {
    const orders = state.orders.filter((order) => order.key !== pagingFixture.omitOrder);
    const data = [...(pagingFixture.rows[state.table] ?? [])].sort((left, right) => {
      for (const { key, ascending } of orders) {
        if (left[key] === right[key]) continue;
        return (left[key] < right[key] ? -1 : 1) * (ascending ? 1 : -1);
      }
      // A legal backend plan change reverses unresolved ties on later pages.
      return state.from ? right.fixtureIndex - left.fixtureIndex : left.fixtureIndex - right.fixtureIndex;
    });
    return { data: state.from == null ? data : data.slice(state.from, state.to! + 1), error: null };
  }

  function createQuery(table: string) {
    const state: QueryState = { table, orders: [] };
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "gte", "lte", "in", "limit"]) {
      query[method] = () => query;
    }
    query.order = (key: string, options?: { ascending?: boolean }) => {
      state.orders.push({ key, ascending: options?.ascending ?? true });
      return query;
    };
    query.range = (from: number, to: number) => {
      state.from = from;
      state.to = to;
      rangeCalls.push(state);
      return query;
    };
    query.maybeSingle = () =>
      Promise.resolve({
        data: SNAPSHOT_ROWS[table] ?? null,
        error: null,
      });
    query.then = (
      resolve: (value: ReturnType<typeof resolvePage>) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(resolvePage(state)).then(resolve, reject);
    return query;
  }

  const SNAPSHOT_ROWS: Record<string, unknown> = {
    team_power_ratings_daily: { date: "2026-04-16" },
    team_unit_toi: { snapshot_date: "2026-04-16" },
  };

  return {
    rangeCalls,
    pagingFixture,
    supabaseFromMock: vi.fn((table: string) => createQuery(table)),
  };
});

vi.mock("lib/supabase/server", () => ({
  default: { from: supabaseFromMock },
}));

import { buildContextualRankingsAvailableFilters } from "./availableFilters";
import {
  aggregateTeamGameContextRows,
  aggregateTeamStyleRows,
  aggregateTeamUnitToiRows,
  buildTeamMatrixSurface,
  buildTeamUnitMetricInterpretation,
  clearTeamMatrixSurfaceCachesForTests,
  parseTeamMatrixRequest,
  rankTeamMetricValues,
} from "./teamMatrix";

describe("teamMatrix", () => {
  const publishedTeamMetricOptions =
    buildContextualRankingsAvailableFilters()
      .entities.find((entity) => entity.value === "teams")
      ?.filters.metrics.filter((metric) => metric.status === "available")
      .map((metric) => metric.value) ?? [];

  it("aggregates five-on-five team style rows by team abbreviation", () => {
    const teamsById = new Map([
      [1, { id: 1, abbreviation: "BOS", name: "Boston Bruins" }],
      [2, { id: 2, abbreviation: "TOR", name: "Toronto Maple Leafs" }],
    ]);
    const aggregates = aggregateTeamStyleRows({
      teamsById,
      rows: [
        {
          game_date: "2026-04-01",
          team_id: 1,
          xgf: 2,
          xga: 1,
          gf: 3,
          ga: 1,
          ff: 20,
          fa: 10,
          cf: 30,
          ca: 15,
        },
        {
          game_date: "2026-04-03",
          team_id: 1,
          xgf: 1.5,
          xga: 2,
          gf: 1,
          ga: 2,
          ff: 18,
          fa: 22,
          cf: 28,
          ca: 31,
        },
        {
          game_date: "2026-04-02",
          team_id: 2,
          xgf: 3,
          xga: 1,
          gf: 2,
          ga: 0,
          ff: 25,
          fa: 12,
          cf: 33,
          ca: 20,
        },
      ],
    });

    expect(aggregates.get("BOS")).toMatchObject({
      teamId: 1,
      gamesCount: 2,
      latestDate: "2026-04-03",
      xgf: 3.5,
      xga: 3,
      gf: 4,
      ga: 3,
      ff: 38,
      fa: 32,
      source: "team_underlying_stats_summary",
    });
    expect(aggregates.get("TOR")?.gamesCount).toBe(1);
  });

  it("parses team matrix requests with conservative defaults", () => {
    const request = parseTeamMatrixRequest({
      season: "20252026",
      metric: "xgf_percentage",
      search: "Leafs",
      page_size: "25",
    });

    expect(request).toMatchObject({
      season: 20252026,
      metric: "xgf_percentage",
      sortDirection: "desc",
      search: "Leafs",
      page: 1,
      pageSize: 25,
    });
  });

  it("parses every published live team metric option", () => {
    expect(publishedTeamMetricOptions).toEqual(
      expect.arrayContaining([
        "forward_top_load_index",
        "defense_pair_top_load_index",
        "pp1_pp2_usage_share",
      ]),
    );

    for (const metric of publishedTeamMetricOptions) {
      expect(
        parseTeamMatrixRequest({
          season: "20252026",
          metric,
        }).metric,
      ).toBe(metric);
    }
  });

  it("aggregates WGO team game-context rows by team id", () => {
    const aggregates = aggregateTeamGameContextRows([
      {
        date: "2026-04-01",
        team_id: 1,
        game_id: 101,
        home_road: "home",
        goals_for: 4,
        goals_against: 3,
        point_pct: 1,
        pp_opportunities_per_game: 4,
        penalties_taken_per_60: 3,
      },
      {
        date: "2026-04-03",
        team_id: 1,
        game_id: 102,
        home_road: "road",
        goals_for: 1,
        goals_against: 4,
        point_pct: 0,
        pp_opportunities_per_game: 2,
        penalties_taken_per_60: 5,
      },
      {
        date: "2026-04-02",
        team_id: 1,
        game_id: 103,
        home_road: "home",
        goals_for: 2,
        goals_against: 3,
        point_pct: 0.5,
        pp_opportunities_per_game: 3,
        penalties_taken_per_60: 4,
      },
    ]);

    expect(aggregates.get(1)).toMatchObject({
      teamId: 1,
      gamesCount: 3,
      latestDate: "2026-04-03",
      oneGoalGameRate: 66.666667,
      homeRoadPointPctGap: 75,
      powerPlayOpportunityRate: 3,
      penaltiesTakenPer60: 4,
    });
  });

  it("aggregates durable team unit-TOI rows into live usage metrics", () => {
    const aggregates = aggregateTeamUnitToiRows([
      {
        team_id: 1,
        game_id: 101,
        game_date: "2026-04-01",
        snapshot_date: "2026-06-22",
        unit_type: "forward_line",
        unit_number: 1,
        unit_share: 0.6,
        unit_toi_seconds: 180,
        team_unit_pool_toi_seconds: 300,
        coverage_status: "complete",
        coverage_warnings: [],
      },
      {
        team_id: 1,
        game_id: 101,
        game_date: "2026-04-01",
        snapshot_date: "2026-06-22",
        unit_type: "defense_pair",
        unit_number: 1,
        unit_share: 0.55,
        unit_toi_seconds: 110,
        team_unit_pool_toi_seconds: 200,
        coverage_status: "complete",
        coverage_warnings: [],
      },
      {
        team_id: 1,
        game_id: 101,
        game_date: "2026-04-01",
        snapshot_date: "2026-06-22",
        unit_type: "power_play",
        unit_number: 1,
        unit_share: 0.7,
        unit_toi_seconds: 70,
        team_unit_pool_toi_seconds: 100,
        coverage_status: "complete",
        coverage_warnings: [],
      },
      {
        team_id: 1,
        game_id: 101,
        game_date: "2026-04-01",
        snapshot_date: "2026-06-22",
        unit_type: "power_play",
        unit_number: 2,
        unit_share: 0.2,
        unit_toi_seconds: 20,
        team_unit_pool_toi_seconds: 100,
        coverage_status: "complete",
        coverage_warnings: [],
      },
      {
        team_id: 1,
        game_id: 102,
        game_date: "2026-04-03",
        snapshot_date: "2026-06-22",
        unit_type: "forward_line",
        unit_number: 1,
        unit_share: 0.5,
        unit_toi_seconds: 150,
        team_unit_pool_toi_seconds: 300,
        coverage_status: "partial",
        coverage_warnings: ["defense_pair_unresolved"],
      },
    ]);

    expect(aggregates.get(1)).toMatchObject({
      teamId: 1,
      gamesCount: 2,
      latestDate: "2026-04-03",
      snapshotDate: "2026-06-22",
      forwardTopLoadIndex: 55,
      defensePairTopLoadIndex: 55,
      pp1Pp2UsageShare: 90,
      coverage: {
        forwardTopLoad: {
          games: 2,
          latestDate: "2026-04-03",
          snapshotDate: "2026-06-22",
          status: "partial",
          warnings: ["defense_pair_unresolved"],
        },
        defensePairTopLoad: {
          games: 1,
          latestDate: "2026-04-01",
          snapshotDate: "2026-06-22",
          status: "partial",
        },
        pp1Pp2UsageShare: {
          games: 1,
          latestDate: "2026-04-01",
          snapshotDate: "2026-06-22",
          status: "partial",
        },
      },
    });
  });

  it("requires complete minimum unit coverage before naming top-load labels", () => {
    expect(
      buildTeamUnitMetricInterpretation({
        metricLabel: "Forward top load",
        coverage: {
          games: 3,
          latestDate: "2026-04-03",
          snapshotDate: "2026-06-22",
          status: "complete",
          warnings: [],
        },
      }),
    ).toMatchObject({
      label: "Forward top load coverage-qualified",
      coverageQualified: true,
    });
    expect(
      buildTeamUnitMetricInterpretation({
        metricLabel: "Forward top load",
        coverage: {
          games: 2,
          latestDate: "2026-04-03",
          snapshotDate: "2026-06-22",
          status: "partial",
          warnings: ["forward_lines_unresolved"],
        },
      }),
    ).toMatchObject({
      label: "Forward top load coverage-limited",
      coverageQualified: false,
      reason: expect.stringContaining("require 3 complete games"),
    });
  });

  it("ranks team metrics with dense ties and lower-is-better percentile direction", () => {
    const ranks = rankTeamMetricValues(
      [
        { id: "BOS", value: 2.1 },
        { id: "DAL", value: 2.1 },
        { id: "TOR", value: 3.4 },
        { id: "UTA", value: null },
      ],
      true,
    );

    expect(ranks.get("BOS")).toMatchObject({
      rank: 1,
      percentile: 50,
      qualifiedPeerCount: 3,
    });
    expect(ranks.get("DAL")).toMatchObject({
      rank: 1,
      percentile: 50,
      qualifiedPeerCount: 3,
    });
    expect(ranks.get("TOR")).toMatchObject({
      rank: 2,
      percentile: 0,
      qualifiedPeerCount: 3,
    });
    expect(ranks.has("UTA")).toBe(false);
  });

  describe("paged source reads", () => {
    beforeEach(() => {
      rangeCalls.length = 0;
      pagingFixture.rows = {};
      pagingFixture.omitOrder = null;
      clearTeamMatrixSurfaceCachesForTests();
    });

    it("retains both teams when a tied game spans the 1,000-row boundary", async () => {
      const sourceRows = [{ fixtureIndex: 0, game_id: 1, team_id: 1, game_date: "2026-04-16" }];
      for (let game = 2; game <= 501; game += 1) {
        for (const team_id of [1, 2]) {
          sourceRows.push({ fixtureIndex: sourceRows.length, game_id: game, team_id, game_date: new Date(Date.UTC(2026, 3, 17 - game)).toISOString().slice(0, 10) });
        }
      }
      pagingFixture.rows = {
        team_underlying_stats_summary: sourceRows,
        teams: [1, 2].map((id) => ({ id, abbreviation: `T${id}`, name: `Team ${id}` })),
        team_power_ratings_daily: [1, 2].map((id) => ({ team_abbreviation: `T${id}`, off_rating: 100, def_rating: 100, pace_rating: 100 })),
      };
      const request = parseTeamMatrixRequest({ season: "20252026" });
      const response = await buildTeamMatrixSurface(request);
      const counts = (rows: typeof response.rows) => Object.fromEntries(rows.map((row) => [row.team.id, row.record.styleGames]));
      expect(counts(response.rows)).toEqual({ 1: 501, 2: 500 });
      expect(rangeCalls.filter((call) => call.table === "team_underlying_stats_summary").map((call) => [call.from, call.to])).toEqual([[0, 999], [1000, 1999]]);

      // In-memory omission models the old query; no runtime source is edited.
      pagingFixture.omitOrder = "team_id";
      clearTeamMatrixSurfaceCachesForTests();
      const unstable = await buildTeamMatrixSurface(request);
      expect(counts(unstable.rows)).toEqual({ 1: 501, 2: 499 });
    });

    it("orders every paged source read by a unique key", async () => {
      await buildTeamMatrixSurface(parseTeamMatrixRequest({ season: "20252026" }));

      const ordersByTable = new Map(
        rangeCalls.map((call) => [call.table, call.orders.map((order) => order.key)]),
      );
      expect(Object.fromEntries(ordersByTable)).toEqual({
        team_underlying_stats_summary: ["game_date", "game_id", "team_id"],
        wgo_team_stats: ["date", "id"],
        team_unit_toi: ["game_date", "id"],
      });
    });
  });
});
