import { describe, expect, it } from "vitest";

import {
  evaluateProjectionPromotionGates,
  evaluateShadowModeImprovement
} from "./promotionGates";

describe("projection promotion gates", () => {
  it("fails launch gates when required metrics breach acceptance thresholds", () => {
    const result = evaluateProjectionPromotionGates([
      { key: "skater_mae_30d", value: 2.4, max: 2 },
      { key: "coverage_80", value: 0.78, min: 0.75 },
      { key: "goalie_mae_30d", value: null }
    ]);

    expect(result.status).toBe("fail");
    expect(result.failures).toEqual(
      expect.arrayContaining([
        "skater_mae_30d=2.4 exceeds max 2",
        "goalie_mae_30d is missing"
      ])
    );
  });

  it("evaluates shadow-mode improvement versus the current baseline", () => {
    expect(
      evaluateShadowModeImprovement({
        baselineMae: 10,
        candidateMae: 9.2,
        minImprovementPct: 5
      })
    ).toMatchObject({
      status: "pass",
      improvementPct: 8
    });

    expect(
      evaluateShadowModeImprovement({
        baselineMae: 10,
        candidateMae: 10.3
      })
    ).toMatchObject({
      status: "fail",
      improvementPct: -3
    });
  });
});
