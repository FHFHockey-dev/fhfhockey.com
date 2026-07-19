import { describe, expect, it } from "vitest";

import {
  analyzeDraftRankingOrdering,
  summarizeDraftRankerHealth,
} from "./health";

describe("Draft Ranker health rules", () => {
  it("accepts healthy sparse ordering without requiring contiguous integers", () => {
    const health = analyzeDraftRankingOrdering({
      rankingId: "ranking-1",
      lockVersion: 4,
      orderKeys: Array.from({ length: 313 }, (_, index) => (index + 1) * 1024),
    });
    expect(health.minimumGap).toBe(1024);
    expect(health.normalizationRecommended).toBe(false);
    expect(health.underfilledTop250).toBe(false);
  });

  it("recommends normalization at exhausted gaps and blocks invalid keys", () => {
    const exhausted = analyzeDraftRankingOrdering({
      rankingId: "ranking-1",
      lockVersion: 4,
      orderKeys: [1024, 1025, 2048],
    });
    const invalid = analyzeDraftRankingOrdering({
      rankingId: "ranking-2",
      lockVersion: 1,
      orderKeys: [0, 1024],
    });
    expect(exhausted.normalizationRecommended).toBe(true);
    expect(invalid.unsafeOrderKeys).toBe(1);
    expect(
      summarizeDraftRankerHealth({
        orderings: [exhausted, invalid],
        identityReviewCandidateCount: 0,
        pendingIdentityReviewCount: 0,
        expiredActivePlacementCount: 0,
        incompleteSeedRunCount: 0,
        missingCommunitySnapshot: false,
        missingDiscoveryRefresh: false,
      }).status,
    ).toBe("blocked");
  });

  it("reports attention for recoverable identity and refresh conditions", () => {
    expect(
      summarizeDraftRankerHealth({
        orderings: [],
        identityReviewCandidateCount: 1,
        pendingIdentityReviewCount: 0,
        expiredActivePlacementCount: 0,
        incompleteSeedRunCount: 0,
        missingCommunitySnapshot: false,
        missingDiscoveryRefresh: false,
      }).status,
    ).toBe("attention");
  });
});
