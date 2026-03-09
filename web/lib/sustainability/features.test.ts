import { describe, expect, it } from "vitest";

import {
  calculatePer60Rate,
  calculatePer60Rates,
  calculatePerGameRate,
  calculatePerGameRates,
  calculateWeightedRate,
  calculateZScore,
  calculateZScores,
  getDefaultWindowWeights,
  normalizeWindowWeights
} from "./features";

describe("sustainability features rate calculators", () => {
  it("calculates a per-60 rate from totals and toi seconds", () => {
    expect(calculatePer60Rate(5, 900)).toBe(20);
    expect(calculatePer60Rate(1.25, 750, 4)).toBe(6);
  });

  it("returns null for invalid per-60 inputs", () => {
    expect(calculatePer60Rate(null, 900)).toBeNull();
    expect(calculatePer60Rate(5, null)).toBeNull();
    expect(calculatePer60Rate(5, 0)).toBeNull();
    expect(calculatePer60Rate(Number.NaN, 900)).toBeNull();
  });

  it("calculates a per-game rate from totals and games played", () => {
    expect(calculatePerGameRate(6, 4)).toBe(1.5);
    expect(calculatePerGameRate(5, 3, 4)).toBe(1.6667);
  });

  it("returns null for invalid per-game inputs", () => {
    expect(calculatePerGameRate(undefined, 4)).toBeNull();
    expect(calculatePerGameRate(6, undefined)).toBeNull();
    expect(calculatePerGameRate(6, 0)).toBeNull();
  });

  it("calculates typed per-60 metric maps", () => {
    const rates = calculatePer60Rates({
      totals: {
        shots: 6,
        ixg: 1.5
      },
      toiSeconds: 1200
    });

    expect(rates).toEqual({
      shots: 18,
      ixg: 4.5
    });
  });

  it("calculates typed per-game metric maps", () => {
    const rates = calculatePerGameRates({
      totals: {
        goals: 4,
        assists: 8
      },
      gamesPlayed: 4,
      precision: 2
    });

    expect(rates).toEqual({
      goals: 1,
      assists: 2
    });
  });

  it("calculates recent-vs-baseline deltas and z-scores", () => {
    expect(calculateZScore(8, 5, 1.5)).toEqual({
      raw: 8,
      baseline: 5,
      delta: 3,
      zScore: 2
    });
  });

  it("clips z-scores and applies an sd floor", () => {
    expect(calculateZScore(10, 4, 0, { clip: 3 })).toEqual({
      raw: 10,
      baseline: 4,
      delta: 6,
      zScore: 3
    });
  });

  it("returns null z-scores when baseline context is incomplete", () => {
    expect(calculateZScore(8, null, 2)).toEqual({
      raw: 8,
      baseline: null,
      delta: null,
      zScore: null
    });

    expect(calculateZScore(8, 5, null)).toEqual({
      raw: 8,
      baseline: 5,
      delta: 3,
      zScore: null
    });
  });

  it("calculates typed z-score maps", () => {
    const scores = calculateZScores({
      recent: {
        shots_per_60: 11,
        ixg_per_60: 0.8
      },
      baseline: {
        shots_per_60: 9,
        ixg_per_60: 0.5
      },
      standardDeviation: {
        shots_per_60: 1,
        ixg_per_60: 0.1
      },
      clip: 3
    });

    expect(scores).toEqual({
      shots_per_60: {
        raw: 11,
        baseline: 9,
        delta: 2,
        zScore: 2
      },
      ixg_per_60: {
        raw: 0.8,
        baseline: 0.5,
        delta: 0.3,
        zScore: 3
      }
    });
  });

  it("normalizes window weights and favors shorter windows by default", () => {
    expect(normalizeWindowWeights({ l3: 3, l5: 2, l10: 1 })).toEqual({
      l3: 0.5,
      l5: 0.333333,
      l10: 0.166667
    });

    expect(getDefaultWindowWeights(["l3", "l5", "l10", "l20"])).toEqual({
      l3: 0.37037,
      l5: 0.296296,
      l10: 0.203704,
      l20: 0.12963
    });
  });

  it("computes a weighted rate across windows", () => {
    const weights = getDefaultWindowWeights(["l3", "l5", "l10"]);
    expect(
      calculateWeightedRate({
        rates: {
          l3: 12,
          l5: 10,
          l10: 8
        },
        weights
      })
    ).toEqual({
      value: 10.38298,
      appliedWeight: 1
    });
  });

  it("ignores missing weighted-rate values", () => {
    expect(
      calculateWeightedRate({
        rates: {
          l3: null,
          l5: undefined
        },
        weights: {
          l3: 0.6,
          l5: 0.4
        }
      })
    ).toEqual({
      value: null,
      appliedWeight: 0
    });
  });
});
