import { describe, expect, it } from "vitest";

import { computeGoalieProjectionModel } from "./goalieModel";

describe("computeGoalieProjectionModel", () => {
  it("regresses save percentage toward league baseline on small samples", () => {
    const result = computeGoalieProjectionModel({
      projectedShotsAgainst: 30,
      starterProbability: 0.8,
      projectedGoalsFor: 3,
      evidence: {
        recentStarts: 5,
        recentShotsAgainst: 120,
        recentGoalsAllowed: 8,
        seasonStarts: 18,
        seasonShotsAgainst: 560,
        seasonGoalsAllowed: 49,
        baselineStarts: 12,
        baselineShotsAgainst: 340,
        baselineGoalsAllowed: 25,
        residualStdDev: 1.1
      },
      leagueSavePct: 0.9
    });

    expect(result.modeledSavePct).toBeGreaterThan(0.89);
    expect(result.modeledSavePct).toBeLessThan(0.93);
    expect(result.projectedGoalsAllowed).toBeGreaterThan(0);
    expect(result.projectedSaves).toBeGreaterThan(0);
  });

  it("increases blowup risk and lowers reliability for volatile profiles", () => {
    const stable = computeGoalieProjectionModel({
      projectedShotsAgainst: 32,
      starterProbability: 0.8,
      projectedGoalsFor: 3.1,
      evidence: {
        recentStarts: 10,
        recentShotsAgainst: 290,
        recentGoalsAllowed: 26,
        seasonStarts: 30,
        seasonShotsAgainst: 900,
        seasonGoalsAllowed: 82,
        baselineStarts: 40,
        baselineShotsAgainst: 1200,
        baselineGoalsAllowed: 112,
        residualStdDev: 0.5
      }
    });

    const volatile = computeGoalieProjectionModel({
      projectedShotsAgainst: 32,
      starterProbability: 0.8,
      projectedGoalsFor: 3.1,
      evidence: {
        recentStarts: 10,
        recentShotsAgainst: 290,
        recentGoalsAllowed: 26,
        seasonStarts: 30,
        seasonShotsAgainst: 900,
        seasonGoalsAllowed: 82,
        baselineStarts: 40,
        baselineShotsAgainst: 1200,
        baselineGoalsAllowed: 112,
        residualStdDev: 2.1
      }
    });

    expect(volatile.blowupRisk).toBeGreaterThan(stable.blowupRisk);
    expect(stable.reliabilityTier).toBe("STABLE");
    expect(volatile.reliabilityTier).toBe("VOLATILE");
  });

  it("applies stronger regression and lower confidence on very low samples", () => {
    const lowSample = computeGoalieProjectionModel({
      projectedShotsAgainst: 30,
      starterProbability: 0.8,
      projectedGoalsFor: 3,
      evidence: {
        recentStarts: 2,
        recentShotsAgainst: 45,
        recentGoalsAllowed: 2,
        seasonStarts: 4,
        seasonShotsAgainst: 95,
        seasonGoalsAllowed: 8,
        baselineStarts: 10,
        baselineShotsAgainst: 260,
        baselineGoalsAllowed: 20,
        residualStdDev: 0.9
      },
      leagueSavePct: 0.9
    });

    const highSample = computeGoalieProjectionModel({
      projectedShotsAgainst: 30,
      starterProbability: 0.8,
      projectedGoalsFor: 3,
      evidence: {
        recentStarts: 12,
        recentShotsAgainst: 360,
        recentGoalsAllowed: 24,
        seasonStarts: 36,
        seasonShotsAgainst: 1100,
        seasonGoalsAllowed: 82,
        baselineStarts: 55,
        baselineShotsAgainst: 1700,
        baselineGoalsAllowed: 130,
        residualStdDev: 0.9
      },
      leagueSavePct: 0.9
    });

    expect(Math.abs(lowSample.modeledSavePct - 0.9)).toBeLessThan(
      Math.abs(highSample.modeledSavePct - 0.9)
    );
    expect(lowSample.confidenceTier).not.toBe("HIGH");
  });
});
