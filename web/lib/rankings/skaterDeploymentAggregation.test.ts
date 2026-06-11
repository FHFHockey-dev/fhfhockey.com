import { describe, expect, it } from "vitest";

import {
  assignEvDeploymentBucketFromToiRank,
  buildSkaterDeploymentAggregate,
  normalizeEvDeploymentBucket,
  normalizeProjectionEvenStrengthRoleToRankingsBucket,
  normalizePpDeploymentBucket,
  type SkaterDeploymentContextRow,
} from "./skaterDeploymentAggregation";

function contextRow(
  overrides: Partial<SkaterDeploymentContextRow> = {},
): SkaterDeploymentContextRow {
  return {
    playerId: 1,
    teamId: 10,
    gameId: 100,
    gameDate: "2026-01-10",
    positionGroup: "forward",
    lineComboGroup: "forward",
    lineComboSlot: 1,
    evToiPerGameSeconds: 900,
    ppUnit: 1,
    ppToiPerGameSeconds: 180,
    pkToiPerGameSeconds: null,
    ...overrides,
  };
}

describe("skaterDeploymentAggregation", () => {
  it("normalizes forward lines and defense pairs into PRD buckets", () => {
    expect(
      normalizeEvDeploymentBucket({
        lineComboGroup: "forward",
        lineComboSlot: 2,
      }),
    ).toBe("L2");
    expect(
      normalizeEvDeploymentBucket({
        lineComboGroup: "defense",
        lineComboSlot: 2,
      }),
    ).toBe("P2");
  });

  it("normalizes projection defense role tags at the rankings boundary", () => {
    expect(normalizeProjectionEvenStrengthRoleToRankingsBucket("L2")).toBe("L2");
    expect(normalizeProjectionEvenStrengthRoleToRankingsBucket("D1")).toBe("P1");
    expect(normalizeProjectionEvenStrengthRoleToRankingsBucket("D2")).toBe("P2");
    expect(normalizeProjectionEvenStrengthRoleToRankingsBucket("D3")).toBe("P3");
    expect(normalizeProjectionEvenStrengthRoleToRankingsBucket("DEFENSE_PAIR_1")).toBeNull();
  });

  it("uses lineCombinations arrays as the trusted EV source when provided", () => {
    const aggregate = buildSkaterDeploymentAggregate({
      playerId: 4,
      teamId: 10,
      window: "last5",
      teamGamesAvailable: 5,
      rows: [
        contextRow({
          playerId: 4,
          lineComboGroup: null,
          lineComboSlot: null,
          lineCombination: {
            forwards: [1, 2, 3, 4, 5, 6],
            defensemen: [7, 8],
            goalies: [],
          },
        }),
      ],
    });

    expect(aggregate.evDeploymentBucket).toBe("L2");
    expect(aggregate.source).toBe("lineCombinations");
  });

  it("falls back to EV TOI rank, not total TOI, when line labels are unavailable", () => {
    expect(
      assignEvDeploymentBucketFromToiRank({
        positionGroup: "forward",
        evToiRankInPositionGroup: 5,
      }),
    ).toBe("L2");
    expect(
      assignEvDeploymentBucketFromToiRank({
        positionGroup: "defense",
        evToiRankInPositionGroup: 5,
      }),
    ).toBe("P3");

    const aggregate = buildSkaterDeploymentAggregate({
      playerId: 1,
      teamId: 10,
      window: "last5",
      teamGamesAvailable: 5,
      rows: [
        contextRow({
          lineComboGroup: null,
          lineComboSlot: null,
          evToiRankInPositionGroup: 5,
        }),
      ],
    });

    expect(aggregate.evDeploymentBucket).toBe("L2");
    expect(aggregate.source).toBe("ev_toi_fallback");
  });

  it("separates EV deployment from PP and PK buckets", () => {
    expect(normalizePpDeploymentBucket(2)).toBe("PP2");

    const aggregate = buildSkaterDeploymentAggregate({
      playerId: 1,
      teamId: 10,
      window: "last5",
      teamGamesAvailable: 5,
      rows: [
        contextRow({ ppUnit: 2, pkToiPerGameSeconds: 120 }),
        contextRow({ gameDate: "2026-01-09", ppUnit: 2, pkToiPerGameSeconds: 75 }),
      ],
    });

    expect(aggregate.evDeploymentBucket).toBe("L1");
    expect(aggregate.ppDeploymentBucket).toBe("PP2");
    expect(aggregate.pkDeploymentBucket).toBe("PK1");
    expect(aggregate.averagePpToiPerGameSeconds).toBe(180);
  });

  it("scopes deployment by team so traded players do not mix contexts", () => {
    const aggregate = buildSkaterDeploymentAggregate({
      playerId: 1,
      teamId: 10,
      window: "last5",
      teamGamesAvailable: 5,
      rows: [
        contextRow({ teamId: 10, lineComboSlot: 1 }),
        contextRow({ teamId: 20, lineComboSlot: 4 }),
      ],
    });

    expect(aggregate.gamesTracked).toBe(1);
    expect(aggregate.evDeploymentBucket).toBe("L1");
  });

  it("derives high, mixed, and low confidence from coverage and role consistency", () => {
    const high = buildSkaterDeploymentAggregate({
      playerId: 1,
      teamId: 10,
      window: "last5",
      teamGamesAvailable: 5,
      rows: [0, 1, 2, 3, 4].map((offset) =>
        contextRow({ gameDate: `2026-01-${10 - offset}` }),
      ),
    });
    const mixed = buildSkaterDeploymentAggregate({
      playerId: 1,
      teamId: 10,
      window: "last5",
      teamGamesAvailable: 5,
      rows: [
        contextRow({ lineComboSlot: 1 }),
        contextRow({ gameDate: "2026-01-09", lineComboSlot: 2 }),
        contextRow({ gameDate: "2026-01-08", lineComboSlot: 2 }),
      ],
    });
    const low = buildSkaterDeploymentAggregate({
      playerId: 1,
      teamId: 10,
      window: "last5",
      teamGamesAvailable: 5,
      rows: [],
    });

    expect(high.deploymentConfidence).toBe("high");
    expect(mixed.deploymentConfidence).toBe("mixed");
    expect(low.deploymentConfidence).toBe("low");
  });
});
