import { describe, expect, it } from "vitest";
import { getPerformanceLevelLabel } from "./PlayerPerformanceHeatmap";

// W3-3 D1 copy (decision 74): the heat map's level is a weighted 0-100
// score from fixed cut-offs, so its labels never claim a percentile.
describe("heat map performance levels", () => {
  it("labels levels as score bands, never percentiles", () => {
    const levels = [
      "elite",
      "excellent",
      "good",
      "average",
      "below-average",
      "poor",
      "very-poor"
    ] as const;
    const labels = levels.map((level) => getPerformanceLevelLabel(level));
    expect(labels.join(" ")).not.toMatch(/percentile/i);
    expect(labels[0]).toBe("Elite (score 90-100)");
    expect(labels[6]).toBe("Very Poor (score 0-9)");
  });
});
