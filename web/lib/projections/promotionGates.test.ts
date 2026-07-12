import { describe, expect, it } from "vitest";

import {
  buildHoldoutComparisonReport,
  evaluateProjectionPromotionGates,
  evaluateShadowModeImprovement,
} from "./promotionGates";

describe("projection promotion gates", () => {
  it("fails launch gates when required metrics breach acceptance thresholds", () => {
    const result = evaluateProjectionPromotionGates([
      { key: "skater_mae_30d", value: 2.4, max: 2 },
      { key: "coverage_80", value: 0.78, min: 0.75 },
      { key: "goalie_mae_30d", value: null },
    ]);

    expect(result.status).toBe("fail");
    expect(result.failures).toEqual(
      expect.arrayContaining([
        "skater_mae_30d=2.4 exceeds max 2",
        "goalie_mae_30d is missing",
      ]),
    );
  });

  it("evaluates shadow-mode improvement versus the current baseline", () => {
    expect(
      evaluateShadowModeImprovement({
        baselineMae: 10,
        candidateMae: 9.2,
        minImprovementPct: 5,
      }),
    ).toMatchObject({
      status: "pass",
      improvementPct: 8,
    });

    expect(
      evaluateShadowModeImprovement({
        baselineMae: 10,
        candidateMae: 10.3,
      }),
    ).toMatchObject({
      status: "fail",
      improvementPct: -3,
    });
  });

  it("builds one holdout report against current and naive baselines", () => {
    const report = buildHoldoutComparisonReport(
      [
        { actual: 8, candidate: 7, currentBaseline: 6, naivePrior: 5 },
        { actual: 4, candidate: 4, currentBaseline: 2, naivePrior: 1 },
      ],
      { minimumSampleCount: 2 },
    );

    expect(report.status).toBe("ready");
    expect(report.comparisons.currentBaseline).toMatchObject({
      status: "ready",
      candidate: { sampleCount: 2, mae: 0.5 },
      baseline: { sampleCount: 2, mae: 2 },
      maeDelta: -1.5,
      maeImprovementPct: 75,
    });
    expect(report.comparisons.naivePrior).toMatchObject({
      status: "ready",
      baseline: { sampleCount: 2, mae: 3 },
      maeDelta: -2.5,
    });
  });

  it("reports insufficient data independently for missing comparator values", () => {
    const report = buildHoldoutComparisonReport(
      [{ actual: 5, candidate: 4, currentBaseline: 3, naivePrior: null }],
      { minimumSampleCount: 1 },
    );

    expect(report.status).toBe("insufficient_data");
    expect(report.comparisons.currentBaseline.status).toBe("ready");
    expect(report.comparisons.naivePrior).toMatchObject({
      status: "insufficient_data",
      candidate: { sampleCount: 0, mae: null },
      baseline: { sampleCount: 0, mae: null },
      maeDelta: null,
    });
  });
});
