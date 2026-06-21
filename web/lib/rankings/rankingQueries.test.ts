import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryState = {
  table: string;
  selectFields: string | null;
  filters: Record<string, unknown>;
  rangeFrom: number | null;
  rangeTo: number | null;
};

const { queryCalls, scenario, supabaseMock } = vi.hoisted(() => {
  const queryCalls: QueryState[] = [];
  const scenario = {
    entityRows: [] as Array<Record<string, unknown>>,
    paginatedRows: [] as Array<Record<string, unknown>>,
  };

  function buildRollingRow(playerId: number, overrides: Record<string, unknown> = {}) {
    return {
      player_id: playerId,
      season: 20252026,
      strength_state: "all",
      team_id: 10,
      line_combo_group: "forward",
      line_combo_slot: 1,
      pp_unit: null,
      games_played: 5,
      season_games_played: 5,
      toi_seconds_total_last5: 600,
      ...overrides,
    };
  }

  function requestedDates(state: QueryState) {
    const value = state.filters.game_date;
    return Array.isArray(value) ? value : value == null ? [] : [value];
  }

  function resolveQuery(state: QueryState) {
    const requestedMetricKeys = Array.isArray(state.filters.metric_key)
      ? state.filters.metric_key
      : state.filters.metric_key == null
        ? null
        : [state.filters.metric_key];
    const matchingEntityRows = scenario.entityRows.filter(
      (row) =>
        row.metric_key == null ||
        requestedMetricKeys == null ||
        requestedMetricKeys.includes(row.metric_key),
    );
    if (
      state.table === "entity_metric_rankings" &&
      state.selectFields === "snapshot_date"
    ) {
      return {
        data:
          matchingEntityRows.length > 0
            ? [{ snapshot_date: "2026-04-16" }]
            : [],
        error: null,
      };
    }

    if (state.table === "entity_metric_rankings") {
      const from = state.rangeFrom ?? 0;
      const to = state.rangeTo ?? matchingEntityRows.length - 1;
      return {
        data: matchingEntityRows.slice(from, to + 1),
        error: null,
      };
    }

    if (state.table === "games") {
      return {
        data: [
          { date: "2026-04-16" },
          { date: "2026-04-16" },
          { date: "2026-04-11" },
        ],
        error: null,
      };
    }

    if (
      state.table === "rolling_player_game_metrics" &&
      state.selectFields === "game_date"
    ) {
      return {
        data: [{ game_date: "2026-04-16" }],
        error: null,
      };
    }

    if (state.table === "rolling_player_game_metrics") {
      const dates = requestedDates(state);
      if (
        scenario.paginatedRows.length > 0 &&
        dates.includes("2026-04-16")
      ) {
        const from = state.rangeFrom ?? 0;
        const to = state.rangeTo ?? scenario.paginatedRows.length - 1;
        return {
          data: scenario.paginatedRows.slice(from, to + 1),
          error: null,
        };
      }

      const baseRow = buildRollingRow(1);
      if (dates.includes("2026-04-16")) {
        return {
          data: [
            {
              ...baseRow,
              game_date: "2026-04-16",
              updated_at: "2026-04-16T06:00:00.000Z",
              ixg_per_60_last5: null,
              ixg_per_60_total_last5: null,
            },
          ],
          error: null,
        };
      }

      if (!dates.includes("2026-04-11")) return { data: [], error: null };
      return {
        data: [
          {
            ...baseRow,
            game_date: "2026-04-11",
            updated_at: "2026-04-11T06:00:00.000Z",
            ixg_per_60_last5: 3,
            ixg_per_60_total_last5: 0.5,
          },
        ],
        error: null,
      };
    }

    if (state.table === "players") {
      return {
        data: [{ id: 1, fullName: "Fallback Skater", position: "C", team_id: 10 }],
        error: null,
      };
    }

    if (state.table === "teams") {
      return {
        data: [{ id: 10, abbreviation: "TST", name: "Test Team" }],
        error: null,
      };
    }

    return { data: [], error: null };
  }

  function createQuery(table: string) {
    const state: QueryState = {
      table,
      selectFields: null,
      filters: {},
      rangeFrom: null,
      rangeTo: null,
    };
    queryCalls.push(state);

    const query = {
      select(fields: string) {
        state.selectFields = fields;
        return query;
      },
      eq(key: string, value: unknown) {
        state.filters[key] = value;
        return query;
      },
      lte(key: string, value: unknown) {
        state.filters[key] = value;
        return query;
      },
      order() {
        return query;
      },
      limit() {
        return Promise.resolve(resolveQuery(state));
      },
      range(from: number, to: number) {
        state.rangeFrom = from;
        state.rangeTo = to;
        return Promise.resolve(resolveQuery(state));
      },
      in(key: string, value: unknown) {
        state.filters[key] = value;
        return query;
      },
    };

    return query;
  }

  return {
    queryCalls,
    scenario,
    supabaseMock: {
      from: vi.fn((table: string) => createQuery(table)),
    },
  };
});

