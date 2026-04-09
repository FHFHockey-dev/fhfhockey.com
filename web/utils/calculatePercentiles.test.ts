import { describe, expect, it } from "vitest";

import {
  calculatePercentileRank,
  calculatePlayerRank,
  calculateRankingResult
} from "./calculatePercentiles";

describe("calculatePercentiles", () => {
  it("uses one shared tie-aware ranking result for percentile and ordinal rank", () => {
    const data = [
      { player_id: 1, value: 40 },
      { player_id: 2, value: 20 },
      { player_id: 3, value: 20 },
      { player_id: 4, value: 10 }
    ];

    const result = calculateRankingResult(data, 2, true);

    expect(result).toEqual({
      percentile: 0.5,
      rank: 2
    });
    expect(calculatePercentileRank(data, 2, "value", true)).toBe(0.5);
    expect(calculatePlayerRank(data, 2, true)).toBe(2);
  });

  it("handles lower-is-better metrics without diverging rank semantics", () => {
    const data = [
      { player_id: 1, value: 1.2 },
      { player_id: 2, value: 2.4 },
      { player_id: 3, value: 3.8 }
    ];

    const result = calculateRankingResult(data, 1, false);

    expect(result).toEqual({
      percentile: 5 / 6,
      rank: 1
    });
    expect(calculatePercentileRank(data, 1, "value", false)).toBeCloseTo(
      5 / 6
    );
    expect(calculatePlayerRank(data, 1, false)).toBe(1);
  });

  it("returns null when the target player is not in the cohort", () => {
    const data = [
      { player_id: 1, value: 10 },
      { player_id: 2, value: 20 }
    ];

    expect(calculateRankingResult(data, 999, true)).toBeNull();
    expect(calculatePercentileRank(data, 999, "value", true)).toBeNull();
    expect(calculatePlayerRank(data, 999, true)).toBeNull();
  });
});
