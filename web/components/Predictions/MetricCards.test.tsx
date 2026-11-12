import { describe, expect, it } from "vitest";

import * as cards from "./MetricCards";

const metric = (statKey: string, hitRate: number | null, sampleSize: number) => ({
  statKey,
  mae: null,
  mape: null,
  hitRate,
  marginOfError: null,
  sampleSize,
});

// W3-7 D10 (legacy part): a null hit rate was read as 0% and its samples diluted the total.
describe("MetricCards weighted hit rate", () => {
  it("leaves unknown hit rates out instead of scoring them 0%", () => {
    const weighted = (cards as any).weightedHitRate;
    expect(typeof weighted).toBe("function");
    expect(
      weighted([metric("GOALS", 0.5, 100), metric("ASSISTS", null, 300)]),
    ).toBeCloseTo(0.5, 12);
    expect(
      weighted([metric("GOALS", 0.5, 100), metric("POINTS", 0.8, 300)]),
    ).toBeCloseTo((0.5 * 100 + 0.8 * 300) / 400, 12);
    expect(weighted([metric("GOALS", null, 100)])).toBeNull();
  });
});
