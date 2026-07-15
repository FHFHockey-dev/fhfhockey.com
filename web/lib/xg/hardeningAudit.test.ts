import { describe, expect, it } from "vitest";

import {
  XG_EXTERNAL_TAXONOMY,
  buildXgInternalBenchmarkSurfaces,
  buildXgSegmentCalibrationAudit,
  type XgHardeningShot,
} from "./hardeningAudit";

function shot(overrides: Partial<XgHardeningShot> = {}): XgHardeningShot {
  return {
    gameId: 1,
    eventId: 1,
    prediction: 0.2,
    label: 0,
    rinkId: "BOS",
    isPlayoff: false,
    strengthState: "5v5",
    scoreState: "tied",
    shotEventType: "shot-on-goal",
    isEmptyNet: false,
    ...overrides,
  };
}

describe("xG hardening audit contracts", () => {
  it("reports calibration quality and insufficiency across every required segment axis", () => {
    const rows = [
      shot({ eventId: 1, label: 1, prediction: 0.8 }),
      shot({ eventId: 2, label: 0, prediction: 0.2 }),
      shot({ eventId: 3, rinkId: null, isPlayoff: true, strengthState: "5v4", scoreState: "trailing", label: 0, prediction: 0.4 }),
    ];
    const audit = buildXgSegmentCalibrationAudit(rows, { minimumSampleSize: 2, binCount: 5 });

    expect(new Set(audit.segments.map((row) => row.axis))).toEqual(
      new Set(["rink", "playoff", "strength_state", "score_state"]),
    );
    expect(audit.segments.find((row) => row.axis === "rink" && row.value === "BOS")).toMatchObject({
      status: "sufficient",
      metrics: { exampleCount: 2, goalCount: 1, brierScore: 0.04 },
      expectedCalibrationError: 0.2,
    });
    expect(audit.segments.find((row) => row.axis === "rink" && row.value === "unknown")).toMatchObject({
      status: "insufficient",
      warnings: expect.arrayContaining([expect.stringContaining("below minimum")]),
    });
  });

  it("keeps all-situations and 5v5 non-empty-net benchmark universes distinct", () => {
    const surfaces = buildXgInternalBenchmarkSurfaces([
      shot({ eventId: 1, label: 1, prediction: 0.7 }),
      shot({ eventId: 2, strengthState: "5v4", prediction: 0.3 }),
      shot({ eventId: 3, isEmptyNet: true, prediction: 0.9 }),
      shot({ eventId: 4, shotEventType: "blocked-shot", prediction: 0.1 }),
    ]);

    expect(surfaces[0]).toMatchObject({
      key: "all_situations_unblocked",
      metrics: { exampleCount: 3 },
      definition: { strengthUniverse: "all", emptyNetPolicy: "included" },
    });
    expect(surfaces[1]).toMatchObject({
      key: "five_on_five_non_empty_net_unblocked",
      metrics: { exampleCount: 1 },
      definition: { strengthUniverse: "5v5", emptyNetPolicy: "excluded" },
    });
  });

  it("requires taxonomy alignment before external disagreement can be called a failure", () => {
    expect(XG_EXTERNAL_TAXONOMY).toHaveLength(3);
    expect(XG_EXTERNAL_TAXONOMY.every((row) => row.comparisonRule === "taxonomy_alignment_required_before_failure_classification")).toBe(true);
    expect(XG_EXTERNAL_TAXONOMY.find((row) => row.provider === "MoneyPuck")).toMatchObject({
      verification: "primary_source_verified",
      eventUniverse: expect.stringContaining("Unblocked"),
      flurryTreatment: expect.stringContaining("flurry-adjusted"),
    });
    expect(XG_EXTERNAL_TAXONOMY.find((row) => row.provider === "Natural Stat Trick")).toMatchObject({
      verification: "provider_verification_required",
      sourceUrl: null,
    });
  });
});

