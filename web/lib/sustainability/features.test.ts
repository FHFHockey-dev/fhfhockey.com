import { describe, expect, it } from "vitest";

import {
  calculatePer60Rate,
  calculatePer60Rates,
  calculateContextDelta,
  calculateContextFeatures,
  calculatePerGameRate,
  calculatePerGameRates,
  calculateUsageDelta,
  calculateUsageDeltas,
  calculateWeightedRate,
  calculateZScore,
  calculateZScores,
  aggregateCountDistributions,
  buildCountDistribution,
  emitForecastBands,
  evaluateBandCalibration,
  deriveOpponentAdjustmentFactors,
  empiricalBayesBetaShrink,
  empiricalBayesGammaShrink,
  empiricalBayesShrinkForMetric,
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

  it("shrinks per-60 rates toward the prior mean", () => {
    expect(
      empiricalBayesGammaShrink({
        observedCount: 6,
        observedExposure: 60,
        priorMean: 4,
        priorStrength: 180
      })
    ).toEqual({
      observed: 6,
      shrunk: 4.5,
      priorMean: 4,
      priorStrength: 180,
      sampleWeight: 0.25
    });
  });

  it("shrinks proportion stats toward the prior mean", () => {
    expect(
      empiricalBayesBetaShrink({
        successes: 4,
        trials: 10,
        priorMean: 0.7,
        priorStrength: 50
      })
    ).toEqual({
      observed: 0.4,
      shrunk: 0.65,
      priorMean: 0.7,
      priorStrength: 50,
      sampleWeight: 0.166667
    });
  });

  it("uses metric presets for EB shrinkage defaults", () => {
    expect(
      empiricalBayesShrinkForMetric("shots_per_60", {
        observedCount: 4,
        observedExposure: 30,
        priorMean: 8
      })
    ).toEqual({
      observed: 8,
      shrunk: 8,
      priorMean: 8,
      priorStrength: 360,
      sampleWeight: 0.076923
    });

    expect(
      empiricalBayesShrinkForMetric("ipp", {
        successes: 2,
        trials: 4,
        priorMean: 0.65
      })
    ).toEqual({
      observed: 0.5,
      shrunk: 0.638889,
      priorMean: 0.65,
      priorStrength: 50,
      sampleWeight: 0.074074
    });
  });

  it("leans much harder on the prior for small-N gamma windows than large-N windows", () => {
    const smallSample = empiricalBayesGammaShrink({
      observedCount: 3,
      observedExposure: 15,
      priorMean: 4,
      priorStrength: 180
    });
    const largeSample = empiricalBayesGammaShrink({
      observedCount: 60,
      observedExposure: 600,
      priorMean: 4,
      priorStrength: 180
    });

    expect(smallSample.sampleWeight).toBeLessThan(largeSample.sampleWeight);
    expect(smallSample.shrunk).toBeGreaterThan(4);
    expect(smallSample.shrunk).toBeLessThan(largeSample.shrunk ?? Infinity);
    expect(largeSample.shrunk).toBeCloseTo(5.538462, 6);
  });

  it("leans much harder on the prior for small-N beta windows than large-N windows", () => {
    const smallSample = empiricalBayesBetaShrink({
      successes: 1,
      trials: 2,
      priorMean: 0.7,
      priorStrength: 50
    });
    const largeSample = empiricalBayesBetaShrink({
      successes: 35,
      trials: 50,
      priorMean: 0.5,
      priorStrength: 50
    });

    expect(smallSample.sampleWeight).toBeLessThan(largeSample.sampleWeight);
    expect(smallSample.shrunk).toBeCloseTo(0.692308, 6);
    expect(largeSample.shrunk).toBeCloseTo(0.6, 6);
    expect(Math.abs((smallSample.shrunk ?? 0) - 0.7)).toBeLessThan(
      Math.abs((largeSample.shrunk ?? 0) - 0.7)
    );
  });

  it("calculates usage deltas for TOI-based splits", () => {
    expect(calculateUsageDelta(18, 15)).toEqual({
      recent: 18,
      baseline: 15,
      absoluteDelta: 3,
      percentDelta: 20
    });
  });

  it("returns null percent delta when baseline usage is zero", () => {
    expect(calculateUsageDelta(2, 0)).toEqual({
      recent: 2,
      baseline: 0,
      absoluteDelta: 2,
      percentDelta: null
    });
  });

  it("calculates typed usage delta maps for toi splits", () => {
    expect(
      calculateUsageDeltas({
        recent: {
          toi: 19.5,
          es_toi: 14.2,
          pp_toi: 3.4,
          sh_toi: 1.1
        },
        baseline: {
          toi: 18,
          es_toi: 13,
          pp_toi: 2.8,
          sh_toi: 1.5
        },
        precision: 4
      })
    ).toEqual({
      toi: {
        recent: 19.5,
        baseline: 18,
        absoluteDelta: 1.5,
        percentDelta: 8.3333
      },
      es_toi: {
        recent: 14.2,
        baseline: 13,
        absoluteDelta: 1.2,
        percentDelta: 9.2308
      },
      pp_toi: {
        recent: 3.4,
        baseline: 2.8,
        absoluteDelta: 0.6,
        percentDelta: 21.4286
      },
      sh_toi: {
        recent: 1.1,
        baseline: 1.5,
        absoluteDelta: -0.4,
        percentDelta: -26.6667
      }
    });
  });

  it("calculates raw context deltas for pdo-style values", () => {
    expect(calculateContextDelta(1.025, 0.995, { precision: 4 })).toEqual({
      recent: 1.025,
      baseline: 0.995,
      absoluteDelta: 0.03,
      percentDelta: 3.0151
    });
  });

  it("normalizes percent-like context fields before computing deltas", () => {
    expect(
      calculateContextDelta(12.5, 10, {
        precision: 4,
        normalizePercent: true
      })
    ).toEqual({
      recent: 0.125,
      baseline: 0.1,
      absoluteDelta: 0.025,
      percentDelta: 25
    });
  });

  it("calculates context feature maps for pdo, oiSH%, and OZS%", () => {
    expect(
      calculateContextFeatures({
        recent: {
          pdo: 1.012,
          onIceShPct: 11.2,
          ozsPct: 54
        },
        baseline: {
          pdo: 0.998,
          onIceShPct: 9.8,
          ozsPct: 49.5
        },
        precision: 4
      })
    ).toEqual({
      pdo: {
        recent: 1.012,
        baseline: 0.998,
        absoluteDelta: 0.014,
        percentDelta: 1.4028
      },
      on_ice_sh_pct: {
        recent: 0.112,
        baseline: 0.098,
        absoluteDelta: 0.014,
        percentDelta: 14.2857
      },
      ozs_pct: {
        recent: 0.54,
        baseline: 0.495,
        absoluteDelta: 0.045,
        percentDelta: 9.0909
      }
    });
  });

  it("derives positive opponent adjustment factors for weak defenses", () => {
    expect(
      deriveOpponentAdjustmentFactors({
        gamesPlayed: 60,
        xgaPer60: 3,
        caPer60: 60,
        hdcaPer60: 12,
        svPct: 0.895,
        pkTier: 24
      })
    ).toEqual({
      sampleWeight: 0.705882,
      shotRateMultiplier: 1.028531,
      goalRateMultiplier: 1.044827,
      assistRateMultiplier: 1.004048,
      defenseScore: 0.065613
    });
  });

  it("derives suppressive adjustment factors for strong defenses", () => {
    expect(
      deriveOpponentAdjustmentFactors({
        gamesPlayed: 60,
        xgaPer60: 2.2,
        caPer60: 50,
        hdcaPer60: 8,
        svPct: 0.915,
        pkTier: 4
      })
    ).toEqual({
      sampleWeight: 0.705882,
      shotRateMultiplier: 0.971469,
      goalRateMultiplier: 0.963997,
      assistRateMultiplier: 1.003011,
      defenseScore: -0.051496
    });
  });

  it("falls back to neutral factors when opponent context is missing", () => {
    expect(
      deriveOpponentAdjustmentFactors({
        gamesPlayed: null,
        xgaPer60: null,
        caPer60: null,
        hdcaPer60: null,
        svPct: null,
        pkTier: null
      })
    ).toEqual({
      sampleWeight: 0,
      shotRateMultiplier: 1,
      goalRateMultiplier: 1,
      assistRateMultiplier: 1,
      defenseScore: 0
    });
  });

  it("builds a poisson count distribution for a single game", () => {
    expect(
      buildCountDistribution({
        mean: 0.8,
        model: "poisson",
        precision: 4
      })
    ).toEqual({
      model: "poisson",
      mean: 0.8,
      variance: 0.8,
      p10: 0,
      p50: 0.8,
      p90: 1.9463
    });
  });

  it("builds a negative-binomial style count distribution when dispersion is present", () => {
    expect(
      buildCountDistribution({
        mean: 2,
        model: "negbin",
        dispersion: 0.3,
        precision: 4
      })
    ).toEqual({
      model: "negbin",
      mean: 2,
      variance: 3.2,
      p10: 0,
      p50: 2,
      p90: 4.2925
    });
  });

  it("aggregates poisson game means analytically across a horizon", () => {
    expect(
      aggregateCountDistributions({
        perGameMeans: [0.8, 0.7, 1.1, 0.9, 0.6],
        model: "poisson",
        precision: 4
      })
    ).toEqual({
      model: "poisson",
      mean: 4.1,
      variance: 4.1,
      p10: 1.5051,
      p50: 4.1,
      p90: 6.6949
    });
  });

  it("aggregates overdispersed game means across a horizon", () => {
    expect(
      aggregateCountDistributions({
        perGameMeans: [0.4, 0.6, 0.7, 0.8, 0.5, 0.9, 1.1, 0.6, 0.7, 0.8],
        model: "negbin",
        dispersion: 0.2,
        precision: 4
      })
    ).toEqual({
      model: "negbin",
      mean: 7.1,
      variance: 8.182,
      p10: 3.4342,
      p50: 7.1,
      p90: 10.7658
    });
  });

  it("emits 50% and 80% bands from a count distribution", () => {
    const distribution = aggregateCountDistributions({
      perGameMeans: [0.8, 0.7, 1.1, 0.9, 0.6],
      model: "poisson",
      precision: 4
    });

    expect(emitForecastBands(distribution, 4)).toEqual({
      band50: {
        lower: 2.7343,
        median: 4.1,
        upper: 5.4657
      },
      band80: {
        lower: 1.5051,
        median: 4.1,
        upper: 6.6949
      }
    });
  });

  it("computes simple 50%/80% coverage from a small backtest sample", () => {
    const forecasts = [
      emitForecastBands(
        aggregateCountDistributions({
          perGameMeans: [0.9, 1, 0.8, 0.7, 1.1],
          model: "poisson",
          precision: 4
        }),
        4
      ),
      emitForecastBands(
        aggregateCountDistributions({
          perGameMeans: [0.3, 0.4, 0.2, 0.5, 0.4],
          model: "poisson",
          precision: 4
        }),
        4
      ),
      emitForecastBands(
        aggregateCountDistributions({
          perGameMeans: [1.2, 1.1, 1, 0.9, 1.3],
          model: "negbin",
          dispersion: 0.2,
          precision: 4
        }),
        4
      ),
      null
    ];

    expect(
      evaluateBandCalibration({
        forecasts,
        actuals: [5, 1, 8, 3],
        precision: 4
      })
    ).toEqual({
      samples: 3,
      hitRate50: 0.6667,
      hitRate80: 1
    });
  });
});
