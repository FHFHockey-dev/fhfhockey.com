import { describe, expect, it } from "vitest";

import {
  buildContextualRankingRows,
  calculateMetricRawValue,
  getSampleConfidence,
  normalizeMetricValue,
  type ContextualRankingCandidate,
} from "./rankingCalculator";

function candidate(
  overrides: Partial<ContextualRankingCandidate> = {},
): ContextualRankingCandidate {
  return {
    entityId: 1,
    teamId: 10,
    metricKey: "goals_per_60",
    rawValue: 1,
    gamesPlayed: 10,
    toiSeconds: 3600,
    positionGroup: "forward",
    deploymentBucket: "L1",
    ...overrides,
  };
}

describe("rankingCalculator", () => {
  it("calculates raw rate values from stored numerator and denominator fields", () => {
    expect(
      calculateMetricRawValue({
        metricKey: "points_per_60",
        numerator: 4,
        denominator: 1800,
      }),
    ).toBe(8);

    expect(
      calculateMetricRawValue({
        metricKey: "points_per_60",
        numerator: 4,
        denominator: 0,
      }),
    ).toBeNull();
  });

  it("normalizes lower-is-better metrics before ranking", () => {
    expect(
      normalizeMetricValue({
        metricKey: "xga_per_60",
        rawValue: 2.5,
      }),
    ).toBe(-2.5);
    expect(
      normalizeMetricValue({
        metricKey: "goals_per_60",
        rawValue: 2.5,
      }),
    ).toBe(2.5);
  });

  it("calculates dense raw ranks with ties and better-than percentiles", () => {
    const rows = buildContextualRankingRows({
      metricKey: "goals_per_60",
      peerGroupType: "all_skaters",
      minimumPeerCount: 1,
      candidates: [
        candidate({ entityId: 1, rawValue: 5 }),
        candidate({ entityId: 2, rawValue: 10 }),
        candidate({ entityId: 3, rawValue: 10 }),
        candidate({ entityId: 4, rawValue: 1 }),
      ],
    });

    expect(
      rows.map((row) => ({
        id: row.entityId,
        rank: row.rawRank,
        percentile: row.percentile,
      })),
    ).toEqual([
      { id: 2, rank: 1, percentile: 50 },
      { id: 3, rank: 1, percentile: 50 },
      { id: 1, rank: 2, percentile: 25 },
      { id: 4, rank: 3, percentile: 0 },
    ]);
  });

  it("filters minimum GP and TOI before rank and percentile calculation", () => {
    const rows = buildContextualRankingRows({
      metricKey: "goals_per_60",
      peerGroupType: "all_skaters",
      minGp: 5,
      minToiSeconds: 500,
      minimumPeerCount: 1,
      candidates: [
        candidate({ entityId: 1, rawValue: 10, gamesPlayed: 4, toiSeconds: 800 }),
        candidate({ entityId: 2, rawValue: 6, gamesPlayed: 5, toiSeconds: 500 }),
        candidate({ entityId: 3, rawValue: 4, gamesPlayed: 8, toiSeconds: 900 }),
      ],
    });

    const lowSample = rows.find((row) => row.entityId === 1);
    const leader = rows.find((row) => row.entityId === 2);

    expect(lowSample?.rawRank).toBeNull();
    expect(lowSample?.minimumSampleMet).toBe(false);
    expect(lowSample?.warnings).toContain("sample_below_minimum");
    expect(leader?.rawRank).toBe(1);
    expect(leader?.qualifiedPeerCount).toBe(2);
  });

  it("supports position, deployment, and team peer groups", () => {
    const candidates = [
      candidate({ entityId: 1, rawValue: 9, positionGroup: "forward", deploymentBucket: "L1", teamId: 10 }),
      candidate({ entityId: 2, rawValue: 8, positionGroup: "forward", deploymentBucket: "L2", teamId: 20 }),
      candidate({ entityId: 3, rawValue: 7, positionGroup: "defense", deploymentBucket: "P1", teamId: 10 }),
    ];

    expect(
      buildContextualRankingRows({
        metricKey: "goals_per_60",
        peerGroupType: "position",
        candidates,
      })
        .map((row) => [row.entityId, row.peerGroupKey, row.rawRank])
        .sort((a, b) => String(a[1]).localeCompare(String(b[1])) || Number(a[0]) - Number(b[0])),
    ).toEqual([
      [3, "defense", 1],
      [1, "forward", 1],
      [2, "forward", 2],
    ]);

    expect(
      buildContextualRankingRows({
        metricKey: "goals_per_60",
        peerGroupType: "deployment",
        candidates,
      }).map((row) => row.peerGroupKey),
    ).toEqual(["L1", "L2", "P1"]);

    expect(
      buildContextualRankingRows({
        metricKey: "goals_per_60",
        peerGroupType: "team",
        candidates,
      }).map((row) => [row.entityId, row.peerGroupKey, row.rawRank]),
    ).toEqual([
      [1, "10", 1],
      [2, "20", 1],
      [3, "10", 2],
    ]);
  });

  it("returns small-peer and unavailable metadata without misleading ranks", () => {
    const small = buildContextualRankingRows({
      metricKey: "goals_per_60",
      peerGroupType: "all_skaters",
      candidates: [candidate()],
    });
    const unavailable = buildContextualRankingRows({
      metricKey: "rel_5v5_gf_percentage",
      peerGroupType: "all_skaters",
      candidates: [
        candidate({
          metricKey: "rel_5v5_gf_percentage",
          numerator: 5,
          denominator: 1000,
          rawValue: null,
        }),
      ],
    });

    expect(small[0]?.warnings).toContain("small_peer_group");
    expect(unavailable[0]?.rawRank).toBeNull();
    expect(unavailable[0]?.percentile).toBeNull();
    expect(unavailable[0]?.warnings).toContain("metric_unavailable");
  });

  it("labels low, medium, and high sample confidence", () => {
    expect(
      getSampleConfidence({
        gamesPlayed: 4,
        toiSeconds: 400,
        minGp: 5,
        minToiSeconds: 500,
        minimumSampleMet: false,
      }),
    ).toBe("low");
    expect(
      getSampleConfidence({
        gamesPlayed: 5,
        toiSeconds: 500,
        minGp: 5,
        minToiSeconds: 500,
        minimumSampleMet: true,
      }),
    ).toBe("medium");
    expect(
      getSampleConfidence({
        gamesPlayed: 10,
        toiSeconds: 1000,
        minGp: 5,
        minToiSeconds: 500,
        minimumSampleMet: true,
      }),
    ).toBe("high");
  });
});