vi.mock("lib/supabase/server", () => ({
  default: supabaseMock,
}));

import {
  buildContextualRankingsSurface,
  buildSnapshotFirstContextualRankingsSurface,
  clearContextualRankingsQueryCachesForTests,
} from "./rankingQueries";
import { clearEntityMetricRankingReaderCachesForTests } from "./entityMetricRankingReader";

describe("rankingQueries", () => {
  beforeEach(() => {
    queryCalls.length = 0;
    scenario.entityRows = [];
    scenario.paginatedRows = [];
    clearContextualRankingsQueryCachesForTests();
    clearEntityMetricRankingReaderCachesForTests();
    supabaseMock.from.mockClear();
  });

  it("uses entity_metric_rankings for Metric Explorer when durable rows exist", async () => {
    scenario.entityRows = [
      {
        entity_type: "skater",
        entity_id: 1,
        team_id: 10,
        season_id: 20252026,
        snapshot_date: "2026-04-16",
        window_type: "season",
        window_size: 0,
        window_semantics: "season_to_date",
        strength_state: "5v5",
        metric_key: "sog_per_60",
        peer_group_type: "all_skaters",
        peer_group_key: "all",
        position_group: "forward",
        deployment_bucket: "L1",
        raw_value: 9.2,
        normalized_value: 9.2,
        raw_rank: 1,
        percentile: 100,
        qualified_peer_count: 1,
        minimum_sample_met: true,
        sample_confidence: "high",
        games_played: 10,
        toi_seconds: 6000,
        tags: ["L1"],
        explanation_items: ["Rank 1 of 1 in all_skaters:all."],
        provenance: {},
        methodology_version: "contextual_rankings_v1",
        created_at: "2026-04-16T06:00:00.000Z",
        updated_at: "2026-04-16T06:00:00.000Z",
      },
    ];

    const response = await buildSnapshotFirstContextualRankingsSurface({
      entity: "skaters",
      season: 20252026,
      asOfDate: null,
      window: "season",
      position: "all",
      deployment: "all",
      strength: "5v5",
      metric: "sog_per_60",
      minGp: null,
      minToiSeconds: null,
      peerGroupType: "all_skaters",
      sort: "percentile",
      direction: "desc",
      limit: 100,
      teamId: null,
      entityIds: null,
    });

    expect(response.meta).toMatchObject({
      sourceTable: "entity_metric_rankings",
      sourceTables: ["entity_metric_rankings"],
      rankingSource: "entity_metric_rankings",
      rankingSourcePreference: "entity_metric_rankings",
      rankingSourceFallbackReason: null,
      snapshotDate: "2026-04-16",
      rowCount: 1,
    });
    expect(response.rankings[0]).toMatchObject({
      entity: { id: 1, name: "Fallback Skater" },
      metric: {
        key: "sog_per_60",
        value: 9.2,
        rawRank: 1,
        percentile: 100,
      },
    });
    expect(
      queryCalls.some(
        (call) =>
          call.table === "rolling_player_game_metrics" &&
          call.selectFields !== "game_date",
      ),
    ).toBe(false);
  });

  it("uses entity_metric_rankings for another common Metric Explorer metric", async () => {
    scenario.entityRows = [
      {
        entity_type: "skater",
        entity_id: 1,
        team_id: 10,
        season_id: 20252026,
        snapshot_date: "2026-04-16",
        window_type: "season",
        window_size: 0,
        window_semantics: "season_to_date",
        strength_state: "5v5",
        metric_key: "points_per_60",
        peer_group_type: "all_skaters",
        peer_group_key: "all",
        position_group: "forward",
        deployment_bucket: "L1",
        raw_value: 3.1,
        normalized_value: 3.1,
        raw_rank: 2,
        percentile: 96,
        qualified_peer_count: 50,
        minimum_sample_met: true,
        sample_confidence: "high",
        games_played: 10,
        toi_seconds: 6000,
        tags: ["L1"],
        explanation_items: ["Rank 2 of 50 in all_skaters:all."],
        provenance: {},
        methodology_version: "contextual_rankings_v1",
        created_at: "2026-04-16T06:00:00.000Z",
        updated_at: "2026-04-16T06:00:00.000Z",
      },
    ];

    const response = await buildSnapshotFirstContextualRankingsSurface({
      entity: "skaters",
      season: 20252026,
      asOfDate: null,
      window: "season",
      position: "all",
      deployment: "all",
      strength: "5v5",
      metric: "points_per_60",
      minGp: null,
      minToiSeconds: null,
      peerGroupType: "all_skaters",
      sort: "percentile",
      direction: "desc",
      limit: 100,
      teamId: null,
      entityIds: null,
    });

    expect(response.meta).toMatchObject({
      sourceTable: "entity_metric_rankings",
      rankingSource: "entity_metric_rankings",
      rankingSourceFallbackReason: null,
      rowCount: 1,
    });
    expect(response.rankings[0]?.metric).toMatchObject({
      key: "points_per_60",
      value: 3.1,
      rawRank: 2,
      percentile: 96,
    });
  });

  it("falls back to rolling Metric Explorer rankings when durable snapshots are empty", async () => {
    const response = await buildSnapshotFirstContextualRankingsSurface({
      entity: "skaters",
      season: 20252026,
      asOfDate: null,
      window: "last5",
      position: "all",
      deployment: "all",
      strength: "all",
      metric: "ixg_per_60",
      minGp: null,
      minToiSeconds: null,
      peerGroupType: "all_skaters",
      sort: "percentile",
      direction: "desc",
      limit: 100,
      teamId: null,
      entityIds: null,
    });

    expect(response.meta).toMatchObject({
      sourceTable: "rolling_player_game_metrics",
      sourceTables: ["rolling_player_game_metrics"],
      rankingSource: "fallback_rolling_player_game_metrics",
      rankingSourcePreference: "entity_metric_rankings",
      rankingSourceFallbackReason:
        "No entity_metric_rankings snapshot rows matched the request.",
      snapshotDate: "2026-04-11",
    });
    expect(response.rankings).toHaveLength(1);
  });

  it("falls back from a null-only latest snapshot to the latest calculable metric snapshot", async () => {
    const response = await buildContextualRankingsSurface({
      entity: "skaters",
      season: 20252026,
      asOfDate: null,
      window: "last5",
      position: "all",
      deployment: "all",
      strength: "all",
      metric: "ixg_per_60",
      minGp: null,
      minToiSeconds: null,
      peerGroupType: "all_skaters",
      sort: "percentile",
      direction: "desc",
      limit: 100,
      teamId: null,
      entityIds: null,
    });

    expect(response.meta.latestAvailableSnapshotDate).toBe("2026-04-16");
    expect(response.meta.snapshotDate).toBe("2026-04-11");
    expect(response.meta.snapshotSelectionReason).toBe(
      "latest_calculable_metric",
    );
    expect(response.meta.message).toMatch(/latest calculable ixg_per_60/);
    expect(response.rankings).toHaveLength(1);
    expect(response.rankings[0]?.metric.value).toBe(3);
    expect(
      queryCalls.filter(
        (call) =>
          call.table === "rolling_player_game_metrics" &&
          call.selectFields !== "game_date",
      ).map((call) => call.filters.game_date),
    ).toEqual(["2026-04-16", "2026-04-11", "2026-04-11"]);
  });

  it("paginates rolling snapshot rows beyond Supabase's single-page limit", async () => {
    scenario.paginatedRows = Array.from({ length: 1001 }, (_, index) => ({
      player_id: index + 1,
      season: 20252026,
      strength_state: "all",
      team_id: 10,
      line_combo_group: "forward",
      line_combo_slot: 1,
      pp_unit: null,
      games_played: 5,
      season_games_played: 5,
      toi_seconds_total_last5: 600,
      goals_per_60_last5: 6 - index / 1000,
      goals_per_60_total_last5: 1,
      game_date: "2026-04-16",
      updated_at: "2026-04-16T06:00:00.000Z",
    }));

    const response = await buildContextualRankingsSurface({
      entity: "skaters",
      season: 20252026,
      asOfDate: null,
      window: "last5",
      position: "all",
      deployment: "all",
      strength: "all",
      metric: "goals_per_60",
      minGp: null,
      minToiSeconds: null,
      peerGroupType: "all_skaters",
      sort: "raw_rank",
      direction: "asc",
      limit: 2000,
      teamId: null,
      entityIds: null,
    });

    expect(response.meta.snapshotDate).toBe("2026-04-16");
    expect(response.meta.rowCount).toBe(1001);
    expect(response.rankings).toHaveLength(1001);
    expect(
      queryCalls
        .filter(
          (call) =>
            call.table === "rolling_player_game_metrics" &&
            call.selectFields !== "game_date" &&
            call.filters.game_date === "2026-04-16",
        )
        .map((call) => [call.rangeFrom, call.rangeTo]),
    ).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("uses each player's latest rolling row at or before the snapshot date", async () => {
    scenario.paginatedRows = [
      {
        player_id: 1,
        season: 20252026,
        strength_state: "all",
        team_id: 10,
        line_combo_group: "forward",
        line_combo_slot: 1,
        pp_unit: null,
        games_played: 5,
        season_games_played: 5,
        toi_seconds_total_last5: 600,
        goals_per_60_last5: 1,
        goals_per_60_total_last5: 1,
        game_date: "2026-04-14",
        updated_at: "2026-04-14T06:00:00.000Z",
      },
      {
        player_id: 2,
        season: 20252026,
        strength_state: "all",
        team_id: 10,
        line_combo_group: "forward",
        line_combo_slot: 1,
        pp_unit: null,
        games_played: 5,
        season_games_played: 5,
        toi_seconds_total_last5: 600,
        goals_per_60_last5: 8,
        goals_per_60_total_last5: 8,
        game_date: "2026-04-15",
        updated_at: "2026-04-15T06:00:00.000Z",
      },
      {
        player_id: 1,
        season: 20252026,
        strength_state: "all",
        team_id: 10,
        line_combo_group: "forward",
        line_combo_slot: 1,
        pp_unit: null,
        games_played: 5,
        season_games_played: 5,
        toi_seconds_total_last5: 600,
        goals_per_60_last5: 9,
        goals_per_60_total_last5: 9,
        game_date: "2026-04-16",
        updated_at: "2026-04-16T06:00:00.000Z",
      },
    ];

    const response = await buildContextualRankingsSurface({
      entity: "skaters",
      season: 20252026,
      asOfDate: null,
      window: "last5",
      position: "all",
      deployment: "all",
      strength: "all",
      metric: "goals_per_60",
      minGp: null,
      minToiSeconds: null,
      peerGroupType: "all_skaters",
      sort: "raw_rank",
      direction: "asc",
      limit: 100,
      teamId: null,
      entityIds: null,
    });

    expect(response.meta.snapshotDate).toBe("2026-04-16");
    expect(response.meta.rowCount).toBe(2);
    expect(response.rankings.map((row) => row.entity.id)).toEqual([1, 2]);
    expect(response.rankings.map((row) => row.metric.value)).toEqual([9, 8]);
  });
});
