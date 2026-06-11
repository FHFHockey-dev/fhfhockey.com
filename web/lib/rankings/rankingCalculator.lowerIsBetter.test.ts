import { describe, expect, it, vi } from "vitest";

vi.mock("./metricDefinitions", async () => {
  const actual =
    await vi.importActual<typeof import("./metricDefinitions")>(
      "./metricDefinitions",
    );

  return {
    ...actual,
    getContextualRankingMetricDefinition: (metricKey: string) => {
      const definition = actual.getContextualRankingMetricDefinition(metricKey);
      if (metricKey !== "xga_per_60" || !definition) return definition;

      return {
        ...definition,
        availabilityStatus: "available" as const,
      };
    },
  };
});

import {
  buildContextualRankingRows,
  type ContextualRankingCandidate,
} from "./rankingCalculator";

function candidate(
  overrides: Partial<ContextualRankingCandidate>,
): ContextualRankingCandidate {
  return {
    entityId: 1,
    teamId: 10,
    metricKey: "xga_per_60",
    rawValue: 1,
    gamesPlayed: 10,
    toiSeconds: 1200,
    positionGroup: "defense",
    deploymentBucket: "P1",
    ...overrides,
  };
}

describe("rankingCalculator lower-is-better ranking", () => {
  it("ranks lower raw metric values ahead of higher raw metric values", () => {
    const rows = buildContextualRankingRows({
      metricKey: "xga_per_60",
      peerGroupType: "all_skaters",
      minimumPeerCount: 1,
      candidates: [
        candidate({ entityId: 1, rawValue: 2.9 }),
        candidate({ entityId: 2, rawValue: 1.4 }),
        candidate({ entityId: 3, rawValue: 2.1 }),
      ],
    });

    expect(
      rows.map((row) => ({
        id: row.entityId,
        value: row.calculatedRawValue,
        rank: row.rawRank,
        percentile: row.percentile,
      })),
    ).toEqual([
      { id: 2, value: 1.4, rank: 1, percentile: 66.667 },
      { id: 3, value: 2.1, rank: 2, percentile: 33.333 },
      { id: 1, value: 2.9, rank: 3, percentile: 0 },
    ]);
  });
});
