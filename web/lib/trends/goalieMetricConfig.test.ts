import { describe, expect, it } from "vitest";
import { summarizeGoalieTrendConfidence } from "./goalieMetricConfig";

describe("summarizeGoalieTrendConfidence", () => {
  it("returns qualified confidence and normalized percentile volatility", () => {
    expect(
      summarizeGoalieTrendConfidence([40, 42, 44, 46, 48, 50, 52, 54, 56, 58])
    ).toEqual({ sampleSize: 10, confidence: "high", volatility: 5.7 });
    expect(summarizeGoalieTrendConfidence([40, 50, 60, 70, 80])).toEqual({
      sampleSize: 5,
      confidence: "medium",
      volatility: 14.1
    });
    expect(summarizeGoalieTrendConfidence([])).toEqual({
      sampleSize: 0,
      confidence: "low",
      volatility: null
    });
  });
});
