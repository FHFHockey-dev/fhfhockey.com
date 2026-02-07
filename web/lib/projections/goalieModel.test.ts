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
});
