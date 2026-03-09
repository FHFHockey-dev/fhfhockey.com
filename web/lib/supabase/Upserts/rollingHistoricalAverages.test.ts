import { describe, expect, it } from "vitest";

import {
  createHistoricalAverageAccumulator,
  createHistoricalGpPctAccumulator,
  getHistoricalAverageSnapshot,
  getHistoricalGpPctSnapshot,
  updateHistoricalAverageAccumulator,
  updateHistoricalGpPctAccumulator
} from "./rollingHistoricalAverages";

describe("rollingHistoricalAverages", () => {
  it("computes season, 3-year, and career averages", () => {
    const acc = createHistoricalAverageAccumulator();
    updateHistoricalAverageAccumulator(acc, 20232024, 1);
    updateHistoricalAverageAccumulator(acc, 20232024, 3);
    updateHistoricalAverageAccumulator(acc, 20242025, 5);
    updateHistoricalAverageAccumulator(acc, 20252026, 7);

    expect(getHistoricalAverageSnapshot(acc, 20252026)).toEqual({
      season: 7,
      threeYear: 4,
      career: 4
    });
  });

  it("computes season, 3-year, and career gp ratios across team-season buckets", () => {
    const acc = createHistoricalGpPctAccumulator();
    updateHistoricalGpPctAccumulator(acc, {
      season: 20232024,
      teamId: 1,
      playedThisGame: true,
      teamGamesPlayed: 10
    });
    updateHistoricalGpPctAccumulator(acc, {
      season: 20242025,
      teamId: 2,
      playedThisGame: true,
      teamGamesPlayed: 20
    });
    updateHistoricalGpPctAccumulator(acc, {
      season: 20252026,
      teamId: 2,
      playedThisGame: true,
      teamGamesPlayed: 5
    });
    updateHistoricalGpPctAccumulator(acc, {
      season: 20252026,
      teamId: 2,
      playedThisGame: true,
      teamGamesPlayed: 8
    });

    expect(getHistoricalGpPctSnapshot(acc, 20252026, 2)).toEqual({
      season: 0.25,
      threeYear: Number((4 / 38).toFixed(6)),
      career: Number((4 / 38).toFixed(6))
    });
  });
});
