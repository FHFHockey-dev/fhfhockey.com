import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabaseFromMock, rangeCalls, pagingFixture } = vi.hoisted(() => {
  type QueryState = {
    table: string;
    from?: number;
    to?: number;
    orders: Array<{ key: string; ascending: boolean }>;
    filters: Array<{ method: string; key: string; value: any }>;
    columns?: string;
  };
  const rangeCalls: QueryState[] = [];
  const pagingFixture = {
    rows: {} as Record<string, Record<string, any>[]>,
    omitOrder: null as string | null,
  };

  // Existing metric/workload cases receive a matching official fixture unless
  // they explicitly supply an inventory. Population regressions below always
  // supply their own WGO rows, including empty/missing/contradictory sources.
  function fixtureRows(table: string): Record<string, any>[] {
    if (table in pagingFixture.rows) return pagingFixture.rows[table] ?? [];
    const unified = pagingFixture.rows.goalie_stats_unified ?? [];
    if (table === "games") {
      const seen = new Set<string>();
      return unified.filter((row) => {
        const key = `${row.team_id}:${row.date}`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
      }).map((row, index) => ({ id: index + 1, date: row.date, seasonId: row.season_id, type: 2, homeTeamId: row.team_id, awayTeamId: 999 }));
    }
    if (table === "teams") return [...new Set(unified.map((row) => row.team_id))]
      .filter((id) => id != null).map((id) => ({ id, abbreviation: `T${id}`, name: `Team ${id}` }));
    if (table === "wgo_goalie_stats") {
      const seen = new Set<string>();
      return unified.filter((row) => {
        const key = `${row.player_id}:${row.date}`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
      }).map((row) => {
        const game = fixtureRows("games").find((game) => game.date === row.date &&
          (game.homeTeamId === row.team_id || game.awayTeamId === row.team_id));
        const verified = ["wgo_game_team", "wgo_team_abbreviation", "wgo_season_team_alias"].includes(row.team_id_source);
        return {
          ...row, goalie_id: row.player_id, goalie_name: row.player_name,
          game_id: game?.id ?? -1,
          team_abbreviation: verified ? fixtureRows("teams").find((team) => team.id === row.team_id)?.abbreviation ?? null : null,
          home_road: verified ? (game?.homeTeamId === row.team_id ? "H" : "R") : null,
        };
      });
    }
    if (table === "wgo_team_stats") {
      const seen = new Set<string>();
      return unified.flatMap((row) => {
        const game = fixtureRows("games").find((game) => game.date === row.date &&
          (game.homeTeamId === row.team_id || game.awayTeamId === row.team_id));
        const key = `${row.team_id}:${game?.id}`;
        if (!game || seen.has(key)) return [];
        seen.add(key);
        return [{ game_id: game.id, date: row.date, season_id: row.season_id, team_id: row.team_id }];
      });
    }
    return [];
  }

  function resolvePage(state: QueryState) {
    const orders = state.orders.filter((order) => order.key !== pagingFixture.omitOrder);
    const data = [...fixtureRows(state.table)].filter((row) =>
      state.filters.every(({ method, key, value }) => {
        if (method === "eq") return row[key] === value;
        if (method === "gte") return row[key] >= value;
        if (method === "lte") return row[key] <= value;
        if (method === "in") return value.includes(row[key]);
        return true;
      }),
    ).sort((left, right) => {
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
    const state: QueryState = { table, orders: [], filters: [] };
    const query: Record<string, unknown> = {};
    query.select = (columns: string) => { state.columns = columns; return query; };
    query.limit = () => query;
    for (const method of ["eq", "gte", "lte", "in"]) {
      query[method] = (key: string, value: any) => {
        state.filters.push({ method, key, value });
        return query;
      };
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

  const SNAPSHOT_ROWS: Record<string, unknown> = {};

  return {
    rangeCalls,
    pagingFixture,
    supabaseFromMock: vi.fn((table: string) => createQuery(table)),
  };
});

vi.mock("lib/supabase/server", () => ({
  default: { from: supabaseFromMock },
}));

import {
  aggregateGoalieGameRows,
  buildGoalieMatrixSurface,
  buildGoalieRelativeSaveContexts,
  buildGoalieRoleContextForTests,
  calculateGoalieHighDangerSavePercentage,
  calculateGoalieRelativeSavePercentage,
  calculateGoalieValueSignal,
  calculateGoalieXgaPerShotAgainst,
  clearGoalieMatrixSurfaceCachesForTests,
  GOALIE_SOURCE_PENDING_METRIC_CONTRACTS,
  parseGoalieMatrixRequest,
  rankGoalieMetricValues,
} from "./goalieMatrix";

describe("goalieMatrix", () => {
  it("aggregates latest-window goalie rows and preserves partial NST warnings", () => {
    const rows = aggregateGoalieGameRows(
      [
        {
          player_id: 1,
          date: "2026-04-03",
          season_id: 20252026,
          team_id: 10, team_id_source: "wgo_team_abbreviation",
          player_name: "Goalie One",
          games_played: 1,
          games_started: 1,
          wins: 1,
          saves: 28,
          goals_against: 2,
          shots_against: 30,
          time_on_ice: 3600,
          quality_start: 1,
          nst_5v5_counts_toi: 3000,
          nst_5v5_counts_xg_against: 2.4,
          nst_5v5_counts_goals_against: 2,
          nst_5v5_counts_gsaa: 0.7,
          nst_5v5_counts_saves: 22,
          nst_5v5_counts_shots_against: 24,
          nst_5v5_counts_hd_saves: 7,
          nst_5v5_counts_hd_shots_against: 8,
        },
        {
          player_id: 1,
          date: "2026-04-02",
          season_id: 20252026,
          team_id: 10, team_id_source: "wgo_team_abbreviation",
          player_name: "Goalie One",
          games_played: 1,
          games_started: 1,
          wins: 0,
          saves: 24,
          goals_against: 3,
          shots_against: 27,
          time_on_ice: 3600,
          quality_start: 0,
          nst_5v5_counts_toi: 3000,
          nst_5v5_counts_xg_against: 2.1,
          nst_5v5_counts_goals_against: 3,
          nst_5v5_counts_gsaa: -0.4,
          nst_5v5_counts_saves: 18,
          nst_5v5_counts_shots_against: 21,
          nst_5v5_counts_hd_saves: 5,
          nst_5v5_counts_hd_shots_against: 7,
        },
      ],
      "season",
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      playerId: 1,
      gamesPlayed: 2,
      gamesStarted: 2,
      saves: 52,
      shotsAgainst: 57,
      qualityStarts: 1,
      reallyBadStarts: 0,
      stealGames: 0,
      nst5v5Gsaa: 0.3,
      nst5v5Gsax: -0.5,
      nst5v5XgAgainst: 4.5,
      nst5v5Saves: 40,
      nst5v5ShotsAgainst: 45,
      nst5v5HighDangerSaves: 12,
      nst5v5HighDangerShotsAgainst: 15,
    });
    expect(rows[0].sourceWarnings).toEqual([]);
  });

  it("calculates next-set goalie metrics from verified NST fields and publishes pending contracts", () => {
    expect(
      calculateGoalieXgaPerShotAgainst({
        xgAgainst: 4.5,
        shotsAgainst: 45,
      }),
    ).toBe(0.1);
    expect(calculateGoalieValueSignal({ gsax: -0.5, gsaa: 0.3 })).toBe(-0.1);
    expect(
      calculateGoalieHighDangerSavePercentage({
        saves: 12,
        shotsAgainst: 15,
      }),
    ).toBe(0.8);
    expect(
      calculateGoalieRelativeSavePercentage({
        goalieSaves: 92,
        goalieShotsAgainst: 100,
        teamWithoutGoalieSaves: 83,
        teamWithoutGoalieShotsAgainst: 100,
      }),
    ).toBe(0.09);
    expect(GOALIE_SOURCE_PENDING_METRIC_CONTRACTS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metricKey: "under_pressure_profile",
          status: "source_pending",
          requiredFields: expect.arrayContaining([
            "pressure_bucket",
            "screen_or_traffic_label",
            "shot_result_save_or_goal",
          ]),
        }),
      ]),
    );
    expect(GOALIE_SOURCE_PENDING_METRIC_CONTRACTS).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metricKey: "relative_save_percentage" }),
      ]),
    );
  });

  it("builds same-team other-goalie relative save baselines with low-sample gating", () => {
    const [starter, backup, thinBaseline] = aggregateGoalieGameRows(
      [
        {
          player_id: 1,
          date: "2026-04-03",
          season_id: 20252026,
          team_id: 10, team_id_source: "wgo_team_abbreviation",
          player_name: "Starter",
          games_played: 1,
          games_started: 1,
          wins: 1,
          saves: 26,
          goals_against: 2,
          shots_against: 28,
          time_on_ice: 3600,
          quality_start: 1,
          nst_5v5_counts_toi: 3000,
          nst_5v5_counts_xg_against: 2,
          nst_5v5_counts_goals_against: 2,
          nst_5v5_counts_gsaa: 0.5,
          nst_5v5_counts_saves: 92,
          nst_5v5_counts_shots_against: 100,
        },
        {
          player_id: 2,
          date: "2026-04-02",
          season_id: 20252026,
          team_id: 10, team_id_source: "wgo_team_abbreviation",
          player_name: "Backup",
          games_played: 1,
          games_started: 1,
          wins: 0,
          saves: 22,
          goals_against: 5,
          shots_against: 27,
          time_on_ice: 3600,
          quality_start: 0,
          nst_5v5_counts_toi: 3000,
          nst_5v5_counts_xg_against: 3,
          nst_5v5_counts_goals_against: 5,
          nst_5v5_counts_gsaa: -1,
          nst_5v5_counts_saves: 83,
          nst_5v5_counts_shots_against: 100,
        },
        {
          player_id: 3,
          date: "2026-04-03",
          season_id: 20252026,
          team_id: 20, team_id_source: "wgo_team_abbreviation",
          player_name: "Thin Baseline",
          games_played: 1,
          games_started: 1,
          wins: 1,
          saves: 19,
          goals_against: 1,
          shots_against: 20,
          time_on_ice: 3600,
          quality_start: 1,
          nst_5v5_counts_toi: 3000,
          nst_5v5_counts_xg_against: 1,
          nst_5v5_counts_goals_against: 1,
          nst_5v5_counts_gsaa: 0.2,
          nst_5v5_counts_saves: 19,
          nst_5v5_counts_shots_against: 20,
        },
      ],
      "season",
    );
    const contexts = buildGoalieRelativeSaveContexts([
      starter,
      backup,
      thinBaseline,
    ]);

    expect(contexts.get(1)).toMatchObject({
      goalieSavePercentage: 0.92,
      teamWithoutGoalieSavePercentage: 0.83,
      relativeSavePercentage: 0.09,
      warnings: [],
    });
    expect(contexts.get(2)).toMatchObject({
      goalieSavePercentage: 0.83,
      teamWithoutGoalieSavePercentage: 0.92,
      relativeSavePercentage: -0.09,
      warnings: [],
    });
    expect(contexts.get(3)).toMatchObject({
      relativeSavePercentage: null,
      warnings: ["low_team_without_goalie_5v5_save_sample"],
    });
  });

  it("parses goalie matrix requests with conservative defaults", () => {
    const request = parseGoalieMatrixRequest({
      season: "20252026",
      metric: "really_bad_start_rate",
      window: "last10",
      goalie_role: "g1a_tandem_lead",
      team: "DAL",
      search: "Shesterkin",
      page_size: "25",
    });

    expect(request).toMatchObject({
      season: 20252026,
      metric: "really_bad_start_rate",
      window: "last10",
      role: "g1a_tandem_lead",
      team: "DAL",
      minStarts: 3,
      minShots: 100,
      search: "Shesterkin",
      page: 1,
      pageSize: 25,
    });
  });

  it("counts modern really bad starts from existing goalie game rows", () => {
    const rows = aggregateGoalieGameRows(
      [
        {
          player_id: 1,
          date: "2026-04-03",
          season_id: 20252026,
          team_id: 10, team_id_source: "wgo_team_abbreviation",
          player_name: "Goalie One",
          games_played: 1,
          games_started: 1,
          wins: 0,
          saves: 18,
          goals_against: 4,
          shots_against: 22,
          time_on_ice: 3600,
          quality_start: 0,
          nst_5v5_counts_toi: 3000,
          nst_5v5_counts_xg_against: 1.5,
          nst_5v5_counts_goals_against: 4,
          nst_5v5_counts_gsaa: -2,
          nst_5v5_counts_saves: 14,
          nst_5v5_counts_shots_against: 18,
        },
      ],
      "season",
    );

    expect(rows[0]).toMatchObject({
      gamesStarted: 1,
      reallyBadStarts: 1,
      nst5v5Gsax: -2.5,
    });
  });

  it("ranks lower-is-better goalie metrics with higher percentiles for lower raw values", () => {
    const ranks = rankGoalieMetricValues(
      [
        { id: 1, value: 0.1 },
        { id: 2, value: 0.1 },
        { id: 3, value: 0.3 },
        { id: 4, value: null },
      ],
      true,
    );

    expect(ranks.get(1)).toMatchObject({
      rank: 1,
      percentile: 75,
      qualifiedPeerCount: 3,
    });
    expect(ranks.get(2)).toMatchObject({
      rank: 1,
      percentile: 75,
      qualifiedPeerCount: 3,
    });
    expect(ranks.get(3)).toMatchObject({
      rank: 2,
      percentile: 0,
      qualifiedPeerCount: 3,
    });
    expect(ranks.has(4)).toBe(false);
  });

  it("keeps all verified starts in the role denominator without absence evidence", () => {
    const aggregates = aggregateGoalieGameRows(
      [
        {
          player_id: 1,
          date: "2026-04-03",
          season_id: 20252026,
          team_id: 10, team_id_source: "wgo_team_abbreviation",
          player_name: "Starter",
          games_played: 6,
          games_started: 6,
          wins: 4,
          saves: 150,
          goals_against: 12,
          shots_against: 162,
          time_on_ice: 21600,
          quality_start: 4,
          nst_5v5_counts_toi: 18000,
          nst_5v5_counts_xg_against: 11,
          nst_5v5_counts_goals_against: 12,
          nst_5v5_counts_gsaa: 1,
        },
        {
          player_id: 2,
          date: "2026-04-03",
          season_id: 20252026,
          team_id: 10, team_id_source: "wgo_team_abbreviation",
          player_name: "Backup",
          games_played: 3,
          games_started: 3,
          wins: 1,
          saves: 75,
          goals_against: 8,
          shots_against: 83,
          time_on_ice: 10800,
          quality_start: 1,
          nst_5v5_counts_toi: 9000,
          nst_5v5_counts_xg_against: 7,
          nst_5v5_counts_goals_against: 8,
          nst_5v5_counts_gsaa: -1,
        },
        {
          player_id: 3,
          date: "2026-04-03",
          season_id: 20252026,
          team_id: 10, team_id_source: "wgo_team_abbreviation",
          player_name: "Call Up",
          games_played: 1,
          games_started: 1,
          wins: 0,
          saves: 20,
          goals_against: 4,
          shots_against: 24,
          time_on_ice: 3600,
          quality_start: 0,
          nst_5v5_counts_toi: 3000,
          nst_5v5_counts_xg_against: 3,
          nst_5v5_counts_goals_against: 4,
          nst_5v5_counts_gsaa: -1,
        },
      ],
      "season",
    );

    const starter = buildGoalieRoleContextForTests({
      aggregate: aggregates.find((row) => row.playerId === 1)!,
      projection: null,
      aggregates,
    });
    const callUp = buildGoalieRoleContextForTests({
      aggregate: aggregates.find((row) => row.playerId === 3)!,
      projection: null,
      aggregates,
    });

    expect(starter).toMatchObject({
      deploymentBucket: "g1_starter",
      deploymentSource: "selected_window_team_start_share",
      rawStartShare: 0.6,
      adjustedStartShare: null,
      coreStartShare: 0.666667,
      coreGoalieIds: [1, 2],
      excludedTeamStarts: 0,
      roleConfidence: "medium",
    });
    expect(starter.roleNotes.join(" ")).toContain("No team starts are excluded");
    expect(callUp).toMatchObject({
      deploymentBucket: "g2_backup",
      deploymentSource: "selected_window_team_start_share",
      rawStartShare: 0.1,
      adjustedStartShare: null,
      coreStartShare: null,
      roleConfidence: "low",
    });
    expect(callUp.roleNotes.join(" ")).toContain("Core share is descriptive only");
  });

  describe("paged source reads", () => {
    beforeEach(() => {
      rangeCalls.length = 0;
      pagingFixture.rows = {};
      pagingFixture.omitOrder = null;
      clearGoalieMatrixSurfaceCachesForTests();
    });

    it("retains every goalie across a tied-date 1,000-row boundary", async () => {
      pagingFixture.rows.goalie_stats_unified = Array.from({ length: 1001 }, (_, index) => ({
        fixtureIndex: index, player_id: index + 1, player_name: `Goalie ${index + 1}`,
        date: "2026-04-16", season_id: 20252026, team_id: 1,
        games_played: 1, games_started: 1, saves: 29, goals_against: 1,
        shots_against: 30, time_on_ice: 3600,
      }));
      const request = parseGoalieMatrixRequest({ season: "20252026", window: "season" });
      const response = await buildGoalieMatrixSurface(request);
      expect(response.meta.totalRankedRows).toBe(1001);
      expect(response.rows.find((row) => row.entity.id === 1)?.sample.gamesPlayed).toBe(1);
      expect(rangeCalls.filter((call) => call.table === "goalie_stats_unified").map((call) => [call.from, call.to])).toEqual([[0, 999], [1000, 1999]]);

      pagingFixture.omitOrder = "player_id";
      clearGoalieMatrixSurfaceCachesForTests();
      const unstable = await buildGoalieMatrixSurface(request);
      expect(unstable.meta.totalRankedRows).toBe(1001);
      expect(unstable.rows.find((row) => row.entity.id === 1)?.sample.gamesPlayed).toBe(1);
      expect(unstable.rows.find((row) => row.entity.id === 1)?.warnings).toContain("partial_goalie_advanced_identity");
    });

    it("orders every paged source read by a unique key", async () => {
      await buildGoalieMatrixSurface(parseGoalieMatrixRequest({ season: "20252026" }));

      const ordersByTable = new Map(
        rangeCalls.map((call) => [call.table, call.orders.map((order) => order.key)]),
      );
      expect(Object.fromEntries(ordersByTable)).toEqual({
        goalie_stats_unified: ["date", "player_id"],
        wgo_goalie_stats: ["date", "game_id", "goalie_id"],
        games: ["date", "id"],
        wgo_team_stats: ["date", "game_id", "team_id"],
      });
    });
  });

  describe("matrix arithmetic and source completeness", () => {
    type SourceRow = Parameters<typeof aggregateGoalieGameRows>[0][number];
    const game = (overrides: Partial<SourceRow> = {}): SourceRow => ({
      player_id: 1, player_name: "Synthetic 1", team_id: 10, team_id_source: "wgo_team_abbreviation",
      date: "2026-04-16", season_id: 20252026,
      games_played: 1, games_started: 1, wins: 1,
      saves: 27, shots_against: 30, goals_against: 3,
      time_on_ice: 3600, quality_start: 1,
      nst_5v5_counts_toi: 3000, nst_5v5_counts_gsaa: 1,
      nst_5v5_counts_xg_against: 4, nst_5v5_counts_goals_against: 3,
      nst_5v5_counts_saves: 27, nst_5v5_counts_shots_against: 30,
      nst_5v5_counts_hd_saves: 7, nst_5v5_counts_hd_shots_against: 10,
      ...overrides,
    });
    const request = () => parseGoalieMatrixRequest({
      season: "20252026", min_starts: "0", min_shots: "0", page_size: "50",
    });
    const loadPlayer = async (rows: SourceRow[]) => {
      pagingFixture.rows.goalie_stats_unified = rows;
      pagingFixture.rows.games = [...new Set(rows.map((row) => `${row.team_id}:${row.date}`))]
        .map((key, index) => {
          const [teamId, date] = key.split(":");
          return { id: index + 1, date, seasonId: 20252026, type: 2, homeTeamId: Number(teamId), awayTeamId: 999 };
        });
      const result = await buildGoalieMatrixSurface(request());
      return result.rows.find((row) => row.entity.id === 1)!;
    };

    beforeEach(() => {
      rangeCalls.length = 0;
      pagingFixture.rows = {};
      pagingFixture.omitOrder = null;
      clearGoalieMatrixSurfaceCachesForTests();
    });

    it("matches independently calculated pooled arithmetic on unequal games", async () => {
      const row = await loadPlayer([
        game({
          date: "2026-04-15", saves: 9, shots_against: 10, goals_against: 1,
          quality_start: 1, wins: 1, nst_5v5_counts_toi: 600,
          nst_5v5_counts_gsaa: 0.5, nst_5v5_counts_xg_against: 3,
          nst_5v5_counts_goals_against: 1, nst_5v5_counts_saves: 9,
          nst_5v5_counts_shots_against: 10, nst_5v5_counts_hd_saves: 2,
          nst_5v5_counts_hd_shots_against: 3,
        }),
        game({
          saves: 35, shots_against: 40, goals_against: 5,
          quality_start: 0, wins: 0, nst_5v5_counts_toi: 1800,
          nst_5v5_counts_gsaa: 1.5, nst_5v5_counts_xg_against: 6,
          nst_5v5_counts_goals_against: 5, nst_5v5_counts_saves: 35,
          nst_5v5_counts_shots_against: 40, nst_5v5_counts_hd_saves: 3,
          nst_5v5_counts_hd_shots_against: 7,
        }),
      ]);

      // Direct arithmetic oracle: 44/50 saves, 9/50 xGA/shot,
      // 2 goals / 2400 seconds * 3600, and 9 - 6 GSAx.
      expect(row.metrics.save_percentage.rawValue).toBe(0.88);
      expect(row.metrics.xga_per_shot_against.rawValue).toBe(0.18);
      expect(row.metrics.gsaa_per_60.rawValue).toBe(3);
      expect(row.metrics.gsax.rawValue).toBe(3);
      expect(row.metrics.goalie_value_signal.rawValue).toBe(2.5);
      expect(row.metrics.high_danger_save_percentage.rawValue).toBe(0.5);
      expect(row.metrics.quality_start_pct.rawValue).toBe(0.5);
      expect(row.metrics.really_bad_start_rate.rawValue).toBe(0);
      expect(row.metrics.steal_rate.rawValue).toBe(0.5);
    });

    it.each<{
      name: string;
      overrides: Partial<SourceRow>[];
      metrics: Array<keyof Awaited<ReturnType<typeof loadPlayer>>["metrics"]>;
      warning: string;
    }>([
      {
        name: "disjoint official saves and shots",
        overrides: [{ saves: null }, { shots_against: null }],
        metrics: ["save_percentage"], warning: "partial_wgo_save_source",
      },
      {
        name: "disjoint NST xGA and shots",
        overrides: [{ nst_5v5_counts_xg_against: null }, { nst_5v5_counts_shots_against: null }],
        metrics: ["xga_per_shot_against"], warning: "partial_nst_5v5_shot_quality_source",
      },
      {
        name: "disjoint NST saves and shots",
        overrides: [{ nst_5v5_counts_saves: null }, { nst_5v5_counts_shots_against: null }],
        metrics: ["relative_save_percentage"], warning: "partial_nst_5v5_relative_save_source",
      },
      {
        name: "missing GSAA in a game whose TOI is present",
        overrides: [{}, { nst_5v5_counts_gsaa: null }],
        metrics: ["gsaa_per_60", "goalie_value_signal"], warning: "partial_nst_5v5_gsaa_source",
      },
      {
        name: "missing TOI in a game whose GSAA is present",
        overrides: [{}, { nst_5v5_counts_toi: null }],
        metrics: ["gsaa_per_60", "goalie_value_signal"], warning: "partial_nst_5v5_gsaa_source",
      },
      {
        name: "partial GSAx coverage",
        overrides: [{}, { nst_5v5_counts_xg_against: null }],
        metrics: ["gsax", "goalie_value_signal", "really_bad_start_rate", "steal_rate"],
        warning: "partial_nst_5v5_gsax_source",
      },
      {
        name: "missing high-danger denominator",
        overrides: [{}, { nst_5v5_counts_hd_shots_against: null }],
        metrics: ["high_danger_save_percentage"], warning: "partial_nst_5v5_high_danger_source",
      },
      {
        name: "unknown start status",
        overrides: [{}, { games_started: null }],
        metrics: ["quality_start_pct", "really_bad_start_rate", "steal_rate"],
        warning: "partial_goalie_start_source",
      },
      {
        name: "unknown quality-start classification",
        overrides: [{}, { quality_start: null }],
        metrics: ["quality_start_pct"], warning: "partial_quality_start_source",
      },
      {
        name: "unknown win outcome",
        overrides: [{}, { wins: null }],
        metrics: ["steal_rate"], warning: "partial_goalie_steal_source",
      },
      {
        name: "impossible official save count",
        overrides: [{}, { saves: 31, shots_against: 30 }],
        metrics: ["save_percentage"], warning: "partial_wgo_save_source",
      },
      {
        name: "impossible NST save count",
        overrides: [{}, { nst_5v5_counts_saves: 31, nst_5v5_counts_shots_against: 30 }],
        metrics: ["relative_save_percentage"], warning: "partial_nst_5v5_relative_save_source",
      },
    ])("leaves $name unavailable and unranked", async ({ overrides, metrics, warning }) => {
      const row = await loadPlayer([
        ...overrides.map((override, index) => game({ date: `2026-04-${15 + index}`, ...override })),
        game({
          player_id: 2, games_started: 0, nst_5v5_counts_saves: 90,
          nst_5v5_counts_shots_against: 100,
        }),
      ]);
      for (const metric of metrics) {
        expect(row.metrics[metric]).toMatchObject({
          rawValue: null, formattedValue: null, rank: null, percentile: null,
        });
      }
      expect(row.warnings).toContain(warning);
    });

    it("rejects a partial other-goalie baseline instead of silently dropping its missing game", async () => {
      const row = await loadPlayer([
        game({ nst_5v5_counts_saves: 92, nst_5v5_counts_shots_against: 100 }),
        game({ player_id: 2, date: "2026-04-15", nst_5v5_counts_saves: 83, nst_5v5_counts_shots_against: 100 }),
        game({ player_id: 2, games_started: 0, nst_5v5_counts_saves: null, nst_5v5_counts_shots_against: 100 }),
      ]);
      expect(row.metrics.relative_save_percentage.rawValue).toBeNull();
      expect(row.metrics.relative_save_percentage.rank).toBeNull();
      expect(row.warnings).toContain("partial_team_without_goalie_5v5_save_source");
    });

    it("preserves genuine zero results and signed saved-goals values", async () => {
      const row = await loadPlayer([game({
        saves: 0, shots_against: 4, goals_against: 4, quality_start: 0, wins: 0,
        nst_5v5_counts_toi: 3600, nst_5v5_counts_gsaa: -2,
        nst_5v5_counts_xg_against: 1, nst_5v5_counts_goals_against: 4,
        nst_5v5_counts_saves: 0, nst_5v5_counts_shots_against: 4,
        nst_5v5_counts_hd_saves: 0, nst_5v5_counts_hd_shots_against: 4,
      })]);
      expect(row.metrics.save_percentage.rawValue).toBe(0);
      expect(row.metrics.high_danger_save_percentage.rawValue).toBe(0);
      expect(row.metrics.quality_start_pct.rawValue).toBe(0);
      expect(row.metrics.gsaa_per_60.rawValue).toBe(-2);
      expect(row.metrics.gsax.rawValue).toBe(-3);
      expect(row.metrics.goalie_value_signal.rawValue).toBe(-2.5);
      expect(row.metrics.really_bad_start_rate.rawValue).toBe(1);
    });

    it("does not treat a relief appearance as an unclassified start", async () => {
      const row = await loadPlayer([
        game({ date: "2026-04-15" }),
        game({
          games_started: 0, quality_start: null, wins: null,
          nst_5v5_counts_xg_against: null, nst_5v5_counts_goals_against: null,
        }),
      ]);
      expect(row.metrics.quality_start_pct.rawValue).toBe(1);
      expect(row.metrics.really_bad_start_rate.rawValue).toBe(0);
      expect(row.metrics.steal_rate.rawValue).toBe(1);
      expect(row.metrics.gsax.rawValue).toBeNull();
    });

    it("preserves the goalie peer pool and ranks across search and pagination", async () => {
      pagingFixture.rows.goalie_stats_unified = Array.from({ length: 12 }, (_, index) =>
        game({ player_id: index + 1, player_name: `Synthetic ${index + 1}`, saves: 60 + index, shots_against: 100 }),
      );
      const all = await buildGoalieMatrixSurface(request());
      const first = await buildGoalieMatrixSurface({ ...request(), pageSize: 5 });
      const second = await buildGoalieMatrixSurface({ ...request(), pageSize: 5, page: 2 });
      const searched = await buildGoalieMatrixSurface({ ...request(), search: "Synthetic 3" });
      const oracle = all.rows.find((row) => row.entity.id === 3)!;

      expect(all.rows).toHaveLength(12);
      expect([...first.rows, ...second.rows].map((row) => row.entity.id)).toEqual(
        all.rows.slice(0, 10).map((row) => row.entity.id),
      );
      expect(new Set([...first.rows, ...second.rows].map((row) => row.entity.id)).size).toBe(10);
      expect(searched.rows).toHaveLength(1);
      expect(searched.rows[0].metrics.save_percentage).toEqual(oracle.metrics.save_percentage);
      expect(oracle.metrics.save_percentage).toMatchObject({ rank: 10, qualifiedPeerCount: 12 });
      expect(oracle.metrics.save_percentage.percentile).toBeCloseTo(200 / 11, 3);
    });
  });

  describe("verified team workloads and traded-goalie samples", () => {
    type SourceRow = Parameters<typeof aggregateGoalieGameRows>[0][number];
    const game = (
      playerId: number, teamId: number, day: number,
      overrides: Partial<SourceRow> = {},
    ): SourceRow => ({
      player_id: playerId, player_name: `Goalie ${playerId}`, team_id: teamId,
      team_id_source: "wgo_team_abbreviation",
      date: `2026-04-${String(day).padStart(2, "0")}`, season_id: 20252026,
      games_played: 1, games_started: 1, wins: 1,
      saves: 90, shots_against: 100, goals_against: 10, time_on_ice: 3600,
      quality_start: 1, nst_5v5_counts_toi: 3000, nst_5v5_counts_gsaa: 1,
      nst_5v5_counts_xg_against: 11, nst_5v5_counts_goals_against: 10,
      nst_5v5_counts_saves: 90, nst_5v5_counts_shots_against: 100,
      nst_5v5_counts_hd_saves: 7, nst_5v5_counts_hd_shots_against: 10,
      ...overrides,
    });
    const schedule = (teamId: number, day: number, id = teamId * 100 + day) => ({
      id, date: `2026-04-${String(day).padStart(2, "0")}`,
      seasonId: 20252026, type: 2, homeTeamId: teamId, awayTeamId: 999,
    });
    const request = () => parseGoalieMatrixRequest({
      season: "20252026", min_starts: "0", min_shots: "0", page_size: "50",
    });
    const byId = (result: Awaited<ReturnType<typeof buildGoalieMatrixSurface>>, id: number) =>
      result.rows.find((row) => row.entity.id === id)!;
    const tradeFixture = () => {
      pagingFixture.rows.goalie_stats_unified = [
        game(1, 10, 1, { saves: 9, shots_against: 10, nst_5v5_counts_saves: 18, nst_5v5_counts_shots_against: 20 }),
        game(1, 10, 2, { saves: 16, shots_against: 20, nst_5v5_counts_saves: 32, nst_5v5_counts_shots_against: 40 }),
        game(3, 10, 3, { nst_5v5_counts_saves: 80 }),
        // The new team's backup played before the incoming goalie's debut.
        game(2, 20, 4, { nst_5v5_counts_saves: 51, nst_5v5_counts_shots_against: 60 }),
        game(1, 20, 5, { saves: 54, shots_against: 60, nst_5v5_counts_saves: 54, nst_5v5_counts_shots_against: 60 }),
      ];
      pagingFixture.rows.games = [schedule(10, 1), schedule(10, 2), schedule(10, 3), schedule(20, 4), schedule(20, 5)];
      pagingFixture.rows.teams = [
        { id: 10, abbreviation: "OLD", name: "Old Team" },
        { id: 20, abbreviation: "NEW", name: "New Team" },
      ];
    };

    beforeEach(() => {
      rangeCalls.length = 0;
      pagingFixture.rows = {};
      pagingFixture.omitOrder = null;
      clearGoalieMatrixSurfaceCachesForTests();
    });

    it.each(["wgo_game_team", "wgo_team_abbreviation", "wgo_season_team_alias"])(
      "accepts the resolver's verified %s provenance for both player team and team context", async (source) => {
        tradeFixture();
        for (const row of pagingFixture.rows.goalie_stats_unified) row.team_id_source = source;
        const result = await buildGoalieMatrixSurface(request());
        expect(byId(result, 1).team.id).toBe(20);
        expect(byId(result, 1).role.rawStartShare).toBe(0.5);
        expect(byId(result, 1).metrics.relative_save_percentage.rawValue).toBe(0.05);
        expect(byId(result, 3).role.rawStartShare).toBe(0.333333);
        expect(result.meta.sourceWarnings).not.toContain("partial_goalie_team_attribution");
        expect(result.meta.sourceWarnings).not.toContain("partial_goalie_team_game_coverage");
      },
    );

    it.each(["players_team_id_fallback", "unmapped", "future_unverified_source", null, undefined])(
      "keeps %s provenance unavailable rather than trusting a non-null team ID", async (source) => {
        tradeFixture();
        for (const row of pagingFixture.rows.goalie_stats_unified) row.team_id_source = source;
        const row = byId(await buildGoalieMatrixSurface(request()), 1);
        expect(row.team.id).toBeNull();
        expect(row.role.rawStartShare).toBeNull();
        expect(row.metrics.relative_save_percentage.rawValue).toBeNull();
        expect(row.metrics.save_percentage.rawValue).toBe(0.877778);
        expect(row.warnings).toContain("partial_goalie_team_attribution");
      },
    );

    it("combines verified game-team and season-alias provenance in the same team window", async () => {
      tradeFixture();
      pagingFixture.rows.goalie_stats_unified[3].team_id_source = "wgo_season_team_alias";
      pagingFixture.rows.goalie_stats_unified[4].team_id_source = "wgo_game_team";
      const row = byId(await buildGoalieMatrixSurface(request()), 1);
      expect(row.team.id).toBe(20);
      expect(row.role.rawStartShare).toBe(0.5);
      expect(row.metrics.relative_save_percentage.rawValue).toBe(0.05);
    });

    const official = (id: number, day: number, overrides: Record<string, unknown> = {}) => ({
      goalie_id: id, goalie_name: `Official ${id}`, game_id: 1000 + day,
      date: `2026-04-${String(day).padStart(2, "0")}`, season_id: 20252026,
      team_abbreviation: "T10", home_road: "H", games_played: 1,
      games_started: 1, wins: 1, saves: 27, shots_against: 30,
      goals_against: 3, time_on_ice: 3600, quality_start: 1, ...overrides,
    });
    const officialFixture = () => {
      pagingFixture.rows.teams = [{ id: 10, abbreviation: "T10", name: "Team 10" }];
      pagingFixture.rows.games = [schedule(10, 1), schedule(10, 2)];
      pagingFixture.rows.wgo_team_stats = [];
    };

    it("keeps official relief goalies with no advanced row and qualifies them from official counts", async () => {
      officialFixture();
      pagingFixture.rows.goalie_stats_unified = [game(1, 10, 1)];
      pagingFixture.rows.wgo_goalie_stats = [official(1, 1), official(2, 1, { games_started: 0, saves: 8, shots_against: 10 })];
      const result = await buildGoalieMatrixSurface(request());
      expect(result.rows.map((row) => row.entity.id).sort()).toEqual([1, 2]);
      const relief = byId(result, 2);
      expect(relief.sample).toMatchObject({ gamesPlayed: 1, gamesStarted: 0, shotsAgainst: 10 });
      expect(relief.metrics.save_percentage).toMatchObject({ rawValue: 0.8, rank: 2, qualifiedPeerCount: 2 });
      expect(relief.metrics.gsax.rawValue).toBeNull();
      expect(relief.role.rawStartShare).toBe(0);
      expect(relief.warnings).toContain("partial_goalie_advanced_appearance_source");
    });

    it("uses fresh official pooled totals when the advanced materialization is stale", async () => {
      officialFixture();
      pagingFixture.rows.goalie_stats_unified = [game(1, 10, 1, { saves: 1, shots_against: 2 })];
      pagingFixture.rows.wgo_goalie_stats = [official(1, 1, { saves: 9, shots_against: 10 }), official(1, 2, { saves: 36, shots_against: 40 })];
      const result = await buildGoalieMatrixSurface(request());
      const row = byId(result, 1);
      expect(result.meta.latestAvailableSnapshotDate).toBe("2026-04-02");
      expect(row.sample).toMatchObject({ gamesPlayed: 2, gamesStarted: 2, shotsAgainst: 50 });
      expect(row.metrics.save_percentage.rawValue).toBe(0.9); // (9 + 36) / (10 + 40)
      expect(row.metrics.gsax).toMatchObject({ rawValue: null, rank: null });
    });

    it("does not let phantom advanced players enter the peer cohort", async () => {
      officialFixture();
      pagingFixture.rows.goalie_stats_unified = [game(1, 10, 1), game(99, 10, 1, { saves: 100 })];
      pagingFixture.rows.wgo_goalie_stats = [official(1, 1)];
      const result = await buildGoalieMatrixSurface(request());
      expect(result.rows.map((row) => row.entity.id)).toEqual([1]);
      expect(result.rows[0].metrics.save_percentage).toMatchObject({ rawValue: 0.9, rank: 1, qualifiedPeerCount: 1 });
      expect(result.meta.sourceWarnings).toContain("partial_goalie_population_reconciliation");
    });

    it("withholds relative-save ranks when another advanced appearance cannot be reconciled", async () => {
      officialFixture();
      pagingFixture.rows.goalie_stats_unified = [game(1, 10, 1), game(2, 10, 2), game(99, 10, 2)];
      pagingFixture.rows.wgo_goalie_stats = [official(1, 1), official(2, 2)];
      const result = await buildGoalieMatrixSurface(request());
      expect(result.rows.map((row) => row.entity.id).sort()).toEqual([1, 2]);
      for (const row of result.rows) {
        expect(row.metrics.save_percentage.rawValue).toBe(0.9);
        expect(row.metrics.relative_save_percentage).toMatchObject({ rawValue: null, rank: null });
      }
      expect(result.meta.sourceWarnings).toContain("partial_goalie_relative_population");
    });

    it("makes a wholly missing goalie date visible through completed-team coverage", async () => {
      officialFixture();
      pagingFixture.rows.goalie_stats_unified = [game(1, 10, 1)];
      pagingFixture.rows.wgo_goalie_stats = [official(1, 1)];
      pagingFixture.rows.wgo_team_stats = [{ game_id: 1002, date: "2026-04-02", season_id: 20252026, team_id: 10 }];
      const result = await buildGoalieMatrixSurface(request());
      expect(result.meta.latestAvailableSnapshotDate).toBe("2026-04-02");
      expect(result.meta.sourceWarnings).toContain("partial_goalie_official_game_coverage");
      expect(byId(result, 1).metrics.start_share).toMatchObject({ rawValue: null, rank: null });
    });

    it("excludes same-season preseason and playoff appearances from values and peer counts", async () => {
      officialFixture();
      pagingFixture.rows.games.push({ ...schedule(10, 3), type: 1 }, { ...schedule(10, 4), type: 3 });
      pagingFixture.rows.goalie_stats_unified = [game(1, 10, 1), game(2, 10, 3), game(3, 10, 4)];
      pagingFixture.rows.wgo_goalie_stats = [official(1, 1), official(2, 3), official(3, 4)];
      const result = await buildGoalieMatrixSurface(request());
      expect(result.rows.map((row) => row.entity.id)).toEqual([1]);
      expect(result.rows[0].metrics.save_percentage.qualifiedPeerCount).toBe(1);
    });

    it("fails explicitly for duplicate official player/game identity", async () => {
      officialFixture();
      pagingFixture.rows.goalie_stats_unified = [];
      pagingFixture.rows.wgo_goalie_stats = [official(1, 1), official(1, 1)];
      await expect(buildGoalieMatrixSurface(request())).rejects.toThrow("Duplicate official goalie player/game appearance");
    });

    it("keeps two same-date games distinct without doubling their advanced enrichment", async () => {
      officialFixture();
      pagingFixture.rows.games = [schedule(10, 1), { ...schedule(10, 1), id: 1002 }];
      pagingFixture.rows.goalie_stats_unified = [game(1, 10, 1)];
      pagingFixture.rows.wgo_goalie_stats = [official(1, 1), official(1, 1, { game_id: 1002 })];
      const row = byId(await buildGoalieMatrixSurface(request()), 1);
      expect(row.sample.gamesPlayed).toBe(2);
      expect(row.metrics.save_percentage.rawValue).toBe(0.9);
      expect(row.metrics.gsax.rawValue).toBeNull();
      expect(row.role.rawStartShare).toBe(1);
    });

    it.each([
      { table: "wgo_goalie_stats", count: 10_000, message: "Official goalie appearance read exceeded" },
      { table: "wgo_team_stats", count: 5_000, message: "Completed goalie team-game read exceeded" },
    ])("fails closed at the $table read ceiling instead of returning a truncated cohort", async ({ table, count, message }) => {
      pagingFixture.rows = { goalie_stats_unified: [], games: [], teams: [], wgo_goalie_stats: [], wgo_team_stats: [] };
      pagingFixture.rows[table] = Array.from({ length: count }, (_, index) => ({
        ...official(index + 1, 1), team_id: index + 1,
      }));
      await expect(buildGoalieMatrixSurface(request())).rejects.toThrow(message);
      expect(rangeCalls.filter((call) => call.table === table)).toHaveLength(count / 1000);
    });

    it("keeps an empty official inventory explicit despite retained materialized rows", async () => {
      officialFixture();
      pagingFixture.rows.goalie_stats_unified = [game(1, 10, 1)];
      pagingFixture.rows.wgo_goalie_stats = [];
      const result = await buildGoalieMatrixSurface(request());
      expect(result.rows).toEqual([]);
      expect(result.meta.sourceWarnings).toContain("partial_goalie_population_reconciliation");
    });

    it("retains cross-team performance while attributing each start and relative-save sample to its actual team", async () => {
      tradeFixture();
      const result = await buildGoalieMatrixSurface(request());
      const incoming = byId(result, 1);
      // Player performance: (9 + 16 + 54) / (10 + 20 + 60).
      expect(incoming.sample.gamesStarted).toBe(3);
      expect(incoming.metrics.save_percentage.rawValue).toBe(0.877778);
      // New team: one start of two, not three of four (75%).
      expect(incoming.role.rawStartShare).toBe(0.5);
      expect(incoming.metrics.start_share.rawValue).toBe(0.5);
      expect(incoming.metrics.relative_save_percentage.rawValue).toBe(0.05); // 54/60 - 51/60
      expect(byId(result, 2).metrics.relative_save_percentage.rawValue).toBe(-0.05);
      // The former team keeps the departed goalie's two starts and 50/60 saves.
      expect(byId(result, 3).role.rawStartShare).toBe(0.333333);
      expect(byId(result, 3).metrics.relative_save_percentage.rawValue).toBe(-0.033333); // 80/100 - 50/60
    });

    it("filters on the latest verified team without truncating history or relabeling departed players", async () => {
      tradeFixture();
      const all = await buildGoalieMatrixSurface(request());
      const currentTeam = await buildGoalieMatrixSurface({ ...request(), team: "NEW" });
      const formerTeam = await buildGoalieMatrixSurface({ ...request(), team: "10" });
      expect(currentTeam.rows.map((row) => row.entity.id).sort()).toEqual([1, 2]);
      expect(formerTeam.rows.map((row) => row.entity.id)).toEqual([3]);
      expect(byId(currentTeam, 1).sample).toEqual(byId(all, 1).sample);
      expect(byId(currentTeam, 1).role).toEqual(byId(all, 1).role);
      expect(byId(currentTeam, 1).metrics.save_percentage.rawValue).toBe(0.877778);
      expect(byId(formerTeam, 3).role.rawStartShare).toBe(0.333333);
      expect(rangeCalls.filter((call) => call.table === "goalie_stats_unified")
        .every((call) => call.filters.every((filter) => filter.key !== "team_id"))).toBe(true);
    });

    it("uses one last-five team calendar instead of combining each goalie's last-five appearances", async () => {
      pagingFixture.rows.goalie_stats_unified = Array.from({ length: 10 }, (_, index) => {
        const day = index + 1;
        const player = [6, 7, 9, 10].includes(day) ? 1 : 2;
        return game(player, 10, day, { nst_5v5_counts_saves: day <= 5 ? 50 : player === 1 ? 90 : 80 });
      });
      pagingFixture.rows.games = Array.from({ length: 10 }, (_, index) => schedule(10, index + 1));
      const result = await buildGoalieMatrixSurface({ ...request(), window: "last5" });
      expect(byId(result, 1).sample.gamesStarted).toBe(4);
      expect(byId(result, 2).sample.gamesStarted).toBe(5);
      expect(byId(result, 1).role.rawStartShare).toBe(0.8); // 4/5 team starts
      expect(byId(result, 2).role.rawStartShare).toBe(0.2); // 1/5 team starts
      expect(byId(result, 1).metrics.relative_save_percentage.rawValue).toBe(0.1); // 360/400 - 80/100
      expect(byId(result, 2).metrics.relative_save_percentage.rawValue).toBe(-0.1);
    });

    it("includes relief shots but counts only the starter in team workload", async () => {
      pagingFixture.rows.goalie_stats_unified = [
        game(1, 10, 1), game(2, 10, 2, { nst_5v5_counts_saves: 80 }),
        game(1, 10, 2, { games_started: 0, quality_start: null, nst_5v5_counts_saves: 45, nst_5v5_counts_shots_against: 50 }),
      ];
      pagingFixture.rows.games = [schedule(10, 1), schedule(10, 2)];
      const row = byId(await buildGoalieMatrixSurface(request()), 1);
      expect(row.sample).toMatchObject({ gamesPlayed: 2, gamesStarted: 1 });
      expect(row.role.rawStartShare).toBe(0.5);
      expect(row.metrics.relative_save_percentage.rawValue).toBe(0.1); // 135/150 - 80/100
    });

    it.each(["missing game", "unknown start", "two starters", "ambiguous team date", "roster fallback"])(
      "withholds team metrics for %s without discarding individual performance", async (problem) => {
        tradeFixture();
        if (problem === "missing game") pagingFixture.rows.games.push(schedule(20, 3));
        if (problem === "unknown start") pagingFixture.rows.goalie_stats_unified[3].games_started = null;
        if (problem === "two starters") pagingFixture.rows.goalie_stats_unified.push(game(4, 20, 4));
        if (problem === "ambiguous team date") pagingFixture.rows.games.push(schedule(20, 4, 9999));
        if (problem === "roster fallback") pagingFixture.rows.goalie_stats_unified[3].team_id_source = "players_team_id_fallback";
        const row = byId(await buildGoalieMatrixSurface(request()), 1);
        expect(row.metrics.save_percentage.rawValue).toBe(0.877778);
        expect(row.role.rawStartShare).toBeNull();
        for (const metric of ["start_share", "relative_save_percentage"] as const) {
          expect(row.metrics[metric]).toMatchObject({ rawValue: null, rank: null, percentile: null });
        }
        expect(row.warnings).toContain("partial_goalie_team_game_coverage");
      },
    );

    it("does not let missing old-team NST inputs invalidate a complete new-team relative-save sample", async () => {
      tradeFixture();
      pagingFixture.rows.goalie_stats_unified[0].nst_5v5_counts_saves = null;
      const row = byId(await buildGoalieMatrixSurface(request()), 1);
      expect(row.metrics.relative_save_percentage.rawValue).toBe(0.05);
      expect(row.role.rawStartShare).toBe(0.5);
      expect(row.warnings).not.toContain("partial_nst_5v5_relative_save_source");
    });

    it("reports zero selected-window starts when the goalie last appeared before the team's last five games", async () => {
      pagingFixture.rows.goalie_stats_unified = [game(2, 10, 1),
        ...Array.from({ length: 5 }, (_, index) => game(1, 10, index + 2))];
      pagingFixture.rows.games = Array.from({ length: 6 }, (_, index) => schedule(10, index + 1));
      const row = byId(await buildGoalieMatrixSurface({ ...request(), window: "last5" }), 2);
      expect(row.sample.gamesStarted).toBe(1);
      expect(row.role.rawStartShare).toBe(0);
      expect(row.metrics.start_share.rawValue).toBe(0);
      expect(row.metrics.relative_save_percentage.rawValue).toBeNull();
    });

    it("does not assign a historical team from current player metadata", async () => {
      tradeFixture();
      pagingFixture.rows.goalie_stats_unified[4].team_id_source = "players_team_id_fallback";
      const row = byId(await buildGoalieMatrixSurface(request()), 1);
      expect(row.team.id).toBeNull();
      expect(row.metrics.save_percentage.rawValue).toBe(0.877778);
      expect(row.role.rawStartShare).toBeNull();
      expect(row.warnings).toContain("partial_goalie_team_attribution");
    });

    it("rejects projections from the old team while preserving a matching-team projection", async () => {
      tradeFixture();
      pagingFixture.rows.goalie_start_projections = [{
        player_id: 1, team_id: 10, game_date: "2026-04-05", game_id: 100,
        season_start_pct: 0.95, l10_start_pct: 0.9, start_probability: 1,
        projected_gsaa_per_60: 3, confirmed_status: true,
      }];
      const oldTeam = byId(await buildGoalieMatrixSurface(request()), 1);
      expect(oldTeam.metrics.start_share.rawValue).toBe(0.5);
      expect(oldTeam.role).toMatchObject({ seasonStartShare: null, startShareLast10: null, startProbability: null, confirmedStatus: null });
      expect(oldTeam.warnings).toContain("mismatched_team_start_projection");
      pagingFixture.rows.goalie_start_projections[0].team_id = 20;
      clearGoalieMatrixSurfaceCachesForTests();
      const matching = byId(await buildGoalieMatrixSurface(request()), 1);
      expect(matching.metrics.start_share.rawValue).toBe(0.95);
      expect(matching.role.deploymentSource).toBe("goalie_start_projections.season_start_pct");
    });

    it("keeps the team denominator and relative-save sample invariant across search and pagination", async () => {
      tradeFixture();
      const all = await buildGoalieMatrixSurface(request());
      const search = await buildGoalieMatrixSurface({ ...request(), search: "Goalie 1" });
      const page = await buildGoalieMatrixSurface({ ...request(), pageSize: 1, page: all.rows.findIndex((row) => row.entity.id === 1) + 1 });
      for (const result of [search, page]) {
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].role).toEqual(byId(all, 1).role);
        expect(result.rows[0].metrics).toEqual(byId(all, 1).metrics);
      }
    });

    it("isolates the regular-season schedule and source rows at the requested date", async () => {
      tradeFixture();
      pagingFixture.rows.games.push(
        { ...schedule(20, 2), seasonId: 20242025 },
        { ...schedule(20, 3), type: 3 }, schedule(20, 6),
      );
      pagingFixture.rows.goalie_stats_unified.push(game(2, 20, 6));
      const result = await buildGoalieMatrixSurface({ ...request(), asOfDate: "2026-04-05" });
      expect(byId(result, 1).role.rawStartShare).toBe(0.5);
      const read = rangeCalls.find((call) => call.table === "games")!;
      expect(read.orders.map((order) => order.key)).toEqual(["date", "id"]);
      expect(read.filters).toEqual(expect.arrayContaining([
        { method: "eq", key: "seasonId", value: 20252026 },
        { method: "lte", key: "date", value: "2026-04-05" },
      ]));
      expect(rangeCalls.find((call) => call.table === "goalie_stats_unified")?.columns).toContain("team_id_source");
    });
  });
});
