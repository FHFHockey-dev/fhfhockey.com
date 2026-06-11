import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildContextualRankingsSurfaceMock } = vi.hoisted(() => ({
  buildContextualRankingsSurfaceMock: vi.fn(),
}));

vi.mock("./rankingQueries", () => ({
  buildContextualRankingsSurface: buildContextualRankingsSurfaceMock,
}));

import {
  buildRankingsSplitsSurface,
  parseRankingsSplitsRequest,
} from "./splits";
import type {
  ContextualRankingApiRow,
  ContextualRankingsRequest,
  ContextualRankingsResponse,
} from "./rankingTypes";

function rowFor(
  request: ContextualRankingsRequest,
  percentile: number,
): ContextualRankingApiRow {
  return {
    entity: {
      id: 1,
      name: "Matt Savoie",
      position: "C",
      positionGroup: "forward",
      imageUrl: null,
    },
    team: {
      id: 7,
      abbreviation: "BUF",
      name: "Buffalo Sabres",
    },
    deployment: {
      ev: "L2",
      pp: "PP1",
      pk: null,
      confidence: "medium",
    },
    sample: {
      gamesPlayed: 12,
      toiSeconds: 8400,
      toiPerGameSeconds: 700,
      confidence: "high",
      minimumSampleMet: true,
    },
    metric: {
      key: request.metric,
      value: percentile / 40,
      formattedValue: (percentile / 40).toFixed(2),
      rawRank: Math.max(1, 100 - Math.round(percentile)),
      percentile,
      qualifiedPeerCount: 100,
    },
    peerGroup: {
      type: request.peerGroupType,
      key: request.deployment,
    },
    tags: [request.strength, request.window, request.deployment],
    warnings: [],
    explanationItems: [],
  };
}

function responseFor(
  request: ContextualRankingsRequest,
  rows: ContextualRankingApiRow[],
): ContextualRankingsResponse {
  return {
    success: true,
    request,
    rankings: rows,
    meta: {
      generatedAt: "2026-06-08T00:00:00.000Z",
      snapshotDate: "2026-04-16",
      snapshotUpdatedAt: "2026-04-16T05:00:00.000Z",
      latestAvailableSnapshotDate: "2026-04-16",
      snapshotSelectionReason: "latest_available",
      sourceTable: "rolling_player_game_metrics",
      metric: {
        key: request.metric,
        displayName: "Points/60",
        availabilityStatus: "available",
        higherIsBetter: true,
        description: null,
        formulaDescription: null,
        applicableStrengthStates: ["all", "5v5", "ev", "pp", "pk"],
        denominatorKey: null,
        denominatorDescription: null,
        sampleRequirements: null,
        methodologyVersion: null,
        methodologyUpdatedAt: null,
        sourceQualityFlags: [],
      },
      unavailable: false,
      rowCount: rows.length,
      limit: request.limit,
      message: null,
    },
  };
}

describe("rankings splits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildContextualRankingsSurfaceMock.mockImplementation(
      async (request: ContextualRankingsRequest) => {
        const basePercentile =
          request.strength === "pp"
            ? 91
            : request.window === "last5"
              ? 84
              : request.deployment === "L2"
                ? 88
                : 76;
        return responseFor(request, [rowFor(request, basePercentile)]);
      },
    );
  });

  it("parses a bounded splits request from ranking query params", () => {
    const request = parseRankingsSplitsRequest({
      entity: "skaters",
      season: "20252026",
      position: "F",
      deployment: "L2",
      strength: "5v5",
      metric: "points_per_60",
      min_gp: "1",
      min_toi: "300",
      limit: "200",
    });

    expect(request).toMatchObject({
      season: 20252026,
      position: "F",
      deployment: "L2",
      strength: "5v5",
      metric: "points_per_60",
      limit: 50,
    });
  });

  it("builds strength, window, and deployment split rows from existing ranking surfaces", async () => {
    const request = parseRankingsSplitsRequest({
      entity: "skaters",
      season: "20252026",
      position: "F",
      deployment: "L2",
      strength: "5v5",
      metric: "points_per_60",
      min_gp: "1",
      min_toi: "300",
      limit: "25",
    });

    const payload = await buildRankingsSplitsSurface(request);

    expect(payload.rows).toHaveLength(1);
    expect(payload.sections.map((section) => section.key)).toEqual([
      "strength",
      "window",
      "deployment",
    ]);
    expect(payload.rows[0]?.splits["strength:pp"]?.percentile).toBe(91);
    expect(payload.rows[0]?.splits["window:last5"]?.percentile).toBe(84);
    expect(payload.rows[0]?.splits["deployment:L2"]?.percentile).toBe(88);
    expect(payload.meta.unsupportedSplits[0]?.key).toBe("home_away");
    expect(buildContextualRankingsSurfaceMock).toHaveBeenCalledWith(
      expect.objectContaining({ entityIds: [1], strength: "pp" }),
    );
  });
});
