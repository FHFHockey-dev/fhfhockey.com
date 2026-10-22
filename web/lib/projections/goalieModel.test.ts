import { describe, expect, it } from "vitest";

import {
  GOALIE_B2B_SAVE_PCT_ADJUSTMENT,
  STARTER_DECISION_SHARE,
  shutoutProbability
} from "./goalie/goalieOutcomes";
import { computeGoalieProjectionModel, computeModeledSavePct } from "./goalieModel";

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

  it("uses quality-start stability to reduce volatility and blowup risk", () => {
    const lowQuality = computeGoalieProjectionModel({
      projectedShotsAgainst: 31,
      starterProbability: 0.82,
      projectedGoalsFor: 3,
      evidence: {
        recentStarts: 10,
        recentShotsAgainst: 300,
        recentGoalsAllowed: 28,
        seasonStarts: 28,
        seasonShotsAgainst: 860,
        seasonGoalsAllowed: 79,
        baselineStarts: 50,
        baselineShotsAgainst: 1500,
        baselineGoalsAllowed: 132,
        residualStdDev: 1.05,
        qualityStarts: 34,
        qualityStartsPct: 0.44
      }
    });

    const highQuality = computeGoalieProjectionModel({
      projectedShotsAgainst: 31,
      starterProbability: 0.82,
      projectedGoalsFor: 3,
      evidence: {
        recentStarts: 10,
        recentShotsAgainst: 300,
        recentGoalsAllowed: 28,
        seasonStarts: 28,
        seasonShotsAgainst: 860,
        seasonGoalsAllowed: 79,
        baselineStarts: 50,
        baselineShotsAgainst: 1500,
        baselineGoalsAllowed: 132,
        residualStdDev: 1.05,
        qualityStarts: 34,
        qualityStartsPct: 0.63
      }
    });

    expect(highQuality.volatilityIndex).toBeLessThan(lowQuality.volatilityIndex);
    expect(highQuality.blowupRisk).toBeLessThan(lowQuality.blowupRisk);
  });
});


describe("goalie model unavailable team offense", () => {
  const input = { projectedShotsAgainst: 30, starterProbability: 0.8, projectedGoalsFor: 3,
    evidence: { recentStarts: 10, recentShotsAgainst: 300, recentGoalsAllowed: 24, seasonStarts: 20, seasonShotsAgainst: 600,
      seasonGoalsAllowed: 50, baselineStarts: 60, baselineShotsAgainst: 1800, baselineGoalsAllowed: 162, residualStdDev: 1 } };
  it("withholds wins for unknown offense while preserving independent defense outputs and real zero offense", () => {
    const known = computeGoalieProjectionModel(input);
    const missing = computeGoalieProjectionModel({ ...input, projectedGoalsFor: null });
    const { winProbability: _known, ...knownDefense } = known;
    const { winProbability: _missing, ...missingDefense } = missing;
    expect(missing.winProbability).toBeNull(); expect(missingDefense).toEqual(knownDefense);
    expect(computeGoalieProjectionModel({ ...input, projectedGoalsFor: 0 }).winProbability).not.toBeNull();
  });
  it.each([NaN, Infinity, -1, undefined])("rejects invalid offense instead of zero filling it: %s", value => {
    expect(() => computeGoalieProjectionModel({ ...input, projectedGoalsFor: value as number })).toThrow();
  });
});

describe("goalie model beta-binomial save %, paired wins and shots-mixture shutouts", () => {
  const evidence = { recentStarts: 20, recentShotsAgainst: 560, recentGoalsAllowed: 30, seasonStarts: 30, seasonShotsAgainst: 840,
    seasonGoalsAllowed: 70, baselineStarts: 200, baselineShotsAgainst: 6000, baselineGoalsAllowed: 540, residualStdDev: 1 };
  const base = { projectedShotsAgainst: 30, starterProbability: 0.7, projectedGoalsFor: 3, evidence, leagueSavePct: 0.9 };

  it("shrinks all evidence once toward the league mean with the fitted k and ignores hot recent form", () => {
    // (6000 - 540 + 6000 * 0.9) / (6000 + 6000) = 0.905
    expect(computeModeledSavePct({ evidence, leagueSavePct: 0.9 })).toBeCloseTo(0.905, 10);
    const hot = { ...evidence, recentShotsAgainst: 560, recentGoalsAllowed: 10 };
    expect(computeModeledSavePct({ evidence: hot, leagueSavePct: 0.9 })).toBeCloseTo(0.905, 10);
    expect(computeGoalieProjectionModel(base).modeledSavePct).toBeCloseTo(0.905, 10);
  });

  it("applies the additive context adjustment (B2B) after shrinkage", () => {
    const rested = computeGoalieProjectionModel(base);
    const b2b = computeGoalieProjectionModel({ ...base, savePctAdjustment: GOALIE_B2B_SAVE_PCT_ADJUSTMENT });
    expect(b2b.modeledSavePct - rested.modeledSavePct).toBeCloseTo(GOALIE_B2B_SAVE_PCT_ADJUSTMENT, 10);
    expect(b2b.projectedGoalsAllowed).toBeGreaterThan(rested.projectedGoalsAllowed);
  });

  it("scales a supplied paired team win probability by the decision share and P(start)", () => {
    const model = computeGoalieProjectionModel({ ...base, teamWinProbabilityIfStarts: 0.6 });
    expect(model.winProbability).toBeCloseTo(0.6 * STARTER_DECISION_SHARE * 0.7, 10);
    expect(computeGoalieProjectionModel({ ...base, teamWinProbabilityIfStarts: null }).winProbability).toBeNull();
  });

  it("derives shutouts from the shots-against mixture times P(start)", () => {
    const model = computeGoalieProjectionModel(base);
    expect(model.shutoutProbability).toBeCloseTo(
      shutoutProbability({ expectedShotsAgainst: 30, savePct: model.modeledSavePct }) * 0.7, 10);
  });
});
