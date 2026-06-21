import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  buildContextualRankingsSurfacesMock,
  buildEntityMetricRankingSurfacesMock,
  supabaseFromMock,
} = vi.hoisted(() => ({
  buildContextualRankingsSurfacesMock: vi.fn(),
  buildEntityMetricRankingSurfacesMock: vi.fn(),
  supabaseFromMock: vi.fn(),
}));

vi.mock("./rankingQueries", () => ({
  buildContextualRankingsSurfaces: buildContextualRankingsSurfacesMock,
}));

vi.mock("./entityMetricRankingReader", () => ({
  buildEntityMetricRankingSurfaces: buildEntityMetricRankingSurfacesMock,
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: supabaseFromMock,
  },
}));

import {
  buildPlayerMatrixSurface,
  clearPlayerMatrixSurfaceCachesForTests,
  parsePlayerMatrixRequest,
} from "./playerMatrix";
import type {
  ContextualRankingApiRow,
  ContextualRankingsRequest,
} from "./rankingTypes";

function rankingRow(
  id: number,
  request: ContextualRankingsRequest,
): ContextualRankingApiRow {
  return {
    entity: {
      id,
      name: `Player ${id}`,
      position: id % 2 === 0 ? "D" : "C",
      positionGroup: id % 2 === 0 ? "defense" : "forward",
      imageUrl: null,
    },
    team: {
      id: 1,
      abbreviation: "TST",
      name: "Test Team",
    },
    deployment: {
      ev: "L1",
      pp: null,
      pk: null,
      confidence: "high",
    },
    sample: {
      gamesPlayed: 10,
      toiSeconds: 6000,
      toiPerGameSeconds: 600,
      confidence: "high",
      minimumSampleMet: true,
    },
    metric: {
      key: request.metric,
      value: 250 - id,
      formattedValue: String(250 - id),
      rawRank: id,
      percentile: 100 - id / 3,
      qualifiedPeerCount: 250,
    },
    peerGroup: {
      type: request.peerGroupType,
      key: "all",
    },
    tags: [],
    warnings: [],
    explanationItems: [],
  };
}

function mockCompositeRows(rows: Array<Record<string, unknown>> = []) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    lte: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(() => Promise.resolve({ data: rows, error: null })),
  };
  supabaseFromMock.mockReturnValue(query);
  return query;
}

