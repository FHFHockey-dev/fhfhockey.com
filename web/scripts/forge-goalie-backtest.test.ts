import { describe, expect, it } from "vitest";

import { biasRmse, brierScore, pairedWinSums, parseFixture, predictLegacy, predictNew, reliabilityBins } from "./forge-goalie-backtest";

// Synthetic rows in the fixture format (not real games).
const fixture = "1,0,30,2,1,0,6000,540,9050,1,300,320,280,9000,1;1,1,28,3,0,0,1500,150,8990,2,290,280,320,9000,0;" +
  "2,0,25,0,1,1,0,0,8600,280,300,300,9000,1";

describe("forge goalie backtest scorer", () => {
  it("parses rows, reading a missing (null) rest flag as 0", () => {
    const rows = parseFixture(fixture);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ backToBack: true, startsLast14Days: 0, projectedShotsAgainst: 30, lambdaFor: 3.2, leagueSavePct: 0.9 });
    expect(rows[1]).toMatchObject({ backToBack: false, startsLast14Days: 5 });
    expect(rows[2]).toMatchObject({ backToBack: false, startsLast14Days: 0, evidenceShots: 0, teamWon: 1 });
    expect(() => parseFixture("1,2,3")).toThrow();
  });

  it("pairs new team win probabilities per game but not the legacy ones", () => {
    const rows = parseFixture(fixture);
    expect(pairedWinSums(rows, (r) => predictNew(r).teamWinProbability!).mean).toBeCloseTo(1, 12);
    expect(pairedWinSums(rows, (r) => predictLegacy(r).winProbability).games).toBe(1);
  });

  it("scores bias, RMSE, Brier and reliability", () => {
    expect(biasRmse([1, 3], [2, 2])).toEqual({ n: 2, bias: 0, rmse: 1 });
    expect(brierScore([0.5, 1], [1, 1])).toBeCloseTo(0.125, 12);
    expect(reliabilityBins([0.1, 0.2, 0.8, 0.9], [0, 0, 1, 1], 2)).toEqual([
      { n: 2, meanPredicted: 0.15000000000000002, observed: 0 }, { n: 2, meanPredicted: 0.8500000000000001, observed: 1 }]);
  });
});
