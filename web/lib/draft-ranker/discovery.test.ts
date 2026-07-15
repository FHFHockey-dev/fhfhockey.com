import { describe, expect, it } from "vitest";

import {
  buildOpportunityChangeSignals,
  buildOwnershipRiserSignals,
  buildProjectionBackedSignals,
  buildProjectionConsensus,
  deriveOwnerRelativeDiscovery,
  stableDiscoveryHash,
  type ProjectionRankObservation,
} from "./discovery";

const AS_OF = "2026-09-01T12:00:00.000Z";
const EXPIRES = "2026-09-03T12:00:00.000Z";

function projection(
  overrides: Partial<ProjectionRankObservation>,
): ProjectionRankObservation {
  return {
    fhfhPlayerId: 10,
    sourceKey: "source-a",
    sourceDisplayName: "Source A",
    sourceSeasonId: 20262027,
    projectionRank: 40,
    projectedFantasyPoints: 300,
    projectedGames: 82,
    sourceObservedAt: "2026-09-01T08:00:00.000Z",
    expiresAt: EXPIRES,
    ...overrides,
  };
}

describe("Draft Ranker discovery algorithms", () => {
  it("requires two current independent sources and uses their median rank", () => {
    const result = buildProjectionConsensus({
      asOf: AS_OF,
      observations: [
        projection({ sourceKey: "source-a", projectionRank: 20 }),
        projection({
          sourceKey: "source-b",
          sourceDisplayName: "Source B",
          projectionRank: 30,
        }),
        projection({
          fhfhPlayerId: 11,
          sourceKey: "source-a",
          projectionRank: 5,
        }),
        projection({
          fhfhPlayerId: 12,
          sourceKey: "last-season",
          sourceSeasonId: 20252026,
          projectionRank: 1,
        }),
      ],
    });

    expect(result).toEqual([
      expect.objectContaining({
        fhfh_player_id: 10,
        consensus_rank: 25,
        source_count: 2,
        source_keys: ["source-a", "source-b"],
      }),
    ]);
  });

  it("fails closed for stale and conflicting per-source projection rows", () => {
    const result = buildProjectionConsensus({
      asOf: AS_OF,
      observations: [
        projection({ sourceKey: "source-a", projectionRank: 20 }),
        projection({ sourceKey: "source-a", projectionRank: 21 }),
        projection({
          sourceKey: "source-b",
          projectionRank: 30,
          expiresAt: "2026-08-31T12:00:00.000Z",
        }),
      ],
    });
    expect(result).toEqual([]);
  });

  it("reproduces projection-gap and previously-undrafted thresholds", () => {
    const consensus = buildProjectionConsensus({
      asOf: AS_OF,
      observations: [
        projection({ fhfhPlayerId: 10, sourceKey: "a", projectionRank: 50 }),
        projection({ fhfhPlayerId: 10, sourceKey: "b", projectionRank: 60 }),
        projection({ fhfhPlayerId: 11, sourceKey: "a", projectionRank: 299 }),
        projection({ fhfhPlayerId: 11, sourceKey: "b", projectionRank: 301 }),
      ],
    });
    const signals = buildProjectionBackedSignals({
      consensus,
      priorAdp: [
        {
          fhfhPlayerId: 10,
          priorAdp: 80,
          adpState: "known",
          sourceKey: "yahoo",
        },
        {
          fhfhPlayerId: 11,
          priorAdp: null,
          adpState: "previously_undrafted",
          sourceKey: "yahoo",
        },
      ],
    });
    expect(signals.map((signal) => signal.signal_type)).toEqual([
      "projection_gap",
      "previously_undrafted",
    ]);
    expect(signals[0].evidence).toMatchObject({ rankGap: 25 });
    expect(signals[1].evidence).toMatchObject({ consensusRank: 300 });
  });

  it("uses a real seven-day ownership baseline and suppresses stale timelines", () => {
    const result = buildOwnershipRiserSignals({
      asOf: "2026-07-15T12:00:00.000Z",
      offseason: true,
      candidates: [
        {
          fhfhPlayerId: 10,
          timeline: [
            { date: "2026-07-07", value: 20 },
            { date: "2026-07-14", value: 25 },
          ],
        },
        {
          fhfhPlayerId: 11,
          timeline: [
            { date: "2026-06-01", value: 10 },
            { date: "2026-06-08", value: 30 },
          ],
        },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      fhfh_player_id: 10,
      signal_type: "ownership_riser",
      score: 5,
      reason_code: "ownership_gain_five_points",
    });
  });

  it("allows only verified, unexpired opportunity changes with corroboration", () => {
    const signals = buildOpportunityChangeSignals({
      asOf: AS_OF,
      candidates: [
        {
          fhfhPlayerId: 10,
          currentTeamId: 2,
          priorTeamId: 1,
          eventType: "CALLUP",
          eventConfidence: 0.8,
          eventObservedAt: "2026-09-01T08:00:00.000Z",
          eventExpiresAt: EXPIRES,
          projectionRankGain: null,
          deploymentShareGain: null,
          sourceKeys: ["roster", "event"],
        },
        {
          fhfhPlayerId: 11,
          currentTeamId: 1,
          priorTeamId: 1,
          eventType: "LINE_CHANGE",
          eventConfidence: 0.8,
          eventObservedAt: "2026-09-01T08:00:00.000Z",
          eventExpiresAt: EXPIRES,
          projectionRankGain: null,
          deploymentShareGain: 0.15,
          sourceKeys: ["deployment", "event"],
        },
        {
          fhfhPlayerId: 12,
          currentTeamId: 1,
          priorTeamId: 1,
          eventType: "LINE_CHANGE",
          eventConfidence: 0.7,
          eventObservedAt: "2026-09-01T08:00:00.000Z",
          eventExpiresAt: EXPIRES,
          projectionRankGain: 40,
          deploymentShareGain: null,
          sourceKeys: ["projection", "event"],
        },
      ],
    });
    expect(signals.map((signal) => signal.fhfh_player_id)).toEqual([10, 11]);
  });

  it("derives owner cutoff context without persisting private rank", () => {
    expect(
      deriveOwnerRelativeDiscovery({ personalRank: 260, consensusRank: 220 }),
    ).toBe("cutoff_challenger");
    expect(
      deriveOwnerRelativeDiscovery({ personalRank: 150, consensusRank: 120 }),
    ).toBe("projection_gap");
    expect(
      deriveOwnerRelativeDiscovery({ personalRank: 260, consensusRank: 240 }),
    ).toBeNull();
  });

  it("hashes equivalent object key order identically", () => {
    expect(stableDiscoveryHash({ a: 1, b: { c: 2 } })).toBe(
      stableDiscoveryHash({ b: { c: 2 }, a: 1 }),
    );
  });
});
