import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildContextualRankingsSurfacesMock, supabaseFromMock } = vi.hoisted(() => ({
  buildContextualRankingsSurfacesMock: vi.fn(),
  supabaseFromMock: vi.fn(),
}));

vi.mock("./rankingQueries", () => ({
  buildContextualRankingsSurfaces: buildContextualRankingsSurfacesMock,
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: supabaseFromMock,
  },
}));

import {
  buildPlayerMatrixSurface,
  parsePlayerMatrixRequest,
} from "./playerMatrix";
import type {
  ContextualRankingApiRow,
  ContextualRankingsRequest,
} from "./rankingTypes";

function rankingRow(id: number, request: ContextualRankingsRequest): ContextualRankingApiRow {
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
    in: vi.fn(() => query),
    range: vi.fn(() => Promise.resolve({ data: rows, error: null })),
  };
  supabaseFromMock.mockReturnValue(query);
  return query;
}

describe("playerMatrix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompositeRows();
  });

  it("requests the full internal ranking set before paginating matrix rows", async () => {
    buildContextualRankingsSurfacesMock.mockImplementation(
      async (request: ContextualRankingsRequest, metricKeys: string[]) => {
        const surfaces = new Map();
        const ids =
          request.entityIds ??
          Array.from({ length: request.limit == null ? 250 : request.limit }, (
            _,
            index,
          ) => index + 1);

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
      }),
    );

    expect(buildContextualRankingsSurfacesMock.mock.calls[0]?.[0]).toMatchObject({
      limit: null,
      entityIds: null,
    });
    expect(buildContextualRankingsSurfacesMock).toHaveBeenCalledTimes(1);
    expect(buildContextualRankingsSurfacesMock.mock.calls[0]?.[1]).toContain(
      "points_per_60",
    );
    expect(response.meta.totalRankedRows).toBe(250);
    expect(response.meta.pageCount).toBe(10);
    expect(response.meta.rowCount).toBe(25);
    expect(response.rows[0]?.entity.id).toBe(26);
  });

  it("overlays published composite rows for live MCM and BEAST columns", async () => {
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
      }),
    );

    expect(response.rows[0]?.composite).toMatchObject({
      offenseRating: 91.2,
      defenseRating: 72.4,
      mcmScore: 88.6,
      beastTier: "BEAST+",
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
    expect(query.range).toHaveBeenCalledWith(0, 999);
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
  });
});
