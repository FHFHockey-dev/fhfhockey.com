import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabaseFromMock, rangeCalls, queryCalls, pagingFixture } = vi.hoisted(() => {
  type QueryState = {
    table: string;
    from?: number;
    to?: number;
    limit?: number;
    filters: Array<{ method: string; key: string; value: any }>;
    orders: Array<{ key: string; ascending: boolean }>;
  };
  const rangeCalls: QueryState[] = [];
  const queryCalls: QueryState[] = [];
  const pagingFixture = {
    rows: {} as Record<string, Record<string, any>[]>,
    omitOrder: null as string | null,
    enforceFilters: false,
    errors: {} as Record<string, string>,
  };

  function resolvePage(state: QueryState) {
    if (pagingFixture.errors[state.table]) {
      return { data: [], error: { message: pagingFixture.errors[state.table] } };
    }
    const orders = state.orders.filter((order) => order.key !== pagingFixture.omitOrder);
    const data = [...(pagingFixture.rows[state.table] ?? [])]
      .filter((row) => !pagingFixture.enforceFilters || state.filters.every(({ method, key, value }) => {
        if (row[key] == null) return false;
        if (method === "eq") return row[key] === value;
        if (method === "gte") return row[key] >= value;
        if (method === "lte") return row[key] <= value;
        if (method === "in") return value.includes(row[key]);
        throw new Error(`Unimplemented fixture filter: ${method}`);
      }))
      .sort((left, right) => {
        for (const { key, ascending } of orders) {
          if (left[key] === right[key]) continue;
          return (left[key] < right[key] ? -1 : 1) * (ascending ? 1 : -1);
        }
        // A legal backend plan change reverses unresolved ties on later pages.
        return state.from ? right.fixtureIndex - left.fixtureIndex : left.fixtureIndex - right.fixtureIndex;
      });
    const limited = state.limit == null ? data : data.slice(0, state.limit);
    return { data: state.from == null ? limited : limited.slice(state.from, state.to! + 1), error: null };
  }

  function createQuery(table: string) {
    const state: QueryState = { table, orders: [], filters: [] };
    queryCalls.push(state);
    const query: Record<string, unknown> = {};
    query.select = () => query;
    for (const method of ["eq", "gte", "lte", "in"]) {
      query[method] = (key: string, value: any) => {
        state.filters.push({ method, key, value });
        return query;
      };
    }
    query.limit = (limit: number) => { state.limit = limit; return query; };
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
    query.maybeSingle = () => {
      const result = resolvePage(state);
      return Promise.resolve({
        data: pagingFixture.enforceFilters ? result.data[0] ?? null : SNAPSHOT_ROWS[table] ?? null,
        error: result.error,
      });
    };
    query.then = (
      resolve: (value: ReturnType<typeof resolvePage>) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(resolvePage(state)).then(resolve, reject);
    return query;
  }

  const SNAPSHOT_ROWS: Record<string, unknown> = {
    seasons: { id: 20252026, startDate: "2025-10-07", regularSeasonEndDate: "2026-04-16" },
    team_power_ratings_daily: { date: "2026-04-16" },
    team_unit_toi: { snapshot_date: "2026-04-16" },
  };

  return {
    rangeCalls, queryCalls, pagingFixture,
    supabaseFromMock: vi.fn((table: string) => createQuery(table)),
  };
});

vi.mock("lib/supabase/server", () => ({
  default: { from: supabaseFromMock },
}));

import { buildContextualRankingsAvailableFilters } from "./availableFilters";
import {
  aggregateTeamGameContextRows,
  aggregateNstTeamStyleLedger,
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

  it("aggregates NST 5v5 team style only over a fully covered eligible game ledger", () => {
    const nstRow = (team_abbreviation: string, date: string, overrides: Record<string, unknown> = {}) => ({
      team_abbreviation, date, gp: 1,
      xgf: 2, xga: 1, gf: 3, ga: 1, ff: 20, fa: 10, cf: 30, ca: 15,
      ...overrides,
    });
    const aggregates = aggregateNstTeamStyleLedger({
      eligibleGames: [
        { teamId: 1, teamAbbreviation: "BOS", date: "2026-04-01" },
        { teamId: 1, teamAbbreviation: "BOS", date: "2026-04-03" },
        { teamId: 2, teamAbbreviation: "TOR", date: "2026-04-02" },
        { teamId: 2, teamAbbreviation: "TOR", date: "2026-04-04" },
      ],
      nstRows: [
        nstRow("BOS", "2026-04-01"),
        nstRow("BOS", "2026-04-03", { xgf: 1.5, xga: 2, gf: 1, ga: 2, ff: 18, fa: 22 }),
        // Not in the ledger: never counted.
        nstRow("BOS", "2026-04-05", { xgf: 100 }),
        nstRow("TOR", "2026-04-02"),
      ],
    });

    expect(aggregates.get("BOS")).toMatchObject({
      teamId: 1,
      gamesCount: 2,
      eligibleGames: 2,
      coveredGames: 2,
      coverageComplete: true,
      latestDate: "2026-04-03",
      xgf: 3.5, xga: 3, gf: 4, ga: 3, ff: 38, fa: 32,
      source: "nst_team_5v5",
    });
    // TOR played two games but NST covers one: no partial totals (rule 13).
    expect(aggregates.get("TOR")).toMatchObject({
      gamesCount: 0, eligibleGames: 2, coveredGames: 1, coverageComplete: false,
      xgf: null, xga: null, gf: null, ga: null, ff: null, fa: null,
    });
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
      minGp: 5,
    });
    expect(parseTeamMatrixRequest({ season: "20252026", min_gp: "2" }).minGp).toBe(2);
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
      percentile: 75,
      qualifiedPeerCount: 3,
    });
    expect(ranks.get("DAL")).toMatchObject({
      rank: 1,
      percentile: 75,
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
      pagingFixture.enforceFilters = false;
      pagingFixture.errors = {};
      pagingFixture.omitOrder = null;
      clearTeamMatrixSurfaceCachesForTests();
    });

    it("orders every paged source read by a unique key", async () => {
      await buildTeamMatrixSurface(parseTeamMatrixRequest({ season: "20252026" }));

      const ordersByTable = new Map(
        rangeCalls.map((call) => [call.table, call.orders.map((order) => order.key)]),
      );
      expect(Object.fromEntries(ordersByTable)).toEqual({
        wgo_team_stats: ["date", "id"],
        team_unit_toi: ["game_date", "id"],
        games: ["date", "id"],
      });
    });
  });
  describe("season, strength and cutoff isolation", () => {
    const power = (date: string, off_rating = 101, team_abbreviation = "BOS") => ({
      date, team_abbreviation, off_rating, def_rating: 99, pace_rating: 100,
    });
    const underlying = (overrides: Record<string, unknown> = {}) => ({
      season_id: 20252026, strength: "fiveOnFive", score_state: "allScores",
      game_date: "2026-04-09", game_id: 1, team_id: 1,
      xgf: 3, xga: 1, gf: 4, ga: 2, ff: 20, fa: 10, cf: 30, ca: 15,
      ...overrides,
    });
    const nst = (overrides: Record<string, unknown> = {}) => ({
      date: "2026-04-09", team_abbreviation: "BOS", gp: 1,
      xgf: 2, xga: 3, gf: 3, ga: 2, ff: 20, fa: 30, cf: 30, ca: 40,
      // Legacy rows in this dedicated 5v5 table may carry "all"; table provenance
      // is authoritative, as documented by the writer's counts5v5 mapping.
      situation: "all", ...overrides,
    });
    const unit = (overrides: Record<string, unknown> = {}) => ({
      id: 1, season_id: 20252026, snapshot_date: "2026-04-09",
      game_id: 1, team_id: 1, game_date: "2026-04-09",
      unit_type: "forward_line", unit_number: 1, unit_share: 0.3,
      unit_toi_seconds: 300, team_unit_pool_toi_seconds: 1000,
      coverage_status: "complete", coverage_warnings: [],
      ...overrides,
    });
    // Floor 0 keeps the small fixtures above the sample floor; floor tests set it.
    const request = (query: Record<string, string> = {}) =>
      parseTeamMatrixRequest({ season: "20252026", min_gp: "0", ...query });

    beforeEach(() => {
      queryCalls.length = 0;
      rangeCalls.length = 0;
      pagingFixture.enforceFilters = true;
      pagingFixture.omitOrder = null;
      pagingFixture.errors = {};
      pagingFixture.rows = {
        seasons: [{ id: 20252026, startDate: "2025-10-07", regularSeasonEndDate: "2026-04-16" }],
        teams: [{ id: 1, abbreviation: "BOS", name: "Boston" }],
        games: [
          { id: 1, date: "2026-04-09", seasonId: 20252026, type: 2, homeTeamId: 1, awayTeamId: 2 },
          { id: 2, date: "2026-04-10", seasonId: 20252026, type: 2, homeTeamId: 1, awayTeamId: 2 },
        ],
        team_power_ratings_daily: [power("2026-04-10")],
      };
      clearTeamMatrixSurfaceCachesForTests();
    });

    it("selects the requested regular season without borrowing newer or playoff power", async () => {
      pagingFixture.rows.team_power_ratings_daily = [
        power("2025-04-10", 80), power("2026-04-10", 101),
        power("2026-05-01", 150), power("2026-11-01", 180),
      ];
      const result = await buildTeamMatrixSurface(request());
      expect(result.meta.snapshotDate).toBe("2026-04-10");
      expect(result.rows[0].metrics.off_rating.rawValue).toBe(101);
      const lookup = queryCalls.find((call) => call.table === "team_power_ratings_daily")!;
      expect(lookup.filters).toEqual(expect.arrayContaining([
        { method: "gte", key: "date", value: "2025-10-07" },
        { method: "lte", key: "date", value: "2026-04-16" },
      ]));
    });

    it("clamps an explicit cutoff beyond the requested regular season", async () => {
      pagingFixture.rows.team_power_ratings_daily.push(power("2026-05-01", 150), power("2026-11-01", 180));
      const result = await buildTeamMatrixSurface(request({ as_of_date: "2026-11-02" }));
      expect(result.meta.snapshotDate).toBe("2026-04-10");
    });

    it.each<[string, string, ReturnType<typeof power>[]]>([
      ["before the season", "2025-09-01", [power("2025-08-01")]],
      ["only another season exists", "2026-04-10", [power("2025-04-10"), power("2026-11-01")]],
    ])("does not borrow a power snapshot when %s", async (_label, asOfDate, rows) => {
      pagingFixture.rows.team_power_ratings_daily = rows;
      await expect(buildTeamMatrixSurface(request({ as_of_date: asOfDate })))
        .rejects.toThrow("No team power snapshot available");
    });

    it("uses authoritative season dates for a nonstandard season calendar", async () => {
      pagingFixture.rows.seasons = [{ id: 20202021, startDate: "2021-01-13", regularSeasonEndDate: "2021-05-19" }];
      pagingFixture.rows.team_power_ratings_daily = [
        power("2020-09-28", 180), power("2021-05-18", 101), power("2021-06-01", 160),
      ];
      const result = await buildTeamMatrixSurface(request({ season: "20202021" }));
      expect(result.meta.snapshotDate).toBe("2021-05-18");
    });

    it.each<[string, Array<Record<string, unknown>>]>([
      ["missing", []],
      ["missing start", [{ id: 20252026, startDate: null, regularSeasonEndDate: "2026-04-16" }]],
      ["reversed", [{ id: 20252026, startDate: "2026-04-17", regularSeasonEndDate: "2026-04-16" }]],
    ])("rejects %s season bounds instead of guessing", async (_label, seasons) => {
      pagingFixture.rows.seasons = seasons;
      await expect(buildTeamMatrixSurface(request())).rejects.toThrow("regular-season date bounds");
    });

    it("propagates a season lookup error without reading power data", async () => {
      pagingFixture.errors.seasons = "fixture season failure";
      await expect(buildTeamMatrixSurface(request())).rejects.toThrow("fixture season failure");
      expect(queryCalls.some((call) => call.table === "team_power_ratings_daily")).toBe(false);
    });

    it("uses the same power cutoff and regular-season 5v5 context for game sources", async () => {
      pagingFixture.rows.nst_team_5v5 = [
        nst({ xgf: 3, xga: 1 }), nst({ date: "2026-04-10", xgf: 1, xga: 3 }),
        nst({ date: "2026-04-11", xgf: 1000 }),
        nst({ date: "2025-09-01", xgf: 1000 }),
      ];
      const context = { id: 1, season_id: 20252026, date: "2026-04-09", team_id: 1, game_id: 1,
        goals_for: 3, goals_against: 2, point_pct: 1, pp_opportunities_per_game: 4, penalties_taken_per_60: 3 };
      pagingFixture.rows.wgo_team_stats = [
        context, { ...context, id: 2, date: "2026-04-11", pp_opportunities_per_game: 100 },
        { ...context, id: 3, date: "2025-09-01", pp_opportunities_per_game: 100 },
        { ...context, id: 4, season_id: 20242025, pp_opportunities_per_game: 100 },
      ];
      const result = await buildTeamMatrixSurface(request());
      const row = result.rows[0];
      expect(row.record).toMatchObject({ styleGames: 2, styleSnapshotDate: "2026-04-10" });
      // Pooled oracle: (3+1)/(3+1+1+3)*100 = 50; (4+4)/2 = 4 xG per game.
      expect(row.metrics.xgf_percentage.rawValue).toBe(50);
      expect(row.metrics.event_rate.rawValue).toBe(4);
      expect(row.context.games).toBe(1);
      expect(row.metrics.pp_opportunity_rate.rawValue).toBe(4);
    });

    it("leaves style unranked when only incompatible all-strength season totals exist", async () => {
      pagingFixture.rows.nst_team_stats = [{ ...nst(), season: 20252026, situation: "all", xgf: 900, xga: 100 }];
      const result = await buildTeamMatrixSurface(request());
      expect(result.rows[0].style.source).toBe("none");
      expect(result.rows[0].metrics.xgf_percentage).toMatchObject({ rawValue: null, rank: null, percentile: null });
      expect(queryCalls.some((call) => call.table === "nst_team_stats")).toBe(false);
    });

    it("pools NST 5v5 counts with independent arithmetic and excludes out-of-window rows", async () => {
      pagingFixture.rows.nst_team_5v5 = [
        nst(), nst({ date: "2026-04-10", xgf: 4, xga: 1, gf: 5, ga: 3, ff: 30 }),
        nst({ date: "2026-04-11", xgf: 1000 }),
        nst({ date: "2025-09-01", xgf: 1000 }),
        nst({ date: "2026-11-01", xgf: 1000 }),
      ];
      const result = await buildTeamMatrixSurface(request());
      const row = result.rows[0];
      expect(row.style.source).toBe("nst_team_5v5");
      expect(row.record).toMatchObject({
        styleGames: 2, styleSnapshotDate: "2026-04-10",
        styleCoverage: { eligibleGames: 2, coveredGames: 2, complete: true },
      });
      // 6/(6+4)*100, (6+4)/2, 6/(20+30), 8-6 and 4-5.
      expect(row.metrics.xgf_percentage.rawValue).toBe(60);
      expect(row.metrics.event_rate.rawValue).toBe(5);
      expect(row.metrics.shot_quality.rawValue).toBe(0.12);
      expect(row.metrics.finishing_luck.rawValue).toBe(2);
      expect(row.metrics.save_luck.rawValue).toBe(-1);
      expect(row.metrics.net_luck.rawValue).toBe(1);
    });

    it("never ranks bucket-heuristic xG and reads one NST source for every team (W2-P0-10)", async () => {
      pagingFixture.rows.teams.push({ id: 2, abbreviation: "TOR", name: "Toronto" });
      pagingFixture.rows.team_power_ratings_daily.push(power("2026-04-10", 100, "TOR"));
      // BOS also has bucket-heuristic rows; before the fix they won its xGF% (75)
      // while TOR fell back to NST, mixing two models in one ranked column.
      pagingFixture.rows.team_underlying_stats_summary = [
        underlying(), underlying({ game_date: "2026-04-10", game_id: 2 }),
      ];
      pagingFixture.rows.nst_team_5v5 = [
        nst(), nst({ date: "2026-04-10" }),
        nst({ team_abbreviation: "TOR", xgf: 3, xga: 2 }),
        nst({ team_abbreviation: "TOR", date: "2026-04-10", xgf: 3, xga: 2 }),
      ];
      const result = await buildTeamMatrixSurface(request({ page_size: "50" }));
      const byTeam = Object.fromEntries(result.rows.map((row) => [row.team.abbreviation, row]));
      expect(byTeam.BOS.style.source).toBe("nst_team_5v5");
      expect(byTeam.TOR.style.source).toBe("nst_team_5v5");
      // NST oracle: BOS 4/(4+6) = 40, TOR 6/(6+4) = 60.
      expect(byTeam.BOS.metrics.xgf_percentage.rawValue).toBe(40);
      expect(byTeam.TOR.metrics.xgf_percentage.rawValue).toBe(60);
      expect(byTeam.TOR.metrics.xgf_percentage.rank).toBe(1);
      expect(queryCalls.some((call) => call.table === "team_underlying_stats_summary")).toBe(false);
      expect(result.meta.sourceTables).not.toContain("team_underlying_stats_summary");
      expect(result.meta.metricColumns.find((column) => column.metricKey === "xgf_percentage")?.label)
        .toBe("xGF% (NST)");
    });

    it("scores net luck from oriented level-biased xG, not from a zero-sum identity (rule 15)", async () => {
      pagingFixture.rows.games = [
        { id: 1, date: "2026-04-09", seasonId: 20252026, type: 2, homeTeamId: 1, awayTeamId: 2 },
      ];
      pagingFixture.rows.teams.push({ id: 2, abbreviation: "TOR", name: "Toronto" });
      pagingFixture.rows.team_power_ratings_daily.push(power("2026-04-10", 100, "TOR"));
      pagingFixture.rows.nst_team_5v5 = [
        // GF 3, GA 2, xGF 2, xGA 1: finishing +1, save -1, net 0.
        nst({ xgf: 2, xga: 1, gf: 3, ga: 2 }),
        // Same goals with every xG doubled: finishing -1, save 0, net -1.
        nst({ team_abbreviation: "TOR", xgf: 4, xga: 2, gf: 3, ga: 2 }),
      ];
      const result = await buildTeamMatrixSurface(request({ page_size: "50", metric: "net_luck" }));
      const byTeam = Object.fromEntries(result.rows.map((row) => [row.team.abbreviation, row]));
      expect(byTeam.BOS.luck).toEqual({ finishingLuck: 1, saveLuck: -1, netGoalsAboveExpected: 0 });
      expect(byTeam.TOR.luck).toEqual({ finishingLuck: -1, saveLuck: 0, netGoalsAboveExpected: -1 });
      expect(result.rows.map((row) => row.team.abbreviation)).toEqual(["BOS", "TOR"]);
    });

    it("gives tied teams the shared mid-rank percentile at the served matrix (decision 90)", async () => {
      pagingFixture.rows.games = [
        { id: 1, date: "2026-04-09", seasonId: 20252026, type: 2, homeTeamId: 1, awayTeamId: 2 },
        { id: 2, date: "2026-04-09", seasonId: 20252026, type: 2, homeTeamId: 3, awayTeamId: 4 },
      ];
      pagingFixture.rows.teams = ["BOS", "TOR", "DAL", "UTA"].map((abbreviation, index) =>
        ({ id: index + 1, abbreviation, name: abbreviation }));
      pagingFixture.rows.team_power_ratings_daily = ["BOS", "TOR", "DAL", "UTA"].map((abbreviation) =>
        power("2026-04-10", 100, abbreviation));
      pagingFixture.rows.nst_team_5v5 = [
        nst({ xgf: 3, xga: 1 }), nst({ team_abbreviation: "TOR", xgf: 3, xga: 1 }),
        nst({ team_abbreviation: "DAL", xgf: 1, xga: 1 }), nst({ team_abbreviation: "UTA", xgf: 1, xga: 3 }),
      ];
      const result = await buildTeamMatrixSurface(request({ page_size: "50", metric: "xgf_percentage" }));
      const cells = Object.fromEntries(result.rows.map((row) => [row.team.abbreviation, row.metrics.xgf_percentage]));
      // Two of four tied at the top: (2 below + 0.5 x 1 other tie) / 3 = 83.33.
      expect(cells.BOS).toMatchObject({ rank: 1, qualifiedPeerCount: 4 });
      expect(cells.TOR.rank).toBe(1);
      expect(cells.BOS.percentile).toBeCloseTo(83.333, 2);
      expect(cells.TOR.percentile).toBe(cells.BOS.percentile);
    });

    it("refuses partial xG totals: a played game without NST makes the window unknown (W2-4 A1)", async () => {
      // Two played games (final WGO results); NST has only the first one.
      // Before the fix the second game was silently dropped and the 1-game
      // totals were shown as the full window.
      const result0 = { id: 1, season_id: 20252026, date: "2026-04-09", team_id: 1, game_id: 1,
        goals_for: 7, goals_against: 0, point_pct: 1, pp_opportunities_per_game: 4, penalties_taken_per_60: 3 };
      pagingFixture.rows.wgo_team_stats = [
        result0, { ...result0, id: 2, date: "2026-04-10", game_id: 2, goals_for: 1, goals_against: 2 },
      ];
      pagingFixture.rows.nst_team_5v5 = [nst({ xgf: 3, xga: 2, gf: 7, ga: 0 })];
      const result = await buildTeamMatrixSurface(request());
      const row = result.rows[0];
      for (const key of ["xgf_percentage", "shot_quality", "event_rate", "finishing_luck", "save_luck", "net_luck"] as const) {
        expect(row.metrics[key]).toMatchObject({ rawValue: null, rank: null, percentile: null });
      }
      expect(row.record.styleCoverage).toEqual({ eligibleGames: 2, coveredGames: 1, complete: false });
      expect(row.record.styleGames).toBe(0);
      expect(row.warnings).toContain("nst_5v5_coverage_incomplete:1/2");
      expect(row.style.label).toBe("Insufficient data");
    });

    it("applies a visible, user-lowerable sample floor (decision 98)", async () => {
      pagingFixture.rows.nst_team_5v5 = [nst(), nst({ date: "2026-04-10" })];
      const blocked = await buildTeamMatrixSurface(request({ min_gp: "3" }));
      expect(blocked.meta.sampleFloor).toEqual({
        minGames: 3, label: "Min 3 GP; teams below show insufficient sample",
      });
      expect(blocked.rows[0].metrics.xgf_percentage.rawValue).toBeNull();
      expect(blocked.rows[0].record.styleGames).toBe(2);
      expect(blocked.rows[0].warnings).toContain("insufficient_sample:2<3");
      expect(blocked.rows[0].style.label).toBe("Insufficient data");

      clearTeamMatrixSurfaceCachesForTests();
      const lowered = await buildTeamMatrixSurface(request({ min_gp: "2" }));
      expect(lowered.rows[0].metrics.xgf_percentage.rawValue).toBe(40);
      expect(lowered.rows[0].warnings.some((warning) => warning.startsWith("insufficient_sample"))).toBe(false);

      clearTeamMatrixSurfaceCachesForTests();
      const defaulted = await buildTeamMatrixSurface(parseTeamMatrixRequest({ season: "20252026" }));
      expect(defaulted.meta.sampleFloor?.minGames).toBe(5);
      expect(defaulted.rows[0].metrics.xgf_percentage.rawValue).toBeNull();
    });

    it("labels the style composite insufficient instead of a default when inputs are missing (decision 102)", async () => {
      const result = await buildTeamMatrixSurface(request());
      expect(result.rows[0].style.label).toBe("Insufficient data");
      expect(result.rows[0].style.displayLabel).toBe("Insufficient data (raw/contextual)");
      expect(result.rows[0].warnings).toContain("team_style_source_missing");
    });

    it("selects a unit generation no later than explicit as-of and bounds its event dates", async () => {
      pagingFixture.rows.team_unit_toi = [
        unit(), unit({ id: 2, snapshot_date: "2026-04-11", unit_share: 0.9 }),
        unit({ id: 3, game_id: 2, game_date: "2026-04-11", unit_share: 1 }),
        unit({ id: 4, game_id: 3, game_date: "2025-09-01", unit_share: 1 }),
        unit({ id: 5, season_id: 20242025, snapshot_date: "2026-04-10", unit_share: 1 }),
      ];
      const result = await buildTeamMatrixSurface(request({ as_of_date: "2026-04-10" }));
      expect(result.rows[0].unitUsage).toMatchObject({ games: 1, snapshotDate: "2026-04-09", latestDate: "2026-04-09", forwardTopLoadIndex: 30 });
    });

    it("keeps unit metrics unavailable when all generations are after explicit as-of", async () => {
      pagingFixture.rows.team_unit_toi = [unit({ snapshot_date: "2026-04-11" })];
      const result = await buildTeamMatrixSurface(request({ as_of_date: "2026-04-10" }));
      expect(result.rows[0].unitUsage.snapshotDate).toBeNull();
      expect(result.rows[0].metrics.forward_top_load_index).toMatchObject({ rawValue: null, rank: null });
    });

    it("keeps incomplete NST components unavailable instead of summing partial coverage", async () => {
      pagingFixture.rows.nst_team_5v5 = [nst(), nst({ date: "2026-04-10", xgf: null })];
      const result = await buildTeamMatrixSurface(request());
      expect(result.rows[0].metrics.xgf_percentage).toMatchObject({ rawValue: null, rank: null });
      expect(result.rows[0].metrics.shot_quality.rawValue).toBeNull();
      expect(result.rows[0].metrics.event_rate.rawValue).toBeNull();
      expect(result.rows[0].warnings).toContain("nst_5v5_coverage_incomplete:1/2");
    });

    it("retains every NST row across the 1,000-row boundary", async () => {
      const abbreviations = Array.from({ length: 33 }, (_, index) => `T${String(index).padStart(2, "0")}`);
      pagingFixture.rows.teams = abbreviations.map((abbreviation, index) => ({ id: index + 1, abbreviation, name: abbreviation }));
      pagingFixture.rows.team_power_ratings_daily = abbreviations.map((abbreviation) => power("2026-04-10", 100, abbreviation));
      pagingFixture.rows.nst_team_5v5 = Array.from({ length: 31 }, (_, index) => {
        const date = new Date(Date.UTC(2026, 3, 10 - index)).toISOString().slice(0, 10);
        return abbreviations.map((team_abbreviation, teamIndex) =>
          nst({ date, team_abbreviation, fixtureIndex: index * 33 + teamIndex }));
      }).flat();
      pagingFixture.rows.games = pagingFixture.rows.nst_team_5v5.map((row) => ({
        id: row.fixtureIndex + 1, date: row.date, seasonId: 20252026, type: 2,
        homeTeamId: abbreviations.indexOf(row.team_abbreviation) + 1, awayTeamId: null,
      }));
      const result = await buildTeamMatrixSurface(request({ page_size: "50" }));
      expect(result.rows).toHaveLength(33);
      expect(result.rows.every((row) => row.record.styleGames === 31 && row.metrics.xgf_percentage.rawValue === 40)).toBe(true);
      const calls = rangeCalls.filter((call) => call.table === "nst_team_5v5");
      expect(calls.map((call) => [call.from, call.to])).toEqual([[0, 999], [1000, 1999]]);
      expect(calls[0].orders.map((order) => order.key)).toEqual(["date", "team_abbreviation"]);
      expect(calls[0].filters).toContainEqual({ method: "in", key: "team_abbreviation", value: abbreviations });
    });

    it("uses latest corrected unit generation when no historical information cutoff is requested", async () => {
      pagingFixture.rows.team_unit_toi = [
        unit(), unit({ id: 2, snapshot_date: "2026-06-01", unit_share: 0.4 }),
        unit({ id: 3, snapshot_date: "2026-06-01", game_id: 2, game_date: "2026-04-11", unit_share: 1 }),
      ];
      const result = await buildTeamMatrixSurface(request());
      expect(result.rows[0].unitUsage).toMatchObject({ games: 1, snapshotDate: "2026-06-01", forwardTopLoadIndex: 40 });
    });

    it("excludes playoff and unidentified games even when their dates fall inside the season bounds", async () => {
      pagingFixture.rows.games!.push(
        { id: 3, date: "2026-04-09", seasonId: 20252026, type: 3, homeTeamId: 1, awayTeamId: 2 },
      );
      pagingFixture.rows.nst_team_5v5 = [nst({ xgf: 3, xga: 1 })];
      pagingFixture.rows.wgo_team_stats = [1, 3, 99].map((game_id) => ({
        id: game_id, season_id: 20252026, date: "2026-04-09", team_id: 1, game_id,
        goals_for: 3, goals_against: 2, point_pct: 1, pp_opportunities_per_game: game_id === 1 ? 4 : 100,
      }));
      pagingFixture.rows.team_unit_toi = [unit(), unit({ id: 2, game_id: 3, unit_share: 1 }), unit({ id: 3, game_id: 99, unit_share: 1 })];
      const result = await buildTeamMatrixSurface(request());
      expect(result.rows[0].record.styleGames).toBe(1);
      expect(result.rows[0].metrics.xgf_percentage.rawValue).toBe(75);
      expect(result.rows[0].context.games).toBe(1);
      expect(result.rows[0].metrics.pp_opportunity_rate.rawValue).toBe(4);
      expect(result.rows[0].unitUsage).toMatchObject({ games: 1, forwardTopLoadIndex: 30 });
    });

    it("requires a matching regular-season team/date before accepting NST rows", async () => {
      pagingFixture.rows.games = [{ id: 1, date: "2026-04-09", seasonId: 20252026, type: 3, homeTeamId: 1, awayTeamId: 2 }];
      pagingFixture.rows.nst_team_5v5 = [nst()];
      const result = await buildTeamMatrixSurface(request());
      expect(result.rows[0].style.source).toBe("none");
      expect(result.rows[0].metrics.xgf_percentage.rawValue).toBeNull();
    });
  });

});
