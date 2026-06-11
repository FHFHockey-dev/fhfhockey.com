import { describe, expect, it } from "vitest";

import {
  ADJUSTED_IMPACT_PROMOTION_CONTRACT,
  evaluateAdjustedImpactPromotionReadiness,
} from "./adjustedImpactPromotionContract";

describe("adjustedImpactPromotionContract", () => {
  it("keeps live adjusted-impact output as diagnostic-only until promotion controls are complete", () => {
    expect(ADJUSTED_IMPACT_PROMOTION_CONTRACT.currentStatus).toBe("diagnostic_live");
    expect(ADJUSTED_IMPACT_PROMOTION_CONTRACT.liveOutputTables).toContain(
      "nhl_xg_adjusted_player_impacts"
    );
    expect(ADJUSTED_IMPACT_PROMOTION_CONTRACT.currentUse).toMatch(/diagnostic source only/);

    const readiness = evaluateAdjustedImpactPromotionReadiness(
      ADJUSTED_IMPACT_PROMOTION_CONTRACT.controls
    );

    expect(readiness).toEqual({
      status: "blocked_missing_controls",
      missingControlCount: 1,
      unjoinedControlCount: 2,
    });
    expect(ADJUSTED_IMPACT_PROMOTION_CONTRACT.controls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "rest_days",
          status: "available_not_joined",
        }),
        expect.objectContaining({
          key: "zone_starts",
          status: "available_not_joined",
        }),
        expect.objectContaining({
          key: "defense_specific_target",
          status: "missing",
        }),
      ])
    );
  });

  it("allows promotion only when all required controls are verified", () => {
    expect(
      evaluateAdjustedImpactPromotionReadiness([
        { status: "verified" },
        { status: "verified" },
      ])
    ).toEqual({
      status: "rankings_promotable",
      missingControlCount: 0,
      unjoinedControlCount: 0,
    });
  });
});
