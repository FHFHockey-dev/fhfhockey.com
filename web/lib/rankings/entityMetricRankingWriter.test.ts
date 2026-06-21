import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildSnapshotRowsMock } = vi.hoisted(() => ({
  buildSnapshotRowsMock: vi.fn(),
}));

vi.mock("./rankingQueries", () => ({
  buildContextualRankingSnapshotRowsByMetric: buildSnapshotRowsMock,
}));

import {
  buildEntityMetricRankingRows,
  defaultEntityMetricRankingMetricKeys,
  upsertEntityMetricRankingRows,
  type EntityMetricRankingBuildRequest,
  type EntityMetricRankingInsert,
} from "./entityMetricRankingWriter";
import type { ContextualRankingSnapshotMetricRows } from "./rankingQueries";

const request: EntityMetricRankingBuildRequest = {
  season: 20252026,
  asOfDate: "2026-04-16",
  windows: ["last5"],
  position: "all",
  deployment: "all",
  strength: "5v5",
  minGp: 1,
  minToiSeconds: 300,
  teamId: null,
  peerGroupType: "all_skaters",
  metricKeys: ["points_per_60"],
};

function snapshot(
  overrides: Partial<ContextualRankingSnapshotMetricRows> = {},
): ContextualRankingSnapshotMetricRows {
  return {
    request: {
      entity: "skaters",
      season: 20252026,
      asOfDate: "2026-04-16",
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
    metricKey: "points_per_60",
    snapshotDate: "2026-04-16",
    snapshotUpdatedAt: "2026-04-16T06:00:00.000Z",
    latestAvailableSnapshotDate: "2026-04-16",
    snapshotSelectionReason: "latest_available",
    unavailable: false,
    message: null,
    rankedRows: [
      {
        entityId: 1,
        teamId: 10,
        metricKey: "points_per_60",
        rawValue: null,
        gamesPlayed: 5,
        toiSeconds: 600,
        positionGroup: "forward",
        deploymentBucket: "L1",
        peerGroupType: "all_skaters",
        peerGroupKey: "all",
        calculatedRawValue: 3.25,
        normalizedValue: 3.25,
        rawRank: 1,
        percentile: 100,
        qualifiedPeerCount: 2,
        minimumSampleMet: true,
        sampleConfidence: "high",
        warnings: [],
      },
      {
        entityId: 2,
        teamId: 11,
        metricKey: "points_per_60",
        rawValue: null,
        gamesPlayed: 1,
        toiSeconds: 120,
        positionGroup: "defense",
        deploymentBucket: "L2",
        peerGroupType: "all_skaters",
        peerGroupKey: "all",
        calculatedRawValue: 1.1,
        normalizedValue: 1.1,
        rawRank: null,
        percentile: null,
        qualifiedPeerCount: 2,
        minimumSampleMet: false,
        sampleConfidence: "low",
        warnings: ["sample_below_minimum"],
      },
    ],
    ...overrides,
  };
}

describe("entityMetricRankingWriter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to rolling-backed matrix metrics only", () => {
    const metricKeys = defaultEntityMetricRankingMetricKeys({ strength: "5v5" });

    expect(metricKeys).toContain("points_per_60");
    expect(metricKeys).not.toContain("offense_rating");
    expect(metricKeys).not.toContain("defense_rating");
    expect(metricKeys).not.toContain("mcm_score");
    expect(metricKeys).not.toContain("beast_tier");
  });

  it("maps verified ranking snapshot rows to entity_metric_rankings inserts", async () => {
    buildSnapshotRowsMock.mockResolvedValue(
      new Map([["points_per_60", snapshot()]]),
    );

    const result = await buildEntityMetricRankingRows(request);

    expect(buildSnapshotRowsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        window: "last5",
        metric: "points_per_60",
        limit: null,
      }),
      ["points_per_60"],
    );
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
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
      raw_value: 3.25,
      normalized_value: 3.25,
      raw_rank: 1,
      percentile: 100,
      qualified_peer_count: 2,
      minimum_sample_met: true,
      sample_confidence: "high",
      games_played: 5,
      toi_seconds: 600,
      methodology_version: "contextual_rankings_v1",
    });
    expect(result.rows[0]?.tags).toEqual(["L1"]);
    expect(result.rows[0]?.explanation_items).toContain(
      "Rank 1 of 2 in all_skaters:all.",
    );
    expect(result.rows[0]?.explanation_items).toContain(
      "Better than 100.0% of other qualified peers after metric directionality is applied.",
    );
    expect(result.rows[0]?.provenance).toMatchObject({
      sourceTable: "rolling_player_game_metrics",
      writer: "entityMetricRankingWriter",
      snapshotUpdatedAt: "2026-04-16T06:00:00.000Z",
    });
    expect(result.rows[1]).toMatchObject({
      entity_id: 2,
      raw_rank: null,
      percentile: null,
      minimum_sample_met: false,
      sample_confidence: "low",
    });
    expect(result.rows[1]?.tags).toEqual(["low-sample", "L2"]);
    expect(result.contexts).toMatchObject([
      {
        window: "last5",
        snapshotDate: "2026-04-16",
        generatedRows: 2,
      },
    ]);
  });

  it("reports unavailable snapshot metrics without inventing rows", async () => {
    buildSnapshotRowsMock.mockResolvedValue(
      new Map([
        [
          "points_per_60",
          snapshot({
            snapshotDate: null,
            snapshotUpdatedAt: null,
            latestAvailableSnapshotDate: null,
            unavailable: true,
            message: "Requested metric has no calculable values.",
            rankedRows: [],
          }),
        ],
      ]),
    );

    const result = await buildEntityMetricRankingRows(request);

    expect(result.rows).toEqual([]);
    expect(result.unavailableMetrics).toEqual([
      {
        window: "last5",
        metricKey: "points_per_60",
        reason: "Requested metric has no calculable values.",
      },
    ]);
    expect(result.sourceFreshness[0]).toMatchObject({
      unavailable: true,
      reason: "Requested metric has no calculable values.",
    });
  });

  it("upserts rows in chunks using the table primary key", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn(() => ({
        upsert: upsertMock,
      })),
    };
    const rows = Array.from({ length: 501 }, (_, index) => ({
      entity_type: "skater",
      entity_id: index + 1,
      season_id: 20252026,
      snapshot_date: "2026-04-16",
      window_type: "last_5",
      window_size: 5,
      window_semantics: "player_last_n_games_played",
      strength_state: "5v5",
      metric_key: "points_per_60",
      peer_group_type: "all_skaters",
      peer_group_key: "all",
    })) as EntityMetricRankingInsert[];

    const rowsUpserted = await upsertEntityMetricRankingRows(client as any, rows, {
      chunkSize: 500,
    });

    expect(rowsUpserted).toBe(501);
    expect(client.from).toHaveBeenCalledWith("entity_metric_rankings");
    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(upsertMock.mock.calls[0]?.[0]).toHaveLength(500);
    expect(upsertMock.mock.calls[1]?.[0]).toHaveLength(1);
    expect(upsertMock.mock.calls[0]?.[1]).toEqual({
      onConflict:
        "entity_type,entity_id,season_id,snapshot_date,window_type,window_size,strength_state,metric_key,peer_group_type,peer_group_key",
    });
  });

  it("splits failed upsert chunks and retries smaller payloads", async () => {
    const upsertMock = vi
      .fn()
      .mockResolvedValueOnce({
        error: { message: "TypeError: fetch failed" },
      })
      .mockResolvedValue({ error: null });
    const client = {
      from: vi.fn(() => ({
        upsert: upsertMock,
      })),
    };
    const rows = Array.from({ length: 4 }, (_, index) => ({
      entity_type: "skater",
      entity_id: index + 1,
      season_id: 20252026,
      snapshot_date: "2026-04-16",
      window_type: "last_5",
      window_size: 5,
      window_semantics: "player_last_n_games_played",
      strength_state: "5v5",
      metric_key: "points_per_60",
      peer_group_type: "all_skaters",
      peer_group_key: "all",
    })) as EntityMetricRankingInsert[];

    const rowsUpserted = await upsertEntityMetricRankingRows(client as any, rows, {
      chunkSize: 4,
    });

    expect(rowsUpserted).toBe(4);
    expect(upsertMock).toHaveBeenCalledTimes(3);
    expect(upsertMock.mock.calls[0]?.[0]).toHaveLength(4);
    expect(upsertMock.mock.calls[1]?.[0]).toHaveLength(2);
    expect(upsertMock.mock.calls[2]?.[0]).toHaveLength(2);
  });
});
