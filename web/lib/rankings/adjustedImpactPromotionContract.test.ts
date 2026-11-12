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
      emptyNetTreatmentValidated: false,
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

  it("allows promotion only when all controls are verified and the empty-net treatment is validated", () => {
    expect(
      evaluateAdjustedImpactPromotionReadiness(
        [{ status: "verified" }, { status: "verified" }],
        { emptyNetTreatment: { validation: "validated" } }
      )
    ).toEqual({
      status: "rankings_promotable",
      missingControlCount: 0,
      unjoinedControlCount: 0,
      emptyNetTreatmentValidated: true,
    });
  });

  it.each([
    ["an unvalidated empty-net label", { emptyNetTreatment: { validation: "unvalidated" } }],
    ["a run stored without the label", { emptyNetTreatment: null }],
    ["no run provenance", null],
  ])("refuses promotion with %s even when every control is verified (decision 100)", (_name, provenance) => {
    expect(
      evaluateAdjustedImpactPromotionReadiness(
        [{ status: "verified" }, { status: "verified" }],
        provenance
      ).status
    ).toBe("blocked_unvalidated_empty_net_treatment");
  });
});
