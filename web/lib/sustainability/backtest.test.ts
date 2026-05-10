import { describe, expect, it } from "vitest";

import { runSustainabilityBaselineBacktest } from "./backtest";

describe("sustainability baseline backtest", () => {
  it("compares the canonical score against simple baseline variants", () => {
    const result = runSustainabilityBaselineBacktest(
      [
        {
          metricKey: "shots_per_60",
          actual: 10,
          sustainabilityPrediction: 9.8,
          careerBaseline: 8.5,
          seasonBaseline: 9.2,
          recentValue: 12
        },
        {
          metricKey: "shots_per_60",
          actual: 6,
          sustainabilityPrediction: 6.1,
          careerBaseline: 7.1,
          seasonBaseline: 6.8,
          recentValue: 4
        },
        {
          metricKey: "shots_per_60",
          actual: 8,
          sustainabilityPrediction: 7.9,
          careerBaseline: 8.8,
          seasonBaseline: 8.3,
          recentValue: 9.6
        }
      ],
      { precision: 4 }
    );

    expect(result.modelVersion).toBe("sustainability_score_v2");
    expect(result.variants).toHaveLength(5);
    expect(result.bestByMae).toBe("sustainability_score");
    expect(
      result.variants.find((variant) => variant.variant === "sustainability_score")
    ).toMatchObject({
      sampleCount: 3,
      mae: 0.1333,
      bias: -0.0667
    });
  });

  it("skips rows with missing actuals or predictions per variant", () => {
    const result = runSustainabilityBaselineBacktest([
      {
        metricKey: "ixg_per_60",
        actual: 1,
        sustainabilityPrediction: null,
        careerBaseline: 0.9
      },
      {
        metricKey: "ixg_per_60",
        actual: null,
        sustainabilityPrediction: 1.2,
        careerBaseline: 1.1
      }
    ]);

    expect(
      result.variants.find((variant) => variant.variant === "sustainability_score")
    ).toMatchObject({
      sampleCount: 0,
      mae: null,
      rmse: null
    });
    expect(
      result.variants.find((variant) => variant.variant === "career_only")
    ).toMatchObject({
      sampleCount: 1,
      mae: 0.1
    });
  });
});
