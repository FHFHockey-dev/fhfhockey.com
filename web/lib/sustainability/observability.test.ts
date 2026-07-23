import { describe, expect, it } from "vitest";

import {
  buildSustainabilityExtremeMetadata,
  countExtremeSustainabilityRows
} from "./observability";

describe("sustainability observability", () => {
  it("flags only finite raw z-scores beyond the canonical threshold", () => {
    expect(buildSustainabilityExtremeMetadata({
      z_shp: 5,
      z_ipp: -5.01,
      z_oishp: Number.NaN,
      z_ppshp: 7
    })).toEqual({
      extremeFlag: true,
      extremeMetrics: ["z_ipp", "z_ppshp"],
      extremeThreshold: 5
    });
  });

  it("counts persisted component-level extreme flags", () => {
    expect(countExtremeSustainabilityRows([
      { components: { extremeFlag: true } },
      { components: { extremeFlag: false } },
      { components: null }
    ])).toBe(1);
  });
});
