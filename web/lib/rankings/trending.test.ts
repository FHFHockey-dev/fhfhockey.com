import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildContextualRankingsSurfacesMock } = vi.hoisted(() => ({
  buildContextualRankingsSurfacesMock: vi.fn(),
}));

vi.mock("./rankingQueries", () => ({
  buildContextualRankingsSurfaces: buildContextualRankingsSurfacesMock,
}));

import {
  buildTrendingSurface,
  parseTrendingRequest,
} from "./trending";
import type {
  ContextualRankingApiRow,
  ContextualRankingsRequest,
  ContextualRankingsResponse,
} from "./rankingTypes";

function row(args: {
  id: number;
  name: string;
  metric: ContextualRankingsRequest["metric"];
  value: number;
  percentile: number;
  toiPerGameSeconds: number;
}): ContextualRankingApiRow {
  return {
    entity: {
      id: args.id,
      name: args.name,
      position: "C",
      positionGroup: "forward",
      imageUrl: null,
    },
    team: {
      id: 1,
      abbreviation: "TST",
      name: "Test Team",
    },
    deployment: {
      ev: "L2",
      pp: "PP1",
      pk: null,
      confidence: "medium",
    },
    sample: {
      gamesPlayed: 10,
      toiSeconds: args.toiPerGameSeconds * 10,
      toiPerGameSeconds: args.toiPerGameSeconds,
      confidence: "high",
      minimumSampleMet: true,
    },
    metric: {
      key: args.metric,
      value: args.value,
      formattedValue: args.value.toFixed(2),
      rawRank: 1,
      percentile: args.percentile,
      qualifiedPeerCount: 10,
    },
    peerGroup: {
      type: "all_skaters",
      key: "all",
    },
    tags: ["L2", "PP1"],
    warnings: [],
    explanationItems: [],
  };
}

function response(args: {
  request: ContextualRankingsRequest;
  rows: ContextualRankingApiRow[];
}): ContextualRankingsResponse {
  return {
    success: true,
    request: args.request,
    rankings: args.rows,
    meta: {
      generatedAt: "2026-06-08T00:00:00.000Z",
      snapshotDate: "2026-04-16",
      snapshotUpdatedAt: "2026-04-16T06:00:00.000Z",
      latestAvailableSnapshotDate: "2026-04-16",
      snapshotSelectionReason: "latest_available",
      sourceTable: "rolling_player_game_metrics",
      metric: {
        key: args.request.metric,
        displayName: args.request.metric,
        availabilityStatus: "available",
        higherIsBetter: true,
        description: null,
        formulaDescription: null,
        applicableStrengthStates: [args.request.strength],
        denominatorKey: null,
        denominatorDescription: null,
        sampleRequirements: null,
        methodologyVersion: null,
        methodologyUpdatedAt: null,
        sourceQualityFlags: [],
      },
      unavailable: false,
      rowCount: args.rows.length,
      limit: null,
      message: null,
    },
  };
}

describe("trending", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildContextualRankingsSurfacesMock.mockImplementation(
      async (request: ContextualRankingsRequest, metricKeys: string[]) => {
        const surfaces = new Map();
        for (const metricKey of metricKeys) {
          const metricRequest = { ...request, metric: metricKey as any };
          const rows =
            request.window === "last5"
              ? [
                  row({
                    id: 1,
                    name: "Rising Player",
                    metric: metricRequest.metric,
                    value: 4,
                    percentile: 90,
                    toiPerGameSeconds: 900,
                  }),
                  row({
                    id: 2,
                    name: "Falling Player",
                    metric: metricRequest.metric,
                    value: 1,
                    percentile: 35,
                    toiPerGameSeconds: 500,
                  }),
                ]
              : request.window === "last20"
                ? [
                    row({
                      id: 1,
                      name: "Rising Player",
                      metric: metricRequest.metric,
                      value: 2,
                      percentile: 50,
                      toiPerGameSeconds: 700,
                    }),
                    row({
                      id: 2,
                      name: "Falling Player",
                      metric: metricRequest.metric,
                      value: 3,
                      percentile: 80,
                      toiPerGameSeconds: 650,
                    }),
                  ]
                : [
                    row({
                      id: 1,
                      name: "Rising Player",
                      metric: metricRequest.metric,
                      value: 2.5,
                      percentile: 55,
                      toiPerGameSeconds: 720,
                    }),
                    row({
                      id: 2,
                      name: "Falling Player",
                      metric: metricRequest.metric,
                      value: 2.5,
                      percentile: 70,
                      toiPerGameSeconds: 640,
                    }),
                  ];
          surfaces.set(metricKey, response({ request: metricRequest, rows }));
        }
        return surfaces;
      },
    );
  });

  it("parses trending filters without requiring new data sources", () => {
    const request = parseTrendingRequest({
      entity: "skaters",
      season: "20252026",
      position: "F",
      deployment: "L2",
      strength: "5v5",
      min_gp: "3",
      min_toi: "120",
      metrics: "points_per_60,goals_per_60",
      sort_direction: "asc",
      limit: "10",
    });

    expect(request).toMatchObject({
      season: 20252026,
      position: "F",
      deployment: "L2",
      strength: "5v5",
      minGp: 3,
      minToiSeconds: 120,
      metricKeys: ["points_per_60", "goals_per_60"],
      sortDirection: "asc",
      limit: 10,
    });
  });

  it("sorts rows by last-5 versus last-20 percentile movement", async () => {
    const response = await buildTrendingSurface(
      parseTrendingRequest({
        entity: "skaters",
        season: "20252026",
        strength: "5v5",
        metrics: "points_per_60",
      }),
    );

    expect(
      buildContextualRankingsSurfacesMock.mock.calls.map(
        ([request]) => (request as ContextualRankingsRequest).window,
      ),
    ).toEqual(["season", "last20", "last10", "last5"]);
    expect(response.rows.map((entry) => entry.entity.name)).toEqual([
      "Rising Player",
      "Falling Player",
    ]);
    expect(response.rows[0]).toMatchObject({
      trendScore: 40,
      primaryDeltaLast5VsLast20: 40,
      toiTrend: {
        last5Seconds: 900,
        last20Seconds: 700,
        deltaLast5VsLast20Seconds: 200,
      },
      sourceState: "available",
    });
  });
});
