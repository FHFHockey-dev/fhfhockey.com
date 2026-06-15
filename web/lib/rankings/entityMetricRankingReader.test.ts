import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryState = {
  table: string;
  selectFields: string | null;
  filters: Record<string, unknown>;
  rangeFrom: number | null;
  rangeTo: number | null;
};

const { queryCalls, supabaseMock } = vi.hoisted(() => {
  const queryCalls: QueryState[] = [];

  function resolveQuery(state: QueryState) {
    if (
      state.table === "entity_metric_rankings" &&
      state.selectFields === "snapshot_date"
    ) {
      return {
        data: [{ snapshot_date: "2026-04-16" }],
        error: null,
      };
    }

    if (state.table === "entity_metric_rankings") {
      return {
        data: [
          {
            entity_type: "skater",
            entity_id: 1,
            team_id: 10,
            season_id: 20252026,
            snapshot_date: "2026-04-16",
            window_type: "last_5",
            window_size: 5,
            window_semantics: "player_last_n_games_played",
            strength_state: "5v5",
            metric_key: "points_per_60",
            peer_group_type: "all_skaters",
            peer_group_key: "all",
            position_group: "forward",
            deployment_bucket: "L1",
            raw_value: 3.2,
            normalized_value: 3.2,
            raw_rank: 1,
            percentile: 100,
            qualified_peer_count: 1,
            minimum_sample_met: true,
            sample_confidence: "high",
            games_played: 5,
            toi_seconds: 600,
            tags: ["L1"],
            explanation_items: ["Rank 1 of 1 in all_skaters:all."],
            provenance: {},
            methodology_version: "contextual_rankings_v1",
            created_at: "2026-04-16T06:00:00.000Z",
            updated_at: "2026-04-16T06:00:00.000Z",
          },
        ],
        error: null,
      };
    }

    if (state.table === "players") {
      return {
        data: [
          {
            id: 1,
            fullName: "Snapshot Skater",
            position: "C",
            team_id: 10,
            image_url: "https://example.test/player.png",
          },
        ],
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
      in(key: string, value: unknown) {
        state.filters[key] = value;
        return query;
      },
      range(from: number, to: number) {
        state.rangeFrom = from;
        state.rangeTo = to;
        return Promise.resolve(resolveQuery(state));
      },
    };

    return query;
  }

  return {
    queryCalls,
    supabaseMock: {
      from: vi.fn((table: string) => createQuery(table)),
    },
  };
});

vi.mock("lib/supabase/server", () => ({
  default: supabaseMock,
}));

import { buildEntityMetricRankingSurfaces } from "./entityMetricRankingReader";

describe("entityMetricRankingReader", () => {
  beforeEach(() => {
    queryCalls.length = 0;
    supabaseMock.from.mockClear();
  });

  it("reads entity_metric_rankings snapshots and returns ranking surfaces", async () => {
    const surfaces = await buildEntityMetricRankingSurfaces(
      {
        entity: "skaters",
        season: 20252026,
        asOfDate: "2026-04-17",
        window: "last5",
        position: "all",
        deployment: "all",
        strength: "5v5",
        metric: "points_per_60",
        minGp: 1,
        minToiSeconds: 300,
        teamId: null,
        peerGroupType: "all_skaters",
        sort: "percentile",
        direction: "desc",
        limit: null,
        entityIds: null,
      },
      ["points_per_60"],
    );

    const surface = surfaces.get("points_per_60");
    expect(surface?.meta).toMatchObject({
      sourceTable: "entity_metric_rankings",
      snapshotDate: "2026-04-16",
      latestAvailableSnapshotDate: "2026-04-16",
      unavailable: false,
      rowCount: 1,
    });
    expect(surface?.rankings[0]).toMatchObject({
      entity: {
        id: 1,
        name: "Snapshot Skater",
        position: "C",
        positionGroup: "forward",
      },
      team: {
        id: 10,
        abbreviation: "TST",
      },
      deployment: {
        ev: "L1",
        pp: null,
        pk: null,
      },
      metric: {
        key: "points_per_60",
        value: 3.2,
        formattedValue: "3.20",
        rawRank: 1,
        percentile: 100,
      },
    });
    expect(
      queryCalls.find(
        (call) =>
          call.table === "entity_metric_rankings" &&
          call.selectFields === "snapshot_date",
      )?.filters,
    ).toMatchObject({
      entity_type: "skater",
      season_id: 20252026,
      window_type: "last_5",
      window_size: 5,
      strength_state: "5v5",
      metric_key: "points_per_60",
      peer_group_type: "all_skaters",
      peer_group_key: "all",
      snapshot_date: "2026-04-17",
    });
  });
});
