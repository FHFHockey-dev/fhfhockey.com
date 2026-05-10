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
});
