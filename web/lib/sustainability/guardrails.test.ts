import { describe, expect, it } from "vitest";

import {
  applySustainabilityScoreGuardrails,
  guardSustainabilityDashboardRow
} from "./guardrails";

describe("sustainability guardrails", () => {
  it("clips exploding z-scores and raw scores before persistence", () => {
    const guarded = applySustainabilityScoreGuardrails({
      sRaw: 22,
      components: {
        z_shp: 14,
        z_oishp: -9,
        z_ipp: 0.4,
        warnings: ["existing_warning"]
      }
    });

    expect(guarded.state).toBe("degraded");
    expect(guarded.sRaw).toBe(8);
    expect(guarded.s100).toBeLessThan(100);
    expect(guarded.components).toMatchObject({
      z_shp: 3,
      z_oishp: -3,
      guardrailState: "degraded"
    });
    expect(guarded.warnings).toContain("guardrail_clipped_s_raw");
    expect(guarded.components.warnings as string[]).toContain("existing_warning");
  });

  it("marks invalid dashboard values as blocked instead of ordinary predictions", () => {
    const guarded = guardSustainabilityDashboardRow({
      sRaw: Number.NaN,
      s100: 120,
      luckPressure: Infinity,
      components: {}
    });

    expect(guarded.state).toBe("blocked");
    expect(guarded.s100).toBeGreaterThanOrEqual(0);
    expect(guarded.s100).toBeLessThanOrEqual(100);
    expect(guarded.luckPressure).toBe(0);
    expect(guarded.warnings).toEqual(
      expect.arrayContaining([
        "guardrail_invalid_s_raw",
        "guardrail_invalid_luck_pressure"
      ])
    );
  });

  it("keeps fractional v2 precision and reserves exact endpoints for qualified raw probabilities", () => {
    expect(
      applySustainabilityScoreGuardrails({ sRaw: 2 }).s100
    ).toBe(88.08);

    const invalidHigh = applySustainabilityScoreGuardrails({
      sRaw: 0,
      s100: 100,
      recomputeScore: false
    });
    const invalidLow = applySustainabilityScoreGuardrails({
      sRaw: 0,
      s100: 0,
      recomputeScore: false
    });
    const qualifiedHigh = applySustainabilityScoreGuardrails({
      sRaw: 8,
      s100: 100,
      recomputeScore: false
    });
    const qualifiedLow = applySustainabilityScoreGuardrails({
      sRaw: -8,
      s100: 0,
      recomputeScore: false
    });

    expect(invalidHigh.s100).toBe(50);
    expect(invalidHigh.warnings).toContain("guardrail_invalid_exact_100");
    expect(invalidLow.s100).toBe(50);
    expect(invalidLow.warnings).toContain("guardrail_invalid_exact_0");
    expect(qualifiedHigh.s100).toBe(100);
    expect(qualifiedHigh.warnings).not.toContain("guardrail_invalid_exact_100");
    expect(qualifiedLow.s100).toBe(0);
    expect(qualifiedLow.warnings).not.toContain("guardrail_invalid_exact_0");
  });
});