describe("playerMatrix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPlayerMatrixSurfaceCachesForTests();
    mockCompositeRows();
    buildEntityMetricRankingSurfacesMock.mockReset();
  });

  it("requests the full internal ranking set before paginating matrix rows", async () => {
    buildContextualRankingsSurfacesMock.mockImplementation(
      async (request: ContextualRankingsRequest, metricKeys: string[]) => {
        const surfaces = new Map();
        const ids =
          request.entityIds ??
          Array.from(
            { length: request.limit == null ? 250 : request.limit },
            (_, index) => index + 1,
          );

        for (const metricKey of metricKeys) {
          const metricRequest = { ...request, metric: metricKey as any };
          surfaces.set(metricKey, {
            success: true,
            request: metricRequest,
            rankings: ids.map((id) => rankingRow(id, metricRequest)),
            meta: {
              generatedAt: "2026-06-08T00:00:00.000Z",
              snapshotDate: "2026-04-16",
              snapshotUpdatedAt: "2026-06-08T00:00:00.000Z",
              latestAvailableSnapshotDate: "2026-04-16",
              snapshotSelectionReason: "latest_available",
              sourceTable: "rolling_player_game_metrics",
              metric: {
                key: metricKey,
                displayName: metricKey,
                availabilityStatus: "available",
                higherIsBetter: true,
                description: null,
                formulaDescription: null,
                applicableStrengthStates: [request.strength],
                denominatorKey: null,
                denominatorDescription: null,
                sampleRequirements: null,
                methodologyVersion: null,
                methodologyUpdatedAt: null,
                sourceQualityFlags: [],
              },
              unavailable: false,
              rowCount: ids.length,
              limit: request.limit,
              message: null,
            },
          });
        }
        return surfaces;
      },
    );

    const response = await buildPlayerMatrixSurface(
      parsePlayerMatrixRequest({
        season: "20252026",
        strength: "5v5",
        window: "last5",
        page: "2",
        page_size: "25",
        ranking_source: "fallback",
      }),
    );

    expect(
      buildContextualRankingsSurfacesMock.mock.calls[0]?.[0],
    ).toMatchObject({
      limit: null,
      entityIds: null,
    });
    expect(buildContextualRankingsSurfacesMock).toHaveBeenCalledTimes(3);
    expect(buildContextualRankingsSurfacesMock.mock.calls[0]?.[1]).toEqual([
      "points_per_60",
    ]);
    expect(
      buildContextualRankingsSurfacesMock.mock.calls[1]?.[0],
    ).toMatchObject({
      entityIds: Array.from({ length: 25 }, (_, index) => index + 26),
    });
    expect(
      buildContextualRankingsSurfacesMock.mock.calls[2]?.[0],
    ).toMatchObject({
      deployment: "all",
      peerGroupType: "deployment",
      entityIds: Array.from({ length: 25 }, (_, index) => index + 26),
    });
    expect(response.meta.totalRankedRows).toBe(250);
    expect(response.meta.pageCount).toBe(10);
    expect(response.meta.rowCount).toBe(25);
    expect(response.rows[0]?.entity.id).toBe(26);
    expect(
      response.rows[0]?.metrics.points_per_60.rankScopes?.overall?.rank,
    ).toBe(26);
    expect(
      response.rows[0]?.metrics.points_per_60.rankScopes?.deployment?.rank,
    ).toBe(26);
  });

  it("filters cached matrix rows by search before pagination without changing peer ranks", async () => {
    buildContextualRankingsSurfacesMock.mockImplementation(
      async (request: ContextualRankingsRequest, metricKeys: string[]) => {
        const surfaces = new Map();
        const ids =
          request.entityIds ??
          Array.from(
            { length: request.limit == null ? 50 : request.limit },
            (_, index) => index + 1,
          );

        for (const metricKey of metricKeys) {
          const metricRequest = { ...request, metric: metricKey as any };
          surfaces.set(metricKey, {
            success: true,
            request: metricRequest,
            rankings: ids.map((id) => rankingRow(id, metricRequest)),
            meta: {
              generatedAt: "2026-06-08T00:00:00.000Z",
              snapshotDate: "2026-04-16",
              snapshotUpdatedAt: "2026-06-08T00:00:00.000Z",
              latestAvailableSnapshotDate: "2026-04-16",
              snapshotSelectionReason: "latest_available",
              sourceTable: "rolling_player_game_metrics",
              metric: {
                key: metricKey,
                displayName: metricKey,
                availabilityStatus: "available",
                higherIsBetter: true,
                description: null,
                formulaDescription: null,
                applicableStrengthStates: [request.strength],
                denominatorKey: null,
                denominatorDescription: null,
                sampleRequirements: null,
                methodologyVersion: null,
                methodologyUpdatedAt: null,
                sourceQualityFlags: [],
              },
              unavailable: false,
              rowCount: ids.length,
              limit: request.limit,
              message: null,
            },
          });
        }
        return surfaces;
      },
    );

    const response = await buildPlayerMatrixSurface(
      parsePlayerMatrixRequest({
        season: "20252026",
        strength: "5v5",
        search: "Player 26",
        page_size: "10",
        ranking_source: "fallback",
      }),
    );

    expect(response.request.search).toBe("Player 26");
    expect(response.meta.totalRankedRows).toBe(1);
    expect(response.meta.rowCount).toBe(1);
    expect(response.rows[0]?.entity.name).toBe("Player 26");
    expect(response.rows[0]?.sort.rank).toBe(26);
    expect(
      buildContextualRankingsSurfacesMock.mock.calls[1]?.[0],
    ).toMatchObject({
      entityIds: [26],
    });
  });

  it("uses entity_metric_rankings surfaces by default when populated", async () => {
    buildEntityMetricRankingSurfacesMock.mockImplementation(
      async (request: ContextualRankingsRequest, metricKeys: string[]) => {
        const surfaces = new Map();
        const ids = request.entityIds ?? [1, 2, 3];
        for (const metricKey of metricKeys) {
          const metricRequest = { ...request, metric: metricKey as any };
          surfaces.set(metricKey, {
            success: true,
            request: metricRequest,
            rankings: ids.map((id) => rankingRow(id, metricRequest)),
            meta: {
              generatedAt: "2026-06-08T00:00:00.000Z",
              snapshotDate: "2026-04-16",
              snapshotUpdatedAt: "2026-06-08T00:00:00.000Z",
              latestAvailableSnapshotDate: "2026-04-16",
              snapshotSelectionReason: "latest_available",
              sourceTable: "entity_metric_rankings",
              metric: {
                key: metricKey,
                displayName: metricKey,
                availabilityStatus: "available",
                higherIsBetter: true,
                description: null,
                formulaDescription: null,
                applicableStrengthStates: [request.strength],
                denominatorKey: null,
                denominatorDescription: null,
                sampleRequirements: null,
                methodologyVersion: null,
                methodologyUpdatedAt: null,
                sourceQualityFlags: [],
              },
              unavailable: false,
              rowCount: ids.length,
              limit: request.limit,
              message: null,
            },
          });
        }
        return surfaces;
      },
    );

    const response = await buildPlayerMatrixSurface(
      parsePlayerMatrixRequest({
        season: "20252026",
        strength: "5v5",
      }),
    );

    expect(buildContextualRankingsSurfacesMock).not.toHaveBeenCalled();
    expect(buildEntityMetricRankingSurfacesMock).toHaveBeenCalledTimes(3);
    expect(response.meta).toMatchObject({
      sourceTable: "entity_metric_rankings",
      sourceTables: ["entity_metric_rankings", "skater_composite_ratings"],
      rankingSource: "entity_metric_rankings",
      rankingSourcePreference: "entity_metric_rankings",
      rankingSourceFallbackReason: null,
    });
    expect(response.rows.map((row) => row.entity.id)).toEqual([1, 2, 3]);
  });

  it("falls back to rolling ranking surfaces when requested entity snapshots are empty", async () => {
    buildEntityMetricRankingSurfacesMock.mockImplementation(
      async (request: ContextualRankingsRequest, metricKeys: string[]) => {
        const surfaces = new Map();
        for (const metricKey of metricKeys) {
          const metricRequest = { ...request, metric: metricKey as any };
          surfaces.set(metricKey, {
            success: true,
            request: metricRequest,
            rankings: [],
            meta: {
              generatedAt: "2026-06-08T00:00:00.000Z",
              snapshotDate: null,
              snapshotUpdatedAt: null,
              latestAvailableSnapshotDate: null,
              snapshotSelectionReason: "no_snapshot",
              sourceTable: "entity_metric_rankings",
              metric: {
                key: metricKey,
                displayName: metricKey,
                availabilityStatus: "available",
                higherIsBetter: true,
                description: null,
                formulaDescription: null,
                applicableStrengthStates: [request.strength],
                denominatorKey: null,
                denominatorDescription: null,
                sampleRequirements: null,
                methodologyVersion: null,
                methodologyUpdatedAt: null,
                sourceQualityFlags: [],
              },
              unavailable: true,
              rowCount: 0,
              limit: request.limit,
              message:
                "No entity_metric_rankings snapshot rows matched the request.",
            },
          });
        }
        return surfaces;
      },
    );
    buildContextualRankingsSurfacesMock.mockImplementation(
      async (request: ContextualRankingsRequest, metricKeys: string[]) => {
        const surfaces = new Map();
        const ids = request.entityIds ?? [1, 2];
        for (const metricKey of metricKeys) {
          const metricRequest = { ...request, metric: metricKey as any };
          surfaces.set(metricKey, {
            success: true,
            request: metricRequest,
            rankings: ids.map((id) => rankingRow(id, metricRequest)),
            meta: {
              generatedAt: "2026-06-08T00:00:00.000Z",
              snapshotDate: "2026-04-16",
              snapshotUpdatedAt: "2026-06-08T00:00:00.000Z",
              latestAvailableSnapshotDate: "2026-04-16",
              snapshotSelectionReason: "latest_available",
              sourceTable: "rolling_player_game_metrics",
              metric: {
                key: metricKey,
                displayName: metricKey,
                availabilityStatus: "available",
                higherIsBetter: true,
                description: null,
                formulaDescription: null,
                applicableStrengthStates: [request.strength],
                denominatorKey: null,
                denominatorDescription: null,
                sampleRequirements: null,
                methodologyVersion: null,
                methodologyUpdatedAt: null,
                sourceQualityFlags: [],
              },
              unavailable: false,
              rowCount: ids.length,
              limit: request.limit,
              message: null,
            },
          });
        }
        return surfaces;
      },
    );

    const response = await buildPlayerMatrixSurface(
      parsePlayerMatrixRequest({
        season: "20252026",
        strength: "5v5",
        ranking_source: "entity_metric_rankings",
      }),
    );

    expect(buildEntityMetricRankingSurfacesMock).toHaveBeenCalledTimes(1);
    expect(buildContextualRankingsSurfacesMock).toHaveBeenCalledTimes(3);
    expect(response.meta).toMatchObject({
      sourceTable: "rolling_player_game_metrics",
      sourceTables: ["rolling_player_game_metrics", "skater_composite_ratings"],
      rankingSource: "fallback_rolling_player_game_metrics",
      rankingSourcePreference: "entity_metric_rankings",
      rankingSourceFallbackReason:
        "No entity_metric_rankings snapshot rows matched the request.",
    });
  });

  it("overlays published composite rows for live Offense, Defense, MCM, and BEAST columns", async () => {
    buildContextualRankingsSurfacesMock.mockImplementation(
      async (request: ContextualRankingsRequest, metricKeys: string[]) => {
        const surfaces = new Map();
        for (const metricKey of metricKeys) {
          const metricRequest = { ...request, metric: metricKey as any };
          surfaces.set(metricKey, {
            success: true,
            request: metricRequest,
            rankings: [1].map((id) => rankingRow(id, metricRequest)),
            meta: {
              generatedAt: "2026-06-08T00:00:00.000Z",
              snapshotDate: "2026-04-16",
              snapshotUpdatedAt: "2026-06-08T00:00:00.000Z",
              latestAvailableSnapshotDate: "2026-04-16",
              snapshotSelectionReason: "latest_available",
              sourceTable: "rolling_player_game_metrics",
              metric: {
                key: metricKey,
                displayName: metricKey,
                availabilityStatus: "available",
                higherIsBetter: true,
                description: null,
                formulaDescription: null,
                applicableStrengthStates: [request.strength],
                denominatorKey: null,
                denominatorDescription: null,
                sampleRequirements: null,
                methodologyVersion: null,
                methodologyUpdatedAt: null,
                sourceQualityFlags: [],
              },
              unavailable: false,
              rowCount: 1,
              limit: request.limit,
              message: null,
            },
          });
        }
        return surfaces;
      },
    );
    const query = mockCompositeRows([
      {
        player_id: 1,
        snapshot_date: "2026-04-16",
        updated_at: "2026-06-08T00:00:00.000Z",
        offense_rating_overall: null,
        offense_rating_deployment: 91.2,
        defense_rating_overall: null,
        defense_rating_deployment: 72.4,
        mcm_score: 88.6,
        beast_tier: "BEAST+",
        shoot_first_score: 80.1,
        pass_first_score: 65.2,
        play_driver_score: 83.4,
        results_luck_index: null,
        methodology_version: "contextual_composites_v1",
      },
    ]);

    const response = await buildPlayerMatrixSurface(
      parsePlayerMatrixRequest({
        season: "20252026",
        strength: "5v5",
        window: "season",
        ranking_source: "fallback",
      }),
    );

    expect(response.rows[0]?.composite).toMatchObject({
      offenseRating: 91.2,
      defenseRating: 72.4,
      mcmScore: 88.6,
      beastTier: "BEAST+",
    });
    expect(response.rows[0]?.metrics.offense_rating).toMatchObject({
      formattedValue: "91.2",
      percentile: 91.2,
      availabilityState: "available",
    });
    expect(response.rows[0]?.metrics.defense_rating).toMatchObject({
      formattedValue: "72.4",
      percentile: 72.4,
      availabilityState: "available",
    });
    expect(response.rows[0]?.metrics.mcm_score).toMatchObject({
      formattedValue: "88.6",
      percentile: 88.6,
      availabilityState: "available",
    });
    expect(response.rows[0]?.metrics.beast_tier).toMatchObject({
      formattedValue: "BEAST+",
      percentile: 88.6,
      availabilityState: "available",
    });
    expect(response.meta).toMatchObject({
      rankingSource: "fallback_rolling_player_game_metrics",
      compositeSourceTable: "skater_composite_ratings",
      sourceTables: ["rolling_player_game_metrics", "skater_composite_ratings"],
    });
    expect(query.range).toHaveBeenCalledWith(0, 999);
  });

  it("sorts by published Offense Rating and leaves missing composite rows unavailable", async () => {
    buildContextualRankingsSurfacesMock.mockImplementation(
      async (request: ContextualRankingsRequest, metricKeys: string[]) => {
        const surfaces = new Map();
        for (const metricKey of metricKeys) {
          const metricRequest = { ...request, metric: metricKey as any };
          surfaces.set(metricKey, {
            success: true,
            request: metricRequest,
            rankings: [1, 2, 3].map((id) => rankingRow(id, metricRequest)),
            meta: {
              generatedAt: "2026-06-08T00:00:00.000Z",
              snapshotDate: "2026-04-16",
              snapshotUpdatedAt: "2026-06-08T00:00:00.000Z",
              latestAvailableSnapshotDate: "2026-04-16",
              snapshotSelectionReason: "latest_available",
              sourceTable: "rolling_player_game_metrics",
              metric: {
                key: metricKey,
                displayName: metricKey,
                availabilityStatus: "available",
                higherIsBetter: true,
                description: null,
                formulaDescription: null,
                applicableStrengthStates: [request.strength],
                denominatorKey: null,
                denominatorDescription: null,
                sampleRequirements: null,
                methodologyVersion: null,
                methodologyUpdatedAt: null,
                sourceQualityFlags: [],
              },
              unavailable: false,
              rowCount: 3,
              limit: request.limit,
              message: null,
            },
          });
        }
        return surfaces;
      },
    );
    mockCompositeRows([
      {
        player_id: 1,
        snapshot_date: "2026-04-16",
        updated_at: "2026-06-08T00:00:00.000Z",
        offense_rating_overall: 90,
        offense_rating_deployment: null,
        defense_rating_overall: 70,
        defense_rating_deployment: null,
        mcm_score: 85,
        beast_tier: "BEAST",
        results_luck_index: null,
        methodology_version: "contextual_composites_v1",
      },
      {
        player_id: 3,
        snapshot_date: "2026-04-16",
        updated_at: "2026-06-08T00:00:00.000Z",
        offense_rating_overall: 90,
        offense_rating_deployment: null,
        defense_rating_overall: null,
        defense_rating_deployment: null,
        mcm_score: 75,
        beast_tier: "MCM",
        results_luck_index: null,
        methodology_version: "contextual_composites_v1",
      },
    ]);

    const response = await buildPlayerMatrixSurface(
      parsePlayerMatrixRequest({
        season: "20252026",
        strength: "5v5",
        window: "season",
        sort_metric: "offense_rating",
        ranking_source: "fallback",
      }),
    );

    expect(response.meta.sortMetric).toBe("offense_rating");
    expect(response.rows.map((row) => row.entity.id)).toEqual([1, 3, 2]);
    expect(response.rows[0]?.sort).toMatchObject({
      rank: 1,
      percentile: 90,
    });
    expect(response.rows[1]?.sort).toMatchObject({
      rank: 1,
      percentile: 90,
    });
    expect(response.rows[2]?.sort).toMatchObject({
      rank: null,
      percentile: null,
    });
    expect(response.rows[2]?.metrics.offense_rating).toMatchObject({
      availabilityState: "unavailable",
      availabilityReason:
        "Composite rating row is not published for this player/context.",
    });
    expect(response.rows[1]?.metrics.defense_rating).toMatchObject({
      availabilityState: "unavailable",
      availabilityReason:
        "Composite metric is not available for this player/context.",
    });
  });

  it("sorts composite rows by Results Luck instead of MCM when requested", async () => {
    buildContextualRankingsSurfacesMock.mockImplementation(
      async (request: ContextualRankingsRequest, metricKeys: string[]) => {
        const surfaces = new Map();
        for (const metricKey of metricKeys) {
          const metricRequest = { ...request, metric: metricKey as any };
          surfaces.set(metricKey, {
            success: true,
            request: metricRequest,
            rankings: [1, 2].map((id) => rankingRow(id, metricRequest)),
            meta: {
              generatedAt: "2026-06-08T00:00:00.000Z",
              snapshotDate: "2026-04-16",
              snapshotUpdatedAt: "2026-06-08T00:00:00.000Z",
              latestAvailableSnapshotDate: "2026-04-16",
              snapshotSelectionReason: "latest_available",
              sourceTable: "rolling_player_game_metrics",
              metric: {
                key: metricKey,
                displayName: metricKey,
                availabilityStatus: "available",
                higherIsBetter: true,
                description: null,
                formulaDescription: null,
                applicableStrengthStates: [request.strength],
                denominatorKey: null,
                denominatorDescription: null,
                sampleRequirements: null,
                methodologyVersion: null,
                methodologyUpdatedAt: null,
                sourceQualityFlags: [],
              },
              unavailable: false,
              rowCount: 2,
              limit: request.limit,
              message: null,
            },
          });
        }
        return surfaces;
      },
    );
    mockCompositeRows([
      {
        player_id: 1,
        snapshot_date: "2026-04-16",
        updated_at: "2026-06-08T00:00:00.000Z",
        mcm_score: 99,
        beast_tier: "BEAST+",
        results_luck_index: 70,
        methodology_version: "contextual_composites_v1",
      },
      {
        player_id: 2,
        snapshot_date: "2026-04-16",
        updated_at: "2026-06-08T00:00:00.000Z",
        mcm_score: 80,
        beast_tier: "GOOD",
        results_luck_index: 120,
        methodology_version: "contextual_composites_v1",
      },
    ]);

    const response = await buildPlayerMatrixSurface(
      parsePlayerMatrixRequest({
        season: "20252026",
        strength: "5v5",
        window: "last20",
        sort_metric: "results_luck_index",
        ranking_source: "fallback",
      }),
    );

    expect(response.meta.sortMetric).toBe("results_luck_index");
    expect(response.rows[0]?.entity.id).toBe(2);
    expect(response.rows[0]?.sort.percentile).toBe(120);
    expect(response.rows[0]?.composite?.resultsLuckIndex).toBe(120);
  });

  it("normalizes stale unsupported page sizes to the default supported size", () => {
    const request = parsePlayerMatrixRequest({
      season: "20252026",
      page_size: "5",
    });

    expect(request.pageSize).toBe(10);
    expect(request.rankingSourcePreference).toBe("entity_metric_rankings");
  });
});
