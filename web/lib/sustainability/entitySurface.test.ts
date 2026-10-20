import { describe, expect, it } from "vitest";

import {
  deriveLegacyExpectationState,
  extractReasonHighlights,
  getSandboxMetricLabel
} from "./entitySurface";

describe("entitySurface", () => {
  it.each([1.2, -1.2, 0.75, -0.75, 0.1, 0, null, undefined, NaN, Infinity, -Infinity])(
    "does not infer observed-vs-expected performance from raw process index %s",
    (value) => expect(deriveLegacyExpectationState(value)).toBe("unavailable"),
  );

  it("extracts the strongest numeric component signals first", () => {
    const reasons = extractReasonHighlights({
      z_ixg60: -1.8,
      z_icf60: 0.4,
      z_hdcf60: 1.2
    });

    expect(reasons).toHaveLength(3);
    expect(reasons[0]?.key).toBe("z_ixg60");
    expect(reasons[0]?.sentence).toContain("Chance creation");
    expect(reasons[1]?.key).toBe("z_hdcf60");
  });

  it("returns configured metric labels for each entity class", () => {
    expect(getSandboxMetricLabel("team", "xgf_pct")).toBe("xGF%");
    expect(getSandboxMetricLabel("goalie", "save_pct")).toBe("Save %");
    expect(getSandboxMetricLabel("skater", "ixg_per_60")).toBe("ixG / 60");
  });
});
